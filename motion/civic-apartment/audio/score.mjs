// The film's sound: an Afro-house instrumental at 118 BPM with a log drum,
// synthesized here (so it is royalty-free), and five sound effects placed on
// the frames they belong to. Writes audio/mix-raw.wav, then audio/mix.wav at
// -14 LUFS integrated with true peak under -1 dBTP, and beats.json, the grid
// every cut and hit sits on. Seeded noise only: identical on every run.
//   node audio/score.mjs [--to 15]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BPM, BEAT, FPS, DURATION, beatTime, mulberry32 } from '../src/lib.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SR = 48000;
const toArg = process.argv.indexOf('--to');
const LENGTH = toArg > 0 ? Number(process.argv[toArg + 1]) : DURATION;
const N = Math.round(LENGTH * SR);
const B = beatTime;

// ---------------------------------------------------------------------------
// Beat grid.
const beats = [];
for (let n = 0; beatTime(n) < DURATION; n++) {
  beats.push({ beat: n, time: +beatTime(n).toFixed(6), frame: Math.round(beatTime(n) * FPS), bar: Math.floor(n / 4) + 1, downbeat: n % 4 === 0 });
}
fs.writeFileSync(path.join(ROOT, 'beats.json'), JSON.stringify({ bpm: BPM, beatSeconds: BEAT, fps: FPS, beats }, null, 2) + '\n');

// ---------------------------------------------------------------------------
// Buses, so the keys can duck under the kick and the effects sit apart.
const bus = () => ({ L: new Float32Array(N), R: new Float32Array(N) });
const drums = bus(), bass = bus(), keys = bus(), sfx = bus();
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Mono signal into a bus at time t0, constant-power pan.
function place(b, t0, sig, gain = 1, pan = 0) {
  const a = ((pan + 1) * Math.PI) / 4;
  const gl = Math.cos(a) * Math.SQRT2 * gain, gr = Math.sin(a) * Math.SQRT2 * gain;
  const s0 = Math.round(t0 * SR);
  for (let i = 0; i < sig.length; i++) {
    const j = s0 + i;
    if (j < 0 || j >= N) continue;
    b.L[j] += sig[i] * gl;
    b.R[j] += sig[i] * gr;
  }
}

// RBJ biquad, fixed frequency.
function biquad(sig, type, f, q = 0.707) {
  const w = (2 * Math.PI * f) / SR, cw = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; }
  else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; }
  else { b0 = al; b1 = 0; b2 = -al; } // band-pass, peak gain 1
  const a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al;
  const out = new Float32Array(sig.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < sig.length; i++) {
    const x = sig[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}
const noise = (len, seed) => {
  const r = mulberry32(seed);
  return Float32Array.from({ length: Math.round(len * SR) }, () => r() * 2 - 1);
};
const env = (sig, fn) => sig.map((v, i) => v * fn(i / SR));

// ---------------------------------------------------------------------------
// Instruments.

function kick(punch = 1) {
  const n = Math.round(0.42 * SR), out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * (46 + 120 * Math.exp(-t * 32))) / SR;
    out[i] = (Math.sin(ph) * Math.exp(-t * 6.5) + 0.22 * punch * Math.exp(-t * 380) * Math.sin(ph * 7)) * Math.min(1, t * 1500);
  }
  return out;
}

function clap(seed) {
  const n = noise(0.24, seed);
  const shaped = env(n, (t) => {
    const burst = [0, 0.011, 0.022].reduce((a, o) => a + (t >= o ? Math.exp(-(t - o) * 260) : 0), 0);
    return 0.55 * burst + Math.exp(-t * 17) * (t > 0.022 ? 1 : 0);
  });
  return biquad(biquad(shaped, 'bp', 1300, 0.9), 'hp', 500);
}

const shaker = (seed) => env(biquad(noise(0.06, seed), 'hp', 6500), (t) => Math.min(1, t * 400) * Math.exp(-t * 55));
const openHat = (seed) => env(biquad(noise(0.24, seed), 'hp', 8000), (t) => Math.min(1, t * 2000) * Math.exp(-t * 13));

function conga(f, seed) {
  const n = Math.round(0.24 * SR), out = new Float32Array(n);
  const slap = biquad(noise(0.01, seed), 'bp', 2200, 1.2);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * f * (1 + 0.35 * Math.exp(-t * 60))) / SR;
    out[i] = Math.sin(ph) * Math.exp(-t * 15) * Math.min(1, t * 2000) + (i < slap.length ? slap[i] * 0.35 : 0);
  }
  return out;
}

// The log drum: a woody, pitch-dropping bass hit with a soft knock on the
// front, saturated so it speaks on small speakers.
function logDrum(note, seed, len = 0.46) {
  const f0 = midi(note);
  const n = Math.round(len * SR), out = new Float32Array(n);
  const knock = biquad(noise(0.012, seed), 'bp', 900, 1.4);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * f0 * (1 + 0.5 * Math.exp(-t * 55))) / SR;
    const tone = Math.sin(ph) + 0.38 * Math.sin(2 * ph) + 0.12 * Math.sin(3 * ph);
    const e = Math.min(1, t * 700) * Math.exp(-t * 6.2);
    out[i] = Math.tanh(1.9 * tone * e) / Math.tanh(1.9) + (i < knock.length ? knock[i] * 0.3 : 0);
  }
  return biquad(out, 'lp', 1700);
}

// Short electric-piano chord stab.
function stab(notes) {
  const n = Math.round(0.5 * SR), out = new Float32Array(n);
  for (const m of notes) {
    const f = midi(m);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const w = 2 * Math.PI * f * t;
      out[i] += (Math.sin(w) + 0.25 * Math.sin(2 * w) + 0.07 * Math.sin(3 * w)) * Math.exp(-t * 7.5) * Math.min(1, t * 400);
    }
  }
  return out.map((v) => v / notes.length);
}

// Warm pad: detuned saws, one-pole low-pass, slow swell and release.
function pad(notes, dur, cutoff, seed) {
  const n = Math.round(dur * SR);
  const L = new Float32Array(n), R = new Float32Array(n);
  const r = mulberry32(seed);
  const voices = notes.flatMap((m) => [-0.08, 0.08].map((d) => ({ f: midi(m + d), ph: r(), right: d > 0 })));
  let lpL = 0, lpR = 0;
  const c = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  for (let i = 0; i < n; i++) {
    let l = 0, rr = 0;
    for (const v of voices) {
      v.ph = (v.ph + v.f / SR) % 1;
      const s = 2 * v.ph - 1;
      if (v.right) rr += s; else l += s;
    }
    lpL += c * (l - lpL);
    lpR += c * (rr - lpR);
    const t = i / SR;
    const e = Math.min(1, t / 0.25) * Math.min(1, (dur - t) / 0.15);
    L[i] = (lpL / notes.length) * e;
    R[i] = (lpR / notes.length) * e;
  }
  return { L, R };
}

// ---------------------------------------------------------------------------
// The track. D minor, one chord per bar: Dm9, Bbmaj7, Gm9, Asus4, round
// again, ending on Dm9. Intro of percussion and pad under the map dive; the
// log drum, claps and stabs drop in on beat 4 with the expressway's arrival;
// a break while the end card's frame pulls back (beats 22.5 to 24); the
// groove returns on the logo and fades out over the last 0.5 s.
const CHORDS = [
  { root: 38, notes: [50, 53, 57, 60, 64] }, // Dm9
  { root: 34, notes: [46, 50, 53, 57] },     // Bbmaj7
  { root: 31, notes: [43, 46, 50, 53, 57] }, // Gm9
  { root: 33, notes: [45, 50, 52, 55] },     // Asus4
];
const chordAt = (beat) => (beat >= 28 ? CHORDS[0] : CHORDS[Math.floor(beat / 4) % 4]);
const LAST_BEAT = Math.floor(LENGTH / BEAT);
const inBreak = (beat) => beat >= 22.5 && beat < 24;
const full = (beat) => beat >= 4 && !inBreak(beat);

for (let bar = 0; bar * 4 <= LAST_BEAT; bar++) {
  const ch = chordAt(bar * 4);
  const p = pad(ch.notes, 4 * BEAT + 0.15, bar === 0 ? 700 : 1100, 40 + bar);
  for (let i = 0; i < p.L.length; i++) {
    const j = Math.round(B(bar * 4) * SR) + i;
    if (j < N) { keys.L[j] += p.L[i] * 0.55; keys.R[j] += p.R[i] * 0.55; }
  }
}

let seed = 1000;
for (let s = 0; s <= LAST_BEAT * 4 + 3; s++) {
  const beat = s / 4;
  const t = B(beat);
  if (t >= LENGTH) break;
  const pos = s % 16; // sixteenth inside the bar
  // shaker on every sixteenth, pushed on the offbeat ones
  place(drums, t, shaker(seed++), [0.55, 0.3, 0.8, 0.35][s % 4] * 0.32, 0.25);
  if (s % 4 === 0 && !inBreak(beat)) place(drums, t, kick(beat === 24 ? 1.4 : 1), 0.9);
  if (!full(beat)) {
    if (beat >= 2 && !inBreak(beat) && [3, 6, 9, 11, 14].includes(pos)) place(drums, t, conga([3, 9, 11].includes(pos) ? 330 : 220, seed++), 0.22, -0.3);
    continue;
  }
  if (s % 8 === 4) place(drums, t, clap(seed++), 0.42, 0.05);
  if (s % 4 === 2) place(drums, t, openHat(seed++), 0.12, -0.15);
  if ([3, 6, 9, 11, 14].includes(pos)) place(drums, t, conga([3, 9, 11].includes(pos) ? 330 : 220, seed++), 0.22, -0.3);
  // log drum: root, root, fifth, octave, root, seventh
  const LOG = { 0: 0, 3: 0, 6: 7, 9: 12, 11: 0, 14: 10 };
  if (pos in LOG) place(bass, t, logDrum(chordAt(beat).root + LOG[pos], seed++), pos === 0 ? 0.62 : 0.5);
  // chord stabs on the offbeats
  if ([2, 10, 15].includes(pos)) place(keys, t, stab(chordAt(beat).notes.map((m) => m + 12)), pos === 15 ? 0.16 : 0.26, pos === 10 ? 0.3 : -0.2);
}

// A soft swell through the break, into the logo.
{
  const t0 = B(22.5), t1 = B(24);
  const n = noise(t1 - t0, 77);
  let low = 0, band = 0;
  const out = new Float32Array(n.length);
  for (let i = 0; i < n.length; i++) {
    const k = i / n.length;
    const c = 2 * Math.sin((Math.PI * (400 + 3000 * k * k)) / SR);
    low += c * band; band += c * (n[i] - low - 0.4 * band);
    out[i] = band * Math.pow(k, 2.2);
  }
  place(keys, t0, out, 0.32);
}

// Keys duck under every kick, the house pump.
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const beat = t / BEAT;
  const since = (beat - Math.floor(beat)) * BEAT;
  const kicking = !inBreak(Math.floor(beat));
  const g = kicking ? 1 - 0.38 * Math.exp(-since * 9) : 1;
  keys.L[i] *= g;
  keys.R[i] *= g;
}

// ---------------------------------------------------------------------------
// Sound effects, at the film's own times (see src/scene*.js).

// 1. A soft air whoosh under the map move in scene 1 (0 to 2.53 s), drifting
//    left to right as the camera heads east.
{
  const t0 = 0.05, dur = 2.45;
  const n = noise(dur, 11);
  let low = 0, band = 0;
  const out = new Float32Array(n.length);
  for (let i = 0; i < n.length; i++) {
    const k = i / n.length;
    const f = 500 + 1700 * Math.sin(Math.PI * Math.min(1, k * 1.15));
    const c = 2 * Math.sin((Math.PI * f) / SR);
    low += c * band; band += c * (n[i] - low - 1.1 * band);
    out[i] = band * Math.pow(Math.sin(Math.PI * k), 1.3);
  }
  const s0 = Math.round(t0 * SR);
  for (let i = 0; i < out.length; i++) {
    const pan = -0.6 + 1.2 * (i / out.length);
    const a = ((pan + 1) * Math.PI) / 4;
    sfx.L[s0 + i] += out[i] * Math.cos(a) * 0.5;
    sfx.R[s0 + i] += out[i] * Math.sin(a) * 0.5;
  }
}

// 2. A low thud when the pin lands (scene 2, beat 6.5).
{
  const n = Math.round(0.5 * SR), out = new Float32Array(n);
  const thump = biquad(noise(0.04, 21), 'lp', 220);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * (48 + 75 * Math.exp(-t * 34))) / SR;
    out[i] = Math.sin(ph) * Math.exp(-t * 8.5) * Math.min(1, t * 900) + (i < thump.length ? thump[i] * 0.6 : 0);
  }
  place(sfx, B(6.5), out, 0.95);
}

// 3. A light glass shimmer as the building is revealed inside the frame
//    (scene 2, from beat 9 + 0.12 s): high bell partials on the chord,
//    scattered over half a second.
{
  const r = mulberry32(31);
  const t0 = B(9) + 0.12;
  const notes = [86, 89, 93, 96, 98, 100, 101, 105];
  for (let k = 0; k < 18; k++) {
    const f = midi(notes[Math.floor(r() * notes.length)]);
    const start = t0 + Math.pow(r(), 1.4) * 0.55;
    const n = Math.round(0.9 * SR), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      out[i] = (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t * 9)) * Math.exp(-t * 5.5) * Math.min(1, t * 1500);
    }
    place(sfx, start, out, 0.045, r() * 1.4 - 0.7);
  }
}

// 4. A soft click each time the segmented control's indicator moves
//    (scene 4, beats 19, 19.5 and 20), following it left to right.
[[19, -0.05], [19.5, 0.15], [20, 0.35]].forEach(([b, pan], k) => {
  const n = Math.round(0.03 * SR), out = new Float32Array(n);
  const tick = biquad(noise(0.005, 41 + k), 'bp', 3400, 1.5);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = (i < tick.length ? tick[i] * 0.8 : 0) + 0.35 * Math.sin(2 * Math.PI * 2300 * t) * Math.exp(-t * 260);
  }
  place(sfx, B(b), out, 0.5, pan);
});

// 5. A low hit when the logo appears (scene 5, beat 24).
{
  const n = Math.round(1.6 * SR), out = new Float32Array(n);
  const thump = biquad(noise(0.06, 51), 'lp', 180);
  let ph = 0, ph2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * (40 + 55 * Math.exp(-t * 18))) / SR;
    ph2 += (2 * Math.PI * (78 - 18 * Math.min(1, t / 0.3))) / SR;
    out[i] = (Math.sin(ph) * Math.exp(-t * 2.6) + 0.45 * Math.sin(ph2) * Math.exp(-t * 9)) * Math.min(1, t * 900) + (i < thump.length ? thump[i] * 0.7 : 0);
  }
  place(sfx, B(24), out, 0.9);
}

// ---------------------------------------------------------------------------
// Mix, then fade the whole thing out over the last 0.5 s.
const L = new Float32Array(N), R = new Float32Array(N);
const GAIN = { drums: 0.85, bass: 0.95, keys: 0.5, sfx: 1 };
for (let i = 0; i < N; i++) {
  L[i] = drums.L[i] * GAIN.drums + bass.L[i] * GAIN.bass + keys.L[i] * GAIN.keys + sfx.L[i] * GAIN.sfx;
  R[i] = drums.R[i] * GAIN.drums + bass.R[i] * GAIN.bass + keys.R[i] * GAIN.keys + sfx.R[i] * GAIN.sfx;
}
if (LENGTH >= DURATION) {
  const f0 = Math.round((DURATION - 0.5) * SR);
  for (let i = f0; i < N; i++) {
    const g = Math.cos((Math.PI / 2) * Math.min(1, (i - f0) / (N - f0)));
    L[i] *= g;
    R[i] *= g;
  }
}

// ---------------------------------------------------------------------------
function writeWav(file, l, r) {
  const buf = Buffer.alloc(44 + l.length * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + l.length * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(l.length * 4, 40);
  let peak = 0;
  for (let i = 0; i < l.length; i++) peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i]));
  const g = peak > 0.5 ? 0.5 / peak : 1; // headroom before normalising
  for (let i = 0; i < l.length; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, l[i] * g)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r[i] * g)) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
}

const raw = path.join(ROOT, 'audio/mix-raw.wav');
const mix = path.join(ROOT, 'audio/mix.wav');
writeWav(raw, L, R);

function loudness(file) {
  const log = execFileSync('sh', ['-c', `ffmpeg -hide_banner -nostats -i "${file}" -af ebur128=peak=true -f null - 2>&1`]).toString();
  const summary = log.split('Summary:')[1];
  return {
    I: Number(/I:\s+(-?[\d.]+) LUFS/.exec(summary)[1]),
    TP: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(summary)[1]),
  };
}

const before = loudness(raw);
const gain = -14 - before.I;
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af',
  `volume=${gain.toFixed(2)}dB,alimiter=limit=0.84:attack=1:release=40:level=false,aresample=48000`, '-c:a', 'pcm_s16le', mix]);
let after = loudness(mix);
// The limiter can shave a little loudness; one corrective pass.
if (Math.abs(after.I + 14) > 0.3) {
  const fix = -14 - after.I;
  const tmp = mix.replace('.wav', '-tmp.wav');
  fs.renameSync(mix, tmp);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-af',
    `volume=${fix.toFixed(2)}dB,alimiter=limit=0.84:attack=1:release=40:level=false`, '-c:a', 'pcm_s16le', mix]);
  fs.unlinkSync(tmp);
  after = loudness(mix);
}
console.log(`raw ${before.I} LUFS -> mix ${after.I} LUFS, true peak ${after.TP} dBTP, ${LENGTH}s`);
