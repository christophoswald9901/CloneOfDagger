"""Fast travel by touch on an iPad-sized screen: Travel button -> panel -> walk on -> tap the banner to stop; Map -> tap a place -> travel by road.
python3 tools/touchtravel.py  (shots in tools/out/touch/)"""
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
OUT = os.path.join(os.path.dirname(__file__), 'out', 'touch')
async def touch(c, typ, pts): await c.send('Input.dispatchTouchEvent', type=typ, touchPoints=[{'x': x, 'y': y, 'id': i} for i, x, y in pts])
async def tap(c, x, y): await touch(c, 'touchStart', [(0, x, y)]); await asyncio.sleep(0.05); await touch(c, 'touchEnd', []); await asyncio.sleep(0.3)
async def tapSel(c, sel):
    r = json.loads(await c.ev(f"(()=>{{const e=document.querySelector({json.dumps(sel)}); if(!e) return 'null'; const b=e.getBoundingClientRect(); return JSON.stringify([b.x+b.width/2,b.y+b.height/2]);}})()") or 'null')
    if not r: print('  missing', sel); return False
    await tap(c, *r); return True
async def main():
    os.makedirs(OUT, exist_ok=True); c = CDP(); W, H = 1180, 820
    print('boot', await c.boot(w=W, h=H, timeout=150))
    await c.send('Emulation.setDeviceMetricsOverride', width=W, height=H, deviceScaleFactor=1, mobile=True)
    await c.send('Emulation.setTouchEmulationEnabled', enabled=True, maxTouchPoints=5)
    await tap(c, 600, 400); await c.new_game(); await c.ev("__game.Input.fallback=false"); await asyncio.sleep(2)
    await c.ev("(()=>{const g=__game; g.setArea(g.G.city,-500,-700,0.7); g.G.flags.heard={greywatch:true};})()"); await asyncio.sleep(1)
    st = lambda: c.ev("(()=>{const g=__game,P=g.G.player;return JSON.stringify({pos:[P.pos.x|0,P.pos.z|0],travel:!!g.Travel.cur,ui:g.UI.cur&&g.UI.cur.name,map:!!g.G.mapOpen,banner:!document.getElementById('travelinfo').hidden,pitch:+P.pitch.toFixed(2),lookT:+g.Travel.lookT.toFixed(2),md:[g.Input.mdx,g.Input.mdy],dest:!document.getElementById('mapdest').hidden})})()")
    print('tap Travel:', await tapSel(c, '#touch [data-k="KeyT"]'), await st()); await c.shot(f'{OUT}/travel_panel.png')
    print('walk on:', await tapSel(c, '#panel [data-a="ahead"]'), await st()); await asyncio.sleep(3); await c.shot(f'{OUT}/travel_banner.png'); print('  after 3 s', await st())
    print('tap banner:', await tapSel(c, '#travelinfo'), await st())
    print('tap Map:', await tapSel(c, '#touch [data-k="KeyM"]'), await st())
    await tap(c, W * 0.42, H * 0.38); await c.shot(f'{OUT}/map_pick.png'); print('tap a place', await st())
    print('by road:', await tapSel(c, '#mapdest [data-m="road"]'), await st()); await asyncio.sleep(3); print('  after 3 s', await st())
    print('stick stops it:'); await touch(c, 'touchStart', [(0, 200, 600)]); await touch(c, 'touchMove', [(0, 200, 540)]); await asyncio.sleep(0.4); await touch(c, 'touchEnd', []); print('  ', await st())
    for e in c.errors()[:5]: print('ERR', e[:300])
    c.stop()
asyncio.run(main())
