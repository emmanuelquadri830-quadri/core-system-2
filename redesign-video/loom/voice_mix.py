"""Fit one voice clip per cue into the video's timing and mix it over a quiet music bed.

Usage: python3 voice_mix.py cues.json voice_dir music.wav out.wav

cues.json   cue timings exported from the page (id, start, slotEnd)
voice_dir   one audio file per cue, named <cue id>.mp3 (or .wav)
music.wav   background music, at least as long as the video
"""
import json
import os
import subprocess
import sys
import wave

import numpy as np

SR = 44100


def load(path, tempo=1.0):
    """Decode any audio file to mono float32 at SR, optionally sped up without pitch change."""
    af = ['-af', f'atempo={tempo:.4f}'] if abs(tempo - 1) > 1e-3 else []
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, *af, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def trim(x, thr=0.01):
    """Cut leading and trailing silence so clips start on the word."""
    idx = np.nonzero(np.abs(x) > thr)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(0.02 * SR))
    b = min(len(x), idx[-1] + int(0.08 * SR))
    return x[a:b]


cues = json.load(open(sys.argv[1]))
vdir, music_path, out = sys.argv[2], sys.argv[3], sys.argv[4]
duration = max(c['slotEnd'] for c in cues) + 0.5
N = int(SR * duration)
voice = np.zeros(N)
report = []
for c in cues:
    path = next((os.path.join(vdir, c['id'] + ext) for ext in ('.mp3', '.wav') if os.path.exists(os.path.join(vdir, c['id'] + ext))), None)
    if not path:
        raise SystemExit(f'missing voice clip for {c["id"]}')
    clip = trim(load(path))
    slot = c['slotEnd'] - c['start'] - 0.12
    tempo = 1.0
    if len(clip) / SR > slot:
        tempo = min(1.18, (len(clip) / SR) / slot)
        clip = trim(load(path, tempo))
    i = int(SR * (c['start'] + 0.05))
    j = min(N, i + len(clip))
    voice[i:j] += clip[: j - i]
    report.append((c['id'], round(len(clip) / SR, 2), round(slot, 2), round(tempo, 3)))

# loudness: voice peaks around -3 dBFS
voice *= 0.7 / (np.max(np.abs(voice)) + 1e-9)

music = load(music_path)
music = np.pad(music, (0, max(0, N - len(music))))[:N]
# duck the music under the voice
env = np.abs(voice)
win = int(0.25 * SR)
env = np.convolve(env, np.ones(win) / win, mode='same')
duck = 1 - 0.55 * np.clip(env / (np.max(env) * 0.15 + 1e-9), 0, 1)
music *= 0.32 * duck

mix = voice + music
mix = np.clip(mix, -0.98, 0.98)
pcm = (mix * 32767).astype('<i2')
with wave.open(out, 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
for r in report:
    print(*r)
