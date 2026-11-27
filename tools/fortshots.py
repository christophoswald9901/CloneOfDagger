"""Photographs of Fort Merrow: python3 tools/fortshots.py OUTDIR [seed ...]  -> OUTDIR/s{seed}_{view}.png and OUTDIR/sheet_s{seed}.jpg
Views from the sea, from the land (the road in, the moat's bank), from the hillside behind the point, from the air, and inside
(the parade, the gate, the ramparts); also from the foreland to the east and from the rocky shore to the west. VIEWS=a,b takes only some; HOUR=h sets the time of day (default 11). The inside views are the same in
every world, so they are shot for the first seed only (ALL=1 shoots them for every seed)."""
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
OUT = sys.argv[1] if len(sys.argv) > 1 else 'tools/out/fort'
SEEDS = [int(a) for a in sys.argv[2:]] or [0]
ONLY = os.environ.get('VIEWS', '').split(',') if os.environ.get('VIEWS') else None
HOUR = float(os.environ.get('HOUR', '11'))

# each view: [name, (x, z) from the fort's middle, (tx, tz) looked at, eye height above the ground or the water (None: standing), target height,
#             optionally the height below which to stand on whatever is there (a walk or a deck; the target is then at that level plus its height)]
VIEWS = [
    ['sea_s', (40, 290), (0, 60), 3.0, 8],           # from a boat off the point (the game's haze hides much beyond 400 m)
    ['sea_e', (270, 130), (40, 30), 3.0, 8],           # from the east bay
    ['sea_w', (-280, 120), (-40, 20), 3.0, 8],       # from the west bay, the hill behind
    ['sea_close', (-60, 205), (-5, 60), 2.5, 8],    # rowing in close under the sea bastion
    ['sea_far', (420, 520), (0, 0), 6.0, 10],        # further out in the roadstead, at the edge of the haze
    ['sea_mid', (150, 330), (0, 70), 4.0, 8],        # standing off to the south-east, the hill behind
    ['land_road', (92, -330), (10, -120), None, 4],  # on the road in, the ravelin and the gate ahead
    ['land_glacis', (40, -168), (10, -110), None, 5],  # at the top of the glacis by the ravelin's bridge
    ['land_gate', (59, -176), (22, -126), None, 4],  # on the road, at the mouth of its cutting through the glacis, the barrier gate and the ravelin ahead
    ['land_bank', (124, -52), (40, -34), None, 6],   # on the covered way, across the moat at a bastion
    ['land_foreland', (372, 20), (60, 20), None, 5],    # on the foreland east of the fort, by the lagoon, looking back at it
    ['land_west', (-188, -112), (-178, 40), None, 2],    # on the rocky west shore under the hill, the glacis running down to the sea
    ['hill_side', (-150, -250), (0, -10), None, 4],  # on the hillside behind the point, looking down on the fort
    ['hill_top', (-182, -292), (0, 0), None, 4],    # on the hill's brow by the redoubt, looking past its bank to the fort
    ['hill_redoubt', (-172, -331), (-219, -298), None, 3],  # the redoubt, coming up the path
    ['air_ne', (300, -360), (0, 0), 200, 0],         # from the air
    ['air_top', (0, 60), (0, -20), 360, 0],          # nearly overhead
    ['air_se', (250, 300), (-40, -170), 170, 0],     # from over the sea: the fort, the hill and the hamlet behind
    ['land_hamlet', (70, -455), (58, -560), None, 4],  # on the road, coming to the hamlet from the fort
    ['in_parade', (0, 18), (0, -60), None, 6],       # on the parade, looking to the gate
    ['in_house', (0, -30), (0, 30), None, 6],        # from the gate, the governor's house at the end of the parade
    ['in_bastion', (0, 92), (0, 400), None, 4],      # on the sea bastion, by the flag, looking out to sea
    ['in_walk', (-30, -63.6), (40, -64.2), None, 1.6, 10.5], # on the rampart walk of the north curtain, looking east along it (standing on the walk's paving)
    ['in_gate', (0, -82), (0, -30), None, 5],        # on the bridge, the gate ahead
]
JS = r"""((V,H)=>{const g=__game,F=g.FORT,P=g.G.player; const [name,[u,v],[tu,tv],fly,th,feet]=V, x=F.x+u, z=F.z+v, tx=F.x+tu, tz=F.z+tv;
 g.G.time=H*60+g.G.time-(g.G.time%1440); g.G.weather='clear'; g.Wild.prime(x,z); let gy=g.terrainH(x,z); if(fly==null&&(gy<-0.5||feet)) gy=g.groundAt(g.G.area,x,z,0.3,feet||8); const base=Math.max(gy,-0.92); // (on a bridge: its deck)
 const ey=fly==null?gy+1.6:base+fly, ty=(feet?gy:g.terrainH(tx,tz))+th; P.pos.set(x,fly==null?gy:base+fly,z); P.yaw=Math.atan2(-(tx-x),-(tz-z)); P.pitch=Math.atan2(ty-ey,Math.hypot(tx-x,tz-z));
 if(fly!=null){g.settings.dbgFly=true; g.setFlying(true);} else {g.settings.dbgFly=false; g.setFlying(false);} return JSON.stringify({x:Math.round(x),z:Math.round(z),gy:+gy.toFixed(1)});})"""

async def main():
    from PIL import Image, ImageDraw
    os.makedirs(OUT, exist_ok=True)
    for seed in SEEDS:
        c = CDP()
        if not await c.boot(f'http://127.0.0.1:8765/index.html?seed={seed}', timeout=240): print('boot failed'); c.stop(); return
        await c.new_game(); await asyncio.sleep(1)
        await c.ev("document.getElementById('msgs').style.display='none'; document.getElementById('hint').style.display='none'")
        shots = []
        for V in VIEWS:
            if ONLY and V[0] not in ONLY: continue
            if seed != SEEDS[0] and V[0].startswith('in_') and not os.environ.get('ALL'): continue  # (inside, the fort is the same in every world: only the first seed is shot there unless ALL=1)
            r = await c.ev(JS + '(' + json.dumps(V) + ',' + str(HOUR) + ')')
            await asyncio.sleep(float(os.environ.get('WAIT', '9')))  # (the ground near a cliff can take this long to stream in)
            f = f'{OUT}/s{seed}_{V[0]}.png'; await c.shot(f); shots.append((V[0], f)); print(seed, V[0], r)
        errs = [e for e in c.errors() if 'render failed once' not in e]
        for e in errs[:5]: print('ERR', e[:300])
        c.stop()
        if shots:  # a labelled contact sheet
            ims = [Image.open(f).convert('RGB') for _, f in shots]; w, h = 784, 400; cols = 2; rows = (len(ims) + 1) // 2
            sheet = Image.new('RGB', (w * cols, h * rows), (20, 20, 20)); d = ImageDraw.Draw(sheet)
            for k, ((nm, _), im) in enumerate(zip(shots, ims)):
                im = im.resize((w, h)); sheet.paste(im, ((k % cols) * w, (k // cols) * h)); d.rectangle([(k % cols) * w, (k // cols) * h, (k % cols) * w + 150, (k // cols) * h + 18], fill=(0, 0, 0)); d.text(((k % cols) * w + 4, (k // cols) * h + 3), f's{seed} {nm}', fill=(255, 255, 255))
            sheet.save(f'{OUT}/sheet_s{seed}.jpg', quality=88)
asyncio.run(main())
