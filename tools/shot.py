"""Screenshots from given places: python3 tools/shot.py OUT.png x z yaw pitch [fly] [seed]  (several: separate groups with ';')
Each group: name,x,z,yaw,pitch,fly(-1 = on the ground). Writes OUTDIR/name.png"""
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
OUT = sys.argv[1]; SPECS = [s.split(',') for s in sys.argv[2].split(';')]; SEED = int(sys.argv[3]) if len(sys.argv) > 3 else 0
async def main():
    os.makedirs(OUT, exist_ok=True); c = CDP()
    await c.boot(f'http://127.0.0.1:8765/index.html?seed={SEED}'); await c.new_game(); await asyncio.sleep(1)
    await c.ev("document.getElementById('msgs').style.display='none'; document.getElementById('hint').style.display='none'")
    for name, x, z, yaw, pitch, fly in SPECS:
        await c.ev(f"(()=>{{const g=__game,P=g.G.player; g.G.time=12*60+g.G.time-(g.G.time%1440); g.G.weather='clear'; g.Wild.prime({x},{z}); const gy=g.terrainH({x},{z}); P.pos.set({x},gy,{z}); P.yaw={yaw}; P.pitch={pitch}; if({fly}>=0){{g.settings.dbgFly=true; g.setFlying(true); P.pos.y=gy+{fly};}} else {{g.settings.dbgFly=false; g.setFlying(false);}} }})()")
        await asyncio.sleep(float(os.environ.get('WAIT', '5'))); await c.shot(f'{OUT}/{name}.png'); print(name)
    for e in c.errors()[:5]: print('ERR', e[:300])
    c.stop()
asyncio.run(main())
