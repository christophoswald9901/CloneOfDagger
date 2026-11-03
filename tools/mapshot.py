"""Screenshot the automap after a new game: python3 tools/mapshot.py OUT.png [zoom]"""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
async def main():
    c = CDP(); await c.boot(w=1100, h=1000); await c.new_game(); await asyncio.sleep(1)
    z = float(sys.argv[2]) if len(sys.argv) > 2 else 1
    await c.ev(f"__game.MapView.zoom={z}; __game.MapView.open()"); await asyncio.sleep(2); await c.shot(sys.argv[1])
    print(c.errors()[:4]); c.stop()
asyncio.run(main())
