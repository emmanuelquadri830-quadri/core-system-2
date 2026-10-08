"""Tolerance check for render.mjs --verify: rasteriser noise is allowed, carried state is not.

A mismatch passes only if at most 50 pixels differ and none by more than 48 (sum of RGB).
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
    ok = n <= 50 and m <= 48
    fail += not ok
    print(f'frame {f}: {n} px differ, max {m}/765 -> {"noise" if ok else "FAIL"}')
sys.exit(1 if fail else 0)
