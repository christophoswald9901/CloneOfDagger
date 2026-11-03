"""Side-by-side door|street pairs from a spots.py run: python3 tools/pairs.py DIR"""
import sys
from PIL import Image
D = sys.argv[1].rstrip('/') + '/'
for i in range(10):
    a = Image.open(D + f's{i}_door.png'); b = Image.open(D + f's{i}_street.png'); w, h = a.size; s = 0.6
    out = Image.new('RGB', (int(w * s) * 2 + 6, int(h * s)))
    out.paste(a.resize((int(w * s), int(h * s))), (0, 0)); out.paste(b.resize((int(w * s), int(h * s))), (int(w * s) + 6, 0)); out.save(D + f'pair{i}.png')
