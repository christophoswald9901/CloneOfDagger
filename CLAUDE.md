# CloneOfDagger

See README.md for layout, controls and build (`python3 build.py` after editing `src/`).

## Current focus (since 2026-09-30)

A world that feels believable when walking through it. Lore and systemic features (story intro, character creation, combat, stats, main quest) are parked and will come back later.

- Prefer work on terrain, city layout, vistas, atmosphere and walkability.
- Keep parked systems switchable rather than deleting them. Combat and stats are behind Settings → "Show combat and character stats", which also brings back character creation. The INTRO story text is kept in `src/12_main.js` but not shown.
- Don't test or extend the main quest unless asked.
- The game is also played on an iPad, so touch controls must keep working.
- Setting and story ideas for when lore comes back are in `docs/SETTING.md`. They are ideas, not decisions, so don't build from them unless asked.
- The Elder Scrolls is not an inspiration for the setting. On 2026-11-12 its names and lore were replaced throughout (the city is Aldhaven on Merrow Bay; see README.md). Don't bring any back, and don't add Elder Scrolls names, gods, races, guilds or terms. The new names are stand-ins until the story returns; `docs/SETTING.md` lists them.

## Visual work: critic loops

For generated visuals (terrain, flora, transitions), judge results with critic subagents rather than a single pass:

- Each critic scores out of 10 (natural, believable, consistent with the "modern take on early 3D" art style) and gives ranked feedback.
- Critics see at least 3 generations (seeds), from the ground and from the air. `tools/wild.py OUTDIR 0 1 2` makes the labelled contact sheets.
- Fix the top-ranked items each round. Stop at a score of 8 or more, or at the round limit (5 for the wild, 3 for the hand-made → generated transition).
- Report the score trajectory honestly, and also check viewpoints the user reported, not only the critic's.

Earlier single-pass work missed overlaps, trees on farms and invisible rivers/roads.

## Running the tools

The `tools/*.py` scripts drive headless Chrome over CDP against a local server:

```bash
python3 -m http.server 8765 --bind 127.0.0.1   # in the background
python3 tools/check.py                          # boot, new game, report errors
python3 tools/invariants.py                     # data checks over many seeds (rivers, tracks, bridges, places, roads, plots, doors)
```

Run `tools/invariants.py` after changing the terrain, rivers, tracks or a town generator. It exits non-zero on a failure; read the coordinates it prints before rendering anything. If another session's server holds port 8765, start one on another port and set `HTTP_PORT`.

They need Python `websockets` and `Pillow`, and Chrome or Chromium on PATH (or `$CHROME`). In a fresh container: `pip install websockets pillow`, plus a Chromium package if none is installed. If the sandbox blocks `cdn.jsdelivr.net` (where three.js is loaded from), `tools/cdp.py` intercepts those requests and serves them from an `npm pack` copy in `tools/.npmcache/` (gitignored), so npm registry access is enough. Renders go to `tools/out/`, which is gitignored, so earlier renders exist only on the machine that made them.
