// Places every sound cue from timeline.mjs on the measured grid in
// beats.json, mixes it over the music and masters to -14 LUFS integrated with
// true peak under -1 dBTP. Writes build/audio/sfx.wav and build/audio/mix.wav.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, Bus, sec, db, readWav, writeWav, reverb, limit, lufs, truePeakDb, highpassBus } from './dsp.mjs';
import * as I from './instruments.mjs';
import { CUES, DURATION, counterTicks } from '../timeline.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const grid = JSON.parse(fs.readFileSync(path.join(root, 'beats.json'), 'utf8'));
const timeOf = (beat) => grid.offset + beat * grid.period;

const N = sec(DURATION);
const sfx = new Bus(N);
const space = new Bus(N);

// Pops and pins are tuned to the chord under them, so the interface sounds
// play along with the track instead of on top of it.
const POP_NOTES = { 'ui-1': 81, 'ui-2': 84, 'ui-3': 86, 'ui-4': 89, results: 84, 'price-1': 82, 'price-2': 86, 'price-3': 89, 'price-4': 94 };
const PIN_NOTES = { 'pin-1': 81, 'pin-2': 84 };

const placed = [];
CUES.forEach((c, idx) => {
  const t = timeOf(c.beat);
  const s0 = sec(t);
  const seed = 1000 + idx * 17;
  const g = c.gain;
  let sig;
  let pan = 0;
  let wet = 0;
  let lead = 0; // seconds the sound starts before its cue
  switch (c.kind) {
    case 'slam':
      sig = I.slam({ seed });
      sig = sig.map((v) => v * db(-4) * g);
      wet = 0.12;
      break;
    case 'slamBig':
      sig = I.slam({ seed, big: true });
      sig = sig.map((v) => v * db(-3) * g);
      wet = 0.25;
      break;
    case 'impact':
      sig = I.impact({ seed });
      sig = sig.map((v) => v * db(-4) * g);
      wet = 0.35;
      break;
    case 'click':
      sig = I.click({ seed }).map((v) => v * db(-6) * g);
      pan = 0.1;
      wet = 0.06;
      break;
    case 'hover':
      sig = I.tickSnd({ hz: 4600, seed }).map((v) => v * db(-14) * g);
      pan = 0.15;
      break;
    case 'tick':
      sig = I.tickSnd({ hz: 3200, seed }).map((v) => v * db(-10) * g);
      break;
    case 'pop':
      sig = I.pop(POP_NOTES[c.tag] ?? 84, { seed }).map((v) => v * db(-9) * g);
      pan = ((idx % 5) - 2) * 0.18;
      wet = 0.15;
      break;
    case 'pin':
      sig = I.pin({ seed, midi: PIN_NOTES[c.tag] ?? 81 }).map((v) => v * db(-7) * g);
      pan = c.tag === 'pin-1' ? -0.3 : 0.3;
      wet = 0.2;
      break;
    case 'confirm': {
      const a = I.bell(84, { decay: 0.3 });
      const b = I.bell(89, { decay: 0.4 });
      const off = sec(0.07);
      sig = new Float32Array(off + b.length);
      for (let i = 0; i < a.length; i++) sig[i] += a[i] * 0.7;
      for (let i = 0; i < b.length; i++) sig[off + i] += b[i];
      sig = sig.map((v) => v * db(-13) * g);
      wet = 0.3;
      break;
    }
    case 'stamp': {
      const st = I.stamp({ seed });
      const ding = I.bell(93, { decay: 0.25, index: 0.8 });
      sig = new Float32Array(Math.max(st.length, ding.length));
      for (let i = 0; i < st.length; i++) sig[i] += st[i];
      for (let i = 0; i < ding.length; i++) sig[i] += ding[i] * 0.35;
      sig = sig.map((v) => v * db(-7) * g);
      wet = 0.2;
      break;
    }
    case 'swipe':
      sig = I.swipe({ seed }).map((v) => v * db(-12) * g);
      pan = -0.2;
      break;
    case 'whoosh':
      sig = I.whoosh(0.34, { seed }).map((v) => v * db(-9) * g);
      lead = 0.12; // peak lands on the cut
      pan = idx % 2 ? 0.35 : -0.35;
      wet = 0.1;
      break;
    case 'whooshIn':
      sig = I.swell(0.375, { seed }).map((v) => v * db(-8) * g);
      wet = 0.15;
      break;
    case 'chatter':
      sig = I.chatter({ seed }).map((v) => v * db(-10) * g);
      pan = 0.2;
      wet = 0.1;
      break;
    case 'counter': {
      // One tick per digit step of the number roll (timeline.mjs counterTicks).
      const ticks = counterTicks(0, grid.period);
      sig = new Float32Array(sec(ticks[ticks.length - 1].t + 0.05));
      for (const { k, x, t: tt } of ticks) {
        const tk = I.tickSnd({ hz: 5200 - 1400 * x, seed: seed + k });
        const o = sec(tt);
        for (let i = 0; i < tk.length && o + i < sig.length; i++) sig[o + i] += tk[i] * (0.5 + 0.5 * x);
      }
      sig = sig.map((v) => v * db(-9) * g);
      break;
    }
    case 'lock': {
      const a = I.click({ seed, release: false });
      const th = I.stamp({ seed: seed + 3 });
      sig = new Float32Array(Math.max(a.length, th.length));
      for (let i = 0; i < a.length; i++) sig[i] += a[i] * 0.8;
      for (let i = 0; i < th.length; i++) sig[i] += th[i] * 0.6;
      sig = sig.map((v) => v * db(-7) * g);
      wet = 0.2;
      break;
    }
    case 'type':
      sig = I.tickSnd({ hz: 2600, seed }).map((v) => v * db(-10) * g);
      break;
    default:
      throw new Error(`no sound for cue kind ${c.kind}`);
  }
  const start = s0 - sec(lead);
  sfx.add(sig, start, 1, pan);
  if (wet) space.add(sig, start, wet, pan);
  placed.push({ tag: c.tag, kind: c.kind, beat: c.beat, t: +t.toFixed(4) });
});

const [rl, rr] = reverb(space.L, space.R, { room: 0.78, damp: 0.45, predelay: 0.012 });
sfx.addStereo(rl, rr, 0, db(-2));
writeWav(path.join(root, 'build', 'audio', 'sfx.wav'), sfx.L, sfx.R, fs);

// ---------------------------------------------------------------- master

const music = readWav(path.join(root, 'build', 'audio', 'music.wav'), fs);
const mix = new Bus(N);
mix.addStereo(music.L, music.R, 0, db(-1.5));
mix.addStereo(sfx.L, sfx.R, 0, db(0));
highpassBus(mix, 22);

// Iterate gain + limiter until integrated loudness sits on -14 LUFS.
const TARGET = -14;
let L = Float32Array.from(mix.L);
let R = Float32Array.from(mix.R);
let gainDb = TARGET - lufs(L, R);
let result;
for (let pass = 0; pass < 6; pass++) {
  const b = new Bus(N);
  const g = db(gainDb);
  for (let i = 0; i < N; i++) {
    b.L[i] = mix.L[i] * g;
    b.R[i] = mix.R[i] * g;
  }
  const red = limit(b, -1.6, 1.5, 90);
  const lu = lufs(b.L, b.R);
  result = { bus: b, lu, red, gainDb };
  if (Math.abs(lu - TARGET) < 0.05) break;
  gainDb += TARGET - lu;
}
const tp = truePeakDb(result.bus.L, result.bus.R);
writeWav(path.join(root, 'build', 'audio', 'mix.wav'), result.bus.L, result.bus.R, fs);
fs.writeFileSync(path.join(root, 'build', 'audio', 'cues.json'), JSON.stringify(placed, null, 1));
console.log(`music alone ${lufs(music.L, music.R).toFixed(1)} LUFS, sfx alone ${lufs(sfx.L, sfx.R).toFixed(1)} LUFS`);
console.log(`master: ${result.lu.toFixed(2)} LUFS, true peak ${tp.toFixed(2)} dBTP, limiter max reduction ${result.red.toFixed(2)} dB, gain ${result.gainDb.toFixed(2)} dB, ${placed.length} cues`);
