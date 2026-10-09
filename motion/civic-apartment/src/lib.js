// Shared helpers. Everything here is a pure function: no clocks, no Math.random.

export const W = 1080;
export const H = 1920;
export const FPS = 30;
export const DURATION = 15;

// Text safe area from the brief.
export const SAFE = { left: 90, right: W - 160, top: 260, bottom: H - 400 };

export const COLOR = {
  ink: '#0F0F0F',
  blue: '#1667D0',
  white: '#FFFFFF',
  paper: '#F4F2F0',
};

// 118 BPM. One beat is 60 / 118 s, not 0.51 s.
export const BPM = 118;
export const BEAT = 60 / BPM;
export const beatTime = (n) => n * BEAT;
// Cuts land on whole frames, so snap a beat to its nearest frame.
export const beatFrameTime = (n) => Math.round(beatTime(n) * FPS) / FPS;

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

// CSS cubic-bezier(x1, y1, x2, y2) as a function of progress 0..1.
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (s) => ((ax * s + bx) * s + cx) * s;
  const sy = (s) => ((ay * s + by) * s + cy) * s;
  const dx = (s) => (3 * ax * s + 2 * bx) * s + cx;
  const solve = (x) => {
    let s = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(s) - x;
      if (Math.abs(e) < 1e-7) return s;
      const d = dx(s);
      if (Math.abs(d) < 1e-6) break;
      s -= e / d;
    }
    let lo = 0, hi = 1;
    s = x;
    for (let i = 0; i < 40; i++) {
      const v = sx(s);
      if (Math.abs(v - x) < 1e-7) break;
      if (v < x) lo = s; else hi = s;
      s = (lo + hi) / 2;
    }
    return s;
  };
  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sy(solve(x)));
}

// Motion rules: entrances expo-out; exits accelerate away and are shorter.
export const easeIn = cubicBezier(0.16, 1, 0.3, 1);
export const easeOut = cubicBezier(0.5, 0, 0.75, 0);

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a, b, k) => a + (b - a) * k;
// Progress of t through [start, start + dur], clamped.
export const span = (t, start, dur) => clamp01((t - start) / dur);
export const smoothstep = (k) => k * k * (3 - 2 * k);

// Catmull-Rom spline through points, resampled by arc length so a
// progress value maps to an even distance along the path.
export function arcPath(points, samplesPerSegment = 40) {
  const out = [];
  const n = points.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i];
    const p2 = points[i + 1], p3 = points[Math.min(n - 1, i + 2)];
    for (let j = 0; j < samplesPerSegment; j++) {
      const s = j / samplesPerSegment, s2 = s * s, s3 = s2 * s;
      const f = (a, b, c, d) =>
        0.5 * (2 * b + (-a + c) * s + (2 * a - 5 * b + 4 * c - d) * s2 + (-a + 3 * b - 3 * c + d) * s3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points[n - 1]);
  const len = [0];
  for (let i = 1; i < out.length; i++) {
    len.push(len[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
  }
  const total = len[len.length - 1];
  // Points from the start up to fraction k of the length, ending exactly at k.
  const upTo = (k) => {
    const target = clamp01(k) * total;
    const pts = [out[0]];
    for (let i = 1; i < out.length; i++) {
      if (len[i] >= target) {
        const r = (target - len[i - 1]) / (len[i] - len[i - 1] || 1);
        pts.push([lerp(out[i - 1][0], out[i][0], r), lerp(out[i - 1][1], out[i][1], r)]);
        return pts;
      }
      pts.push(out[i]);
    }
    return pts;
  };
  return { points: out, total, upTo };
}
