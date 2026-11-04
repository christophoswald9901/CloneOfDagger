"""Draw a town's plan from above, as data (no 3D): python3 tools/townplan.py OUTDIR 0 1 2
Seed 0 is the town as shipped, other seeds lay it out afresh (?townseed=N). Writes OUTDIR/plan_N.png and prints counts."""
import asyncio, json, os, sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP

DUMP = r"""(()=>{const T=__game.TOWNS[0],r=a=>a.map(p=>[+p[0].toFixed(1),+p[1].toFixed(1)]);
 return JSON.stringify({wall:r(T.wall),moat:r(T.offPoly(T.cfg.moat.off+T.cfg.moat.w/2)),canal:r(T.canal),cw:T.cfg.canal.w,
  streets:T.streets.map(s=>[s.u0,s.v0,s.u1,s.v1,s.w,s.main?1:s.quay?2:s.ring?3:s.nopave?4:0]),
  blocks:T.blocks.map(b=>({p:r(b.poly),use:b.use,kind:b.kind||''})),
  lots:T.lots.filter(l=>!l.suburb).map(l=>{const c=Math.cos(l.a),s=Math.sin(l.a);return [l.u,l.v,c,s,l.w/2,l.d/2,l.kind,l.type]}),
  bridges:T.bridges.map(b=>[b.u,b.v]),ang:T.cfg.ang,nodes:T.nodes.length,gates:T.gates.map(g=>[g.u,g.v])})})()"""

KIND = {'old': (186, 120, 96), 'grand': (200, 90, 70), 'close': (170, 170, 190), 'canal': (120, 110, 150), 'weavers': (190, 160, 100), 'tanners': (150, 120, 80),
        'commons': (150, 170, 110), 'citadel': (130, 130, 130), 'suburb': (160, 160, 160)}
USE = {'square': (210, 200, 180), 'market': (205, 195, 170), 'parvis': (215, 205, 185), 'cathedral': (90, 90, 110), 'hall': (120, 60, 50), 'citadel': (80, 80, 80),
       'place': (200, 192, 175), 'plein': (220, 210, 185), 'chapel': (225, 200, 160)}

async def one(out, seed, port):
    c = CDP(port)
    if not await c.boot(f'http://127.0.0.1:8765/index.html?seed=0&townseed={seed}'): print('boot failed', c.errors()[:3]); c.stop(); return
    d = json.loads(await c.ev(DUMP)); c.stop()
    S, M = 1.6, 1100  # pixels per metre, half-extent drawn
    im = Image.new('RGB', (int(2 * M * S), int(2 * M * S)), (92, 120, 70)); g = ImageDraw.Draw(im)
    import math; ca, sa = math.cos(d['ang']), math.sin(d['ang'])  # drawn as the map shows it: north up
    P = lambda u, v: ((u * ca + v * sa + M) * S, (-u * sa + v * ca + M) * S)
    g.line([P(*p) for p in d['moat'] + d['moat'][:1]], fill=(50, 90, 130), width=int(20 * S))
    g.polygon([P(*p) for p in d['wall']], fill=(118, 140, 88))
    for b in d['blocks']:
        if b['use'] in USE: g.polygon([P(*p) for p in b['p']], fill=USE[b['use']])
    for s in d['streets']:
        if s[5] == 4: continue
        g.line([P(s[0], s[1]), P(s[2], s[3])], fill=(150, 140, 120) if s[5] != 1 else (175, 165, 140), width=max(1, int(s[4] * S)))
    g.line([P(*p) for p in d['canal']], fill=(50, 90, 130), width=int(d['cw'] * S))
    for (u, v, c, s, hw, hd, kind, typ) in d['lots']:
        cs = [(u + a * hw * c + b * hd * s, v - a * hw * s + b * hd * c) for a, b in [(-1, -1), (1, -1), (1, 1), (-1, 1)]]
        g.polygon([P(*p) for p in cs], fill=KIND.get(kind, (200, 0, 200)), outline=(60, 50, 40))
    g.line([P(*p) for p in d['wall'] + d['wall'][:1]], fill=(70, 66, 60), width=int(3 * S))
    for u, v in d['bridges']: x, y = P(u, v); g.ellipse([x - 6, y - 6, x + 6, y + 6], fill=(230, 230, 230))
    for u, v in d['gates']: x, y = P(u, v); g.rectangle([x - 10, y - 10, x + 10, y + 10], fill=(20, 20, 20))
    os.makedirs(out, exist_ok=True); fn = os.path.join(out, f'plan_{seed}.png'); im.save(fn)
    areas = {}
    for b in d['blocks']:
        if b['use'] == 'lots':
            p = b['p']; a = abs(sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1] for i in range(len(p)))) / 2; areas.setdefault(b['kind'], []).append(a)
    print(seed, fn, 'lots', len(d['lots']), 'blocks', sum(1 for b in d['blocks'] if b['use'] == 'lots'), 'streets', len(d['streets']), 'nodes', d['nodes'], 'bridges', len(d['bridges']))
    for k, v in sorted(areas.items()): v.sort(); print('   ', k, 'blocks', len(v), 'median area', round(v[len(v) // 2]), 'm2')

async def main():
    out = sys.argv[1]; seeds = [int(a) for a in sys.argv[2:]] or [0]
    await asyncio.gather(*[one(out, s, 9450 + k) for k, s in enumerate(seeds)])
asyncio.run(main())
