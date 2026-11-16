"""Plans of the generated country from above: the lie of the land, and what covers it.
python3 tools/landmap.py OUTDIR [seed ...]   -> OUTDIR/land_s{seed}.png (left: landform, middle: cover, right: the regions, with the countries' lattice in white over them)
REGION=x0,z0,x1,z1,step                        -> another window (default: the home country at 40 m a pixel); every country it
                                                  touches is planned first, e.g. REGION=-30000,-38000,30000,2000,80 for the home country
                                                  and the ring of countries round it. Borders are drawn as thin black lines, the passes
                                                  as white squares and the river gaps as cyan squares.
Left:  red = open hilltop (expo), blue = wet, green = valley floor, brightness = height; valley sides hatched darker.
Right: dark green woods, yellow farmland, purple heath, blue rivers, grey rock, pale green open grass (shaded by height).
Over the right panel, the settlement plan: field blocks (tan: ploughed, olive: pasture), high roads (yellow), tracks (brown), lanes (white),
green lanes (pale green), hollow ways (magenta),
farmsteads (orange dots), hamlets (small red rings) and villages (large red rings with their names)."""
import asyncio, sys, os, base64
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
OUT = sys.argv[1] if len(sys.argv) > 1 else 'tools/out/land'
SEEDS = [int(a) for a in sys.argv[2:]] or [0]
REGION = os.environ.get('REGION', '-10000,-18000,10000,2000,40')
JS = r"""(()=>{const g=__game,[X0,Z0,X1,Z1,S]=[REGION],W=Math.round((X1-X0)/S),Hh=Math.round((Z1-Z0)/S),c=document.createElement('canvas');c.width=W*3+8;c.height=Hh;
 g.World.DROP=1e12; const tp=performance.now(), planned=g.World.planBox(X0,Z0,X1-1,Z1-1), planMs=Math.round(performance.now()-tp);
 const x=c.getContext('2d'),im=x.createImageData(W*3+8,Hh),d=im.data,fm=g.G.city.forestMask,t0=performance.now();
 const riv=new Uint8Array(W*Hh); for(const R of g.Wild.rivers)for(let q=0;q<R.P.length;q++){const i=Math.floor((R.P[q][0]-X0)/S),j=Math.floor((R.P[q][1]-Z0)/S); if(i>=0&&j>=0&&i<W&&j<Hh&&R.w[q]>2)riv[j*W+i]=1;}
 let n={wood:0,cult:0,heath:0,land:0}; const nr=[0,0,0,0,0];
 for(let j=0;j<Hh;j++)for(let i=0;i<W;i++){const wx=X0+(i+0.5)*S,wz=Z0+(j+0.5)*S,h=g.terrainRaw(wx,wz),L=g.landAt(wx,wz),sea=h<0.2;
  const put=(o,r,gg,b)=>{const k=(j*(W*3+8)+i+o)*4;d[k]=r;d[k+1]=gg;d[k+2]=b;d[k+3]=255;};
  if(sea){put(0,40,60,90);put(W+4,40,60,90);put(2*W+8,40,60,90);continue;}
  const sh=0.45+0.55*Math.min(1,h/260), sd=1-0.35*L.side;
  put(0,255*sd*(0.25*sh+0.75*L.expo),255*sd*(0.3*sh+0.6*L.floor),255*sd*(0.25*sh+0.75*L.wet));
  const inSq=Math.abs(wx)<600&&Math.abs(wz)<600, m=fm(wx,wz,h),cu=g.wildCult(wx,wz),he=g.wildHeath(wx,wz,h); n.land++;
  let r=150,gg=185,b=110; const k2=0.7+0.3*Math.min(1,h/260); r*=k2;gg*=k2;b*=k2;
  if(h>330){r=235;gg=235;b=240;} else if(L.sl>0.75){r=128;gg=124;b=118;}
  else if(m>0.3){r=30;gg=78;b=38;n.wood++;} else if(cu>0.35){r=214;gg=196;b=96;n.cult++;} else if(he>0.45){r=150;gg=96;b=140;n.heath++;}
  if(riv[j*W+i]){r=40;gg=90;b=220;} if(inSq){r=90;gg=90;b=90;}
  put(W+4,r,gg,b);
  { const w=g.regionW(wx,wz),RC=[[224,150,96],[236,226,150],[70,150,190],[150,100,150],[60,130,70]]; let cr=0,cg=0,cb=0; if(!w){[cr,cg,cb]=RC[0];} else for(let q=0;q<5;q++){cr+=w[q]*RC[q][0];cg+=w[q]*RC[q][1];cb+=w[q]*RC[q][2];}
    const e=3*S,sl=(g.terrainRaw(wx+e,wz+e)-g.terrainRaw(wx-e,wz-e))/(2*e),k3=Math.max(0.55,Math.min(1.3,1-sl*2.2)); if(h>330){cr=cg=cb=235;} if(riv[j*W+i]){cr=40;cg=90;cb=220;} else if(g.mereAt(wx,wz)>0.4){cr=30;cg=70;cb=200;}
    put(2*W+8,cr*k3,cg*k3,cb*k3); const kk=w?g.regionKind(wx,wz):0; nr[kk]++; }}
 x.putImageData(im,0,0);
 x.save();x.beginPath();x.rect(W+4,0,W,Hh);x.clip(); const S2=g.Settle,PX=wx=>W+4+(wx-X0)/S,PZ=wz=>(wz-Z0)/S; x.lineWidth=1;
 for(const o of S2.blocks){const cs=g.obbCorners(o);x.fillStyle=o.past?'rgba(120,140,60,0.75)':'rgba(205,170,90,0.85)';x.strokeStyle='rgba(60,50,30,0.6)';x.beginPath();cs.forEach(([a,b],q)=>q?x.lineTo(PX(a),PZ(b)):x.moveTo(PX(a),PZ(b)));x.closePath();x.fill();if(S<=15)x.stroke();}
 const WS=[['#6a3c14',2],['#ffe000',3.5],['rgba(255,255,255,0.9)',1],['#9fff9f',1]];
 for(const T of g.Wild.tracks){for(let q=1;q<T.length;q++){const k=T.cls?T.cls[q]:(T.lane?2:0),[c,w]=WS[k];x.strokeStyle=(T.sink&&T.sink[q]>0.6)?'#ff40ff':c;x.lineWidth=w;x.beginPath();x.moveTo(PX(T[q-1][0]),PZ(T[q-1][1]));x.lineTo(PX(T[q][0]),PZ(T[q][1]));x.stroke();}}
 for(const f of S2.farms){x.fillStyle='#ff8a00';x.fillRect(PX(f.x)-2,PZ(f.z)-2,4,4);}
 x.font='bold 11px sans-serif';for(const V of S2.list){const r=V.kind==='village'?7:4;x.strokeStyle='#e01010';x.lineWidth=2;x.beginPath();x.arc(PX(V.x),PZ(V.z),r,0,7);x.stroke();if(V.kind==='village'){x.fillStyle='#fff';x.fillText(V.name,PX(V.x)+9,PZ(V.z)+4);}}
 for(const K of g.World.list){x.strokeStyle='rgba(0,0,0,0.55)';x.lineWidth=1;x.strokeRect(PX(K.x0),PZ(K.z0),(K.x1-K.x0)/S,(K.z1-K.z0)/S);
  if(K.ways)for(const P of K.ways.passes()){x.fillStyle='#fff';x.fillRect(PX(P.x)-3,PZ(P.z)-3,6,6);}}
 for(const f of g.EDGES.values())if(f.gap===f.gap){const px=f.vert?-10000+f.n*10000:f.gap,pz=f.vert?f.gap:-18000+f.n*10000;x.fillStyle='#00ffff';x.fillRect(PX(px)-3,PZ(pz)-3,6,6);}
 x.restore();
 // the third panel: the regions, with the lattice of the countries drawn over them (white lines; the home country's box thick)
 { const O=2*W+8,PX3=wx=>O+(wx-X0)/S; x.save();x.beginPath();x.rect(O,0,W,Hh);x.clip(); x.strokeStyle='rgba(255,255,255,0.95)'; x.lineWidth=1.5;
   for(let lx=-10000+Math.ceil((X0+10000)/10000)*10000;lx<=X1;lx+=10000){x.beginPath();x.moveTo(PX3(lx),0);x.lineTo(PX3(lx),Hh);x.stroke();}
   for(let lz=-18000+Math.ceil((Z0+18000)/10000)*10000;lz<=Math.min(Z1,-8000);lz+=10000){x.beginPath();x.moveTo(O,(lz-Z0)/S);x.lineTo(O+W,(lz-Z0)/S);x.stroke();}
   x.strokeStyle='#000';x.lineWidth=3;x.strokeRect(PX3(-10000),(-18000-Z0)/S,20000/S,20000/S);
   for(const V of S2.list){x.fillStyle=V.kind==='village'?'#e01010':'#701010';const r=V.kind==='village'?3:2;x.fillRect(PX3(V.x)-r,PZ(V.z)-r,2*r,2*r);}
   x.font='bold 13px sans-serif'; g.RG_KEYS.forEach((k,q)=>{x.fillStyle=['#e09660','#ece296','#4696be','#966496','#3c8246'][q];x.fillRect(O+8,8+q*18,14,14);x.strokeStyle='#000';x.lineWidth=1;x.strokeRect(O+8,8+q*18,14,14);x.fillStyle='#000';x.fillText(k,O+27,20+q*18);x.fillStyle='#fff';x.fillText(k,O+26,19+q*18);}); x.restore(); }
 return JSON.stringify({regions:Object.fromEntries(g.RG_KEYS.map((k,q)=>[k,+(nr[q]/n.land).toFixed(3)])),planned,planMs,planCpu:g.World.planMs,worstStep:Math.round(g.World.worstStep||0),villages:S2.list.filter(v=>v.kind==='village').length,hamlets:S2.list.filter(v=>v.kind==='hamlet').length,farms:S2.farms.length,lanes:S2.lanes.length,blocks:S2.blocks.length,settleMs:S2.ms,ways:S2.wayKm,milestones:(S2.milestones||[]).length,laneMs:Math.round(g.Wild.laneMs||0),ms:Math.round(performance.now()-t0),land:g.LAND.ms,wood:(n.wood/n.land).toFixed(3),cult:(n.cult/n.land).toFixed(3),heath:(n.heath/n.land).toFixed(3),png:c.toDataURL('image/png')});})()"""
async def main():
    import json
    os.makedirs(OUT, exist_ok=True)
    for seed in SEEDS:
        c = CDP()
        if not await c.boot(f'http://127.0.0.1:8765/index.html?seed={seed}', timeout=240): print('boot failed', c.errors()[:2]); c.stop(); return
        r = await c.ev(JS.replace('[REGION]', '[' + REGION + ']'))
        try: o = json.loads(r)
        except Exception: print(seed, 'failed:', str(r)[:400]); c.stop(); continue
        open(f'{OUT}/land_s{seed}.png', 'wb').write(base64.b64decode(o.pop('png').split(',')[1]))
        print(seed, o, [e[:200] for e in c.errors()[:3]]); c.stop()
asyncio.run(main())
