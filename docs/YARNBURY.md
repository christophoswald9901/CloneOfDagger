# Yarnbury

Item 19 of `docs/IMPROVEMENTS.md`: a new major place, modelled on a fault the user found in seed 0, west of the home country. A stream there kept its level where the land fell away and ran along the top of a steep bank with jagged, peaked walls, and the lanes climbed bare-earth humps to timber bridges over it.

Yarnbury (the user's working name, a stand-in like the others) is that place made on purpose:
- An old earthen fort in the inward bend of the raised stream.
- Inside it, the fair ground shared by four villages: booths, hurdle pens with sheep, an alehouse and a fair house.
- Below the bank, floated water meadows that the stream feeds as their main carrier.

## How major places are made (the user's rule, 2026-11-28)
- A new major point of interest is built in **a map of its own**, disconnected from the game world, and offered as **a start in New Game**. It is never laid over the generated map.
- Once it and its surroundings look right and feel authentic, it is put into the main map, and **the main map adapts to it**: points of interest matter more than the generated landscape.

## The engine: lands (`src/08_land.js`)
A land is a square of ground written out by its definition (`LANDS[id]`), in local metres about its own middle. `buildLand(id)` makes it an area of its own (`kind: 'land'`), drawn once, whole, with the open country's surfaces, materials and plants. Things made here therefore look as they will in the world.

What a definition gives:
- **`origin`:** where in the world it is meant to go. The area stands there, so it can later be moved in as it is.
- **`R`:** half the side of the walkable square, drawn on a 4 m grid (`C`).
- **`RS`, `CS`:** the coarse ground round it, out to `RS`, seen only through the haze.
- **`base(x, z)`:** the lie of the land.
- **`earth(x, z, h)`:** earthworks added to it.
- **`waters`:** lines with a level and a width at each point. The bed is cut below the level, and a bank is raised wherever the land falls away beside the water, as the open country does (`src/03_wild.js`). That bank-raising is what makes the jagged walls.
- **`ways`:** lines of a kind (`WAY.track`, `lane`, `green`). Each is graded on the ground (smoothed, held level over its bridges), and the ground is levelled across it. Bridges are found where a way crosses water at least 4.5 m wide; their deck is 1.6–5 m above the water, so a way over a raised stream climbs a hump.
- **`tint(x, z, h, n, o)`:** the turf's colour.
- **`bare(x, z, h, sl)`:** bare earth beyond the steep faces by the ways.
- **`build(L, gb, near, fl, cols)`:** buildings and things. `near` is drawn only within `nearR` of `nearAt`, `fl` holds the plant lists by `WILD_KINDS` key, and `cols` the solids, in local metres.
- **`plants(L, fl, cols)`**, **`folk`** (its people), **`start`** and **`welcome`**.

The area's other parts:
- **Ground:** grass with bare-earth and mud overlays on the fine grid in tiles, an apron under its edge, the coarse ground round it, and the sea in tiled squares.
- **Plants:** the open country's pools (`WildPool`). Trees are always drawn, the small plants only within 125 m.
- **Footing:** no climbing faces steeper than 1.2, no wading into water deeper than the knee (a bridge is walked on), and a soft edge at `R - 14` with a message.
- **While a land is built or walked**, `GROUND_H` (`src/03_terrain.js`) makes `terrainH` answer with the land's ground, so the drapes, slopes and footing read it. `setArea` and `leaveCurrentArea` set and clear it.
- **Elsewhere:**
  - `updateWorld` runs the sky and the plants' turning (`Wild.yawU`) in a land.
  - Music is the open country's.
  - Saves remember `{ kind: 'land', id }`.
  - Map, survey and travel say the land is not on any map yet.
- **Starts:** `SURVEY_STARTS` entries with `land: id` (`src/11_survey.js`) start there. `Survey.place` builds the land and sets you down at its `start`.

`tools/landshot.py LAND OUTDIR [views]` starts a new game in a land, reports its build time and counts, takes pictures from given views (local metres; yaw 0 = north) and writes labelled contact sheets. `tools/landwalk.py [LAND]` walks it on foot and checks its ways and its refusals. For Yarnbury the walk goes up the hump, over the north bridge, through the fair and out at the south gate; it then tries to climb the bank from inside the fort and to walk off the map's edge. It exits non-zero on a failure.

## Yarnbury's map (`src/08_land_yarnbury.js`)
Local metres about the middle of the fort: +x east, +z south. The map is meant for world (-17430, -660), where the fault was found. The walkable square is 1.4 km across.

- **The land:**
  - The valley floor in the west falls with the river towards the sea, about 850 m south.
  - A long gentle rise runs east to the foot of the downs.
  - A steep hanger with beech and oak climbs to the downs at about 33 m.
  - A swell lies in the south, over which the carrier comes down.
- **The carrier** (the stream):
  - It comes off the downs from the east, level on the plateau at about 32 m.
  - It is held up on its bank round the bend, at 31.7 → 31.2 m over land falling to 13.4 m.
  - It comes down the swell and falls steeply into the river at the end.
  - Its course is the one measured in seed 0.
- **The river:** 13–15 m wide, about 300 m west of the bend, falling from 12.4 m in the north to the sea.
- **Ways:**
  - The fair's road (a cart track) runs from Fernby north through the fort's south gate, over the north bridge and on to Stanhollow's bridge over the river.
  - Lanes lead to Holley and the two farms (in through the east gate, and over the south-west bridge).
  - A green lane goes up onto the downs.
  - A track runs to Kelfield's bridge.
- **The fort:**
  - Its own bank (about 4.6 m, worn, with sheep scars on the outer face), its ditch (about 2.9 m) and a low counterscarp run round the east from bank to bank.
  - The ends run in at the gates.
  - The carrier's bank closes the west.
- **The meads:**
  - A hatch and a timber chute on trestles run from the carrier's crest at the bend down to a stone pool.
  - A feeder runs along the bank's foot.
  - 14 beds, each 12 m wide and about 190 m long, have a carrier on each crown and a drain in each furrow, with a main drain to the river.
  - Hatches stand at the bed heads, pollard willows along the main drain, and the drowner's cottage by the pool.
- **The fair:**
  - Booths with striped awnings stand along the road between the gates, with carts drawn up.
  - Hurdle pens hold sheep between the road and the bank, with a long trough fed by a spout through the bank.
  - The fair house is an upper room on posts with a stair, where the steward keeps the book and the fair's court sits.
  - The alehouse stands by the north gate, and the fair's pole with its flag stands at the crossing of the ways.
- **Villages:**
  - Stanhollow has 12 houses and a church with a tower, across the river.
  - Fernby and Holley are hamlets.
  - There are two farms with barns and hay.
  - Their open fields lie in furlongs of strips, each lying its own way with grass headlands.
  - The downs are sheep-walk, and the valley floor is meadow.
- **People:** the steward of the fair, a shepherd, a pedlar, the alewife, the drowner, a carter, and people of Fernby and Stanhollow. They are about by day and talk of the fair, the meads and the bank.

## Rounds
Two critics per round (one on authenticity, one on style and readability) judge 12 views (`tools/landshot.py yarnbury OUT "views"`): the approach, the bridge, the fair, the pens, the fair house, the meads, the rampart, Stanhollow, the downs, and three from the air. Seeds don't apply: the map is fixed, so its views take the place of generations.

- **Round 1: 5 and 5.** Both critics' first point was that the raised stream floated: under the water the ground was the land itself, and only two thin walls stood either side, the open country's own way of raising a bank. They also found:
  - the fair empty and regular, and the pens one carpet of sheep
  - the fort's own bank not reading (only 3.6 m above the rising ground outside)
  - the woods in straight belts, and the plain areas flat and one green
  - the meads like painted stripes, the chute weak, and a stray block in the wood (a farm inside the hanger)
- **Fixes after round 1:**
  - **The raised stream** (`W.raised` in `src/08_land.js`): the channel is filled solid, with a continuous lip 0.9 m above the water. Beyond the lip runs a crest narrower than the grid, its place, width and height wandering, so it rises in irregular peaks. Steep faces fall from it to the land. (A first try with a wide crest made a smooth embankment and lost the peaks; the narrow crest brings them back.)
  - **The fort's bank:** 5.8 m, steeper outside, with a darker ditch.
  - **The fair:** clustered by the fair house, with booths, trestles and tents of three widths, goods, a cookfire and 30 people.
  - **The pens:** pale hurdles, walkways, and 2–6 sheep a pen.
  - **The woods and downs:** lobed woods kept off the farms; the downs paler, with juniper, thorn and flocks.
  - **The meads:** darker water threads, drawn near only, with stronger ridges, haycocks, and the feeder clear of the bank.
  - **The villages:** hedged closes, an orchard, a 16 m church tower, and trees in the hedges instead of scattered like a park.
  - **The hump:** a level top at each bridge.
- **Round 2: 6 and 6.5.** The floating water was gone and the fort read from the air. Both critics' first point was that the hump no longer stood out (a must-keep), and the peaks had turned to lumps.
  - The cause was a bug, found in round 3: the narrower channel (4.2 m) fell under the 4.5 m width that ways are bridged at, so the lanes were taken to ford the stream and no hump was raised.
  - They also found the tents like a tournament, the pens a carpet, haycocks like loaves, the woods still in belts, a seam at the edge of the downs, and the spout floating halfway up the bank.
- **Fixes after round 2:**
  - **The stream and the hump:** the stream is always bridged (`W.bridgeOver`). A bridge over a raised stream stands 4.2 m above the water (`W.deckUp`). There are no peaks for about 60 m either side (`W.saddle`), so the hump rises out of a saddle. A bank's foot spreads with its height, so its sides keep a steady slope, and bare earth only lies near the road.
  - **The peaks:** sharp spikes 2–4.5 m above the lip, coming and going along the crest. The faces fall from the lip, so each peak stands alone.
  - **The fair:** undyed canvas tents with closed ends and pegs; booths set back and turned less evenly.
  - **The pens:** thin, pale hurdles, 2.6 m walkways, and loose groups of sheep.
  - **The meads:** haycocks as cones in rows, ricks of hay by the farms, threads that waver in dark cuts, and crowns lighter than the furrows.
  - **Hedges and woods:** hedges with a dense core, and Stanhollow's road between hedges. The woods are broken by pasture and the river alders are in clumps.
  - **The downs and the fort:** the downs' edge wanders. The fort's outer face and ditch are darker, with tussocks and thorn on its crest.
  - **The church and the spout:** the church closes the view along the road, and the spout comes out of the bank face.
- **Round 3: 6.5 and 7.** The hump was back and both critics called the start view the place's signature. Still wrong: haycocks like straw huts, meadow channels like canals, an evenly spaced row of booths, pens like a fence, box-like hedges, a tower like a chimney, belts of wood, a plank floating on the bank (the hay trusses on its foot).
- **Fixes after round 3:**
  - **The stream and the hump:** a raised stream keeps its own channel under its bridges, with no pools. The ramp to a high bridge runs with the deck's height above the land (`b.fade`). The saddle is shorter (14–38 m) and the peaks narrower.
  - **The meads:** haycocks as rounded domes; carriers with grass to the water, wandering; thin dark edges only on the drains; the main drain bending to the river.
  - **The fair:** the west row of booths thinned, with gaps; goods in colour; more people.
  - **The tents:** in panels, with a ridge pole and guy ropes.
  - **The pens:** three blocks of 3×4 pens, their ends to the road, with sheep in clusters.
  - **Hedges and fields:** hedges wider and lumpy, with gaps and trees, along the lanes and the fair road; the furlongs meet.
  - **Stanhollow:** a broader, darker tower with a pyramid roof and belfry openings.
  - **The fort:** a V-cut ditch, a narrower crest varying in height, and one slump.
  - **The downs and farms:** a gap in the hanger where the green lane crosses the edge, and taller barns.
- **Round 4: 7 and 7.5.** Both critics found the hump now the best thing in the place. Still wrong:
  - the haycocks grey, like boulders, and the trusses like modern bales
  - the downs view with no drop
  - the meads' channels still straight at walking distance, and the ditch not seen from outside
  - the bare earth gone from the hump (a must-keep)
- **A walk test** (`tools/landwalk.py`) found the bridge's ends 0.7 m below its deck, so it couldn't be stepped onto. The stream's ordinary valley-cutting had shaved the hump beside it; a raised stream now cuts only its own channel wherever the land stands as high as it.
- **Fixes after round 4:**
  - **The hump:** bare earth on a way's bank widens with its height (`emb`).
  - **The meads:** haycocks of warm hay, lighter on top; a loose heap of hay instead of trusses; the threads wandering 1.5–2 m and leaving the feeder at a slant; plank footbridges.
  - **Pens and thatch:** greyer hurdles and weathered thatch.
  - **Stanhollow:** an 18 m tower with a taller roof.
  - **The fort:** a deeper, wider ditch.
  - **The fair:** smoke from the cookfire and two more carts.
  - **Hedges and fields:** fewer hedgerow trees along the roads, and fields kept off the verges.
  - **The downs:** juniper and a flock below the edge.

- **Round 5 (the last): 7.5 and 8.** The authenticity critic's rounds ran 5, 6, 6.5, 7, 7.5; the style critic's 5, 6.5, 7, 7.5, 8 ("only just"). That is the round limit, with one critic short of 8.
  - The hump, with its bare earth back, is the best thing in the place. The haycocks read as hay, the rampart reads as an earthwork from the counterscarp, and the meads read as worked meadow.
  - Left, as the authenticity critic ranked them:
    1. The raised channel still bulges into bays in places, 6–10 m, with a ragged inner edge. It should be a constant 4 m with a crisp lip.
    2. The bank's faces are blank: one smooth green wall. Add sheep tracks across them, elder or thorn at the foot, and a damp strip with rushes along the outer foot.
    3. From the air two long parallel bands still show east of the bank (likely the hedges along the fair road and the lane to Holley, or the hanger). Break them up.
    4. The juniper reads as cypress (the `cypress` sprite). It needs a low, broad grey-green bush.
    5. The downs view still shows no drop. It needs a viewpoint where the ground falls 10 m within 150 m, perhaps also a steeper hanger.
    6. The hay heap by the pens reads as a hut, and the spare hurdles lying flat as a painted grid.
    7. From the air the furlongs are still hard-cornered rectangles in blank pasture.
    8. The fair still looks thin from the bridge: more people, and a flock being driven along the road.
  - The style critic adds:
    - From the meads the west hump is a flat-topped, evenly brown mesa. It needs a rounded crown, grass running up its flanks, and a worn track paler than the damp patches.
    - The near sheep are bright white rather than cream-grey.
    - At Stanhollow a pale, hard-edged band crosses the foreground (a meadow strip at the verge), and the hedge's end shows vertical bars.
    - The spout by the chute is an upright blue stick; it wants a splash pool with foam. The footbridges don't show from the meads' main view.
    - From the counterscarp the ditch still doesn't read. It wants a darker, damp floor with rushes.

## Not done yet
- Putting it into the main map. The world would adapt round it: the rivers would meet its river and carrier at its edge, and the roads would join its ways. Ask the user first.
