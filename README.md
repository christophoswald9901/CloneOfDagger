# Daggerfall: One City

A small first-person RPG in the spirit of *The Elder Scrolls II: Daggerfall* — squeezed into a single, sprawling walled port city. An unofficial fan tribute; not affiliated with Bethesda Softworks. All textures, sprites, sounds and music are generated in code at load time.

## Play

Open `index.html` in a desktop browser (Chrome, Firefox, Edge). It loads three.js and the fonts from public CDNs, so it needs an internet connection. Click the view to capture the mouse.

If the browser blocks file access, serve the folder instead:

```bash
python3 -m http.server 8765
```

then open http://localhost:8765.

## The premise

It is 3E 405. The Emperor sends you to Daggerfall: the ghost of King Lysandus stalks the streets every night crying for vengeance, and an imperial letter to the court has vanished. Report to King Gothryd at the castle, descend into the Catacombs beneath Arkay's graveyard, deal with the necromancer Vharzal, and lay the old king to rest.

## What's in the city

- **An organic city plan.** An irregular wall with round towers and three gatehouses wraps the city on land; on the Iliac Bay a lower sea wall closes the waterfront, with a water gate for each pier and square towers along it, and the beach left at its foot. You can walk the beach outside the walls down to the water's edge. Streets grow from the Grand Market outwards: avenues run to the gates, the castle and the docks; a ring road circles the centre; streets branch off the avenues, lanes off the streets and crooked alleys through the poorer quarters. Roads that meet form junctions, so the network has both loops and dead ends. Every building faces its street, whatever angle that street runs at.
- **Pilgrim's Rise.** A new game starts on a stone lookout on the hill north of the walls, with the whole city below you: castle in front, market beyond, harbour and bay at the back. A footpath winds down to the North Gate road. The view distance grows with height, so the city stays visible from up there.
- **A country 20 km across.** Past the fields round the city the land goes on for some 10 km to either side and 18 km inland, generated as you walk. The hand-made fields carry on into generated farmland: blocks of hedged strips along the contours, hedged pasture on the slopes and farmsteads by the tracks, thinning out into woods, heath, river valleys and mountain ranges with crags, scree and snow. The rivers are planned for the whole country at once, so every one runs downhill, joins larger ones and reaches the sea. Near the city a hand-laid stream rises north of Pilgrim's Rise and meets the bay east of the walls under a stone bridge on the East road. Dirt tracks run on from the gates through the valleys, wade the small rivers, cross the big ones by bridges and end at farmsteads. High mountains close the country on its three land sides; no one climbs sheer rock out there. Add `?seed=N` to the address for a different country; the city and its surroundings stay the same.
- **Landmarks with fixed scenery.** Five places look the same in every country, whatever the seed: **Greywatch**, a broken keep on a crag west of the city; **the Ninefold Stones**, a stone circle on a bare hill to the north-east; **Mirrormere**, a fishing hamlet with a chapel and a jetty on a mountain lake far to the north-west; **Kestrel Tower**, a watchtower in a pass between two peaks deep inland; and **Gullscar Light**, a lighthouse on a cliff headland on the eastern coast. Their ground, woods and buildings are fixed, and the generated country blends into them over some hundreds of metres along a ragged line. Each has a road of its own that runs out to the tracks. Coming within sight of one puts it on the map.
- **Corrinvale, a second city.** About 13 km north of Daggerfall, on a flat plain, stands a walled town some six times Daggerfall's size, on flat ground where Daggerfall grew on its hill. A small old town laid out in a strict grid, ringed by a boulevard, holds the great buildings; around it looser quarters, each laid out at its own angle and block size (tiny blocks in the Tanners' Ward, big garden blocks in the Commons), fill an irregular wall with towers, gatehouses and a moat. A canal runs through it with stone quays, humped bridges, barges and cranes; the streets are lined with tall, narrow, gable-fronted houses in brick (many with stepped gables), stone and timber, under slate and tile, with yards and gardens behind. Its quarters (the Old Town, the Grand Square, the Cathedral Close, the Citadel Ward, the Canal Quarter, the Weavers' Quarter, the Tanners' Ward, the Commons) each build in their own way. Its landmarks: the Grand Square with its market and a belfry some 80 m high over the cloth hall, the Cathedral of Saint Aurel with its spires, the citadel, the covered market hall, windmills on the plain, and suburbs along the roads out of each gate. Every house, inn and shop can be entered; townsfolk and the watch walk its streets. It has a road out of every gate, and fast travel by road runs through its streets. The town comes from a reusable generator (`src/04_town.js`, notes in `CITIES.md`).
- **Things to stumble on.** About two hundred small places are scattered over the generated country (they change with the seed): wayside shrines and broken-down carts by the tracks, woodcutters' huts and hunters' camps in the woods, abandoned cottages, old wells and great oaks in the open, cairns, dolmens and standing stones on the heath and the tops. Each one goes on the map when you find it.
- **Travellers on the roads.** Merchants, pilgrims, farmers, couriers, road wardens, peddlers and the odd knight walk the tracks out in the country, fewer at night. Ask them what is worth seeing and they tell you of the nearest landmark you have not found yet, and it is marked on your map.
- **Fast travel on foot.** You walk the real way while the whole world runs faster (×5 to ×40; the clock, the people and the weather speed up with you). Press T (or tap Travel) away from a carriage stop to walk straight on, to follow the road you stand on to the next fork, or to set off for a landmark you know, by road or straight there. On the map, zoom out over the whole country, drag to look around and tap any place to travel there by road (city streets, gate roads, tracks and the landmark roads form one network) or straight across country. Corrinvale is known from the start, so you can set off for it at once. The view turns with the road as you go; look about with the mouse or a drag and it swings back to the way ahead a moment after you let go. Any key, a tap on the banner or a movement of the stick stops you; so does finding a landmark or a place of interest, danger nearby, water or a wall in the way. A stopped journey can be taken up again from where you stand: press Enter, tap the banner, or choose *Go on* in the travel panel or on the map (which also shows the rest of the way) (it is forgotten once you wander some 150 m off or go indoors).
- **Seven quarters**, each with its own wealth, architecture, spacing and street surface:
  - *Kingsward* — manors of pale stone behind hedges and garden walls, flagstone streets, trees
  - *the Market Ward* — tight rows of half-timbered houses whose upper floors overhang the cobbles
  - *the Temple Quarter* — quiet stone and plaster streets around the Temple of Arkay
  - *the Forges* — brick smithies and workshops with barrels and crates by the doors
  - *the Docks* — warehouses on the quay, three piers reached through water gates in the sea wall, a merchant ship, a breakwater and lighthouse
  - *the Warrens* — thatched shacks at crooked angles along muddy alleys, few lamps, more thieves after dark
  - *Tanners' Row* — modest cottages and workshops on gravel lanes
- **Landmarks:** Castle Daggerfall, the Grand Market with its fountain and stalls, the Lysandus Memorial (where the ghost walks at night), the Queen's Garden with hedges and a pond, the Bell Tower, the Temple of Arkay and its graveyard, the House of Mercy (a hospice), the Mages Guild tower, the Fighters Guild and its training yard, Beggar's Well, the Fish Market and the lighthouse.
- **The Daggerfall Carriage Company:** fifteen carriage stops (signposts with a wheel, a coach and a coachman) connect the landmarks, gates and quarters. Fares and travel time follow the real road distance, the trip tells you which quarters you pass through, and night coaches cost double. Coachmen won't take a wanted criminal.
- **Wealth shows everywhere:** townsfolk dress by their quarter, house interiors range from dirt-floored hovels to manors with carpets, bookcases and servants, and chests hold what their owners can afford. Manors are harder to break into and more likely to be watched.
- Enterable interiors: taverns (rent a room, drinks, rumors, a bard), general stores, weaponsmiths, armorers, alchemists, the Temple of Arkay (healing), the House of Mercy (cheap healing, a cot for the night), warehouses, the Mages Guild (spells), the Fighters Guild (training), the throne room, and houses (lockpick them at night — the residents might notice theft during the day)
- The Catacombs: a torch-lit grid dungeon with rats, bats, skeletons, zombies, wraiths (silver weapons or magic only), chests, and a boss
- Day/night cycle (1 real second = 1 game minute), moons, stars, weather, shops with opening hours, townsfolk who go home at night and thieves who come out
- Character creation with 8 races and 4 classes, 8 attributes, leveling, weapons in 7 materials from Iron to Daedric, armor, potions, three spells
- Townsfolk you can ask "Where is…" (buildings, landmarks, the nearest carriage stop; marks the map) and for rumors; repeatable guild quests (bounties in the rough quarters, deliveries with deadlines, relic hunts, undead cleansing)
- Crime: assault, theft and murder bring the guard. *HALT!* Pay your fine at the castle or lie low for a day
- Automap (M) with quarters, streets, landmarks and carriage stops, zooming out to the whole country with its rivers, tracks, the landmarks you know of and the places you have found; explored dungeon passages; journal (J), resting with ambushes, save/load (browser storage)

## Controls

| Key | Action |
| --- | --- |
| W A S D, mouse | Move, look |
| Shift / Space | Run / jump |
| Left click | Attack |
| Right click or Q | Cast selected spell (1–3 to choose) |
| E or F | Talk, open doors, search corpses and chests |
| H | Drink a healing potion |
| I or C | Character sheet and inventory |
| J | Journal |
| M | Map (mouse wheel or + / − zooms out to the whole country; drag to pan, click a place to travel there) |
| R | Rest or wait |
| T | Hire a carriage (at a stop), or travel on foot: straight on, along the road, or to a place you know |
| G | Fly on / off (debug; allow it first in Settings). You fly where you look; Space rises, X sinks, Shift is much faster (about 46 m/s) |
| F5 / F9 | Quick save / quick load |
| N | Toggle music |
| Esc | Pause menu |

**Minimal interface.** By default the game hides character stats and combat: no health, magicka or fatigue bars, no gold or potion count, no weapon in hand, no attacking, spells, potions or character sheet, no level-up messages and no attributes at character creation. New Game skips the story introduction and character creation and puts you straight on Pilgrim's Rise as a Breton traveller. Settings → Interface → *Show combat and character stats* brings the stats and combat back, along with character creation. The introduction text is kept in `src/12_main.js` (`INTRO`) for later.

**Menus.** Every menu closes with a tap or click outside it. Settings and Controls also have a Resume button when opened during play, and long menus scroll so their buttons stay on screen. With it hidden, enemies can still hurt you; the red flash and the dark vignette at low health are the only warning.

**Touch screens (iPad and other tablets).** Touch controls appear with the first touch; Settings → *Touch controls* can force them on or off, and *Touch button size* scales them. Put your left thumb down anywhere on the left side and push to walk (to the edge of the ring to run). Drag anywhere on the right to look, and tap the view to talk to or open whatever you face. The round buttons are Attack (keep your thumb down and drag to aim), Use (lights up when something is in reach), Cast, and Jump (Rise and Down while flying). The pills beside them are Potion, Draw/Sheathe, Spell and Fly, and the top row has Menu, Map, Journal, Character, Rest, Travel and Full screen. Tap the resting banner to stop resting. Clicking the view with a mouse or trackpad switches back to mouse control.

**Debug options** (Settings → Debug, off by default, remembered by the browser): *Allow flying* enables the G key; turning it off while airborne sets you down without fall damage. *Infinite stamina* keeps fatigue full. *No fall damage* (on by default) lets you land from any height unhurt. *No clip (while flying)* lets you fly through walls, buildings, trees and the ground, and much higher. The status line shows which debug options are active.

## Project layout

- `src/00_core.js` … `src/12_main.js` — game modules (textures, audio, geometry, city, items, entities, interiors, dungeon, player, quests, touch controls, UI, main loop). `src/04_city.js` holds the city generator: wall, quarters, street growth, lot placement, landmarks and carriage stops. `src/03_water.js` plans the rivers of the whole country at load (drainage, river network, the valleys they cut). `src/03_wild.js` streams the generated country beyond the city (ground chunks, plants, farmland, tracks and bridges, and the far ground in two rings out to some 3 km, with the whole country drawn coarsely behind them so the mountains at its edge stand on the skyline). `src/04_town.js` is the town generator and Corrinvale's config (see `CITIES.md` for how to add a city). `src/03_sites.js` holds the five fixed landmarks (their ground, plants, buildings and roads) and `src/03_poi.js` the small places scattered over the country. `src/06_roads.js` puts travellers on the tracks, and `src/11_travel.js` is fast travel on foot (the road network, routing and the walk itself).
- `src/template.html` — page shell and styles
- `build.py` — inlines the modules into `index.html` (standalone) and `dist/daggerfall.html` (artifact fragment)

- `tools/` — headless-Chrome checks and screenshot scripts (`tools/wild.py OUTDIR 0 1 2` photographs the generated country for three seeds, on the ground and from the air, into labelled contact sheets; `SET=transition` photographs the edge of the hand-made country instead, `SET=town` ten views of Corrinvale (with `?townseed=N` per seed, to judge the generator), `SET=sites` the five landmarks from their roads, from where the generated land blends in and from the air; `tools/shot.py` takes pictures from given places; `tools/wildwalk.py` walks out through the old world edge)
- `tools/townplan.py OUT 0 1 2`: a town's plan drawn from above as data, per generator seed (fast; look before rendering). `tools/bridgewalk.py`: walks the player across canal bridges and reports whether they got over.

After editing anything in `src/`, rebuild:

```bash
python3 build.py
```
