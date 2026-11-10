# CloneOfDagger

See README.md for layout, controls and build (`python3 build.py` after editing `src/`).

## Current focus (since 2026-09-30)

A world that feels believable when walking through it. Lore and systemic features (story intro, character creation, combat, stats, main quest) are parked and will come back later.

- Prefer work on terrain, city layout, vistas, atmosphere and walkability.
- Keep parked systems switchable rather than deleting them. Combat and stats are behind Settings → "Show combat and character stats", which also brings back character creation. The INTRO story text is kept in `src/12_main.js` but not shown.
- Don't test or extend the main quest unless asked.
- The game is also played on an iPad, so touch controls must keep working.
- Setting and story ideas for when lore comes back are in `docs/SETTING.md`. They are ideas, not decisions, so don't build from them unless asked.
- The Elder Scrolls is not an inspiration for the setting, and everything from it will be replaced. Don't add new Elder Scrolls names, gods, races or guilds. The existing ones (Daggerfall, Arkay, Iliac Bay, the races, the guilds) stay until the user decides to replace them.

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
```

Other sessions may be running the same tools from other worktrees. If port 8765 is taken, serve this checkout on another port and set `GAME_PORT` to it, and set `CDP_PORT` (default 9333) to a free port, or the tools will photograph or disturb another session's build.

They need Python `websockets` and `Pillow`, and Chrome or Chromium on PATH (or `$CHROME`). In a fresh container: `pip install websockets pillow`, plus a Chromium package if none is installed. If the sandbox blocks `cdn.jsdelivr.net` (where three.js is loaded from), `tools/cdp.py` intercepts those requests and serves them from an `npm pack` copy in `tools/.npmcache/` (gitignored), so npm registry access is enough. Renders go to `tools/out/`, which is gitignored, so earlier renders exist only on the machine that made them.
