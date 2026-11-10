"""Plans of the generated country from above: the lie of the land, and what covers it.
python3 tools/landmap.py OUTDIR [seed ...]   -> OUTDIR/land_s{seed}.png (left: landform, right: cover)
REGION=x0,z0,x1,z1,step                        -> another window (default: the whole country at 40 m a pixel)
Left:  red = open hilltop (expo), blue = wet, green = valley floor, brightness = height; valley sides hatched darker.
Right: dark green woods, yellow farmland, purple heath, blue rivers, grey rock, pale green open grass (shaded by height)."""
import asyncio, sys, os, base64
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
OUT = sys.argv[1] if len(sys.argv) > 1 else 'tools/out/land'
SEEDS = [int(a) for a in sys.argv[2:]] or [0]
REGION = os.environ.get('REGION', '-10000,-18000,10000,2000,40')
JS = r"""(()=>{const g=__game,[X0,Z0,X1,Z1,S]=[REGION],W=Math.round((X1-X0)/S),Hh=Math.round((Z1-Z0)/S),c=document.createElement('canvas');c.width=W*2+4;c.height=Hh;
 const x=c.getContext('2d'),im=x.createImageData(W*2+4,Hh),d=im.data,fm=g.G.city.forestMask,t0=performance.now();
 const riv=new Uint8Array(W*Hh); for(const R of g.LAND.rivers)for(let q=0;q<R.P.length;q++){const i=Math.floor((R.P[q][0]-X0)/S),j=Math.floor((R.P[q][1]-Z0)/S); if(i>=0&&j>=0&&i<W&&j<Hh&&R.w[q]>2)riv[j*W+i]=1;}
 let n={wood:0,cult:0,heath:0,land:0};
 for(let j=0;j<Hh;j++)for(let i=0;i<W;i++){const wx=X0+(i+0.5)*S,wz=Z0+(j+0.5)*S,h=g.terrainRaw(wx,wz),L=g.landAt(wx,wz),sea=h<0.2;
  const put=(o,r,gg,b)=>{const k=(j*(W*2+4)+i+o)*4;d[k]=r;d[k+1]=gg;d[k+2]=b;d[k+3]=255;};
  if(sea){put(0,40,60,90);put(W+4,40,60,90);continue;}
  const sh=0.45+0.55*Math.min(1,h/260), sd=1-0.35*L.side;
  put(0,255*sd*(0.25*sh+0.75*L.expo),255*sd*(0.3*sh+0.6*L.floor),255*sd*(0.25*sh+0.75*L.wet));
  const inSq=Math.abs(wx)<600&&Math.abs(wz)<600, m=fm(wx,wz,h),cu=g.wildCult(wx,wz),he=g.wildHeath(wx,wz,h); n.land++;
  let r=150,gg=185,b=110; const k2=0.7+0.3*Math.min(1,h/260); r*=k2;gg*=k2;b*=k2;
  if(h>330){r=235;gg=235;b=240;} else if(L.sl>0.75){r=128;gg=124;b=118;}
  else if(m>0.3){r=30;gg=78;b=38;n.wood++;} else if(cu>0.35){r=214;gg=196;b=96;n.cult++;} else if(he>0.45){r=150;gg=96;b=140;n.heath++;}
  if(riv[j*W+i]){r=40;gg=90;b=220;} if(inSq){r=90;gg=90;b=90;}
  put(W+4,r,gg,b);}
 x.putImageData(im,0,0); return JSON.stringify({ms:Math.round(performance.now()-t0),land:g.LAND.ms,wood:(n.wood/n.land).toFixed(3),cult:(n.cult/n.land).toFixed(3),heath:(n.heath/n.land).toFixed(3),png:c.toDataURL('image/png')});})()"""
async def main():
    import json
    os.makedirs(OUT, exist_ok=True)
    for seed in SEEDS:
        c = CDP()
        if not await c.boot(f'http://127.0.0.1:8765/index.html?seed={seed}'): print('boot failed', c.errors()[:2]); c.stop(); return
        r = await c.ev(JS.replace('[REGION]', '[' + REGION + ']'))
        try: o = json.loads(r)
        except Exception: print(seed, 'failed:', str(r)[:400]); c.stop(); continue
        open(f'{OUT}/land_s{seed}.png', 'wb').write(base64.b64decode(o.pop('png').split(',')[1]))
        print(seed, o, [e[:200] for e in c.errors()[:3]]); c.stop()
asyncio.run(main())
