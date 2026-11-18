# The embankment west of Aldhaven: findings and plan (unfinished)

Branch `claude/blissful-williamson-2c6840`. Nothing in `src/` is changed yet. Only `tools/cdp.py` has changed: it now starts Chrome muted.

## What it is (seed 0)
- The west gate's high road (track 0 of the home ways) runs on a bank from about (-6710, -840) to (-7972, -2071). That is 1.9 km above 3 m, and 1.6 km above 10 m. It is highest at (-7317, -1481): road 94.5 m, ground 61.9 m, about 32 m up. The sides are near-vertical bare earth and the bank runs through woods.
- **Cause.** The home country's ways are graded once, under `LEGACY = 1`, on the land as it was. Afterwards `homeNotch` (`src/03_terrain.js`) cuts a col into the home mountains at each pass for the endless world. It spares the ground near the home rivers, but not near the ways. So the road keeps its old height, and the chunk levelling in `genChunk` (`src/03_wild.js`, ground blended to the road height within about 12 m) builds the wall.
- **It moves with the seed.** Seed 1: west pass at z=-2700, only 580 m long and 11 m high at (-6717, -2743). Seed 2: west pass at z=-5800, nothing on the west road.
- **The same fault makes unwanted walls elsewhere.** Lanes and tracks near the east and north passes stand up to 96 m (seed 0, (7800, -4651)), 101 m (seed 1, (8404, -5195)) and 52 m (seed 2, (-1657, -16226)) above the ground. A second, smaller cause: the 39 m grade smoothing fills narrow river gullies at fords, giving 26–30 m banks 75–145 m long (seed 1 (339, -3805), seed 2 (917, -2497)).
- Possible fix (needs the user's yes, because it changes how ways look near all three passes): after the home plan, re-grade `trackH` of the home ways on the current ground where legacy and current ground differ. The line positions stay, so `digest.py` would be unaffected.

## Landmark plan (not built)
- Fixed data in `docs/embankment_data.json`, all taken from seed 0:
  - `pts`: 70 crest points every ~29 m, as x, z and crest height. This is the seed-0 road between points q2860 and q3550, smoothed (σ 75 m in plan, 90 m in height). It is 2.0 km long, and the bank rises up to 34 m above the land.
  - `tab`: the land, 71×73 at 40 m, Gaussian low-pass of terrainRaw, uint8 = 40 + 0.8·v, origin (-8700, -2800).
- Ground: the land from the table (bicubic, plus fine fixed fbm). A crest 11 m wide at the crest height, 45° sides, a smooth toe, a shallow borrow ditch, and a cutting wherever the land stands above the crest. Precompute an 8 m near-field grid (distance and position along the line, within 140 m) and a 40 m effective-distance grid. Computing them per call is too slow for load time.
- Zone: distance to the line (not radial). rc 130 and rb 380, with end caps stretched 2.5× and the zone narrowing ×2.2 at the SE end and ×2.5 at the NW end over 250 m. This keeps seed 0's river at (-8108, -2343) and the villages Aldby and Coldstead outside it. Generalise `siteDist`/`siteW`/`siteZone`, `siteHere` (`03_wild.js:726`) and discovery (distance to the line < ~260 m).
- Order: lay its roads after all other site roads (a `late` flag in `planTracks`), so the towns' and Halewood's road seeds don't shift. Keep its fixed road exact, without simplifyPath. Use two roads: the crest SE→NW plus a short run-out routed on, and a stub from the SE end routed on. Force `WAY.road` (gravel, 5 m) on the fixed part in `classifyGen`.
- Build: culvert headwalls (stone blocks 6 m deep jutting from the toe, a dark arch, a dry channel) at the lowest point (~point 37). Add white marker stones every 30 m at ±4.7 m on the verges, stone piers where the bank starts, fixed woods cleared on the bank and near the culvert, and `keep` so no trees grow on it.
- Expect the home plan to change near it (rerouted ways, about 7 farms, some lanes). Check with a finer diff, not only `digest.py`.
- Before photos of seed 0 were taken with `tools/shot.py` at the crest (-7200, -1384, yaw 0.75), the side from the air (-7050, -1750, 2.32, -0.38, 140) and along it from the air (-6450, -550, 0.75, -0.3, 220).

## Names to offer the user
the Long Causey · the King's Dyke · the Hanging Road
