"""Minimal interface and fall damage checks on a touch screen: python3 tools/minimal.py"""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
OUT = os.path.join(os.path.dirname(__file__), 'out', 'touch')
async def main():
    c = CDP(); await c.boot(w=1180, h=820, timeout=150)
    await c.send('Emulation.setTouchEmulationEnabled', enabled=True, maxTouchPoints=5)
    await c.send('Input.dispatchTouchEvent', type='touchStart', touchPoints=[{'x': 600, 'y': 400, 'id': 0}]); await c.send('Input.dispatchTouchEvent', type='touchEnd', touchPoints=[])
    await c.new_game(); await c.ev("__game.Input.fallback=false"); await asyncio.sleep(1.5)
    print('defaults', await c.ev("JSON.stringify({rpg:__game.settings.showRPG,nofall:__game.settings.dbgNoFall})"))
    print('visible buttons', await c.ev("[...document.querySelectorAll('#touch [data-k]')].filter(b=>!b.hidden).map(b=>b.dataset.k).join(' ')"))
    await c.shot(f'{OUT}/minimal.png')
    await c.ev("__game.startAttack(); __game.startCast()"); await asyncio.sleep(0.2)
    print('attack/cast blocked', await c.ev("__game.G.player.swingT<0 && __game.G.player.castT<0"))
    # drop from 30 m onto the open hillside
    for nofall in (True, False):
        await c.ev(f"(()=>{{__game.settings.dbgNoFall={'true' if nofall else 'false'}; const P=__game.G.player; P.hp=P.maxHp; P.pos.y=__game.terrainH(P.pos.x,P.pos.z)+20; P.onGround=false; P.vy=0; P.safeFall=false}})()")
        await asyncio.sleep(0.3)
        for _ in range(60):
            if await c.ev("__game.G.player.onGround"): break
            await asyncio.sleep(0.5)
        print('no fall damage' if nofall else 'fall damage on', 'hp', await c.ev("__game.G.player.hp+'/'+__game.G.player.maxHp"), 'ground', await c.ev("__game.G.player.onGround"))
    await c.ev("__game.settings.dbgNoFall=true; __game.G.player.hp=__game.G.player.maxHp; __game.settings.showRPG=true"); await asyncio.sleep(0.6)
    print('full view buttons', await c.ev("[...document.querySelectorAll('#touch [data-k]')].filter(b=>!b.hidden).map(b=>b.dataset.k).join(' ')"))
    await c.shot(f'{OUT}/full.png')
    print(c.errors()[:5]); c.stop()
asyncio.run(main())
