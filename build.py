#!/usr/bin/env python3
"""Inline src/*.js into src/template.html.

Writes:
  index.html              full standalone page (double-click to play; needs internet for three.js + fonts)
  dist/daggerfall.html    body fragment for publishing as a claude.ai artifact
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"

js = "\n".join(p.read_text() for p in sorted(SRC.glob("[0-9][0-9]_*.js")))
if "</script" in js:
    raise SystemExit("JS contains a closing script tag")
template = (SRC / "template.html").read_text()
content = template.replace("/*__GAME_JS__*/", js)

m = re.search(r"<!--HEAD-->(.*?)<!--/HEAD-->", content, re.S)
head, body = m.group(1).strip(), content[m.end():].strip()

full = (
    "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
    f"{head}\n</head>\n<body>\n{body}\n</body>\n</html>\n"
)
(ROOT / "index.html").write_text(full)
(ROOT / "dist").mkdir(exist_ok=True)
(ROOT / "dist" / "daggerfall.html").write_text(f"{head}\n{body}\n")
print(f"built index.html ({len(full) // 1024} KB), {js.count(chr(10))} lines of JS")
