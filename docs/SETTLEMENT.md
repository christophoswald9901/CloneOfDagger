# Settlement plan: notes

Branch `claude/settlements-from-land-80d21a`, commit 816e98b. Code in `src/03_settle.js` (`Settle`), planned in `Wild.init` after the tracks.

## What a seed gets
- About 47–52 villages, 43–50 hamlets, 490–560 farmsteads, 560–640 lanes (some 300 km) and 13–16 thousand field blocks.
- Farmland covers about 33% of the land (it was about 10%); woods about 23% (they were about 32%).
- Walking a track you pass a house, a farmstead or a place about every 390 m (median, ~1.7 minutes). One gap in ten is longer than 1.2 km, where a track runs through wild land.

## How it fits in
- Lanes are appended to `Wild.tracks` with `.lane = true` (short farm spurs also have `.spur`). The travel graph and the map include them; travellers on the roads keep to the tracks.
- `wildCult` reads the plan, so woods clear round the villages. The far ground draws fields as hedged strip patches (fine ring) and blocks (coarse ring).
- The map draws whole lattice strips, so it shows a little field where the game cuts a strip short for a track or stream.

## Timings (headless Chrome, software rendering, same conditions)
- The settlement plan adds 2.3–2.9 s at load.
- Chunk building: mean 103–198 ms against 119–260 ms before; worst 126–460 ms against 230–941 ms.
- Triangles at the start view: about 426k against 369k before.

## Faults already there before this work
- The invariant `rivers.trench` fails on some rivers.
- An occasional console warning, "render failed once … reading 'visible'". The base build shows it too.

## Tools
- `tools/landmap.py OUTDIR 0 1 2`: the plan from above (villages, hamlets, farmsteads, lanes, field blocks).
- `tools/wild.py OUTDIR 0 1 2`: now also has `village`, `air_village` and `lane` views.
- `tools/bench.py 0 1 2`: load and chunk-build timings.

## Kinds of way (added 2026-11-14, branch `claude/road-types`)
- `Settle.classifyWays()` routes every village (weight 3) and hamlet (1) along the ways to its nearer market town (Aldhaven's gate tracks or a town's gates), each landmark's road to the city (1), and the city to Corrinvale (12). Each way point gets `T.cls[q]` (`WAY.track`, `.road`, `.lane`, `.green`; widths in `WAY_W`). A track carrying 9 or more is a high road (stretches under 150 m are not); a lane carrying 2.5 or more (a village's own) is a cart track; other farm lanes are dirt lanes or green lanes (about half, and most on the uplands).
- Hollow ways: `T.sink[q]` is how far the bed is let down (up to 2.1 m on lanes, 1.3 m on tracks) where the way climbs a slope; none at the ends, meetings, crossings, yards or among houses. The 4 m ground grid smooths the banks, so the walls or hedges on the banks carry most of the effect.
- High roads have gravel, wider levelling, a milestone every ~1.4 km (`Settle.milestones`) and stone bridges. Far ground, map and travellers use the kinds (travellers favour high roads and skip farm lanes).
- Per seed: high roads 42–51 km, tracks 100–127 km, dirt lanes 43–60 km, green lanes 123–136 km, hollow stretches 16–20 km.
- Fast travel no longer stops when it passes a village or hamlet; it goes on the map.
