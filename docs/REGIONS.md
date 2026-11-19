# Regions: design notes and state

Branch `claude/regions-fdccef`, cut from `claude/endless-world-ce1a5e` (PR 3). Written 2026-11-16. The work stopped early because the weekly model limit was nearly used up, so read "Not done or not verified" before relying on it.

## Design
- **One field** (`src/03_regions.js`). `regionW(x, z)` gives the weights of five kinds of country at a point: heart (the home country's own character), downs, fen, moor, weald. It is a function of position alone, so every country's plan reads the same answer and neighbours agree at their borders without knowing each other.
- **How the field is made** (`regionRaw`). A cellular field: a lattice of 5.6 km cells turned 0.47 rad against the countries' lattice, each cell's middle jittered, the input position warped by up to about 950 m. A cell's kind is drawn by hash from `REGION.share`. Cells of the same kind that touch run together, so regions come out at one to a few cells across (roughly 15 to 60 minutes' walk), irregular.
- **Edges.** Weights blend between cells. The breadth of the blend is the mean of the kinds' own breadths (`REGION.edge`): about 1.5 km into heart, moor and weald, about 600 m into downs, about 400 m into fen. Along part of a downs edge the height comes on over about 250 m (a scarp); elsewhere it shades off.
- **Speed.** The weights are kept on an 80 m grid in tiles made on demand (`regionTile`), and read bilinearly. The ground is asked for millions of times, so `regionW` must stay cheap.
- **Parameters.** `RP` holds one row per property with a value per kind. `regionP(x, z, RP.row)` mixes them by the weights. `RG_BOUND` says what bounds a field; `RG_BUILD` what people build with. Change the look of a kind there.
- **Picking by weight.** Things that cannot blend (a house's walls, hedge or wall) pick one kind with a hash draw against the weights (`regionPick`), so they change over a border one by one, not at a line.

## The home country: what I chose
The home country is heart throughout and regions begin beyond its box, coming in over 1.5 km (`REGION.fade`), which is the outer flank of the home mountains. `regionW` returns `null` inside the home box and whenever `LEGACY` is set, and every reader treats `null` as "as it was".

Why: the home rivers were planned on the old ground, so the ground inside cannot move, and the plan is guarded by the digest. Measured with `tools/digest.py` against the baseline: all ten entries (rivers, tracks, lanes, bridges, places, farms, blocks, poi, ground, landform) identical for seeds 0, 1 and 2.

To let the look of neighbouring regions (turf, trees, walls) reach into the home outskirts, `regionW` would need a second blend that starts inside the box and is used by the drawing code only. Not done.

## What each kind changes
| | downs | fen | moor | weald |
|-|-|-|-|-|
| Ground | whale-backed hills, dry valleys, scarp on part of the edge | level, 8 m below the plain, low islands | raised 24 m, broad and rough, a knoll at each tor site | close small hills, steep little stream valleys |
| Streams | few (5 x the land needed) | more, in long straight reaches, hardly cut in | more | a few more |
| Border range | 0.7 of its height | 0.4 | 1.1 | 0.85 |
| Cover | little wood except on steep sides; no heath | carr in blocks on wet ground; all wet off the islands | bare; heath; wood only in stream valleys | more wood |
| Turf | pale | dark, tawny sedge beds | tawny, dark bog | deep green |
| Trees | beech | willow | birch, thorn, pine | oak |
| Fields | 1.9 x the size, mostly open, no hedges | 1.5 x, no hedges | little plough, dry-stone walls | 0.72 x, hedges with many trees |
| Settlement | villages, few hamlets and farms | fewer of each, on dry ground | no villages; hamlets and farms | few villages; many hamlets and farms |
| Building | pale stone and plaster, pale thatch | brick, board, red tile, reed | grey stone and slate, one storey | timber frame, brick, tile |
| Ways | most farm lanes green; deeper hollows | raised causeways, no hollows | most lanes green | hollow ways 1.6 x as deep |

Other layers read it at: `terrainBase`, `rimHeight`, `edgeFeat` (`src/03_terrain.js`); `planLandGen`, `planLandform` (`src/03_water.js`); `forestMask`, `tintOf` (`src/04_city.js`); `wildHeath`, `wildPlant`, the chunk builder's farms, houses, chapel, field and wayside boundaries (`src/03_wild.js`); the settlement plan and the kinds of way (`src/03_settle.js`).

New tree sprites: beech, willow, birch, thorn (`drawTree` in `src/01_textures.js`, pools in `WILD_KINDS`).

## A fault in the endless world that regions exposed, fixed
A great river that enters and leaves a country was held to within 0.08 m a point of its leaving level. Gap levels used to be alike (ground less 47 m). Now a gap in a fen stands near the ground and one on a moor is cut deep, so a short river could not come down far enough and started 16 to 19 m below the level it arrived at (`gap.seam` in `tools/endless.py`, seeds 0 and 2). The allowed fall now follows the difference between the two gaps (`fall` in `planLandGen`).

## The relief beyond home: one relief in layers, weighted by kind (2026-11-19)
Asked for: places felt too spacious for walking (3.9 m/s). Never shrink anything and keep the total sizes, but make the land denser, with shorter length scales, the scale varying by region. Two parts: a lower overall scale beyond home (the user looked at test builds at 0.72, 0.55 and 0.40 and found 0.40 natural), and the scale per region by weighting layers rather than stretching coordinates (`x / K(x, z)` would warp the land wherever K changes, more so the further from the origin).

### Design (`RELIEF`, `reliefAt` in `src/03_terrain.js`; `RP` in `src/03_regions.js`)
- **Layers of fixed size.** Beyond home the relief is the sum of: the uplands and plains (`RP.broad`, about a kilometre across), the ranges in them (`RP.range`, spurs some hundreds of metres apart), the crags, gullies and steps on the ranges' high ground (`RP.crag`), the knolls (`RP.knoll`, 150 to 230 m), the hillocks (`RP.hillock`, new, 70 to 110 m), the swells (`RP.swell`, 260 m) and the kind's own shape (`regionShape`). Each kind says how much height each layer carries; `regionMix` blends the weights across region edges as it does everything else. `RP.relief` is gone (split into broad, range and crag).
- **The overall scale.** `RELIEF.k = 0.40` (was `RELIEF_K = 0.72`): the wild relief's uplands, ranges and crags stand at 0.40 of their home size. `RELIEF.kv = 0.72`: the valley lines keep today's size. At 0.40 the valley floors became trenches: the uplands dropped 45 m into them over some 60 m, which drew winding black lines on the shaded maps.
- **The heights.** `RELIEF.h = 0.92` as before, and `RELIEF.range` for the ranges alone. The ranges at 0.40 of their size and full height (option A, `range: 1`) made 2.5 to 4.0 % of the heartland too steep to climb (main: 0.9 to 1.6 %). At 0.556 (option B: 0.40 / 0.72, their slopes as they were) it was 0.5 to 1.1 %, but the hills stood lower and the moor was no denser than today. **Chosen: 0.75**, between the two: 1.2 to 2.1 % (mean 1.54 % against main's 1.19 %). The uplands and plains keep their full height: at a kilometre across they stay gentle.
- **Each kind's grain** (heart, downs, fen, moor, weald):

  | layer | heart | downs | fen | moor | weald |
  |-|-|-|-|-|-|
  | broad | 1 | 0.3 | 0 | 1.3 | 0.4 |
  | range | 1 | 0.15 | 0 | 0.45 | 0.4 |
  | crag (of the ranges') | 1 | 0 | 0 | 0.6 | 0.35 |
  | knoll | 1 | 0.15 | 0.03 | 0.55 | 2 |
  | hillock | 0.3 | 0 | 0 | 0.15 | 1.1 |
  | swell | 1 | 2.8 | 0.12 | 1.2 | 0.8 |

  The weald carries its height in knolls and hillocks (small, close-set hills), the downs in smooth swells and their own whale-backs, the moor in broad uplands with rough ground and few ranges, the fen in nothing. The kinds' own shapes stand closer too: the downs' whale-backs at 620 m (were 1250) and their small term at 300 m (500), the moor's swells at 640 m (880) and its rough ground at 125 m (170, now 6 m high instead of 4.5), the weald's ghylls at 310 m (430). The downs' dry valleys stay at 820 m: at 480 m they became worm-like loops.
- **Where kinds meet.** Two kinds of like roughness but different grain (weald and downs, say) mixed half and half are smoother than either, since each layer then carries half its height. So each layer's departure from its mean is raised there (`lift`) until the ground is as rough as the geometric mean of the two kinds' roughness. The layers' spread and mean (`RLAY`) were measured over the land beyond home with `__game.reliefLayers`. Along transects across region edges the lift reached 1.25 between weald or moor and downs, and stayed at 1.0 to 1.05 elsewhere; it made the ground there 10 to 15 % rougher than a plain mix. Where one side is flat (fen) it does nearly nothing.
- **Patchiness.** The knolls and hillocks are stronger in some stretches than others (0.45 to 1.55 times, over about 1.7 km), so no kind is evenly crumpled.
- **Straight ranges.** The band the ranges follow is the zero line of a value noise, and value noise lays its zero lines along its lattice: at 0.40 its crests ran dead straight north-south and east-west for a kilometre (seed 1, heartland, west of the spot). Beyond home the band is bent by a further warp of 520 (of its own units, about 200 m) at 1500, which removed them. Main's ranges come from the same noise at 1.8 times the size, so it may have such lines too, longer (not looked for). Bending the massifs themselves did not help.
- **By the home country.** Everything new comes in over the first 1.5 km beyond the home box (`RELIEF.fade`, with the regions' own fade): the wild relief is blended from its home size, and the patchiness and the hillocks fade in, so the ground does not step at the box's edge. Inside the box `terrainBase` runs the old code unchanged (`wildRelief` without layers is the same arithmetic), and `tools/digest.py --diff` against main is identical for seeds 0, 1 and 2.

### Measured: `tools/relief.py` (new)
One spot per kind and seed: the point of a 500 m lattice nearest home that is at least 5.5 km beyond the home box, 3 km inside its country's border belts, 3 km inland and wholly of that kind (none of that depends on the relief, so main and this branch measure the same ground). Round it, 4 x 4 km of `terrainRaw` (rivers cut in) at 10 m, counting only ground of that kind (weight over 0.85) 1.5 km clear of the border belts. "Crest" is the median distance from a crest to the next hollow along straight lines (a turn counts once the ground has climbed or fallen 4 m; again at 15 m). Means over seeds 0, 1 and 2, main → this branch:

| kind | crest, 4 m | crest, 15 m | 90 % of slopes under | too steep to climb | height range (5-95 %) |
|-|-|-|-|-|-|
| heart | 220 → 173 m | 363 → 313 m | 27.0 → 30.3° | 1.19 → 1.54 % | 127 → 110 m |
| downs | 280 → 260 m | 577 → 527 m | 14.5 → 15.3° | 0.02 → 0.01 % | 115 → 97 m |
| fen | 477 → 440 m (flat) | mostly no 15 m swings at all | 3.9 → 3.7° | 0 → 0 % | 30 → 29 m |
| moor | 213 → 200 m | 373 → 373 m | 32.0 → 24.5° | 2.06 → 0.26 % | 170 → 130 m |
| weald | 147 → 87 m | 327 → 253 m | 27.1 → 31.4° | 0.60 → 0.38 % | 128 → 104 m |

Per seed: weald 140/160/140 → 80/100/80 m; heart 200/240/220 → 180/180/160 m.

What that says:
- The weald (41 % and 22 % shorter from crest to hollow) and the heartland (21 % and 14 %) are much denser. The downs are only 7 to 9 % denser, and the moor 6 % at 4 m and not at all at 15 m: by design they stay the broad kinds, the downs in long smooth swells and the moor broad and open. Making them denser too is a matter of their weights (more swell, smaller whale-backs; more knolls on the moor).
- The moor is much easier to walk than it was (its ranges were at full height: 2 to 3.4 % too steep on seeds 1 and 2). The weald has less ground too steep to climb (0.60 → 0.38 %) but more climbing: its slopes are steeper on the whole (90 % under 31° instead of 27°), as close-set hills are. The heartland's share of unclimbable ground rose (seed 0: 0.88 → 2.10 %; seeds 1 and 2 about the same: 1.57 → 1.33, 1.12 → 1.19 %). On seed 0, 80 % of it lies where the ranges stand over 60 m (their crags, gullies and steps), 20 % on their flanks, next to none on low ground.
- **The land stands lower**: the 5 to 95 % height range in these windows is 13 to 24 % lower than on main (the moor's ranges and the weald's ranges gave way to broad ground and to knolls; the ranges are at 0.75 of their height). Not decided with the user. The uplands layer could carry more height without steepening the ground much, at a kilometre across.
- **Checks on the final code** (headless Chrome, software rendering, one machine; main and this branch run back to back):
  - `tools/digest.py --diff` against main: all ten entries the same for seeds 0, 1 and 2. `tools/invariants.py`: the same as main (only `rivers.trench`, which fails on main too, with the same points). `tools/check.py`: boots, no errors.
  - `tools/endless.py 0 1 2`: no failures. A country's plan: 1.32, 1.35 and 1.41 s of CPU (mean over 36 countries) against 1.26, 1.21 and 1.31 s on main, about 5 to 11 % more; two more runs of seed 2 gave 1.31 s. The longest single step: 46, 69 and 117 ms against 58, 83 and 25 ms; seed 2 again gave 45 and 72 ms, so the 117 was a one-off, but steps of 70 ms do occur (on main too). The step across border lines is smaller than on main (0.4 to 1.0 m against 1.9 to 2.4 m).
  - The ways and places of the 36 countries round home, main → this branch: way length +3 to 4 %; ways steeper than 12 %: 4.1 → 4.6, 4.2 → 4.5, 4.7 → 5.8 % of their length; bridges 488 → 509, 506 → 498, 486 → 492; villages 374 → 379, 386 → 386, 384 → 380; hamlets 418 → 469, 428 → 488, 399 → 461; farmsteads +3 to 4 %; field blocks within 1 %.
- In the fen the numbers can swing with the rivers: in one test build a great river came in through a lower border gap (a gap sits at the lowest ground on its border line, which the relief moves) and cut 40 m into the fen. Not seen in the final build's spots.

### Not done or not verified (relief)
- The height option (ranges at 0.75) and the lower land are my choice, not the user's. The downs and the moor are hardly denser than before.
- One spot per kind and seed was measured; the numbers of a kind vary a good deal from spot to spot (the downs' height range was 59 m on seed 1 and 143 m on seed 2).
- Not walked in the game, and nothing tried on an iPad. Chunk building times and `tools/farwalk.py` were not run. No critic rounds (not asked for).
- The tors, coasts, meres and drains are as they were (see below).

## Tools
- `tools/relief.py OUT 0 1 2` and `--compare OUT main=DIR new=DIR`: the relief per kind beyond home (numbers above, a shaded map and views from the ground, 150 m and 500 m up); serve each build on its own port with `HTTP_PORT`.
- `REGION=-30000,-38000,30000,2000,60 tools/landmap.py OUT 0 1 2`: a third panel shows the regions in colour with the countries' lattice in white and the home box in black. The printed line gives each kind's share of the land.
- `SET=regions tools/wild.py OUT 0 1 2`: for each kind beyond home a way, a village or hamlet and open ground, from the ground and from the air, and one view from high up where a region's edge crosses a border.

## Measured (headless Chrome, software rendering, one machine)
- **Shares of the land**, home and the ring round it, seed 0: heart 22 %, downs 24 %, fen 19 %, moor 20 %, weald 15 % (heart includes all of home).
- **A country's plan**: mean 1.10 to 1.18 s of CPU over 36 countries with regions, against 1.13 to 1.14 s before (seeds 1 and 2). Longest step 28 to 53 ms, against 50 to 79 ms.
- **Load**: `check.py` booted in 8.8 s and 10.5 s on two runs; `bench.py` gave 7.9 to 8.0 s before this work. Not measured back to back with `bench.py` afterwards.
- **Chunk building**: not measured after this work.
- **`tools/endless.py 0 1 2`** on the last code: no failures (429, 477 and 395 rivers; 29 gaps a seed; 49, 42 and 48 passes; ground step at the borders 1.9 to 2.4 m, as before). That run shared the machine with the journey test, so its plan times (1.22 to 1.27 s) are not comparable.
- **`tools/farwalk.py 0`** on the last code, the whole 110 km journey: finished with no errors and no ground missing under the player; 29 countries planned, 26 forgotten. The wild's work per frame: mean 20.3 ms, 95th percentile 35 ms, worst 125 ms (before: mean 20 to 21, 95th 36 to 37, worst 90 to 102). Heap 246 to 288 MB out in the countries with up to 12 planned at once, 222 MB back home with 3 (before: 202 to 227 MB with 4 to 6). The longest plan step was 71 ms (river building; about 60 ms before). The longer worst frame was not looked into. The run shared the machine with `endless.py`.

## Judged from renders (seed 0 only, one round, by me)
- Fen: reads clearly. Level, dark, willows, brick houses with red roofs.
- Weald: reads clearly. Wooded, timber frames and tile.
- Moor: tawny, birch, grey stone and slate, but too many trees and no heather showed. Heath raised from +0.5 to +0.9 and wood lowered afterwards; not rendered again.
- Downs: weakest. The views were level, not rolling, the turf was not clearly pale, and heather showed on the open ground. Heath set to -1 and the turf made paler afterwards; not rendered again.

## Not done or not verified
- **Seeds 1 and 2 were never rendered**, and no view was rendered after the last changes to heath, wood and turf colour. The task asked for ground and air renders of each region for three seeds.
- **Meres** (`REGION.meres = false`). The hollows, their place on the map, and their exclusion from farming and woods are written, but the chunk builder does not draw their water and the ways are not kept out of them, so they are off.
- **Drains.** The fen's streams run straighter, but there is no grid of cut drains.
- **Tors.** The knoll is in the ground; the piled rock on it is not built.
- **Coasts** (cliffs, dunes, saltmarsh): not started. The coast is as it was in every region.
- **Sheep on the open downs**, springs below the scarp, villages sought out in the downs' valleys: not done.
- **Causeways** are in the plan (`T.sink` negative) and the chunk builder raises the ground for them; not looked at in a render, and not checked where one meets a bridge.
- **The far ground** still edges every field dark as if hedged, also where the region has no hedges.
- **Walls against hedges beyond home.** Before this work every pasture above 70 m was walled, which beyond home meant nearly all of them, since the land there stands above 100 m. Now the region decides. This is a change to how the countries beyond home looked.
- `landAt` is still not blended across a country border; regions do not make it worse, since the region field is the same on both sides.
- The map (`MapView`) does not show regions. Nothing was tried on a real device or an iPad; touch controls were not touched.
- Region names for the story are not set; `docs/SETTING.md` is unchanged.
