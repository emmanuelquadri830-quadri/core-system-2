// Measures the beat grid from the rendered music instead of trusting the
// nominal tempo. Writes beats.json, which the film and the SFX pass both read.
//
// Method: 2 ms log-energy flux (1 ms hop) as the onset function, comb search
// for period and phase around the nominal tempo, then a least-squares line
// through the onsets found near each grid point.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, readWav } from './dsp.mjs';
import { BPM as BPM0, BEATS as BEATS0 } from '../timeline.mjs';

// Defaults measure the first film; pass --music, --out, --bpm and --beats to
// measure another score (location/audio.mjs does).
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const BPM = +arg('bpm', BPM0);
const BEATS = +arg('beats', BEATS0);

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const src = path.resolve(arg('music', path.join(root, 'build', 'audio', 'music.wav')));
const { L, R } = readWav(src, fs);

const win = Math.round(0.002 * SR);
const hop = Math.round(0.001 * SR);
const frames = Math.floor((L.length - win) / hop);
const energy = new Float64Array(frames);
for (let f = 0; f < frames; f++) {
  let e = 0;
  const s = f * hop;
  for (let i = s; i < s + win; i++) {
    const m = (L[i] + R[i]) * 0.5;
    e += m * m;
  }
  energy[f] = Math.log10(1e-10 + e / win);
}
const odf = new Float64Array(frames);
for (let f = 3; f < frames; f++) odf[f] = Math.max(0, energy[f] - Math.max(energy[f - 1], energy[f - 2], energy[f - 3]));
const tOf = (f) => (f * hop + win / 2) / SR;

// Comb search: period within 2% of nominal, phase within one period.
const nominal = 60 / BPM;
let best = { score: -1 };
for (let p = nominal * 0.98; p <= nominal * 1.02; p += 0.0001) {
  for (let ph = 0; ph < p; ph += 0.0005) {
    let score = 0;
    for (let k = 0; k < BEATS; k++) {
      const f = Math.round((ph + k * p) * SR / hop - win / (2 * hop));
      let m = 0;
      for (let d = -4; d <= 4; d++) if (f + d >= 0 && f + d < frames) m = Math.max(m, odf[f + d]);
      score += m;
    }
    if (score > best.score) best = { score, p, ph };
  }
}

// Refine: strongest onset within 15 ms of each grid point.
const found = [];
for (let k = 0; k < BEATS; k++) {
  const t = best.ph + k * best.p;
  const f0 = Math.round(t * SR / hop - win / (2 * hop));
  let bf = -1;
  let bv = 0;
  for (let d = -15; d <= 15; d++) {
    const f = f0 + d;
    if (f >= 0 && f < frames && odf[f] > bv) {
      bv = odf[f];
      bf = f;
    }
  }
  if (bf >= 0 && bv > 0.4) found.push({ k, t: tOf(bf), strength: +bv.toFixed(2) });
}

// Least-squares line, refit after dropping onsets more than 3 ms off the
// first fit (a hat or a reverb tail caught near the beat).
function fit(pts) {
  const n = pts.length;
  const mk = pts.reduce((a, x) => a + x.k, 0) / n;
  const mt = pts.reduce((a, x) => a + x.t, 0) / n;
  let num = 0;
  let den = 0;
  for (const x of pts) {
    num += (x.k - mk) * (x.t - mt);
    den += (x.k - mk) ** 2;
  }
  const period = num / den;
  return { period, offset: mt - period * mk };
}
let g = fit(found);
const kept = found.filter((x) => Math.abs(x.t - (g.offset + x.k * g.period)) < 0.003);
g = fit(kept);
const { period, offset } = g;
const n = kept.length;
const beats = Array.from({ length: BEATS + 1 }, (_, k) => +(offset + k * period).toFixed(5));
const residuals = kept.map((x) => ({ ...x, residualMs: +((x.t - (offset + x.k * period)) * 1000).toFixed(2) }));
const maxResidualMs = Math.max(...residuals.map((x) => Math.abs(x.residualMs)));

const out = {
  source: path.relative(root, src),
  method: '2 ms log-energy flux, comb search around nominal tempo, least-squares fit through onsets within 15 ms of the grid, refit without onsets more than 3 ms off',
  nominalBpm: BPM,
  bpm: +(60 / period).toFixed(3),
  period: +period.toFixed(6),
  offset: +offset.toFixed(5),
  beatsDetected: n,
  rejected: found.filter((x) => !kept.includes(x)).map((x) => x.k),
  maxResidualMs,
  beats,
  downbeats: beats.filter((_, k) => k % 4 === 0),
  onsets: residuals,
};
fs.writeFileSync(path.resolve(arg('out', path.join(root, 'beats.json'))), JSON.stringify(out, null, 1));
console.log(`bpm ${out.bpm}  offset ${(offset * 1000).toFixed(2)} ms  onsets on grid ${n}/${BEATS}  max residual ${maxResidualMs} ms`);
