// Synthesized score and sound effects at 118 BPM, written to audio/mix-raw.wav,
// then normalised to -14 LUFS integrated with peaks under -1 dBTP (audio/mix.wav).
// Also writes beats.json, the beat grid every cut and hit is placed on.
// Seeded noise only; the output is identical on every run.
//   node audio/score.mjs [--to 2.533]
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

// Riser: band of noise sweeping upward into the hit.
function riser(t0, t1, gain, seed) {
  const rnd = mulberry32(seed);
  const s0 = Math.round(t0 * SR), s1 = Math.round(t1 * SR);
  let a = 0, b = 0;
  for (let i = s0; i < s1; i++) {
    const k = (i - s0) / (s1 - s0);
    const n = rnd() * 2 - 1;
    const c = 0.01 + 0.25 * k * k;
    a += c * (n - a); b += c * (a - b);
    const band = a - b;
    const env = Math.pow(k, 2.2) * gain;
    add(i, band * env * (1 - 0.3 * k), band * env * (0.7 + 0.3 * k));
  }
}

// Short air swish for text entrances.
function swish(t0, dur, gain, seed) {
  const rnd = mulberry32(seed);
  const s0 = Math.round(t0 * SR), n = Math.round(dur * SR);
  let a = 0;
  for (let i = 0; i < n; i++) {
    const k = i / n;
    a += 0.18 * (rnd() * 2 - 1 - a);
    const env = Math.sin(Math.PI * Math.pow(k, 0.6)) * gain;
    add(s0 + i, a * env * (1.2 - k), a * env * (0.2 + k));
  }
}

// Bright ping with a short echo tail, for the line landing.
function ping(t0, gain, note = 74) {
  const s0 = Math.round(t0 * SR);
  const partials = [[midi(note), 1], [midi(note + 7), 0.5], [midi(note + 12), 0.25], [midi(note) * 2.76, 0.12]];
  const len = SR * 1.6;
  const dry = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let v = 0;
    for (const [f, a] of partials) v += a * Math.sin(2 * Math.PI * f * t) * Math.exp(-t * (3 + f / 600));
    dry[i] = v * Math.min(1, t * 2000);
  }
  for (let i = 0; i < len; i++) {
    const e1 = i >= SR * 0.127 ? dry[i - Math.round(SR * 0.127)] * 0.35 : 0;
    const e2 = i >= SR * 0.254 ? dry[i - Math.round(SR * 0.254)] * 0.18 : 0;
    add(s0 + i, (dry[i] + e1) * gain, (dry[i] + e2) * gain);
  }
}

// Plucked bass: a saw with a closing low-pass.
function bass(t0, note, gain) {
  const s0 = Math.round(t0 * SR);
  let ph = 0, lp = 0;
  for (let i = 0; i < SR * 0.22; i++) {
    const t = i / SR;
    ph += midi(note) / SR;
    const saw = 2 * (ph % 1) - 1;
    lp += (0.02 + 0.2 * Math.exp(-t * 30)) * (saw - lp);
    add(s0 + i, lp * Math.exp(-t * 9) * Math.min(1, t * 800) * gain);
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

// Short rising glide, for lines drawing on.
function glide(t0, dur, f0, f1, gain) {
  const s0 = Math.round(t0 * SR), n = Math.round(dur * SR);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const k = i / n;
    ph += (f0 * Math.pow(f1 / f0, k)) / SR;
    const env = Math.sin(Math.PI * k) * gain;
    add(s0 + i, Math.sin(2 * Math.PI * ph) * env * (1 - 0.4 * k), Math.sin(2 * Math.PI * ph) * env * (0.6 + 0.4 * k));
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

// ---------------------------------------------------------------------------
// SCENE 1 cue (0 to beat 5). The camera is already moving on frame 0, so the
// pad starts already sounding and the first kick lands on beat 0.
pad(0, beatTime(8) + 0.3, 0.5, DM9);
riser(0.15, beatTime(4), 0.5, 7);
swish(0.08, 0.5, 0.22, 11);
for (const n of [0, 1, 2, 3]) kick(beatTime(n), n === 0 ? 0.75 : 0.6);
for (const n of [1.5, 2.5, 3.5]) hat(beatTime(n), 0.09, Math.round(100 + n * 2)); // offbeat hats
kick(beatTime(4), 0.95);
sub(beatTime(4), 0.55);
ping(beatTime(4), 0.22);
swish(beatTime(5) - 0.3, 0.32, 0.25, 13); // exit swish into the cut

// SCENE 2 cue (beat 5 to beat 10). Bar 2 adds bass and claps; the chord moves
// to B flat on beat 8, when the address arrives.
const b = beatTime;
pad(b(8) - 0.05, LENGTH, 0.5, BBMAJ9, 0.2);
for (const n of [5, 6, 7, 8, 9]) kick(b(n), 0.62);
for (const n of [5, 7, 9]) clap(b(n), 0.32, 200 + n);
for (const n of [4.5, 5.5, 6.5, 7.5, 8.5, 9.5]) hat(b(n), 0.1, Math.round(300 + n * 2));
for (const n of [4.5, 5.5, 6.5, 7.5]) bass(b(n), 38, 0.42);       // D
for (const n of [8.5, 9.5]) bass(b(n), 34, 0.42);                 // B flat
glide(b(5), 0.4, 700, 1500, 0.05);                                // roads draw on
swish(b(5), 0.45, 0.16, 21);
ping(b(5.5), 0.07, 81);                                           // plot traced
kick(b(6) + 0.04, 0.35);                                          // pin lands
ping(b(6) + 0.04, 0.12, 86);
ping(b(6) + 0.16, 0.04, 81);                                      // ripples
ping(b(6) + 0.3, 0.03, 86);
riser(b(6.5), b(6.5) + 0.8, 0.12, 23);                            // circles open
ping(b(6.5), 0.08, 77);                                           // landmarks
ping(b(7), 0.08, 81);
ping(b(7.5), 0.08, 84);
swish(b(8), 0.35, 0.2, 25);                                       // address slides out
ping(b(8) + 0.05, 0.09, 74);
riser(b(9), b(10), 0.55, 27);                                     // frame stretches to fill
swish(b(9) + 0.2, 0.3, 0.22, 29);

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
