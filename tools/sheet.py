"""Contact sheet of every png in a folder: python3 tools/sheet.py DIR [prefix]"""
import sys, glob, os
from PIL import Image
d = sys.argv[1]; pre = sys.argv[2] if len(sys.argv) > 2 else ''
fs = sorted(f for f in glob.glob(f'{d}/{pre}*.png'))
ims = [Image.open(f).resize((784, 400)) for f in fs]
W = Image.new('RGB', (784 * 2, 400 * ((len(ims) + 1) // 2)))
for i, im in enumerate(ims): W.paste(im, ((i % 2) * 784, (i // 2) * 400))
out = f'{d}/_sheet_{pre or "all"}.jpg'; W.save(out, quality=85); print(out, [os.path.basename(f) for f in fs])
