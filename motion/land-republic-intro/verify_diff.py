"""Tolerance check for render.mjs --verify: rasteriser noise is allowed, carried state is not.

A mismatch passes if either
  - it is a few stray pixels: at most 50 differ and none by more than 48 (sum of RGB), or
  - it is sub-visible rounding across the frame (for example a half-opacity flash composited
    with different rounding): no pixel differs by more than 12 (4 levels per channel) and the
    mean difference over differing pixels is at most 2.
A missing, moved or stale element breaks both rules.
"""
import glob
import re
import sys

import numpy as np
from PIL import Image

worst = 0
fail = 0
for seq in sorted(glob.glob('out/frames/verify_*_seq.png')):
    f = re.findall(r'verify_(\d+)_seq', seq)[0]
    a = np.array(Image.open(seq).convert('RGB')).astype(int)
    b = np.array(Image.open(seq.replace('_seq', '_fresh')).convert('RGB')).astype(int)
    d = np.abs(a - b).sum(-1)
    n, m = int((d > 0).sum()), int(d.max())
    mean = float(d[d > 0].mean()) if n else 0.0
    ok = (n <= 50 and m <= 48) or (m <= 12 and mean <= 2.0)
    fail += not ok
    print(f'frame {f}: {n} px differ, max {m}/765, mean {mean:.2f} -> {"noise" if ok else "FAIL"}')
sys.exit(1 if fail else 0)
