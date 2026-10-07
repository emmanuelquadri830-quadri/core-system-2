"""Synthetic page for the component bench (film/scenes/lab.js, ?scenes=lab).
Never used in the film. Usage: python3 -I tools/fixture.py build/test/fixture.png"""
import sys
from PIL import Image, ImageDraw, ImageFont

W, H = 2880, 3600  # a 1440 x 1800 css page at dpr 2
im = Image.new('RGB', (W, H), (236, 236, 232))
d = ImageDraw.Draw(im)
f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 56)
for y in range(0, H, 200):
    d.line([(0, y), (W, y)], fill=(210, 210, 205), width=2)
for x in range(0, W, 200):
    d.line([(x, 0), (x, H)], fill=(210, 210, 205), width=2)
boxes = {'nav': (0, 0, 2880, 160), 'btnA': (2240, 40, 2800, 120), 'card1': (160, 800, 1000, 1600),
         'card2': (1040, 800, 1880, 1600), 'card3': (1920, 800, 2760, 1600), 'select': (160, 400, 1200, 560)}
for k, (a, b, c, e) in boxes.items():
    d.rectangle([a, b, c, e], outline=(40, 40, 40), width=6, fill=(250, 250, 248) if k != 'btnA' else (60, 60, 60))
    d.text((a + 24, b + 24), k, fill=(20, 20, 20) if k != 'btnA' else (255, 255, 255), font=f)
im.save(sys.argv[1])
