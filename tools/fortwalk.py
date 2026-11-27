"""Walk Fort Merrow: up the road, over the ravelin's bridge, through the ravelin, over the moat and through the gate to the parade, then
up onto the rampart of the north-west bastion; try the palisade, the moat from the covered way, the parapet of the sea bastion;
then come to the fort by fast travel along the road and on through its gate. python3 tools/fortwalk.py [seed]"""
import asyncio, json, os, sys
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
SEED = sys.argv[1] if len(sys.argv) > 1 else '0'
# the walk, in the fort's own frame (u east, v south from the middle of the parade); FT.* names are looked up in the page
ROUTE = ['R0+', 'R0', 'B1o', 'F1', 'F2', 'G1', 'G2', [0, -73], [0, -46], [0, -12], [-24, -36], [-44, -60]]
PT = r"""((k)=>{const g=__game,F=g.FT,O={R0:F.R0,'R0+':[F.R0[0]+8,F.R0[1]-30],B1o:F.B1o,F1:F.F1,F2:F.F2,G1:[0,F.Gm[1]-6],G2:[0,F.Gm[1]+1.5]}; const p=Array.isArray(k)?k:O[k]; return [g.FORT.x+p[0],g.FORT.z+p[1]];})"""
GO = r"""(()=>{const g=__game,P=g.G.player,[x,z]=(PT)(KEY); if(TP){g.settings.dbgFly=false; g.setFlying(false); g.G.time=10*60+g.G.time-(g.G.time%1440); g.Wild.prime(x,z); P.pos.set(x,g.terrainH(x,z)+0.3,z); P.vy=0;} window.__fw=[x,z]; return 1;})()"""
STEP = r"""(()=>{const g=__game,P=g.G.player,[tx,tz]=window.__fw; P.yaw=Math.atan2(-(tx-P.pos.x),-(tz-P.pos.z)); P.pitch=0;
  return JSON.stringify({d:+Math.hypot(tx-P.pos.x,tz-P.pos.z).toFixed(1),u:+(P.pos.x-g.FORT.x).toFixed(1),v:+(P.pos.z-g.FORT.z).toFixed(1),y:+P.pos.y.toFixed(2)});})()"""
async def walk(c, key, tp=False, limit=600, near=1.6):
    await c.ev(GO.replace('PT', PT).replace('KEY', json.dumps(key)).replace('TP', '1' if tp else '0')); best, stuck, r = 1e9, 0, None; lo = 1e9
    for _ in range(limit):
        await asyncio.sleep(0.25); r = json.loads(await c.ev(STEP)); lo = min(lo, r['y'])
        if r['d'] < near: break
        stuck = stuck + 1 if r['d'] > best - 0.05 else 0; best = min(best, r['d'])
        if stuck > 30: break
    r['lo'] = lo; return r
async def main():
    c = CDP(int(os.environ.get('CDP_PORT', '9421')))
    if not await c.boot(f'http://127.0.0.1:8765/index.html?seed={SEED}', w=360, h=220, timeout=240): print('boot failed', c.errors()[:2]); return
    await c.new_game(); await asyncio.sleep(3)
    await c.ev("__game.settings.dbgStamina=true; __game.settings.music=0; __game.settings.sfx=0")
    await c.ev("(()=>{const r=__game.renderer(); r.render=function(){};})()")  # nothing is drawn while walking
    ok = True
    await walk(c, ROUTE[0], True, 1); await asyncio.sleep(8); await walk(c, ROUTE[0], True, 1); await asyncio.sleep(0.5)
    await c.key('ShiftLeft', True); await c.key('KeyW', True)
    # 1. the way in, leg by leg; nowhere on it should the walker drop below the bridges' decks (3.3 m)
    for k in ROUTE[1:]:
        r = await walk(c, k); got = r['d'] < 1.6; ok = ok and got and r['lo'] > 2.5
        print(f'to {k}: {"reached" if got else "STUCK"} at ({r["u"]}, {r["v"]}), height {r["y"]}, lowest on the leg {r["lo"]}')
        if not got: break
    found = await c.ev("!!(__game.G.flags.found||{}).fort"); print('found:', found); ok = ok and found == True
    top = r['y']; print(f'on the north-west bastion: height {top} (the rampart walk is at 9.6)'); ok = ok and abs(top - 9.6) < 0.6
    # 2. from the glacis east of the fort: the palisade should stop the walker; from the covered way: the water's edge should refuse the step
    await c.key('KeyW', False); await walk(c, [160, -60], True, 1); await asyncio.sleep(2); await c.key('KeyW', True)
    r = await walk(c, [60, -40], False, 160); thru = r['u'] < 108
    print(f'the palisade: {"WALKED THROUGH" if thru else "held"} (stopped at ({r["u"]}, {r["v"]}), height {r["y"]})'); ok = ok and not thru
    await c.key('KeyW', False); await walk(c, [103.5, -48], True, 1); await asyncio.sleep(2); await c.key('KeyW', True)
    r = await walk(c, [60, -40], False, 160); wet = r['y'] < -0.5
    print(f'the moat: {"WADED IN" if wet else "refused the step"} (stopped at ({r["u"]}, {r["v"]}), height {r["y"]})'); ok = ok and not wet
    # 3. over the parapet of the sea bastion, walking south from the flag
    await c.key('KeyW', False); await walk(c, [0, 96], True, 1); await asyncio.sleep(2); await c.key('KeyW', True)
    r = await walk(c, [0, 160], False, 120); over = r['v'] > 126.5 or r['y'] > 11.5
    print(f'the parapet: {"WENT OVER" if over else "held"} (stopped at v {r["v"]}, height {r["y"]})'); ok = ok and not over
    await c.key('KeyW', False); await c.key('ShiftLeft', False)
    # 4. by fast travel along the road from 900 m out to the fort, then on through the gate
    J = r"""(()=>{const g=__game,P=g.G.player,S=g.SITES.find(s=>s.id==='fort'),a=S.road[S.road.length-1],b=S.lane[S.lane.length-1];
      g.Wild.prime(a[0],a[1]); P.pos.set(a[0],g.terrainH(a[0],a[1])+0.3,a[1]); window.__ft={b,lo:99};
      const ok=g.Travel.toward(b[0],b[1],'the fort',true); const r=g.Travel.cur; return JSON.stringify({ok,pts:r?r.pts.length:0,len:r?Math.round(r.cum[r.cum.length-1]):0});})()"""
    print('journey:', await c.ev(J))
    W = r"""(()=>{const g=__game,P=g.G.player,w=window.__ft,u=P.pos.x-g.FORT.x,v=P.pos.z-g.FORT.z; if(Math.hypot(u,v)<175) w.lo=Math.min(w.lo,P.pos.y);
      if(!g.Travel.cur&&g.Travel.paused&&(w.res||0)<4){w.res=(w.res||0)+1; g.Travel.resume();}
      return JSON.stringify({going:!!g.Travel.cur,paused:!!g.Travel.paused,left:Math.round(Math.hypot(P.pos.x-w.b[0],P.pos.z-w.b[1])),lo:+w.lo.toFixed(2),msg:[...document.querySelectorAll('#msgs div')].slice(-1).map(e=>e.textContent)[0]||''});})()"""
    for _ in range(400):
        await asyncio.sleep(0.5); r = json.loads(await c.ev(W))
        if not r['going'] and (not r['paused'] or r['left'] < 30): break
    print(f'journey: {"arrived on the parade" if r["left"] < 30 else "ENDED " + str(r["left"]) + " m short"}, lowest within the fort {r["lo"]}, last message: {r["msg"][:120]}')
    ok = ok and r['left'] < 30 and r['lo'] > 2.5
    print('fortwalk', 'ok' if ok else 'FAILED', '| errors:', [e[:200] for e in c.errors() if 'render failed once' not in e][:3])
    c.stop()
asyncio.run(main())
