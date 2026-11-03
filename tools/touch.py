"""Drive the touch controls headless on an iPad-sized screen: python3 tools/touch.py"""
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
OUT = os.path.join(os.path.dirname(__file__), 'out', 'touch')
async def touch(c, typ, pts):
    await c.send('Input.dispatchTouchEvent', type=typ, touchPoints=[{'x': x, 'y': y, 'id': i} for i, x, y in pts])
async def main():
    c = CDP(); W, H = 1180, 820
    ok = await c.boot(w=W, h=H, timeout=150); print('boot', ok)
    await c.send('Emulation.setDeviceMetricsOverride', width=W, height=H, deviceScaleFactor=1, mobile=True)
    await c.send('Emulation.setTouchEmulationEnabled', enabled=True, maxTouchPoints=5)
    await touch(c, 'touchStart', [(0, 600, 400)]); await touch(c, 'touchEnd', [])  # first touch on the title turns touch mode on
    print('touch on', await c.ev("__game.Input.touch"))
    await c.new_game(); await c.ev("__game.Input.fallback=false"); await asyncio.sleep(2)
    st = lambda: c.ev("(()=>{const P=__game.G.player;return JSON.stringify({x:+P.pos.x.toFixed(2),z:+P.pos.z.toFixed(2),yaw:+P.yaw.toFixed(3),pitch:+P.pitch.toFixed(3),frozen:__game.G.paused,shown:__game.Touch.shown,stick:__game.Input.stick,resume:!document.getElementById('resume').hidden})})()")
    print('start', await st()); await c.shot(f'{OUT}/play.png')
    # walk: thumb down on the left, push up
    await touch(c, 'touchStart', [(0, 200, 600)]); await touch(c, 'touchMove', [(0, 200, 560)]); await touch(c, 'touchMove', [(0, 200, 520)])
    await asyncio.sleep(0.1); await c.shot(f'{OUT}/stick.png'); print('stick held', await st())
    await asyncio.sleep(1.5); print('walked', await st())
    # second finger looks while walking
    await touch(c, 'touchMove', [(0, 200, 520), (1, 800, 400)]) if False else None
    await touch(c, 'touchStart', [(0, 200, 520), (1, 800, 400)])
    for k in range(1, 6): await touch(c, 'touchMove', [(0, 200, 520), (1, 800 + k * 30, 400 + k * 6)]); await asyncio.sleep(0.03)
    await asyncio.sleep(0.1); print('looked', await st())
    await touch(c, 'touchEnd', [(0, 200, 520)]); await touch(c, 'touchEnd', [])
    await asyncio.sleep(0.2); print('released', await st())
    # buttons: find their centres
    rect = lambda k: c.ev(f"(()=>{{const r=document.querySelector('#touch [data-k=\"{k}\"]').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2,r.width]}})()")
    for k in ['attack', 'use', 'cast', 'Space', 'KeyZ', 'KeyH', 'KeyM', 'Escape']: print(k, await rect(k))
    a = await rect('attack'); await touch(c, 'touchStart', [(2, a[0], a[1])]); await touch(c, 'touchEnd', [])
    await asyncio.sleep(0.3); print('after attack: sheathed', await c.ev("__game.G.player.sheathed"))
    await touch(c, 'touchStart', [(2, a[0], a[1])]); await touch(c, 'touchEnd', []); await asyncio.sleep(0.1)
    print('swinging', await c.ev("__game.G.player.swingT"))
    j = await rect('Space'); y0 = await c.ev("__game.G.player.pos.y")
    await touch(c, 'touchStart', [(3, j[0], j[1])]); await asyncio.sleep(0.15); y1 = await c.ev("__game.G.player.pos.y"); await touch(c, 'touchEnd', [])
    print('jump dy', round(y1 - y0, 2))
    m = await rect('KeyM'); await touch(c, 'touchStart', [(4, m[0], m[1])]); await touch(c, 'touchEnd', []); await asyncio.sleep(0.4)
    print('map open', await c.ev("__game.G.mapOpen"), 'layer shown', await c.ev("__game.Touch.shown")); await c.shot(f'{OUT}/map.png')
    await c.ev("document.getElementById('mapclose').click()"); await asyncio.sleep(0.4)
    e = await rect('Escape'); await touch(c, 'touchStart', [(5, e[0], e[1])]); await touch(c, 'touchEnd', []); await asyncio.sleep(0.4)
    print('pause open', await c.ev("__game.UI.cur && __game.UI.cur.name")); await c.shot(f'{OUT}/pause.png')
    await c.ev("document.querySelector('#panel [data-a=close]').click()"); await asyncio.sleep(0.4)
    print('after resume', await st())
    await c.ev("__game.settings.dbgFly=true; __game.G.player.spells=['fireball','heal']"); await asyncio.sleep(0.4); await c.shot(f'{OUT}/flybuttons.png')
    for l in c.errors()[:12]: print('LOG', l[:600])
    c.stop()
asyncio.run(main())
