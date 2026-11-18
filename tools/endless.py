"""Checks of the world beyond the home country, without rendering: python3 tools/endless.py [seed ...]
REGION=x0,z0,x1,z1 (default -40000,-48000,40000,2000: the home country and two rings of countries round it; every country it touches is planned).
For each seed it reports, and exits non-zero on a failure:
 - rivers: every river's water level never rises downstream; each ends in the sea, in another river or at a gap; at every gap between two
   planned countries the river leaving one and the river entering the next meet at the same point, level and width
 - roads: at every pass between two planned countries a road starts on the border's line on both sides, of the same kind
 - ground: the height either side of every border line agrees. The step across each border line, less the roughness of the ground
   beside it, is compared with the same measure along lines through the middle of the countries (groundControl): it must not be larger
 - plan times per country, and the longest single step of a plan (a step that long is a hitch in the frame it runs in)."""
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
SEEDS = [int(a) for a in sys.argv[1:]] or [0]
REGION = os.environ.get('REGION', '-40000,-48000,40000,2000')
JS = r"""(()=>{const g=__game,W=g.World,[X0,Z0,X1,Z1]=[REGION],bad=[],fail=(k,o)=>{if(bad.length<40)bad.push([k,o]);};W.DROP=1e12;
 const t0=performance.now(),n=W.planBox(X0,Z0,X1-1,Z1-1),planMs=Math.round(performance.now()-t0);
 let rivers=0,gaps=0,passes=0,seamMax=0,seamAt=null,stepMax=0;
 for(const K of W.list){for(const R of K.land.rivers){rivers++;for(let q=1;q<R.wl.length;q++)if(R.wl[q]>R.wl[q-1]+1e-6){fail('river.uphill',{K:[K.i,K.j],at:R.P[q].map(Math.round),rise:+(R.wl[q]-R.wl[q-1]).toFixed(3)});break;}
   if(!['sea','join','gap','pond'].includes(R.end))fail('river.end',{K:[K.i,K.j],end:R.end});
   if(R.end==='sea'){const [x,z]=R.P[R.P.length-1];if(!(g.terrainBase(x,z)<2.5||g.coastZ(x)-z<80))fail('river.short',{K:[K.i,K.j],at:[Math.round(x),Math.round(z)]});}}}
 for(const f of g.EDGES.values()){const line=f.vert?-10000+f.n*10000:-18000+f.n*10000;
  if(f.gap===f.gap){const A=W.get(f.from[0],f.from[1]),B=W.get(f.to[0],f.to[1]);if(A&&B&&A.state===2&&B.state===2){gaps++;const px=f.vert?line:f.gap,pz=f.vert?f.gap:line;
    const a=A.land.rivers.find(R=>R.gout),b=B.land.rivers.find(R=>R.gin&&Math.hypot(R.P[0][0]-px,R.P[0][1]-pz)<5);
    if(!a||!b)fail('gap.missing',{at:[px,pz],out:!!a,in:!!b});else{const e=a.P[a.P.length-1],dl=Math.abs(a.wl[a.wl.length-1]-b.wl[0]),dw=Math.abs(a.w[a.w.length-1]-b.w[0]),dp=Math.hypot(e[0]-b.P[0][0],e[1]-b.P[0][1]);
     stepMax=Math.max(stepMax,dl);if(dp>1||dl>0.05||dw>0.6)fail('gap.seam',{at:[px,pz],dp:+dp.toFixed(2),dl:+dl.toFixed(3),dw:+dw.toFixed(2)});}}}
  if(f.pass===f.pass){const a=f.vert?[f.n-1,f.m]:[f.m,f.n-1],b=f.vert?[f.n,f.m]:[f.m,f.n],A=W.get(a[0],a[1]),B=W.get(b[0],b[1]);if(A&&B&&A.state===2&&B.state===2&&A!==B){passes++;
    const ta=A.ways.tracks.find(T=>T.pass===f),tb=B.ways.tracks.find(T=>T.pass===f),px=f.vert?line:f.pass,pz=f.vert?f.pass:line;
    if(!ta||!tb)fail('pass.deadend',{at:[Math.round(px),Math.round(pz)],a:!!ta,b:!!tb});else{if(Math.hypot(ta[0][0]-tb[0][0],ta[0][1]-tb[0][1])>0.5)fail('pass.apart',{at:[px,pz]});
     if(ta.cls&&tb.cls&&ta.cls[6]!==tb.cls[6])fail('pass.kind',{at:[Math.round(px),Math.round(pz)],a:ta.cls[6],b:tb.cls[6]});}}}}
 const step=(x,z,dx,dz)=>{const hs=[-3.5,-2.5,-1.5,-0.5,0.5,1.5,2.5,3.5].map(t=>g.terrainRaw(x+dx*t,z+dz*t));let mo=0;for(let q=1;q<8;q++)if(q!==4)mo=Math.max(mo,Math.abs(hs[q]-hs[q-1]));return Math.abs(hs[4]-hs[3])-1.5*mo;};
 let ctlMax=0;
 for(const K of W.list){if(K.home)continue;for(let t=0;t<=10000;t+=37){for(const [x,z,dx,dz] of [[K.x0,K.z0+t,1,0],[K.x0+t,K.z0,0,1]]){const d=step(x,z,dx,dz);if(d>seamMax){seamMax=d;seamAt=[x,z];}}
   for(const [x,z,dx,dz] of [[K.x0+3333,K.z0+t,1,0],[K.x0+t,K.z0+3333,0,1]])ctlMax=Math.max(ctlMax,step(x,z,dx,dz));}}
 if(seamMax>ctlMax+1)fail('ground.seam',{at:seamAt,step:+seamMax.toFixed(2),control:+ctlMax.toFixed(2)});
 const cs=W.ready.map(K=>Math.round(K.cpu));
 return JSON.stringify({countries:W.list.length,planned:n,planMs,cpu:{mean:Math.round(cs.reduce((a,v)=>a+v,0)/Math.max(1,cs.length)),max:Math.max(0,...cs)},worstStep:Math.round(W.worstStep||0),rivers,gaps,passes,groundSeam:+seamMax.toFixed(2),groundControl:+ctlMax.toFixed(2),places:g.Settle.list.length,failures:bad.length,bad});})()"""
async def main():
    rc = 0
    for seed in SEEDS:
        c = CDP()
        if not await c.boot(f'http://127.0.0.1:8765/index.html?seed={seed}', timeout=240): print('boot failed', c.errors()[:2]); c.stop(); rc = 1; continue
        r = await c.ev(JS.replace('[REGION]', '[' + REGION + ']'))
        try: o = json.loads(r)
        except Exception: print(seed, 'failed:', str(r)[:600]); c.stop(); rc = 1; continue
        bad = o.pop('bad'); print(seed, o); [print('  FAIL', k, v) for k, v in bad]; rc |= bool(bad)
        for e in [e for e in c.errors() if 'render failed once' not in e][:4]: print('  LOG', e[:300])
        c.stop()
    sys.exit(rc)
asyncio.run(main())
