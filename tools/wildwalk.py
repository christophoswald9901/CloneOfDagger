"""Walk out through the old world edge and along a wild track, checking the ground under the player and the frame rate.
python3 tools/wildwalk.py"""
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
async def main():
    c = CDP()
    if not await c.boot(): print('boot failed', c.errors()); c.stop(); return
    await c.new_game(); await asyncio.sleep(2)
    # start just inside the old wall line on the north-gate road, facing out along the track
    print(await c.ev("""(()=>{const g=__game,G=g.G,P=G.player,T=g.Wild.tracks[2]||g.Wild.tracks[0]; const p=T[0],q=T[6]; g.setArea(G.city,p[0],p[1],Math.atan2(-(q[0]-p[0]),-(q[1]-p[1]))); G.time=12*60; return JSON.stringify([P.pos.x,P.pos.y,P.pos.z].map(Math.round));})()"""))
    await c.ev("__game.settings.dbgStamina=true")
    await c.key('KeyW', True); await c.key('ShiftLeft', True)
    rows = []
    for t in range(40):
        await asyncio.sleep(1.5)
        # steer along the track: face the next track point ahead of the player
        r = await c.ev("""(()=>{const g=__game,P=g.G.player,W=g.Wild; let bt=null,bd=1e9; for(const T of W.tracks) for(let i=0;i<T.length;i+=2){const d=Math.hypot(T[i][0]-P.pos.x,T[i][1]-P.pos.z); if(d<bd){bd=d;bt=[T,i];}}
          const [T,i]=bt, n=T[Math.min(T.length-1,i+10)]; P.yaw=Math.atan2(-(n[0]-P.pos.x),-(n[1]-P.pos.z));
          const gnd=g.terrainH(P.pos.x,P.pos.z); return JSON.stringify({x:Math.round(P.pos.x),z:Math.round(P.pos.z),y:+P.pos.y.toFixed(2),gnd:+gnd.toFixed(2),off:+(P.pos.y-gnd).toFixed(2),chunks:W.chunks.size,job:!!W.job,fps:Math.round(1000/Math.max(1,(performance.now()-(window._lt||performance.now())))) });})()""")
        rows.append(json.loads(r))
    await c.key('KeyW', False)
    for r in rows[::4]: print(r)
    offs = [r['off'] for r in rows]; print('max off-ground', max(offs), 'min', min(offs), 'dist', round(((rows[-1]['x']-rows[0]['x'])**2+(rows[-1]['z']-rows[0]['z'])**2)**0.5))
    print('errors:', [e[:300] for e in c.errors()[:3]]); c.stop()
asyncio.run(main())
