# Improvements for later

Things to improve, noted while playing. They are for the future: none of them is to be started without being asked, and the ideas under each are ideas, not decisions. Numbers stay fixed so an item can be named by its number; new ones go at the end.

Code references are as of the day an item was written down. Check them before building from them.

## Open

### 1. Kestrel Tower makes no sense (2026-11-12)
It reads as just a medium-sized tower in a valley. It needs a reason to be there and a form that shows it: it is meant to keep a high pass. Same trouble as item 16.

### 2. The Ninefold Stones are too small to feel remarkable (2026-11-12)
Make the stone circle bigger.

### 5. The main menu shows the version and recent changes (2026-11-12)
The title screen has no version and no list of what changed.

### 6. Pilgrim's Rise, the starting point, makes no sense (2026-11-12)
A crag north-east of the city walls (`src/03_terrain.js`). Its name and lore may be the user's call; the names are stand-ins (`docs/SETTING.md`).

### 7. A better name than Aldhaven, and a better subtitle (2026-11-13)
The title screen reads "Merrow Bay, 1652 / Aldhaven / ~ A Port and its Country ~" (`src/template.html`). Aldhaven is both the city and the game's title (page title, `dist/aldhaven.html`, the save keys `onecity_aldhaven_*`), so a rename touches all of these and the mapping of old saves in `src/12_main.js`. The user will want a say in the name.

### 9. The music mix (2026-11-13)
The plucked instruments (harp and pizzicato, Karplus-Strong plucks in `src/02_music.js`) are still too loud, and the default music volume (`settings.music`, 0.5 in `src/00_core.js`) is a bit too loud.

### 11. Halewood House feels in the middle of nowhere (2026-11-13)
It sits on its own ground near Corrinvale, with a 1 km axis of avenue, gardens and rides and nothing lived-in around it. The fix is more along and around it, not a shorter axis.

### 12. A phone layout for the survey screen (2026-11-18, put off by the user)
The iPad is fine both ways round. On phones (checked headless at 844×390 and 390×844, touch on):
- In portrait the field book (316 px wide) runs into the map's −, + and Close map buttons, and its ◂ fold button is hidden under −. Folded, its tab is under − and +, and the Debug panel lies on top of the field book.
- While sighting, the +, − and Bearing buttons cover the spyglass's lines of text.
- In landscape the field book runs over the help text, and the Debug panel only fits by scrolling.
- On the iPad in portrait, the round − button covers the end of the sighting hint.

Planned, not built: a layout for narrow screens (the field book below the map buttons and folded at first, the help text shortened or hidden, the spyglass buttons moved clear of the text). The general touch bar shrinking to 30 px in phone landscape was left out as not part of surveying.

### 13. The game's own cursor, and a way to deal with an unlocked pointer (2026-11-27)
The game has no cursor of its own: the system arrow, and a pointing hand on buttons (`index.html`). Looking with the mouse uses pointer lock (`requestLock`, `exitLock` and `onLockError` in `src/11_ui.js`, `pointerlockchange` in `src/12_main.js`). If the lock is let go during play (Esc, the window losing focus) the pause menu opens. If it can't be had at all on the first click, `enableFallback()` turns on dragging to look, and the arrow keys.

Still to ask: what should happen while the pointer is free (play on with a cursor, turn at the screen's edges, a clearer way back in), and whether the cursor is for menus and the map only or for play too. Touch on the iPad has no cursor and must not change.

### 14. Large-scale variety is too far apart, perhaps by half (2026-11-27)
Things at a very large wavelength, such as the regions (biomes), the distance between places worth seeing, and the mountains and the rise and fall of the land, are generally too far apart and could probably be cut in half. The settings today:
- `REGION.cell` is 5600 m (`src/03_regions.js`): a region is 15 to 60 minutes' walk across.
- The lie of the land (`wildRelief` in `src/03_terrain.js`): in the home country, uplands and lowland plains follow a field 2800 m across, ranges run along the zero lines of a field 2400 m across, and their massifs are built at 760 m and 410 m. The home country (20 × 20 km) is closed by mountains too steep to climb. Beyond it the uplands, ranges and crags are already drawn at 0.40 of that size (`RELIEF.k`) and the valleys at 0.72 (`RELIEF.kv`, kept wider so their sides don't become walls). Still to ask: whether the user means the home country, the land beyond, or both.
- Small places are tried once in each 700 m cell (`POI.HC`), and 42 % of the cells are tried at all, so they lie about 1 km apart (`src/03_poi.js`).
- Villages, hamlets and farmsteads come from the settlement plan (`src/03_settle.js`).

This is the same direction as making places denser without making them smaller: halve the spacing, keep the size of the whole. In the home country it would move hills, rivers, villages and places (the `LEGACY = 1` plan; the rivers follow the ground, so a change to the relief moves nearly everything), so there it needs the user's decision. Beyond it, change freely. Check with `tools/digest.py --diff` and `tools/endless.py`.

### 15. Fast travel stops too far from a landmark it finds (2026-11-27)
Travel stops the moment a landmark is found (`src/11_travel.js`, `Sites.update`), and a landmark is found from its `discR`, 200 to 520 m from its middle: Greywatch 240, the Ninefold Stones 200, Mirrormere 330, Kestrel Tower 260, Gullscar Light 260, Halewood House 520, the Giant's Ridge 300, Fort Merrow 330, a town its own size plus 260. At walking pace (3.9 m/s) that leaves one to two minutes still to walk. Small places stop you at 55 m, which is fine.

An idea: still find it at that distance (it goes on the map), but travel on to near it (its gate, or the point of the road nearest to it) before stopping.

### 16. Fort Merrow needs much more attention to detail, and it protects nothing (2026-11-27)
The fort (`src/03_sites_star.js`, `docs/FORT.md`) stands on a low point on the western shore of Merrow Bay, about 4.3 km west of Aldhaven, placed to command the roadstead, where four ships ride at anchor. What it guards doesn't read: it is not at the bay's mouth, a narrows, the entrance to the city's harbour or a river mouth, and an anchorage alone doesn't explain it.

Ideas: move it to where it visibly closes a passage, or give it something beside it worth guarding. Still to ask: which details look thin (walls, guns, the inside, people, the land round it). It is the same in every world and marked `S.quiet`, so the home rivers ignore it, but moving it still changes the home plan: check with `tools/digest.py --diff`.

### 17. Music starts abruptly, with no fade in or out (2026-11-27)
In `src/02_music.js` (`Music`) a new piece gets a fresh bus whose fade gain is already at 1, and its first notes sound 0.3 s after `start()`, so it comes in at full strength. The only fade is `fadeOut()`, with a time constant of 1.1 s (nearly silent after about 3 s). It runs when the mood changes, for example on entering a new place (the new piece then starts 3 s later), and when a piece has played to its end (then a pause of 80 to 200 s, or 2 s with pauses off). So a change of place cuts the music off in mid-phrase in about 3 s. Turning the music volume down to 0 fades it the same way. The old pieces (`Legacy`) start the same way.

Ideas: a fade-in on the bus at the start of each piece (several seconds), a longer fade-out on a change of place, and pieces that open quietly. Check by ear with `tools/music.py`.

## Done

- **3. The world should not end** (2026-11-12): the world goes on as a lattice of countries, with roads running out of each. Merged in PR #3, notes in `docs/ENDLESS.md`.
- **4. Elder Scrolls names and lore replaced** (2026-11-12): stand-in names, listed in `docs/SETTING.md`.
- **8. Finding a village no longer stops fast travel** (2026-11-14): merged in PR #2.
- **10. More kinds of road** (2026-11-14): high roads, cart tracks, lanes, green lanes and hollow ways by the traffic they carry. Merged in PR #2.
