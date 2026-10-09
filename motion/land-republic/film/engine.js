// Motion engine. Every value on screen is computed from t alone.
//
// Springs only: there are no bezier eases in this film. A spring here is the
// closed-form step response of a damped oscillator, so it can be evaluated at
// any t without simulating the frames before it. A track is a sum of step
// responses (one per keyframe), which is exactly how a linear spring behaves
// when its target jumps, so chained moves keep their momentum.

export const SPRINGS = {
  // name: [stiffness, damping, mass]
  slam: [900, 36, 1],     // type hits, settles in ~150 ms with a small overshoot
  snap: [420, 27, 1],     // UI pieces locking in
  soft: [170, 26, 1],     // critically damped, no overshoot
  glide: [90, 19, 1],     // cursor travel, camera reframes
  drift: [26, 10.5, 1],   // slow camera push
  bounce: [320, 13, 1],   // map pins
  heavy: [220, 18, 1.6],  // big panels with weight
};

export function spring(t, name = 'snap', v0 = 0) {
  if (t <= 0) return 0;
  const [k, c, m] = Array.isArray(name) ? name : SPRINGS[name];
  const w0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const e = Math.exp(-zeta * w0 * t);
    return 1 + e * (-Math.cos(wd * t) + ((v0 - zeta * w0) / wd) * Math.sin(wd * t));
  }
  if (zeta === 1) {
    return 1 + (-1 + (v0 - w0) * t) * Math.exp(-w0 * t);
  }
  const s = Math.sqrt(zeta * zeta - 1);
  const r1 = -w0 * (zeta - s);
  const r2 = -w0 * (zeta + s);
  const c1 = (v0 + r2) / (r1 - r2);
  const c2 = -1 - c1;
  return 1 + c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
}

// Keys: [[time, value, springName?], ...]. The first key sets the start value.
export function track(t, keys) {
  let v = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [tk, val, name] = keys[i];
    if (t <= tk) break;
    v += (val - keys[i - 1][1]) * spring(t - tk, name || 'snap');
  }
  return v;
}

// Same as track for arrays of numbers (positions, colors).
export function trackN(t, keys) {
  const n = keys[0][1].length;
  const out = keys[0][1].slice();
  for (let i = 1; i < keys.length; i++) {
    const [tk, val, name] = keys[i];
    if (t <= tk) break;
    const s = spring(t - tk, name || 'snap');
    for (let j = 0; j < n; j++) out[j] += (val[j] - keys[i - 1][1][j]) * s;
  }
  return out;
}

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, x) => a + (b - a) * x;
export const inRange = (t, a, b) => t >= a && t < b;

// ------------------------------------------------------------------ noise

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

// Smooth 1D value noise in [-1, 1], pure function of (seed, x).
export function noise1(seed, x) {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n) => mulberry32((seed * 374761393) ^ (n * 668265263))() * 2 - 1;
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

// ------------------------------------------------------------------ beat grid

export function makeClock(grid) {
  return {
    t: (beat) => grid.offset + beat * grid.period,
    beat: (t) => (t - grid.offset) / grid.period,
    period: grid.period,
  };
}

// ------------------------------------------------------------------ dom

export function el(tag, cls, parent, attrs = {}) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'style') Object.assign(e.style, v);
    else e.setAttribute(k, v);
  }
  if (parent) parent.appendChild(e);
  return e;
}

export function svg(tag, parent, attrs = {}) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

// Writes a full transform every frame. Nothing is left over from the frame
// before because every property is always written.
export function place(node, { x = 0, y = 0, s = 1, sx = 1, sy = 1, r = 0, o = 1, show = true, clip = null, z = null, blur = 0 } = {}) {
  // 'inherit', never 'visible': a child must not show through a hidden parent.
  node.style.visibility = show ? 'inherit' : 'hidden';
  node.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${r.toFixed(3)}deg) scale(${(s * sx).toFixed(4)}, ${(s * sy).toFixed(4)})`;
  node.style.opacity = o.toFixed(3);
  node.style.clipPath = clip || 'none';
  node.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none';
  if (z !== null) node.style.zIndex = z;
}

// inset() clip from a 0..1 reveal amount and a direction.
export function wipe(p, dir = 'up', round = 0) {
  const q = (1 - clamp(p)) * 100;
  const r = round ? ` round ${round}px` : '';
  switch (dir) {
    case 'up': return `inset(${q.toFixed(2)}% 0 0 0${r})`;
    case 'down': return `inset(0 0 ${q.toFixed(2)}% 0${r})`;
    case 'left': return `inset(0 0 0 ${q.toFixed(2)}%${r})`;
    case 'right': return `inset(0 ${q.toFixed(2)}% 0 0${r})`;
    case 'center': return `inset(${(q / 2).toFixed(2)}% ${(q / 2).toFixed(2)}%${r})`;
    default: return 'none';
  }
}

// Wait for every image to decode and every font face to load.
export async function preload(root) {
  await document.fonts.ready;
  const imgs = [...root.querySelectorAll('img')];
  await Promise.all(imgs.map((i) => (i.complete && i.naturalWidth ? i.decode().catch(() => {}) : new Promise((res) => { i.onload = () => i.decode().then(res, res); i.onerror = res; }))));
}
