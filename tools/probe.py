"""Evaluate a JS expression after boot (no new game): python3 tools/probe.py "expr" """
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(__file__)); from cdp import CDP
async def main():
    c = CDP(); await c.boot(timeout=150)
    for e in sys.argv[1:]: print(await c.ev(e))
    for l in c.errors()[:6]: print('LOG', l[:600])
    c.stop()
asyncio.run(main())
