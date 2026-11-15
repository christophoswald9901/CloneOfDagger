"""A fingerprint of the home country's plan per seed, to prove a change left it as it was: python3 tools/digest.py OUT.json 0 1 2
Hashes the rivers, tracks, bridges, villages, farmsteads, field blocks and places, and samples the ground and the lie of the land
well inside the home mountains (|x| <= 7 km, z >= -15 km). Compare two files with: python3 tools/digest.py --diff A.json B.json"""
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
JS = r"""(()=>{const g=__game,W=g.Wild,S=g.Settle,L=g.LAND;
 const H=()=>{let h=2166136261;return {n:v=>{h^=Math.round(v*100)|0;h=Math.imul(h,16777619);},s:t=>{for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777619);}},get v(){return (h>>>0).toString(16);}};};
 const out={};
 const rivers=(g.homeRivers?g.homeRivers():L.rivers), tracks=(g.homeTracks?g.homeTracks():W.tracks);
 {const h=H();for(const R of rivers){for(const p of R.P){h.n(p[0]);h.n(p[1]);}for(const v of R.w)h.n(v);for(const v of R.wl)h.n(v);}out.rivers=[rivers.length,h.v];}
 {const h=H(),h2=H();let n=0,nl=0;for(const T of tracks){if(T.pass)continue;const hh=T.lane?h2:h;T.lane?nl++:n++;for(const p of T){hh.n(p[0]);hh.n(p[1]);}}out.tracks=[n,h.v];out.lanes=[nl,h2.v];}
 {const B=(g.homeBridges?g.homeBridges():W.bridges).filter(b=>!b.pass),h=H();for(const b of B){h.n(b.x);h.n(b.z);h.n(b.deck);}out.bridges=[B.length,h.v];}
 {const li=(g.homeSettle?g.homeSettle():S);const h=H();for(const v of li.list){h.s(v.name);h.n(v.x);h.n(v.z);h.n((v.houses||[]).length);}out.places=[li.list.length,h.v];out.placeList=li.list.map(v=>v.kind[0]+':'+v.name+'@'+Math.round(v.x)+','+Math.round(v.z));
  const hf=H();for(const f of li.farms){hf.n(f.x);hf.n(f.z);hf.n(f.ang);}out.farms=[li.farms.length,hf.v];
  const hb=H();for(const o of li.blocks){hb.n(o.x);hb.n(o.z);hb.n(o.ang);hb.n(o.n);}out.blocks=[li.blocks.length,hb.v];}
 {const P=(g.homePOI?g.homePOI():g.POI.list),h=H();for(const p of P){h.s(p.kind);h.n(p.x);h.n(p.z);}out.poi=[P.length,h.v];}
 {const h=H(),hl=H();let n=0;for(let x=-7000;x<=7000;x+=200)for(let z=-15000;z<=1800;z+=200){n++;h.n(g.terrainRaw(x,z));const a=g.landAt(x,z);hl.n(a.sl*100);hl.n(a.tpi);hl.n(a.wet*100);}out.ground=[n,h.v];out.landform=[n,hl.v];}
 return JSON.stringify(out);})()"""
def diff(a, b):
    A, B = json.load(open(a)), json.load(open(b)); bad = 0
    for seed in A:
        if seed not in B: print(seed, 'missing'); bad += 1; continue
        for k in A[seed]:
            if k == 'placeList': continue
            same = A[seed][k] == B[seed].get(k); bad += not same
            print(f'seed {seed} {k:9s}', 'same' if same else f'DIFFERENT {A[seed][k]} -> {B[seed].get(k)}')
        pa, pb = set(A[seed]['placeList']), set(B[seed].get('placeList', []))
        if pa != pb: print('  places gone:', sorted(pa - pb)[:8], 'new:', sorted(pb - pa)[:8])
    sys.exit(1 if bad else 0)
async def main():
    from cdp import CDP
    out = {}
    for seed in [int(a) for a in sys.argv[2:]] or [0]:
        c = CDP()
        if not await c.boot(f'http://127.0.0.1:8765/index.html?seed={seed}', timeout=240): print('boot failed', c.errors()[:2]); c.stop(); continue
        r = await c.ev(JS)
        if not r or r.startswith('ERR'): print(seed, r); c.stop(); continue
        out[str(seed)] = json.loads(r); print(seed, {k: v for k, v in out[str(seed)].items() if k != 'placeList'}, [e[:200] for e in c.errors()[:3]]); c.stop()
    json.dump(out, open(sys.argv[1], 'w'))
if len(sys.argv) > 1 and sys.argv[1] == '--diff': diff(sys.argv[2], sys.argv[3])
else: asyncio.run(main())
