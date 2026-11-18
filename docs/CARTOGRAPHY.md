# Cartography: surveying the land yourself

First built 2026-11-18. The idea: find where you are, and later map new land, with the instruments of a 17th-century surveyor (18th-century borrowings are fine). The model is the triangulation in *Miasmata*, but here the player does the drawing. You sight landmarks with a compass, then lay their bearings on the map with a ruler and draw the lines yourself.

This first version does one thing: **fix your own position from landmarks that are on your map** (in surveyors' terms, a resection). Mapping new landmarks, drawing roads and rivers, measuring heights and the other instruments are for later (see the end of this file).

## Playing it

- **K** takes out the kit: a sighting compass with a small spyglass. K again puts it all away, and so does walking.
  - Aim at a landmark and **click** (or press Enter or Space) to note its bearing in the field book. The card under the sights shows the needle's reading at the red lubber line.
  - The needle lags when you turn, swings past and settles in about a second and a half, with a small tremble of the hand after that. A bearing taken while it still swings is off.
  - Readings are rounded to the half degree, as you would read them off the card ("247½°").
  - The **wheel** (or + and −) works the spyglass, ×1 (the plain sights) to ×10. Through it the view turns more finely and far things stand clear of the haze in proportion (see "Why a spyglass" below).
  - Bearings taken within 30 m of each other belong to one station. Walk on and the next bearing starts a new station.
- **M** with the kit out opens the map as a **survey sheet**, with the field book and the ruler. M or Esc goes back to the compass.
  - Gold circles mark the points you can sight on the map: Aldhaven's Bell Tower and Lighthouse, Corrinvale's Belfry and Cathedral, the two named peaks of the western mountains (the Spindle and Harrow Fell, at their summits), and each landmark you know of, at its tower, steeple or keep rather than the middle of the place.
  - Drag the ruler by its body to move it. Its pin settles into a landmark dropped near it.
  - Turn the ruler by the knobs at its ends: by mouse or finger, by two fingers twisting on a tablet, with `[` and `]` (0.1°, or 1° with Shift), Shift+wheel, or the ↺ ↻ buttons. The ruler always shows both bearings of its edge (for example `075.0° · 255.0°`), so you turn it to the number in your field book, either way round. There is no adding 180°.
  - **Draw line** (Enter) draws a pencil line along the ruler's edge, carried on across the whole sheet as with a long straight-edge, because the landmarks stand kilometres off.
  - Two lines cross where you stood. A third leaves a small triangle (the navigator's "cocked hat") whose size shows how good the fix is.
  - **Mark my position**, then a tap, puts a numbered mark on the sheet. **Undo** and **Clear sheet** (tap twice) take lines and marks off again. **Ruler here** brings the ruler back to the middle. The ◂ button folds the panel into a tab so a small screen shows the map.
- On a tablet, the top row has **Survey**, which reads **Put away** while the kit is out. While sighting, **Bearing**, **+**, **−** and **Sheet** take the place of Use and Jump. Drag on the right to aim, as usual.

## Where a game begins

New Game first asks where to begin:

| Start | Where | The map |
| --- | --- | --- |
| Aldhaven | Pilgrim's Rise, as before | shows where you are, as before |
| Corrinvale | the Grand Square, facing the belfry | shows where you are; Corrinvale is found |
| The edge of the known map | a flat shoulder of the western home mountains at (−8800, −9000), 420 m up, 1.2 km inside the border, facing east | does not show where you are; every landmark of the home country is on it, and the home mountains all round out to their outer foot; the land beyond is blank paper |

From the edge start, seven landmarks are in sight and well spread for crossing lines: two peaks of the range behind you and five landmarks of the country below. Bearings and distances:

| Landmark | Bearing | Distance |
| --- | --- | --- |
| the Spindle | 294° | 1.1 km |
| Harrow Fell | 354° | 2.3 km |
| Corrinvale | 55° | 8.1 km |
| Halewood House | 75° | 5 km |
| Mirrormere's chapel | 100° | 4.5 km |
| the Ninefold Stones | 105° | 12.9 km |
| Greywatch | 134° | 8.8 km |

## The known map and its two peaks

Added 2026-11-18, after the first version: the mountain range at the edge start has to be on the map entirely, with two of its peaks named.

- **The known map** is the home country and all of its mountains, out to their outer foot. In the code that is `Survey.known`: inside the home country's box, or less than 2.6 km beyond the middle of the home mountains (`homeFlank` in `03_terrain.js`).
  - The middle runs about 350 m beyond the old crest line. The range falls away to nothing within 2.4 km of it (`HOME_FALL`, 2 km, plus up to 420 m where its foot runs in and out).
  - At the edge start's latitude the crest lies just inside the box, at x ≈ −9400 to −9900. The outer flank falls west to about x ≈ −12 400 (the edge at z = −9000). Before, the blank paper began at the box, x = −10 000, and cut the whole outer flank off.
  - The edge of the known map (`Survey.edge`) is a line of points found by stepping out from the box's west, north and east sides, and round its two northern corners, until the known land ends. Blank paper lies beyond it, with a dashed edge.
  - *In the known land* (the position switch) and the places hidden on blank paper use the same test.
- **The mountains beyond the box are drawn** even where the countries beyond are not planned yet (`MapView.ringImage`): a picture of the known land outside the box, at the home country's scale and on its pixels.
  - It reaches two pixels into the box, under the home country's own picture, so no gap shows. A country planned later is drawn over it, with its rivers and roads.
  - It is about 39 000 pixels and takes some 0.45 s to make, the home country's picture about 1.2 s (headless timings). Both are made a little each frame from the title screen on (`MapView.work`: 6 ms a frame at the title, 3 ms in play). The map used to make the home country's picture when it was first opened, which stalled that first opening.
- **The two peaks** (`PEAKS` in `11_survey.js`, stand-in names until the story returns):

  | Peak | Summit | Height | From the edge start | What it is |
  | --- | --- | --- | --- | --- |
  | the Spindle | (−9821, −9452) | 1116 m | 294°, 1.1 km, 32° up | a sharp horn; 139 m above everything 200 m round it |
  | Harrow Fell | (−9032, −11277) | 1122 m | 354°, 2.3 km, 16° up | where the ridge north of the start ends in a point and drops 11° on the skyline to the east; 118 m above everything 200 m round it |

  - I chose them from the skyline seen from the edge start: for each half degree of bearing, the highest point in sight out to 9 km, and the summits of that skyline. I checked them on daylight views with the points projected onto the picture.
  - A third summit at 213° looks like a peak from the start, but it is a shoulder of a higher top behind it, so it was left out.
  - Each peak's position is taken as the top of the ground near the given point (`Survey.peaks`), so it sits on the summit under any seed.
  - The peaks are on the map at every start (a triangle and the name) and are sighting points like the landmarks.
  - Both lie just inside the home country.

## The debug panel

The **Debug** button at the right edge of the map, under the zoom buttons, opens a panel with the switches below. They belong to the game, are saved with it, and each start sets its own defaults.

- **Your position on the map**: *Always* (as the game was), *In the known land* (shown inside the home country and its mountains, hidden beyond their outer foot), or *Never*. When the map does not show you, it also stops centring on you and stays where you left it. The travel panel and the map's destination box leave out distances and directions, and a journey's route line is not drawn, because each would give your position away.
- **Land beyond the known map**: *Drawn as you go* (as the game was: countries you pass through appear on the map), or *Left blank*. Blank paper lies beyond the outer foot of the home mountains (see above), with a dashed edge; places found out there are not shown.
- **Compass needle**: *Swings and settles*, or *Steady and exact* (it reads your true heading, for testing).
- **Check your fixes**: *Show where you are* draws your true position as a red cross. Each mark gets a dashed line to where you really stood when you made it, labelled with how far off it was. The field book then lists each bearing's true value, and the sights show the true heading.

Defaults: Aldhaven and Corrinvale start with *Always*, *Drawn as you go*, *Swings*, *Hide*. The edge starts with *Never*, *Left blank*, *Swings*, *Hide*. Games saved before surveying existed load with Aldhaven's defaults.

*Never* is the edge default because with *In the known land* the start spot (inside the home country) would show your arrow. Beyond the border no known landmark can be seen yet (next section), so there would be nothing to fix.

## Measurements behind the choices

- **From the passes no landmark is in sight.** I traced sight lines over the ground along each of the three home passes, from 3 km outside to 2.5 km inside the border. Outside the border, nothing could be seen. The border mountains hide the home country, and the pass cols are too low and narrow to see through. On the inner side the first landmarks appear 1.5–2 km in (Greywatch and the Ninefold Stones from the west and east passes, Corrinvale's belfry from the north pass). So the edge start stands on the inner side, high up, and the unknown lies over the crest behind it.
- **Why a spyglass.** The game's haze is far thicker than real air. On the ground in the lowland the fog closes at some 400–600 m. On a mountain at 650 m it closes at about 2.7 km (`updateSky`: fog distance grows with height). The landmarks stand 4–13 km from the edge start. So the sighting view narrows the field of view by the spyglass's power and stretches the fog by the same factor. At ×8–10, Corrinvale's belfry and the cathedral's twin spires stand clear at 8 km, and Halewood House and its obelisk show at 5 km. Greywatch at 8.8 km is hard to make out: a small grey block on the far hills. The ordinary view is untouched.
- **The whole chain works** (`tools/survey.py`).
  - At the edge start, bearings taken with the exact needle to each landmark in sight come out within the half degree of rounding.
  - Laid with the ruler, the lines cross 18–114 m from where the player really stands. That is what half a degree means at 5–13 km.
  - The only bad crossing is Corrinvale's belfry against its own cathedral, 100 m apart on almost the same bearing, which is a useless pair, as it should be.
  - With the two peaks: the Spindle reads 294° (true 293.9°) and Harrow Fell 354° (true 354.2°).
    - Their lines cross the others 10–20 m from the true position, because they stand only 1–2 km off.
    - Two pairs are poor, as expected, because the Spindle and the far landmark lie almost opposite each other: the Spindle against the Ninefold Stones and against Mirrormere (270 m and 515 m off).
  - Driven with real mouse and touch input:
    - the pin dragged near Halewood House settles into it;
    - a knob dragged 30° round turns the ruler 30.0°;
    - `]` turns it 0.1°;
    - a two-finger twist of 20° turns it 20.0°;
    - Draw line and Mark each add their item.
  - The swinging needle is 35° behind just after a 40° turn, under 1.3° off after 1.6 s of game time, and within a few tenths after that.

## The map's speed

Added 2026-11-18, after the first version, because the map was very slow. What it did:
- It drew everything anew eight times a second while open (for the pulsing objectives), and on every move of the ruler, every step of a drag and every wheel event (a trackpad sends dozens a gesture).
- Each drawing stroked every piece of every road and lane in the world, and filled each field on its own.
- The 3D world went on rendering behind the map, which covers the whole screen.
- On a big screen a full drawing took 0.1–0.2 s.

What it does now (`MapView.draw` in `src/11_ui.js`):
- **Two layers.**
  - The kept layer (`drawBase`) holds the land, the ways, the fields, the towns and the landmarks. It reaches a fifth of the screen beyond each edge and is kept until the view moves too far, the zoom changes, the window is resized, a country is planned, or a debug switch changes.
  - The top layer is drawn each time: the objectives, the route, the pencil lines, the labels, the ruler and you. The ruler's moves, the pencil and the 8-a-second pulse draw only the top layer.
- **Gestures slide the kept layer.**
  - A drag slides it, and a zoom (wheel, trackpad, + and −) stretches it, at most once a frame (`MapView.later`).
  - 250 ms after the gesture rests, the kept layer is drawn anew round the view, if the view has moved far or zoomed.
  - The wheel now zooms by the size of the scroll: a notch of a mouse wheel still zooms by a fifth, and a trackpad's small steps add up to the same.
- **Fewer, bigger strokes.**
  - The fields and houses are gathered into one path per colour. These paths have no `closePath`: closing each of thousands of shapes by hand grew slow, and a fill closes them anyway.
  - The ways are one path per kind. A way whose bounds lie out of view is skipped, and so are the pieces of a way that lie out of view.
- **No 3D world behind the map** while it is open.

Measured headless, on a software canvas with each drawing forced to finish (`getImageData`), at the edge start, 1568×713. Times are in ms; the before column is the build before these changes, and pan and zoom are one step.

| Zoom | Full drawing, before → now | Ruler or pulse, before → now | Pan, before → now | Zoom step |
| --- | --- | --- | --- | --- |
| 0.06 (as opened) | 137 → 190 | 145 → 1.8 | 136 → 6 | 5 |
| 0.15 | 85 → 54 | 78 → 1.9 | 81 → 3 | 6 |
| 1 | 95 → 28 | 83 → 1.8 | 62 → 3 | 6 |
| 3 | 80 → 16 | 69 → 1.7 | 43 → 2 | 5 |

At twice the pixel density (3136×1600), the ruler takes 7–9 ms and a pan step 8–15 ms, against 55–220 before. The full drawing at the farthest zooms is larger than before (0.1–0.35 s) because the kept layer covers more than the screen, but it now happens only when the map opens and after a gesture rests. With the map open and idle, frames no longer stall: the median was 317 ms and the slowest tenth over 2.5 s before, against the headless browser's 33 ms cap now.

## In the code

- `src/11_survey.js`: everything of the mode. The object is `Survey`, its state per game is `G.flags.survey` (saved with the flags).
  - `G.flags.survey` holds `start`, `opts`, the field book `reads` (each with the true heading and position, used only for checking and for stations), the sheet's `items` (lines and marks), the `ruler` (pin position and angle), the map `view` and `home` (where the map opens when it does not show you).
  - The rest of the module: the start menu and placement (`chooseStart`, `place`, `welcome`), the needle and the spyglass (`update`, `applyFov`, `lookK`, `fogK`), the sighting card (`hud`, with the text in `#survinfo` so it stays crisp), the sheet (`panel`, `drawMap`, `drawTop`, the pointer handlers) and the debug panel.
  - The sighting points are in `SIGHT_AT`. A new landmark needs an entry there to be sightable.
- Hooks elsewhere:
  - `onKey` and the mouse and wheel handlers in `src/12_main.js`. The map's pointer handlers there give the ruler first claim.
  - `updatePlayer` (finer look through the spyglass, walking puts the kit away, no jump while sighting).
  - `updateSky` (fog × spyglass power).
  - `MapView` in `src/11_ui.js`: centring, blanking the unknown, the arrow, the survey layers, the legend and the destination box's distance.
  - `drawHUD` (the card replaces the compass strip).
  - The travel panel (no distances when the map does not show you).
  - `Touch` (the buttons).
  - `#mapsurvey`, `#mapdebug` and `#survinfo` in `src/template.html`.
  - `#mapc` has `touch-action: none` so two fingers twist the ruler instead of pinching the page.
- Surveying's own map pieces:
  - in `src/11_survey.js`: the peaks (`PEAKS`, `Survey.peaks`), the known map and its edge (`Survey.known`, `Survey.edge`, `Survey.blankOut`);
  - in `src/11_ui.js`: the picture of the mountains beyond the box (`MapView.ringImage`, made by `ringGen` in the background through `MapView.work`, called each frame from `frame` in `src/12_main.js`) and the colouring of the map's pictures (`MapView.tint`, shared with the countries' pictures).
- `tools/survey.py [OUTDIR]` plays all of the above headless and writes screenshots (start menu, each start, the spyglass at each landmark, the sheet, the debug panel, tablet views).
- Nothing about the land, the rivers, the ways or the settlement plan changed, so the home country's plan is as it was.

## Known limits of this first version

- Beyond the border no known landmark is in sight (see above), so finding yourself there has to wait for the next step.
- The field book does not record which landmark a bearing was taken to. You remember it, or keep the order.
- The compass points to true north: there is no magnetic declination yet.
- Fast travel still knows where you are (it routes from your true position). Only the distances and route line it would show are hidden.
- Zoomed into the open country, the map's relief is coarse, as it always was. Very close in (zoom about 0.5), a faint line shows where two pictures of the land meet: the home country's and the mountains beyond it, or two countries'. Each picture is smoothed only up to its own edge.
- At the edge start's latitude the snow on the map's crest begins right at the old border for a few kilometres. That is the ground, not the map: the range's outer wall happens to run along x = −10 000 there and climbs some 100 m across one 66 m pixel of the map.
- The full drawing of the map at its farthest zooms takes 0.1–0.35 s headless (mostly the thousands of fields). It happens when the map opens and when a drag or zoom comes to rest.
- If the map is opened within a few seconds of loading the page, it finishes the pictures of the land then, up to some 1.6 s headless.

## Next steps, in the order they would make sense

1. **Mapping new landmarks (intersection).** From two places you have fixed, sight the same new thing and draw a line from each; where they cross, it goes on your map under a name you give it. This is what carries the map beyond the border, where the known landmarks are hidden.
2. **Signals.** Survey poles, flags or cairns you plant on hilltops, to have something to sight where nature offers nothing distinct. Alternatively, or as well, a chain of **beacons** on the home range's summits. These are visible from both sides of the border (lit at night: sighting by beacon fires), and English beacon chains were real in the 1580s. Either would make the edge of the known map surveyable from outside.
3. **Drawing the land between the fixes**: roads, rivers, coast and woods in pencil, then ink. Possibly a **waywiser** (the wheel that counts distance as you walk; Ogilby measured his road atlas *Britannia*, 1675, with one) for traverses along roads.
4. **Heights.**
   - A **quadrant** with a plumb line: the angle up to a summit, its "shadow square" giving the ratio directly, times the distance off your map.
   - A **barometer** (Torricelli 1643; Pascal's Puy de Dôme experiment 1648): a reading on the shore of Merrow Bay and one on the summit. If air pressure followed the game's weather, a front coming in between the readings would spoil the height.
   - **Levelling** with a water or spirit level (Thévenot, 1661) and a staff, for short, precise runs such as Corrinvale's canal.
   - Hills drawn as 17th-century "molehills", then spot heights, then contours (an 18th-century idea; the Dutchman Cruquius used them for river depths around 1730).
5. **Finer instruments**: a graphometer or theodolite for angles finer than a compass gives; **magnetic declination** (the compass off true north by a different amount in each country, found from the sun at noon; Gellibrand showed in 1634 that it drifts over time).
6. **A hotbar** for the instruments, if the game gets an item interface.

Historical reference points:
- the plane table (late 1500s), a drawing board on a tripod with a sighting ruler, the alidade, used to draw the map in the field;
- Gunter's chain (1620) for baselines;
- the Dutch telescope (Middelburg, 1608);
- Snellius's triangulation of Holland (around 1615), which also solved the three-point resection.
