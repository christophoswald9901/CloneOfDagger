"""Capture the opening vista (and a few side views) into an output folder: python3 tools/vista.py OUTDIR"""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
async def main():
    c = CDP()
    if not await c.boot(): print('boot failed', c.errors()); c.stop(); return
    await c.new_game(); await asyncio.sleep(4)
    await c.shot(f'{OUT}/vista.png')
    await c.ev("const P=__game.G.player; window._y0=P.yaw; P.yaw+=0.75"); await asyncio.sleep(1.5); await c.shot(f'{OUT}/vista_left.png')
    await c.ev("__game.G.player.yaw=window._y0-0.75"); await asyncio.sleep(1.5); await c.shot(f'{OUT}/vista_right.png')
    await c.ev("__game.G.player.yaw=window._y0"); await asyncio.sleep(0.5)
    print(await c.ev("(()=>{const r=__game.renderer().info.render,P=__game.G.player;return JSON.stringify({tri:r.triangles,calls:r.calls,pos:[P.pos.x|0,P.pos.y|0,P.pos.z|0],time:__game.G.time})})()"))
    print('errors:', c.errors()[:5]); c.stop()
asyncio.run(main())
