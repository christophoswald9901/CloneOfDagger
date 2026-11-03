# Building cities

Notes for whoever adds the next city. There are two cities so far:

- **Daggerfall** (`src/04_city.js`): hand-built, organic, on a hill by the bay.
- **Corrinvale** (`src/04_town.js`): generated from a config, a planned canal town on flat ground in the north.

New cities should use the town generator. Daggerfall stays as it is, but it is where most of these lessons came from.

## Adding a city

1. Add an entry to `TOWN_CFGS` in `src/04_town.js`. Set its place (`x`, `z`, `ang`), its size (`A`, `B`, which are the half-length and half-width of the walls), the ground level `H0`, the fixed-ground radii `rc` and `rb`, and the wall, moat, canal, street and district settings. Give it a new `seed`.
2. Choose a spot at least `rb` plus the other sites' `rb` away from every landmark in `SITES`. Keep it well clear of the mountains at the world's edge: the walkability rule refuses ground where `rimDist < 0`. Keep it out of the bay. The plain under it is flat by construction, so the spot only needs to be roughly level.
3. If the city should look different from Corrinvale, add district kinds to `TK` (plot sizes, storeys, wall styles, roofs, stepped-gable and jetty rates). You can also add new landmark builders to `TOWN_BUILD` and assign them to blocks in `Town.plan()`.
4. Check it:
   - `python3 build.py`
   - `SET=town python3 tools/wild.py tools/out/t 0 1 2`, which renders ten views per generator seed: approach, gate, square, street, canal, cathedral, market, commons and two from the air.
   - Have critics score it (see CLAUDE.md).

   `?townseed=N` lays out the town afresh from the same generator, with the varied proportions and placements a new city would get. Judge the generator on at least three of these seeds, not just the one layout you will ship.

## How a town is made

- **Plan once, as plain data.** `Town.plan()` lays out:
  - the street grid, including cross streets that end at T-junctions, with a guard so no block grows wider than about 165 m;
  - the blocks, and the great places that take whole blocks (square, belfry hall, cathedral, citadel, market hall);
  - the districts;
  - the lots, which are rows of narrow plots facing each street with yards left behind them;
  - the suburbs along the gate roads, the gates, the street graph, the landmarks and the windmills.

  The plan costs very little and runs at load time.
- **Build per ground chunk.** `Town.buildChunk()` builds only what stands in one 176 m square of the wild: houses, paving, quays, walls, towers, gates, bridges, props and the great buildings, each built by the chunk its centre stands in. The wild's chunk streaming then loads and unloads the town like any other ground. A town chunk with about 150 houses takes about 120 ms to build, spread over frames.
- **Keep a silhouette for distance.** `Town.buildLasting()` makes a cheap block model of every house, tower and great building. A shader discards it wherever the real chunk is loaded, using the wild's chunk mask. Parts that rise above the roofs (spires, the belfry) are given more presence in the haze than the far ground, so the town reads from the road.
- **Keep the lasting parts.** These are the moat and canal water, the street lamps' light, the banners, and the doors. Every lot is registered with `registerBuilding`, so houses, inns and shops can be entered with Daggerfall's interiors. `Town.doorOf()` computes where `makeBuilding` will put the door, because the plan registers doors before any geometry exists.
- **The town is a site.** It gets flat fixed ground that the country blends into (`SITE_H`), roads from every gate routed to the tracks (`S.roads`), discovery, a place on the map, and a goal for fast travel. It is marked `farmed`, which lets generated fields reach its outskirts, unlike the landmarks, which keep the wild out.

## Lessons from Daggerfall

- **Don't hand-build a city in one function.** Daggerfall's `buildCity` is 1,600 lines of constants and special cases. It looks good but can't be reused, and every change risks the whole city. Put each city's choices in a config and keep the algorithms generic.
- **Grow streets as a network.** Daggerfall's `RoadNet` splits segments at crossings, so roads meet as junctions and the network has both loops and dead ends. Streets don't just overlap. The town generator gets the same effect from a grid with T-junctions.
- **Place lots along streets with fallbacks.** Try the full plot, then narrower or shallower ones, then set back. Buildings face their street at whatever angle it runs. For row houses, which share their side walls, leave out the windows on those sides (`noWin`), which saves triangles nobody sees.
- **Districts carry the variety.** Each one has its own wealth, plot sizes, storeys, materials, roofs and props, and shops go where their quarter wants them. Visitors notice this more than any single building.
- **Slopes cost a lot.** On Daggerfall's hill every house needs a foundation, steps and a level pad, and the terrain has to be cut for each street. Flat ground removes all of that. Choose it when the brief allows.
- **Building a whole city at once doesn't scale.** It worked for Daggerfall's 430 buildings in the fine terrain grid. At six times that size it would not. Hence the plan, chunks and silhouette approach.

## New lessons from Corrinvale

- **Even spacing puts towers in gateways.** With wall towers at equal intervals, one landed exactly on the south gate and filled the passage. Skip towers near gates; the gatehouse is the tower there.
- **A grid needs a width cap.** Cross streets that stop early can merge a row into one block 360 m long. After choosing which streets end, run the cross street through any row where a block would get too wide.
- **Size the great buildings to their block.** A cathedral with a fixed length spills into the streets on a narrow block. `cathDims()` derives the nave length, aisles and transept from the block.
- **A rectangle reads as a stamp from the air.** Suburbs along the gate roads, farmland reaching the moat and windmills on the approach root it in the land. Fields need a ring around the town (`townFields`), not just permission to exist.
- **The same seed gives the same town.** A generator must be judged on several seeds. The varied mode changes proportions, the canal and main-street positions, which side the square, cathedral and citadel take, and the number of gates.
- **Empty is the default failure.** A square without stalls, quays without boats and streets without people all read as dead. Props and folk are part of the town, not polish. Townsfolk spawn along streets near the player, quickly at first.
- **Water needs walking rules.** Moat and canal water refuses a step into it, the way the sea and the mere do. Bridges are colliders with a walkable top. Fast travel by road follows the town's street graph through the gates.
- **Tracks must not run through walls.** The wild's track router treats a town's core as impassable. Each gate gets its own road out instead.
- **Test views must fit the place.** The render tool's cameras keep clear of walls by 8 m in the open country but only 1.5 m in town; otherwise they slide into back yards or the canal. Stand far views on the road itself; a hedge beside the camera hides a whole town.
- **Shader and one-line code edits break silently.** A `//` comment inside a one-line statement commented out the rest of it, and the whole game failed to load. `build.py` now refuses to write a build whose JavaScript doesn't parse.

## Open problems

- From the ground, the cathedral's west front reads as one mass; its spires are too high to see from the forecourt.
- Ordinary streets still repeat the same window rhythm; more facade types (shop fronts, arcades, wider guild houses) would help.
- With some 300–500k triangles while the player is in town, it is heavier than Daggerfall. Watch the frame rate on the iPad, and consider simpler houses for chunks beyond about 250 m.
