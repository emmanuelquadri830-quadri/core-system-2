// Score and sound design for the location film, synthesized from scratch.
// Quiet on purpose: a low atmospheric rise, air during the descent, one
// controlled impact on the reveal, a warm chord under the brand and a clean
// end. A soft sub pulse on every beat gives the measured grid something to
// lock to. Writes build/audio/location-*.wav and location/beats.json.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SR, Bus, sec, db, writeWav, readWav, reverb, pingpong, highpassBus, limit, lufs, truePeakDb, filter, noise, mul, osc, expDecay, edges, sum, gain, mtof } from '../audio/dsp.mjs';
import * as I from '../audio/instruments.mjs';
import { BPM, BEATS, DURATION, CUES } from './timeline.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const outDir = path.join(root, 'build', 'audio');
fs.mkdirSync(outDir, { recursive: true });
const N = sec(DURATION);
const BEAT = 60 / BPM;
const S = (b) => sec(b * BEAT);

// ------------------------------------------------------------------ music

const music = new Bus(N);
const verb = new Bus(N);

// One chord per bar of four beats (3 s).
const BARS = [
  { root: 29, notes: [53, 57, 60, 64, 67] },    // Fmaj9      discovery
  { root: 26, notes: [50, 57, 60, 62, 65] },    // Dm9        journey
  { root: 34, notes: [50, 53, 58, 62, 65] },    // Bbmaj7     reveal
  { root: 33, notes: [52, 57, 60, 65, 67] },    // F/A        value
  { root: 29, notes: [53, 57, 60, 64, 67, 72] }, // Fmaj9     brand
];
BARS.forEach((c, i) => {
  const start = i * 4;
  const len = i === 4 ? 4 * BEAT - 0.3 : 4 * BEAT + 0.4;
  const [l, r] = I.pad(c.notes, len, {
    attack: i === 0 ? 1.6 : 0.5,
    release: i === 4 ? 0.25 : 0.9,
    cutoff: (t) => (i === 0 ? 300 + 1500 * Math.min(1, t / 3) : i === 2 ? 2600 : 1600 + 400 * Math.sin(t)),
    seed: 20 + i,
  });
  music.addStereo(l, r, S(start), db(i === 2 || i === 4 ? -5 : -8));
  verb.addStereo(l, r, S(start), db(-10));
  // sub under each bar
  music.add(I.subNote(c.root + 12, len - 0.3, { harm: 0.1 }), S(start), db(-15));
});

// Soft pulse on every beat, felt more than heard. Kept as its own stem so
// the grid is measured from the rhythm, the way a kick track is.
const pulse = new Bus(N);
for (let b = 0; b < BEATS; b++) {
  const k = I.kick({ punch: 0.6, len: 0.3, seed: 400 + b });
  pulse.add(filter(k, 'lp', 1600), S(b), db(b % 4 === 0 ? -13 : -18));
}
writeWav(path.join(outDir, 'location-pulse.wav'), pulse.L, pulse.R, fs);
music.mix(pulse, 1);

// Air: band-passed noise that rises through the descent and stops dead on 8.
{
  const len = S(8);
  const nz = noise(len, 77);
  const air = filter(nz, 'bp', (i) => 300 * Math.pow(12, i / len), 0.8);
  const env = new Float32Array(len);
  for (let i = 0; i < len; i++) env[i] = Math.pow(i / len, 1.6) * (i > len - sec(0.02) ? (len - i) / sec(0.02) : 1);
  const a = mul(air, env);
  music.add(a, 0, db(-20), -0.2);
  verb.add(a, 0, db(-24));
}
// Plucked eighths under the value section.
const arp = [0, 2, 4, 3, 1, 3, 2, 4];
for (let q = 0; q < 8; q++) {
  const b = 13 + q * 0.5;
  const tones = BARS[3].notes.map((m) => m + 12);
  const p = I.pluck(tones[arp[q] % tones.length], { decay: 0.22, bright: 0.6, seed: 90 + q });
  music.add(p, S(b), db(-22), (q % 2 ? 0.3 : -0.3));
  verb.add(p, S(b), db(-22));
}
// Closing motif on the brand: F A C F.
[[18.33, 77], [18.67, 81], [19, 84], [19.33, 89]].forEach(([b, m], k) => {
  const p = I.bell(m, { decay: 0.6, index: 0.9 });
  music.add(p, S(b), db(-20), (k - 1.5) * 0.25);
  verb.add(p, S(b), db(-16));
});

const [vl, vr] = reverb(verb.L, verb.R, { room: 0.88, damp: 0.35, predelay: 0.03 });
music.addStereo(vl, vr, 0, db(-2));
// clean end: everything is down by 14.9 s
const endA = sec(14.2);
music.scale((i) => (i < endA ? 1 : Math.max(0, 1 - (i - endA) / (N - endA - sec(0.1))) ** 2));
highpassBus(music, 24);
writeWav(path.join(outDir, 'location-music.wav'), music.L, music.R, fs);

// ------------------------------------------------------------------ grid

execFileSync('node', [path.join(root, 'audio', 'measure.mjs'), '--music', path.join(outDir, 'location-pulse.wav'), '--out', path.join(here, 'beats.json'), '--bpm', String(BPM), '--beats', String(BEATS)], { stdio: 'inherit' });
const grid = JSON.parse(fs.readFileSync(path.join(here, 'beats.json'), 'utf8'));
const tOf = (b) => grid.offset + b * grid.period;

// ------------------------------------------------------------------ sfx

const sfx = new Bus(N);
const space = new Bus(N);
CUES.forEach((c, idx) => {
  const seed = 2000 + idx * 13;
  let sig;
  let lead = 0;
  let wet = 0.2;
  let pan = 0;
  switch (c.kind) {
    case 'tick': sig = I.tickSnd({ hz: 3000, seed }).map((v) => v * db(-12)); break;
    case 'pin': sig = I.pin({ seed, midi: 84 }).map((v) => v * db(-8)); wet = 0.35; break;
    case 'swipe': sig = I.swipe({ seed }).map((v) => v * db(-13)); pan = 0.2; break;
    case 'pop': sig = I.pop(c.tag === 'price' ? 84 : 89, { seed }).map((v) => v * db(-11)); break;
    case 'lock': sig = I.click({ seed, release: false }).map((v) => v * db(-10)); break;
    case 'whooshSoft': sig = filter(I.whoosh(0.7, { from: 180, peak: 1800, to: 400, seed }), 'lp', 3500).map((v) => v * db(-11)); lead = 0.35; pan = -0.3; wet = 0.3; break;
    case 'boom': {
      const im = I.impact({ seed, root: 29 });
      sig = filter(im, 'lp', 1400).map((v) => v * db(-7));
      wet = 0.5;
      break;
    }
    default: throw new Error(c.kind);
  }
  sig = sig.map((v) => v * c.gain);
  const s0 = sec(tOf(c.beat) - lead);
  sfx.add(sig, s0, 1, pan);
  space.add(sig, s0, wet, pan);
});
const [sl, sr] = reverb(space.L, space.R, { room: 0.8, damp: 0.45, predelay: 0.02 });
sfx.addStereo(sl, sr, 0, db(-3));

// ------------------------------------------------------------------ master

const mix = new Bus(N);
mix.mix(music, 1);
mix.mix(sfx, 1);
highpassBus(mix, 22);
const TARGET = -14;
let g = TARGET - lufs(mix.L, mix.R);
let res;
for (let pass = 0; pass < 6; pass++) {
  const b = new Bus(N);
  const k = db(g);
  for (let i = 0; i < N; i++) { b.L[i] = mix.L[i] * k; b.R[i] = mix.R[i] * k; }
  const red = limit(b, -1.6, 1.5, 120);
  const lu = lufs(b.L, b.R);
  res = { b, lu, red };
  if (Math.abs(lu - TARGET) < 0.05) break;
  g += TARGET - lu;
}
writeWav(path.join(outDir, 'location-mix.wav'), res.b.L, res.b.R, fs);
console.log(`location master ${res.lu.toFixed(2)} LUFS, true peak ${truePeakDb(res.b.L, res.b.R).toFixed(2)} dBTP, limiter ${res.red.toFixed(1)} dB`);
