"""Stand at 10 random spots in the city (in front of a random building door) and capture two views each:
the entrance, and the street to the side. python3 tools/spots.py OUTDIR [seed]"""
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
SEED = int(sys.argv[2]) if len(sys.argv) > 2 else 7
async def main():
    c = CDP()
    if not await c.boot(): print('boot failed', c.errors()); c.stop(); return
    await c.new_game(); await asyncio.sleep(3)
    await c.ev("document.getElementById('msgs').style.display='none'; document.getElementById('hint').style.display='none'")
    picks = json.loads(await c.ev(f"""(()=>{{const g=__game,G=g.G;let s={SEED};const r=()=>(s=(s*16807)%2147483647)/2147483647;
      const bs=G.buildings.filter(b=>b.door&&b.district&&b.district!=='outside'&&!b.farm);const out=[];
      while(out.length<10){{const b=bs[Math.floor(r()*bs.length)];if(!out.includes(b))out.push(b);}}
      return JSON.stringify(out.map(b=>({{id:b.id,name:b.name,type:b.type,district:b.district,x:b.door.x,z:b.door.z,nx:b.door.nx,nz:b.door.nz}})));}})()"""))
    for i, p in enumerate(picks):
        for view, (d, side) in (('door', (7.5, 0)), ('street', (3.5, 1))):
            js = f"""(()=>{{const g=__game,G=g.G,P=G.player,h=g.terrainH;G.time=12*60+G.time-(G.time%1440);
              const p={json.dumps(p)};let x=p.x+p.nx*{d},z=p.z+p.nz*{d};
              P.pos.set(x,0,z); P.pos.y=g.groundAt(G.area,x,z,0.3,h(x,z)+3); P.vy=0;
              let tx=p.x,tz=p.z; if({side}){{tx=x-p.nz*20; tz=z+p.nx*20;}}
              const dx=tx-x,dz=tz-z; P.yaw=Math.atan2(-dx,-dz); P.pitch={-0.12 if side else -0.05};}})()"""
            r = await c.ev(js)
            if r: print(r)
            await asyncio.sleep(2.2); await c.shot(f'{OUT}/s{i}_{view}.png')
        print(i, p['name'], p['type'], p['district'], round(p['x']), round(p['z']))
    print('errors:', c.errors()[:5]); c.stop()
asyncio.run(main())
