"""Walk Halewood House on foot, from the gate down the avenue, round the house, through the gardens and up to the obelisk,
then try to step into the long water. Reports each leg, whether the place was found and its people are about:
python3 tools/hallwalk.py"""
import asyncio, json, os, sys
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
ROUTE = [(0, 482), (0, 76), (0, 60), (33, 33), (45, 33), (45, -16), (8, -16), (0, -23), (0, -33), (2, -40), (2, -62), (10, -66.5), (10, -86), (2, -86.5), (2, -92), (2, -122), (16, -128), (16, -340), (0, -350), (0, -506)]
GO = r"""(()=>{const g=__game,P=g.G.player,[x,z]=g.hallW(LX,LZ); if(TP){g.settings.dbgFly=false; g.setFlying(false); g.G.time=10*60+g.G.time-(g.G.time%1440); g.Wild.prime(x,z); P.pos.set(x,g.terrainH(x,z)+0.3,z); P.vy=0;} window.__hw=[x,z]; return 1;})()"""
STEP = r"""(()=>{const g=__game,P=g.G.player,[tx,tz]=window.__hw; P.yaw=Math.atan2(-(tx-P.pos.x),-(tz-P.pos.z)); P.pitch=0; const l=g.hallL(P.pos.x,P.pos.z); return JSON.stringify({d:+Math.hypot(tx-P.pos.x,tz-P.pos.z).toFixed(1),l:[+l[0].toFixed(1),+l[1].toFixed(1)],y:+P.pos.y.toFixed(1)});})()"""
async def main():
    c = CDP(int(os.environ.get('CDP_PORT', '9421')))
    if not await c.boot(w=360, h=220): print('boot failed', c.errors()[:2]); return  # a small window: the software renderer then keeps near real time
    await c.new_game(); await asyncio.sleep(3)
    await c.ev("__game.settings.dbgStamina=true")
    await c.ev("(()=>{const r=__game.renderer(); r.render=function(){};})()")  # nothing is drawn while walking: headless drawing is too slow to walk a kilometre
    await c.ev(GO.replace('LX', str(ROUTE[0][0])).replace('LZ', str(ROUTE[0][1])).replace('TP', '1')); await asyncio.sleep(10)
    await c.ev(GO.replace('LX', str(ROUTE[0][0])).replace('LZ', str(ROUTE[0][1])).replace('TP', '1')); await asyncio.sleep(0.5)
    await c.key('ShiftLeft', True); await c.key('KeyW', True); ok = True
    for lx, lz in ROUTE[1:]:
        await c.ev(GO.replace('LX', str(lx)).replace('LZ', str(lz)).replace('TP', '0')); last = None; best = 1e9; stuck = 0
        for _ in range(900):
            await asyncio.sleep(0.25); last = json.loads(await c.ev(STEP))
            if last['d'] < 1.6: break
            stuck = stuck + 1 if last['d'] > best - 0.05 else 0; best = min(best, last['d'])
            if stuck > 40: break
        got = last['d'] < 1.6; ok = ok and got
        print(f'to ({lx}, {lz}): {"reached" if got else "STUCK"} at local {last["l"]}, height {last["y"]}')
        if not got: break
    # the long water: walk straight at it from the walk beside it
    await c.ev(GO.replace('LX', '16').replace('LZ', '-220').replace('TP', '1')); await asyncio.sleep(1)
    await c.ev(GO.replace('LX', '-16').replace('LZ', '-220').replace('TP', '0'))
    for _ in range(40): await asyncio.sleep(0.25); last = json.loads(await c.ev(STEP))
    await c.key('KeyW', False); await c.key('ShiftLeft', False)
    dry = abs(last['l'][0]) >= 9.6
    print(f'the long water: {"refused the step" if dry else "WADED IN"} (stopped at local {last["l"]})')
    print(await c.ev("(()=>{const g=__game;return JSON.stringify({found:!!(g.G.flags.found||{}).halewood,folk:(g.Sites.folk.halewood||[]).length,track:g.SITES.find(s=>s.id==='halewood').track})})()"))
    print('walk', 'ok' if ok and dry else 'FAILED', '| errors:', [e[:200] for e in c.errors()[:3]])
    c.stop()
asyncio.run(main())
