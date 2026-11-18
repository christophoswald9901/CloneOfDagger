# The Giant's Ridge

A seventh fixed landmark: a bank of earth 2 km long that carries the road level across a wooded valley in the foothills some 7 km west of Aldhaven. It is the same in every world (`?seed=N`). Code in `src/03_sites_ridge.js`, walk test `tools/ridgewalk.py SEED`.

## Where it came from
The user found it walking west from Aldhaven on the default country (seed 0): the west gate's high road rose up to 32 m above the land on a narrow wall of bare earth, for about 1.9 km between (-6710, -840) and (-7972, -2071).

- **Cause.** The home country's ways are graded once, under `LEGACY = 1`, on the land as it was. Then the endless world cuts a col into the home mountains at each pass (`homeNotch`, `src/03_terrain.js`, down to 17 % of their height). The col spares the ground near the home rivers but not near the ways. So a way keeps its old height over the lowered ground, and the chunk levelling (`genChunk` in `src/03_wild.js` brings the ground up to a way's height within about 12 m of it) builds the wall.
- **It moved with the seed.** Seed 1 had only 580 m at 11 m high, near its own west pass at z = -2700. Seed 2 had nothing on the west road (its pass is at z = -5800).
- **The same fault elsewhere: fixed.** Lanes and tracks near the east and north passes stood up to 96 m above the ground (seed 0, around (7800, -4651)), 100 m (seed 1, (8363, -5227)) and 52 m (seed 2, (-1657, -16226)), on near-vertical walls up to 1.6 km long. Now `regradeHome()` (`src/03_wild.js`, called from `World.finishHome` before the kinds of way and the hollow ways are worked out) gives every home way its grade from the land as it now lies, wherever that differs from the land the plan saw:
  - It measures the difference every 48 m along the way, near the passes, the old crest and the home box's edge (nowhere else does the land differ).
  - It smooths the difference as the grade was smoothed and adds it.
  - Bridges keep their decks, and the Giant's Ridge's own stretch is left as laid.
  - Lines don't move, so `tools/digest.py --diff` against main shows every item the same for seeds 0, 1 and 2.
  - It takes about 64 ms at load (headless).

  See "Walls before and after" below.
- **A separate, smaller cause, not fixed.** Where a way fords a narrow, deep gully, the 39 m grade smoothing fills it, leaving a short bank: seed 1 (339, -3805), 30 m high over 75 m, and (4631, -6581), 11 m over 54 m; seed 2 (5929, -3729), 16 m over 57 m. Seed 0 has none.

## What is fixed data
`RIDGE_P` and `RIDGE_LAND` at the end of `src/03_sites_ridge.js`. The same numbers are in `docs/embankment_data.json`, made by the scripts described below.

- **The line:** 70 points every ~29 m from (-6614, -652) to (-7966, -2100), with the crest's height at each. They are seed 0's road between its points q2860 and q3550, smoothed (σ 75 m in plan, 90 m in height) so the crest keeps even grades. The last 110 m at each end ease into the land.
- **The land round it:** seed 0's ground (terrainRaw, Gaussian low-pass σ 18 m), on 40 m cells from (-8700, -2800), 71 × 73, one byte each (40 m + 0.8 m a step). It is read bicubically, with a little fixed roughness added (fbm, 0.9 m at 31 m).

## How it is laid in
- **Ground (`ridgeH`).**
  - Within 4.2 m of the line the ground is the crest. Beyond that the faces fall at 1.5 (56°), too steep to climb, and their foot is rounded into the land. Where the land stands above the crest, a cutting rises at 0.9.
  - A shallow borrow ditch runs 6 m beyond the foot wherever the bank stands over 3 m.
  - A dry channel crosses at the culvert.
  - The 8 m near grid (signed distance and position along the line, within 140 m) and the 40 m zone grid are made at load (about 20 ms).
- **Zone.** Distance from the line, not from a centre (`S.dist`, `S.box`; `siteOff` in `src/03_sites.js`). rc = 130 and rb = 380, plus the usual ragged edge. Beyond its ends distance counts 2.5 times, and the zone narrows towards the ends (×2.2 at the south-east end, ×2.5 at the north-west), so seed 0's river at (-8108, -2343) and the villages Aldby and Coldstead stay outside it.
- **Surfaces.** The faces are bare earth (`S.earth`, read by the chunks and the inner far ring). Turf holds on in patches and creeps up from the foot. No rock or scree is laid on them.
- **Woods (`ridgeForest`).** Fixed woods on the valley sides, kept clear of the bank and of 6–26 m beyond its foot, with a glade at the culvert. `ridgeKeep` keeps trees and bushes off the bank, and small plants off the crest.
- **Roads.**
  - Two roads: the crest from the south-east end to the north-west end plus 30 m on, and a 60 m stub out of the south-east end. The country's routing takes over from both ends (`S.roads`).
  - They are laid after every other landmark's roads (`S.late`), so the others are routed as before.
  - Their own stretch is kept exactly as laid (`S.exact`, `T.fixedN` in `planTracks`), so the road runs down the middle of the crest.
  - The fixed stretch is always a high road (`S.wayKind`, set in `classifyGen`).
- **Built things (`SITE_BUILD.ridge`).**
  - Whitewashed marker stones every 30 m on both edges of the crest.
  - Stone piers where the bank stands 2 m high at each end.
  - At the deepest point a stone culvert portal at the foot on both sides: an arched opening, voussoirs, coping, splayed wing walls, stones in the channel.
  - Beside each portal a flight of stone steps slanting up the face to the crest.
- **Discovery.** Within 300 m of the line, by the zone distance, so nearer at the narrowed ends.

## The changes it made to the home plan (merged into main as PR #7)
It is a fixed site, so the home plan sees its ground: rivers are kept out of its zone and the settlement and places keep clear of it.
The home planners are not local, so the change spreads far beyond it:
- **Rivers.** Each river's meanders take the next number from one random stream, in order (`planLandGen`, `rng.next()` per river). When one river near the bank goes or shortens, every later river in the list changes shape.
- **The rest.** Villages near water, their lanes and fields follow the rivers.

The landmark can't simply be laid in after the plan, like the passes' cols: on seeds 1 and 2 a river of the original plan runs right under the line (10 and 14 m from it).

`plancmp.py` (in the session scratchpad; it compares two dumps of the plan) counts items changed against main, by distance from the line. Each count is `gone / new`. Most changed items lie more than 5 km away.

| seed | villages and hamlets | farmsteads | field blocks | river points | track points | high road |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 97 / 94 of 102 | 152 / 151 of 559 | nearly all | 912 / 903 of 5685 | 1318 / 1327 of 2718 | 48.6 → 47.2 km |
| 1 | 38 / 39 of 92 | 26 / 27 of 522 | 11950 of 13173 | 565 / 507 | 178 / 185, all within 1–3 km | 55.9 → 56.1 km |
| 2 | 90 / 85 of 91 | 287 / 277 | nearly all | 3884 / 3852 | 1915 / 1705 | 58.7 → 57.1 km |

In seed 0 the west gate's track now goes round the bank about 120 m from it. The road on the crest joins it at both ends and takes the high road's traffic.

## Walls before and after
Stretches of home ways (the Giant's Ridge's own road left out) standing more than 4 m above the ground beside them (the higher of the ground under the way and 16 m to either side), for at least 45 m. Measured on main and on this branch, from the plan data. "Col" means the land beside lies lower than the land the plan saw, "ford" that it does not (the grade fills a gully).

| seed | col walls on main | col walls now | ford fills on main | ford fills now |
| --- | --- | --- | --- | --- |
| 0 | 17 stretches, up to 96 m, 8.0 km in all (by pass: E 96 m, N 91 m, W 25 m) | 0 | 0, up to 0 m | 0, up to 0 m |
| 1 | 10 stretches, up to 100 m, 4.0 km in all (by pass: E 100 m, W 24 m) | 0 | 2, up to 30 m | 2, up to 30 m |
| 2 | 5 stretches, up to 52 m, 1.8 km in all (by pass: N 52 m) | 0 | 1, up to 16 m | 1, up to 16 m |

## Measured (headless Chrome, software rendering)
- **`tools/ridgewalk.py`, seeds 0, 1 and 2:**
  - The crest walked end to end in 100 legs of 20 m. The walker stayed within 0.29–0.45 m of the line and 0.5 m below to 0.13 m above the crest.
  - The landmark was found.
  - Walking off the side at the culvert lands in the valley, on the ground, about 69 m out.
  - The faces cannot be climbed (refused after 0.7 m). Both flights of steps climb to the crest.
  - Fast travel by road from beyond the south-east end to beyond the north-west end arrived over the crest, never below it. No errors.
- **The road's height.** The road on the crest is graded within 0.15 m of it, except in its first 30 m at the south-east end. There it climbs the land at 17 % and the grading cuts up to 1.2 m into the slope. That is on the land, before the bank begins.
- **Photographs.** Seeds 0, 1 and 2 photographed from the crest, from the valley, at the culvert, at both ends and from the air (within 400 m, where the ground is drawn in full). The bank, its crest, culvert, stones and line are the same. Only the country beyond its zone differs. Beyond 400 m the 16 m far ring draws it more coarsely, with bare-earth faces.
- **Load:** main 7.94–8.59 s, this branch 7.80–9.00 s (six boots each, means 8.29 s and 8.39 s, within noise). The landmark's own setup at load takes 83 ms.
- **`tools/check.py`:** boots with no errors.
- **`tools/endless.py 0 1 2`:** 0 failures (rivers, gaps, passes and ground across the borders of 37 countries a seed).
- **`tools/invariants.py`:** world seeds 0–5 and town seeds 0–3 pass every check except `rivers.trench` (3–8 points a seed), which fails on main too, by the same counts (6, 2 and 4 points on main for world seeds 0–2, against 6, 3 and 4 here).
- **After the passes were fixed** (`regradeHome`, on main with the Giant's Ridge merged):
  - `tools/digest.py --diff` against main: every item the same for seeds 0, 1 and 2.
  - The Giant's Ridge's own road heights are the same as on main.
  - `tools/ridgewalk.py 0 1 2`: ok. The crest stayed within 0.39 m of the line and 0.5 m below to 0.14 m above it. Both flights of steps climbed, and the journey arrived over the crest.
  - `tools/endless.py 0 1 2`: 0 failures.
  - `tools/invariants.py`: as on main (only `rivers.trench`, same counts).
  - `tools/check.py`: no errors.
  - Load: the re-grading takes about 64 ms. Back-to-back boots, with the machine heavily loaded by other work: main 14.7–14.9 s, this branch 14.5–16.0 s.
  - Photographs of the worst wall (east pass, seed 0) before and after are in `tools/out/east_pass_walls.png` (not in git).

## Not done
- The ford gully fills (above) are not fixed. They are a separate cause, and a fix would change how fords are graded across the country.
- Not tried on an iPad. Nothing here touches the touch controls.
- From more than 400 m away (the far rings) the crest line is coarse. It is drawn at 16 m and 64 m like every other landform.
