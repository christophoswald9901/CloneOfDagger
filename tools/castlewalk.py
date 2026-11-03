"""Walk from the castle forecourt through the gate to the palace door, and sample the ramp surface: python3 tools/castlewalk.py"""
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
async def main():
    c = CDP(); await c.boot(timeout=150); await c.new_game(); await asyncio.sleep(2)
    await c.ev("(()=>{const P=__game.G.player;P.pos.set(0,__game.terrainH(0,-86)+0.5,-86);P.yaw=0;P.pitch=0;P.vy=0})()"); await asyncio.sleep(1)
    await c.key('KeyW'); 
    for i in range(60):
        await asyncio.sleep(1)
        st = await c.ev("(()=>{const P=__game.G.player,f=__game.G.focus;return JSON.stringify({z:+P.pos.z.toFixed(1),y:+P.pos.y.toFixed(1),focus:f?f.type+':'+(f.obj.building?f.obj.building.id:''):null})})()")
        print(st)
        if '"door:castle"' in st: break
    await c.key('KeyW', False)
    # ramp: walkable heights along both legs (ground vs. the terrain under it)
    print(await c.ev("(()=>{const g=__game,a=g.G.area,out=[];for(const [x,z] of [[38,-72],[20,-72],[0,-72],[-20,-72],[-27,-76],[-20,-79],[0,-79],[10,-79],[12,-82]]){out.push([x,z,+g.groundAt(a,x,z,0.3,80).toFixed(1),+g.terrainH(x,z).toFixed(1)])}return JSON.stringify(out)})()"))
    print('errors', c.errors()[:5]); c.stop()
asyncio.run(main())
