"""Walk across a canal bridge in the shipped Corrinvale and report whether the player made it, and how high the deck rose:
python3 tools/bridgewalk.py [N]  (N bridges to try, default 4)"""
import asyncio, json, os, sys
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP

SETUP = r"""(()=>{const g=__game,G=g.G,T=g.TOWNS[0],B=T.bridges[K]; if(!B) return 'none'; const P=G.player, L=B.hl+8, [x,z]=T.w(B.u-B.du*L,B.v-B.dv*L), [tx,tz]=T.w(B.u+B.du*L,B.v+B.dv*L);
 g.settings.dbgFly=false; g.setFlying(false); g.Wild.prime(x,z); P.pos.set(x,g.terrainH(x,z)+0.5,z); P.vy=0; P.yaw=Math.atan2(-(tx-x),-(tz-z)); P.pitch=0; window.__bw={x,z,tx,tz,maxY:-1e9}; return JSON.stringify({x,z,tx,tz});})()"""
TRACK = r"""(()=>{const P=__game.G.player,b=window.__bw; b.maxY=Math.max(b.maxY,P.pos.y); const d=Math.hypot(P.pos.x-b.tx,P.pos.z-b.tz), d0=Math.hypot(b.tx-b.x,b.tz-b.z); return JSON.stringify({left:+d.toFixed(1),total:+d0.toFixed(1),y:+P.pos.y.toFixed(2),maxY:+b.maxY.toFixed(2)});})()"""

async def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 4
    c = CDP(9420)
    if not await c.boot(): print('boot failed', c.errors()[:2]); return
    await c.new_game(); await asyncio.sleep(3)
    ok = 0
    for k in range(n):
        r = await c.ev(SETUP.replace('K', str(k)))
        if r == 'none': break
        await asyncio.sleep(10)  # the chunks build
        await c.ev(SETUP.replace('K', str(k)))
        await asyncio.sleep(0.5)
        await c.key('KeyW', True)
        last = None
        for _ in range(90):
            await asyncio.sleep(0.5); last = json.loads(await c.ev(TRACK))
            if last['left'] < 3: break
        await c.key('KeyW', False)
        crossed = last['left'] < 6
        ok += crossed
        print(f'bridge {k}: crossed={crossed} left={last["left"]} of {last["total"]} m, deck top {last["maxY"]} (ground 96)')
    print('crossed', ok, 'of', k + 1, '| errors:', [e[:200] for e in c.errors()[:3]])
    c.stop()
asyncio.run(main())
