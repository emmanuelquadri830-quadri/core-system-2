// Small offline DSP kit. Everything is deterministic: noise comes from
// mulberry32 with fixed seeds, never Math.random.

export const SR = 48000;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const db = (d) => Math.pow(10, d / 20);
export const sec = (s) => Math.round(s * SR);

// ---------------------------------------------------------------- buses

export class Bus {
  constructor(lengthSamples) {
    this.n = lengthSamples;
    this.L = new Float32Array(lengthSamples);
    this.R = new Float32Array(lengthSamples);
  }
  // Mono signal into the bus with constant-power pan, unity at centre.
  add(sig, startSample, gain = 1, pan = 0) {
    const a = ((pan + 1) * Math.PI) / 4;
    const gl = Math.cos(a) * Math.SQRT2 * gain;
    const gr = Math.sin(a) * Math.SQRT2 * gain;
    const s0 = Math.max(0, startSample);
    const end = Math.min(this.n, startSample + sig.length);
    for (let i = s0; i < end; i++) {
      const v = sig[i - startSample];
      this.L[i] += v * gl;
      this.R[i] += v * gr;
    }
  }
  addStereo(l, r, startSample, gain = 1) {
    const s0 = Math.max(0, startSample);
    const end = Math.min(this.n, startSample + l.length);
    for (let i = s0; i < end; i++) {
      this.L[i] += l[i - startSample] * gain;
      this.R[i] += r[i - startSample] * gain;
    }
  }
  mix(other, gain = 1) {
    for (let i = 0; i < this.n; i++) {
      this.L[i] += other.L[i] * gain;
      this.R[i] += other.R[i] * gain;
    }
  }
  scale(gainFn) {
    for (let i = 0; i < this.n; i++) {
      const g = gainFn(i);
      this.L[i] *= g;
      this.R[i] *= g;
    }
  }
}

// ---------------------------------------------------------------- oscillators

function blep(t, dt) {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

// freq may be a number or a function of the sample index.
export function osc(type, len, freq, phase0 = 0) {
  const out = new Float32Array(len);
  let ph = phase0 % 1;
  const f = typeof freq === 'function' ? freq : () => freq;
  for (let i = 0; i < len; i++) {
    const hz = f(i);
    const dt = hz / SR;
    let v;
    switch (type) {
      case 'sine':
        v = Math.sin(2 * Math.PI * ph);
        break;
      case 'saw':
        v = 2 * ph - 1 - blep(ph, dt);
        break;
      case 'square': {
        v = ph < 0.5 ? 1 : -1;
        v += blep(ph, dt);
        v -= blep((ph + 0.5) % 1, dt);
        break;
      }
      case 'tri':
        v = 1 - 4 * Math.abs(ph - 0.5);
        break;
      default:
        throw new Error(type);
    }
    out[i] = v;
    ph += dt;
    if (ph >= 1) ph -= 1;
  }
  return out;
}

export function noise(len, seed) {
  const r = mulberry32(seed);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = r() * 2 - 1;
  return out;
}

// ---------------------------------------------------------------- envelopes

// Attack, decay to sustain, hold until `gate` seconds, then release.
export function adsr(len, a, d, s, r, gate) {
  const out = new Float32Array(len);
  const A = Math.max(1, sec(a));
  const D = Math.max(1, sec(d));
  const G = sec(gate);
  const R = Math.max(1, sec(r));
  let last = 0;
  for (let i = 0; i < len; i++) {
    let v;
    if (i < G) {
      if (i < A) v = i / A;
      else if (i < A + D) v = 1 - (1 - s) * ((i - A) / D);
      else v = s;
      last = v;
    } else {
      const k = (i - G) / R;
      v = k >= 1 ? 0 : last * Math.pow(1 - k, 2);
    }
    out[i] = v;
  }
  return out;
}

export function expDecay(len, tau, attack = 0.001) {
  const out = new Float32Array(len);
  const A = Math.max(1, sec(attack));
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const a = i < A ? i / A : 1;
    out[i] = a * Math.exp(-t / tau);
  }
  return out;
}

export function mul(a, b) {
  const n = Math.min(a.length, b.length);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = a[i] * b[i];
  return out;
}

export function sum(...sigs) {
  const n = Math.max(...sigs.map((s) => s.length));
  const out = new Float32Array(n);
  for (const s of sigs) for (let i = 0; i < s.length; i++) out[i] += s[i];
  return out;
}

export function gain(sig, g) {
  const out = new Float32Array(sig.length);
  for (let i = 0; i < sig.length; i++) out[i] = sig[i] * g;
  return out;
}

export function softclip(sig, drive = 1) {
  const out = new Float32Array(sig.length);
  const n = Math.tanh(drive);
  for (let i = 0; i < sig.length; i++) out[i] = Math.tanh(sig[i] * drive) / n;
  return out;
}

// Short linear fades to kill clicks at the edges of a one-shot.
export function edges(sig, fadeIn = 0.0005, fadeOut = 0.004) {
  const a = sec(fadeIn);
  const b = sec(fadeOut);
  const n = sig.length;
  for (let i = 0; i < a && i < n; i++) sig[i] *= i / a;
  for (let i = 0; i < b && i < n; i++) sig[n - 1 - i] *= i / b;
  return sig;
}

// ---------------------------------------------------------------- filters

// Topology-preserving state variable filter (Zavalishin). Stable under fast
// cutoff modulation, which the risers and filter sweeps depend on.
export class SVF {
  constructor() {
    this.ic1 = 0;
    this.ic2 = 0;
    this.lp = 0;
    this.bp = 0;
    this.hp = 0;
  }
  tick(x, cutoff, q) {
    const fc = Math.min(Math.max(cutoff, 10), SR * 0.45);
    const g = Math.tan((Math.PI * fc) / SR);
    const k = 1 / q;
    const a1 = 1 / (1 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;
    const v3 = x - this.ic2;
    const v1 = a1 * this.ic1 + a2 * v3;
    const v2 = this.ic2 + a2 * this.ic1 + a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.lp = v2;
    this.bp = v1;
    this.hp = x - k * v1 - v2;
  }
}

// mode: 'lp' | 'bp' | 'hp'. cutoff may be a number or function of sample index.
export function filter(sig, mode, cutoff, q = 0.707) {
  const f = new SVF();
  const out = new Float32Array(sig.length);
  const c = typeof cutoff === 'function' ? cutoff : () => cutoff;
  for (let i = 0; i < sig.length; i++) {
    f.tick(sig[i], c(i), q);
    out[i] = f[mode];
  }
  return out;
}

// One-pole high-pass for DC and rumble on buses.
export function highpassBus(bus, hz) {
  const a = Math.exp((-2 * Math.PI * hz) / SR);
  for (const ch of [bus.L, bus.R]) {
    let x1 = 0,
      y1 = 0;
    for (let i = 0; i < ch.length; i++) {
      const x = ch[i];
      const y = a * (y1 + x - x1);
      x1 = x;
      y1 = y;
      ch[i] = y;
    }
  }
}

// ---------------------------------------------------------------- space

// Freeverb-style plate: mono in, stereo out.
export function reverb(inL, inR, { room = 0.82, damp = 0.35, width = 1, predelay = 0.01 } = {}) {
  const scale = SR / 44100;
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((x) => Math.round(x * scale));
  const apT = [556, 441, 341, 225].map((x) => Math.round(x * scale));
  const spread = Math.round(23 * scale);
  const n = inL.length;
  const pd = sec(predelay);
  const outL = new Float32Array(n);
  const outR = new Float32Array(n);
  const run = (offset, out) => {
    const combs = combT.map((t) => ({ buf: new Float32Array(t + offset), i: 0, store: 0 }));
    const aps = apT.map((t) => ({ buf: new Float32Array(t + offset), i: 0 }));
    for (let s = 0; s < n; s++) {
      const src = s - pd >= 0 ? (inL[s - pd] + inR[s - pd]) * 0.5 * 0.03 : 0;
      let acc = 0;
      for (const c of combs) {
        const y = c.buf[c.i];
        c.store = y * (1 - damp) + c.store * damp;
        c.buf[c.i] = src + c.store * room;
        c.i = (c.i + 1) % c.buf.length;
        acc += y;
      }
      for (const a of aps) {
        const b = a.buf[a.i];
        a.buf[a.i] = acc + b * 0.5;
        acc = b - acc;
        a.i = (a.i + 1) % a.buf.length;
      }
      out[s] = acc;
    }
  };
  run(0, outL);
  run(spread, outR);
  if (width < 1) {
    for (let s = 0; s < n; s++) {
      const m = (outL[s] + outR[s]) * 0.5;
      outL[s] = m + (outL[s] - m) * width;
      outR[s] = m + (outR[s] - m) * width;
    }
  }
  return [outL, outR];
}

// Tempo-synced ping-pong delay with a darkening feedback path.
export function pingpong(inL, inR, delaySec, feedback = 0.35, tone = 4000) {
  const n = inL.length;
  const d = sec(delaySec);
  const outL = new Float32Array(n);
  const outR = new Float32Array(n);
  const bufL = new Float32Array(d);
  const bufR = new Float32Array(d);
  const a = Math.exp((-2 * Math.PI * tone) / SR);
  let lpL = 0,
    lpR = 0,
    idx = 0;
  for (let i = 0; i < n; i++) {
    const yl = bufL[idx];
    const yr = bufR[idx];
    lpL = (1 - a) * yl + a * lpL;
    lpR = (1 - a) * yr + a * lpR;
    bufL[idx] = (inL[i] + inR[i]) * 0.5 + lpR * feedback;
    bufR[idx] = lpL * feedback;
    outL[i] = yl;
    outR[i] = yr;
    idx = (idx + 1) % d;
  }
  return [outL, outR];
}

// ---------------------------------------------------------------- dynamics

// Lookahead brick-wall limiter. Gain never exceeds what the upcoming peak
// allows, then recovers with an exponential release.
export function limit(bus, ceilingDb = -1.5, lookMs = 1.5, releaseMs = 80) {
  const n = bus.n;
  const ceil = db(ceilingDb);
  const W = Math.max(1, Math.round((lookMs / 1000) * SR));
  const req = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(bus.L[i]), Math.abs(bus.R[i]));
    req[i] = p > ceil ? ceil / p : 1;
  }
  // sliding minimum over [i - W, i + W]
  const m = new Float32Array(n);
  const dq = [];
  let head = 0;
  for (let j = 0; j < n + W; j++) {
    if (j < n) {
      while (dq.length > head && req[dq[dq.length - 1]] >= req[j]) dq.pop();
      dq.push(j);
    }
    const i = j - W;
    if (i >= 0) {
      while (dq[head] < i - W) head++;
      m[i] = req[dq[head]];
    }
  }
  // box smooth over W, stays at or below the requirement
  const sm = new Float32Array(n);
  let acc = 0;
  const half = Math.floor(W / 2);
  for (let i = 0; i < n + half; i++) {
    if (i < n) acc += m[i];
    if (i - W >= 0) acc -= m[i - W];
    const k = i - half;
    const count = Math.min(i, n - 1) - Math.max(0, i - W + 1) + 1;
    if (k >= 0 && k < n) sm[k] = acc / count;
  }
  const rel = Math.exp(-1 / ((releaseMs / 1000) * SR));
  let g = 1;
  let reduction = 0;
  for (let i = 0; i < n; i++) {
    const target = sm[i];
    g = target < g ? target : target + (g - target) * rel;
    reduction = Math.max(reduction, -20 * Math.log10(g));
    bus.L[i] *= g;
    bus.R[i] *= g;
  }
  return reduction;
}

// ---------------------------------------------------------------- loudness

// ITU-R BS.1770-4 integrated loudness with absolute and relative gating.
export function lufs(L, R) {
  const kw = (x) => {
    const st = [
      [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585],
      [1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621],
    ];
    let y = x;
    for (const [b0, b1, b2, a1, a2] of st) {
      const o = new Float64Array(y.length);
      let x1 = 0,
        x2 = 0,
        y1 = 0,
        y2 = 0;
      for (let i = 0; i < y.length; i++) {
        const v = b0 * y[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1;
        x1 = y[i];
        y2 = y1;
        y1 = v;
        o[i] = v;
      }
      y = o;
    }
    return y;
  };
  const l = kw(L);
  const r = kw(R);
  const block = Math.round(0.4 * SR);
  const hop = Math.round(0.1 * SR);
  const z = [];
  for (let s = 0; s + block <= l.length; s += hop) {
    let a = 0,
      b = 0;
    for (let i = s; i < s + block; i++) {
      a += l[i] * l[i];
      b += r[i] * r[i];
    }
    z.push((a + b) / block);
  }
  const toL = (p) => -0.691 + 10 * Math.log10(p);
  const abs = z.filter((p) => toL(p) > -70);
  if (!abs.length) return -Infinity;
  const mAbs = abs.reduce((x, y) => x + y, 0) / abs.length;
  const rel = toL(mAbs) - 10;
  const g = abs.filter((p) => toL(p) > rel);
  return toL(g.reduce((x, y) => x + y, 0) / g.length);
}

// 4x oversampled true peak estimate (windowed-sinc interpolation).
export function truePeakDb(L, R) {
  const taps = 16;
  const phases = 4;
  const kernel = [];
  for (let p = 1; p < phases; p++) {
    const frac = p / phases;
    const k = [];
    for (let t = -taps + 1; t <= taps; t++) {
      const x = t - frac;
      const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      const w = 0.5 + 0.5 * Math.cos((Math.PI * x) / taps);
      k.push(sinc * w);
    }
    kernel.push(k);
  }
  let peak = 0;
  for (const ch of [L, R]) {
    for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]));
    for (let i = taps; i < ch.length - taps; i++) {
      for (const k of kernel) {
        let acc = 0;
        for (let j = 0; j < k.length; j++) acc += k[j] * ch[i - taps + 1 + j];
        const a = Math.abs(acc);
        if (a > peak) peak = a;
      }
    }
  }
  return 20 * Math.log10(peak);
}

// ---------------------------------------------------------------- files

export function writeWav(path, L, R, fs) {
  const n = L.length;
  const bytes = 44 + n * 2 * 4;
  const buf = Buffer.alloc(bytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(bytes - 8, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(3, 20); // IEEE float
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 8, 28);
  buf.writeUInt16LE(8, 32);
  buf.writeUInt16LE(32, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 8, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    buf.writeFloatLE(L[i], o);
    buf.writeFloatLE(R[i], o + 4);
    o += 8;
  }
  fs.writeFileSync(path, buf);
}

export function readWav(path, fs) {
  const buf = fs.readFileSync(path);
  let o = 12;
  let fmt = null;
  let data = null;
  while (o < buf.length) {
    const id = buf.toString('ascii', o, o + 4);
    const size = buf.readUInt32LE(o + 4);
    if (id === 'fmt ') fmt = { format: buf.readUInt16LE(o + 8), ch: buf.readUInt16LE(o + 10), rate: buf.readUInt32LE(o + 12), bits: buf.readUInt16LE(o + 22) };
    if (id === 'data') data = { start: o + 8, size };
    o += 8 + size + (size % 2);
  }
  if (!fmt || fmt.format !== 3 || fmt.bits !== 32 || fmt.ch !== 2) throw new Error('expected stereo float32 wav');
  const n = data.size / 8;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    L[i] = buf.readFloatLE(data.start + i * 8);
    R[i] = buf.readFloatLE(data.start + i * 8 + 4);
  }
  return { L, R, rate: fmt.rate };
}
