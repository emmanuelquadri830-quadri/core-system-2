// Music bed at 120 BPM in F major (D minor intro), synthesized from scratch.
// Writes build/audio/music.wav plus one wav per stem for level checks.
//
//   bars 1-2   hook      D minor pad opening, 16th ticks, offbeat pulse, riser
//   bar  3     brand     drop on F, four on the floor, wide chord pumping
//   bars 4-5   discover  C and Dm as offbeat stabs, beats left for UI clicks
//   bars 6-7   montage   Bb then F, full groove with shaker and arp
//   bar  8     proof     break on Gm9, sub only, riser back in
//   bar  9     next      C, groove returns, snare build
//   bar  10    lockup    F, one hit and a long tail

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, Bus, sec, db, writeWav, reverb, pingpong, highpassBus, lufs, mulberry32 } from './dsp.mjs';
import * as I from './instruments.mjs';
import { BPM, DURATION, CUES } from '../timeline.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', 'build', 'audio');
fs.mkdirSync(outDir, { recursive: true });

const N = sec(DURATION);
const BEAT = 60 / BPM;
const S = (beat) => sec(beat * BEAT);

const drums = new Bus(N);
const bass = new Bus(N);
const chords = new Bus(N);
const pads = new Bus(N);
const plucks = new Bus(N);
const risers = new Bus(N);
const verb = new Bus(N);
const echo = new Bus(N);

const rnd = mulberry32(2026);

// ------------------------------------------------------------------ harmony

const BAR_CHORD = [
  { root: 38, notes: [50, 57, 62, 64, 65] }, // 1 Dm(add9)  hook
  { root: 38, notes: [50, 57, 62, 64, 65] }, // 2 Dm(add9)  hook
  { root: 29, notes: [57, 60, 65, 69] },     // 3 F         brand
  { root: 36, notes: [55, 60, 64, 67] },     // 4 C         discover
  { root: 38, notes: [57, 62, 65, 69] },     // 5 Dm        discover
  { root: 34, notes: [58, 62, 65, 70] },     // 6 Bb        montage
  { root: 29, notes: [57, 60, 65, 69] },     // 7 F         trust
  { root: 31, notes: [55, 58, 62, 65, 69] }, // 8 Gm9       proof
  { root: 36, notes: [55, 60, 64, 67] },     // 9 C         next
  { root: 29, notes: [57, 60, 65, 69, 72] }, // 10 F        lockup
];
const barOf = (beat) => Math.floor(beat / 4);

// ------------------------------------------------------------------ sidechain

// Kick and every heavy SFX hit duck the sustained parts. Programmed, not
// detected, so the pump is identical on every render.
const kickBeats = [];
for (let b = 8; b < 28; b++) kickBeats.push(b);
for (let b = 32; b < 36; b++) kickBeats.push(b);
const heavy = CUES.filter((c) => ['slam', 'slamBig', 'impact'].includes(c.kind)).map((c) => c.beat);
const duckAt = [...new Set([...kickBeats, ...heavy])].sort((a, b) => a - b);

function duckEnv(depth = 0.75, recover = 0.22) {
  const g = new Float32Array(N).fill(1);
  for (const b of duckAt) {
    const s0 = S(b);
    const a = sec(0.004);
    const len = sec(recover * 2.2);
    for (let i = 0; i < len && s0 + i < N; i++) {
      const t = i / SR;
      const v = i < a ? 1 - depth * (i / a) : 1 - depth * Math.exp(-Math.pow((t - 0.004) / recover, 1.6) * 2.4);
      g[s0 + i] = Math.min(g[s0 + i], v);
    }
  }
  return g;
}

// ------------------------------------------------------------------ drums

for (const b of kickBeats) drums.add(I.kick({ seed: 1 + b }), S(b), db(-3));

const clapBeats = [9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 33, 35];
for (const b of clapBeats) {
  const g = b >= 12 && b < 20 ? db(-12) : db(-8);
  const c = I.clap({ seed: 7 + b });
  drums.add(c, S(b), g, 0.05);
  verb.add(c, S(b), g * 0.5);
}

// 16th ticks through the hook build tension; accents land on the beat.
for (let s = 0; s < 32; s++) {
  const beat = s * 0.25;
  if (beat >= 7.75) continue;
  const accent = s % 4 === 0 ? 1 : s % 2 === 0 ? 0.55 : 0.38;
  const ramp = 0.6 + 0.4 * (beat / 8);
  drums.add(I.hat({ seed: 300 + s }), S(beat), db(-21) * accent * ramp, 0.25);
}

// Groove hats: open on the offbeat, closed 16ths underneath.
const grooveBars = [2, 3, 4, 5, 6, 8];
for (const bar of grooveBars) {
  for (let q = 0; q < 16; q++) {
    const beat = bar * 4 + q * 0.25;
    if (q % 4 === 2) {
      drums.add(I.hat({ open: true, seed: 500 + q + bar * 16 }), S(beat), db(-19), -0.15);
    } else if (q % 4 !== 0) {
      const v = q % 2 === 1 ? 0.5 : 0.75;
      drums.add(I.hat({ seed: 700 + q + bar * 16 }), S(beat), db(-25) * v, 0.3);
    }
  }
}

// Shaker drives the montage, trust and next sections.
for (const bar of [5, 6, 8]) {
  for (let q = 0; q < 16; q++) {
    const beat = bar * 4 + q * 0.25;
    const v = [0.5, 0.35, 0.8, 0.4][q % 4];
    drums.add(I.shaker({ seed: 900 + q + bar * 16 }), S(beat), db(-22) * v, -0.35);
  }
}

for (const b of [8, 20, 36]) {
  const [l, r] = I.crash({ seed: 31 + b, len: b === 36 ? 3.2 : 1.8 });
  drums.addStereo(l, r, S(b), db(-17));
  verb.addStereo(l, r, S(b), db(-24));
}

// Snare build into the drop and into the logo.
function build(fromBeat, toBeat, density) {
  let b = fromBeat;
  while (b < toBeat - 1e-6) {
    const x = (b - fromBeat) / (toBeat - fromBeat);
    const step = x < 0.5 ? density[0] : density[1];
    const s = I.snareHit({ seed: 41 + Math.round(b * 16) });
    const g = db(-26 + 16 * x);
    drums.add(s, S(b), g, 0.1);
    verb.add(s, S(b), g * 0.6);
    b += step;
  }
}
build(6.5, 7.75, [0.25, 0.125]);
build(34, 35.75, [0.25, 0.125]);

// ------------------------------------------------------------------ bass

// Offbeat house bass. X = root, x = octave ghost, one 16th per character.
const offbeat = '..X...Xx..X...Xx';
const drive = '..X.x.Xx..X.x.Xx';
const bassBars = { 2: offbeat, 3: offbeat, 4: offbeat, 5: drive, 6: drive, 8: offbeat };
for (const [barS, pat] of Object.entries(bassBars)) {
  const bar = Number(barS);
  const { root } = BAR_CHORD[bar];
  for (let q = 0; q < 16; q++) {
    const ch = pat[q];
    if (ch === '.') continue;
    const beat = bar * 4 + q * 0.25;
    const midi = ch === 'X' ? root : root + 12;
    const dur = ch === 'X' ? 0.2 : 0.1;
    bass.add(I.subNote(midi, dur), S(beat), db(ch === 'X' ? -7 : -12));
    bass.add(I.bassNote(midi + 12, dur, { bright: ch === 'X' ? 1 : 0.6 }), S(beat), db(-15));
  }
}
// Hook pulse: muted offbeat D, an engine idling before the drop.
for (let b = 0.5; b < 7.5; b += 1) {
  bass.add(I.bassNote(50, 0.16, { bright: 0.35 + 0.08 * b }), S(b), db(-17));
  bass.add(I.subNote(38, 0.14), S(b), db(-13));
}
// Sustained subs under the break and the ending.
bass.add(I.subNote(31, 4 * BEAT - 0.05), S(28), db(-11));
bass.add(I.subNote(29, 3.6), S(36), db(-9));

// ------------------------------------------------------------------ chords

function sustain(bar, beats = 4, opts = {}) {
  const { notes } = BAR_CHORD[bar];
  const [l, r] = I.supersaw(notes, beats * BEAT - 0.02, { seed: 5 + bar, ...opts });
  chords.addStereo(l, r, S(bar * 4), opts.gain ?? db(-4));
  verb.addStereo(l, r, S(bar * 4), db(-20));
}
function stabs(bar, beatsIn = [0.5, 1.5, 2.5, 3.5]) {
  const { notes } = BAR_CHORD[bar];
  for (const off of beatsIn) {
    const [l, r] = I.supersaw(notes, 0.16, { seed: 50 + bar, cutoff: 3200, env: 0.75, release: 0.12 });
    chords.addStereo(l, r, S(bar * 4 + off), db(-3));
    echo.addStereo(l, r, S(bar * 4 + off), db(-14));
  }
}
sustain(2, 4, { cutoff: 5200 });
stabs(3);
stabs(4, [0.5, 1.5, 2.5, 3.25, 3.5]);
sustain(5, 4, { cutoff: 4600 });
sustain(6, 4, { cutoff: 5600 });
sustain(8, 4, { cutoff: 3400, env: 0.2 });
sustain(9, 4, { cutoff: 6000, release: 1.6, gain: db(-3) });

// ------------------------------------------------------------------ pads

{
  // Hook: D minor add9, filter opening over four seconds.
  const [l, r] = I.pad(BAR_CHORD[0].notes, 8 * BEAT - 0.1, {
    attack: 0.25,
    release: 0.12,
    cutoff: (t) => 380 * Math.pow(7, Math.min(1, t / 3.8)),
  });
  pads.addStereo(l, r, 0, db(-6));
  verb.addStereo(l, r, 0, db(-12));
}
{
  // Break: Gm9, still, lets the number breathe.
  const [l, r] = I.pad(BAR_CHORD[7].notes, 4 * BEAT, { attack: 0.08, release: 0.3, cutoff: () => 2200 });
  pads.addStereo(l, r, S(28), db(-5));
  verb.addStereo(l, r, S(28), db(-10));
}
{
  // Ending: F, long release under the logo.
  const [l, r] = I.pad(BAR_CHORD[9].notes, 2.4, { attack: 0.05, release: 1.4, cutoff: (t) => 2600 - 1200 * Math.min(1, t / 3) });
  pads.addStereo(l, r, S(36), db(-6));
  verb.addStereo(l, r, S(36), db(-10));
}

// ------------------------------------------------------------------ plucks

// 16th arpeggio over the chord, an octave up, with accents.
const ARP = [0, 2, 1, 3, 2, 0, 3, 1, 0, 2, 1, 3, 2, 3, 1, 2];
for (const bar of [3, 4, 5, 6, 8]) {
  const tones = BAR_CHORD[bar].notes.slice(0, 4).map((m) => m + 12);
  for (let q = 0; q < 16; q++) {
    const beat = bar * 4 + q * 0.25;
    const m = tones[ARP[q] % tones.length];
    const acc = q % 4 === 0 ? 1 : q % 2 === 0 ? 0.7 : 0.5;
    const p = I.pluck(m, { decay: 0.12, bright: 0.7 + 0.3 * acc, seed: 3 + q });
    const pan = ((q % 4) - 1.5) * 0.25;
    plucks.add(p, S(beat), db(-21) * acc, pan);
    echo.add(p, S(beat), db(-26) * acc);
  }
}
// Ending motif: F A C F, rising, answered by the logo.
[[37, 65], [37.5, 69], [38, 72], [38.5, 77]].forEach(([b, m], k) => {
  const p = I.pluck(m + 12, { decay: 0.5, bright: 0.8, seed: 77 + k });
  plucks.add(p, S(b), db(-15), (k - 1.5) * 0.3);
  echo.add(p, S(b), db(-18));
  verb.add(p, S(b), db(-18));
});

// ------------------------------------------------------------------ risers

{
  const r = I.riser(3.75 * BEAT, { from: 300, to: 9000, seed: 51 });
  risers.add(r, S(4), db(-15), 0);
  const [cl, cr] = I.reverseCrash(1.5 * BEAT, 81);
  risers.addStereo(cl, cr, S(7.75) - cl.length, db(-15));
}
{
  const r = I.riser(1.75 * BEAT, { from: 500, to: 7000, seed: 52 });
  risers.add(r, S(30), db(-17));
}
{
  const r = I.riser(1.75 * BEAT, { from: 400, to: 8000, seed: 53 });
  risers.add(r, S(34), db(-17));
}

// ------------------------------------------------------------------ space + duck

const duck = duckEnv(0.72, 0.2);
const duckSoft = duckEnv(0.45, 0.16);
chords.scale((i) => duck[i]);
pads.scale((i) => duckSoft[i]);
plucks.scale((i) => duckSoft[i]);

const [vl, vr] = reverb(verb.L, verb.R, { room: 0.84, damp: 0.4, predelay: 0.018 });
const [el, er] = pingpong(echo.L, echo.R, 0.75 * BEAT, 0.38, 3800);
const fxBus = new Bus(N);
fxBus.addStereo(vl, vr, 0, 1);
fxBus.addStereo(el, er, 0, 1);
fxBus.scale((i) => duckSoft[i]);

// Silence the sixteenth before the drop and before the logo. The hole is what
// makes the next hit land.
function gap(fromBeat, toBeat, buses) {
  const a = S(fromBeat);
  const b = S(toBeat);
  const f = sec(0.006);
  for (const bus of buses) {
    for (let i = a - f; i < b; i++) {
      if (i < 0) continue;
      const g = i < a ? 1 - (i - (a - f)) / f : 0;
      bus.L[i] *= g;
      bus.R[i] *= g;
    }
  }
}
const all = [drums, bass, chords, pads, plucks, risers, fxBus];
gap(7.75, 8, all);
gap(35.75, 36, all);

// Fade the very end so the file closes on silence.
const fadeFrom = sec(19.1);
for (const bus of all) bus.scale((i) => (i < fadeFrom ? 1 : Math.max(0, 1 - (i - fadeFrom) / (N - fadeFrom)) ** 1.5));

const music = new Bus(N);
const STEMS = { drums, bass, chords, pads, plucks, risers, fx: fxBus };
// Balance set from the stem loudness report: chords and plucks carry the
// track on phone speakers, so they sit closer to the drums than on a club mix.
const STEM_GAIN = { drums: 1, bass: 1, chords: db(7), pads: db(3), plucks: db(5), risers: db(-4), fx: db(3) };
for (const [name, bus] of Object.entries(STEMS)) {
  music.mix(bus, STEM_GAIN[name]);
  writeWav(path.join(outDir, `stem-${name}.wav`), bus.L, bus.R, fs);
}
highpassBus(music, 24);
writeWav(path.join(outDir, 'music.wav'), music.L, music.R, fs);

const report = Object.fromEntries(
  Object.entries(STEMS).map(([k, b]) => {
    let pk = 0;
    for (let i = 0; i < b.n; i++) pk = Math.max(pk, Math.abs(b.L[i]), Math.abs(b.R[i]));
    return [k, { lufs: +lufs(b.L, b.R).toFixed(1), peakDb: +(20 * Math.log10(pk || 1e-9)).toFixed(1) }];
  }),
);
let pk = 0;
for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(music.L[i]), Math.abs(music.R[i]));
report.music = { lufs: +lufs(music.L, music.R).toFixed(1), peakDb: +(20 * Math.log10(pk)).toFixed(1) };
console.log(JSON.stringify(report, null, 1));
