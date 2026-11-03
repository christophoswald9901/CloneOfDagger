"""Every menu can be left: Back/Resume on screen, a tap outside closes it. python3 tools/menus.py"""
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
OUT = os.path.join(os.path.dirname(__file__), 'out', 'touch')
async def tap(c, x, y):
    await c.send('Input.dispatchTouchEvent', type='touchStart', touchPoints=[{'x': x, 'y': y, 'id': 7}]); await c.send('Input.dispatchTouchEvent', type='touchEnd', touchPoints=[]); await asyncio.sleep(0.4)
async def main():
    c = CDP(); W, H = 1180, 633
    await c.boot(w=W, h=H, timeout=150)
    await c.send('Emulation.setTouchEmulationEnabled', enabled=True, maxTouchPoints=5)
    state = lambda: c.ev("JSON.stringify({state:__game.G.state, panel:__game.UI.cur&&__game.UI.cur.name, title:!document.getElementById('title').hidden, touch:__game.Touch.shown})")
    onscreen = lambda sel: c.ev(f"(()=>{{const b=document.querySelector('{sel}');if(!b)return 'missing';const r=b.getBoundingClientRect();return r.bottom<=innerHeight&&r.top>=0}})()")
    center = lambda sel: c.ev(f"(()=>{{const r=document.querySelector('{sel}').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}})()")
    # title → settings → tap outside → title
    x, y = await center('#title [data-t=settings]'); await tap(c, x, y)
    print('title settings: back on screen', await onscreen('#panel [data-a=back]'), await state())
    await tap(c, 60, 300); print('  after outside tap', await state())
    # title → new game goes straight into the world
    x, y = await center('#title [data-t=new]'); await tap(c, x, y); await asyncio.sleep(1)
    print('new game', await state(), 'name', await c.ev("__game.G.player.name"))
    # pause → settings: buttons reachable, Resume resumes
    x, y = await center('#touch [data-k=Escape]'); await tap(c, x, y)
    x, y = await center('#panel [data-a=settings]'); await tap(c, x, y)
    print('play settings: back', await onscreen('#panel [data-a=back]'), 'resume', await onscreen('#panel [data-a=resume]'), await state())
    await c.shot(f'{OUT}/settings.png')
    x, y = await center('#panel [data-a=resume]'); await tap(c, x, y); print('  after Resume', await state())
    # pause → controls → tap outside resumes
    x, y = await center('#touch [data-k=Escape]'); await tap(c, x, y)
    x, y = await center('#panel [data-a=controls]'); await tap(c, x, y)
    print('controls: back', await onscreen('#panel [data-a=back]'), await state()); await tap(c, 40, 300); print('  after outside tap', await state())
    # pause, journal, rest, map by tapping outside
    for k in ['Escape', 'KeyJ', 'KeyR', 'KeyT']:
        x, y = await center(f'#touch [data-k={k}]'); await tap(c, x, y); s1 = await state(); await tap(c, 40, 300); print(k, json.loads(s1)['panel'], '→', await state())
    # a dialogue with an NPC
    await c.ev("(()=>{const n=__game.G.area.entities.find(e=>e.kind==='npc'&&!e.dead); __game.UI.openDialog(n)})()"); await asyncio.sleep(0.3)
    s1 = await state(); await tap(c, 40, 300); print('dialog', json.loads(s1)['panel'], '→', await state())
    # portrait
    await c.send('Emulation.setDeviceMetricsOverride', width=820, height=1100, deviceScaleFactor=1, mobile=True); await asyncio.sleep(0.5)
    x, y = await center('#touch [data-k=Escape]'); await tap(c, x, y); x, y = await center('#panel [data-a=settings]'); await tap(c, x, y)
    print('portrait settings: back', await onscreen('#panel [data-a=back]')); await tap(c, 30, 1050); print('  after outside tap', await state())
    for l in c.errors()[:8]: print('LOG', l[:500])
    c.stop()
asyncio.run(main())
