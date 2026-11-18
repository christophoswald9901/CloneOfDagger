"""The survey mode, played headless: python3 tools/survey.py [OUTDIR]
Starts a game at each of the three starts (Aldhaven, Corrinvale, the edge of the known map) and reports where the player stands, what the
map gives away and any errors. At the edge it takes a bearing to each landmark in sight with an exact needle, lays each on the sheet as a
player would (the ruler's pin in the landmark, the ruler turned to the bearing, Draw line), and reports where the lines cross against
where the player really stands: a check of the whole chain from heading to bearing to ruler to line. It also turns and takes a bearing at
once with the swinging needle, and again after it settles, and checks the touch buttons. With OUTDIR it photographs the start menu, each
start, the view through the spyglass at each landmark, the sheet with its lines and the debug panel."""
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
OUT = sys.argv[1] if len(sys.argv) > 1 else None

async def main():
    c = CDP()
    if not await c.boot(timeout=240): print('boot failed'); [print('LOG', l[:600]) for l in c.errors()[:8]]; c.stop(); return
    await c.ev("localStorage.removeItem('onecity_aldhaven_settings'); Object.assign(__game.settings,{dbgFly:false,dbgStamina:false})")
    if OUT: os.makedirs(OUT, exist_ok=True)
    async def shot(name, wait=0):
        if not OUT: return
        if wait: await asyncio.sleep(wait)
        await c.shot(f'{OUT}/{name}.png')
    # the start menu
    await c.ev("__game.Survey.chooseStart(() => {})"); await shot('menu_start', 1)
    await c.ev("__game.UI.close(true); document.getElementById('title').hidden = true")
    cfg = "{name:'T',race:'Townborn',cls:'Warrior',attr:{STR:50,INT:50,WIL:50,AGI:50,END:50,PER:50,SPD:50,LUC:50}}"
    for start in ['aldhaven', 'corrinvale', 'edge']:
        await c.ev(f"(()=>{{const g=__game; g.Survey.pending='{start}'; g.beginNewGame({cfg}); g.UI.close(true); g.Input.fallback=true; g.G.weather='clear'; g.G.weatherDay=99999;}})()")
        await asyncio.sleep(3)
        r = await c.ev("""(()=>{const g=__game,P=g.G.player,S=g.Survey,s=S.st();return JSON.stringify({start:s.start,pos:[Math.round(P.pos.x),+P.pos.y.toFixed(1),Math.round(P.pos.z)],
          ground:+g.terrainH(P.pos.x,P.pos.z).toFixed(1),heading:+S.heading().toFixed(1),opts:s.opts,showPos:S.showPos(),found:Object.keys(g.G.flags.found||{}).length,points:S.points().length,stuck:g.collide?0:0})})()""")
        print('start', r)
        await c.ev("document.getElementById('msgs').style.display='none'")
        await shot(f'start_{start}', 3)
        await c.ev("document.getElementById('msgs').style.display=''")
    # at the edge: sight each landmark, note it, lay it with the ruler
    pts = json.loads(await c.ev("JSON.stringify(__game.Survey.points().map(p=>({name:p.name,x:p.x,z:p.z})))"))
    P0 = json.loads(await c.ev("JSON.stringify([__game.G.player.pos.x,__game.G.player.pos.y,__game.G.player.pos.z])"))
    await c.ev("__game.Survey.st().opts.needle='steady'; document.getElementById('msgs').style.display='none'")
    taken = []
    for p in pts:
        vis = await c.ev(f"""(()=>{{const g=__game,P=g.G.player,H=(x,z)=>g.terrainRaw(x,z),x={p['x']},z={p['z']},e=P.pos.y+1.62,th=H(x,z)+15,d=Math.hypot(x-P.pos.x,z-P.pos.z),n=Math.ceil(d/20);
          for(let k=2;k<n-1;k++){{const t=k/n;if(H(P.pos.x+(x-P.pos.x)*t,P.pos.z+(z-P.pos.z)*t)>e+(th-e)*t)return 0;}}return Math.round(d);}})()""")
        if not vis: continue
        exact = await c.ev(f"""(()=>{{const g=__game,P=g.G.player,S=g.Survey,x={p['x']},z={p['z']},dx=x-P.pos.x,dz=z-P.pos.z,d=Math.hypot(dx,dz),b=Math.atan2(dx,-dz)*180/Math.PI;
          P.yaw=-b*Math.PI/180; P.pitch=Math.atan2(g.terrainRaw(x,z)+12-(P.pos.y+1.62),d); S.open(); S.zoom=Math.min(10,Math.max(2,d/700)); return (b+360)%360;}})()""")
        await shot('sight_' + ''.join(ch for ch in p['name'] if ch.isalnum())[:24], 3)
        rd = await c.ev("(()=>{const S=__game.Survey;S.take();const r=S.st().reads;return r[r.length-1].b})()")
        taken.append((p, exact, rd, vis)); print(f"sight {p['name']:<36} {vis/1000:5.1f} km  exact {exact:7.2f}  noted {rd}")
    # lay them on the sheet: pin in the landmark, turned to the bearing noted, a line drawn
    await c.ev("__game.Survey.openSheet(); __game.MapView.zoom=0.05; __game.MapView.view=[-6000,-9500]; __game.MapView.draw()")
    for p, exact, rd, vis in taken:
        await c.ev(f"(()=>{{const S=__game.Survey,R=S.st().ruler||(S.st().ruler={{x:0,z:0,a:0}}); R.x={p['x']}; R.z={p['z']}; R.a={rd}; S.line();}})()")
    res = await c.ev("""(()=>{const S=__game.Survey,P=__game.G.player,L=S.st().items.filter(i=>i.k==='line'),out=[];
      for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const a=L[i],b=L[j],d1x=a.bx-a.ax,d1z=a.bz-a.az,d2x=b.bx-b.ax,d2z=b.bz-b.az,den=d1x*d2z-d1z*d2x;if(Math.abs(den)<1e-6)continue;
        const t=((b.ax-a.ax)*d2z-(b.az-a.az)*d2x)/den,x=a.ax+d1x*t,z=a.az+d1z*t;out.push(Math.round(Math.hypot(x-P.pos.x,z-P.pos.z)));}
      return JSON.stringify({lines:L.length,crossings_m_from_player:out});})()""")
    print('sheet', res)
    # mark a fix where the first two lines cross, and check it
    await c.ev("""(()=>{const S=__game.Survey,P=__game.G.player,L=S.st().items.filter(i=>i.k==='line');if(L.length<2)return;const a=L[0],b=L[1],d1x=a.bx-a.ax,d1z=a.bz-a.az,d2x=b.bx-b.ax,d2z=b.bz-b.az,den=d1x*d2z-d1z*d2x,t=((b.ax-a.ax)*d2z-(b.az-a.az)*d2x)/den;
      S.st().items.push({k:'mark',x:a.ax+d1x*t,z:a.az+d1z*t,tx:P.pos.x,tz:P.pos.z,t:0}); S.st().ruler={x:L[0].ax*0+%f,z:%f,a:%f}; __game.MapView.draw(); S.panel();})()""" % ((taken[0][0]['x'], taken[0][0]['z'], taken[0][2]) if taken else (0, 0, 0)))
    await shot('sheet_lines', 1.5)
    await c.ev("__game.MapView.zoom=0.4; __game.MapView.view=[%f,%f]; __game.MapView.draw()" % (P0[0], P0[2])); await shot('sheet_fix', 1)
    await c.ev("__game.Survey.st().opts.truth=true; __game.Survey.act('dbg'); __game.MapView.draw()"); await shot('sheet_debug', 1)
    print('map', await c.ev("JSON.stringify({mapOpen:__game.G.mapOpen,sheet:__game.Survey.sheet,arrowShown:__game.Survey.showPos(),legend:document.getElementById('maplegend').textContent.slice(0,60)})"))
    await c.ev("__game.Survey.act('dbg'); __game.Survey.st().opts.truth=false")
    # the sheet by hand, with the mouse: the pin dragged onto Halewood House (it settles in), a knob turned 30 degrees, ] turns it 0.1, Draw line, Mark and a click
    geo = '''(()=>{const S=__game.Survey,t=__game.MapView.tf,R=S.st().ruler,g=S.geo(t),h=S.points().find(p=>p.name.startsWith('Halewood')),d=t.dpr;
      return JSON.stringify({pin:[g.cx,g.cy],u:[g.ux,g.uy],n:[g.nx,g.ny],half:g.half,w:g.w,hw:[(t.W/2+(h.x-t.cx)*t.scale)/d,(t.H/2+(h.z-t.cz)*t.scale)/d],a:R.a});})()'''
    async def drag(a, b, steps=10):
        await c.send('Input.dispatchMouseEvent', type='mouseMoved', x=a[0], y=a[1])
        await c.send('Input.dispatchMouseEvent', type='mousePressed', x=a[0], y=a[1], button='left', buttons=1, clickCount=1)
        for k in range(1, steps + 1): await c.send('Input.dispatchMouseEvent', type='mouseMoved', x=a[0] + (b[0] - a[0]) * k / steps, y=a[1] + (b[1] - a[1]) * k / steps, button='left', buttons=1)
        await c.send('Input.dispatchMouseEvent', type='mouseReleased', x=b[0], y=b[1], button='left', buttons=0, clickCount=1)
    await c.ev("(()=>{const S=__game.Survey;S.st().items=[];S.st().ruler=null;S.fold=false;S.panel();__game.MapView.zoom=0.08;__game.MapView.view=[-5500,-10500];__game.MapView.draw();})()")
    g = json.loads(await c.ev(geo)); off = lambda p, al, ac: [p[0] + g['u'][0] * al + g['n'][0] * ac, p[1] + g['u'][1] * al + g['n'][1] * ac]
    await drag(off(g['pin'], 70, 15), [off(g['hw'], 70, 15)[0] + 7, off(g['hw'], 70, 15)[1] - 5])
    g = json.loads(await c.ev(geo)); import math
    k0 = off(g['pin'], g['half'] - 20, g['w'] / 2 + 2); vx, vy = k0[0] - g['pin'][0], k0[1] - g['pin'][1]; r = math.radians(30)
    await drag(k0, [g['pin'][0] + vx * math.cos(r) - vy * math.sin(r), g['pin'][1] + vx * math.sin(r) + vy * math.cos(r)])
    a1 = json.loads(await c.ev(geo))['a']
    await c.ev("dispatchEvent(new KeyboardEvent('keydown',{code:'BracketRight'})); dispatchEvent(new KeyboardEvent('keyup',{code:'BracketRight'}))")
    a2 = json.loads(await c.ev(geo))['a']
    await c.ev("document.querySelector('[data-sv=line]').click(); document.querySelector('[data-sv=mark]').click()")
    await c.send('Input.dispatchMouseEvent', type='mousePressed', x=700, y=400, button='left', buttons=1, clickCount=1); await c.send('Input.dispatchMouseEvent', type='mouseReleased', x=700, y=400, button='left', buttons=0, clickCount=1)
    hand = json.loads(await c.ev("JSON.stringify({pinned:(__game.Survey.pinned()||{}).name||null,items:__game.Survey.st().items.map(i=>i.k)})"))
    print('by hand', json.dumps({'pinned': hand['pinned'], 'turned_by_knob': round((a1 - g['a'] + 540) % 360 - 180, 1), 'then_bracket': round((a2 - a1 + 540) % 360 - 180, 2), 'items': hand['items']}))
    # with two fingers: one on the ruler, the second twisting round it by 20 degrees
    await c.send('Emulation.setTouchEmulationEnabled', enabled=True, maxTouchPoints=5)
    g = json.loads(await c.ev(geo)); t1 = off(g['pin'], 90, 15); t2 = off(g['pin'], 260, 15); vx, vy = t2[0] - t1[0], t2[1] - t1[1]
    await c.send('Input.dispatchTouchEvent', type='touchStart', touchPoints=[{'x': t1[0], 'y': t1[1], 'id': 1}])
    await c.send('Input.dispatchTouchEvent', type='touchStart', touchPoints=[{'x': t1[0], 'y': t1[1], 'id': 1}, {'x': t2[0], 'y': t2[1], 'id': 2}])
    for k in range(1, 9):
        r = math.radians(20 * k / 8); await c.send('Input.dispatchTouchEvent', type='touchMove', touchPoints=[{'x': t1[0], 'y': t1[1], 'id': 1}, {'x': t1[0] + vx * math.cos(r) - vy * math.sin(r), 'y': t1[1] + vx * math.sin(r) + vy * math.cos(r), 'id': 2}])
    await c.send('Input.dispatchTouchEvent', type='touchEnd', touchPoints=[])
    a3 = json.loads(await c.ev(geo))['a']; print('twist', round((a3 - g['a'] + 540) % 360 - 180, 1), 'degrees (wanted 20)')
    await c.send('Emulation.setTouchEmulationEnabled', enabled=False)
    await shot('sheet_by_hand', 1)
    await c.ev("__game.Touch.enable(false); __game.MapView.close()")
    # the swinging needle: turn 40 degrees and note at once, then after it settles
    sw = await c.ev("""(async()=>{const g=__game,S=g.Survey,P=g.G.player,until=async s=>{const c0=g.G.clock;while(g.G.clock-c0<s)await new Promise(r=>setTimeout(r,50));};S.st().opts.needle='swing';if(!S.on)S.open();await until(3);P.yaw-=40*Math.PI/180;await until(0.1);
      const e1=S.reading()-S.heading();await until(1.5);const e2=S.reading()-S.heading();await until(2);const e3=S.reading()-S.heading();const f=v=>+(((v+540)%360)-180).toFixed(2);return JSON.stringify({after_0_1s:f(e1),after_1_6s:f(e2),after_3_6s:f(e3)});})()""")
    print('needle', sw)
    # touch: the survey buttons in place of Use and Jump
    tb = await c.ev("""(()=>{const g=__game,T=g.Touch;T.enable(true);T.sig='';T.update();const B=T.btn,h=k=>B[k]&&!B[k].hidden&&getComputedStyle(B[k]).display!=='none';
      const on={bearing:h('svTake'),sheet:h('svMap'),use:h('use'),jump:h('Space'),label:B.KeyK.textContent};g.Survey.close();T.sig='';T.update();const off={bearing:h('svTake'),use:h('use'),label:B.KeyK.textContent};T.enable(false);return JSON.stringify({on,off});})()""")
    print('touch', tb)
    # on a tablet: the buttons while sighting, and the sheet
    if OUT:
        await c.send('Emulation.setDeviceMetricsOverride', width=1024, height=768, deviceScaleFactor=1, mobile=False)
        await c.ev("(()=>{const g=__game;g.Touch.enable(true);dispatchEvent(new Event('resize'));const P=g.G.player,p=g.Survey.points().find(q=>q.name.startsWith('Mirrormere'));const dx=p.x-P.pos.x,dz=p.z-P.pos.z;P.yaw=-Math.atan2(dx,-dz);P.pitch=-0.02;g.Survey.open();g.Survey.zoom=4;g.Touch.sig='';})()")
        await shot('touch_sight', 3)
        await c.ev("__game.Survey.openSheet(); __game.MapView.zoom=0.05; __game.MapView.view=[-6000,-9500]; __game.MapView.draw()"); await shot('touch_sheet', 1.5)
        await c.ev("__game.Survey.act('dbg')"); await shot('touch_debug', 1)
        await c.ev("__game.Survey.close(); __game.Touch.enable(false)")
    for l in [l for l in c.errors() if 'render failed once' not in l][:10]: print('LOG', l[:800])
    c.stop()
asyncio.run(main())
