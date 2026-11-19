"""The relief of the land beyond the home country, kind by kind: numbers, shaded maps and views, to compare two builds.
python3 tools/relief.py OUTDIR [seed ...]             -> OUTDIR/relief_s{seed}.json, OUTDIR/s{seed}_{kind}_{map,ground,air150,air500}.png
python3 tools/relief.py --compare OUT LABEL=DIR ...   -> OUT/cmp_s{seed}_{kind}.jpg: the builds side by side, with their numbers
HTTP_PORT picks the build (serve each build on its own port); VIEWS=0 skips the views; KINDS=downs,weald picks the kinds.
For each seed and each kind of country beyond home (heart, downs, fen, moor, weald) one spot: the point of a 500 m lattice nearest home that lies
at least 5.5 km beyond the home box, 3 km inside its country's border belts, 3 km inland and wholly of that kind. None of that depends on
the relief, so two builds measure the same spots. Round each spot the countries are planned and terrainRaw is sampled on a 10 m grid over
4 x 4 km. The numbers:
 - crest4, crest15: the median distance between a crest and the next hollow along the rows and columns of a 20 m grid (a turning point
   counts once the ground has climbed or fallen 4 m since the last one; again with 15 m)
 - only the ground of that kind (weight over 0.85), 1.5 km clear of the border belts and 600 m from the coast counts (measured: its share)
 - slope50, slope90, slope99: percentiles of the slope in degrees (2 m differences, as terrainSlope); steep: the share of ground too steep
   to climb (terrainSlope > 1.2, the player's rule); range: the 5th to 95th percentile of the height
 - bands: how much height the shapes of each size carry: the standard deviation of the ground smoothed to each size less the ground
   smoothed to the next (fine < 60 m, small 60-200, middle 200-600, large 600-2000 m)"""
import asyncio, sys, os, json, ast, math
sys.path.insert(0, os.path.dirname(__file__))
KINDS = ['heart', 'downs', 'fen', 'moor', 'weald']
SPAN, STEP = 4000, 10
LABELS = {'map': 'shaded map 4 x 4 km, north up (light from the north-west)', 'ground': 'ground', 'air150': '150 m up, looking north', 'air500': '500 m up, looking north'}

SPOTS = r"""(()=>{const g=__game,out={};
 for(let k=0;k<5;k++){let best=null;
  for(let x=-60000;x<=60000;x+=500)for(let z=-70000;z<=1500;z+=500){const ho=g.homeOut(x,z);if(ho<5500||(best&&ho>=best[0]))continue;
   if(g.coastZ(x)-z<3000||g.rimDist(x,z)<3000)continue;const w=g.regionW(x,z);if(!w||w[k]<0.97)continue;best=[ho,x,z];}
  if(best)out[g.RG_KEYS[k]]=[best[1],best[2]];}
 return JSON.stringify(out);})()"""

SAMPLE = r"""(()=>{const g=__game,[X,Z,SPAN,STEP,K]=ARGS,W=g.World;W.DROP=1e12;const t0=performance.now();
 W.planBox(X-SPAN/2-200,Z-SPAN/2-200,X+SPAN/2+200,Z+SPAN/2+200);const plan=Math.round(performance.now()-t0);
 const n=Math.round(SPAN/STEP)+1,H=new Array(n*n),t1=performance.now();
 for(let j=0;j<n;j++)for(let i=0;i<n;i++)H[j*n+i]=+g.terrainRaw(X-SPAN/2+i*STEP,Z-SPAN/2+j*STEP).toFixed(2);
 const S=[],M=[],e=2;for(let j=0;j<n;j+=2)for(let i=0;i<n;i+=2){const x=X-SPAN/2+i*STEP,z=Z-SPAN/2+j*STEP,w=g.regionW(x,z);S.push(+(Math.hypot(g.terrainRaw(x+e,z)-g.terrainRaw(x-e,z),g.terrainRaw(x,z+e)-g.terrainRaw(x,z-e))/(2*e)).toFixed(3));
  M.push(w&&w[K]>0.85&&g.rimDist(x,z)>1500&&g.coastZ(x)-z>600?1:0);} /* (the ground measured: of this kind, clear of the border belts and the coast) */
 const w=g.regionW(X,Z);return JSON.stringify({n,H,S,M,plan,sampleMs:Math.round(performance.now()-t1),w:w?Array.from(w,v=>+v.toFixed(3)):null,planCpu:g.World.planMs});})()"""

def wild_place():
    """wild.py's camera placement (steps clear of trunks and walls, turns to an open outlook), read from its source rather than copied."""
    src = open(os.path.join(os.path.dirname(__file__), 'wild.py')).read()
    for node in ast.parse(src).body:
        if isinstance(node, ast.Assign) and getattr(node.targets[0], 'id', '') == 'PLACE': return node.value.value
    raise SystemExit('no PLACE in wild.py')

def numbers(n, H, S, M=None):
    import numpy as np
    h = np.array(H, dtype=np.float64).reshape(n, n)
    def crest(a, thr):  # distances between successive turning points along each line (20 m apart), with hysteresis thr
        ds = []
        for line in a:
            turns = []; d = 0; mx = mn = line[0]; mxp = mnp = 0; ext = pos = None  # d: +1 climbing, -1 falling, 0 not yet known
            for k in range(1, len(line)):
                v = line[k]
                if d == 0:
                    if v > mx: mx, mxp = v, k
                    if v < mn: mn, mnp = v, k
                    if v - mn >= thr: turns.append(mnp); d, ext, pos = 1, v, k
                    elif mx - v >= thr: turns.append(mxp); d, ext, pos = -1, v, k
                elif d > 0:
                    if v > ext: ext, pos = v, k
                    elif ext - v >= thr: turns.append(pos); d, ext, pos = -1, v, k
                else:
                    if v < ext: ext, pos = v, k
                    elif v - ext >= thr: turns.append(pos); d, ext, pos = 1, v, k
            ds += [(b - a0) * STEP * 2 for a0, b in zip(turns, turns[1:])]
        return float(np.median(ds)) if ds else float('nan')
    h20 = h[::2, ::2]; n2 = h20.shape[0]
    m20 = np.array(M, dtype=bool).reshape(n2, n2) if M else np.ones_like(h20, dtype=bool)
    def runs(a, m):  # the stretches of each line that lie on the ground measured
        for line, ok in zip(a, m):
            k = 0
            while k < len(line):
                if not ok[k]: k += 1; continue
                e = k
                while e < len(line) and ok[e]: e += 1
                if e - k > 10: yield line[k:e]
                k = e
    lines = list(runs(h20, m20)) + list(runs(h20.T, m20.T))
    sl = np.array(S)[m20.ravel()]
    deg = np.degrees(np.arctan(sl))
    def box(a, w):  # a box mean w metres wide, twice (close to a triangle filter), with the edges reflected
        r = max(1, int(round(w / STEP / 2)))
        for _ in range(2):
            for ax in (0, 1):
                p = np.pad(a, [(r, r) if q == ax else (0, 0) for q in (0, 1)], mode='reflect')
                c = np.cumsum(p, axis=ax, dtype=np.float64); c = np.insert(c, 0, 0, axis=ax)
                a = (np.take(c, range(2 * r + 1, c.shape[ax]), axis=ax) - np.take(c, range(0, c.shape[ax] - 2 * r - 1), axis=ax)) / (2 * r + 1)
        return a
    sm = [h] + [box(h, w) for w in (60, 200, 600, 2000)]
    m = n // 6  # the edges of the window are left out of the bands (the reflection there is not ground), and so is the ground not measured
    mk = np.repeat(np.repeat(m20, 2, 0), 2, 1)[:n, :n]; mk[:m] = mk[-m:] = False; mk[:, :m] = mk[:, -m:] = False
    band = [float(np.std((sm[q] - sm[q + 1])[mk])) if mk.any() else float('nan') for q in range(4)]
    return {'crest4': crest(lines, 4), 'crest15': crest(lines, 15), 'slope50': float(np.percentile(deg, 50)), 'slope90': float(np.percentile(deg, 90)),
            'slope99': float(np.percentile(deg, 99)), 'steep': float((sl > 1.2).mean()), 'range': float(np.percentile(h20[m20], 95) - np.percentile(h20[m20], 5)), 'measured': float(m20.mean()),
            'bands': dict(zip(['fine', 'small', 'middle', 'large'], [round(b, 2) for b in band]))}

def shaded(n, H, path, M=None):
    import numpy as np
    from PIL import Image
    h = np.array(H, dtype=np.float64).reshape(n, n)
    gx = np.gradient(h, STEP, axis=1); gz = np.gradient(h, STEP, axis=0)
    nx, ny, nz = -gx, np.ones_like(h), -gz; l = np.sqrt(nx * nx + ny * ny + nz * nz)
    L = np.array([-0.55, 0.62, -0.55]); L /= np.linalg.norm(L)                   # light from the north-west, as maps are shaded
    s = np.clip((nx * L[0] + ny * L[1] + nz * L[2]) / l, 0, 1)
    lo, hi = np.percentile(h, 1), np.percentile(h, 99); t = np.clip((h - lo) / max(1, hi - lo), 0, 1)
    base = np.stack([150 + 80 * t, 170 + 50 * t, 120 + 70 * t], -1)               # green low ground to pale high ground
    rgb = base * (0.35 + 0.85 * s[..., None])
    rgb[h < 0.2] = [60, 90, 140]
    if M:  # the ground left out of the numbers is dimmed
        n2 = int(round(len(M) ** 0.5)); mk = np.repeat(np.repeat(np.array(M, dtype=bool).reshape(n2, n2), 2, 0), 2, 1)[:n, :n]; rgb[~mk] *= 0.55
    Image.fromarray(np.clip(rgb, 0, 255).astype('uint8')).save(path)

async def measure(out, seeds):
    from cdp import CDP
    os.makedirs(out, exist_ok=True); place = wild_place(); views = os.environ.get('VIEWS', '1') != '0'
    only = os.environ.get('KINDS', '').split(',') if os.environ.get('KINDS') else KINDS
    for seed in seeds:
        c = CDP()
        if not await c.boot(f'http://127.0.0.1:8765/index.html?seed={seed}', timeout=240): print('boot failed', c.errors()[:2]); c.stop(); continue
        if views:
            await c.new_game()
            for _ in range(40):
                if await c.ev("!!(__game.G.player && __game.G.state === 'play')"): break
                await asyncio.sleep(0.5)
            await asyncio.sleep(2)
            await c.ev("document.getElementById('msgs').style.display='none'; document.getElementById('hint').style.display='none'; document.getElementById('status').style.display='none'")
        spots = json.loads(await c.ev(SPOTS)); res = {}
        for kind in [k for k in KINDS if k in only and k in spots]:
            x, z = spots[kind]
            r = await c.ev(SAMPLE.replace('ARGS', json.dumps([x, z, SPAN, STEP, KINDS.index(kind)])))
            if not r or str(r).startswith('ERR'): print(seed, kind, 'sampling failed', str(r)[:300]); continue
            o = json.loads(r); num = numbers(o['n'], o['H'], o['S'], o['M']); shaded(o['n'], o['H'], f'{out}/s{seed}_{kind}_map.png', o['M'])
            res[kind] = {'at': [x, z], 'w': o['w'], 'planMs': o['plan'], 'sampleMs': o['sampleMs'], **num}
            print(seed, kind, json.dumps(res[kind]))
            if views:
                for name, (vx, vz, yaw, pitch, fly, arc) in {'ground': (x, z, 0, -0.03, None, 3.14), 'air150': (x, z + 900, 0, -0.2, 150, 0), 'air500': (x, z + 2100, 0, -0.27, 500, 0)}.items():
                    where = await c.ev(place.replace('ARGS', json.dumps([vx, vz, yaw, pitch, fly, arc, 8, kind + '_' + name])))
                    if not where or str(where).startswith('ERR'): print(seed, kind, name, 'placement failed', str(where)[:200]); continue
                    await asyncio.sleep(float(os.environ.get('WAIT', '6'))); await c.shot(f'{out}/s{seed}_{kind}_{name}.png')
        json.dump(res, open(f'{out}/relief_s{seed}.json', 'w'), indent=1)
        print(seed, 'errors:', [e[:300] for e in c.errors() if 'render failed once' not in e][:3]); c.stop()

def compare(out, builds):
    """One sheet per seed and kind: a column per build (views, then the shaded map), the numbers under each."""
    from PIL import Image, ImageDraw
    os.makedirs(out, exist_ok=True); W = 560
    seeds = sorted({f.split('_')[1][1:].split('.')[0] for _, d in builds for f in os.listdir(d) if f.startswith('relief_s')}, key=int)
    for seed in seeds:
        res = [(lab, json.load(open(f'{d}/relief_s{seed}.json'))) if os.path.exists(f'{d}/relief_s{seed}.json') else (lab, {}) for lab, d in builds]
        for kind in KINDS:
            bk = [(lab, d) for (lab, d), (_, r) in zip(builds, res) if kind in r]  # (a build measured without this kind gets no column)
            if not bk: continue
            rows = [v for v in ('ground', 'air150', 'air500', 'map') if any(os.path.exists(f'{d}/s{seed}_{kind}_{v}.png') for _, d in bk)]
            hs = {'map': W}; ims = {}
            for v in rows:
                for (lab, d) in bk:
                    f = f'{d}/s{seed}_{kind}_{v}.png'
                    if os.path.exists(f): i = Image.open(f).convert('RGB'); i = i.resize((W, int(i.height * W / i.width)) if v != 'map' else (W, W)); ims[(lab, v)] = i; hs[v] = i.height
            TXT = 150; top = 30
            sheet = Image.new('RGB', (W * len(bk), top + sum(hs[v] for v in rows) + TXT), (24, 24, 24)); d = ImageDraw.Draw(sheet)
            any_r = next(r[kind] for _, r in res if kind in r)
            d.text((6, 8), f'seed {seed}, {kind}: 4 x 4 km round ({any_r["at"][0]}, {any_r["at"][1]})', fill=(255, 255, 255))
            for c, (lab, d0) in enumerate(bk):
                y = top
                for v in rows:
                    if (lab, v) in ims: sheet.paste(ims[(lab, v)], (c * W, y))
                    d.rectangle([c * W, y, c * W + 8 * len(lab + ': ' + LABELS[v]) + 10, y + 16], fill=(0, 0, 0)); d.text((c * W + 5, y + 2), lab + ': ' + LABELS[v], fill=(255, 255, 255))
                    y += hs[v]
                r = dict(res)[lab].get(kind)
                if r:
                    b = r['bands']
                    for k, line in enumerate([lab, f'crest to hollow: {r["crest4"]:.0f} m (4 m), {r["crest15"]:.0f} m (15 m)', f'slope: half under {r["slope50"]:.1f}, 90 % under {r["slope90"]:.1f}, 99 % under {r["slope99"]:.1f} deg',
                                              f'too steep to climb: {100 * r["steep"]:.2f} %   height range (5-95 %): {r["range"]:.0f} m   measured: {100 * r.get("measured", 1):.0f} %', f'height carried (sd, m): fine {b["fine"]}, small {b["small"]}, middle {b["middle"]}, large {b["large"]}',
                                              '(fine < 60 m, small 60-200, middle 200-600, large 600-2000; dimmed ground not measured)']):
                        d.text((c * W + 8, y + 8 + 22 * k), line, fill=(255, 255, 160) if k == 0 else (230, 230, 230))
            sheet.save(f'{out}/cmp_s{seed}_{kind}.jpg', quality=86); print(f'{out}/cmp_s{seed}_{kind}.jpg')

if len(sys.argv) > 2 and sys.argv[1] == '--compare': compare(sys.argv[2], [tuple(a.split('=', 1)) for a in sys.argv[3:]])
else: asyncio.run(measure(sys.argv[1] if len(sys.argv) > 1 else 'tools/out/relief', [int(a) for a in sys.argv[2:]] or [0]))
