"""A long journey out of the home country and through the countries beyond, at fast-travel speed: python3 tools/farwalk.py [seed]
SPEED (m/s, default 156: fast travel at x40), FPS (default 30: each frame moves the player SPEED/FPS metres, however slowly headless
Chrome draws, so the game gets the frames per kilometre it would get on a device drawing that fast), ROUTE ("x,z;x,z;..." of waypoints; default leaves by the west pass, goes round the home
country to the north and comes back down its east side, some 110 km), SHOTS=dir to save a picture at each waypoint.
By default nothing is drawn (headless Chrome draws in software, a frame or two a second, which would make the journey take hours): the
game's own work each frame is the same. DRAW=1 draws every frame as in play.
The player is flown 2 m above the ground along the route while the game runs normally, slowing down as fast travel does while the ground
ahead is not built or its country not planned (PACED=0: at full speed regardless); metresPerFrame is what it achieved (5.2 = never slowed). Reports per leg and in total: the time the wild's
update takes each frame (mean, 95th percentile, worst), the longest step of a country's plan, how often the ground under the player had
not been built yet, countries planned and forgotten, JS heap at the start and the end, and any errors."""
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
SEED = int(sys.argv[1]) if len(sys.argv) > 1 else 0
SPEED = float(os.environ.get('SPEED', '156')); FPS = float(os.environ.get('FPS', '30')); SHOTS = os.environ.get('SHOTS')
ROUTE = os.environ.get('ROUTE')
SETUP = r"""(()=>{const g=__game,P=g.G.player,W=g.Wild,Wo=g.World;g.settings.dbgFly=true;g.setFlying(true);
 const pz=g.edgeFeat(1,0,1).pass, route=ROUTE||[[-600,-300],[-8000,pz],[-10000,pz],[-16000,pz],[-25000,-6000],[-25000,-24000],[-12000,-33000],[5000,-33000],[16000,-26000],[16000,-9000],[10000,g.edgeFeat(1,2,1).pass],[2000,-2000]];
 const S=window.__walk={route,dist:0,leg:0,done:false,ups:[],miss:0,n:0,legs:[],dropped:0,t0:performance.now(),heap0:performance.memory?performance.memory.usedJSHeapSize:0};
 Wo.onDrop=()=>S.dropped++; Wo.worstStep=0; Wo.worst={}; if(!DRAW){const R=g.renderer();R.render=()=>{};}
 const up=W.update.bind(W); W.update=(cp,yaw)=>{const t=performance.now();up(cp,yaw);S.ups.push(performance.now()-t);};
 P.pos.set(route[0][0],g.terrainH(route[0][0],route[0][1])+2,route[0][1]); let last=performance.now();
 const tick=()=>{if(S.done)return;const dt=1/FPS;W.fast=true;let k=1;if(PACED){const w=W.wanted(P.pos.x,P.pos.z);if(w.length){const d0=w[0].d;if(d0<100)k=Math.min(k,3/40);else if(d0<200)k=0.5;}const m=Wo.missing(P.pos.x,P.pos.z,1600);if(m.length)k=Math.min(k,m[0].d<500?2/40:0.4);}
  const [tx,tz]=route[S.leg+1],dx=tx-P.pos.x,dz=tz-P.pos.z,d=Math.hypot(dx,dz),st=SPEED*dt*k;S.dist+=Math.min(d,st);
  if(d<=st){P.pos.x=tx;P.pos.z=tz;S.legs.push({to:[tx,tz],frames:S.ups.length,ready:Wo.ready.length});S.leg++;if(S.leg>=route.length-1){S.done=true;return;}}else{P.pos.x+=dx/d*st;P.pos.z+=dz/d*st;P.yaw=Math.atan2(-dx,-dz);}
  P.pos.y=g.terrainH(P.pos.x,P.pos.z)+2;P.pitch=-0.1;S.n++;if(!W.inCity(W.ci(P.pos.x),W.ci(P.pos.z))&&!W.chunks.has(W.key(W.ci(P.pos.x),W.ci(P.pos.z))))S.miss++;
  requestAnimationFrame(tick);};requestAnimationFrame(tick);return route.length;})()"""
REPORT = r"""(()=>{const S=window.__walk,g=__game,u=S.ups.slice().sort((a,b)=>a-b),q=p=>+u[Math.min(u.length-1,Math.floor(u.length*p))].toFixed(1);
 return JSON.stringify({done:S.done,leg:S.leg,metresPerFrame:+(S.dist/Math.max(1,S.n)).toFixed(2),secs:Math.round((performance.now()-S.t0)/1000),frames:u.length,update:{mean:+(u.reduce((a,v)=>a+v,0)/u.length).toFixed(1),p95:q(0.95),p99:q(0.99),worst:q(1)},planStepWorst:g.World.worst,groundMissing:+(S.miss/Math.max(1,S.n)).toFixed(3),
  countries:{ready:g.World.ready.length,planned:g.World.planMs.length,dropped:S.dropped,cpuMean:Math.round(g.World.planMs.reduce((a,v)=>a+v,0)/Math.max(1,g.World.planMs.length))},chunks:g.Wild.chunks.size,tracks:g.Wild.tracks.length,
  heapMB:[Math.round(S.heap0/1e6),performance.memory?Math.round(performance.memory.usedJSHeapSize/1e6):0],pos:[Math.round(g.G.player.pos.x),Math.round(g.G.player.pos.z)],legs:S.legs});})()"""
async def main():
    c = CDP()
    if not await c.boot(f'http://127.0.0.1:8765/index.html?seed={SEED}', w=int(os.environ.get('W', '480')), h=int(os.environ.get('H', '270')), timeout=240): print('boot failed', c.errors()[:2]); c.stop(); sys.exit(1)
    await c.new_game(); await asyncio.sleep(2)
    await c.ev("document.getElementById('msgs').style.display='none'"); await c.send('HeapProfiler.collectGarbage')  # (heap figures are taken after a collection)
    n = await c.ev(SETUP.replace('SPEED', str(SPEED)).replace('FPS', str(FPS)).replace('PACED', '0' if os.environ.get('PACED') == '0' else '1').replace('DRAW', '1' if os.environ.get('DRAW') == '1' else '0').replace('ROUTE||', (json.dumps([[float(v) for v in p.split(',')] for p in ROUTE.split(';')]) + '||') if ROUTE else ''))
    print('waypoints', n); leg = 0
    for t in range(3000):
        await asyncio.sleep(3); r = json.loads(await c.ev(REPORT))
        if r['leg'] != leg: await c.send('HeapProfiler.collectGarbage'); r = json.loads(await c.ev(REPORT))  # (the heap at each waypoint is taken after a collection)
        if t % 20 == 19: print('  ..', r['pos'], 'frames', r['frames'], 'm/frame', r['metresPerFrame'], 'chunks', r['chunks'], 'ready', r['countries']['ready'], flush=True)
        if r['leg'] != leg:
            leg = r['leg']; print('leg', leg, r['pos'], 'm/frame', r['metresPerFrame'], 'update', r['update'], 'missing', r['groundMissing'], 'heap', r['heapMB'], 'ready', r['countries']['ready'], flush=True)
            if SHOTS and os.environ.get('DRAW') == '1': os.makedirs(SHOTS, exist_ok=True); await c.shot(f'{SHOTS}/s{SEED}_leg{leg}.png')
        if r['done']: break
    await c.send('HeapProfiler.collectGarbage'); r = json.loads(await c.ev(REPORT))
    r.pop('legs'); print(SEED, json.dumps(r))
    errs = [e for e in c.errors() if 'render failed once' not in e]
    for e in errs[:8]: print('  LOG', e[:400])
    c.stop(); sys.exit(1 if errs or not r['done'] else 0)
asyncio.run(main())
