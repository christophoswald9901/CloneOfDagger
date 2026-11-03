"""Capture the castle from the opening vista and four close views: python3 tools/castle.py OUTDIR"""
import asyncio, sys, os, math
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
from PIL import Image
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
CZ = -58 - 75  # castle centre (world z)
VIEWS = [  # name, eye x, z, height above ground, look-at x, y above ground at target, z
    ('approach', 8, -52, 14, 0, 16, CZ + 10),
    ('east', 105, -78, 34, 0, 14, CZ),
    ('west', -95, -115, 24, 0, 14, CZ),
    ('north', 30, -265, 22, 0, 14, CZ),
    ('aerial', 85, -35, 55, 0, 10, CZ),
]
async def main():
    c = CDP()
    if not await c.boot(): print('boot failed', c.errors()); c.stop(); return
    await c.new_game(); await asyncio.sleep(4); await c.ev("document.getElementById('msgs').style.display='none'; document.getElementById('hint').style.display='none'")
    await c.shot(f'{OUT}/vista.png')
    im = Image.open(f'{OUT}/vista.png'); W, H = im.size
    im.crop((int(W * 0.5), int(H * 0.28), int(W * 0.86), int(H * 0.72))).resize((int(W * 0.36) * 2, int(H * 0.44) * 2), Image.NEAREST).save(f'{OUT}/vista_castle.png')
    await c.ev("__game.settings.dbgFly=true")
    for name, x, z, alt, tx, ty, tz in VIEWS:
        js = f"""(()=>{{const g=__game,P=g.G.player,h=g.terrainH;const x={x},z={z};const gy=h(x,z);
          g.setFlying(true); P.pos.set(x,gy+{alt},z); P.vy=0; document.getElementById('msgs').innerHTML='';
          const ty=h({tx},{tz})+{ty}; const dx={tx}-x,dz={tz}-z; P.yaw=Math.atan2(-dx,-dz); P.pitch=Math.atan2(ty-(P.pos.y+1.62),Math.hypot(dx,dz));}})()"""
        r = await c.ev(js)
        if r: print(name, r)
        await asyncio.sleep(2.5); await c.shot(f'{OUT}/{name}.png')
    print('errors:', c.errors()[:5]); c.stop()
asyncio.run(main())
