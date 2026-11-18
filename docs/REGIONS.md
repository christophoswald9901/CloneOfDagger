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

## Tools
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
