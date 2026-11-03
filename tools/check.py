"""Boot the game headless, start a new game, report errors and stats: python3 tools/check.py"""
import asyncio, sys, os, time
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
async def main():
    c = CDP(); t0 = time.time()
    ok = await c.boot(timeout=150)
    print('boot', ok, round(time.time() - t0, 1), 's')
    if ok:
        print(await c.ev("JSON.stringify(__game.G.city.stats)"))
        await c.new_game(); await asyncio.sleep(3)
        print(await c.ev("(()=>{const P=__game.G.player;return JSON.stringify({pos:[P.pos.x|0,+P.pos.y.toFixed(1),P.pos.z|0],yaw:+P.yaw.toFixed(2),ground:+__game.terrainH(P.pos.x,P.pos.z).toFixed(1),tri:__game.renderer().info.render.triangles,calls:__game.renderer().info.render.calls})})()"))
    for l in c.errors()[:12]: print('LOG', l[:1200])
    c.stop()
asyncio.run(main())
