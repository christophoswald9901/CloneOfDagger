# The endless world: design notes and state (work in progress)

Branch `claude/endless-world-ce1a5e`, cut from `claude/road-types` (abbce72). Unfinished: see "Not done".

## Design
- The world is a lattice of countries (`TILE` = 10 km squares, `src/03_terrain.js`). The home country is the old `WORLD` box (2 x 2 tiles). The sea stays the south edge; land goes on west, east and north.
- A border is a belt of high ground along a lattice line (`lineOff`, `rimEval`, `rimHeight`): the old rim round the home country, elsewhere a range in some stretches and wooded hills in others. The far side now falls away again instead of rising into a plateau.
- Drainage (`drainDir`, `edgeFeat`, `planLandGen` in `src/03_water.js`): each country is flooded on its own, closed by its border crests. Coastal countries drain to the sea; an inland one drains through one gap to the country south (sometimes west or east; the two north of home go round it). At a gap the river is a great river (16 m) on both sides, at a level fixed by the border (`edgeFeat().wl`, never below the next gap downstream), so it crosses without a seam and never runs uphill.
- Roads: each border stretch may have a pass (`edgeFeat().pass`, a col cut in the range). Both countries route a road to the same point on the line (`WaysProto.passRoad`). Home has three: west and east near the coast, north beyond Corrinvale. Trade over a pass (`trade`) is the same on both sides, so the kind of way matches.
- Each country has its own plan object (`World` in `src/03_water.js` and `src/03_world.js`): `K.land`, `K.ways`, `K.settle`, plus places in `POI`. `Wild.tracks`, `Wild.rivers`, `Settle.list` and the like are merged views. A plan runs as a generator, a few ms a frame (`World.update`), seeing only its own country (`World.only`), so it is the same whatever the order.
- The home country is planned under `LEGACY = 1` (the land as it was). `tools/digest.py` proves it: rivers, tracks, lanes, bridges, villages, farms, field blocks and landform were identical to the baseline for seed 0 (`tools/out/digest_base.json`); seeds 1 and 2 not yet re-checked. Places (POI) were moved before the pass roads to keep them identical; not re-checked.
- Float precision: wild meshes hold points relative to an origin near them (`localize`, `groupMesh`, `GB.build`), so no global rebasing is needed. The chunk mask, coastline texture and horizon mesh now follow the camera.
- Hills beyond home stand closer (`RELIEF_K` = 0.72).

## Measured (headless Chrome, software rendering)
- Baseline load 8.6-10 s (land 1.8-2.1 s, tracks 0.8-1.4 s, settlement 2.3-3.6 s). New load not yet measured.
- A 10 km country plans in 0.9-1.5 s of CPU. Worst single step 156 ms: too long, needs finer slicing (track routing, `classifyWays`).

## Not done
- Nothing rendered or walked yet beyond the home boot check: no screenshots, no long-walk or fast-travel test, no memory figure, `tools/invariants.py` not run.
- Map (`MapView`), fast-travel graph, travellers and saves still assume one country. `tools/wild.py`, `invariants.py`, `bench.py` not updated.
- Borders still read as a square grid on the map (`tools/landmap.py` with `REGION=-30000,-38000,30000,2000,60`); warping the lattice was considered and not done.
- `landAt` is not blended across a border; no towns beyond home; README not updated.
