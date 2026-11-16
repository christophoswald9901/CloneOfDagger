"""Boot the game headless and evaluate JavaScript expressions in it: python3 tools/ev.py "EXPR" ["EXPR" ...]
SEED=n picks the world seed; NEWGAME=1 starts a new game first. Prints each result and any console errors."""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
async def main():
    c = CDP()
    if not await c.boot(f'http://127.0.0.1:8765/index.html?seed={os.environ.get("SEED", "0")}', timeout=240): print('boot failed'); [print('LOG', l[:1500]) for l in c.errors()[:8]]; c.stop(); return
    if os.environ.get('NEWGAME'): await c.new_game(); await asyncio.sleep(2)
    for e in sys.argv[1:]: print(str(await c.ev(e))[:6000])
    for l in [l for l in c.errors() if 'render failed once' not in l][:8]: print('LOG', l[:1500])
    c.stop()
asyncio.run(main())
