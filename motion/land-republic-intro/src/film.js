// Land Republic intro, 0:00-0:09, 1080x1920 @ 30 fps.
// window.seek(t) paints frame t from nothing. No transitions, timers or carried state.

import { createGL } from './gl.js';

const W = 1080, H = 1920, CX = 540, CY = 960;
const DURATION = 9;
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
const [BEATS, GEO] = await Promise.all([
  fetch('beats.json').then(r => r.json()),
  fetch('assets/geo.json').then(r => r.json()),
]);
const T = BEATS.hits;   // measured hit times (s), from audio/score.py
await document.fonts.load('800 40px Figtree');
await document.fonts.load('600 40px Figtree');
await document.fonts.load('500 40px "Plex Mono"');
await document.fonts.load('600 40px "Plex Mono"');
await document.fonts.load('500 40px "Plex Mono"', '₦');
await document.fonts.ready;

const drawGL = createGL($('gl'));

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
const TITLE = 'IBADAN, OYO STATE';
const PINTXT = '7.38°N, 3.93°E';
const qSpans = buildTyping($('query'), QUERY);
const tSpans = buildTyping($('titleText'), TITLE);
$('titleTextHi').textContent = TITLE;
const pSpans = buildTyping($('pinLabelText'), PINTXT);
const QW = $('query').getComputedTextLength() / QUERY.length;
const TW = $('titleText').getComputedTextLength() / TITLE.length;
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

// ------------------------------------------------------------------ contours
const contourEls = [0, 1, 2].map(i => {
  const el = document.createElementNS(NS, 'path');
  set(el, { pathLength: 1, 'stroke-dasharray': '1 1', opacity: [0.9, 0.6, 0.45][i] });
  $('contours').appendChild(el);
  return el;
});
function contourPath(y0, ph, amp) {
  let d = '';
  for (let x = -40; x <= W + 40; x += 30) {
    const y = y0 + amp * Math.sin(x * 0.0062 + ph) + amp * 0.4 * Math.sin(x * 0.017 + ph * 1.9);
    d += (x === -40 ? 'M' : 'L') + x + ',' + y.toFixed(1);
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

// ------------------------------------------------------------------ seek
const PILL = { x: 62, w: 800, h: 132, y: 640 };
const BTN_R = 66;

function seek(t) {
  t = clamp(t, 0, DURATION);
  // Rebuild the SVG render tree every frame. Chromium caches rasters of masked and
  // filtered groups and can repaint them stale in later frames; tearing the tree down
  // guarantees nothing painted for one frame survives into the next.
  const stage = $('stage');
  stage.style.display = 'none';
  void stage.getBoundingClientRect();
  stage.style.display = '';

  // ---------------- Scene A: the mark assembles, then the lockup forms (0.00-2.00)
  const whipU = prog(t, 1.84, 2.02);
  show($('sceneA'), t < 2.03);
  set($('sceneA'), { transform: `translate(0 ${(-2050 * E.inCubic(whipU)).toFixed(1)})` });
  set($('whipBlurK'), { stdDeviation: `0 ${(110 * E.inCubic(whipU)).toFixed(1)}` });

  // Mark scale with a small overshoot that peaks on the settle hit.
  const S0 = 12;
  const sIntro = S0 * (0.9 + 0.1 * settle(prog(t, 0.05, 0.05 + (T.mark_settle - 0.05) / 0.57), 0.04, 0.57));
  const moveU = E.inOutCubic(prog(t, 0.66, 1.16));
  const drift = 1 + 0.03 * E.inOutSine(prog(t, 1.1, 2.0));
  const LH = lockHub();
  let hub = [lerp(CX, LH[0], moveU), lerp(CY, LH[1], moveU)];
  let S = lerp(sIntro, LOCK.s, moveU);
  hub = [CX + (hub[0] - CX) * drift, CY + (hub[1] - CY) * drift];
  S *= drift;

  // Arms fly in along their own axes while the whole mark turns into place.
  const spin = -38 * (1 - E.outExpo(prog(t, 0, T.mark_settle)));
  ARM_ORDER.forEach((i, k) => {
    const u = E.outExpo(prog(t, k * 0.032, T.mark_settle));
    const off = (470 / S0) * (1 - u);
    markArms[i].setAttribute('transform', `translate(${(ARMS[i].dir[0] * off).toFixed(3)} ${(ARMS[i].dir[1] * off).toFixed(3)})`);
  });

  // Wordmark lines slide up out of their own baselines.
  const ls = LOCK.s * drift;
  set($('wordmark'), { transform: `translate(${(CX - LOCK.cx * ls).toFixed(2)} ${(CY - LOCK.cy * ls).toFixed(2)}) scale(${ls.toFixed(4)})` });
  const uL = E.outExpo(prog(t, T.wordmark - 0.05, T.wordmark + 0.4));
  const uR = E.outExpo(prog(t, T.wordmark + 0.03, T.wordmark + 0.48));
  set($('wmLand'), { y: (18.405 + 19 * (1 - uL)).toFixed(3) });
  set($('wmRep'), { y: (34.913 + 21 * (1 - uR)).toFixed(3) });
  set($('landClipRect'), { x: 38, y: 18.405 - 14.5, width: 80, height: 18.2 });
  set($('repClipRect'), { x: 38, y: 34.913 - 14.5, width: 80, height: 19 });

  // ---------------- Scene B: search pill drops in over the sky (1.84-3.50)
  show($('sceneB'), t >= 1.9 && t < 4.0);
  const pillU = settleHit(t, 1.98, T.pill_land, 0.024, 0.6);
  const pillDrift = 26 * E.inOutSine(prog(t, T.pill_land + 0.2, 3.1));
  const py = lerp(-220, PILL.y, pillU) + pillDrift;
  const colU = E.inOutCubic(prog(t, 3.04, 3.24));
  const btnX0 = PILL.x + PILL.w + 24 + BTN_R;
  const pillL = lerp(PILL.x, btnX0 - BTN_R, colU);
  const pillWd = lerp(PILL.w, BTN_R * 2, colU);
  set($('pillRect'), { x: pillL, y: py - PILL.h / 2, width: pillWd, height: PILL.h, rx: PILL.h / 2 });
  set($('pillClipRect'), { x: pillL + 2, y: py - PILL.h / 2, width: Math.max(0, pillWd - 4), height: PILL.h, rx: PILL.h / 2 });
  show($('pill'), colU < 0.999);

  const qx = PILL.x + 132;
  set($('query'), { x: qx, y: (py + 17).toFixed(1) });
  const typedN = typeChars(qSpans, t, 2.45, 0.026);
  const typingDone = 2.45 + QUERY.length * 0.026;
  const caretOn = t < typingDone + 0.02 || Math.floor((t - typingDone) * 3.2) % 2 === 1;
  set($('queryCaret'), { x: (qx + typedN * QW + 3).toFixed(1), y: (py - 30).toFixed(1), opacity: t >= 2.3 && caretOn ? 1 : 0 });

  // Button: drops with the pill (a beat of follow-through), then takes the stage.
  const btnDropU = settleHit(t, 2.01, T.pill_land + 0.03, 0.03, 0.6);
  const by0 = lerp(-220, PILL.y, btnDropU) + pillDrift;
  const travU = E.inOutCubic(prog(t, 3.12, 3.42));
  let bx = lerp(btnX0, CX, travU), by = lerp(by0, 1010, travU);
  let br = lerp(BTN_R, 96, travU);
  const press = 1 - 0.14 * E.inQuad(prog(t, T.click - 0.08, T.click));
  const release = settle(prog(t, T.click, T.click + 0.24), 0.045, 0.45);
  const bk = t < T.click ? press : lerp(0.86, 1, release);
  br *= bk;
  set($('btnCircle'), { cx: bx.toFixed(1), cy: by.toFixed(1), r: br.toFixed(2) });
  const arrowK = 1 - E.inOutCubic(prog(t, 3.08, 3.2));
  set($('btnArrow'), { transform: `translate(${bx.toFixed(1)} ${by.toFixed(1)}) scale(${(arrowK * br / BTN_R).toFixed(3)})`, opacity: arrowK > 0.01 ? 1 : 0 });

  // The mark travels from the lockup into the pill, then rides the collapse into the button.
  if (t >= 1.84) {
    const flyU = E.inOutCubic(prog(t, 1.84, T.pill_land));
    const iconTarget = [PILL.x + 72, py];
    const iconS = 1.75;
    hub = [lerp(hub[0], iconTarget[0], flyU), lerp(hub[1], iconTarget[1], flyU)];
    S = lerp(S, iconS, flyU);
    if (t >= 3.04) {
      const rideU = colU;
      hub = [lerp(iconTarget[0], btnX0, rideU), py];
      S = lerp(iconS, 1.9, rideU);
      if (t >= 3.12) { hub = [bx, by]; S = lerp(1.9, 3.1, travU) * bk * (1 - E.inCubic(prog(t, T.click + 0.04, T.click + 0.22))); }
    }
  }
  const markWhite = E.inOutCubic(prog(t, 3.14, 3.26));
  set($('markArms'), { fill: mixHex('#0F68D8', '#FFFFFF', markWhite) });
  set($('mark'), { transform: `translate(${hub[0].toFixed(2)} ${hub[1].toFixed(2)}) scale(${S.toFixed(4)}) rotate(${spin.toFixed(3)}) translate(${-HUB[0]} ${-HUB[1]})` });
  show($('mark'), t < T.click + 0.23);

  // Cursor glides in, presses on the measured click.
  show($('cursor'), t >= 3.1 && t < T.click + 0.43);
  const cu = E.outCubic(prog(t, 3.1, T.click - 0.07));
  const p0 = [1130, 1720], p1 = [930, 1200], p2 = [CX + 14, 1010 + 18];
  const cxp = (1 - cu) * (1 - cu) * p0[0] + 2 * (1 - cu) * cu * p1[0] + cu * cu * p2[0];
  const cyp = (1 - cu) * (1 - cu) * p0[1] + 2 * (1 - cu) * cu * p1[1] + cu * cu * p2[1];
  const ck = t < T.click ? 1 - 0.1 * E.inQuad(prog(t, T.click - 0.08, T.click)) : lerp(0.9, 1, release);
  const exitU = E.inCubic(prog(t, T.click + 0.12, T.click + 0.42));
  set($('cursor'), { transform: `translate(${(cxp + 260 * exitU).toFixed(1)} ${(cyp + 520 * exitU).toFixed(1)}) scale(${(1.25 * ck).toFixed(3)})` });

  // ---------------- Scene C: blue flood, light wave (3.50-4.75)
  show($('sceneC'), t >= T.click && t < 4.76);
  const fu = E.inOutCubic(prog(t, T.click + 0.02, T.flood - 0.02));
  set($('flood'), {
    cx: CX, cy: 1010, r: lerp(96, 2250, fu).toFixed(1),
    fill: mixHex('#0F68D8', '#0B2E63', E.inOutSine(prog(t, T.flood, T.flood + 0.3))),
  });
  const wu = E.inOutCubic(prog(t, T.flood + 0.04, 4.7));
  const wy = lerp(2180, -280, wu);
  const amp = 150 * (1 - 0.45 * wu), ph = 1.2 + 2.6 * wu;
  let wd = `M-100,2300 L-100,${wy}`;
  for (let x = -100; x <= W + 100; x += 30) {
    const y = wy + amp * Math.sin((x / 1300) * Math.PI * 2 + ph) + amp * 0.42 * Math.sin((x / 610) * Math.PI * 2 + ph * 1.7);
    wd += ` L${x},${y.toFixed(1)}`;
  }
  wd += ` L${W + 100},2300 Z`;
  set($('wave'), { d: wd });

  // ---------------- Scene D1: typed line, map, pin (4.00-6.70)
  const holeU = prog(t, T.terrain - 0.18, T.terrain + 0.42);
  const dOn = t >= T.flood && holeU < 1;
  show($('sceneD'), dOn);
  // Detach the mask whenever the hole is not opening: Chromium otherwise keeps a
  // stale raster of the masked group and can paint it into later frames.
  if (holeU > 0 && dOn) $('sceneD').setAttribute('mask', 'url(#holeMask)');
  else $('sceneD').removeAttribute('mask');
  show($('mapPaper'), t >= 4.69);
  show($('mapGrain'), t >= 4.69);

  // contour lines behind the typed line, drawn left to right then drawn off
  const cIn = E.outCubic(prog(t, 4.25, 4.9));
  const cOut = E.inOutCubic(prog(t, T.map, T.map + 0.45));
  contourEls.forEach((el, i) => {
    set(el, {
      d: contourPath(940 + i * 54 - 400 * cOut, 0.6 * t + i * 0.9, 20 + i * 4),
      'stroke-dashoffset': (cIn < 1 ? 1 - cIn : -cOut).toFixed(4),
    });
  });

  // typed line, then it rises to become the map's title
  const tx = CX - (TITLE.length * TW) / 2;
  const tUp = E.inOutCubic(prog(t, T.map, T.map + 0.45));
  const ty = lerp(985, 330, tUp), tk = lerp(1, 0.82, tUp);
  set($('title'), { transform: `translate(${CX} ${ty.toFixed(1)}) scale(${tk.toFixed(4)}) translate(${-CX} ${-985})` });
  set($('titleText'), { x: tx.toFixed(1), y: 985 });
  set($('titleTextHi'), { x: tx.toFixed(1), y: 985 });
  const tn = typeChars(tSpans, t, 4.30, 0.026);
  const titleDone = 4.30 + TITLE.length * 0.026;
  const tCaret = (t < titleDone + 0.02 || Math.floor((t - titleDone) * 3.2) % 2 === 1) && t < T.highlight - 0.06;
  set($('titleCaret'), { x: (tx + tn * TW + 4).toFixed(1), y: 985 - 50, opacity: t >= 4.26 && tCaret ? 1 : 0 });
  const hu = E.outCubic(prog(t, T.highlight - 0.07, T.highlight + 0.12));
  const hlW = (6 * TW + 20) * hu;
  set($('hlRect'), { x: tx - 10, y: 985 - 52, width: hlW.toFixed(1), height: 70 });
  set($('hlClipRect'), { x: tx - 10, y: 985 - 52, width: hlW.toFixed(1), height: 70 });

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

  // ---------------- GL plates
  let glState = null;
  if (t >= 1.8 && t < 3.99) {
    const u = prog(t, 1.8, 3.99);
    glState = { mode: 0, camH: lerp(700, 380, E.inOutSine(u)), pitch: lerp(0.05, 0.17, E.inOutSine(u)), travel: t * 160 };
  } else if (t >= T_LAND0 - 0.02) {
    const L = landCam(t);
    const wu2 = prog(t, T_LAND0, T.terrain + 0.42);
    glState = { mode: 1, px: L.px, rot: L.rot, cam: L.cam, wisp: Math.pow(Math.sin(Math.PI * wu2), 0.7) * 0.95, wispZ: wu2, expose: 1 };
  }
  $('gl').style.visibility = glState ? 'visible' : 'hidden';
  if (glState) drawGL(glState);

  // ---------------- Scene E: survey, chosen plot, property card (6.80-9.00)
  show($('sceneE'), t >= 6.8);
  if (t >= 6.8) {
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
    const uT = rev(7.92, 8.3), uS = rev(8.0, 8.38), uP = rev(8.16, 8.54);
    set($('cardTitle'), { y: (138 + 110 * (1 - uT)).toFixed(1) });
    set($('cardTitleClipRect'), { x: 0, y: 40, width: 856, height: 124 });
    set($('cardSub'), { y: (200 + 60 * (1 - uS)).toFixed(1) });
    set($('cardSubClipRect'), { x: 0, y: 164, width: 856, height: 52 });
    const ruleU = E.inOutCubic(prog(t, 8.08, 8.46));
    set($('cardRule'), { x2: (58 + (856 - 116) * ruleU).toFixed(1) });
    set($('cardSize'), { y: (318 + 60 * (1 - uP)).toFixed(1) });
    set($('cardPrice'), { x: 798, y: (320 + 60 * (1 - uP)).toFixed(1) });
    set($('cardPriceClipRect'), { x: 0, y: 270, width: 856, height: 70 });

    // Small mark on the card re-assembles, echoing the opening.
    const cmS = 1.55;
    const cmSpin = -38 * (1 - E.outExpo(prog(t, 7.95, 8.4)));
    set($('cardMark'), { transform: `translate(${856 - 56 - 17 * cmS} ${44 + 18 * cmS}) scale(${cmS}) rotate(${cmSpin.toFixed(2)}) translate(${-HUB[0]} ${-HUB[1]})` });
    ARM_ORDER.forEach((i, kk) => {
      const u = E.outExpo(prog(t, 7.95 + kk * 0.03, 8.4));
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
