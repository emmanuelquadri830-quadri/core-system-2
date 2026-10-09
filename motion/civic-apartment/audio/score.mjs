// Synthesized Afro-house score with a log drum, and the brief's five sound
// effects, at 118 BPM. Written to audio/mix-raw.wav,
// then normalised to -14 LUFS integrated with peaks under -1 dBTP (audio/mix.wav).
// Also writes beats.json, the beat grid every cut and hit is placed on.
// Seeded noise only; the output is identical on every run.
//   node audio/score.mjs [--to 2.533]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BPM, BEAT, FPS, DURATION, beatTime, mulberry32 } from '../src/lib.js';
import { END as END1 } from '../src/scene1.js';
import { T_STEPS } from '../src/scene4.js';
import { T_LOGO } from '../src/scene5.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SR = 48000;
const toArg = process.argv.indexOf('--to');
const LENGTH = toArg > 0 ? Number(process.argv[toArg + 1]) : DURATION;
const N = Math.round(LENGTH * SR);
const L = new Float32Array(N), R = new Float32Array(N);

// ---------------------------------------------------------------------------
// Beat grid.
const beats = [];
for (let n = 0; beatTime(n) < DURATION; n++) {
  beats.push({ beat: n, time: +beatTime(n).toFixed(6), frame: Math.round(beatTime(n) * FPS), bar: Math.floor(n / 4) + 1, downbeat: n % 4 === 0 });
}
fs.writeFileSync(path.join(ROOT, 'beats.json'), JSON.stringify({ bpm: BPM, beatSeconds: BEAT, fps: FPS, beats }, null, 2) + '\n');

// ---------------------------------------------------------------------------
const add = (i, l, r = l) => { if (i >= 0 && i < N) { L[i] += l; R[i] += r; } };
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

function kick(t0, gain = 0.9) {
  const s0 = Math.round(t0 * SR);
  let ph = 0;
  for (let i = 0; i < SR * 0.45; i++) {
    const t = i / SR;
    const f = 44 + 110 * Math.exp(-t * 28);
    ph += (2 * Math.PI * f) / SR;
    const env = Math.exp(-t * 7.5) * Math.min(1, t * 900);
    const click = Math.exp(-t * 400) * 0.25;
    add(s0 + i, (Math.sin(ph) * env + click * Math.sin(ph * 6)) * gain);
  }
}

function hat(t0, gain, seed) {
  const rnd = mulberry32(seed);
  const s0 = Math.round(t0 * SR);
  let prev = 0;
  for (let i = 0; i < SR * 0.06; i++) {
    const n = rnd() * 2 - 1;
    const hp = n - prev; prev = n; // crude high-pass
    const env = Math.exp(-(i / SR) * 70);
    add(s0 + i, hp * env * gain * 0.9, hp * env * gain);
  }
}

// Pad: gently detuned saws through a soft low-pass. A chord segment fades in
// over `attack` seconds (0 means already sounding) and out over 0.3 s.
const DM9 = [38, 45, 53, 57, 60, 64];     // D2 A2 F3 A3 C4 E4
const BBMAJ9 = [34, 41, 50, 57, 60, 65];  // Bb1 F2 D3 A3 C4 F4
const GM9 = [31, 38, 46, 57, 62, 65];     // G1 D2 Bb2 A3 D4 F4 (keeps A3 and F4 from B flat)
function pad(t0, t1, gain, notes = DM9, attack = 0) {
  const s0 = Math.round(t0 * SR), s1 = Math.min(N, Math.round(t1 * SR));
  const phases = notes.flatMap(() => [0, 0]);
  let lpL = 0, lpR = 0;
  for (let i = s0; i < s1; i++) {
    const t = (i - s0) / SR;
    const rise = attack > 0 ? Math.min(1, t / attack) : Math.min(1, 0.35 + t / 1.2);
    const env = rise * Math.min(1, (s1 - i) / (SR * 0.3));
    let l = 0, r = 0;
    notes.forEach((m, k) => {
      for (const [j, det] of [[0, -0.07], [1, 0.07]]) {
        const idx = k * 2 + j;
        phases[idx] += midi(m + det) / SR;
        const saw = 2 * (phases[idx] % 1) - 1;
        if (j === 0) l += saw; else r += saw;
      }
    });
    const cut = 0.035 + 0.05 * Math.min(1, i / SR / 2.2); // opens as the camera dives
    lpL += cut * (l - lpL); lpR += cut * (r - lpR);
    add(i, (lpL / notes.length) * gain * env, (lpR / notes.length) * gain * env);
  }
}

// Clap: three quick noise bursts and a short tail.
function clap(t0, gain, seed) {
  const rnd = mulberry32(seed);
  const s0 = Math.round(t0 * SR);
  let a = 0, b = 0;
  for (let i = 0; i < SR * 0.25; i++) {
    const t = i / SR;
    const n = rnd() * 2 - 1;
    a += 0.35 * (n - a); b += 0.08 * (a - b);
    const band = a - b;
    const bursts = [0, 0.011, 0.022].reduce((e, d) => e + (t >= d ? Math.exp(-(t - d) * 220) : 0), 0);
    const env = bursts * 0.6 + Math.exp(-t * 18) * 0.5;
    add(s0 + i, band * env * gain * 0.9, band * env * gain);
  }
}

function sub(t0, gain) {
  const s0 = Math.round(t0 * SR);
  let ph = 0;
  for (let i = 0; i < SR * 1.2; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * (36.7 + 20 * Math.exp(-t * 10))) / SR;
    add(s0 + i, Math.sin(ph) * Math.exp(-t * 2.4) * Math.min(1, t * 400) * gain);
  }
}

// Crash: airy high-passed noise with a soft attack and a natural two-stage
// decay. The low-pass closes as it rings out, so it darkens like a cymbal, and
// each side has its own seeded noise so it sounds wide.
function crash(t0, dur, gain, seed) {
  const rndL = mulberry32(seed), rndR = mulberry32(seed + 1);
  const s0 = Math.round(t0 * SR), n = Math.round(dur * SR);
  let hL = 0, hR = 0, lpL = 0, lpR = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const nL = rndL() * 2 - 1, nR = rndR() * 2 - 1;
    hL += 0.2 * (nL - hL); hR += 0.2 * (nR - hR); // the lows, subtracted below to leave the air
    const cut = 0.3 + 0.55 * Math.exp(-t * 2.5);
    lpL += cut * (nL - hL - lpL); lpR += cut * (nR - hR - lpR);
    const env = Math.min(1, t / 0.012) * (0.55 * Math.exp(-t * 7) + 0.45 * Math.exp(-t * 1.6)) *
      Math.min(1, (n - i) / (SR * 0.2));
    add(s0 + i, lpL * env * gain, lpR * env * gain);
  }
}

// Glass glint: each high partial is a pair of sines a few hertz apart, so the
// pair beats (the shimmer), over two tiny clicks of high-passed noise 30 ms
// apart, like a camera shutter. The sides beat at different rates for width.
function glint(t0, gain, seed, notes = [98, 101, 105]) {
  const rnd = mulberry32(seed);
  const s0 = Math.round(t0 * SR), n = Math.round(SR * 0.6);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let l = 0, r = 0;
    notes.forEach((m, k) => {
      const f = midi(m), d = 4 + 2 * k;
      const a = Math.exp(-t * (6 + 3 * k)) / (2 * notes.length);
      l += a * (Math.sin(2 * Math.PI * (f - d) * t) + Math.sin(2 * Math.PI * (f + d) * t));
      r += a * (Math.sin(2 * Math.PI * (f - 1.3 * d) * t) + Math.sin(2 * Math.PI * (f + 1.3 * d) * t));
    });
    const nz = rnd() * 2 - 1;
    const hp = nz - prev; prev = nz;
    const tick = (Math.exp(-t * 900) + (t >= 0.03 ? 0.6 * Math.exp(-(t - 0.03) * 900) : 0)) * hp * 0.35;
    const env = Math.min(1, t / 0.002) * Math.min(1, (n - i) / (SR * 0.05)) * gain;
    add(s0 + i, (l + tick) * env, (r + tick) * env);
  }
}

// ---------------------------------------------------------------------------
// Afro-house kit.

// Log drum: a pitched, saturated body with a fast downward bend and a wooden
// knock on the attack. It carries the bassline.
function logDrum(t0, note, gain, dur = 0.42) {
  const s0 = Math.round(t0 * SR), n = Math.round(dur * SR);
  const f = midi(note);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (f * (1 + 0.9 * Math.exp(-t * 55))) / SR;
    const body = Math.sin(2 * Math.PI * ph) + 0.35 * Math.sin(4 * Math.PI * ph) + 0.12 * Math.sin(6 * Math.PI * ph);
    const env = Math.min(1, t * 1500) * Math.exp(-t * 6.5) * Math.min(1, (n - i) / (SR * 0.03));
    const knock = Math.sin(2 * Math.PI * 1150 * t) * Math.exp(-t * 160) * Math.min(1, t * 3000) * 0.3;
    add(s0 + i, (Math.tanh(body * env * 2.2) * 0.75 + knock) * gain);
  }
}

// Shaker: a short burst of bright seeded noise.
function shaker(t0, gain, seed) {
  const rnd = mulberry32(seed);
  const s0 = Math.round(t0 * SR), n = Math.round(SR * 0.07);
  let p1 = 0, p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const x = rnd() * 2 - 1;
    const hp = x - p1; p1 = x;
    p2 += 0.5 * (hp - p2);
    const env = Math.min(1, t / 0.008) * Math.exp(-t * 55);
    add(s0 + i, p2 * env * gain * 0.8, p2 * env * gain);
  }
}

// Conga: a short pitched skin with a small upward bend at the strike.
function conga(t0, freq, gain, pan = 0) {
  const s0 = Math.round(t0 * SR), n = Math.round(SR * 0.25);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (freq * (1 + 0.25 * Math.exp(-t * 40))) / SR;
    const v = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 16) * Math.min(1, t * 2000) * gain;
    add(s0 + i, v * (1 - pan), v * (1 + pan));
  }
}

// Keys: a soft electric-piano stab, each voice a lightly modulated sine.
function keys(t0, notes, gain, dur = 0.5) {
  const s0 = Math.round(t0 * SR), n = Math.round(dur * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let l = 0, r = 0;
    notes.forEach((m, k) => {
      const f = midi(m);
      const v = Math.sin(2 * Math.PI * f * t + 0.8 * Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 9)) * Math.exp(-t * 5);
      if (k % 2) r += v; else l += v;
    });
    const env = (Math.min(1, t * 400) * Math.min(1, (n - i) / (SR * 0.05)) * gain) / notes.length;
    add(s0 + i, (l + 0.5 * r) * env, (r + 0.5 * l) * env);
  }
}

// ---------------------------------------------------------------------------
// Sound effects: only the five in the brief.

// Soft air whoosh: band-limited noise whose band rises and swings across the
// stereo field, swelling and easing away.
function airWhoosh(t0, t1, gain, seed) {
  const rndL = mulberry32(seed), rndR = mulberry32(seed + 1);
  const s0 = Math.round(t0 * SR), n = Math.round((t1 - t0) * SR);
  let aL = 0, bL = 0, aR = 0, bR = 0;
  for (let i = 0; i < n; i++) {
    const k = i / n;
    const c = 0.015 + 0.09 * k;
    aL += c * (rndL() * 2 - 1 - aL); bL += c * 0.5 * (aL - bL);
    aR += c * (rndR() * 2 - 1 - aR); bR += c * 0.5 * (aR - bR);
    const env = Math.pow(Math.sin(Math.PI * Math.pow(k, 0.8)), 1.5) * gain;
    const pan = 0.5 + 0.4 * Math.sin(Math.PI * k);
    add(s0 + i, (aL - bL) * env * (1.2 - pan), (aR - bR) * env * (0.4 + pan));
  }
}

// Low thud: a soft, short low drum with no click.
function thud(t0, gain) {
  const s0 = Math.round(t0 * SR);
  let ph = 0;
  for (let i = 0; i < SR * 0.4; i++) {
    const t = i / SR;
    ph += (48 + 50 * Math.exp(-t * 30)) / SR;
    add(s0 + i, Math.sin(2 * Math.PI * ph) * Math.exp(-t * 11) * Math.min(1, t * 300) * gain);
  }
}

// Soft click: a tiny damped tick, for the segmented control.
function click(t0, gain, seed) {
  const rnd = mulberry32(seed);
  const s0 = Math.round(t0 * SR);
  let prev = 0;
  for (let i = 0; i < SR * 0.03; i++) {
    const t = i / SR;
    const x = rnd() * 2 - 1, hp = x - prev; prev = x;
    add(s0 + i, (Math.sin(2 * Math.PI * 2400 * t) * 0.6 + hp * 0.4) * Math.exp(-t * 320) * gain);
  }
}

// Low hit: sub drop with a low tom on top.
function lowHit(t0, gain) {
  sub(t0, gain);
  const s0 = Math.round(t0 * SR);
  let ph = 0;
  for (let i = 0; i < SR * 0.6; i++) {
    const t = i / SR;
    ph += (85 + 70 * Math.exp(-t * 25)) / SR;
    add(s0 + i, Math.sin(2 * Math.PI * ph) * Math.exp(-t * 6) * Math.min(1, t * 800) * gain * 0.6);
  }
}

// ---------------------------------------------------------------------------
// Arrangement: Afro-house at 118 BPM over the whole 15 s. Bar n starts on
// beat 4(n - 1); 16th steps are a quarter beat. Bar 1 is the intro under the
// scene 1 dive; the full groove lands on beat 4 with the expressway line.
const b = beatTime;
const STEP = BEAT / 4;
const LAST_BEAT = Math.floor(DURATION / BEAT); // beat 29
const bars = [
  { chord: DM9, root: 38 }, { chord: DM9, root: 38 }, { chord: BBMAJ9, root: 34 }, { chord: GM9, root: 31 },
  { chord: DM9, root: 38 }, { chord: BBMAJ9, root: 34 }, { chord: GM9, root: 31 }, { chord: DM9, root: 38 },
];
bars.forEach((bar, i) => {
  const t0 = b(4 * i), t1 = Math.min(LENGTH, b(4 * i + 4));
  if (t0 >= LENGTH) return;
  pad(i === 0 ? 0 : t0 - 0.05, t1 + 0.3, 0.36, bar.chord, i === 0 ? 0 : 0.2);
});

for (let n = 0; n <= LAST_BEAT; n++) {
  const bar = Math.floor(n / 4), beatInBar = n % 4;
  const thin = n >= 28; // the drums thin out over the held end frame
  kick(b(n), n < 4 ? 0.5 : thin ? 0.45 : 0.68);
  if (n >= 4 && !thin && beatInBar % 2 === 1) clap(b(n), 0.3, 600 + n);
  if (n >= 4 && !thin) hat(b(n + 0.5), 0.08, 700 + n);
  for (let s = 0; s < 4; s++) shaker(b(n) + s * STEP, s === 2 ? 0.06 : 0.035, 800 + n * 4 + s);
  if (bar >= 1 && !thin) {
    if (beatInBar === 0) conga(b(n) + 3 * STEP, 330, 0.16, 0.3);
    if (beatInBar === 1) conga(b(n) + 2 * STEP, 220, 0.18, -0.3);
    if (beatInBar === 2) { conga(b(n) + 2 * STEP, 330, 0.14, 0.3); conga(b(n) + 3 * STEP, 330, 0.12, 0.3); }
    if (beatInBar === 3) conga(b(n) + 2 * STEP, 220, 0.16, -0.3);
  }
}

// Log drum from bar 2, plus a pickup at the end of bar 1. Steps within the bar
// and their intervals over the bar's root.
const LOG = [[3, 0], [6, 0], [10, 7], [13, 12], [14, 0]];
logDrum(b(3.75), 38, 0.42);
bars.forEach((bar, i) => {
  if (i === 0) return;
  for (const [step, iv] of LOG) {
    const t = b(4 * i) + step * STEP;
    if (t < DURATION - 0.1) logDrum(t, bar.root + iv, 0.5);
  }
  // Offbeat keys from bar 3.
  if (i >= 2) {
    const top = bar.chord.filter((m) => m >= 50);
    for (const n of [0.5, 2.5]) if (b(4 * i + n) < DURATION - 0.3) keys(b(4 * i + n), top, 0.14);
  }
});
crash(b(4), 1.6, 0.06, 41);   // the groove arrives with the line
crash(b(16), 1.4, 0.05, 43);  // into the prices

// The five sound effects.
airWhoosh(0, END1 + 0.05, 0.42, 51);           // the map move in scene 1
thud(b(6) + 0.05, 0.75);                       // the pin lands
glint(b(10), 0.14, 53);                        // glass shimmer as the building is revealed
T_STEPS.forEach((t, i) => click(t, 0.3, 61 + i)); // each step of the indicator
lowHit(T_LOGO, 0.75);                          // the logo

// The music fades out over the last half second.
const fadeFrom = Math.round((DURATION - 0.5) * SR);
for (let i = fadeFrom; i < N; i++) {
  const k = (i - fadeFrom) / (Math.round(DURATION * SR) - fadeFrom);
  const g = 0.5 * (1 + Math.cos(Math.PI * Math.min(1, k)));
  L[i] *= g; R[i] *= g;
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
