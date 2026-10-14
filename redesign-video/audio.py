"""Original background music plus interface sounds for the redesign video.

Everything is synthesised here (no samples), so there are no rights issues.
Reads sfx.json (cue times exported from the timeline) and writes:
  music.wav  music only
  mix.wav    music plus interface sounds
"""
import json
import wave
import numpy as np

SR = 44100
cues = json.load(open('sfx.json'))
DUR = cues['duration']
N = int(SR * (DUR + 0.05))
rng = np.random.default_rng(7)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(buf, sig, t, pan=0.0):
    """Mix a mono or stereo signal into the stereo buffer at time t."""
    i = int(round(t * SR))
    if i >= N:
        return
    if sig.ndim == 1:
        l = sig * np.sqrt(0.5 * (1 - pan))
        r = sig * np.sqrt(0.5 * (1 + pan))
        sig = np.stack([l, r], 1)
    j = min(N, i + len(sig))
    if i < 0:
        sig = sig[-i:]
        i = 0
    buf[i:j] += sig[: j - i]


def smooth(x, n):
    """Cheap low-pass: moving average of n samples."""
    if n <= 1:
        return x
    k = np.ones(n) / n
    return np.convolve(x, k, mode='same')


def fft_convolve(x, h):
    n = len(x) + len(h) - 1
    size = 1 << (n - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(h, size), size)
    return y[:n]


def reverb(st, seconds=2.4, rt=2.2, wet=0.3, predelay=0.02):
    t = np.arange(int(SR * seconds)) / SR
    env = np.exp(-6.9 * t / rt)
    out = np.zeros_like(st)
    for ch in range(2):
        noise = rng.standard_normal(len(t))
        dark = smooth(noise, 9) * 2.4
        ir = (0.35 * noise + dark) * env
        ir[: int(SR * predelay)] = 0
        ir /= np.sqrt(np.sum(ir ** 2))
        y = fft_convolve(st[:, ch], ir)[: len(st)]
        out[:, ch] = y
    return st + wet * out


# --------------------------------------------------------------------------
# music: 84 bpm, two bars per chord, ends on the tonic
# --------------------------------------------------------------------------
BPM = 84
BEAT = 60 / BPM
EIGHTH = BEAT / 2
CHORD_LEN = 8 * BEAT

CHORDS = [
    # name, bass, pad voicing, arpeggio cycle
    ('Dmaj9', 38, [54, 57, 61, 64], [62, 66, 69, 73, 76, 73, 69, 66]),
    ('Bm9', 35, [50, 54, 57, 61], [59, 62, 66, 69, 73, 69, 66, 62]),
    ('Gmaj9', 31, [54, 57, 59, 62], [62, 67, 71, 74, 78, 74, 71, 67]),
    ('A7sus4', 33, [52, 57, 62, 67], [64, 69, 74, 76, 79, 76, 74, 69]),
]


def ep_note(f, length, vel):
    """Soft FM electric piano."""
    n = int(SR * (length + 1.6))
    t = np.arange(n) / SR
    index = (0.9 + 1.4 * vel) * np.exp(-t * 3.2)
    car = np.sin(2 * np.pi * f * t + index * np.sin(2 * np.pi * f * t))
    tine = 0.12 * np.sin(2 * np.pi * f * 4.01 * t) * np.exp(-t * 14)
    body = 0.1 * np.sin(2 * np.pi * f * 0.5 * t) * np.exp(-t * 2.5)
    amp = np.exp(-t * 1.5) * (1 - np.exp(-t * 300))
    rel = np.ones(n)
    end = int(SR * length)
    rel[end:] = np.exp(-(t[end:] - length) * 5)
    return (car + tine + body) * amp * rel * vel


def pad_chord(notes, length, bright=1.0):
    n = int(SR * (length + 2.2))
    t = np.arange(n) / SR
    out = np.zeros(n)
    for m in notes:
        f = midi(m)
        for det in (-0.0055, 0.0, 0.006):
            ph = rng.uniform(0, 2 * np.pi)
            for h, a in ((1, 1.0), (2, 0.32 * bright), (3, 0.14 * bright), (4, 0.06 * bright), (5, 0.03 * bright)):
                out += a * np.sin(2 * np.pi * f * (1 + det) * h * t + ph * h)
    atk = np.clip(t / 1.3, 0, 1)
    atk = np.sin(atk * np.pi / 2) ** 2
    rel = np.ones(n)
    end = int(SR * length)
    rel[end:] = np.exp(-(t[end:] - length) * 2.2)
    swell = 1 + 0.07 * np.sin(2 * np.pi * 0.17 * t)
    return out * atk * rel * swell / (len(notes) * 3)


def bass_note(m, length):
    n = int(SR * (length + 0.8))
    t = np.arange(n) / SR
    f = midi(m)
    sig = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.1 * np.sin(2 * np.pi * 3 * f * t)
    atk = 1 - np.exp(-t * 18)
    rel = np.ones(n)
    end = int(SR * length)
    rel[end:] = np.exp(-(t[end:] - length) * 7)
    return sig * atk * rel * np.exp(-t * 0.25)


def shaker(vel):
    n = int(SR * 0.09)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    hp = noise - smooth(noise, 6)
    env = (1 - np.exp(-t * 900)) * np.exp(-t * 55)
    return hp * env * vel


pad_bus = np.zeros((N, 2))
ep_bus = np.zeros((N, 2))
bass_bus = np.zeros((N, 2))
perc_bus = np.zeros((N, 2))

n_chords = int(np.ceil(DUR / CHORD_LEN))
for ci in range(n_chords):
    name, bass, pad, arp = CHORDS[ci % 4]
    start = ci * CHORD_LEN
    final = start + CHORD_LEN >= DUR
    add(pad_bus, pad_chord(pad, CHORD_LEN + 0.15, 0.8 if ci == 0 else 1.0), start)
    if ci == 0:
        # intro: a few sparse notes
        for b, m, v in ((0, arp[0], 0.55), (2, arp[2], 0.42), (4, arp[4], 0.48), (6, arp[3], 0.4)):
            add(ep_bus, ep_note(midi(m), BEAT * 1.6, v), start + b * BEAT, pan=-0.2 if b % 4 else 0.2)
        continue
    if final:
        # last chord: a gentle rolled voicing that rings out
        for k, m in enumerate([50, 57, 62, 66, 69, 73, 76]):
            add(ep_bus, ep_note(midi(m), 2.4, 0.5 - k * 0.03), start + k * 0.055, pan=-0.3 + k * 0.1)
        add(bass_bus, bass_note(bass, 2.0), start)
        continue
    add(bass_bus, bass_note(bass, CHORD_LEN - 0.1), start)
    accents = [1.0, 0.55, 0.78, 0.5, 0.9, 0.55, 0.72, 0.48]
    for bar in range(2):
        for k in range(8):
            t0 = start + bar * 4 * BEAT + k * EIGHTH + rng.normal(0, 0.006)
            m = arp[k] + (12 if (bar == 1 and k == 4) else 0)
            v = 0.42 * accents[k] * rng.uniform(0.9, 1.08)
            add(ep_bus, ep_note(midi(m), EIGHTH * 1.7, v), t0, pan=0.25 * np.sin(k * 1.3))
            if ci >= 2:
                add(perc_bus, shaker(0.6 if k % 2 else 0.32), t0 + 0.004, pan=0.3)

for nm, b in (('pad', pad_bus), ('ep', ep_bus), ('bass', bass_bus), ('perc', perc_bus)):
    print('bus', nm, 'rms dB %.1f' % (20 * np.log10(np.sqrt(np.mean(b ** 2)) + 1e-12)))
music = 0.7 * pad_bus + 1.0 * ep_bus + 0.25 * bass_bus + 0.35 * perc_bus
music = reverb(music, wet=0.32)

# fades
t = np.arange(N) / SR
fade = np.clip(t / 1.2, 0, 1) * np.clip((DUR - t) / 2.2, 0, 1)
music *= fade[:, None]
# level: calm bed, about -19 dBFS RMS (roughly -18 LUFS)
rms = np.sqrt(np.mean(music ** 2))
music *= 10 ** (-20.5 / 20) / rms

# --------------------------------------------------------------------------
# interface sounds
# --------------------------------------------------------------------------


def snd_key(g):
    n = int(SR * 0.05)
    tt = np.arange(n) / SR
    noise = rng.standard_normal(n)
    hp = noise - smooth(noise, 4)
    f_tick = rng.uniform(2600, 3600)
    f_body = rng.uniform(170, 230)
    s = 0.5 * hp * np.exp(-tt * 520) + 0.35 * np.sin(2 * np.pi * f_tick * tt) * np.exp(-tt * 900) + 0.6 * np.sin(2 * np.pi * f_body * tt) * np.exp(-tt * 85)
    return s * g * 0.05


def snd_space(g):
    n = int(SR * 0.07)
    tt = np.arange(n) / SR
    noise = rng.standard_normal(n)
    s = 0.4 * (noise - smooth(noise, 8)) * np.exp(-tt * 380) + 0.8 * np.sin(2 * np.pi * 130 * tt) * np.exp(-tt * 60)
    return s * g * 0.05


def snd_click(g):
    def tick(f, d):
        n = int(SR * 0.03)
        tt = np.arange(n) / SR
        noise = rng.standard_normal(n)
        return 0.6 * (noise - smooth(noise, 3)) * np.exp(-tt * d) + 0.5 * np.sin(2 * np.pi * f * tt) * np.exp(-tt * d * 0.8)
    out = np.zeros(int(SR * 0.12))
    a = tick(4200, 700)
    b = tick(3300, 900) * 0.45
    out[: len(a)] += a
    k = int(SR * 0.07)
    out[k: k + len(b)] += b
    return out * g * 0.07


def snd_pop(g):
    n = int(SR * 0.12)
    tt = np.arange(n) / SR
    f = 420 + 820 * (1 - np.exp(-tt * 55))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-tt * 38) * (1 - np.exp(-tt * 900)) * g * 0.06


def band_noise(n, lo, hi):
    noise = rng.standard_normal(n)
    a = smooth(noise, max(1, int(SR / hi / 2)))
    b = smooth(noise, max(1, int(SR / lo / 2)))
    return a - b


def snd_whoosh(g, length=0.75, lo=180, hi=2200):
    n = int(SR * length)
    tt = np.arange(n) / SR
    s = band_noise(n, lo, hi)
    env = np.sin(np.pi * np.clip(tt / length, 0, 1)) ** 2.2
    s = s * env / (np.std(s) + 1e-9)
    pan = np.linspace(-0.5, 0.5, n)
    st = np.stack([s * np.sqrt(0.5 * (1 - pan)), s * np.sqrt(0.5 * (1 + pan))], 1)
    return st * g * 0.03


def snd_rise():
    n = int(SR * 1.4)
    tt = np.arange(n) / SR
    low = band_noise(n, 120, 900)
    high = band_noise(n, 400, 3500)
    mixk = np.clip(tt / 1.2, 0, 1)
    s = (1 - mixk) * low / np.std(low) + mixk * high / np.std(high)
    env = np.clip(tt / 0.9, 0, 1) ** 1.5 * np.clip((1.4 - tt) / 0.5, 0, 1)
    return s * env * 0.035


def snd_delete():
    n = int(SR * 0.35)
    tt = np.arange(n) / SR
    thump = np.sin(2 * np.pi * (95 + 60 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 18)
    tail = band_noise(n, 300, 2500) * np.exp(-tt * 14)
    tail /= np.std(tail) + 1e-9
    return (0.9 * thump + 0.12 * tail) * 0.09


def snd_draw(length=1.25):
    n = int(SR * length)
    tt = np.arange(n) / SR
    s = band_noise(n, 1800, 7000)
    s /= np.std(s) + 1e-9
    wob = 0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 7.5 * tt + 2 * np.sin(2 * np.pi * 1.3 * tt)))
    env = np.clip(tt / 0.08, 0, 1) * np.clip((length - tt) / 0.15, 0, 1)
    return s * wob * env * 0.008


def snd_shine():
    n = int(SR * 1.6)
    tt = np.arange(n) / SR
    out = np.zeros(n)
    for k, m in enumerate([86, 90, 93, 97, 98]):
        d = int(SR * 0.055 * k)
        seg = tt[: n - d]
        out[d:] += np.sin(2 * np.pi * midi(m) * seg) * np.exp(-seg * 7) * (0.8 - 0.08 * k)
    return out * 0.022


fx = np.zeros((N, 2))
for c in cues['sfx']:
    kind, ct, g = c['type'], c['t'], c['gain']
    pan = float(rng.uniform(-0.18, 0.18))
    if kind == 'key':
        add(fx, snd_key(g), ct, pan)
    elif kind == 'space':
        add(fx, snd_space(g), ct, pan)
    elif kind == 'click':
        add(fx, snd_click(g), ct, pan)
    elif kind == 'pop':
        add(fx, snd_pop(g), ct, pan)
    elif kind == 'whoosh':
        add(fx, snd_whoosh(g), ct)
    elif kind == 'swish':
        add(fx, snd_whoosh(g, 0.4, 500, 4000), ct)
    elif kind == 'rise':
        add(fx, snd_rise(), ct)
    elif kind == 'delete':
        add(fx, snd_delete(), ct)
    elif kind == 'draw':
        add(fx, snd_draw(), ct)
    elif kind == 'shine':
        add(fx, snd_shine(), ct)
fx = reverb(fx, seconds=1.2, rt=0.9, wet=0.12) * 1.55


def limit(x, ceiling=0.89):
    peak = np.max(np.abs(x))
    if peak > ceiling:
        # soft knee: tanh on the part above 70 percent of the ceiling
        k = ceiling * 0.7
        y = np.where(np.abs(x) > k, np.sign(x) * (k + (ceiling - k) * np.tanh((np.abs(x) - k) / (ceiling - k))), x)
        return y
    return x


def write(path, x):
    x = limit(x)
    pcm = np.clip(np.round(x * 32767), -32768, 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


write('music.wav', music)
write('mix.wav', music + fx)
for name, x in (('music', music), ('fx', fx), ('mix', music + fx)):
    print(name, 'peak dBFS %.1f' % (20 * np.log10(np.max(np.abs(x)) + 1e-12)), 'rms dBFS %.1f' % (20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)))
