"""Load and chunk-build timings per seed: python3 tools/bench.py 0 1 2
Reports the time to build the world at load (G.loadMs, of it the land plan LAND.ms, the tracks Wild.trackMs, the settlement plan Wild.settleMs),
then builds three 4x4 blocks of chunks out in the farmed country from cold caches and reports the mean and worst time a chunk takes.
Headless Chrome renders and runs in software here, so compare before/after on the same machine only."""
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
SEEDS = [int(a) for a in sys.argv[1:]] or [0]
JS = r"""(()=>{const g=__game,W=g.Wild,out={load:g.G.loadMs,land:g.LAND.ms,tracks:Math.round(W.trackMs||0),settle:Math.round(W.settleMs||0),blocks:[]};
 const clear=()=>{for(const k of ['farmCache','candCache','fieldCache','plotCache'])if(W[k])W[k].clear();};
 for(const [cx,cz] of [[1500,-2600],[-2600,-3800],[400,-7000]]){clear();const i0=W.ci(cx),j0=W.ci(cz),ts=[];
  for(let a=0;a<4;a++)for(let b=0;b<4;b++){const t0=performance.now(),gen=W.genChunk(i0+a,j0+b);let r;do r=gen.next();while(!r.done);ts.push(performance.now()-t0);r.value.group.traverse(o=>{if(o.geometry)o.geometry.dispose();});}
  out.blocks.push({at:[cx,cz],mean:+(ts.reduce((a,v)=>a+v,0)/ts.length).toFixed(1),max:+Math.max(...ts).toFixed(1)});}
 return JSON.stringify(out);})()"""
async def main():
    for seed in SEEDS:
        c = CDP()
        if not await c.boot(f'http://127.0.0.1:8765/index.html?seed={seed}', timeout=180): print('boot failed', c.errors()[:2]); c.stop(); continue
        print(seed, await c.ev(JS), [e[:200] for e in c.errors()[:3]]); c.stop()
asyncio.run(main())
