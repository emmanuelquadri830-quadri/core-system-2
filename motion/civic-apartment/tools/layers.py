"""Splits the street-level render into three parallax layers.

  sky.png    the sky alone, filled in smoothly behind everything else
  mid.png    the building, street and everything at its depth: every pixel
             is the render's own, untouched; only sky and front foliage are
             cut out (alpha)
  front.png  the tree branches and palm fronds that hang over the sky

Usage: python3 -I tools/layers.py assets/renders/street-view.webp assets/renders/layers
"""
import sys, os
import numpy as np
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
im = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
H, W, _ = im.shape
r, g, b = im[..., 0], im[..., 1], im[..., 2]
yy, xx = np.mgrid[0:H, 0:W]

# The building's outline, traced by hand in render pixels. Nothing below it
# can be sky, so the bluish shadows and the glass are never cut out.
ROOF = [(0, 700), (124, 700), (128, 598), (276, 527), (318, 519), (402, 492), (404, 468),
        (720, 340), (742, 344), (830, 503), (834, 571), (870, 576), (886, 640), (889, 700), (971, 700)]
rx = np.array([p[0] for p in ROOF], float)
ry = np.array([p[1] for p in ROOF], float)
roofline = np.interp(np.arange(W), rx, ry) - 3  # 3 px clear of the edge
# Sky: clearly blue and above the outline.
sky = (b > r + 28) & (b > g + 8) & (yy < roofline[None, :])
# keep only sky connected to the top edge (flood fill on a coarse pass)
from collections import deque
seen = np.zeros_like(sky)
q = deque((0, x) for x in range(W) if sky[0, x])
for p in q: seen[p] = True
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < H and 0 <= nx < W and sky[ny, nx] and not seen[ny, nx]:
            seen[ny, nx] = True
            q.append((ny, nx))
sky = seen

# Front foliage: whatever is not sky in the regions where leaves hang over
# the sky: the tree at the top left, the leaves along the top edge, and the
# palm at the right edge above the building's roofline.
zone = ((xx < 360) & (yy < 460)) | (yy < 60) | ((xx > 828) & (yy < 566)) | ((xx > 890) & (yy < 640))
front = zone & ~sky

# Smooth sky everywhere: fit colour as a quadratic in (x, y) over sky pixels.
ys, xs = np.nonzero(sky)
A = np.stack([np.ones_like(xs), xs, ys, xs * ys, xs**2, ys**2], 1).astype(np.float64) / [1, W, H, W * H, W * W, H * H]
Afull = np.stack([np.ones(H * W), xx.ravel(), yy.ravel(), (xx * yy).ravel(), (xx**2).ravel(), (yy**2).ravel()], 1) / [1, W, H, W * H, W * W, H * H]
skyimg = np.zeros_like(im)
for c in range(3):
    coef, *_ = np.linalg.lstsq(A, im[ys, xs, c].astype(np.float64), rcond=None)
    skyimg[..., c] = (Afull @ coef).reshape(H, W)
# keep the real sky where it is visible, the fit elsewhere
skyimg = np.where(sky[..., None], im, skyimg)

def alpha(mask, blur=0.8):
    a = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(a).astype(np.float32) / 255

a_front = alpha(front)
a_mid = 1 - np.maximum(alpha(sky), a_front)
a_mid[~(sky | front)] = 1.0  # building pixels stay fully opaque

def save(rgb, a, name):
    rgba = np.dstack([np.clip(rgb, 0, 255), np.clip(a * 255, 0, 255)]).astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(os.path.join(out, name), optimize=True)

save(skyimg, np.ones((H, W)), "sky.png")
save(im, a_mid, "mid.png")
save(im, a_front, "front.png")
# preview: sky red, front green
prev = im.copy()
prev[sky] = prev[sky] * 0.4 + np.array([255, 0, 0]) * 0.6
prev[front] = prev[front] * 0.4 + np.array([0, 255, 0]) * 0.6
Image.fromarray(prev.astype(np.uint8)).save(os.path.join(out, "_masks.png"))
print("sky", int(sky.sum()), "front", int(front.sum()), "of", H * W)
