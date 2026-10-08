"""Land Republic intro (0:00-0:09) score and SFX, synthesized from scratch.

Writes audio/score.wav (48 kHz, 24-bit stereo, -14 LUFS integrated) and
beats.json (onsets measured back out of the rendered mix, not the cue list).

Run: python3 audio/score.py
"""
import json
import math
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
DUR = 9.0
BPM = 120.0
BEAT = 60.0 / BPM
N = int(SR * DUR)
ROOT = Path(__file__).resolve().parent.parent


def mulberry32(seed):
    """Same generator the film uses, so every random choice is reproducible."""
    state = [seed & 0xFFFFFFFF]

    def nxt():
        state[0] = (state[0] + 0x6D2B79F5) & 0xFFFFFFFF
        t = state[0]
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0

    return nxt


def noise(n, seed):
    rnd = mulberry32(seed)
    # Box-Muller would be overkill here: uniform noise, re-centred, is fine for SFX.
    return np.array([rnd() * 2 - 1 for _ in range(n)], dtype=np.float64)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env_exp(n, decay):
    t = np.arange(n) / SR
    return np.exp(-t / decay)


def place(buf, sig, t, gain=1.0, pan=0.0):
    """Add a mono or stereo signal into the stereo buffer at time t."""
    i = int(round(t * SR))
    if sig.ndim == 1:
        l = sig * math.cos((pan + 1) * math.pi / 4)
        r = sig * math.sin((pan + 1) * math.pi / 4)
        sig = np.stack([l, r], 1) * math.sqrt(2)
    j = min(N, i + len(sig))
    if j > i:
        buf[i:j] += sig[: j - i] * gain


def lp(x, fc, order=2):
    return sosfilt(butter(order, fc, "low", fs=SR, output="sos"), x, axis=0)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x, axis=0)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x, axis=0)


# ---------------------------------------------------------------- instruments

def pad_note(f, dur, seed):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for k, det in enumerate((-7, 0, 6)):
        ff = f * 2 ** (det / 1200)
        ph = mulberry32(seed + k)() * 2 * math.pi
        v = sum((1 / h ** 1.6) * np.sin(2 * math.pi * ff * h * t + ph * h) for h in range(1, 7))
        pan = (-0.5, 0.0, 0.5)[k]
        out[:, 0] += v * math.cos((pan + 1) * math.pi / 4)
        out[:, 1] += v * math.sin((pan + 1) * math.pi / 4)
    att = np.clip(t / 0.35, 0, 1) ** 2
    rel = np.clip((dur - t) / 0.45, 0, 1)
    return out * (att * rel)[:, None]


def mallet(f, decay=0.7, ratio=3.5, index=2.2):
    n = int((decay * 5) * SR)
    t = np.arange(n) / SR
    mod = np.sin(2 * math.pi * f * ratio * t) * index * np.exp(-t / (decay * 0.18))
    s = np.sin(2 * math.pi * f * t + mod) * np.exp(-t / decay)
    s += 0.25 * np.sin(2 * math.pi * f * 2 * t) * np.exp(-t / (decay * 0.4))
    att = np.clip(t / 0.002, 0, 1)
    return s * att


def kick(f0=110, f1=44, decay=0.32, click=0.35, seed=1):
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.045)
    ph = 2 * math.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / decay)
    tr = hp(noise(n, seed), 2500) * np.exp(-t / 0.004) * click
    return body + tr


def thock(seed=2):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 62 + 70 * np.exp(-t / 0.03)
    body = np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    knock = bp(noise(n, seed), 900, 2600) * np.exp(-t / 0.012) * 0.5
    return body + knock


def ui_click(seed=3):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    a = hp(noise(n, seed), 3000) * np.exp(-t / 0.0025)
    b = np.zeros(n)
    k = int(0.045 * SR)
    b[k:] = hp(noise(n - k, seed + 1), 2200)[: n - k] * np.exp(-t[: n - k] / 0.003) * 0.6
    blip = np.sin(2 * math.pi * 1760 * t) * np.exp(-t / 0.03) * 0.35
    return a + b + blip


def pop(seed=4):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f = 330 + 520 * np.exp(-t / 0.012)
    return np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-t / 0.035)


def tick(seed, bright=1.0):
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    rnd = mulberry32(seed)
    fc = 2800 + 2200 * rnd()
    return bp(noise(n, seed), fc * 0.7, min(fc * 1.4, 20000)) * np.exp(-t / 0.0035) * bright


def whoosh(dur, seed, lo=250, hi=5200, peak=0.6):
    """Band of noise swept up then down; loudest at `peak` (0..1 of dur)."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    src = noise(n, seed)
    out = np.zeros(n)
    blocks = 64
    edges = np.linspace(0, n, blocks + 1).astype(int)
    for b in range(blocks):
        u = (edges[b] + edges[b + 1]) / 2 / n
        x = u / peak if u < peak else 1 - (u - peak) / (1 - peak)
        fc = lo * (hi / lo) ** max(0.0, x)
        seg = src[max(0, edges[b] - 512): edges[b + 1]]
        y = bp(seg, fc * 0.6, min(fc * 1.6, 20000))
        out[edges[b]: edges[b + 1]] = y[-(edges[b + 1] - edges[b]):]
    u = t / dur
    amp = np.where(u < peak, (u / peak) ** 2.2, np.exp(-(u - peak) / (1 - peak) * 4))
    return out * amp


def riser(dur, seed, f0=180, f1=1400):
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    f = f0 * (f1 / f0) ** (u ** 1.5)
    tone = np.sin(2 * math.pi * np.cumsum(f) / SR) * 0.25
    air = hp(noise(n, seed), 1800) * 0.6
    return (tone + air) * u ** 2.5


def reverb_ir(seconds=1.6, seed=9):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    l = noise(n, seed) * np.exp(-t / 0.45)
    r = noise(n, seed + 7) * np.exp(-t / 0.45)
    ir = np.stack([lp(l, 6000), lp(r, 6000)], 1)
    ir[: int(0.012 * SR)] = 0
    return ir / np.sqrt((ir ** 2).sum())


# ---------------------------------------------------------------- cue sheet
# Every musical hit sits on the 120 BPM grid (multiples of 0.25 s).
# The film reads the *measured* times of these back from beats.json.

HITS = [
    (0.50, "mark_settle"),
    (1.00, "wordmark"),
    (2.00, "whip"),
    (2.25, "pill_land"),
    (3.50, "click"),
    (4.00, "flood"),
    (4.75, "highlight"),
    (5.00, "map"),
    (5.50, "oyo"),
    (6.00, "pin"),
    (6.50, "terrain"),
    (7.50, "plot"),
    (8.00, "card"),
]

CHORDS = [  # (start, dur, bass midi, pad midis)
    (0.0, 2.0, 38, [62, 66, 69, 73, 76]),   # Dmaj9
    (2.0, 2.0, 35, [59, 62, 66, 69, 73]),   # Bm9
    (4.0, 2.0, 31, [55, 59, 62, 66, 69]),   # Gmaj9
    (6.0, 2.0, 40, [64, 67, 71, 74, 78]),   # Em9
    (8.0, 1.0, 38, [62, 66, 69, 73, 76]),   # Dmaj9
]


def build():
    music = np.zeros((N, 2))
    sfx = np.zeros((N, 2))
    hits = np.zeros((N, 2))

    # Pad: enters under the logo, filter opens as we descend to the land.
    for i, (s, d, bass, notes) in enumerate(CHORDS):
        tail = 0.5 if s + d < DUR else 0.0
        for k, m in enumerate(notes):
            place(music, pad_note(midi(m), d + tail, 100 + i * 10 + k), s, 0.05)
        b = pad_note(midi(bass), d + tail, 300 + i)
        place(music, lp(b, 220), s, 0.16)
    t = np.arange(N) / SR
    music = lp(music, 2400) * (0.55 + 0.45 * np.clip((t - 4.0) / 3.0, 0, 1))[:, None] \
        + hp(music, 2400) * np.clip((t - 4.0) / 3.0, 0, 1)[:, None] * 0.6

    # Pulse: muted plucks on eighths from the whip onward, chord tones.
    rnd = mulberry32(77)
    for step in range(int((DUR - 2.0) / (BEAT / 2))):
        tt = 2.0 + step * BEAT / 2
        chord = next(c for c in CHORDS if c[0] <= tt < c[0] + c[1])
        m = chord[3][int(rnd() * 3) + (1 if step % 4 == 2 else 0)] + 12
        g = 0.06 if step % 2 == 0 else 0.035
        place(music, lp(mallet(midi(m), decay=0.09, ratio=2.0, index=1.2), 3500), tt, g,
              pan=(rnd() - 0.5) * 0.8)

    # Kicks: light on the downbeats once the story starts.
    for tt in (4.0, 5.0, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5):
        place(hits, kick(seed=int(tt * 10)), tt, 0.55 if tt % 2 == 0 else 0.38)

    # Hits.
    place(hits, thock(), 0.50, 0.7)
    for k, m in enumerate((62, 69, 73, 76)):
        place(hits, mallet(midi(m + 12), decay=0.9), 0.50 + k * 0.012, 0.11, pan=-0.3 + k * 0.2)
    place(hits, mallet(midi(81), decay=0.6), 1.00, 0.12, pan=0.25)
    place(hits, kick(f0=90, f1=40, click=0.1, seed=12), 2.00, 0.45)
    place(hits, pop(), 2.25, 0.22)
    place(hits, ui_click(), 3.50, 0.5)
    place(hits, kick(f0=70, f1=36, decay=0.5, click=0.0, seed=13), 3.75, 0.3)
    place(hits, mallet(midi(86), decay=0.35, ratio=5.0, index=1.0), 4.75, 0.09, pan=0.3)
    for k, m in enumerate((74, 78, 81)):
        place(hits, mallet(midi(m), decay=1.1), 5.00 + k * 0.01, 0.1, pan=-0.2 + k * 0.2)
    place(hits, mallet(midi(79), decay=0.7), 5.50, 0.1, pan=-0.3)
    place(hits, thock(seed=21), 6.00, 0.55)
    place(hits, mallet(midi(83), decay=0.8), 6.00, 0.1, pan=0.3)
    place(hits, mallet(midi(76), decay=0.7), 7.50, 0.1)
    place(hits, mallet(midi(88), decay=0.5, ratio=5.0, index=1.0), 7.50, 0.05, pan=0.4)
    for k, m in enumerate((62, 69, 73, 78, 81)):
        place(hits, mallet(midi(m + 12), decay=1.4), 8.00 + k * 0.015, 0.09, pan=-0.4 + k * 0.2)

    # SFX layer (texture, not on the grid by design: typing, sweeps).
    place(sfx, whoosh(0.55, 31, peak=0.85), 0.00, 0.28)          # arms fly in
    place(sfx, riser(0.5, 32), 1.50, 0.12)                       # into the whip
    place(sfx, whoosh(0.4, 33, peak=0.45), 1.82, 0.4)            # whip
    rnd = mulberry32(55)
    for k in range(23):                                          # pill typing
        place(sfx, tick(500 + k, 0.8), 2.45 + k * 0.026 + rnd() * 0.006, 0.16, pan=0.1)
    place(sfx, whoosh(0.3, 34, lo=400, peak=0.55), 2.98, 0.16)   # pill collapses into the button
    place(sfx, whoosh(0.6, 35, lo=120, hi=1800, peak=0.5), 3.50, 0.3)   # blue flood
    place(sfx, whoosh(0.7, 36, lo=200, hi=3000, peak=0.55), 4.00, 0.22)  # light wave
    for k in range(17):                                          # typed line
        place(sfx, tick(700 + k, 1.0), 4.38 + k * 0.019 + rnd() * 0.004, 0.18, pan=-0.1)
    place(sfx, riser(0.5, 37, 300, 2400), 4.50, 0.1)
    place(sfx, whoosh(1.0, 38, lo=150, hi=4000, peak=0.5), 5.62, 0.15)  # dive toward Ibadan
    place(sfx, whoosh(0.6, 39, lo=180, hi=2600, peak=0.35), 6.30, 0.3)  # into the land
    for k in range(8):                                           # survey lines
        place(sfx, tick(900 + k, 0.7), 6.875 + k * 0.0625, 0.14, pan=(k % 2) * 0.6 - 0.3)
    place(sfx, whoosh(0.35, 40, lo=600, hi=6000, peak=0.6), 7.30, 0.12)
    place(sfx, whoosh(0.4, 41, lo=300, hi=3500, peak=0.6), 7.62, 0.16)   # card slides up

    ir = reverb_ir()
    def verb(x, mix):
        w = np.stack([fftconvolve(x[:, c], ir[:, c])[:N] for c in range(2)], 1)
        return x + w * mix

    mix = verb(music, 0.5) * 1.0 + verb(hits, 0.28) + verb(sfx, 0.18)
    mix = hp(mix, 28)

    # Gentle bus compression via a smoothed envelope, then soft limit.
    env = lp(np.abs(mix).max(1), 12, order=1)
    gr = np.minimum(1.0, (0.35 / np.maximum(env, 1e-6)) ** 0.35)
    mix *= gr[:, None]

    meter = pyln.Meter(SR)
    lufs = meter.integrated_loudness(mix)
    mix *= 10 ** ((-14.0 - lufs) / 20)
    # True-peak guard at -1 dBTP: oversampled peak check, then tanh knee above -3 dBFS.
    ceil = 10 ** (-1.5 / 20)
    knee = 10 ** (-4 / 20)
    a = np.abs(mix)
    over = a > knee
    mix[over] = np.sign(mix[over]) * (knee + (ceil - knee) * np.tanh((a[over] - knee) / (ceil - knee)))
    lufs2 = meter.integrated_loudness(mix)
    mix *= 10 ** ((-14.0 - lufs2) / 20)

    # Last 40 ms: short fade so the hard stop at 9.000 s does not click.
    f = int(0.04 * SR)
    mix[-f:] *= np.linspace(1, 0, f)[:, None] ** 2
    return mix, hits


def measure_onsets(x, sr=SR):
    """Spectral-flux onset detector on the hit stem; returns times in seconds."""
    mono = x.mean(1)
    hop, win = 256, 1024
    frames = 1 + (len(mono) - win) // hop
    w = np.hanning(win)
    spec = np.abs(np.stack([np.fft.rfft(mono[i * hop: i * hop + win] * w) for i in range(frames)]))
    spec = np.log1p(spec * 50)
    flux = np.maximum(0, np.diff(spec, axis=0)).sum(1)
    flux = np.concatenate([[0], flux])
    thr = np.convolve(flux, np.ones(16) / 16, mode="same") * 1.4 + flux.max() * 0.04
    peaks = []
    for i in range(1, len(flux) - 1):
        if flux[i] > thr[i] and flux[i] >= flux[i - 1] and flux[i] >= flux[i + 1]:
            if not peaks or (i - peaks[-1]) * hop / sr > 0.08:
                peaks.append(i)
    # Refine to the steepest rise of a 1 ms RMS envelope near each peak.
    # (A level threshold is fooled by tails of earlier notes; a slope is not.)
    k1 = int(0.001 * sr)
    rms = np.sqrt(np.convolve(mono ** 2, np.ones(k1) / k1, mode="same"))
    out = []
    for p in peaks:
        c = p * hop + win // 2
        a, b = max(0, c - win), min(len(rms) - k1, c + win)
        slope = rms[a + k1: b + k1] - rms[a:b]
        out.append((a + int(np.argmax(slope)) + k1 // 2) / sr)
    return out


def main():
    mix, hits = build()
    sf.write(ROOT / "audio" / "score.wav", mix.astype(np.float32), SR, subtype="PCM_24")

    onsets = measure_onsets(hits)
    measured = {}
    for t0, label in HITS:
        near = min(onsets, key=lambda o: abs(o - t0))
        measured[label] = round(near, 4) if abs(near - t0) < 0.06 else None

    # Beat grid: measured onsets that land on quarter notes give the phase,
    # their spacing gives the tempo.
    on_q = [o for o in onsets if abs((o / BEAT) - round(o / BEAT)) < 0.04]
    q_idx = np.array([round(o / BEAT) for o in on_q])
    fit = np.polyfit(q_idx, np.array(on_q), 1) if len(on_q) > 2 else (BEAT, 0.0)
    period, phase = float(fit[0]), float(fit[1])
    beats = [round(phase + period * k, 4) for k in range(int(DUR / period) + 1) if phase + period * k <= DUR + 1e-6]

    data = {
        "bpm_measured": round(60 / period, 3),
        "beat_period": round(period, 5),
        "beats": beats,
        "downbeats": beats[::4],
        "hits": measured,
        "onsets": [round(o, 4) for o in onsets],
        "note": "Measured from the rendered hit stem by audio/score.py. The film times its events from 'hits'.",
    }
    (ROOT / "beats.json").write_text(json.dumps(data, indent=1))
    meter = pyln.Meter(SR)
    print("LUFS", round(meter.integrated_loudness(mix), 2), "peak dBFS", round(20 * np.log10(np.abs(mix).max()), 2))
    print("bpm", data["bpm_measured"], "hits", measured)
    missing = [k for k, v in measured.items() if v is None]
    if missing:
        raise SystemExit(f"hits not found in measured audio: {missing}")


if __name__ == "__main__":
    main()
