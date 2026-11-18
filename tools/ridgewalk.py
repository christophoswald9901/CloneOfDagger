"""Walk the Long Ridge: along its crest from end to end, off its side at the culvert and back, up both flights of steps, then over it by fast travel.
Reports how far the walker strayed from the crest line, whether they ever stood below the crest while on it (fell through or off),
whether the landmark was found, and whether the journey by road went over the crest: python3 tools/ridgewalk.py [seed]"""
import asyncio, json, os, sys
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
SEED = sys.argv[1] if len(sys.argv) > 1 else '0'
# put the player at s metres along the crest (TP) or aim them at it; side: metres out to the left of the line
GO = r"""(()=>{const g=__game,P=g.G.player,R=g.RIDGE,p=g.ridgeAt(__S__),x=p.x-p.tz*__SIDE__,z=p.z+p.tx*__SIDE__; if(__TP__){g.settings.dbgFly=false; g.setFlying(false); g.Wild.prime(x,z); P.pos.set(x,g.terrainH(x,z)+0.3,z); P.vy=0;} window.__rw=[x,z]; return 1;})()"""
STEP = r"""(()=>{const g=__game,P=g.G.player,[tx,tz]=window.__rw; P.yaw=Math.atan2(-(tx-P.pos.x),-(tz-P.pos.z)); P.pitch=0; const on=g.ridgeNear(P.pos.x,P.pos.z);
  return JSON.stringify({d:+Math.hypot(tx-P.pos.x,tz-P.pos.z).toFixed(1),u:on?+g.RQ.d.toFixed(2):999,s:on?+g.RQ.s.toFixed(0):-1,dy:on?+(P.pos.y-g.RQ.top).toFixed(2):0,y:+P.pos.y.toFixed(2),g:+g.ridgeLand(P.pos.x,P.pos.z).toFixed(1)});})()"""
async def walk(c, s, side=0, limit=600):
    await c.ev(GO.replace('__S__', str(s)).replace('__SIDE__', str(side)).replace('__TP__', '0')); best, stuck, out = 1e9, 0, []
    for _ in range(limit):
        await asyncio.sleep(0.25); t = await c.ev(STEP)
        if not t or t.startswith('ERR'): raise SystemExit('step failed: ' + str(t)[:300])
        r = json.loads(t); out.append(r)
        if r['d'] < 1.6: break
        stuck = stuck + 1 if r['d'] > best - 0.05 else 0; best = min(best, r['d'])
        if stuck > 30: break
    return out
async def main():
    c = CDP(int(os.environ.get('CDP_PORT', '9421')))
    if not await c.boot(f'http://127.0.0.1:8765/index.html?seed={SEED}', w=360, h=220, timeout=240): print('boot failed', c.errors()[:2]); return
    await c.new_game(); await asyncio.sleep(3)
    await c.ev("__game.settings.dbgStamina=true; __game.settings.music=0; __game.settings.sfx=0")
    await c.ev("(()=>{const r=__game.renderer(); r.render=function(){};})()")  # nothing is drawn while walking
    L, sa, sb, sc = json.loads(await c.ev("JSON.stringify([__game.RIDGE.line.len,__game.RIDGE.sa,__game.RIDGE.sb,__game.RIDGE.sc])"))
    ok = True
    # 1. the crest, end to end
    await c.ev(GO.replace('__S__', '4').replace('__SIDE__', '0').replace('__TP__', '1')); await asyncio.sleep(8); await c.ev(GO.replace('__S__', '4').replace('__SIDE__', '0').replace('__TP__', '1')); await asyncio.sleep(0.5)
    await c.key('ShiftLeft', True); await c.key('KeyW', True)
    umax, dymin, dymax, legs = 0, 99, -99, 0
    for s in list(range(20, int(L), 20)) + [int(L) - 3]:
        tr = await walk(c, s); legs += 1
        if tr[-1]['d'] >= 1.6: print(f'crest: STUCK on the way to s={s} at', tr[-1]); ok = False; break
        for r in tr:
            if not 110 < r['s'] < L - 110: continue  # (its last 110 m at either end lie on the land itself, which the road is graded into)
            if r['u'] < 50: umax = max(umax, r['u'])
            if r['u'] < RIDGE_C: dymin = min(dymin, r['dy']); dymax = max(dymax, r['dy'])
    found = await c.ev("!!(__game.G.flags.found||{}).ridge")
    print(f'crest: {legs} legs of 20 m over {L:.0f} m, furthest from the line {umax:.2f} m, height above the crest on it {dymin:+.2f} .. {dymax:+.2f} m, found: {found}')
    ok = ok and umax < RIDGE_C and dymin > -0.6 and found
    # 2. off the side at the culvert, down the face, then back up it
    await c.key('KeyW', False); await c.ev(GO.replace('__S__', str(sc + 30)).replace('__SIDE__', '0').replace('__TP__', '1')); await asyncio.sleep(2); await c.key('KeyW', True)
    tr = await walk(c, sc + 30, 70); r = tr[-1]
    print(f'off the side: {"reached the valley" if r["d"] < 1.6 else "STOPPED"} {r["d"]} m short, standing {r["y"] - r["g"]:+.1f} m above the land, {r["u"]} m from the line')
    ok = ok and r['d'] < 1.6 and abs(r['y'] - r['g']) < 2.5
    tr = await walk(c, sc + 30, 0, 160); r = tr[-1]
    print(f'back up the face: {"climbed it" if r["d"] < 1.6 else "refused"} (stopped {r["u"]} m from the line, {r["y"] - r["g"]:+.1f} m above the land)')
    # the steps by the culvert, from the foot of the bank to the crest
    for k in range(2):
        await c.key('KeyW', False)
        await c.ev(f"(()=>{{const g=__game,P=g.G.player,[x,z]=g.RIDGE.stairs[{k}].footP; P.pos.set(x,g.terrainH(x,z)+0.3,z); P.vy=0; window.__rw=g.RIDGE.stairs[{k}].topP; return 1}})()"); await asyncio.sleep(1.5); await c.key('KeyW', True)
        best, stuck, r = 1e9, 0, None
        for _ in range(400):
            await asyncio.sleep(0.25); r = json.loads(await c.ev(STEP))
            if r['d'] < 1.2: break
            stuck = stuck + 1 if r['d'] > best - 0.05 else 0; best = min(best, r['d'])
            if stuck > 30: break
        got = r['d'] < 1.2; ok = ok and got
        print(f'steps {k + 1}: {"climbed to the crest" if got else "STUCK"} ({r["d"]} m short, {r["dy"]:+.2f} m against the crest, {r["u"]} m from the line)')
    await c.key('KeyW', False); await c.key('ShiftLeft', False)
    # 3. by fast travel along the road, from beyond one end to beyond the other
    J = r"""(()=>{const g=__game,P=g.G.player,T=g.World.home.ways.tracks.filter(t=>t.site==='ridge'),a=T[1][T[1].length-1],b=T[0][T[0].length-1];
      g.Wild.prime(a[0],a[1]); P.pos.set(a[0],g.terrainH(a[0],a[1])+0.3,a[1]); window.__rt={a,b,fell:0,umax:0,on:0,n:0};
      const ok=g.Travel.toward(b[0],b[1],'the far end',true); const r=g.Travel.cur; let near=0; if(r) for(const p of r.pts) if(g.ridgeNear(p[0],p[1])&&g.RQ.d<6) near++;
      return JSON.stringify({ok, pts:r?r.pts.length:0, onCrest:near, len:r?Math.round(r.cum[r.cum.length-1]):0, from:a.map(Math.round), to:b.map(Math.round)});})()"""
    print('journey:', await c.ev(J))
    W = r"""(()=>{const g=__game,P=g.G.player,w=window.__rt; if(g.ridgeNear(P.pos.x,P.pos.z)&&g.RQ.d<4&&g.RQ.s>110&&g.RQ.s<g.RIDGE.line.len-110){w.on++; const dy=P.pos.y-g.RQ.top; if(dy<-0.6)w.fell++;} w.n++;
      if(!g.Travel.cur&&g.Travel.paused&&w.res<4){w.res=(w.res||0)+1; g.Travel.resume();}
      return JSON.stringify({going:!!g.Travel.cur,paused:!!g.Travel.paused,left:Math.round(Math.hypot(P.pos.x-w.b[0],P.pos.z-w.b[1])),on:w.on,fell:w.fell,msg:[...document.querySelectorAll('#msgs div')].slice(-1).map(e=>e.textContent)[0]||''});})()"""
    for _ in range(400):
        await asyncio.sleep(0.5); r = json.loads(await c.ev(W))
        if not r['going'] and not r['paused']: break
        if not r['going'] and r['paused'] and r['left'] < 30: break
    print(f'journey: {"arrived" if r["left"] < 30 else "ENDED " + str(r["left"]) + " m short"}, samples on the crest {r["on"]}, below it {r["fell"]}, last message: {r["msg"][:120]}')
    ok = ok and r['left'] < 30 and r['on'] > 5 and r['fell'] == 0
    print('ridgewalk', 'ok' if ok else 'FAILED', '| errors:', [e[:200] for e in c.errors() if 'render failed once' not in e][:3])
    c.stop()
RIDGE_C = 4.2
asyncio.run(main())
