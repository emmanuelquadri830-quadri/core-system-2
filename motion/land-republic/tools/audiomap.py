"""Draws the mix as a spectrogram with the measured beat grid and every cue
on top, so sync can be checked by eye.
Usage: python3 -I tools/audiomap.py ROOT OUT.png [PREFIX]   (PREFIX remix- for the remix)"""
import json, sys, struct
import numpy as np
from PIL import Image, ImageDraw, ImageFont

root, out = sys.argv[1], sys.argv[2]
prefix = sys.argv[3] if len(sys.argv) > 3 else ""
raw = open(f"{root}/build/audio/{prefix}mix.wav", "rb").read()
# float32 stereo, data chunk located by scan
i = raw.index(b"data")
n = struct.unpack("<I", raw[i + 4:i + 8])[0]
x = np.frombuffer(raw[i + 8:i + 8 + n], dtype="<f4").reshape(-1, 2).mean(axis=1)
sr = 48000
grid = json.load(open(f"{root}/beats.json"))
cues = json.load(open(f"{root}/build/audio/{prefix}cues.json"))
# the remix file also lists the pin's flights; draw each landing as a cue
if isinstance(cues, dict):
    cues = cues["cues"] + [{"t": p["land"], "kind": "pin>" + p["to"]} for p in cues["pin"]]

W, H = 2400, 520
spec_h = 300
hop = len(x) // W
win = 2048
cols = []
w = np.hanning(win)
for c in range(W):
    s = c * hop
    seg = x[s:s + win]
    if len(seg) < win:
        seg = np.pad(seg, (0, win - len(seg)))
    cols.append(np.abs(np.fft.rfft(seg * w)))
S = np.array(cols).T  # freq x time
freqs = np.fft.rfftfreq(win, 1 / sr)
# log frequency axis 30 Hz .. 16 kHz
fl = np.geomspace(30, 16000, spec_h)
idx = np.searchsorted(freqs, fl)
S = S[idx, :]
D = 20 * np.log10(S + 1e-6)
D = np.clip((D - (D.max() - 80)) / 80, 0, 1)[::-1]
rgb = np.zeros((spec_h, W, 3), dtype=np.uint8)
rgb[..., 0] = (D ** 1.2 * 255).astype(np.uint8)
rgb[..., 1] = (D ** 2.2 * 230).astype(np.uint8)
rgb[..., 2] = (np.clip(D * 1.6, 0, 1) ** 0.8 * 120).astype(np.uint8)
img = Image.new("RGB", (W, H), (14, 14, 16))
img.paste(Image.fromarray(rgb), (0, 0))
d = ImageDraw.Draw(img)
# waveform
wy = spec_h + 70
for c in range(W):
    seg = x[c * hop:(c + 1) * hop]
    if len(seg):
        a = float(np.abs(seg).max())
        d.line([(c, wy - a * 60), (c, wy + a * 60)], fill=(150, 150, 160))
dur = len(x) / sr
px = lambda t: t / dur * W
for k, t in enumerate(grid["beats"]):
    col = (255, 255, 255) if k % 4 == 0 else (90, 90, 100)
    d.line([(px(t), 0), (px(t), spec_h + 140)], fill=col, width=2 if k % 4 == 0 else 1)
try:
    f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15)
except Exception:
    f = ImageFont.load_default()
colors = {"pin": (60, 140, 255), "click": (255, 210, 60), "slam": (255, 90, 90), "slamBig": (255, 60, 60), "impact": (255, 40, 120),
          "pop": (90, 220, 255), "whoosh": (160, 255, 160), "whooshIn": (160, 255, 160)}
for j, c in enumerate(cues):
    t = c["t"]
    col = colors.get(c["kind"].split(">")[0], (200, 160, 255))
    y = spec_h + 150 + (j % 4) * 18
    d.line([(px(t), spec_h + 140), (px(t), y)], fill=col, width=2)
    d.text((px(t) + 3, y - 2), c["kind"], fill=col, font=f)
for s in range(0, int(dur) + 1, 2):
    d.text((px(s) + 4, 4), f"{s}s", fill=(255, 255, 255), font=f)
img.save(out)
print("wrote", out)
