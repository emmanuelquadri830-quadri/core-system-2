// Shared by the sound passes: the sound for each cue kind, a mono add whose
// pan moves while the sound plays, and the mastering loop.

import { Bus, sec, db, limit, lufs, truePeakDb } from './dsp.mjs';
import * as I from './instruments.mjs';

// The sound for one cue. Returns the mono signal, its pan, how much of it goes
// to the reverb send, and how many seconds before the cue it starts.
//   period       seconds per beat, from beats.json
//   counterTicks the number-roll schedule, for 'counter'
//   popNotes / pinNotes  midi note per cue tag, so interface sounds sit in
//                        the chord under them
export function cueSound(c, idx, { period, counterTicks, popNotes = {}, pinNotes = {} }) {
  const seed = 1000 + idx * 17;
  const g = c.gain;
  let sig;
  let pan = 0;
  let wet = 0;
  let lead = 0;
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
      sig = I.pop(popNotes[c.tag] ?? 84, { seed }).map((v) => v * db(-9) * g);
      pan = ((idx % 5) - 2) * 0.18;
      wet = 0.15;
      break;
    case 'pin':
      sig = I.pin({ seed, midi: pinNotes[c.tag] ?? 81 }).map((v) => v * db(-7) * g);
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
      // One pip per pin: eight 32nd notes across the beat (film/scenes/hook.js).
      sig = I.chatter({ seed, count: 8, spacing: period / 8 }).map((v) => v * db(-10) * g);
      pan = 0.2;
      wet = 0.1;
      break;
    case 'counter': {
      // One tick per digit step of the number roll (timeline.mjs counterTicks).
      const ticks = counterTicks(0, period);
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
  return { sig, pan, wet, lead };
}

// Mono signal into a bus with constant-power pan that moves from panA to panB
// over the length of the sound, following an eased curve (the same shape a
// spring traces when it is mostly settled by the end).
export function addPanned(bus, sig, startSample, gain, panA, panB, shape = (x) => 1 - Math.pow(1 - x, 3)) {
  const s0 = Math.max(0, startSample);
  const end = Math.min(bus.n, startSample + sig.length);
  for (let i = s0; i < end; i++) {
    const x = (i - startSample) / sig.length;
    const pan = panA + (panB - panA) * shape(x);
    const a = ((pan + 1) * Math.PI) / 4;
    const v = sig[i - startSample] * gain;
    bus.L[i] += v * Math.cos(a) * Math.SQRT2;
    bus.R[i] += v * Math.sin(a) * Math.SQRT2;
  }
}

// Gain and limiter, iterated until integrated loudness sits on the target.
export function master(mix, { target = -14, ceiling = -1.6 } = {}) {
  const N = mix.n;
  let gainDb = target - lufs(mix.L, mix.R);
  let result;
  for (let pass = 0; pass < 6; pass++) {
    const b = new Bus(N);
    const g = db(gainDb);
    for (let i = 0; i < N; i++) {
      b.L[i] = mix.L[i] * g;
      b.R[i] = mix.R[i] * g;
    }
    const red = limit(b, ceiling, 1.5, 90);
    const lu = lufs(b.L, b.R);
    result = { bus: b, lu, red, gainDb };
    if (Math.abs(lu - target) < 0.05) break;
    gainDb += target - lu;
  }
  result.tp = truePeakDb(result.bus.L, result.bus.R);
  return result;
}
