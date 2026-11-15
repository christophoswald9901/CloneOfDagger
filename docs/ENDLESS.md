# The endless world: design notes and state

Branch `claude/endless-world-ce1a5e`, cut from `claude/road-types` (abbce72, PR 2, not merged). Not finished: see "Not done or not verified".

## Design
- **Countries.** The world is a lattice of countries 10 km square (`TILE`, `src/03_terrain.js`). The home country is the old `WORLD` box (2 x 2 tiles) and is the heart of it. The sea stays the south edge; the land goes on west, east and north. A decision, easy to change in `tileJ` and `drainDir`.
- **Borders.** A border is a belt of high ground along a lattice line that wanders by up to 420 m (`lineOff`, `rimEval`, `rimHeight`): a range in some stretches, wooded hills in others, broad or narrow. Round the home country it is the old mountains, exactly as they were over the whole home box and out to their old crest, falling away over 2 km beyond (`homeFlank`, `HOME_FALL`). The player is no longer turned back by the mountains; only the steep-slope rule remains.
- **Drainage** (`drainDir`, `edgeFeat`, `planLandGen` in `src/03_water.js`). Each country is flooded on its own, closed by its border crests. Coastal countries drain to the sea. An inland one drains through one gap to the country south (sometimes west or east; the two north of home go round it, so nothing flows into the home country). At a gap the river is a great river (16 m) on both sides, at a level fixed by the border itself (`edgeFeat().wl`, at least 0.6 m above the next gap downstream), so it crosses without a seam and never runs uphill. Two great rivers entering one country are brought to one level in their first 600 m.
- **Roads.** A border stretch may have a pass (`edgeFeat().pass`: a col cut to 14 % of the range's height). Both countries route a road to the same point on the line (`WaysProto.passRoadGen`). The home country has three: west and east near the coast, north beyond Corrinvale (`placeHomePasses` puts them where few of the old rivers run, and the col spares the ground a river runs over). The trade over a pass (`trade`) is the same on both sides, so the kind of way matches. A country beyond home has a meeting place near its middle (`ways.centre`), a road in from each pass and up to three tracks out from the middle.
- **One plan per country** (`World` in `src/03_water.js` and `src/03_world.js`): `K.land` (rivers, valleys, landform), `K.ways` (tracks, bridges, grades), `K.settle` (villages, farms, lanes, fields), places in `POI`, and a small map image. `Wild.tracks`, `Wild.rivers`, `Wild.bridges`, `Settle.list` and the like are merged views over the planned countries. A plan is a generator run a few ms a frame (`World.update`, `World.due`) as the player comes within 6.2 km; it sees only its own country (`World.only`), so it comes out the same in whatever order countries are planned. Countries more than 15 km behind are forgotten (their map image and the places found in them are kept).
- **The home country's plan is unchanged.** It runs at load under `LEGACY = 1` (the land as it was). `tools/digest.py` compares it with a baseline: rivers, tracks, lanes, bridges, villages, farms, field blocks, places and landform are identical for seeds 0, 1 and 2. The ground differs only in the three pass cols. What changes in the old country: three pass roads, and more high road (42 to about 60 km in seed 0) because trade now runs to the passes.
- **Float precision.** Wild meshes hold their points relative to an origin near them (`localize`, `groupMesh`, `GB.build`), and three.js combines the large offsets in doubles, so no global rebasing is needed. The chunk mask, the coastline texture and the skyline mesh (`genHorizon`, 11 km round the camera) follow the camera.
- **Walking scale.** Hills and valleys beyond home stand at 0.72 of the home scale (`RELIEF_K`); countries are 10 km across (about 43 minutes' walk).

## Tools
- `tools/endless.py 0 1 2`: plans the home country and two rings round it (37 countries) and checks rivers (never uphill, proper ends, seamless at every gap), roads (a road on both sides of every pass, same kind) and the ground across borders. Passes for seeds 0, 1, 2.
- `tools/digest.py OUT.json 0 1 2` and `--diff A B`: the fingerprint of the home country's plan.
- `tools/farwalk.py SEED`: flies the player along a route through several countries at fast-travel speed and reports update times, plan steps, missing ground, countries planned and forgotten, heap.
- `tools/landmap.py` with `REGION=-30000,-38000,30000,2000,60` draws the home country and the ring round it, with borders, passes and gaps.

## Measured (headless Chrome, software rendering)
- Baseline load 8.6-10 s (land 1.8-2.1 s, tracks 0.8-1.4 s, settlement 2.3-3.6 s). The new load time has not been measured.
- A 10 km country plans in 0.85-1.2 s of CPU, mean about 1.2 s over 36 countries. Longest single step when run in 4 ms slices: about 30 ms (river building) and 25-50 ms (kinds of way, not sliced).
- Journey test: see "Not done".

## Not done or not verified
- The journey test (`tools/farwalk.py`) has only been run once, unpaced, where headless Chrome was too slow to build any ground; a paced run was still going when these notes were written. So there is no verified figure yet for frame time while travelling, missing ground, or memory after a long walk.
- Only a few pictures were looked at (the west pass from inside, a country west of home from the air). No three-seed contact sheets, no check of the home skyline against the old one, nothing on a real device or an iPad.
- `tools/invariants.py`, `tools/wild.py` and `tools/bench.py` are not adapted and were not run. `tools/check.py` passed earlier in this work, not after the last changes.
- The map draws the countries beyond home and remembers visited ones, but this was never opened and looked at. Fast travel to a place in a country that is not planned goes by road as far as the network reaches, then straight.
- On the plan from above the borders still read as a square grid. Warping the lattice would hide it; it costs larger planning grids.
- `landAt` is not blended across a border (vegetation may change tone along a border line). No towns beyond home. README and CLAUDE.md are not updated.
- The legacy plan's own faults remain (some rivers a few metres above their ground; `rivers.trench`).
