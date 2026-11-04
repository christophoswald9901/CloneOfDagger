# Building cities

Notes for whoever adds the next city. There are two cities so far:

- **Daggerfall** (`src/04_city.js`): hand-built, organic, on a hill by the bay.
- **Corrinvale** (`src/04_town.js`): generated from a config, a canal town on flat ground in the north: a small planned old town ringed by looser quarters.

New cities should use the town generator. Daggerfall stays as it is, but it is where most of these lessons came from.

## Adding a city

1. Add an entry to `TOWN_CFGS` in `src/04_town.js`. Set its place (`x`, `z`, `ang`), its size (`A`, `B`, the half-axes of the ellipse its polygonal wall is drawn round), the old town's share (`core`), the ground level `H0`, the fixed-ground radii `rc` and `rb`, and the wall, moat, canal, street and district settings. Give it a new `seed`.
2. Choose a spot at least `rb` plus the other sites' `rb` away from every landmark in `SITES`. Keep it well clear of the mountains at the world's edge: the walkability rule refuses ground where `rimDist < 0`. Keep it out of the bay. The plain under it is flat by construction, so the spot only needs to be roughly level.
3. If the city should look different from Corrinvale, add district kinds to `TK` (plot sizes, storeys, wall styles, roofs, stepped-gable and jetty rates) and quarter kinds to `TQ` (block length and depth, lane width). You can also add new landmark builders to `TOWN_BUILD` and assign them to blocks in `Town.plan()`.
4. Check it:
   - `python3 build.py`
   - `python3 tools/townplan.py tools/out/plan 0 1 2`, which draws each layout from above as data (north up, coloured by quarter) and prints block counts and sizes. It takes seconds; look at it before rendering anything.
   - `SET=town python3 tools/wild.py tools/out/t 0 1 2`, which renders about fifteen views per generator seed: approach, gate, square, old-town street, lanes in two quarters, commons, canal, cathedral and nave, market, citadel and two from the air.
   - Have critics score it (see CLAUDE.md).

   `?townseed=N` lays out the town afresh from the same generator, with the varied proportions and placements a new city would get. Judge the generator on at least three of these seeds, not just the one layout you will ship.

## How a town is made

- **Plan once, as plain data, like a polycrystal.** `Town.plan()` lays out:
  - an irregular convex wall (corners jittered round an ellipse), gates where the roads from the old town meet it, kept clear of the wall's corners;
  - the old town: a strict grid inside a rectangle with cut corners, ringed by a boulevard where its first wall stood, holding the great places (square, belfry hall, cathedral and forecourt, market hall), which take whole groups of cells;
  - the canal, straight through the old town and bending out under the wall on both sides;
  - the quarters between the gate roads (split by the canal where it runs through one). Each is a lattice laid along one of its roads, along the canal or along the wall, at its own block size (`TQ`), bent and jittered, with some cells merged so lanes end at offset T-junctions. Each cell is clipped by half-planes: its roads, the canal, the boulevard, the citadel's esplanade, the ring street inside the wall, and the little squares inside the gates. Slivers become small paved places; one block per quarter becomes a square with a well, and a couple become chapels;
  - the citadel, placed in its quarter near the wall, clear of the roads and the canal;
  - the lots: rows of plots along every edge of a block, longest edges first, each kept inside the block and clear of the others. The rest is gardens;
  - the street graph, made by cutting every street where it crosses another or where one ends on another; bridges wherever a street crosses the canal; the suburbs, landmarks and windmills.

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
- **A grid needs a width cap.** Cross streets that stop early can merge a row into one block 360 m long. (The old town's grid now merges cells only in small rectangular groups.)
- **Size the great buildings to their block.** A cathedral with a fixed length spills into the streets on a narrow block. `cathDims()` derives the nave length, aisles and transept from the block.
- **A rectangle reads as a stamp from the air.** Suburbs along the gate roads, farmland reaching the moat and windmills on the approach root it in the land. Fields need a ring around the town (`townFields`), not just permission to exist.
- **The same seed gives the same town.** A generator must be judged on several seeds. The varied mode changes proportions, the canal and main-street positions, which side the square, cathedral and citadel take, and the number of gates.
- **Empty is the default failure.** A square without stalls, quays without boats and streets without people all read as dead. Props and folk are part of the town, not polish. Townsfolk spawn along streets near the player, quickly at first.
- **Water needs walking rules.** Moat and canal water refuses a step into it, the way the sea and the mere do. Bridges are colliders with a walkable top. Fast travel by road follows the town's street graph through the gates.
- **Tracks must not run through walls.** The wild's track router treats a town's core as impassable. Each gate gets its own road out instead.
- **Test views must fit the place.** The render tool's cameras keep clear of walls by 8 m in the open country but only 1.5 m in town; otherwise they slide into back yards or the canal. Stand far views on the road itself; a hedge beside the camera hides a whole town.
- **One tree can hide a town.** From the road 1 km out, a single roadside oak covered the belfry exactly. Across a town's own farmland the roads are kept open (no trees within about 45 m), which is also how lowland approach roads look.
- **Shader and one-line code edits break silently.** A `//` comment inside a one-line statement commented out the rest of it, and the whole game failed to load. `build.py` now refuses to write a build whose JavaScript doesn't parse.

- **Open spaces must be sized to what faces them.** A whole grid block left open as the cathedral's forecourt was about 80 m deep, and the church looked small and far away across it. The forecourt now takes about 30 m of the block, and the rest is lots whose houses face it. Squares need the same care: a block-sized square needs many stalls and people, or it reads as a car park.
- **Openings must read as openings.** A gate passage lit like the street beyond it doesn't show from 100 m; it needs a dark soffit and side walls and a dressed-stone arch round it. A see-through grille over the canal's water gate looked like a rendering bug, so the water gate is now a dark vault under a band of dressed stone.
- **Landmarks need forms, not just positions.** Moving the same belfry around between seeds doesn't make towns feel different. The belfry now has three forms (an octagon under a spire, a stone tower under a pyramid roof, and an octagon with a lantern), chosen by the town's seed. More landmark forms are the cheapest way to add variety between cities.

- **One grid over a whole town is a monocrystal.** The first Corrinvale was one rectangle of parallel streets, and its blocks were 60–90 m: it read as a stamp and was tiring to walk. Keep the strict grid to a small old town (about a fifth of the walled area) and grow the rest as quarters, each with its own orientation and block size. The seams between them (roads, the canal, the boulevard) are where the town looks most medieval: triangular blocks, small places, streets meeting at angles.
- **Blocks should differ between neighbours and between quarters.** Block sizes range from about 20 m in the tanners' ward to about 60 m in the commons. Within a quarter, spacing varies street by street, and merged cells break the rhythm.
- **Long straight lanes are corridors.** Bending the lattice a little, jittering its corners and merging cells so lanes end at T-junctions closes the views; a building or tower at the end of a lane is what makes it feel like a town.
- **Fill the ground between houses.** Grass verges between lanes and house fronts read as unfinished. Pave the band in front of each row as deep as its houses, keep the gardens green behind a wall or fence, and put orchards in the commons.
- **Judge layouts north-up and side by side.** The plan tool draws each seed as the map shows it. Critics compared three plans and at once saw what every seed shared (an old town dead centre, the canal straight through it); the varied mode now also moves the old town off centre and turns the whole town.
- **A bridge is something you walk over, not a texture.** The first canal bridges were flat decks at quay level. The rule that stops you wading into the canal looked only at the ground, saw water under the deck, and refused the first step onto every bridge (an "invisible gorge"). It now ignores water wherever a floor collider is under the step. Bridges are humped arches about 3 m over the water, so the barges fit under them. Each arch is a run of 0.75 m slices, each a collider no more than one step (`STEP`) above the last, with ramps down onto the quays. Masted boats are rare and moor away from the bridges. `tools/bridgewalk.py` walks the player over several bridges and reports whether they got across.
- **Clip by half-planes, not by polygons.** Every cut in the plan (roads, canal, boulevard, wall, esplanade, gate squares) is a half-plane on a convex cell, so clipping is a few lines of code and never fails. Choosing which side of the old town's outline applies (its nearest edge) keeps that convex too.

## Open problems

- The gate roads are straight lines from the old town to the gates, and the canal always runs straight through the old town. Bent or forking roads and a canal that bends inside the town would vary the skeleton more; both need the sectors between roads to be built from polylines instead of single lines.
- From 400 m out the town is still low on the horizon; only the belfry and the cathedral stand out.
- The squares still read as large and empty from some views.
- Trees placed on paving look tilted, and wall stairs don't quite meet the wall-walk.
- Ordinary streets still repeat the same window rhythm; more facade types (shop fronts, arcades, wider guild houses) would help.
- With some 300–500k triangles while the player is in town, it is heavier than Daggerfall. Watch the frame rate on the iPad, and consider simpler houses for chunks beyond about 250 m.
