"""Views of the generated country beyond the surveyed land, for one or more world seeds, on the ground and from the air.
python3 tools/wild.py OUTDIR [seed ...]          -> OUTDIR/s{seed}_{view}.png and OUTDIR/sheet_s{seed}.jpg (labelled contact sheet)
SET=transition python3 tools/wild.py OUTDIR 0    -> views across the edge of the hand-made country instead
VIEWS=a,b                                         -> capture only some views"""
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
OUT = sys.argv[1] if len(sys.argv) > 1 else 'tools/out/wild'
SEEDS = [int(a) for a in sys.argv[2:]] or [0]
ONLY = os.environ.get('VIEWS', '').split(',') if os.environ.get('VIEWS') else None
SET = os.environ.get('SET', 'wild')

# where each view stands: JS returning {name: [x, z, yaw, pitch, fly-height-above-ground or null]}  (yaw: 0 looks north, -pi/2 east)
FIND = r"""(()=>{const g=__game,W=g.Wild,h=g.terrainH,R=g.LAND.rivers,T=W.tracks,fm=g.G.city.forestMask; const V={};
 const at=(t,k)=>{const p=t[Math.min(t.length-1,k)],q=t[Math.min(t.length-1,k+3)];return [p[0],p[1],Math.atan2(-(q[0]-p[0]),-(q[1]-p[1]))];};
 const look=(x,z,tx,tz)=>Math.atan2(-(tx-x),-(tz-z));
 // on the longest track, about 4 km out, looking along it
 { let best=null; for(const t of T){const k=t.findIndex(p=>Math.hypot(p[0],p[1])>4000); if(k>0&&(!best||t.length>best[0].length))best=[t,k];} const [x,z,y]=best?at(best[0],best[1]):[0,-4000,0]; V.track=[x,z,y,-0.04,null]; }
 // on the bank of a big river 2-7 km out, looking downstream
 { const Rs=R.filter(r=>!r.hand&&Math.max(...r.w)>8); let best=null; for(const r of Rs) for(let q=0;q<r.P.length;q+=25){const p=r.P[q],d=Math.hypot(p[0],p[1]); if(d<2000||d>7000||r.w[q]<7)continue; const sc=Math.abs(d-3500); if(!best||sc<best[0])best=[sc,r,q];}
   if(best){const [,r,q]=best,p=r.P[q],n=r.P[Math.min(r.P.length-1,q+12)],dx=n[0]-p[0],dz=n[1]-p[1],l=Math.hypot(dx,dz)||1,off=r.w[q]/2+6; V.river=[p[0]-dz/l*off,p[1]+dx/l*off,Math.atan2(-dx,-dz)+0.35,-0.06,null];} }
 // the edge of a wood 2-4 km out, looking in
 { let best=null; for(let a=0;a<48;a++)for(const r of [2200,2800,3400,4000]){const x=Math.cos(a/48*6.283)*r,z=-Math.abs(Math.sin(a/48*6.283))*r-300; const hh=h(x,z); if(hh<8)continue; const m=fm(x,z,hh); if(!best||m>best[0])best=[m,x,z];}
   let ex=best[1],ez=best[2],ux=-ex,uz=-ez,ul=Math.hypot(ux,uz); ux/=ul; uz/=ul; for(let k=0;k<80;k++){ if(fm(ex,ez,h(ex,ez))<0.3)break; ex+=ux*10; ez+=uz*10; }
   V.forest=[ex+ux*30,ez+uz*30,look(ex,ez,best[1],best[2]),-0.03,null]; }
 // the highest ground 3-8 km out, looking out over the country
 { let best=null; for(let a=0;a<64;a++)for(const r of [3000,4500,6000,7500]){const x=Math.cos(a/64*6.283)*r,z=-Math.abs(Math.sin(a/64*6.283))*r*1.4-500; if(g.rimDist&&0)continue; const hh=h(x,z); if(hh>300)continue; if(!best||hh>best[0])best=[hh,x,z];}
   let [hh,x,z]=best; for(const st of [30,12]) for(let it=0;it<100;it++){let mv=false; for(let a=0;a<12;a++){const nx=x+Math.cos(a/12*6.283)*st,nz=z+Math.sin(a/12*6.283)*st,nh=h(nx,nz); if(nh>hh+0.05&&nh<320){hh=nh;x=nx;z=nz;mv=true;}} if(!mv)break;}
   // on the top itself, looking out (the outlook search below turns to the open side)
   V.upland=[x,z,look(x,z,0,-6000),-0.1,null]; }
 // on the coast 4 km west of the city, looking along the shore
 { let best=null; for(let x=-5200;x<=-3200;x+=100){ const cz=g.coastZ(x); let z=cz-200; while(h(x,z)>1.5&&z<cz+300) z+=4; if(Math.abs(z-cz)>120) continue; let zz=z; for(let k=0;k<40&&h(x,zz)<3.5;k++) zz-=3; const sl=Math.hypot(h(x+3,zz)-h(x-3,zz),h(x,zz+3)-h(x,zz-3))/6; if(sl<0.3&&(!best||Math.abs(x+4200)<Math.abs(best[0]+4200))) best=[x,zz]; } const [x,z]=best||[-4200,0]; V.coast=[x,z,Math.atan2(1,-0.25),-0.08,null]; } // at the shore, a few metres above the water
 // in the foothills of the mountains that close the world to the north, looking at them
 { let x=1500,z=-12000; while(h(x,z)<260&&z>-19000) z-=40; z+=700; for(let k=0;k<40&&fm(x,z,h(x,z))>0.15;k++){ x+=(k%2?1:-1)*k*60; } V.rim=[x,z,0,0.08,null]; }
 // from the air: over a river valley, high over the interior, and over the edge of the city's own country looking out
 { const r=R.filter(r=>!r.hand).sort((a,b)=>b.P.length-a.P.length)[0], q=Math.floor(r.P.length*0.45), p=r.P[q], n=r.P[Math.min(r.P.length-1,q+60)]; V.air_valley=[p[0]-(n[1]-p[1])*1.2,p[1]+(n[0]-p[0])*1.2,look(p[0],p[1],n[0],n[1])+0.5,-0.3,150]; }
 V.air_high=[-2500,-6500,Math.atan2(-0.3,1),-0.22,360];
 V.air_city=[650,-500,look(650,-500,2500,-3000),-0.25,140];
 return JSON.stringify(V);})()"""

# views across the edge of the hand-made country round the city (fixed places; the hand-made side never changes)
TRANS = r"""(()=>{const look=(x,z,tx,tz)=>Math.atan2(-(tx-x),-(tz-z)); const V={};
 V.t_east=[470,-120,look(470,-120,900,-120),-0.05,null];
 V.t_north=[40,-560,look(40,-560,40,-1000),-0.04,null];
 V.t_west=[-330,-60,look(-330,-60,-800,-60),-0.04,null];
 V.t_back=[600,-90,look(600,-90,250,-60),-0.03,null];
 V.t_nw=[-420,-420,look(-420,-420,-800,-800),-0.04,null];
 V.t_air_e=[260,-60,look(260,-60,900,-250),-0.3,95];
 V.t_air_n=[0,-200,look(0,-200,0,-900),-0.33,120];
 V.t_air_w=[-200,40,look(-200,40,-900,-200),-0.3,110];
 V.t_air_out=[1300,-900,look(1300,-900,0,-100),-0.28,150];
 return JSON.stringify(V);})()"""

# views of the landmarks whose ground is fixed: from their own road, from where the generated land blends into them, and from the air
SITES_V = r"""(()=>{const g=__game,h=g.terrainH,look=(x,z,tx,tz)=>Math.atan2(-(tx-x),-(tz-z)); const V={};
 for(const S of g.SITES){ const T=g.Wild.tracks[S.track]; let k=0; while(k<T.length-1&&Math.hypot(T[k][0]-S.x,T[k][1]-S.z)<170)k++; const [x,z]=T[k];
   V[S.id+'_road']=[x,z,look(x,z,S.x,S.z),-0.02,null];
   let a=Math.atan2(z-S.z,x-S.x)+1.9, bx=S.x+Math.cos(a)*S.rb*0.75, bz=S.z+Math.sin(a)*S.rb*0.75; V[S.id+'_edge']=[bx,bz,look(bx,bz,S.x,S.z),-0.01,null];
   const ax=S.x+Math.cos(a-0.9)*520, az=S.z+Math.sin(a-0.9)*520; V[S.id+'_air']=[ax,az,look(ax,az,S.x,S.z),-0.24,150];
   const fx=S.x+Math.cos(a+0.6)*(S.rb+250), fz=S.z+Math.sin(a+0.6)*(S.rb+250); V[S.id+'_far']=[fx,fz,look(fx,fz,S.x,S.z),-0.2,260]; }
 return JSON.stringify(V);})()"""

# views of a town: approach, gate, square, streets, canal, cathedral, walls, from the air (TOWNSEED=N lays out another town from the same generator)
TOWN_V = r"""(()=>{const g=__game,T=g.TOWNS[0],C=T.cfg,look=(x,z,tx,tz)=>Math.atan2(-(tx-x),-(tz-z)),W=(u,v)=>T.w(u,v); const V={};
 const at=(name,u,v,tu,tv,pitch,fly)=>{const [x,z]=W(u,v),[tx,tz]=W(tu,tv); V[name]=[x,z,look(x,z,tx,tz),pitch,fly];};
 at('town_far',C.mainU,C.B+620,C.mainU,0,0.03,null);
 at('town_gate',C.mainU+4,C.B+C.moat.off+C.moat.w+45,C.mainU,C.B,0.06,null);
 const sq=T.square; if(sq) at('town_square',sq.u1-6,sq.v1-6,sq.uc,sq.v0-30,0.12,null);
 const st=T.streets.filter(s=>!s.main&&!s.ring&&!s.canal).sort((a,b)=>Math.hypot((a.u0+a.u1)/2-120,(a.v0+a.v1)/2-150)-Math.hypot((b.u0+b.u1)/2-120,(b.v0+b.v1)/2-150))[0]; at('town_street',st.u0,st.v0,st.u1,st.v1,0.03,null);
 at('town_canal',-C.A*0.35,C.canal.v+C.canal.w/2+2,C.A*0.2,C.canal.v,0.02,null);
 const cb=T.cathedral; if(cb){const d=T.cathDims(cb); at('town_cathedral',cb.u1+4,cb.vc+6,d.cu,cb.vc,0.28,null);}
 const mk=T.market; if(mk) at('town_market',mk.u0+4,mk.v0+4,mk.uc,mk.vc,0.05,null);
 at('town_commons',-C.A+C.ring.off,C.B*0.4,-C.A+C.ring.off,-C.B*0.4,0.03,null);
 at('town_air',C.A+500,C.B+450,0,0,-0.3,260);
 at('town_air_low',-C.A*0.2,C.mainV+60,C.A*0.3,C.canal.v-80,-0.22,70);
 return JSON.stringify(V);})()"""

# how far each view may turn to find an open outlook (radians either side of its planned heading)
ARC = {'upland': 3.14, 'coast': 1.3, 'forest': 0.4, 'track': 0.3, 'river': 0.3, 'rim': 0.6, 't_east': 0.6, 't_north': 0.6, 't_west': 0.6, 't_back': 0.8, 't_nw': 0.8}

PLACE = r"""(()=>{const g=__game,G=g.G,P=G.player; G.time=12*60+G.time-(G.time%1440); G.weather='clear'; G.weatherDay=Math.floor(G.time/1440);
  const [x,z,yaw,pitch,fly,arc,margin,name]=ARGS; g.Wild.prime(x,z); let X=x,Z=z;
  // step off to a spot clear of trunks, rocks and walls
  const clear=(x,z)=>{for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const l=G.area.grid.get((Math.floor(x/8)+i)*10007+Math.floor(z/8)+j)||[]; if(l.some(c=>x>c.x0-margin&&x<c.x1+margin&&z>c.z0-margin&&z<c.z1+margin))return false;} return g.terrainH(x,z)>-0.5;};
  if(fly===null) for(let r=0;r<(name.startsWith('town')?6:60)&&!clear(X,Z);r+=1.5){const a=r*2.4;X=x+Math.cos(a)*r;Z=z+Math.sin(a)*r;}
  // how far one can see along a heading: nothing (0) if ground or a solid thing stands close in front
  const openD=(X,Z,yy,gy)=>{ const fx=-Math.sin(yy), fz=-Math.cos(yy);
    for(const sd of [-0.35,0,0.35]){ const c=Math.cos(sd),s=Math.sin(sd),ux=fx*c-fz*s,uz=fx*s+fz*c;
      for(let d=2;d<14;d+=2){ const px=X+ux*d,pz=Z+uz*d; if(g.terrainH(px,pz)>gy+1.9) return 0; const l=G.area.grid.get(Math.floor(px/8)*10007+Math.floor(pz/8))||[]; if(l.some(c2=>px>c2.x0-1&&px<c2.x1+1&&pz>c2.z0-1&&pz<c2.z1+1&&c2.y1>gy+1)) return 0; } }
    let d=6; for(;d<420;d+=6){ if(g.terrainH(X+fx*d,Z+fz*d)>gy+1.6-d*0.035) break; } return d; };
  let gy=g.terrainH(X,Z), Y=yaw;
  if(arc>0&&fly===null){ let bestD=-1; for(let k=-8;k<=8;k++){ const yy=yaw+k/8*arc, d=openD(X,Z,yy,gy); if(d>bestD+12){bestD=d;Y=yy;} }
    if(bestD<60&&name!=='upland'){ /* the high ground stays on its top */ let bb=[bestD,X,Z,Y]; for(let r=10;r<=90;r+=10) for(let a=0;a<12;a++){ const nx=X+Math.cos(a*0.5236)*r, nz=Z+Math.sin(a*0.5236)*r, ng=g.terrainH(nx,nz); if(ng<-0.5) continue; if(Math.hypot(g.terrainH(nx+2,nz)-g.terrainH(nx-2,nz),g.terrainH(nx,nz+2)-g.terrainH(nx,nz-2))/4>0.55) continue;
        for(let k=-8;k<=8;k++){ const yy=yaw+k/8*arc, d=openD(nx,nz,yy,ng); if(d>bb[0]+12) bb=[d,nx,nz,yy]; } } [bestD,X,Z,Y]=bb; gy=g.terrainH(X,Z); } }
  P.pos.set(X,gy,Z); P.vy=0; P.yaw=Y; P.pitch=pitch;
  if(fly!==null){ g.settings.dbgFly=true; g.setFlying(true); P.pos.y=gy+fly; } else { g.settings.dbgFly=false; g.setFlying(false); }
  return JSON.stringify([Math.round(X),Math.round(Z),Math.round(gy)]);})()"""

LABEL = {'track': 'ground: on a track 4 km out', 'river': 'ground: bank of a big river', 'forest': 'ground: edge of a wood', 'upland': 'ground: high ground looking out',
         'coast': 'ground: the coast 4 km west', 'rim': 'ground: foothills of the edge mountains', 'air_valley': 'air: 150 m over a river valley', 'air_high': 'air: 360 m over the interior',
         'air_city': 'air: 140 m up beside the city, looking out',
         't_east': 'ground: east fields -> out', 't_north': 'ground: north fields -> out', 't_west': 'ground: west edge -> out', 't_back': 'ground: generated land looking back at the city',
         't_nw': 'ground: north-west edge -> out', 't_air_e': 'air: over the east fields, looking out', 't_air_n': 'air: over the north side, looking out', 't_air_w': 'air: over the west side, looking out',
         't_air_out': 'air: from the generated land back towards the city'}
ARC['coast'] = 1.6

def sheet(files, path):
    from PIL import Image, ImageDraw
    ims = [(n, Image.open(f).convert('RGB')) for n, f in files]
    w = 784; ims = [(n, i.resize((w, int(i.height * w / i.width)))) for n, i in ims]; h = ims[0][1].height
    cols = 3; rows = (len(ims) + cols - 1) // cols
    out = Image.new('RGB', (w * cols, h * rows)); d = ImageDraw.Draw(out)
    for k, (n, i) in enumerate(ims):
        x, y = (k % cols) * w, (k // cols) * h; out.paste(i, (x, y))
        d.rectangle([x, y, x + 8 * len(LABEL.get(n, n)) + 10, y + 18], fill=(0, 0, 0)); d.text((x + 5, y + 3), LABEL.get(n, n), fill=(255, 255, 255))
    out.save(path, quality=88)

async def main():
    os.makedirs(OUT, exist_ok=True)
    for seed in SEEDS:
        c = CDP()
        if not await c.boot(f'http://127.0.0.1:8765/index.html?seed={seed}' + (f'&townseed={seed}' if SET == 'town' else '')): print('boot failed', c.errors()[:2]); c.stop(); return
        await c.new_game()
        for _ in range(40):  # wait until the game is really in play (a view taken before that shows the title camera)
            if await c.ev("!!(__game.G.player && __game.G.state === 'play')"): break
            await asyncio.sleep(0.5)
        else: print('new game never started', c.errors()[:2]); c.stop(); return
        await asyncio.sleep(2)
        await c.ev("document.getElementById('msgs').style.display='none'; document.getElementById('hint').style.display='none'; document.getElementById('status').style.display='none'")
        views = json.loads(await c.ev(TRANS if SET == 'transition' else SITES_V if SET == 'sites' else TOWN_V if SET == 'town' else FIND))
        files = []
        for name, (x, z, yaw, pitch, fly) in views.items():
            if ONLY and name not in ONLY: continue
            args = json.dumps([x, z, yaw, pitch, fly, ARC.get(name, 0), 1.5 if SET == 'town' else 8, name])  # (8 m clear of trunks and walls, so no sprite fills the frame)
            where = await c.ev(PLACE.replace('ARGS', args))
            if not where or str(where).startswith('ERR'): print(seed, name, 'placement failed:', str(where)[:200]); continue  # never pass a stuck view off as a real one
            await asyncio.sleep(float(os.environ.get('WAIT', '6')))
            f = f'{OUT}/s{seed}_{name}.png'; await c.shot(f); files.append((name, f))
            info = await c.ev("(()=>{const r=__game.renderer().info.render,W=__game.Wild;return JSON.stringify({tri:r.triangles,calls:r.calls,chunks:W.chunks.size})})()")
            print(seed, name, where, info)
        allf = [(n, f'{OUT}/s{seed}_{n}.png') for n in views if os.path.exists(f'{OUT}/s{seed}_{n}.png')] # every view taken so far, in order
        if allf: sheet(allf, f'{OUT}/sheet_{"t" if SET == "transition" else "x" if SET == "sites" else "town" if SET == "town" else ""}s{seed}.jpg')
        print(seed, 'errors:', [e[:300] for e in c.errors()[:3]]); c.stop()
asyncio.run(main())
