// Synthesized voices. Each returns mono Float32Array one-shots (or a stereo
// pair where noted). All randomness is seeded.

import {
  SR, sec, osc, noise, filter, expDecay, mul, sum, gain, softclip, edges, mtof, mulberry32, SVF,
} from './dsp.mjs';

// ---------------------------------------------------------------- drums

export function kick({ punch = 1, len = 0.45, seed = 1 } = {}) {
  const n = sec(len);
  const f = (i) => 47 + (165 - 47) * Math.exp(-(i / SR) / 0.032);
  const body = mul(osc('sine', n, f), expDecay(n, 0.17, 0.0008));
  const click = filter(mul(noise(sec(0.006), seed), expDecay(sec(0.006), 0.0015, 0.0001)), 'hp', 2500);
  const tick = mul(osc('sine', sec(0.01), 1800), expDecay(sec(0.01), 0.002, 0.0001));
  const out = sum(softclip(body, 1.6 * punch), gain(click, 0.35), gain(tick, 0.18));
  return edges(out, 0.0002, 0.02);
}

export function clap({ seed = 7, tail = 0.13 } = {}) {
  const n = sec(0.35);
  const out = new Float32Array(n);
  const src = noise(n, seed);
  const offs = [0, 0.009, 0.019, 0.028];
  for (let k = 0; k < offs.length; k++) {
    const o = sec(offs[k]);
    const isTail = k === offs.length - 1;
    const tau = isTail ? tail : 0.0035;
    for (let i = o; i < n; i++) out[i] += src[i] * Math.exp(-((i - o) / SR) / tau) * (isTail ? 1 : 0.8);
  }
  const shaped = filter(filter(out, 'bp', 1150, 1.1), 'hp', 500);
  const bodyN = sec(0.08);
  const body = mul(osc('sine', bodyN, (i) => 200 - 30 * (i / bodyN)), expDecay(bodyN, 0.03));
  return edges(sum(gain(shaped, 2.2), gain(body, 0.25)));
}

// 808 style metallic voice: six detuned squares into band-pass.
function metal(n, seed) {
  const freqs = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0].map((f) => f * 1.58);
  const r = mulberry32(seed);
  const parts = freqs.map((f) => osc('square', n, f * (1 + (r() - 0.5) * 0.004), r()));
  return sum(...parts);
}

export function hat({ open = false, seed = 11 } = {}) {
  const len = open ? 0.32 : 0.06;
  const n = sec(len);
  const tau = open ? 0.11 : 0.016;
  const src = sum(gain(metal(n, seed), 0.12), gain(noise(n, seed + 1), 0.6));
  const shaped = filter(filter(src, 'bp', 10000, 0.9), 'hp', 6500);
  return edges(mul(shaped, expDecay(n, tau, 0.0005)));
}

export function shaker({ seed = 21 } = {}) {
  const n = sec(0.09);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    env[i] = t < 0.012 ? t / 0.012 : Math.exp(-(t - 0.012) / 0.022);
  }
  return edges(mul(filter(noise(n, seed), 'bp', 6200, 1.4), env));
}

export function crash({ seed = 31, len = 1.8 } = {}) {
  const n = sec(len);
  const mk = (s) => {
    const src = sum(gain(metal(n, s), 0.1), noise(n, s + 3));
    return mul(filter(filter(src, 'hp', 3800), 'lp', 13000), expDecay(n, 0.55, 0.001));
  };
  return [edges(mk(seed)), edges(mk(seed + 100))];
}

export function snareHit({ seed = 41 } = {}) {
  const n = sec(0.18);
  const nz = mul(filter(noise(n, seed), 'bp', 2200, 0.8), expDecay(n, 0.045, 0.0005));
  const body = mul(osc('sine', n, (i) => 230 - 50 * Math.min(1, i / sec(0.05))), expDecay(n, 0.04));
  return edges(sum(gain(nz, 0.9), gain(body, 0.45)));
}

// ---------------------------------------------------------------- tonal

export function subNote(midi, durSec, { harm = 0.18 } = {}) {
  const n = sec(durSec + 0.04);
  const f = mtof(midi);
  const a = osc('sine', n, f);
  const b = osc('sine', n, 2 * f);
  const env = new Float32Array(n);
  const A = sec(0.006);
  const G = sec(durSec);
  for (let i = 0; i < n; i++) {
    env[i] = i < A ? i / A : i < G ? 1 : Math.max(0, 1 - (i - G) / sec(0.04));
  }
  return softclip(mul(sum(a, gain(b, harm)), env), 1.2);
}

export function bassNote(midi, durSec, { bright = 1 } = {}) {
  const n = sec(durSec + 0.05);
  const f = mtof(midi);
  const s1 = osc('saw', n, f * Math.pow(2, 8 / 1200));
  const s2 = osc('saw', n, f * Math.pow(2, -8 / 1200), 0.37);
  const raw = sum(s1, s2);
  const cut = (i) => {
    const t = i / SR;
    return 240 + 1500 * bright * Math.exp(-t / 0.07);
  };
  const lp = filter(raw, 'lp', cut, 1.1);
  const env = new Float32Array(n);
  const A = sec(0.004);
  const G = sec(durSec);
  for (let i = 0; i < n; i++) env[i] = i < A ? i / A : i < G ? 1 - 0.25 * ((i - A) / G) : Math.max(0, 1 - (i - G) / sec(0.05));
  return mul(lp, env);
}

// Wide supersaw chord. Returns [L, R].
export function supersaw(midis, durSec, { cutoff = 4200, env = 0.6, attack = 0.008, release = 0.28, detune = 0.18, seed = 5 } = {}) {
  const n = sec(durSec + release + 0.02);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const spread = [-1, -0.58, -0.21, 0, 0.19, 0.55, 1];
  const r = mulberry32(seed);
  for (const m of midis) {
    const f0 = mtof(m);
    spread.forEach((s, k) => {
      const f = f0 * Math.pow(2, (s * detune) / 12);
      const sig = osc('saw', n, f, r());
      const pan = s * 0.9;
      const a = ((pan + 1) * Math.PI) / 4;
      const gl = Math.cos(a) * (k === 3 ? 1 : 0.8);
      const gr = Math.sin(a) * (k === 3 ? 1 : 0.8);
      for (let i = 0; i < n; i++) {
        L[i] += sig[i] * gl;
        R[i] += sig[i] * gr;
      }
    });
  }
  const A = sec(attack);
  const G = sec(durSec);
  const Rl = sec(release);
  const amp = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (i < A) amp[i] = i / A;
    else if (i < G) amp[i] = 0.72 + 0.28 * Math.exp(-((i - A) / SR) / 0.25);
    else amp[i] = Math.max(0, (0.72 + 0.28 * Math.exp(-((G - A) / SR) / 0.25)) * Math.pow(1 - (i - G) / Rl, 2));
  }
  const cut = (i) => cutoff * (1 - env + env * Math.exp(-(i / SR) / 0.35)) + 300;
  const fl = new SVF();
  const fr = new SVF();
  const norm = 1 / (midis.length * 3.2);
  for (let i = 0; i < n; i++) {
    const c = cut(i);
    fl.tick(L[i], c, 0.8);
    fr.tick(R[i], c, 0.8);
    L[i] = fl.lp * amp[i] * norm;
    R[i] = fr.lp * amp[i] * norm;
  }
  return [edges(L), edges(R)];
}

// Slow pad, cutoff given as a function of time in seconds from note start.
export function pad(midis, durSec, { cutoff = (t) => 900, attack = 0.6, release = 0.8, seed = 9 } = {}) {
  const n = sec(durSec + release);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const r = mulberry32(seed);
  for (const m of midis) {
    const f0 = mtof(m);
    [-0.09, 0, 0.09].forEach((d, k) => {
      const sig = osc(k === 1 ? 'tri' : 'saw', n, f0 * Math.pow(2, d / 12), r());
      const pan = (k - 1) * 0.7;
      const a = ((pan + 1) * Math.PI) / 4;
      for (let i = 0; i < n; i++) {
        L[i] += sig[i] * Math.cos(a);
        R[i] += sig[i] * Math.sin(a);
      }
    });
  }
  const A = sec(attack);
  const G = sec(durSec);
  const Rl = sec(release);
  const fl = new SVF();
  const fr = new SVF();
  const norm = 1 / (midis.length * 2.2);
  for (let i = 0; i < n; i++) {
    const amp = i < A ? Math.pow(i / A, 1.5) : i < G ? 1 : Math.max(0, 1 - (i - G) / Rl);
    const c = cutoff(i / SR);
    fl.tick(L[i], c, 0.9);
    fr.tick(R[i], c, 0.9);
    L[i] = fl.lp * amp * norm;
    R[i] = fr.lp * amp * norm;
  }
  return [edges(L), edges(R)];
}

export function pluck(midi, { decay = 0.18, bright = 1, seed = 3 } = {}) {
  const n = sec(decay * 4);
  const f = mtof(midi);
  const r = mulberry32(seed);
  const raw = sum(gain(osc('saw', n, f, r()), 0.7), gain(osc('square', n, f * 1.002, r()), 0.35));
  const lp = filter(raw, 'lp', (i) => 350 + 5200 * bright * Math.exp(-(i / SR) / 0.06), 1.4);
  return edges(mul(lp, expDecay(n, decay, 0.001)));
}

// Bell-ish FM tone for confirm chimes, tuned to the key.
export function bell(midi, { decay = 0.35, ratio = 3.5, index = 1.4 } = {}) {
  const n = sec(decay * 3.5);
  const f = mtof(midi);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const ie = index * Math.exp(-t / (decay * 0.4));
    out[i] = Math.sin(2 * Math.PI * f * t + ie * Math.sin(2 * Math.PI * f * ratio * t)) * Math.exp(-t / decay);
  }
  return edges(out, 0.0008);
}

// ---------------------------------------------------------------- transitions

// Noise riser. Bandpass climbs exponentially, ends at full level.
export function riser(durSec, { from = 350, to = 9000, seed = 51, tone = true } = {}) {
  const n = sec(durSec);
  const src = noise(n, seed);
  const f = (i) => from * Math.pow(to / from, i / n);
  const nz = filter(src, 'bp', f, 2.2);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) env[i] = Math.pow(i / n, 2.2);
  let out = mul(gain(nz, 2.2), env);
  if (tone) {
    const saw = osc('saw', n, (i) => 220 * Math.pow(2, (i / n) * 1.0));
    const sl = filter(saw, 'lp', (i) => 400 + 4000 * (i / n), 1.2);
    out = sum(out, gain(mul(sl, env), 0.18));
  }
  return edges(out, 0.01, 0.002);
}

export function whoosh(durSec = 0.36, { from = 280, peak = 3600, to = 700, seed = 61 } = {}) {
  const n = sec(durSec);
  const src = noise(n, seed);
  const f = (i) => {
    const x = i / n;
    return x < 0.55 ? from * Math.pow(peak / from, x / 0.55) : peak * Math.pow(to / peak, (x - 0.55) / 0.45);
  };
  const bp = filter(src, 'bp', f, 1.3);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / n;
    env[i] = Math.pow(Math.sin(Math.PI * Math.pow(x, 0.8)), 2);
  }
  return edges(gain(mul(bp, env), 1.8));
}

// Swell that ends exactly at its length: for "into the next section".
export function swell(durSec = 0.5, { seed = 71 } = {}) {
  const n = sec(durSec);
  const src = noise(n, seed);
  const bp = filter(src, 'bp', (i) => 500 * Math.pow(14, i / n), 1.6);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) env[i] = Math.pow(i / n, 1.8);
  return edges(gain(mul(bp, env), 2.0), 0.005, 0.003);
}

export function reverseCrash(durSec = 1.0, seed = 81) {
  const [l, r] = crash({ seed, len: durSec });
  const env = new Float32Array(l.length);
  for (let i = 0; i < l.length; i++) env[i] = 1;
  const rl = new Float32Array(l.length);
  const rr = new Float32Array(r.length);
  for (let i = 0; i < l.length; i++) {
    rl[i] = l[l.length - 1 - i];
    rr[i] = r[r.length - 1 - i];
  }
  return [edges(rl, 0.02, 0.002), edges(rr, 0.02, 0.002)];
}

// ---------------------------------------------------------------- hits

export function impact({ seed = 91, root = 29 } = {}) {
  const n = sec(1.6);
  const f = (i) => 34 + (95 - 34) * Math.exp(-(i / SR) / 0.16);
  const sub = mul(osc('sine', n, f), expDecay(n, 0.55, 0.001));
  const k = kick({ punch: 1.3, seed });
  const nzN = sec(0.4);
  const nz = mul(filter(noise(nzN, seed + 1), 'lp', 2400), expDecay(nzN, 0.07, 0.0005));
  const tone = mul(osc('saw', n, mtof(root + 12)), expDecay(n, 0.25, 0.002));
  const tl = filter(tone, 'lp', 260);
  return edges(sum(softclip(gain(sub, 1.1), 1.4), gain(k, 0.8), gain(nz, 0.5), gain(tl, 0.35)), 0.0002, 0.05);
}

export function slam({ seed = 101, big = false } = {}) {
  const k = kick({ punch: big ? 1.6 : 1.35, len: big ? 0.6 : 0.42, seed });
  const n = sec(big ? 0.5 : 0.25);
  const tom = mul(osc('sine', n, (i) => 120 - 40 * Math.min(1, i / sec(0.12))), expDecay(n, big ? 0.14 : 0.07));
  const snapN = sec(0.08);
  const snap = mul(filter(noise(snapN, seed + 2), 'hp', 1800), expDecay(snapN, 0.012, 0.0003));
  const parts = [k, gain(tom, 0.5), gain(snap, big ? 0.55 : 0.4)];
  if (big) parts.push(gain(clap({ seed: seed + 5, tail: 0.18 }), 0.5));
  return edges(softclip(sum(...parts), 1.1));
}

// ---------------------------------------------------------------- interface

export function click({ seed = 111, release = true } = {}) {
  const n = sec(0.03);
  const tr = mul(filter(noise(sec(0.003), seed), 'hp', 2200), expDecay(sec(0.003), 0.0006, 0.00005));
  const tock = mul(osc('sine', n, 2350), expDecay(n, 0.006, 0.0002));
  const body = mul(osc('sine', n, 760), expDecay(n, 0.009, 0.0003));
  const tap = mul(osc('sine', sec(0.035), (i) => 1650 - 450 * (i / sec(0.035))), expDecay(sec(0.035), 0.012, 0.0004));
  let out = sum(gain(tr, 0.9), gain(tock, 0.55), gain(body, 0.45), gain(tap, 0.3));
  if (release) {
    const rel = gain(sum(gain(tr, 0.6), gain(tock, 0.4)), 0.45);
    const off = sec(0.075);
    const total = new Float32Array(off + rel.length);
    total.set(out, 0);
    for (let i = 0; i < rel.length; i++) total[off + i] += rel[i];
    out = total;
  }
  return edges(out, 0.00005, 0.002);
}

export function tickSnd({ hz = 3200, seed = 121 } = {}) {
  const n = sec(0.02);
  const s = mul(osc('sine', n, hz), expDecay(n, 0.0035, 0.0001));
  const tr = mul(filter(noise(sec(0.002), seed), 'hp', 4000), expDecay(sec(0.002), 0.0004, 0.00005));
  return edges(sum(s, gain(tr, 0.5)), 0.00005, 0.002);
}

export function pop(midi = 84, { seed = 131 } = {}) {
  const n = sec(0.09);
  const f0 = mtof(midi);
  const s = mul(osc('sine', n, (i) => f0 * (0.55 + 0.45 * Math.exp(-(i / SR) / 0.012))), expDecay(n, 0.03, 0.0004));
  const tr = mul(filter(noise(sec(0.003), seed), 'hp', 3000), expDecay(sec(0.003), 0.0006, 0.00005));
  return edges(sum(s, gain(tr, 0.3)));
}

export function pin({ seed = 141, midi = 81 } = {}) {
  const n = sec(0.12);
  const f0 = mtof(midi);
  const drop = mul(osc('sine', n, (i) => f0 * (0.5 + 0.5 * Math.exp(-(i / SR) / 0.02))), expDecay(n, 0.04, 0.0005));
  const thud = mul(osc('sine', n, (i) => 190 - 60 * Math.min(1, i / sec(0.05))), expDecay(n, 0.035, 0.0005));
  return edges(sum(gain(drop, 0.7), gain(thud, 0.6)));
}

export function swipe({ seed = 151 } = {}) {
  const n = sec(0.2);
  const bp = filter(noise(n, seed), 'bp', (i) => 1200 + 1800 * (i / n), 1.0);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) env[i] = Math.pow(Math.sin(Math.PI * (i / n)), 2);
  return edges(gain(mul(bp, env), 1.2));
}

export function chatter({ seed = 161, count = 10, spacing = 0.034, scale = [72, 74, 77, 79, 81, 84, 86, 89] } = {}) {
  const r = mulberry32(seed);
  const n = sec(count * spacing + 0.05);
  const out = new Float32Array(n);
  for (let k = 0; k < count; k++) {
    const m = scale[Math.floor(r() * scale.length)];
    const len = sec(0.018);
    const s = mul(osc('square', len, mtof(m)), expDecay(len, 0.005, 0.0002));
    const sf = filter(s, 'lp', 5000);
    const o = sec(k * spacing);
    const g = 0.6 + 0.4 * r();
    for (let i = 0; i < len && o + i < n; i++) out[o + i] += sf[i] * g;
  }
  return edges(gain(out, 0.5));
}

export function stamp({ seed = 171 } = {}) {
  const n = sec(0.16);
  const thump = mul(osc('sine', n, (i) => 150 - 50 * Math.min(1, i / sec(0.06))), expDecay(n, 0.05, 0.0005));
  const slap = mul(filter(noise(sec(0.05), seed), 'bp', 1400, 0.9), expDecay(sec(0.05), 0.012, 0.0003));
  return edges(sum(gain(thump, 0.8), gain(slap, 0.7)));
}
