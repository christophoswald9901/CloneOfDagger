"""Check the generated world for the mistakes that used to be found only by eye, over many seeds, without rendering anything.
python3 tools/invariants.py                  -> world seeds 0-5 (?seed=N) and town seeds 0-3 (?townseed=N)
python3 tools/invariants.py --world 0-19 --town 0-9
python3 tools/invariants.py --world 7 --town none -v   (-v: every check, with up to 3 examples each, not only the failures)
Each check counts its failures; a few allow a small share (see LIMIT). Exit code 1 if any check fails on any seed.
The checks read the plan data (rivers, tracks, bridges, places, landmark solids, the road network, the town's lots,
blocks, streets and gates); see CHECKS below for what each one means."""
import asyncio, json, os, sys, time
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP, HTTP_PORT

CHECKS = r"""(()=>{const g=__game,W=g.Wild,L=g.LAND,SEA=-0.8,out=[];
 const H=(x,z)=>g.terrainRaw(x,z), r1=v=>Math.round(v), at=(x,z)=>[r1(x),r1(z)];
 const check=(name,what,n,fn)=>{const ex=[];let bad=0; try{ fn((e)=>{bad++; if(ex.length<3) ex.push(e);}); }catch(e){ bad=-1; ex.push('ERROR '+e.message); } out.push({name,what,n:typeof n==='function'?n():n,bad,ex});};
 const segD=(px,pz,ax,az,bx,bz)=>{const dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz||1e-9,t=Math.max(0,Math.min(1,((px-ax)*dx+(pz-az)*dz)/l2));return Math.hypot(px-ax-dx*t,pz-az-dz*t);};
 const inObb=(o,x,z,m=0)=>{const dx=x-o.x,dz=z-o.z;return Math.abs(dx*o.c-dz*o.s)<o.hx+m&&Math.abs(dx*o.s+dz*o.c)<o.hz+m;};
 const obbD=(o,x,z)=>{const dx=x-o.x,dz=z-o.z,lx=dx*o.c-dz*o.s,lz=dx*o.s+dz*o.c;return Math.hypot(Math.max(0,Math.abs(lx)-o.hx),Math.max(0,Math.abs(lz)-o.hz));};
 const sat=(a,b,pad)=>{const dx=b.x-a.x,dz=b.z-a.z;for(const [ux,uz] of [[a.c,-a.s],[a.s,a.c],[b.c,-b.s],[b.s,b.c]]){const ra=(a.hx+pad)*Math.abs(a.c*ux-a.s*uz)+(a.hz+pad)*Math.abs(a.s*ux+a.c*uz),rb=(b.hx+pad)*Math.abs(b.c*ux-b.s*uz)+(b.hz+pad)*Math.abs(b.s*ux+b.c*uz);if(Math.abs(dx*ux+dz*uz)>ra+rb)return false;}return true;};
 const R=L.rivers, T=W.tracks, TN=g.TOWNS;

 /* ---- rivers ---- */
 check('rivers.downhill','the water level never rises downstream (by more than 5 cm)',()=>R.length,bad=>{for(const r of R){for(let q=1;q<r.wl.length;q++) if(r.wl[q]>r.wl[q-1]+0.05){bad({at:at(...r.P[q]),rise:+(r.wl[q]-r.wl[q-1]).toFixed(2),hand:!!r.hand});break;}}});
 check('rivers.reach','every river ends in the sea or in another river',()=>R.length,bad=>{R.forEach((r,i)=>{const [x,z]=r.P[r.P.length-1];
   if(r.end==='sea'){ if(!(H(x,z)<SEA+2.5||g.coastZ(x)-z<80)) bad({river:i,end:at(x,z),ground:+H(x,z).toFixed(1)}); }
   else { let d=1e9; R.forEach((o,j)=>{if(j===i)return; for(let q=1;q<o.P.length;q++) d=Math.min(d,segD(x,z,...o.P[q-1],...o.P[q])-o.w[q]/2);}); if(d>6) bad({river:i,end:at(x,z),gap:r1(d)}); } });}); /* (a tributary ends at its parent's bank, within the channel the ground chunks cut) */
 { let n=0; check('rivers.trench','a river runs in its valley: the ground chunks never cut more than 6 m down to its water (a trench through a hill)',()=>n,bad=>{R.forEach((r,i)=>{let last=-99; for(let q=2;q<r.P.length-2;q+=4){n++; const [x,z]=r.P[q], cut=H(x,z)-r.wl[q]; if(cut>6&&q-last>40){last=q; bad({river:i,at:at(x,z),cut:+cut.toFixed(1),hand:!!r.hand});}}});}); }

 /* ---- tracks and bridges ---- */
 const onBridge=(ti,q)=>W.bridges.some(b=>b.ti===ti&&Math.abs(b.q-q)*3<b.half+9);
 { let n=0; check('tracks.dry','no track runs into the sea, a lake or a river too wide to ford (5 m; the game fords under 4.5 m) except on its bridges',()=>n,bad=>{T.forEach((t,ti)=>{let last=-99; for(let q=0;q<t.length;q+=2){n++; const [x,z]=t[q]; if(onBridge(ti,q)) continue;
   const h=H(x,z), rv=g.riverNear(x,z,30), deep=rv&&rv.d<rv.w/2-0.5&&rv.w>=5, wet=h<SEA+0.2||g.hallWet(x,z)||deep; if(wet&&q-last>20){last=q; bad({track:ti,site:t.site||null,at:at(x,z),ground:+h.toFixed(1),river:rv?r1(rv.w):0});}}});}); }
 { let n=0; check('tracks.walls','no track runs inside a town wall',()=>n,bad=>{T.forEach((t,ti)=>{for(let q=0;q<t.length;q+=2){n++; const [x,z]=t[q]; for(const Tn of TN) if(Tn.inside(x,z,-2)){bad({track:ti,site:t.site||null,at:at(x,z)}); q=1e9; break;}}});}); }
 { let n=0; check('tracks.solids','no track runs through a landmark building, wall or monument',()=>n,bad=>{const C=g.Sites.cols; T.forEach((t,ti)=>{for(let q=0;q<t.length;q+=2){n++; const [x,z]=t[q], h=H(x,z);
   for(const c of C){ if(x<c.x0-1||x>c.x1+1||z<c.z0-1||z>c.z1+1||c.y1<h+0.5) continue; if(c.o?inObb(c.o,x,z,0.3):true){bad({track:ti,site:t.site||null,at:at(x,z),solidTop:+(c.y1-h).toFixed(1)}); q=1e9; break;} }}});}); }
 check('bridges.clear','every bridge deck stands at least 1 m above its river',()=>W.bridges.length,bad=>{for(const b of W.bridges) if(b.deck<b.wl+1) bad({at:at(b.x,b.z),deck:+(b.deck-b.wl).toFixed(2)});});

 /* ---- places, farmsteads, landmarks ---- */
 const P=g.POI.list;
 check('places.ground','no place stands in the sea, in a river, inside a town or in a landmark\'s fixed ground',()=>P.length,bad=>{for(const p of P){const h=H(p.x,p.z), rv=g.riverNear(p.x,p.z,p.r+2), tw=TN.some(Tn=>Tn.inside(p.x,p.z,30));
   if(h<SEA+1||(rv&&rv.d<rv.w/2+2)||tw||g.siteWeight(p.x,p.z)>0.5) bad({kind:p.kind,at:at(p.x,p.z),ground:+h.toFixed(1),river:!!rv,town:tw,site:+g.siteWeight(p.x,p.z).toFixed(2)});}});
 check('places.apart','no two places overlap',()=>P.length,bad=>{for(let i=0;i<P.length;i++) for(let j=i+1;j<P.length;j++){const a=P[i],b=P[j],d=Math.hypot(a.x-b.x,a.z-b.z); if(d<(a.r+b.r)*0.6) bad({a:a.kind,b:b.kind,at:at(a.x,a.z),d:r1(d)});}});
 check('farms.ground','every farmstead at a track\'s end stands on dry land, outside town walls and the landmarks\' wild ground',()=>W.endFarms.length,bad=>{for(const f of W.endFarms){const h=H(f.x,f.z),rv=g.riverNear(f.x,f.z,25),tw=TN.some(Tn=>Tn.inside(f.x,f.z,20));
   if(h<SEA+2||(rv&&rv.d<rv.w/2+6)||tw||g.siteWild(f.x,f.z)>0.3) bad({at:at(f.x,f.z),ground:+h.toFixed(1),river:!!rv,town:tw});}});
 check('sites.roads','every landmark has a road of its own that joins the tracks',()=>g.SITES.length,bad=>{for(const S of g.SITES){const t=T[S.track]; if(!t||t.length<3) bad({site:S.id,track:S.track});}});

 /* ---- the road network (fast travel by road) ---- */
 { g.Travel.graph=null; g.Travel.buildGraph(); const G2=g.Travel.graph, N=G2.X.length, seen=new Uint8Array(N), st=[0]; seen[0]=1; while(st.length){const i=st.pop(); for(const j of G2.A[i]) if(!seen[j]){seen[j]=1; st.push(j);}}
   const reach=(x,z,r=90)=>{const k=G2.near(x,z,r); return k>=0&&seen[k]===1;};
   const goals=[...g.SITES.map(S=>['site '+S.id,...S.road[0]]),...T.map((t,ti)=>['track '+ti+' end',...t[t.length-1]]),...W.endFarms.map((f,k)=>['farm '+k,f.x,f.z]),...TN.flatMap(Tn=>Tn.gates.map(gt=>[Tn.id+' '+gt.id+' gate',gt.x,gt.z]))];
   check('roads.connected','every landmark, track end, farmstead and town gate can be reached by road from Aldhaven',goals.length,bad=>{for(const [nm,x,z] of goals) if(!reach(x,z)) bad({goal:nm,at:at(x,z)});}); }

 /* ---- the towns ---- */
 for(const Tn of TN){ const C=Tn.cfg, id=Tn.id, lots=Tn.lots, Wc=C.wall, wp=Tn.wallPieces();
   check(id+'.towers','no wall tower stands in a gateway',()=>wp.towers.length,bad=>{for(const t of wp.towers) for(const gt of Tn.gates){const d=Math.hypot(gt.u-t.u,gt.v-t.v); if(d<Wc.gateW/2+Wc.tower/2+3) bad({gate:gt.id,at:at(...Tn.w(t.u,t.v)),d:+d.toFixed(1)});}});
   const LH=new Map(), CEL=24, key=(x,z)=>Math.floor(x/CEL)*100003+Math.floor(z/CEL); lots.forEach((l,i)=>{const k=key(l.o.x,l.o.z); if(!LH.has(k)) LH.set(k,[]); LH.get(k).push(i);});
   const near=(x,z)=>{const r=[]; for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const l=LH.get((Math.floor(x/CEL)+a)*100003+Math.floor(z/CEL)+b); if(l) r.push(...l);} return r;};
   check(id+'.lots.overlap','no two house plots overlap (by more than 0.12 m)',lots.length,bad=>{lots.forEach((a,i)=>{for(const j of near(a.o.x,a.o.z)) if(j>i&&sat(a.o,lots[j].o,-0.12)) bad({at:at(a.o.x,a.o.z),kinds:[a.kind,lots[j].kind]});});});
   const SW=Tn.streets.map(s=>{const [ax,az]=Tn.w(s.u0,s.v0),[bx,bz]=Tn.w(s.u1,s.v1); return {ax,az,bx,bz,w:s.w,s};});
   const SR=[...SW]; { const S=g.SITES.find(S=>S.id===id); for(const rd of (S&&S.roads)||[]) for(let q=1;q<rd.length;q++) SR.push({ax:rd[q-1][0],az:rd[q-1][1],bx:rd[q][0],bz:rd[q][1],w:6,s:{road:true}}); } /* (the suburbs face the roads out of the gates) */
   { let n=0; check(id+'.lots.streets','no house plot reaches into a street (by more than 0.5 m)',()=>n,bad=>{const hit=new Set(); for(const S of SW){const L2=Math.hypot(S.bx-S.ax,S.bz-S.az), k=Math.max(1,Math.ceil(L2/1.5));
     for(let q=0;q<=k;q++){n++; const x=S.ax+(S.bx-S.ax)*q/k, z=S.az+(S.bz-S.az)*q/k; for(const i of near(x,z)){ if(hit.has(i)) continue; const o=lots[i].o; if(obbD(o,x,z)<S.w/2-0.5){hit.add(i); bad({at:at(o.x,o.z),street:S.s.main?'main':S.s.quay?'quay':S.s.esplanade?'esplanade':'street',w:S.w});}}}}}); }
   { const cn=Tn.canal.map(p=>Tn.w(p[0],p[1])), CW=C.canal.w; let n=0; check(id+'.lots.canal','no house plot stands in the canal',()=>n,bad=>{const hit=new Set(); for(let k=1;k<cn.length;k++){const [ax,az]=cn[k-1],[bx,bz]=cn[k],L2=Math.hypot(bx-ax,bz-az),m=Math.ceil(L2/2);
     for(let q=0;q<=m;q++){n++; const x=ax+(bx-ax)*q/m, z=az+(bz-az)*q/m; for(const i of near(x,z)){ if(hit.has(i)) continue; if(obbD(lots[i].o,x,z)<CW/2-0.3){hit.add(i); bad({at:at(lots[i].o.x,lots[i].o.z)});}}}}}); }
   check(id+'.doors','every front door opens onto a street, a quay, a square, a paved forecourt or a gate road (front gardens up to 6 m deep); at most 1% may not',lots.length,bad=>{const open=[...Tn.blocks.filter(b=>b.use!=='lots'&&b.poly),...(Tn.gateSquares||[]).map(poly=>({poly})),...(Tn.aprons||[]).map(poly=>({poly}))]; /* (squares, places, landmarks' forecourts and the little squares inside the gates) */ for(const l of lots){const d=Tn.doorOf(l), [u,v]=Tn.local(d.x,d.z);
     let ok=SR.some(S=>segD(d.x,d.z,S.ax,S.az,S.bx,S.bz)<S.w/2+6); if(!ok) ok=open.some(b=>{let ins=false; const P2=b.poly; for(let i=0,j=P2.length-1;i<P2.length;j=i++){const [ui,vi]=P2[i],[uj,vj]=P2[j]; if((vi>v)!==(vj>v)&&u<(uj-ui)*(v-vi)/(vj-vi)+ui) ins=!ins;} return ins;});
     if(!ok) bad({at:at(d.x,d.z),kind:l.kind,type:l.type});}});
   check(id+'.blocks.size','no block of houses is longer than 150 m on a side (the 360 m stamp)',()=>Tn.blocks.filter(b=>b.use==='lots').length,bad=>{for(const b of Tn.blocks){ if(b.use!=='lots'||!b.poly) continue; const us=b.poly.map(p=>p[0]),vs=b.poly.map(p=>p[1]),s=Math.max(Math.max(...us)-Math.min(...us),Math.max(...vs)-Math.min(...vs)); if(s>150) bad({at:at(...Tn.w(b.uc,b.vc)),side:r1(s)});}});
   { const N=Tn.nodes.length, seen=new Uint8Array(N), st=[Tn.gates[0].node]; seen[st[0]]=1; while(st.length){const i=st.pop(); for(const j of Tn.nodes[i].n) if(!seen[j]){seen[j]=1; st.push(j);}}
     check(id+'.streets.connected','every street junction can be reached from the first gate',N,bad=>{const left=[]; Tn.nodes.forEach((nd,i)=>{if(!seen[i]) left.push(nd);}); if(left.length) bad({unreached:left.length,at:at(left[0].x,left[0].z)});}); }
   { const cn=Tn.canal; const cross=(s)=>{for(let k=1;k<cn.length;k++){const [ax,av]=cn[k-1],[bx,bv]=cn[k]; const d=(s.u1-s.u0)*(bv-av)-(s.v1-s.v0)*(bx-ax); if(Math.abs(d)<1e-9) continue; const t=((ax-s.u0)*(bv-av)-(av-s.v0)*(bx-ax))/d, w=((ax-s.u0)*(s.v1-s.v0)-(av-s.v0)*(s.u1-s.u0))/d; if(t>0&&t<1&&w>=0&&w<=1) return [s.u0+(s.u1-s.u0)*t,s.v0+(s.v1-s.v0)*t];} return null;};
     check(id+'.canal.bridges','every street that crosses the canal has a bridge there',()=>Tn.streets.length,bad=>{for(const s of Tn.streets){ if(s.quay) continue; const p=cross(s); if(!p) continue; if(!Tn.bridges.some(b=>Math.hypot(b.u-p[0],b.v-p[1])<12)) bad({at:at(...Tn.w(p[0],p[1])),main:!!s.main});}}); }
 }
 return JSON.stringify(out);})()"""

# checks that may fail on a small share of what they look at (a share of n); every other check allows none
LIMIT = {'corrinvale.doors': 0.01}

def seeds(arg):
    if arg in ('none', ''): return []
    out = []
    for part in arg.split(','):
        a, _, b = part.partition('-'); out += list(range(int(a), int(b) + 1)) if b else [int(a)]
    return out

async def main():
    args = sys.argv[1:]; verbose = '-v' in args; args = [a for a in args if a != '-v']
    opt = dict(zip(args[::2], args[1::2]))
    runs = [('world', s, f'?seed={s}') for s in seeds(opt.get('--world', '0-5'))] + [('town', s, f'?seed=0&townseed={s}') for s in seeds(opt.get('--town', '0-3'))]
    port = HTTP_PORT
    c = CDP(int(os.environ.get('CDP_PORT', '9431'))); failed = []; started = False
    for kind, s, q in runs:
        url = f'http://127.0.0.1:{port}/index.html{q}'; t0 = time.time()
        if not started: ok = await c.boot(url.replace(f':{port}/', ':8765/'), w=320, h=200, timeout=150); started = True
        else:
            await c.send('Page.navigate', url=url); ok = False
            for _ in range(150):
                await asyncio.sleep(1)
                if await c.ev(f"!!(window.__game && __game.G.city && location.search === {json.dumps(q)})"): ok = True; break
        if not ok: print(f'{kind} {s}: boot failed', c.errors()[:2]); failed.append((kind, s, 'boot')); continue
        res = await c.ev(CHECKS)
        if not isinstance(res, str) or res.startswith('ERR'): print(f'{kind} {s}: checks crashed', str(res)[:600]); failed.append((kind, s, 'crash')); continue
        res = json.loads(res); bad = []
        for r in res:
            lim = LIMIT.get(r['name'], 0); fail = r['bad'] < 0 or r['bad'] > lim * max(1, r['n'])
            if fail: bad.append(r); failed.append((kind, s, r['name']))
            if fail or verbose:
                print(f"  {'FAIL' if fail else 'ok  '} {kind} {s} {r['name']}: {r['bad']} of {r['n']}" + (f" (allowed {lim:.0%})" if lim else '') + (f"  e.g. {json.dumps(r['ex'])[:400]}" if r['ex'] else ''))
        print(f'{kind} seed {s}: {len(res) - len(bad)}/{len(res)} checks pass ({time.time() - t0:.0f} s)')
    errs = [e for e in c.errors() if 'render failed once' not in e]
    if errs: print('page errors:', [e[:200] for e in errs[:3]])
    c.stop()
    print(f'\n{len(runs)} seeds, {len(failed)} failures' + (':' if failed else '.'))
    for f in failed: print('  ', *f)
    sys.exit(1 if failed else 0)
asyncio.run(main())
