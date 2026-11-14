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
