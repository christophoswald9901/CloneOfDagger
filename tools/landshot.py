"""Start a new game in a land of its own (a map apart from the world, src/08_land.js) and photograph it:
python3 tools/landshot.py LAND OUTDIR [views]
views: "name,x,z,yaw,pitch,fly;..." in the land's own metres (fly: metres above the ground, -1 = standing); yaw in degrees, 0 = looking
north (-z), 90 = west; pitch in degrees. Without views, a default set: from the start, from the air over each quarter, and the overview.
Also: LOOK="x,z" turns every view towards that point (yaw is then ignored). HOUR (default 11), WEATHER (default clear), WAIT (s, default 6).
Prints how long the land took to build, its counts, and any errors. Writes labelled contact sheets of four views each (sheet0.png, ...)."""
import asyncio, sys, os, json, math
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
LAND, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
VIEWS = [v.split(',') for v in sys.argv[3].split(';')] if len(sys.argv) > 3 else None
HOUR = float(os.environ.get('HOUR', '11')); WEATHER = os.environ.get('WEATHER', 'clear'); WAIT = float(os.environ.get('WAIT', '6'))
LOOK = os.environ.get('LOOK')
async def main():
    c = CDP()
    if not await c.boot('http://127.0.0.1:8765/index.html', timeout=240): print('boot failed', c.errors()[:3]); c.stop(); return
    await c.ev("localStorage.removeItem('onecity_aldhaven_settings'); Object.assign(__game.settings,{dbgFly:false,dbgStamina:false})")
    r = await c.ev(f"""(()=>{{const g=__game;g.Survey.pending={json.dumps(LAND)};const t0=performance.now();
      g.beginNewGame({{name:'T',race:'Townborn',cls:'Warrior',attr:{{STR:50,INT:50,WIL:50,AGI:50,END:50,PER:50,SPD:50,LUC:50}}}});g.UI.close(true);g.Input.fallback=true;
      const A=g.G.area;return JSON.stringify({{kind:A.kind,name:A.name,buildMs:A.buildMs,wall:Math.round(performance.now()-t0),cols:A.colliders.length,children:A.scene.children.length,
        pools:Object.fromEntries(Object.entries(A.pools||{{}}).map(([k,p])=>[k,p.mesh.count])),start:A.start}});}})()""")
    print('land', r)
    await asyncio.sleep(2)
    await c.ev("document.getElementById('msgs').style.display='none'; document.getElementById('hint').style.display='none'")
    st = json.loads(r)['start'] if r and r.startswith('{') else {'x': 0, 'z': 0, 'yaw': 0}
    views = VIEWS or [['start', st['x'], st['z'], math.degrees(st['yaw']), 3, -1], ['air_ne', 330, -330, 135, -24, 140], ['air_sw', -330, 330, -45, -24, 140],
                      ['air_nw', -380, -380, -135 + 360, -22, 150], ['air_se', 380, 380, 45, -22, 150], ['overview', 0, 760, 0, -30, 420]]
    for name, x, z, yaw, pitch, fly in views:
        look = LOOK.split(',') if LOOK else None
        await c.ev(f"""(()=>{{const g=__game,G=g.G,P=G.player,A=G.area,[wx,wz]=A.toWorld({x},{z});G.time=Math.floor(G.time/1440)*1440+{HOUR}*60;G.weather={json.dumps(WEATHER)};
          const gy=A.heightAt(wx,wz);P.pos.set(wx,gy,wz);let yaw={yaw}*Math.PI/180;{'const [lx,lz]=A.toWorld(' + look[0] + ',' + look[1] + ');yaw=Math.atan2(-(lx-wx),-(lz-wz));' if look else ''}P.yaw=yaw;P.pitch={pitch}*Math.PI/180;
          if({fly}>=0){{g.settings.dbgFly=true;g.setFlying(true);P.pos.y=gy+{fly};}}else{{g.setFlying(false);}}return 1;}})()""")
        await asyncio.sleep(WAIT); await c.shot(f'{OUT}/{name}.png'); print(name)
    for e in [e for e in c.errors() if 'render failed once' not in e][:8]: print('ERR', e[:400])
    c.stop()
    from PIL import Image, ImageDraw
    names = [v[0] for v in views]
    for k in range(0, len(names), 4):
        sheet = Image.new('RGB', (784 * 2, 400 * 2))
        for q, n in enumerate(names[k:k + 4]):
            im = Image.open(f'{OUT}/{n}.png').convert('RGB').resize((784, 400)); d = ImageDraw.Draw(im); d.rectangle([0, 0, 150, 18], fill=(0, 0, 0)); d.text((4, 3), n, fill=(255, 255, 0))
            sheet.paste(im, ((q % 2) * 784, (q // 2) * 400))
        sheet.save(f'{OUT}/sheet{k // 4}.png')
asyncio.run(main())
