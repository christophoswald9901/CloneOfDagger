"""Walk a land of its own (src/08_land.js) on foot, as a player would, and check its ways and its refusals: python3 tools/landwalk.py [LAND]
For Yarnbury: from the start up the hump and over the north bridge into the fort, through the fair and out at the south gate; then try to
climb the carrier's bank from inside the fort, wade into the carrier where its bank is low, and walk off the edge of the map.
Prints each leg (reached or where it stopped, the highest and lowest ground on it) and exits non-zero on a failure."""
import asyncio, json, os, sys
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
LAND = sys.argv[1] if len(sys.argv) > 1 else 'yarnbury'
# legs: [name, start (None: go on from where you are), target, what must happen ('reach' or 'stop'), extra check]
LEGS = {'yarnbury': [
    ['up the hump to the bridge', [-66, -170], [-15, -102], 'reach', 'top>34'],
    ['over the bridge', None, [-6, -84], 'reach', 'top>34'],
    ['down into the fort', None, [17, -34], 'reach', ''],
    ['through the fair', None, [37, 50], 'reach', ''],
    ['out at the south gate', None, [49, 150], 'reach', ''],
    ['up the bank from inside the fort', [-15, 60], [-58, 66], 'stop', 'top<27 and x>-50'],
    ['off the east edge of the map', [640, 0], [760, 0], 'stop', 'x<700'],
]}[LAND]
GO = r"""(()=>{const g=__game,A=g.G.area,P=g.G.player,[tx,tz]=A.toWorld(TX,TZ);window.__lw=[tx,tz];
  if(SX!==null){const [sx,sz]=A.toWorld(SX,SZ);g.settings.dbgFly=false;g.setFlying(false);P.pos.set(sx,A.heightAt(sx,sz)+0.3,sz);P.vy=0;}return 1;})()"""
STEP = r"""(()=>{const g=__game,A=g.G.area,P=g.G.player,[tx,tz]=window.__lw,[ox,oz]=A.toWorld(0,0);P.yaw=Math.atan2(-(tx-P.pos.x),-(tz-P.pos.z));P.pitch=0;
  return JSON.stringify({d:+Math.hypot(tx-P.pos.x,tz-P.pos.z).toFixed(1),x:+(P.pos.x-ox).toFixed(1),z:+(P.pos.z-oz).toFixed(1),y:+P.pos.y.toFixed(2)});})()"""
async def leg(c, start, target, limit=480):
    await c.ev(GO.replace('TX', str(target[0])).replace('TZ', str(target[1])).replace('SX!==null', 'true' if start else 'false').replace('SX', str(start[0] if start else 0)).replace('SZ', str(start[1] if start else 0)))
    best, stuck, top, lo, r = 1e9, 0, -1e9, 1e9, None
    for _ in range(limit):
        await asyncio.sleep(0.25); r = json.loads(await c.ev(STEP)); top = max(top, r['y']); lo = min(lo, r['y'])
        if r['d'] < 1.8: break
        stuck = stuck + 1 if r['d'] > best - 0.05 else 0; best = min(best, r['d'])
        if stuck > 24: break
    r['top'] = top; r['lo'] = lo; return r
async def main():
    c = CDP(int(os.environ.get('CDP_PORT', '9421')))
    if not await c.boot('http://127.0.0.1:8765/index.html', w=360, h=220, timeout=240): print('boot failed', c.errors()[:2]); sys.exit(1)
    await c.ev(f"""(()=>{{const g=__game;g.Survey.pending={json.dumps(LAND)};g.beginNewGame({{name:'T',race:'Townborn',cls:'Warrior',attr:{{STR:50,INT:50,WIL:50,AGI:50,END:50,PER:50,SPD:50,LUC:50}}}});g.UI.close(true);g.Input.fallback=true;
      g.settings.dbgStamina=true;g.settings.music=0;g.settings.sfx=0;g.G.time=Math.floor(g.G.time/1440)*1440+11*60;const r=g.renderer();r.render=function(){{}};return 1;}})()""")  # (nothing is drawn while walking)
    await asyncio.sleep(2); ok = True
    await c.key('KeyW', True)
    for name, start, target, want, extra in LEGS:
        if start: await c.key('KeyW', False); await asyncio.sleep(0.3)
        if start: await c.ev(GO.replace('TX', str(target[0])).replace('TZ', str(target[1])).replace('SX!==null', 'true').replace('SX', str(start[0])).replace('SZ', str(start[1]))); await asyncio.sleep(1.5); await c.key('KeyW', True)
        r = await leg(c, start if not start else None, target)
        reached = r['d'] < 1.8; good = reached if want == 'reach' else not reached
        if extra: good = good and eval(extra, {}, {'top': r['top'], 'lo': r['lo'], 'x': r['x'], 'z': r['z']})
        ok = ok and good
        print(f"{'ok  ' if good else 'FAIL'} {name}: {'reached' if reached else 'stopped'} at ({r['x']}, {r['z']}), ground {r['lo']}–{r['top']} m, {r['d']} m short")
    await c.key('KeyW', False)
    errs = [e for e in c.errors() if 'render failed once' not in e]
    for e in errs[:5]: print('ERR', e[:300])
    c.stop(); sys.exit(0 if ok and not errs else 1)
asyncio.run(main())
