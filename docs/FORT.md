# Fort Merrow

An eighth fixed landmark: a star fort of five bastions at the end of a low point on the western shore of Merrow Bay, about 4.3 km west of Aldhaven, where it commands the roadstead. It is the same in every world (`?seed=N`). Code in `src/03_sites_star.js`, walk test `tools/fortwalk.py SEED`, photographs `tools/fortshots.py OUTDIR 0 1 2`.

## What it is modelled on
- **The trace** is the textbook bastioned pentagon of the Italian and Dutch engineers. On each 150 m side the perpendicular is a seventh of the side, the faces two sevenths, and the flanks run square to the curtain back to the line of defence from the far bastion (the construction behind Bourtange, Naarden, Willemstad and the Kastellet in Copenhagen). One bastion points out to sea. The north curtain, facing the land, has the gate.
- **The walls** are brick scarps with stone quoins and a stone cordon, green at the waterline, the brick a little lighter or darker from length to length. Above the cordon is a thick earthen parapet, turfed outside and lined with brick inside, with a firing step. Brick up to the cordon and earth above it was the norm, because masonry parapets splintered under shot. A stone sentry box is corbelled out at each bastion point, as at St Augustine and San Juan.
- **The guns**, about sixty, stand on timber platforms behind embrasures cut down to the cordon: two or three in each face, two in each flank, five in either sea curtain. Two casemate ports open low in every flank. A cavalier (a raised gun platform) on the north-west bastion answers the hill, and a windmill stands on the north-east one (the Kastellet has a mill on a bastion).
- **The sea front** has no outworks: the sea bastion and the two curtains beside it rise straight out of the water, with rock thrown down along their foot, as at St Augustine or Rammekens. At its east end a batardeau, a stone dam with a ridged top and a turret, closes the wet ditch, and beyond it an arm of the point carries a stone pier head and a low battery of four guns. At the west end the ditch and the covered way open onto deep water.
- **The land fronts** have a wet ditch between the scarp and a counterscarp, a covered way that widens into places of arms at the re-entrant angles, a palisade just inside the crest, and a glacis. On the east the counterscarp is brick, the covered way gravelled, and the glacis runs out long and low into the dunes. On the west, where the ground is rock, the counterscarp is cut in it, the covered way is grass with a trodden path, and the glacis comes down to a shelf over the shore's rock scarp. The palisade is solid to the walker and runs on to the east battery.
- **The approach** goes in a dog-leg, as at Fort George on the Moray Firth: past a sentry box and a barrier, through a gate in the palisade, over the ravelin's ditch, through a vaulted gate in the ravelin's east face, across the ravelin, over the main ditch by a long timber bridge with a drawbridge, and through a vaulted passage under the north curtain. Both gates have lifting beams with chains to their drawbridges, as Dutch gates did.
- **Inside:** a gravel parade with two ranges of brick barracks, the governor's house with its cupola on the axis of the gate, a chapel, a powder magazine behind its own wall, the main guard and a store, a well, a gun park, stairs up to the rampart beside the gate, gun ramps up to the three southern bastions, and a flagstaff on the sea bastion.
- **Its people:** a sentry, a gunner, a sergeant, a washerwoman, the miller, a boatman, a watchman on the hill and the innkeeper of the hamlet, about by day (`S.folk`).

## The land round it (fixed, `fortNat`)
The two sides of the point differ, as the land round a real fort would: deep water and rock on the side under the hill, sand built up in the lee.
- **The point.** The shore is fixed within 650 m either side of the fort and blends into each world's own coast by 1600 m (`fortShore`, `fortCoast`, read by `siteCoast` in `src/03_sites.js`). It is drawn through two lists of points, one for each side (`FORT_SHORE_W`, `FORT_SHORE_E`), with a little noise along it.
- **The west** comes in close under the hill: a low rock scarp at the water (`fortRock`, read as `S.rock` by `src/03_wild.js`), ledges and boulders at its foot and reefs running out from its points. Further north the hill's flank drops to the bay in a sea cliff whose top is ragged.
- **The hill.** A green hill north-west of the point, 74 m high, with a rounded brow. Its near slope looks down on the fort from 260–340 m, close enough to see it through the game's haze, which hides most things beyond about 400 m on the ground. Bracken colours its flanks in patches and outcrops break through them.
- **The redoubt** on the hill's brow: a square of turfed banks with guns and gabions towards the bay and the roadstead, storm poles, a blockhouse, a beacon and a path up from the road.
- **The east** is a broad, low foreland: a foredune along the beach and older dune ridges behind it (`fortDunes`), bare sand on their faces and crests (`fortSand`, read as `S.sand`), damp slacks between them, a long lagoon behind the dunes with mud (`fortMud`, `S.mud`), reed beds and an inlet through them (`fortLagoon`, `FORT_INLET`), and rough heath with gorse further back. The bay's shore runs on north from it.
- **The ground's colour** follows all this (`fortTint`, read as `S.tint` by the ground's tint in `src/04_city.js`): the glacis an even grazed green, the dunes blue-grey with marram, the slacks dark, the heath brown, the bracken rusty, the rough west shore darker.
- **Open ground.** No tree or bush grows of itself within 470 m of the fort (the esplanade kept open for the guns). Sheep graze it, and thorn and gorse stand on the hill's far side and on the foreland beyond 330 m.
- **The landing** is on the foreland's beach, facing the roadstead: a stone quay and timber stage with a crane and a shed, boats beside it, and a track round the foot of the glacis to the road. Three fishermen's cottages stand on the bay shore beyond the foreland. Four ships ride at anchor off the point.
- **The hamlet** (an inn, three cottages, a smithy) stands where the road leaves the open ground, with eight hedged fields (`FORT_FIELDS`).
- **The road** runs north from the glacis for about 900 m. From there the country's own routing joins it to the tracks. It is laid after every other landmark's roads (`S.late`), its own stretch is kept as laid (`S.exact`), and it is a high road (`S.wayKind`).

## How it is laid in
- **Ground (`fortField`).** The parade is at 3.6 m, the rampart at 9.6 m, the ravelin's rampart at 7.4 m and its floor at 3.3 m. The covered way is at 3 m and the crest of the glacis 2.6 m above it (1.3 m towards the sea, `fortCrest`).
- **A trench under the water.** The ground's mesh has 4 m cells, so a sheer wall cannot be drawn in it. The ditch's bed is at -24 m under opaque water, and the ground rises again inside the footprint of each wall. However the cells fall, no bank of earth shows in front of the brick. The parapets, the covered way's gravel and the ravelin's quay are built wide enough to cover the seam (up to 8 m).
- **The gate passages** are cut down to their floors in the ground, inside solid masonry. The main gate's cut lies on the 4 m grid. The ravelin's is oblique to it, so its stone threshold runs 6 m into the passage.
- **Water.** One sheet at the sea's own height, 950 m in radius, lies under the fort and the fixed coast. The ground hides it wherever it is dry. It is there because the sea is clipped against the coastline sampled every 50 m, which is too coarse for the steep sides of the point.
- **Floors near walls use materials without a depth offset** (`gravelN`, `settsN`, `dirtN`). The game's road materials are pulled towards the camera, and at a grazing angle they showed through the fort's walls from afar.
- **Turf and still water.** `S.noRock` keeps bare rock, scree and the wave-cut shore shelf off the earthworks and the sandy foreland (the shelf would raise a bar along a sandy beach). `S.calm` keeps surf and shingle out of the ditch, the sea front and the lagoon. Both are read by `src/03_wild.js`.
- **Its own meshes** (`S.own: [3600, 800]`). The other landmarks are merged into one mesh that is always drawn. The fort has about 105,000 triangles, so it is kept apart: it is left out beyond 3.6 km and when out of view, and its small detail (stakes, guns, rocks: two thirds of it) beyond 800 m.
- **Poles** (`S.poles`, `sitePoles` in `src/03_sites.js`). Masts, the flagstaff and the beacon's post are also drawn as upright strips never narrower than a pixel, so they do not break up with distance.
- **The sighting point** for surveying is the windmill (`SIGHT_AT.fort` in `src/11_survey.js`).

## What it changes elsewhere in the game
- **Far roads and rivers** (`wFarR`, `wFarRO`). They were pulled forward in depth by a polygon offset that grows with the angle. At a grazing angle that came to hundreds of metres, so roads a kilometre off showed through walls as pale dashes (first seen on the fort's sea wall, and also on a hillside near Halewood). They are now drawn a twentieth of their distance nearer, no more. Eight views elsewhere were compared before and after: roads, rivers and field strips still show.
- **Walking on built floors.** The rule that refuses steep ground (`wildFooting` in `src/09_player.js`) now lets a floor built over it be walked on. This applies everywhere.
- **Dune grass** (the marram on beaches) now keeps off solid things and cleared ground, like the other small plants.
- **Inland rise and tree line** are measured from the coast without the fort's point (`coastInland` in `src/03_terrain.js`).
- **A site's own ground** (new hooks, read by `src/03_wild.js` and `src/04_city.js`): `S.sand` (bare sand as a soft overlay), `S.rock` (bare rock), `S.mud` (wet mud) and `S.tint` (a colour for its ground). Only the fort uses them so far.

## The home country's plan
The plan of the home country is a sequence of draws, so anything that takes part in it shifts what comes after. The fort is marked `S.quiet`: with `QUIET` set, the rivers are planned as if it were not there, and each river then keeps the bends it had (`src/03_water.js`, a second, cheap run of the same planning). Only what lies near the fort is planned anew. Six seeds against commit 902c9ea (Relief beyond home), measured on the finished build:

| seed | villages with one still within 150 m | river points moved | farmsteads moved | tracks moved beyond 6 km from the fort | river trench faults |
| --- | --- | --- | --- | --- | --- |
| 0 | 47 of 53 | 11 % | 11 % | 0 | 6 → 3 |
| 1 | 43 of 49 | 18 % | 18 % | 4 points | 3 → 3 |
| 2 | 46 of 48 | 2 % | 7 % | 0 | 4 → 4 |
| 3 | 46 of 49 | 5 % | 11 % | 395 points | 6 → 6 |
| 4 | 53 of 54 | 1 % | 4 % | 0 | 8 → 8 |
| 5 | 43 of 45 | 4 % | 5 % | 0 | 8 → 9 |

- **Still different everywhere:** which village bears which name (names are handed out in order) and the exact edges of most field strips (82–99 %, they depend on running numbers).
- **River trenches.** An earlier version of the fort, before it was made quiet, had 72 trench faults in seeds 0–5 where the base commit had 35. That was chance: redrawing the same plan with other numbers and no fort gave 35 to 65 (mean 51), and with the fort 36 to 72 (mean 51).

## How it was checked
- **Walk test** in seeds 0, 1 and 2: in over both bridges to the parade, up onto the north-west bastion, refused by the palisade, the moat and the parapet, and by fast travel along the road. The walks at Halewood, on the Giant's Ridge and over Corrinvale's bridges still pass.
- **Data** (`tools/invariants.py --world 0-5 --town 0-1`): 19 of 20 checks pass in every seed. `rivers.trench` fails with and without the fort (33 places over six seeds with it, 35 without).
- **Endless world** (`tools/endless.py 0 1 2`): no failures.
- **Cost.** Loading takes 9.4 s instead of 8.7 s (median of five runs each, in turn, headless on the same machine). In the city the game draws no more than before (453,000 triangles). At the fort it draws 336,000–385,000, which is 81,000–87,000 more than that stretch of coast had. The ground near the fort takes longer to build as you walk (a patch on the foreland 1.9 s instead of 1.4 s, inland 2 km away 1.95 s instead of 1.85 s), spread over frames as it streams in.
- **Looked at** by day in seeds 0, 1 and 2, and at night in seed 0.
- **Critics.** Two critics (a game artist and a historian of fortification) judged pictures from three seeds, from the sea, land, hillside, air and inside, in five rounds:

| round | artist | historian |
| --- | --- | --- |
| 1 | 6 | 6 |
| 2 | 6.5 | 7 |
| 3 | 7 | 7 |
| 4 | 7 (sea 6.5, land 6.5, hillside 6, air 7.5, inside 7.5) | 7 (6.5, 7, 6, 8, 7.5) |
| 5 | 7.5 (7.5, 7, 7.5, 8, 8) | 7.7 (7, 7, 8, 8.5, 8) |

  It stopped at the limit of five rounds, short of the 8 it was meant to reach. After round 5 what they called broken was mended, the windmill moved from the north-west bastion to the north-east one and a cavalier was built in its place. Those changes have not been scored.
- **The land round it** was reworked afterwards because it was too symmetrical: the two sides of the point had been mirror images. Two more critics (a landscape artist and a coastal geographer) judged it in three rounds, from the sea, the land, the hillside and the air:

| round | artist | geographer |
| --- | --- | --- |
| 1 | 6 (sea 6.5, land 5.5, hillside 6, air 6) | 6 (6, 5, 6, 6.5) |
| 2 | 6 (7, 6, 6, 5) | 5.5 (6, 5, 5, 6.5) |
| 3 | 6.5 (7, 6, 6.5, 6.5) | 6.5 (7, 6, 6.5, 6.5) |

  From round 1 on, both said it no longer read as too symmetrical from the sea or the ground; from round 3, from above as well. It stopped at the limit of three rounds, short of 8. Their main complaints left at the end: the foreland's ground still reads as much the same turf at walking height, the lagoon looks like a canal from its bank, there is no paler shallow water or foam off the beach and the point, and the hill is still a fairly smooth slope. A few faults they named after round 3 were mended unscored (a dam left standing in open water on the west, the barrier's boom, the landing's boats, the reefs).
- **Not checked:** an iPad, and the fort in rain or fog.

## Left for later
- The parade is still bare for a garrison of its size, and only eight people live in and about the fort.
- The sea has one colour up to the shore: no paler shallows or foam off the beach and the point.
- The foreland's ground zones (dune, slack, heath) show from the air more than at walking height.
- The main gate, the ravelin and the hill path use simple shapes close up.
