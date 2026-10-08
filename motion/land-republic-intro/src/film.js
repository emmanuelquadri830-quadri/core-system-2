// Land Republic intro, 0:00-0:09, 1080x1920 @ 30 fps.
// window.seek(t) paints frame t from nothing. No transitions, timers or carried state.

import { createGL } from './gl.js';

const W = 1080, H = 1920, CX = 540, CY = 960;
const DURATION = 24.0;
const NS = 'http://www.w3.org/2000/svg';

// ------------------------------------------------------------------ helpers
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, u) => a + (b - a) * u;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const mixHex = (a, b, u) => {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], u)).toString(16).padStart(2, '0')).join('');
};
const E = {
  outCubic: u => 1 - Math.pow(1 - u, 3),
  inCubic: u => u * u * u,
  inQuad: u => u * u,
  inOutCubic: u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  inOutSine: u => -(Math.cos(Math.PI * u) - 1) / 2,
  outExpo: u => (u >= 1 ? 1 : (1 - Math.pow(2, -10 * u)) / (1 - Math.pow(2, -10))),
  inOutExpo: u => (u <= 0 ? 0 : u >= 1 ? 1 : u < 0.5 ? Math.pow(2, 20 * u - 10) / 2 : (2 - Math.pow(2, -20 * u + 10)) / 2),
};
// Rise to 1+a at `split`, ease back to 1 by u=1. C1 continuous; the reference's
// small controlled overshoot-and-settle.
function settle(u, a = 0.03, split = 0.6, rise = E.outCubic) {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  if (u < split) return (1 + a) * rise(u / split);
  return 1 + a - a * E.inOutSine((u - split) / (1 - split));
}
// Same curve, timed so the value first crosses 1 exactly at tHit.
function settleHit(t, t0, tHit, a = 0.03, split = 0.6) {
  const f = 1 - Math.cbrt(1 - 1 / (1 + a)); // where (1+a)*outCubic(f) = 1
  const d = (tHit - t0) / (f * split);
  return settle((t - t0) / d, a, split);
}
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const $ = id => document.getElementById(id);
const set = (el, attrs) => { for (const k in attrs) el.setAttribute(k, attrs[k]); };
const show = (el, on) => { el.style.display = on ? '' : 'none'; };

// ------------------------------------------------------------------ data
const [BEATS, VEC, GEO] = await Promise.all([
  fetch('beats.json').then(r => r.json()),
  fetch('assets/earth/ibadan-vectors.json').then(r => r.json()),
  fetch('assets/geo.json').then(r => r.json()),
]);
// Measured hit times (s), from audio/score.py. The earlier map, land and card story is
// kept in this file for a later step but parked beyond the end of the film.
const T = { map: 99, oyo: 99, pin: 99, terrain: 99, plot: 99, card: 99, ...BEATS.hits };
await document.fonts.load('800 40px Figtree');
await document.fonts.load('600 40px Figtree');
await document.fonts.load('500 40px "Plex Mono"');
await document.fonts.load('600 40px "Plex Mono"');
await document.fonts.load('500 40px "Plex Mono"', '₦');
await document.fonts.ready;

const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const [IMG_BM, IMG_CLOUDS, IMG_LOCAL] = await Promise.all([
  loadImg('assets/earth/blue-marble-4096.jpg'),
  loadImg('assets/earth/clouds-4096.jpg'),
  loadImg('assets/earth/ibadan-local.png'),
]);
const drawGL = createGL($('gl'), { bm: IMG_BM, clouds: IMG_CLOUDS, local: IMG_LOCAL });

// ------------------------------------------------------------------ mark
const HUB = [18.21, 18.51];
const ARMS = [...document.querySelectorAll('#markShapes polygon')].map(p => {
  const pts = p.getAttribute('points').trim().split(/\s+/).map(s => s.split(',').map(Number));
  const c = pts.reduce((a, q) => [a[0] + q[0] / pts.length, a[1] + q[1] / pts.length], [0, 0]);
  const d = [c[0] - HUB[0], c[1] - HUB[1]];
  const l = Math.hypot(d[0], d[1]);
  return { points: p.getAttribute('points'), dir: [d[0] / l, d[1] / l] };
});
function buildMark(parent) {
  return ARMS.map(a => {
    const el = document.createElementNS(NS, 'polygon');
    set(el, { points: a.points });
    parent.appendChild(el);
    return el;
  });
}
const markArms = buildMark($('markArms'));
const markArmsA = buildMark($('markArmsA'));
const cardArms = buildMark($('cardMark'));
const ARM_ORDER = [0, 1, 5, 2, 4, 3];   // clockwise from the top, stem last

// Lockup geometry, in logo units (see index.html).
const LOCK = { cx: 55.9, cy: 18.7, s: 7.0 };
const lockHub = () => [CX + (HUB[0] - LOCK.cx) * LOCK.s, CY + (HUB[1] - LOCK.cy) * LOCK.s];

// ------------------------------------------------------------------ typing
function buildTyping(textEl, str) {
  textEl.textContent = '';
  return [...str].map(ch => {
    const s = document.createElementNS(NS, 'tspan');
    s.textContent = ch;
    textEl.appendChild(s);
    return s;
  });
}
// Each glyph arrives as a ghost and firms up, as in the reference.
function typeChars(spans, t, t0, step) {
  let n = 0;
  spans.forEach((s, k) => {
    const a = prog(t, t0 + k * step, t0 + k * step + 0.07);
    s.setAttribute('fill-opacity', t < t0 + k * step ? 0 : (0.28 + 0.72 * a).toFixed(3));
    if (t >= t0 + k * step) n = k + 1;
  });
  return n;
}

const QUERY = 'land for sale in Ibadan';
const LOOK = 'LOOKING FOR A';
// word bursts, as the reference types: [first char, last char + 1]
const LOOK_BURSTS = [[0, 11], [12, 13]];
// The reference's word wheel. HOUSE is typed into the slot, then the wheel rolls and settles on Land.
const WHEEL = ['HOUSE', 'Apartment', 'Mansion', 'Land', 'Duplex'];
const WHEEL_STOP = WHEEL.indexOf('Land');
const TITLE = 'IBADAN, OYO STATE';
const PINTXT = '7.38°N, 3.93°E';
const qSpans = buildTyping($('query'), QUERY);
const lSpans = buildTyping($('lookText'), LOOK);
const tSpans = buildTyping($('titleText'), TITLE);
const pSpans = buildTyping($('pinLabelText'), PINTXT);
const QW = $('query').getComputedTextLength() / QUERY.length;
const TW = $('titleText').getComputedTextLength() / TITLE.length;
// Size the line so LOOKING FOR A plus the widest option fills about 92% of the frame.
const wheelEls = WHEEL.map(w => {
  const el = document.createElementNS(NS, 'text');
  el.textContent = w;
  el.setAttribute('font-size', 88);
  $('wheel').appendChild(el);
  return el;
});
const GAP_EM = 0.28;
const LOOK_SIZE = 88 * 990 / ($('lookText').getComputedTextLength() + 88 * GAP_EM + Math.max(...wheelEls.map(e => e.getComputedTextLength())));
$('lookText').setAttribute('font-size', LOOK_SIZE.toFixed(2));
wheelEls.forEach(e => e.setAttribute('font-size', LOOK_SIZE.toFixed(2)));
const LOOK_W = $('lookText').getComputedTextLength();
const WORD_W = wheelEls.map(e => e.getComputedTextLength());
const GAP = LOOK_SIZE * GAP_EM;
const LAND_EL = wheelEls[WHEEL_STOP];
const LAND_X = [0, 1, 2, 3, 4].map(k => (k ? LAND_EL.getSubStringLength(0, k) : 0));
// Column centre chosen so the settled line, LOOKING FOR A Land, is centred on the frame.
const COL_X = (W - (LOOK_W + GAP + WORD_W[WHEEL_STOP])) / 2 + LOOK_W + GAP + WORD_W[WHEEL_STOP] / 2;
const lookPrefix = k => (k <= 0 ? 0 : $('lookText').getSubStringLength(0, k));
const LOOK_X = [...Array(LOOK.length + 1).keys()].map(lookPrefix);
const PW = $('pinLabelText').getComputedTextLength() / PINTXT.length;

// ------------------------------------------------------------------ map
const states = Object.entries(GEO.states).map(([name, d]) => {
  const el = document.createElementNS(NS, 'path');
  set(el, { d, pathLength: 1, 'stroke-dasharray': '1 1' });
  $('states').appendChild(el);
  // order the draw-on by distance from Ibadan so the map ripples out from it
  const nums = d.match(/-?\d+\.?\d*/g).map(Number);
  let sx = 0, sy = 0;
  for (let i = 0; i < nums.length; i += 2) { sx += nums[i]; sy += nums[i + 1]; }
  const c = [sx / (nums.length / 2), sy / (nums.length / 2)];
  return { el, name, dist: Math.hypot(c[0] - GEO.ibadan[0], c[1] - GEO.ibadan[1]) };
});
const maxDist = Math.max(...states.map(s => s.dist));
set($('country'), { d: GEO.country, pathLength: 1, 'stroke-dasharray': '1 1' });
set($('oyoFill'), { d: GEO.oyo_fine });
set($('oyoEdge'), { d: GEO.oyo_fine });
const NG = { x0: GEO.bbox[0], y0: GEO.bbox[1], x1: GEO.bbox[2], y1: GEO.bbox[3] };
const MAP_C = [(NG.x0 + NG.x1) / 2, (NG.y0 + NG.y1) / 2];
const MAP_SCREEN = [CX, 1010];
const Z0 = 880 / (NG.x1 - NG.x0);
const IB = GEO.ibadan;

// ------------------------------------------------------------------ thread
// The reference's soft wavy thread behind the typed line.
function threadPath(y0, ph, a1 = 58, a2 = 22) {
  let d = '';
  for (let x = -60; x <= W + 60; x += 24) {
    const y = y0 + a1 * Math.sin((x / 980) * Math.PI * 2 + ph) + a2 * Math.sin((x / 410) * Math.PI * 2 + ph * 1.7);
    d += (x === -60 ? 'M' : 'L') + x + ',' + y.toFixed(1);
  }
  return d;
}

// ------------------------------------------------------------------ estate (world metres, y down)
const COLS = [-50, -30, -10, 10, 30];
const ROWS = [[-54, -29], [-29, -4], [4, 29], [29, 54]];
const PLOTS = [];
for (const [y0, y1] of ROWS) for (const x0 of COLS) PLOTS.push({ x0, x1: x0 + 20, y0, y1 });
const SEL = PLOTS.find(p => p.x0 === -10 && p.y0 === 4);
const SEL_C = [(SEL.x0 + SEL.x1) / 2, (SEL.y0 + SEL.y1) / 2];
const plotEls = PLOTS.map(p => {
  const el = document.createElementNS(NS, 'rect');
  set(el, { x: p.x0, y: p.y0, width: 20, height: p.y1 - p.y0, pathLength: 1, 'stroke-dasharray': '1 1' });
  $('survey').appendChild(el);
  const d = Math.hypot((p.x0 + 10) - SEL_C[0], (p.y0 + p.y1) / 2 - SEL_C[1]);
  return { el, p, d };
});
const corners = new Map();
for (const p of PLOTS) for (const [x, y] of [[p.x0, p.y0], [p.x1, p.y0], [p.x0, p.y1], [p.x1, p.y1]]) corners.set(x + ',' + y, [x, y]);
const beaconEls = [...corners.values()].map(([x, y]) => {
  const el = document.createElementNS(NS, 'rect');
  el.setAttribute('fill', '#FFFFFF');
  el.setAttribute('stroke', '#111111');
  $('survey').appendChild(el);
  return { el, x, y, d: Math.hypot(x - SEL_C[0], y - SEL_C[1]) };
});
const maxPlotD = Math.max(...plotEls.map(o => o.d));
const maxBeaconD = Math.max(...beaconEls.map(o => o.d));

// Land camera: returns { px, rot, cam } at time t.
const T_LAND0 = T.terrain - 0.2;
function landCam(t) {
  const u = E.outCubic(prog(t, T_LAND0, T.plot + 0.1));
  let px = Math.exp(lerp(Math.log(0.9), Math.log(11.0), u));
  px *= 1 + 0.08 * E.inOutSine(prog(t, T.plot + 0.1, DURATION));
  const rot = lerp(-0.16, 0, E.outCubic(prog(t, T_LAND0, T.plot + 0.2)));
  const v = E.inOutCubic(prog(t, T.terrain, T.plot + 0.25));
  const sp = [CX, lerp(1010, 700, v)];          // where the chosen plot sits on screen
  const c = Math.cos(rot), s = Math.sin(rot);
  const dx = (sp[0] - CX) / px, dy = (sp[1] - CY) / px;
  const cam = [SEL_C[0] - (c * dx - s * dy), SEL_C[1] - (s * dx + c * dy)];
  return { px, rot, cam };
}
function toScreen(L, w) {
  const c = Math.cos(-L.rot), s = Math.sin(-L.rot);
  const dx = (w[0] - L.cam[0]) * L.px, dy = (w[1] - L.cam[1]) * L.px;
  return [CX + c * dx - s * dy, CY + s * dx + c * dy];
}

// Blob for the organic hole (seeded harmonics, never Math.random).
const rnd = mulberry32(20261008);
const HARM = [2, 3, 5, 7].map(k => ({ k, a: 0.05 + 0.05 * rnd(), p: rnd() * Math.PI * 2 }));
function blob(cx, cy, r, t) {
  let d = '';
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    let m = 1;
    for (const h of HARM) m += h.a * Math.sin(h.k * a + h.p + t * 0.8 * h.k);
    const x = cx + Math.cos(a) * r * m, y = cy + Math.sin(a) * r * m;
    d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
  }
  return d + 'Z';
}

// ------------------------------------------------------------------ world transition
const RE = 6371;
const TAN_H = Math.tan((40 / 2) * Math.PI / 180);   // 40 degree vertical field of view
const ASPECT = W / H;
const IBADAN = [3.928, 7.382];
const JUNCTION = [3.942, 7.381];                     // where the expressways meet (Natural Earth)

// Monotone cubic interpolation through keyframes (Fritsch-Carlson): smooth, no overshoot.
function monotone(keys) {
  const n = keys.length, x = keys.map(k => k[0]), y = keys.map(k => k[1]);
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  m[0] = 0; m[n - 1] = 0;                             // ease in and out at the ends
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const k = 3 / Math.sqrt(h); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return t => {
    if (t <= x[0]) return y[0];
    if (t >= x[n - 1]) return y[n - 1];
    let i = 0; while (t > x[i + 1]) i++;
    const hh = x[i + 1] - x[i], u = (t - x[i]) / hh, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * y[i] + (u3 - 2 * u2 + u) * hh * m[i] + (-2 * u3 + 3 * u2) * y[i + 1] + (u3 - u2) * hh * m[i + 1];
  };
}
const C0 = T.click + 0.02;
// Camera path: the reference's fly-in (globe, region, horizon tilt, descent, title, oblique, neon),
// compressed from 13 s to about 6 s and aimed at Ibadan.
const camLogRange = monotone([[C0, Math.log(46000)], [T.regional, Math.log(2400)], [T.regional + 0.3, Math.log(1250)],
  [T.horizon + 0.3, Math.log(600)], [T.title - 0.05, Math.log(200)], [T.oblique - 0.05, Math.log(95)], [T.neon - 0.1, Math.log(46)], [T.final + 0.5, Math.log(38)], [T.photo1, Math.log(6)]]);
const camLon = monotone([[C0, -14], [T.regional, 3.4], [T.regional + 0.3, 3.85], [T.horizon + 0.3, 3.93], [T.title - 0.05, IBADAN[0]], [T.oblique - 0.05, 3.94], [T.neon - 0.1, 3.962], [DURATION, 3.97]]);
const camLat = monotone([[C0, 4.0], [T.regional, 8.3], [T.regional + 0.3, 7.95], [T.horizon + 0.3, 7.5], [T.title - 0.05, IBADAN[1]], [T.oblique - 0.05, 7.385], [T.neon - 0.1, 7.402], [DURATION, 7.408]]);
const camPitch = monotone([[C0, 0], [T.horizon - 0.25, 0], [T.horizon - 0.03, 66], [T.horizon + 0.13, 66], [T.horizon + 0.35, 0], [T.oblique - 0.05, 0], [T.neon - 0.15, 50], [DURATION, 54]]);
const camHeading = monotone([[C0, 0], [T.oblique - 0.05, 0], [T.neon - 0.15, 33], [DURATION, 37]]);

const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; },
};
function ecef(lon, lat, r = RE) {
  const la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
  return [r * Math.cos(la) * Math.cos(lo), r * Math.cos(la) * Math.sin(lo), r * Math.sin(la)];
}
function earthCam(t) {
  const lon = camLon(t), lat = camLat(t), range = Math.exp(camLogRange(t));
  const pitch = camPitch(t) * Math.PI / 180, head = camHeading(t) * Math.PI / 180;
  const P = ecef(lon, lat), U = v3.norm(P);
  const lo = lon * Math.PI / 180, la = lat * Math.PI / 180;
  const Ea = [-Math.sin(lo), Math.cos(lo), 0];
  const No = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  const Nh = v3.add(v3.mul(No, Math.cos(head)), v3.mul(Ea, Math.sin(head)));
  const off = v3.add(v3.mul(U, Math.cos(pitch)), v3.mul(Nh, -Math.sin(pitch)));
  const pos = v3.add(P, v3.mul(off, range));
  const fwd = v3.mul(off, -1);
  const up = v3.norm(v3.add(v3.mul(Nh, Math.cos(pitch)), v3.mul(U, Math.sin(pitch))));
  const right = v3.norm(v3.cross(fwd, up));
  const cloudAmt = clamp((range - 2600) / 7000);
  const dim = 0.84 * E.inOutSine(prog(t, T.neon - 0.15, T.neon + 0.15));
  return {
    pos, fwd, up, right, range,
    gl: { pos, right, up, fwd, tanH: TAN_H, localBox: VEC.box, ibadan: IBADAN, cloudAmt, dim },
  };
}
// Project a lon/lat on the ground to screen pixels; null when behind or too close to the camera.
function project(c, lon, lat) {
  const v = v3.sub(ecef(lon, lat), c.pos);
  const z = v3.dot(v, c.fwd);
  if (z < 0.3) return null;
  const sx = v3.dot(v, c.right) / (z * TAN_H * ASPECT), sy = v3.dot(v, c.up) / (z * TAN_H);
  return [(sx + 1) / 2 * W, (1 - sy) / 2 * H];
}
function screenPath(c, pts) {
  let d = '', pen = false;
  for (const [lo, la] of pts) {
    const q = project(c, lo, la);
    if (!q || Math.abs(q[0]) > 6000 || Math.abs(q[1]) > 9000) { pen = false; continue; }
    d += (pen ? 'L' : 'M') + q[0].toFixed(1) + ',' + q[1].toFixed(1);
    pen = true;
  }
  return d;
}
// Routes built from Natural Earth segments; names only where the geometry confirms them.
// At each fork, follow the segment whose far end gets closest to the destination city.
const key = p => p[0].toFixed(3) + ',' + p[1].toFixed(3);
function route(startPt, dest, pred) {
  const segs = VEC.roads.filter(pred).map(r => r.pts);
  const out = [startPt];
  let cur = key(startPt), curPt = startPt;
  const dist = p => Math.hypot(p[0] - dest[0], p[1] - dest[1]);
  for (let guard = 0; guard < 20; guard++) {
    const cands = segs.map((sg, i) => [sg, i]).filter(([sg]) => key(sg[0]) === cur || key(sg[sg.length - 1]) === cur)
      .map(([sg, i]) => { const s2 = key(sg[0]) === cur ? sg : [...sg].reverse(); return [s2, i]; })
      .filter(([s2]) => dist(s2[s2.length - 1]) < dist(curPt));
    if (!cands.length) break;
    cands.sort((x, y) => dist(x[0][x[0].length - 1]) - dist(y[0][y[0].length - 1]));
    const [s2, i] = cands[0];
    segs.splice(i, 1);
    out.push(...s2.slice(1));
    curPt = s2[s2.length - 1]; cur = key(curPt);
    if (dist(curPt) < 0.05) break;
  }
  return out;
}
const LAGOS = [3.398, 6.581], IFE = [4.548, 7.455], OYO = [3.938, 7.814];
const ROUTE_LAGOS = route(JUNCTION, LAGOS, r => r.expressway === 1);
const ROUTE_IFE = route(JUNCTION, IFE, r => r.expressway === 1);
const ROUTE_OYO = route(JUNCTION, OYO, () => true);
const baseRoadEls = VEC.roads.map(r => {
  const el = document.createElementNS(NS, 'path');
  el.setAttribute('stroke-width', r.expressway ? 5 : 3);
  $('roadsBase').appendChild(el);
  return { el, r };
});
// Labels sit on the visible stretch of each road, measured in screen pixels from the junction.
const LABELS = [
  { text: 'TOWARDS LAGOS', route: ROUTE_LAGOS, s0: 90, s1: 560, t0: T.neon + 0.5, dy: -34 },
  { text: 'TOWARDS IFE', route: ROUTE_IFE, s0: 150, s1: 520, t0: T.neon + 0.68, dy: -34 },
  { text: 'TOWARDS OYO', route: ROUTE_OYO, s0: 240, s1: 640, t0: T.neon + 0.84, dy: 0 },
];
LABELS.forEach((L, i) => {
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('id', `labelPath${i}`);
  path.setAttribute('fill', 'none');
  $('roadLabels').appendChild(path);
  const text = document.createElementNS(NS, 'text');
  if (L.dy) text.setAttribute('dy', L.dy);
  const tp = document.createElementNS(NS, 'textPath');
  tp.setAttribute('href', `#labelPath${i}`);
  tp.setAttribute('startOffset', '50%');
  tp.setAttribute('text-anchor', 'middle');
  tp.setAttribute('dominant-baseline', 'central');
  L.spans = [...L.text].map(ch => { const s = document.createElementNS(NS, 'tspan'); s.textContent = ch; tp.appendChild(s); return s; });
  text.appendChild(tp);
  $('roadLabels').appendChild(text);
  L.path = path;
});
{
  const cEnd = earthCam(T.final + 0.4);
  for (const L of LABELS) {
    const q = L.route.map(p => project(cEnd, p[0], p[1])).filter(Boolean);
    const a = q[0], b = q[Math.min(q.length - 1, 2)];
    L.rev = b[0] < a[0];
  }
}
const TITLE_CITY = 'IBADAN';
const citySpans = [...TITLE_CITY].map(ch => { const s = document.createElementNS(NS, 'tspan'); s.textContent = ch; $('cityTitle').appendChild(s); return s; });
const RING_TEXT = 'IBADAN';
$('ringLabel').textContent = RING_TEXT;

// The stretch of a route between s0 and s1 screen pixels along it, densified so it follows
// the road, and turned to read left to right.
function labelPath(c, pts, s0, s1, rev = null) {
  const q = [];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let k = 0; k < 24; k++) {
      const u = k / 24;
      const p = project(c, lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u));
      if (p) q.push(p);
    }
  }
  const out = [];
  let acc = 0;
  for (let i = 0; i < q.length; i++) {
    if (i) acc += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]);
    if (acc >= s0 && acc <= s1 && q[i][0] > -200 && q[i][0] < W + 200 && q[i][1] > -200 && q[i][1] < H + 200) out.push(q[i]);
  }
  if (out.length < 2) return '';
  // Reading direction is fixed per label (see LABELS); a per-frame test flips near-vertical roads.
  if (rev === null ? out[out.length - 1][0] < out[0][0] : rev) out.reverse();
  // Chaikin corner cutting so glyphs do not spread apart at the road's bends
  let sm = out.filter((p, i) => i % 6 === 0 || i === out.length - 1);
  for (let it = 0; it < 4; it++) {
    const nx = [sm[0]];
    for (let i = 0; i < sm.length - 1; i++) {
      const [a0, a1] = sm[i], [b0, b1] = sm[i + 1];
      nx.push([0.75 * a0 + 0.25 * b0, 0.75 * a1 + 0.25 * b1], [0.25 * a0 + 0.75 * b0, 0.25 * a1 + 0.75 * b1]);
    }
    nx.push(sm[sm.length - 1]);
    sm = nx;
  }
  return sm.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('');
}

function worldOverlay(t, c) {
  // City title: a soft gradient sweeps the letters on, then off, as in the reference.
  const sIn = lerp(-1.5, TITLE_CITY.length + 0.5, E.inOutSine(prog(t, T.title - 0.07, T.title + 0.33)));
  const sOut = lerp(-1.5, TITLE_CITY.length + 0.5, E.inOutSine(prog(t, T.title + 0.6, T.title + 0.94)));
  citySpans.forEach((sp, i) => {
    const a = clamp((sIn - i) / 1.5) * (1 - clamp((sOut - i) / 1.5));
    sp.setAttribute('fill-opacity', a.toFixed(3));
  });
  show($('cityTitle'), t > T.title - 0.1 && t < T.title + 0.96);

  // Base road network fades up as the city comes close.
  const roadsOn = E.inOutSine(prog(t, T.neon - 0.1, T.neon + 0.3));
  show($('roadsBase'), roadsOn > 0);
  if (roadsOn > 0) {
    set($('roadsBase'), { opacity: (0.5 * roadsOn).toFixed(3) });
    for (const o of baseRoadEls) o.el.setAttribute('d', screenPath(c, o.r.pts));
  }

  // Neon: the Lagos-Ibadan Expressway in brand blue, the road toward Ife in white.
  const nA = E.inOutCubic(prog(t, T.neon - 0.02, T.neon + 0.55));
  const nB = E.inOutCubic(prog(t, T.neon2 - 0.02, T.neon2 + 0.5));
  show($('neonA'), nA > 0); show($('neonB'), nB > 0);
  if (nA > 0) {
    const dA = screenPath(c, ROUTE_LAGOS);
    for (const id of ['neonAGlow', 'neonACore']) set($(id), { d: dA, 'stroke-dashoffset': (1 - nA).toFixed(4) });
  }
  if (nB > 0) {
    const dB = screenPath(c, ROUTE_IFE);
    for (const id of ['neonBGlow', 'neonBCore']) set($(id), { d: dB, 'stroke-dashoffset': (1 - nB).toFixed(4) });
  }

  // Labels arrive letter by letter along their roads.
  LABELS.forEach(L => {
    const on = t >= L.t0;
    L.path.setAttribute('d', on ? labelPath(c, L.route, L.s0, L.s1, L.rev) : '');
    L.spans.forEach((sp, i) => sp.setAttribute('fill-opacity', clamp((t - L.t0 - i * 0.012) / 0.08).toFixed(3)));
  });

  // Junction ring with its curved label.
  const rU = E.inOutCubic(prog(t, T.neon + 0.62, T.neon + 0.98));
  show($('ring'), rU > 0);
  if (rU > 0) {
    const ring = [], arc = [];
    for (let k = 0; k <= 64; k++) {
      const a = (k / 64) * Math.PI * 2;
      const lo = JUNCTION[0] + (1.3 * Math.cos(a)) / (111.32 * Math.cos(JUNCTION[1] * Math.PI / 180));
      const la = JUNCTION[1] + (1.3 * Math.sin(a)) / 110.57;
      const q = project(c, lo, la); if (q) ring.push(q);
      const lo2 = JUNCTION[0] + (1.9 * Math.cos(a)) / (111.32 * Math.cos(JUNCTION[1] * Math.PI / 180));
      const la2 = JUNCTION[1] + (1.9 * Math.sin(a)) / 110.57;
      const q2 = project(c, lo2, la2); if (q2) arc.push(q2);
    }
    const toD = pts => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('');
    set($('ringPath'), { d: toD(ring), 'stroke-dashoffset': (1 - rU).toFixed(4) });
    // label on the upper half of the outer ellipse, reading left to right
    const top = arc.filter(p => p[1] <= Math.min(...arc.map(q => q[1])) + (Math.max(...arc.map(q => q[1])) - Math.min(...arc.map(q => q[1]))) * 0.5)
      .sort((a, b) => a[0] - b[0]);
    set($('ringArc'), { d: toD(top) });
    set($('ringLabel'), { 'fill-opacity': clamp((t - (T.neon + 0.86)) / 0.1).toFixed(3) });
  }
}

// ------------------------------------------------------------------ the cinematic close
// Real Land Republic estate photos, from The Monarch's Court, Epe (captioned as such on screen),
// used as proof of delivery before the Ariya Springs offer.
const SHOTS = [
  { img: 'epe-aerial-wide', at: 'photo1', next: 'photo2', lines: ['VERIFIED', 'TITLES.'], focus: [0.50, 0.42], pan: -24 },
  { img: 'epe-fenced', at: 'photo2', next: 'photo3', lines: ['FLEXIBLE', 'PAYMENT.'], focus: [0.55, 0.50], pan: 22 },
  { img: 'epe-gate', at: 'photo3', next: 'photo4', lines: ['TRANSPARENT', 'PROCESS.'], focus: [0.62, 0.52], pan: -18 },
  { img: 'epe-launch', at: 'photo4', next: 'offer', lines: ['SOLD', 'OUT.'], focus: [0.30, 0.56], pan: 20 },
];
const BAND = { y: 600, h: 640 };
const PHOTO_W = 1998, PHOTO_H = 954;
const bandScale = Math.max(W / PHOTO_W, BAND.h / PHOTO_H);
const bgScale = Math.max(W / PHOTO_W, H / PHOTO_H);
function svgImage(parent, href, w, h) {
  const el = document.createElementNS(NS, 'image');
  el.setAttribute('href', href);
  el.setAttribute('width', w);
  el.setAttribute('height', h);
  el.setAttribute('preserveAspectRatio', 'none');
  parent.appendChild(el);
  return new Promise((res, rej) => { el.addEventListener('load', () => res(el)); el.addEventListener('error', rej); });
}
for (const sh of SHOTS) {
  [sh.band, sh.bg] = await Promise.all([
    svgImage($('photoBand'), `assets/photos/${sh.img}.jpg`, PHOTO_W, PHOTO_H),
    svgImage($('photoBg'), `assets/photos/${sh.img}.jpg`, PHOTO_W, PHOTO_H),
  ]);
  // headline: one clipped line per row, sliding up out of its own baseline; the full stop is blue
  sh.lineEls = sh.lines.map((txt, i) => {
    const clipId = `hl_${sh.img}_${i}`;
    const cp = document.createElementNS(NS, 'clipPath'); cp.setAttribute('id', clipId);
    const r = document.createElementNS(NS, 'rect');
    set(r, { x: 0, y: 1380 + i * 124 - 112, width: W, height: 128 });
    cp.appendChild(r); $('stage').querySelector('defs').appendChild(cp);
    const g = document.createElementNS(NS, 'g'); g.setAttribute('clip-path', `url(#${clipId})`);
    const tx = document.createElementNS(NS, 'text');
    set(tx, { x: 80, y: 1380 + i * 124 });
    const body = txt.endsWith('.') ? txt.slice(0, -1) : txt;
    tx.appendChild(document.createTextNode(body));
    if (txt.endsWith('.')) { const dot = document.createElementNS(NS, 'tspan'); dot.setAttribute('fill', '#3B8BF2'); dot.textContent = '.'; tx.appendChild(dot); }
    g.appendChild(tx); $('headline').appendChild(g);
    return tx;
  });
}
const CAPTION = "THE MONARCH'S COURT · EPE, LAGOS";
$('captionText').textContent = CAPTION;
const CAPTION_W = $('captionText').getComputedTextLength();
const ctaArms = buildMark($('ctaArms'));
const LOCK2 = { s: 7.4, cx: 540, cy: 760 };

function shotState(sh, t) {
  const t0 = T[sh.at], t1 = T[sh.next];
  const enter = E.outExpo(prog(t, t0, t0 + 0.55));
  let z = lerp(1.45, 1.0, enter);
  z *= 1 + 0.12 * E.outCubic(prog(t, t0 + 0.75, t0 + 0.98)) + 0.04 * prog(t, t0 + 0.98, t1);   // punch on the mid beat
  z *= 1 + 0.55 * E.inCubic(prog(t, t1 - 0.16, t1));                                                // push into the cut
  const blur = 14 * (1 - prog(t, t0, t0 + 0.16)) + 16 * E.inCubic(prog(t, t1 - 0.12, t1));
  const pan = sh.pan * E.inOutSine(prog(t, t0, t1));
  return { z, blur, pan };
}

// ------------------------------------------------------------------ seek
const PILL = { x: 62, w: 800, h: 132, y: 640 };
const BTN_R = 66;

function seek(t) {
  t = clamp(t, 0, DURATION);

  // ---------------- Scene A: the mark assembles, then the lockup forms (0.00-2.00)
  show($('sceneA'), t < T.flood + 0.1);

  // Mark scale with a small overshoot that peaks on the settle hit.
  const S0 = 12;
  const sIntro = S0 * (0.9 + 0.1 * settle(prog(t, 0.05, 0.05 + (T.mark_settle - 0.05) / 0.57), 0.04, 0.57));
  const moveU = E.inOutCubic(prog(t, 0.66, 1.16));
  const drift = 1 + 0.03 * E.inOutSine(prog(t, 1.1, 2.0));
  const LH = lockHub();
  let hubA = [lerp(CX, LH[0], moveU), lerp(CY, LH[1], moveU)];
  hubA = [CX + (hubA[0] - CX) * drift, CY + (hubA[1] - CY) * drift];
  const SA = lerp(sIntro, LOCK.s, moveU) * drift;

  // Arms fly in along their own axes while the whole mark turns into place.
  const spin = -38 * (1 - E.outExpo(prog(t, 0, T.mark_settle)));
  ARM_ORDER.forEach((i, k) => {
    const u = E.outExpo(prog(t, k * 0.032, T.mark_settle));
    const off = (470 / S0) * (1 - u);
    markArmsA[i].setAttribute('transform', `translate(${(ARMS[i].dir[0] * off).toFixed(3)} ${(ARMS[i].dir[1] * off).toFixed(3)})`);
  });
  set($('markA'), { transform: `translate(${hubA[0].toFixed(2)} ${hubA[1].toFixed(2)}) scale(${SA.toFixed(4)}) rotate(${spin.toFixed(3)}) translate(${-HUB[0]} ${-HUB[1]})` });

  // Wordmark lines slide up out of their own baselines.
  const ls = LOCK.s * drift;
  set($('wordmark'), { transform: `translate(${(CX - LOCK.cx * ls).toFixed(2)} ${(CY - LOCK.cy * ls).toFixed(2)}) scale(${ls.toFixed(4)})` });
  const uL = E.outExpo(prog(t, T.wordmark - 0.05, T.wordmark + 0.4));
  const uR = E.outExpo(prog(t, T.wordmark + 0.03, T.wordmark + 0.48));
  set($('wmLand'), { y: (18.405 + 19 * (1 - uL)).toFixed(3) });
  set($('wmRep'), { y: (34.913 + 21 * (1 - uR)).toFixed(3) });
  set($('landClipRect'), { x: 38, y: 18.405 - 14.5, width: 80, height: 18.2 });
  set($('repClipRect'), { x: 38, y: 34.913 - 14.5, width: 80, height: 19 });

  // ---------------- Scene L: the reference's "LOOKING FOR" beat (1.80-3.02)
  const whipU = prog(t, T.whip - 0.16, T.whip + 0.02);
  show($('sceneL'), t >= 1.8 && whipU < 1);
  set($('sceneL'), { transform: `translate(0 ${(-2050 * E.inCubic(whipU)).toFixed(1)})` });
  set($('whipBlurK'), { stdDeviation: `0 ${(110 * E.inCubic(whipU)).toFixed(1)}` });

  // Brand blue floods out of the mark, then cools to slate and warms to charcoal, as in the reference.
  const fu = E.inOutCubic(prog(t, 1.8, T.flood + 0.06));
  const cool = E.inOutSine(prog(t, T.flood + 0.02, T.flood + 0.22));
  const warm = E.inOutSine(prog(t, T.flood + 0.18, T.flood + 0.42));
  set($('flood'), {
    cx: hubA[0].toFixed(1), cy: hubA[1].toFixed(1), r: (1500 * fu).toFixed(1),
    fill: mixHex(mixHex('#0F68D8', '#3B5873', cool), '#4E4D4A', warm),
  });

  // One soft light hump rises from bottom centre and widens; its shoulders lag, so the
  // corners stay dark for a moment after the centre has cleared.
  const wu = prog(t, T.flood + 0.14, T.flood + 0.66);
  const crest = lerp(2010, -520, E.inOutCubic(wu));
  const shoulder = lerp(820, 380, E.outCubic(wu));
  const spread = lerp(200, 560, E.outCubic(wu));
  let wd = `M-160,2400 L-160,${(crest + shoulder).toFixed(1)}`;
  for (let x = -160; x <= W + 160; x += 24) {
    const g = Math.exp(-Math.pow((x - CX) / spread, 2));
    wd += ` L${x},${(crest + shoulder * (1 - g)).toFixed(1)}`;
  }
  wd += ` L${W + 160},2400 Z`;
  set($('wave'), { d: wd });
  set($('threadMaskWave'), { d: wd });
  const paperOn = t >= T.flood + 0.74;
  show($('paperL'), paperOn);
  show($('threadMaskFull'), paperOn);

  // The thread drifts slowly behind the line.
  const thY = 1006, thPh = 0.9 + 1.1 * t;
  // two strands crossing, like the twisted ribbon in the reference
  set($('threadShadow'), { d: threadPath(thY + 12, thPh) });
  set($('threadShadow2'), { d: threadPath(thY + 18, thPh + 2.4, 42, 16) });
  set($('threadLight'), { d: threadPath(thY, thPh) });

  // LOOKING FOR A arrives in word bursts, HOUSE is typed into the slot, the whole line is
  // selected back to the start, then the word wheel rolls and settles on Land (as in the reference).
  const burstT = [T.flood + 0.25, T.flood + 0.4];
  const houseT = T.flood + 0.5;
  const ly = 1010, S_ = LOOK_SIZE, capC = ly - 0.35 * S_;
  // Wheel position in items: 0 = HOUSE in the slot, 3 = Land. Timed so Land crosses the slot on the hit.
  const W0 = T.wheel - 0.423;
  const wp = WHEEL_STOP * settle(prog(t, W0, W0 + 0.7), 0.03, 0.75, E.inOutCubic);
  const i0 = clamp(Math.floor(wp), 0, WHEEL.length - 1), i1 = Math.min(WHEEL.length - 1, i0 + 1);
  const slotW = lerp(WORD_W[i0], WORD_W[i1], wp - Math.floor(wp));
  const wheelDrift = -50 * Math.max(0, t - burstT[0]);
  const colX = COL_X + wheelDrift;
  const lx = colX - slotW / 2 - GAP - LOOK_W;      // the line closes up to whatever word is in the slot
  set($('lookText'), { x: lx.toFixed(1), y: ly });
  let ln = 0;
  LOOK_BURSTS.forEach(([c0, c1], b) => {
    for (let k = c0; k < c1; k++) {
      const tk = burstT[b] + (k - c0) * 0.006;
      const a = prog(t, tk, tk + 0.06);
      lSpans[k].setAttribute('fill-opacity', t < tk ? 0 : (0.3 + 0.7 * a).toFixed(3));
      if (t >= tk) ln = Math.max(ln, k + 1);
    }
  });
  if (t >= burstT[0]) lSpans[11].setAttribute('fill-opacity', 1);

  // The drum: items above and below the slot shrink, squash and fade with distance.
  WHEEL.forEach((word, k) => {
    const d = k - wp, th = clamp(d * 0.5, -1.45, 1.45);
    let yc = capC + 2.5 * S_ * Math.sin(th);
    const sc = 0.6 + 0.4 * Math.cos(th), sy = 0.82 + 0.18 * Math.cos(th);
    let op = clamp(Math.cos(th) * 1.25 - 0.25);
    if (k === 0) op *= prog(t, houseT, houseT + 0.06) * (0.3 + 0.7 * prog(t, houseT, houseT + 0.06));
    else {
      // the options unfurl from the slot once the line has been selected
      const u = E.outCubic(prog(t, W0 - 0.2 + 0.05 * (k - 1), W0 + 0.02 + 0.05 * (k - 1)));
      yc = lerp(capC + 0.6 * S_, yc, u);
      op *= u;
    }
    set(wheelEls[k], {
      transform: `translate(${colX.toFixed(1)} ${yc.toFixed(1)}) scale(${sc.toFixed(4)} ${(sc * sy).toFixed(4)}) translate(0 ${(0.35 * S_).toFixed(2)})`,
      'fill-opacity': op.toFixed(3),
      fill: mixHex('#2C281E', '#8E8980', clamp(Math.abs(d) / 2)),
    });
  });

  // Selection: first it steps back over the whole line, then it lifts as the wheel unfurls;
  // after the wheel settles it steps back over Land on the measured hit.
  const capTop = ly - S_ * 0.78, selH = S_ * 1.02;
  const wordStarts = [lx + LOOK_X[12], lx + LOOK_X[8], lx];          // A, FOR, LOOKING
  const SW0 = houseT + 0.14;
  const nWords = t < SW0 ? 0 : Math.min(4, 1 + Math.floor((t - SW0) / 0.06));
  let selL = 0, selR = 0, selOp = 0;
  if (t < W0 - 0.05) {
    selR = colX + WORD_W[0] / 2;
    selL = nWords === 0 ? selR : nWords === 1 ? colX - WORD_W[0] / 2 : wordStarts[nWords - 2];
    selOp = 1 - E.inOutSine(prog(t, W0 - 0.24, W0 - 0.08));
  } else {
    const SEL0 = T.highlight - 0.06, STEP = 0.04;
    const nSel = t < SEL0 ? 0 : Math.min(4, 1 + Math.floor((t - SEL0) / STEP));
    const landL = colX - WORD_W[WHEEL_STOP] / 2;
    selR = landL + LAND_X[4];
    selL = landL + LAND_X[4 - nSel];
    selOp = 1;
  }
  const selW = selR - selL > 0.5 ? selR - selL + 8 : 0;     // nothing selected: no box at all
  set($('lookSel'), { x: (selL - 4).toFixed(1), y: capTop.toFixed(1), width: selW.toFixed(1), height: selH.toFixed(1), 'fill-opacity': selOp.toFixed(3) });
  // Caret: follows the typing, then sits after HOUSE until the selection starts.
  const caretX = t < houseT ? lx + LOOK_X[ln] + 6 : colX + WORD_W[0] / 2 + 6;
  const doneT = houseT + 0.03;
  const blinkOn = t < doneT || Math.floor((t - doneT) * 3.2) % 2 === 0;
  set($('lookCaret'), { x: caretX.toFixed(1), y: (ly - S_ * 0.84).toFixed(1), height: (S_ * 1.04).toFixed(1),
    opacity: t >= burstT[0] - 0.12 && t < SW0 && blinkOn ? 1 : 0 });

  // ---------------- Scene B: search pill drops in over the sky (2.84-4.95)
  show($('sceneB'), t >= T.whip - 0.1 && t < T.click + 0.2);
  const pillU = settleHit(t, T.whip - 0.02, T.pill_land, 0.024, 0.6);
  const pillDrift = 26 * E.inOutSine(prog(t, T.pill_land + 0.2, T.click - 0.5));
  const py = lerp(-220, PILL.y, pillU) + pillDrift;
  const colU = E.inOutCubic(prog(t, T.click - 0.48, T.click - 0.30));
  const btnX0 = PILL.x + PILL.w + 24 + BTN_R;
  const pillL = lerp(PILL.x, btnX0 - BTN_R, colU);
  const pillWd = lerp(PILL.w, BTN_R * 2, colU);
  set($('pillRect'), { x: pillL, y: py - PILL.h / 2, width: pillWd, height: PILL.h, rx: PILL.h / 2 });
  set($('pillClipRect'), { x: pillL + 2, y: py - PILL.h / 2, width: Math.max(0, pillWd - 4), height: PILL.h, rx: PILL.h / 2 });
  show($('pill'), colU < 0.999);

  const qx = PILL.x + 122;
  set($('query'), { x: (qx + (pillL - PILL.x)).toFixed(1), y: (py + 16).toFixed(1) });
  const Q_T0 = T.pill_land + 0.1;
  const typedN = typeChars(qSpans, t, Q_T0, 0.02);
  const typingDone = Q_T0 + QUERY.length * 0.02;
  const caretOn = t < typingDone + 0.02 || Math.floor((t - typingDone) * 3.2) % 2 === 1;
  set($('queryCaret'), { x: (qx + (pillL - PILL.x) + typedN * QW + 3).toFixed(1), y: (py - 28).toFixed(1), opacity: t >= Q_T0 - 0.06 && caretOn ? 1 : 0 });

  // Button: drops with the pill (a beat of follow-through), then takes the stage.
  const btnDropU = settleHit(t, T.whip + 0.01, T.pill_land + 0.03, 0.03, 0.6);
  const by0 = lerp(-220, PILL.y, btnDropU) + pillDrift;
  const travU = E.inOutCubic(prog(t, T.click - 0.40, T.click - 0.12));
  let bx = lerp(btnX0, CX, travU), by = lerp(by0, 1010, travU);
  let br = lerp(BTN_R, 96, travU);
  const press = 1 - 0.14 * E.inQuad(prog(t, T.click - 0.08, T.click));
  const release = settle(prog(t, T.click, T.click + 0.24), 0.045, 0.45);
  const bk = t < T.click ? press : lerp(0.86, 1, release);
  br *= bk * (1 - E.inCubic(prog(t, T.click + 0.03, T.click + 0.17)));
  set($('btnCircle'), { cx: bx.toFixed(1), cy: by.toFixed(1), r: br.toFixed(2) });
  const arrowK = 1 - E.inOutCubic(prog(t, T.click - 0.44, T.click - 0.34));
  set($('btnArrow'), { transform: `translate(${bx.toFixed(1)} ${by.toFixed(1)}) scale(${(arrowK * br / BTN_R).toFixed(3)})`, opacity: arrowK > 0.01 ? 1 : 0 });

  // Second mark: the pill's icon, then it rides the collapse and becomes the button's face.
  const iconTarget = [PILL.x + 72, py];
  let hub = iconTarget, S = 1.75;
  if (t >= T.click - 0.48) {
    hub = [lerp(iconTarget[0], btnX0, colU), py];
    S = lerp(1.75, 1.9, colU);
    if (t >= T.click - 0.40) { hub = [bx, by]; S = lerp(1.9, 3.1, travU) * bk * (1 - E.inCubic(prog(t, T.click + 0.04, T.click + 0.22))); }
  }
  const markWhite = E.inOutCubic(prog(t, T.click - 0.38, T.click - 0.26));
  set($('markArms'), { fill: mixHex('#0F68D8', '#FFFFFF', markWhite) });
  set($('mark'), { transform: `translate(${hub[0].toFixed(2)} ${hub[1].toFixed(2)}) scale(${S.toFixed(4)}) translate(${-HUB[0]} ${-HUB[1]})` });
  show($('mark'), t < T.click + 0.23);

  // Cursor glides in, presses on the measured click, then leaves.
  show($('cursor'), t >= T.click - 0.46 && t < T.click + 0.31);
  const cu = E.outCubic(prog(t, T.click - 0.46, T.click - 0.07));
  const p0 = [1130, 1720], p1 = [930, 1200], p2 = [CX + 14, 1010 + 18];
  const cxp = (1 - cu) * (1 - cu) * p0[0] + 2 * (1 - cu) * cu * p1[0] + cu * cu * p2[0];
  const cyp = (1 - cu) * (1 - cu) * p0[1] + 2 * (1 - cu) * cu * p1[1] + cu * cu * p2[1];
  const ck = t < T.click ? 1 - 0.1 * E.inQuad(prog(t, T.click - 0.08, T.click)) : lerp(0.9, 1, release);
  const exitU = E.inCubic(prog(t, T.click + 0.06, T.click + 0.3));
  set($('cursor'), { transform: `translate(${(cxp + 260 * exitU).toFixed(1)} ${(cyp + 520 * exitU).toFixed(1)}) scale(${(1.25 * ck).toFixed(3)})` });

  // (the old paper reveal is parked with the old story)
  show($('reveal'), false);

  // ---------------- Scene W: the world transition (4.52-10.50)
  const W_ON = t >= T.click + 0.02 && t < T.photo1;
  const cam = W_ON ? earthCam(t) : null;
  show($('sceneW'), W_ON);
  if (W_ON) worldOverlay(t, cam);

  // ---------------- Scene D1: map, title, pin (4.94-6.93)
  const holeU = prog(t, T.terrain - 0.18, T.terrain + 0.42);
  const dOn = t >= T.map - 0.06 && holeU < 1;
  show($('sceneD'), dOn);
  // Detach the mask whenever the hole is not opening.
  if (holeU > 0 && dOn) $('sceneD').setAttribute('mask', 'url(#holeMask)');
  else $('sceneD').removeAttribute('mask');

  // Map title types in at the top; IBADAN is highlighted as the pin lands on it.
  const tx = CX - (TITLE.length * TW) / 2;
  set($('title'), { transform: `translate(${CX} 330) scale(0.82) translate(${-CX} ${-985})` });
  set($('titleText'), { x: tx.toFixed(1), y: 985 });
  const TITLE_T0 = T.map + 0.02;
  const tn = typeChars(tSpans, t, TITLE_T0, 0.018);
  const titleDone = TITLE_T0 + TITLE.length * 0.018;
  const tCaret = (t < titleDone + 0.02 || Math.floor((t - titleDone) * 3.2) % 2 === 1) && t < T.pin - 0.06;
  set($('titleCaret'), { x: (tx + tn * TW + 4).toFixed(1), y: 985 - 50, opacity: t >= TITLE_T0 - 0.04 && tCaret ? 1 : 0 });
  const hu = E.outCubic(prog(t, T.pin - 0.04, T.pin + 0.14));
  const hlW = (6 * TW + 20) * hu;
  set($('hlRect'), { x: tx - 10, y: 985 - 52, width: hlW.toFixed(1), height: 70 });

  // Map: states ripple out from Ibadan, Oyo fills from the city, camera dives in.
  const zoomU = E.inOutCubic(prog(t, T.oyo + 0.06, T.terrain + 0.35));
  const z = Math.exp(lerp(Math.log(Z0), Math.log(3.4), zoomU));
  const ib0 = [MAP_SCREEN[0] + (IB[0] - MAP_C[0]) * Z0, MAP_SCREEN[1] + (IB[1] - MAP_C[1]) * Z0];
  const ibS = [lerp(ib0[0], CX, zoomU), lerp(ib0[1], 1010, zoomU)];
  const mc = [IB[0] - (ibS[0] - CX) / z, IB[1] - (ibS[1] - 1010) / z];
  set($('map'), { transform: `translate(${CX} 1010) scale(${z.toFixed(5)}) translate(${(-mc[0]).toFixed(3)} ${(-mc[1]).toFixed(3)})` });
  show($('map'), t >= T.map - 0.06);
  set($('states'), { 'stroke-width': (1.6 / z).toFixed(4) });
  for (const s of states) {
    const u = E.outCubic(prog(t, T.map - 0.06 + (s.dist / maxDist) * 0.3, T.map + 0.36 + (s.dist / maxDist) * 0.3));
    s.el.setAttribute('stroke-dashoffset', (1 - u).toFixed(4));
  }
  set($('country'), { 'stroke-width': (3.2 / z).toFixed(4), 'stroke-dashoffset': (1 - E.inOutCubic(prog(t, T.map, T.map + 0.6))).toFixed(4) });
  const oyoR = 260 * E.outCubic(prog(t, T.oyo - 0.05, T.oyo + 0.34));
  set($('oyoClipCircle'), { cx: IB[0], cy: IB[1], r: oyoR.toFixed(2) });
  set($('oyoEdge'), { 'stroke-width': (2.4 / z).toFixed(4), opacity: oyoR > 0 ? 1 : 0, 'clip-path': 'url(#oyoClip)' });

  // Pin drops onto Ibadan on the measured hit; coordinates tag types out.
  const pinU = settleHit(t, T.pin - 0.2, T.pin, 0.0, 0.6);
  const pinSettle = t < T.pin ? 0 : -10 * Math.sin(Math.PI * prog(t, T.pin, T.pin + 0.16));
  show($('pin'), t >= T.pin - 0.2);
  set($('pin'), { transform: `translate(${ibS[0].toFixed(1)} ${(ibS[1] - 150 * (1 - Math.min(1, pinU)) + pinSettle).toFixed(1)})` });
  const ringU = prog(t, T.pin, T.pin + 0.5);
  set($('pinRing'), { r: (17 + 60 * E.outCubic(ringU)).toFixed(1), opacity: (ringU > 0 ? 1 - ringU : 0).toFixed(3) });
  const tagU = E.outExpo(prog(t, T.pin + 0.04, T.pin + 0.32));
  const tagW = (PINTXT.length * PW + 48) * tagU;
  show($('pinLabel'), tagU > 0);
  set($('pinLabel'), { transform: `translate(${(ibS[0] + 36).toFixed(1)} ${ibS[1].toFixed(1)})` });
  set($('pinLabelBg'), { width: tagW.toFixed(1) });
  set($('pinLabelText'), { x: 24 });
  typeChars(pSpans, t, T.pin + 0.1, 0.017);

  // Organic hole opens at the pin onto the land.
  const holeR = 2300 * E.inCubic(holeU) + 60 * E.outCubic(holeU);
  set($('holePath'), { d: holeU > 0 ? blob(ibS[0], ibS[1], holeR, t) : '' });

  // ---------------- Scene P: real estate photos with punch-in and pull-out zooms (12.0-18.3)
  const pOn = t >= T.photo1 - 0.001 && t < T.offer + 0.35;
  show($('sceneP'), pOn);
  if (pOn) {
    let cur = SHOTS[0];
    for (const sh of SHOTS) if (t >= T[sh.at]) cur = sh;
    for (const sh of SHOTS) { show(sh.band, sh === cur); show(sh.bg, sh === cur); }
    const st = shotState(cur, Math.min(t, T.offer));
    const bw = PHOTO_W * bandScale, bh = PHOTO_H * bandScale;
    const fx = cur.focus[0] * bw + (W - bw) / 2, fy = BAND.y + cur.focus[1] * bh + (BAND.h - bh) / 2;
    set(cur.band, { transform: `translate(${(fx + st.pan).toFixed(2)} ${fy.toFixed(2)}) scale(${st.z.toFixed(5)}) translate(${(-fx).toFixed(2)} ${(-fy).toFixed(2)}) translate(${((W - bw) / 2).toFixed(2)} ${(BAND.y + (BAND.h - bh) / 2).toFixed(2)}) scale(${bandScale.toFixed(5)})` });
    set($('photoBlurK'), { stdDeviation: st.blur.toFixed(2) });
    const gw = PHOTO_W * bgScale;
    set(cur.bg, { transform: `translate(${(W / 2).toFixed(1)} ${(H / 2).toFixed(1)}) scale(${(1 + 0.4 * (st.z - 1)).toFixed(4)}) translate(${(-W / 2).toFixed(1)} ${(-H / 2).toFixed(1)}) translate(${((W - gw) / 2).toFixed(1)} 0) scale(${bgScale.toFixed(5)})` });
    // caption: these photos are The Monarch's Court, Epe, not Ariya Springs
    const capU = E.outExpo(prog(t, T.photo1 + 0.3, T.photo1 + 0.65));
    set($('captionBg'), { x: 32, y: BAND.y + BAND.h - 92, width: ((CAPTION_W + 52) * capU).toFixed(1) });
    set($('captionText'), { x: 58, y: BAND.y + BAND.h - 49, 'fill-opacity': clamp((capU - 0.6) / 0.4).toFixed(3) });
    // headlines slide up on the beat and leave just before the cut
    for (const sh of SHOTS) {
      const t0 = T[sh.at], t1 = T[sh.next];
      sh.lineEls.forEach((el, i) => {
        const inU = E.outExpo(prog(t, t0 + 0.2 + 0.08 * i, t0 + 0.55 + 0.08 * i));
        const outU = E.inCubic(prog(t, t1 - 0.22 + 0.04 * i, t1 - 0.04 + 0.04 * i));
        const dy = 130 * (1 - inU) - 130 * outU;
        el.setAttribute('transform', `translate(0 ${dy.toFixed(1)})`);
        el.style.display = sh === cur ? '' : 'none';
      });
    }
    show($('soldTag'), false);
    // white flash bridging each cut
    let fl = 0.85 * (1 - prog(t, T.photo1, T.photo1 + 0.16));
    for (const k of ['photo2', 'photo3', 'photo4']) fl = Math.max(fl, 0.35 * E.inCubic(prog(t, T[k] - 0.06, T[k])) * (t < T[k] ? 1 : 0), 0.35 * (1 - prog(t, T[k], T[k] + 0.12)) * (t >= T[k] ? 1 : 0));
    set($('flash'), { opacity: fl.toFixed(3) });
  }
  // flash from the world dive into the first photo (flash is its own top layer)
  if (t >= T.photo1 - 0.15 && t < T.photo1) set($('flash'), { opacity: (0.85 * E.inCubic(prog(t, T.photo1 - 0.15, T.photo1))).toFixed(3) });
  else if (!pOn) set($('flash'), { opacity: 0 });

  // ---------------- Scene O: the Ariya Springs offer on brand blue (18.0-20.3)
  const oOn = t >= T.offer - 0.12 && t < T.cta + 0.35;
  show($('sceneO'), oOn);
  if (oOn) {
    set($('offerWipe'), { r: (1400 * E.inOutCubic(prog(t, T.offer - 0.12, T.offer + 0.28))).toFixed(1) });
    const up = (a, b, d) => d * (1 - E.outExpo(prog(t, a, b)));
    const offerDrift = 1 + 0.03 * E.inOutSine(prog(t, T.offer + 0.3, T.cta));
    set($('offerText'), { transform: `translate(540 920) scale(${offerDrift.toFixed(4)}) translate(-540 -920)` });
    set($('offerKicker'), { y: (760 + up(T.offer + 0.15, T.offer + 0.5, 70)).toFixed(1) });
    set($('offerTitle'), { y: (920 + up(T.offer + 0.25, T.offer + 0.62, 170)).toFixed(1) });
    set($('offerPrice'), { y: (1040 + up(T.offer + 0.4, T.offer + 0.76, 90)).toFixed(1) });
  }

  // ---------------- Scene CTA: logo, line, button, URL (20.0-24.0)
  const cOn = t >= T.cta - 0.12;
  show($('sceneCTA'), cOn);
  if (cOn) {
    set($('ctaWipe'), { r: (1400 * E.inOutCubic(prog(t, T.cta - 0.12, T.cta + 0.28))).toFixed(1) });
    // the mark assembles again, echoing the opening
    const ls2 = LOCK2.s * (1 + 0.02 * E.inOutSine(prog(t, T.cta_settle, DURATION)));
    const hub2 = [LOCK2.cx + (HUB[0] - LOCK.cx) * ls2, LOCK2.cy + (HUB[1] - LOCK.cy) * ls2];
    const spin2 = -38 * (1 - E.outExpo(prog(t, T.cta + 0.05, T.cta_settle)));
    const sc2 = ls2 * (0.92 + 0.08 * settle(prog(t, T.cta + 0.05, T.cta_settle + 0.2), 0.04, 0.7));
    set($('ctaMark'), { transform: `translate(${hub2[0].toFixed(2)} ${hub2[1].toFixed(2)}) scale(${sc2.toFixed(4)}) rotate(${spin2.toFixed(2)}) translate(${-HUB[0]} ${-HUB[1]})` });
    ARM_ORDER.forEach((i, k) => {
      const u = E.outExpo(prog(t, T.cta + 0.05 + k * 0.03, T.cta_settle));
      const off = (420 / ls2) * (1 - u);
      ctaArms[i].setAttribute('transform', `translate(${(ARMS[i].dir[0] * off).toFixed(3)} ${(ARMS[i].dir[1] * off).toFixed(3)})`);
    });
    set($('ctaWordmark'), { transform: `translate(${(LOCK2.cx - LOCK.cx * ls2).toFixed(2)} ${(LOCK2.cy - LOCK.cy * ls2).toFixed(2)}) scale(${ls2.toFixed(4)})` });
    set($('ctaLand'), { y: (18.405 + 19 * (1 - E.outExpo(prog(t, T.cta_settle - 0.05, T.cta_settle + 0.35)))).toFixed(3) });
    set($('ctaRep'), { y: (34.913 + 21 * (1 - E.outExpo(prog(t, T.cta_settle + 0.03, T.cta_settle + 0.43)))).toFixed(3) });
    set($('ctaLine'), { y: (1040 + 80 * (1 - E.outExpo(prog(t, T.cta + 0.75, T.cta + 1.1)))).toFixed(1) });
    const pop = settle(prog(t, T.cta + 0.95, T.cta + 1.4), 0.06, 0.6);
    const ctaPress = t < T.tap ? 1 - 0.06 * E.inQuad(prog(t, T.tap - 0.08, T.tap)) : lerp(0.94, 1, settle(prog(t, T.tap, T.tap + 0.25), 0.03, 0.5));
    set($('ctaButton'), { transform: `translate(540 1220) scale(${(Math.max(0.001, pop) * ctaPress).toFixed(4)})` });
    set($('ctaUrl'), { y: (1400 + 70 * (1 - E.outExpo(prog(t, T.cta + 1.2, T.cta + 1.55)))).toFixed(1) });
    // a cursor taps the button on the beat, echoing the search
    const cu3 = E.outCubic(prog(t, T.tap - 0.6, T.tap - 0.07));
    const cx3 = lerp(1150, 660, cu3), cy3 = lerp(1700, 1242, cu3);
    const exit3 = E.inCubic(prog(t, T.tap + 0.25, T.tap + 0.6));
    const ck3 = t < T.tap ? 1 - 0.1 * E.inQuad(prog(t, T.tap - 0.08, T.tap)) : lerp(0.9, 1, prog(t, T.tap, T.tap + 0.2));
    show($('ctaCursor'), t >= T.tap - 0.6 && exit3 < 1);
    set($('ctaCursor'), { transform: `translate(${(cx3 + 200 * exit3).toFixed(1)} ${(cy3 + 500 * exit3).toFixed(1)}) scale(${(1.25 * ck3).toFixed(3)})` });
  }

  // ---------------- GL plates
  let glState = null;
  if (t >= T.whip - 0.18 && t < T.click + 0.6) {
    const u = prog(t, T.whip - 0.18, T.click + 0.6);
    glState = { mode: 0, camH: lerp(700, 380, E.inOutSine(u)), pitch: lerp(0.05, 0.17, E.inOutSine(u)), travel: t * 160 };
    if (W_ON) {
      // the button opens onto space: earth inside a growing circle, sky outside
      const ru = E.inOutCubic(prog(t, T.click + 0.02, T.click + 0.42));
      glState = { ...glState, mode: 3, earth: { ...cam.gl, reveal: [CX, H - 1010, 2300 * ru] } };
    }
  } else if (W_ON) {
    glState = { mode: 2, earth: { ...cam.gl, reveal: [0, 0, -1] } };
  } else if (t >= T_LAND0 - 0.02) {
    const L = landCam(t);
    const wu2 = prog(t, T_LAND0, T.terrain + 0.42);
    glState = { mode: 1, px: L.px, rot: L.rot, cam: L.cam, wisp: Math.pow(Math.sin(Math.PI * wu2), 0.7) * 0.95, wispZ: wu2, expose: 1 };
  }
  $('gl').style.visibility = glState ? 'visible' : 'hidden';
  if (glState) drawGL(glState);

  // ---------------- Scene E: survey, chosen plot, property card (6.80-9.00)
  show($('sceneE'), t >= T.terrain + 0.3);
  if (t >= T.terrain + 0.3) {
    const L = landCam(t);
    set($('survey'), {
      transform: `translate(${CX} ${CY}) rotate(${(-L.rot * 180 / Math.PI).toFixed(4)}) scale(${L.px.toFixed(5)}) translate(${(-L.cam[0]).toFixed(4)} ${(-L.cam[1]).toFixed(4)})`,
      'stroke-width': (2.4 / L.px).toFixed(5),
    });
    const s0 = 6.86;
    for (const o of plotEls) {
      const u = E.outCubic(prog(t, s0 + (o.d / maxPlotD) * 0.38, s0 + (o.d / maxPlotD) * 0.38 + 0.3));
      o.el.setAttribute('stroke-dashoffset', (1 - u).toFixed(4));
      o.el.setAttribute('stroke-opacity', 0.92);
    }
    const bs = 9 / L.px;
    for (const b of beaconEls) {
      // eight waves of beacons, on the sixteenth-note ticks of the score
      const wave = Math.min(7, Math.floor((b.d / maxBeaconD) * 8));
      const u = settle(prog(t, 6.875 + wave * 0.0625, 6.875 + wave * 0.0625 + 0.16), 0.25, 0.5);
      const k = bs * u;
      set(b.el, { x: (b.x - k / 2).toFixed(3), y: (b.y - k / 2).toFixed(3), width: k.toFixed(3), height: k.toFixed(3), 'stroke-width': (1.5 / L.px).toFixed(4) });
    }

    // The chosen plot: blue selection sweep, lift, everything else dims.
    const lift = settle(prog(t, T.plot, T.plot + 0.4), 0.06, 0.55);
    const k = 1 + 0.05 * lift;
    const cS = toScreen(L, SEL_C);
    const cornersS = [[SEL.x0, SEL.y0], [SEL.x1, SEL.y0], [SEL.x1, SEL.y1], [SEL.x0, SEL.y1]]
      .map(w => toScreen(L, w))
      .map(([x, y]) => [cS[0] + (x - cS[0]) * k, cS[1] + (y - cS[1]) * k - 10 * lift]);
    const pts = cornersS.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
    const selOn = t >= T.plot - 0.05;
    show($('selPlot'), selOn);
    set($('selFill'), { points: pts });
    set($('selEdge'), { points: pts, 'stroke-width': (5 * clamp(lift * 2)).toFixed(2) });
    const xs = cornersS.map(p => p[0]), ys = cornersS.map(p => p[1]);
    const bx0 = Math.min(...xs), bx1 = Math.max(...xs), by0b = Math.min(...ys), by1 = Math.max(...ys);
    const sw = E.outCubic(prog(t, T.plot - 0.05, T.plot + 0.22));
    set($('selClipRect'), { x: bx0 - 4, y: by0b - 4, width: ((bx1 - bx0 + 8) * sw).toFixed(1), height: by1 - by0b + 8 });
    set($('liftShadowK'), { dy: (20 * lift).toFixed(2), stdDeviation: (8 + 14 * lift).toFixed(2), 'flood-opacity': (0.4 * clamp(lift)).toFixed(3) });
    const labU = E.outExpo(prog(t, T.plot + 0.1, T.plot + 0.4));
    set($('selLabel'), { x: cS[0].toFixed(1), y: (cS[1] - 10 * lift + 12 + 20 * (1 - labU)).toFixed(1), opacity: labU.toFixed(3) });
    $('selLabel').textContent = '500 SQM';
    const dimU = E.inOutSine(prog(t, T.plot, T.plot + 0.35));
    set($('dim'), { opacity: (0.42 * dimU).toFixed(3) });
    set($('dimHole'), { points: pts });

    // Callout from the plot down to the card.
    const cardY = 1080;
    const cardDrop = settleHit(t, 7.68, T.card, 0.018, 0.6);
    const cy = lerp(1990, cardY, cardDrop);
    const startY = by1 + 6;
    const cu2 = E.inOutCubic(prog(t, 7.78, T.card + 0.04));
    const endY = lerp(startY, cy, cu2);
    set($('callout'), { d: t >= 7.78 ? `M${CX},${startY.toFixed(1)} L${CX},${endY.toFixed(1)}` : '' });
    set($('calloutDot'), { cx: CX, cy: startY.toFixed(1), r: (7 * E.outCubic(prog(t, 7.78, 7.9))).toFixed(2) });

    // Property card.
    show($('card'), t >= 7.68);
    set($('card'), { transform: `translate(${(W - 856) / 2} ${cy.toFixed(1)})` });
    const rev = (a, b) => E.outExpo(prog(t, a, b));
    const uT = rev(7.84, 8.2), uS = rev(7.92, 8.3), uP = rev(8.08, 8.46);
    set($('cardTitle'), { y: (138 + 110 * (1 - uT)).toFixed(1) });
    set($('cardTitleClipRect'), { x: 0, y: 40, width: 856, height: 124 });
    set($('cardSub'), { y: (200 + 60 * (1 - uS)).toFixed(1) });
    set($('cardSubClipRect'), { x: 0, y: 164, width: 856, height: 52 });
    const ruleU = E.inOutCubic(prog(t, 8.0, 8.4));
    set($('cardRule'), { x2: (58 + (856 - 116) * ruleU).toFixed(1) });
    set($('cardSize'), { y: (318 + 60 * (1 - uP)).toFixed(1) });
    set($('cardPrice'), { x: 798, y: (320 + 60 * (1 - uP)).toFixed(1) });
    set($('cardPriceClipRect'), { x: 0, y: 270, width: 856, height: 70 });

    // Small mark on the card re-assembles, echoing the opening.
    const cmS = 1.55;
    const cmSpin = -38 * (1 - E.outExpo(prog(t, 7.9, 8.35)));
    set($('cardMark'), { transform: `translate(${856 - 56 - 17 * cmS} ${44 + 18 * cmS}) scale(${cmS}) rotate(${cmSpin.toFixed(2)}) translate(${-HUB[0]} ${-HUB[1]})` });
    ARM_ORDER.forEach((i, kk) => {
      const u = E.outExpo(prog(t, 7.9 + kk * 0.03, 8.35));
      const off = 14 * (1 - u);
      set(cardArms[i], { transform: `translate(${(ARMS[i].dir[0] * off).toFixed(3)} ${(ARMS[i].dir[1] * off).toFixed(3)})`, opacity: u > 0 ? 1 : 0 });
    });
  }
}

window.DURATION = DURATION;
window.FPS = 30;
window.seek = seek;
window.ready = true;

// Preview player only outside render mode.
if (!new URLSearchParams(location.search).has('render')) {
  const start = performance.now();
  const loop = () => { seek(((performance.now() - start) / 1000) % DURATION); requestAnimationFrame(loop); };
  loop();
} else {
  seek(0);
}
