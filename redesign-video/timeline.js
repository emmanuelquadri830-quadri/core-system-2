// Deterministic timeline: every frame is a pure function of t (seconds),
// so the renderer can seek to any frame and get the same picture.

let DURATION = 46;
let FLOWER_LEN = 0;
const $ = (id) => document.getElementById(id);
buildApp($('appHost'));
const S0 = 0.95;              // phone scale in world space
const PX0 = 122;              // world x of app x=0
const PY0 = 553 + S0 * 147;   // world y of app y=0 (body top + frame + status bar)
const APP_BOTTOM_WORLD = PY0 + S0 * 1296;
const CX = 540, CY = 960;

// ---------- easing ----------
const E = {
  lin: (t) => t,
  io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  io2: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  o: (t) => 1 - Math.pow(1 - t, 3),
  o4: (t) => 1 - Math.pow(1 - t, 4),
  i: (t) => t * t * t,
  back: (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  expo: (t) => (t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  step: (t) => (t < 1 ? 0 : 1),
};

// ---------- tracks ----------
const T = {};
function init(name, v) { T[name] = [[0, v]]; }
function last(name) { const k = T[name]; return k[k.length - 1][1]; }
// tween from whatever value the track holds at t0 to v at t1
function to(name, t0, t1, v, ease = 'io') {
  if (!T[name]) throw new Error('no track ' + name);
  const k = T[name];
  const prev = last(name);
  if (t0 > k[k.length - 1][0]) k.push([t0, prev]);
  k.push([t1, v, ease]);
}
function set(name, t, v) { to(name, t - 0.0001, t, v, 'lin'); }
function V(name, t) {
  const k = T[name];
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i][0]) {
      const [t0, v0] = k[i - 1];
      const [t1, v1, e] = k[i];
      const u = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * E[e || 'io'](u);
    }
  }
  return k[k.length - 1][1];
}

// ---------- seeded random ----------
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(20251008);

// ---------- sound events for the audio mix ----------
const SFX = [];
function sfx(t, type, gain = 1) { SFX.push({ t: +t.toFixed(4), type, gain }); }

// ---------- typing ----------
const TYPE = []; // {id, segs:[{t, style}], times:[], t0, tEnd}
function type(id, t0, cps = 18, segs) {
  const cfg = TXT[id];
  segs = segs || [{ t: cfg ? cfg.text : '', style: '' }];
  const full = segs.map((s) => s.t).join('');
  const times = [];
  let t = t0;
  for (let i = 0; i < full.length; i++) {
    times.push(t);
    sfx(t, full[i] === ' ' ? 'space' : 'key', 0.8 + R() * 0.4);
    let dt = (1 / cps) * (0.65 + R() * 0.7);
    if (full[i] === ' ') dt *= 1.25;
    t += dt;
  }
  const rec = { id, segs, times, t0, tEnd: times[times.length - 1] };
  TYPE.push(rec);
  return rec.tEnd;
}

// ---------- cursor ----------
init('cur.x', 1000); init('cur.y', 1700); init('cur.op', 0);
const SHAPES = [{ t: 0, s: 'arrow' }];
const CLICKS = [];
function shape(t, s) { SHAPES.push({ t, s }); }
function move(t0, t1, x, y, ease = 'io') { to('cur.x', t0, t1, x, ease); to('cur.y', t0, t1, y, ease); }
function click(t) { CLICKS.push(t); sfx(t, 'click'); }

// ---------- selections and helper chips ----------
const SEL = []; // {slot, t0, t1, rect(t) -> [x0,y0,x1,y1] app coords | el, tag}
function select(slot, t0, t1, target, tag = '') { SEL.push({ slot, t0, t1, target, tag }); }
const CHIPS = []; // {t0, t1, x, y (app), text, color}

// ---------- camera ----------
init('cam.fx', CX); init('cam.fy', CY); init('cam.lk', 0);
function camFocus(ax, ay, k) {
  let fx = PX0 + S0 * ax;
  let fy = PY0 + S0 * ay;
  fy = Math.min(fy, APP_BOTTOM_WORLD - CY / k);
  return [fx, fy];
}
function cam(t0, t1, ax, ay, k, ease = 'io') {
  const [fx, fy] = camFocus(ax, ay, k);
  sfx(t0, 'whoosh', Math.min(1, Math.abs(Math.log(k) - last('cam.lk')) * 0.8 + 0.35));
  to('cam.fx', t0, t1, fx, ease); to('cam.fy', t0, t1, fy, ease); to('cam.lk', t0, t1, Math.log(k), ease);
}
function camWide(t0, t1, k = 1, ease = 'io') {
  const fy = Math.min(CY, APP_BOTTOM_WORLD - CY / k);
  sfx(t0, 'whoosh', Math.min(1, Math.abs(Math.log(k) - last('cam.lk')) * 0.8 + 0.25));
  to('cam.fx', t0, t1, CX, ease); to('cam.fy', t0, t1, fy, ease); to('cam.lk', t0, t1, Math.log(k), ease);
}

// ---------- element tracks ----------
init('phone.dy', 900);
init('titles.op', 0); init('titles.dy', 30);
init('chip.b', 0); init('chip.l', 0); init('chip.a', 0);
for (let i = 1; i <= 4; i++) init('step' + i, 0);
init('old.op', 1); init('old.D', 880);
init('marquee.p', 0); init('marquee.op', 0);
init('calIcon', 0); init('tri', 0);
for (let k = 0; k < 7; k++) { init('circ' + k, 0); init('fill' + k, 0); init('dash' + k, 0); }
init('ring', 0); init('wedBold', 0);
for (let k = 1; k <= 3; k++) init('dot' + k, 0);
init('flower.draw', 0); init('flower.fill', 0); init('leaves', 0); init('bigNum.pop', 0);
init('pill.w', 0); init('pill.h', 0);
init('card.w', 0); init('card.h', 0); init('card.shadow', 0);
init('track', 0); init('fillw', 0);
init('div.op', 0); init('div.D', 880); init('ba.op', 0);
init('sweep.x', -400); init('sweep.op', 0);
init('fade', 0);

// =====================================================================
// SCRIPT
// =====================================================================

// keycap hints at the bottom of the frame
const KEYS = [];
function keycap(t0, t1, text) { KEYS.push({ t0, t1, text }); }
// after a click with the text tool, move the mouse out of the way of the text
function nudge(t, x, y) { move(t, t + 0.3, x, y, 'o'); }

// --- intro: titles in, phone rises with the old design
to('titles.op', 0.15, 0.9, 1, 'o'); to('titles.dy', 0.15, 1.1, 0, 'o');
to('chip.b', 0.1, 0.6, 1, 'o');
to('phone.dy', 0.25, 1.7, 0, 'o4');
sfx(0.25, 'rise');
camWide(1.7, 2.6, 1.03, 'io2');

// --- a close look at the old screen
to('titles.op', 2.6, 3.0, 0, 'io2');
cam(2.6, 3.5, 330, 330, 1.75);
cam(3.8, 4.7, 440, 820, 1.75);
camWide(5.0, 5.8, 1);
to('titles.op', 5.2, 5.7, 1, 'io2');

// --- live edit: select everything below the header and delete it
to('chip.b', 5.7, 5.95, 0, 'io2'); to('chip.l', 5.75, 6.05, 1, 'o');
to('cur.op', 5.8, 6.0, 1, 'lin');
move(5.8, 6.4, 18, 160, 'o');
click(6.45);
to('marquee.op', 6.45, 6.5, 1, 'lin');
to('marquee.p', 6.47, 7.0, 1, 'io2');
move(6.47, 7.0, 862, 1150, 'io2');
to('marquee.op', 7.03, 7.07, 0, 'lin');
select('sel', 7.05, 7.5, { rect: () => [16, 158, 864, 1196] });
keycap(7.3, 7.85, 'Delete');
sfx(7.5, 'delete');
to('old.op', 7.5, 7.8, 0, 'io2');
move(7.55, 8.1, 300, 330, 'io');

// --- 01 date header
to('titles.op', 7.7, 8.1, 0, 'io2');
cam(7.8, 8.6, 255, 250, 2.05);
to('step1', 8.1, 8.5, 1, 'o');
shape(8.15, 'beam');
move(8.1, 8.6, 46, 206, 'io');
click(8.65);
nudge(8.7, 64, 236);
let e1 = type('todayLine', 8.8, 20);
select('sel', 8.7, e1 + 0.3, { el: 'todayLine' });
to('calIcon', e1 + 0.2, e1 + 0.6, 1, 'back'); sfx(e1 + 0.2, 'pop', 0.6);
move(e1 + 0.1, e1 + 0.55, 112, 274, 'io');
click(e1 + 0.6);
nudge(e1 + 0.65, 136, 318);
let e2 = type('monthLine', e1 + 0.72, 18);
select('sel', e1 + 0.65, e2 + 0.3, { el: 'monthLine' });
to('tri', e2 + 0.2, e2 + 0.55, 1, 'back'); sfx(e2 + 0.2, 'pop', 0.6);
let t = e2 + 0.65;
const MARK = { e1, e2, week: t };

// --- 02 week strip
to('step1', t, t + 0.3, 0, 'io2');
cam(t, t + 0.85, 440, 425, 1.36);
to('step2', t + 0.35, t + 0.75, 1, 'o');
shape(t + 0.3, 'arrow');
move(t + 0.2, t + 0.8, 60, 530, 'io');
let tl = t + 0.55;
let labelsEnd = 0;
for (let k = 0; k < 7; k++) {
  labelsEnd = type('day' + k, tl + k * 0.09, 34, [{ t: DAYS[k], style: '' }]);
}
// draw the first circle with the ellipse tool
let tc = labelsEnd + 0.15;
MARK.tc = tc;
shape(tc - 0.3, 'cross');
move(tc - 0.35, tc, 53, 393, 'io');
click(tc);
to('circ0', tc + 0.02, tc + 0.5, 1, 'io2');
move(tc + 0.02, tc + 0.5, 141, 481, 'io2');
select('sel', tc + 0.02, tc + 0.8, { rect: (tt) => { const p = V('circ0', tt); return [53, 393, 53 + 88 * p, 393 + 88 * p]; } }, (tt) => `${Math.round(44 * V('circ0', tt))} × ${Math.round(44 * V('circ0', tt))}`);
// repeat it across the row
let tr = tc + 0.7;
keycap(tr - 0.12, tr + 0.5, '⌘ D');
sfx(tr, 'swish', 0.6);
for (let k = 1; k < 7; k++) { to('circ' + k, tr + (k - 1) * 0.06, tr + (k - 1) * 0.06 + 0.38, 1, 'back'); sfx(tr + (k - 1) * 0.06, 'pop', 0.35); }
shape(tr + 0.1, 'arrow');
move(tr, tr + 0.5, 470, 530, 'io');
// numbers
let tn = tr + 0.55;
let numsEnd = 0;
for (let k = 0; k < 7; k++) numsEnd = type('num' + k, tn + k * 0.08, 24, [{ t: NUMS[k], style: '' }]);
tn = numsEnd + 0.15;
MARK.tn = tn;
// logged days get a solid fill
move(tn, tn + 0.4, 225, 452, 'io');
click(tn + 0.45);
select('sel', tn + 0.45, tn + 1.3, { el: 'circ1' });
CHIPS.push({ t0: tn + 0.5, t1: tn + 1.3, x: 211, y: 540, text: '#E01B66', color: '#e01b66' });
to('fill1', tn + 0.52, tn + 0.78, 1, 'io2'); sfx(tn + 0.52, 'pop', 0.4);
move(tn + 0.5, tn + 0.85, 338, 452, 'io');
click(tn + 0.9);
select('sel2', tn + 0.9, tn + 1.3, { el: 'circ2' });
to('fill2', tn + 0.95, tn + 1.2, 1, 'io2'); sfx(tn + 0.95, 'pop', 0.4);
// today: fill, double ring, bold label
let td = tn + 1.4;
move(td - 0.1, td + 0.25, 452, 452, 'io');
click(td + 0.3);
select('sel', td + 0.3, td + 1.15, { el: 'ring' });
to('fill3', td + 0.35, td + 0.6, 1, 'io2');
to('ring', td + 0.45, td + 0.85, 1, 'back'); sfx(td + 0.45, 'pop', 0.7);
to('wedBold', td + 0.6, td + 0.8, 1, 'io2');
// upcoming days get a dashed stroke
let tu = td + 1.25;
move(tu - 0.1, tu + 0.3, 566, 452, 'io');
click(tu + 0.35);
select('sel', tu + 0.35, tu + 1.2, { el: 'circ4' });
CHIPS.push({ t0: tu + 0.42, t1: tu + 1.2, x: 610, y: 540, text: 'Stroke · Dashed', color: 'dash' });
to('dash4', tu + 0.42, tu + 0.7, 1, 'io2');
move(tu + 0.4, tu + 0.75, 680, 452, 'io');
click(tu + 0.8);
select('sel2', tu + 0.8, tu + 1.2, { el: 'circ5' });
to('dash5', tu + 0.85, tu + 1.1, 1, 'io2');
// dots under the logged days
let tdot = tu + 1.3;
for (let k = 1; k <= 3; k++) { to('dot' + k, tdot + (k - 1) * 0.08, tdot + (k - 1) * 0.08 + 0.38, 1, 'back'); sfx(tdot + (k - 1) * 0.08, 'pop', 0.3); }
move(tdot, tdot + 0.5, 520, 640, 'io');
t = tdot + 0.6;
MARK.cycle = t;

// --- 03 cycle day
to('step2', t, t + 0.3, 0, 'io2');
cam(t, t + 0.85, 440, 760, 1.8);
to('step3', t + 0.35, t + 0.75, 1, 'o');
shape(t + 0.35, 'beam');
move(t + 0.25, t + 0.85, 440, 580, 'io');
click(t + 0.9);
nudge(t + 0.95, 486, 650);
let e3 = type('cycleTitle', t + 1.0, 24);
select('sel', t + 0.95, e3 + 0.3, { el: 'cycleTitle' });
// the pen tool traces the flower outline
let tf = e3 + 0.45;
MARK.e3 = e3; MARK.tf = tf;
shape(tf - 0.3, 'pen');
const fp0 = flowerPoint(0);
move(e3 + 0.15, tf, fp0[0], fp0[1], 'io');
to('flower.draw', tf, tf + 1.25, 1, 'io2');
sfx(tf, 'draw', 1);
const FLOWER_PEN = [tf, tf + 1.25];
to('flower.fill', tf + 1.25, tf + 1.55, 1, 'io2'); sfx(tf + 1.25, 'pop', 0.5);
to('leaves', tf + 1.35, tf + 2.0, 1, 'io2');
select('sel', tf + 1.25, tf + 1.9, { rect: () => [315, 619, 566, 869] }, '125 × 125');
// the cycle number
let tnum = tf + 1.95;
shape(tnum - 0.35, 'beam');
move(tnum - 0.4, tnum, 444, 744, 'io');
click(tnum + 0.05);
nudge(tnum + 0.1, 540, 840);
type('bigNum', tnum + 0.2, 10);
to('bigNum.pop', tnum + 0.2, tnum + 0.55, 1, 'o');
sfx(tnum + 0.2, 'pop', 0.7);
select('sel', tnum + 0.1, tnum + 0.75, { el: 'bigNum' });
// the phase pill: rectangle tool, then text
let tp = tnum + 0.85;
MARK.tp = tp;
shape(tp - 0.3, 'cross');
move(tp - 0.35, tp, 244, 900, 'io');
click(tp);
to('pill.w', tp + 0.02, tp + 0.5, 1, 'io2'); to('pill.h', tp + 0.02, tp + 0.38, 1, 'io2');
move(tp + 0.02, tp + 0.5, 636, 956, 'io2');
select('sel', tp + 0.02, tp + 0.7, { rect: (tt) => [244, 900, 244 + 392 * V('pill.w', tt), 900 + 56 * V('pill.h', tt)] }, (tt) => `${Math.round(196 * V('pill.w', tt))} × ${Math.round(28 * V('pill.h', tt))}`);
shape(tp + 0.6, 'beam');
move(tp + 0.55, tp + 0.85, 440, 928, 'io');
click(tp + 0.9);
nudge(tp + 0.95, 486, 1000);
let e4 = type('pillText', tp + 1.0, 24);
select('sel', tp + 0.95, e4 + 0.3, { el: 'pillText' });
t = e4 + 0.5;
MARK.card = t;

// --- 04 progress card
to('step3', t, t + 0.3, 0, 'io2');
cam(t, t + 0.85, 440, 1080, 1.36);
to('step4', t + 0.35, t + 0.75, 1, 'o');
let tk = t + 0.8;
shape(tk - 0.3, 'cross');
move(t + 0.25, tk, 40, 989, 'io');
click(tk);
to('card.w', tk + 0.02, tk + 0.65, 1, 'io2'); to('card.h', tk + 0.02, tk + 0.5, 1, 'io2');
move(tk + 0.02, tk + 0.65, 840, 1162, 'io2');
select('sel', tk + 0.02, tk + 1.0, { rect: (tt) => [40, 989, 40 + 800 * V('card.w', tt), 989 + 173 * V('card.h', tt)] }, (tt) => `${Math.round(400 * V('card.w', tt))} × ${Math.round(86 * V('card.h', tt))}`);
to('card.shadow', tk + 0.7, tk + 1.1, 1, 'io2');
// close in on the labels
let ta = tk + 1.05;
MARK.ta = ta;
cam(ta - 0.1, ta + 0.5, 300, 1040, 2.05);
shape(ta + 0.05, 'beam');
move(ta, ta + 0.45, 78, 1034, 'io');
click(ta + 0.5);
nudge(ta + 0.55, 104, 1090);
let e5 = type('avg', ta + 0.6, 24);
select('sel', ta + 0.55, e5 + 0.25, { el: 'avg' });
cam(e5 + 0.05, e5 + 0.55, 590, 1040, 2.05);
move(e5 + 0.05, e5 + 0.5, 800, 1034, 'io');
click(e5 + 0.55);
nudge(e5 + 0.6, 772, 1092);
let e6 = type('pct', e5 + 0.65, 22);
select('sel', e5 + 0.6, e6 + 0.25, { el: 'pct' });
// progress bar
let tb = e6 + 0.35;
MARK.tb = tb;
cam(tb - 0.1, tb + 0.5, 440, 1080, 1.36);
shape(tb, 'cross');
move(tb, tb + 0.3, 73, 1062, 'io');
click(tb + 0.35);
to('track', tb + 0.37, tb + 0.85, 1, 'io2');
move(tb + 0.37, tb + 0.85, 807, 1074, 'io2');
select('sel', tb + 0.37, tb + 1.0, { rect: (tt) => [73, 1062, 73 + 734 * V('track', tt), 1074] }, (tt) => `${Math.round(367 * V('track', tt))} × 6`);
to('fillw', tb + 1.0, tb + 1.5, 80, 'io2'); sfx(tb + 1.0, 'swish', 0.5);
select('sel2', tb + 1.0, tb + 1.7, { rect: (tt) => [73, 1062, 73 + Math.max(12, V('fillw', tt)), 1074] });
CHIPS.push({ t0: tb + 1.05, t1: tb + 1.7, x: 150, y: 1094, text: '11%', color: '#fb3179' });
// fertile window line, the camera follows the caret
let tw = tb + 1.8;
cam(tw - 0.45, tw + 0.1, 330, 1100, 2.05);
shape(tw - 0.35, 'beam');
move(tw - 0.4, tw - 0.05, 80, 1116, 'io');
click(tw);
nudge(tw + 0.05, 100, 1176);
let e7 = type('fertile', tw + 0.1, 24, [
  { t: 'Fertile window starts ', style: '' },
  { t: 'Oct 15', style: 'font-weight:700' },
  { t: ' · 7 days away', style: 'color:#b32070' },
]);
select('sel', tw + 0.05, e7 + 0.3, { el: 'fertile' });
cam(tw + 0.5, e7 + 0.1, 432, 1100, 2.05, 'io2');
t = e7 + 0.5;
MARK.reveal = t;

// --- reveal the finished screen
to('step4', t, t + 0.3, 0, 'io2');
shape(t, 'arrow');
move(t, t + 0.8, 1100, 1500, 'i');
to('cur.op', t + 0.5, t + 0.8, 0, 'lin');
to('chip.l', t + 0.3, t + 0.55, 0, 'io2'); to('chip.a', t + 0.35, t + 0.65, 1, 'o');
camWide(t + 0.1, t + 1.2, 1);
to('titles.op', t + 0.55, t + 1.1, 1, 'io2');
to('sweep.op', t + 1.1, t + 1.15, 1, 'lin'); to('sweep.x', t + 1.1, t + 2.0, 1200, 'io2'); to('sweep.op', t + 1.95, t + 2.0, 0, 'lin');
sfx(t + 1.1, 'shine', 0.8);
const REVEAL = t;

// --- before / after slider
let ts = t + 2.4;
MARK.slider = ts;
to('chip.a', ts - 0.3, ts, 0, 'io2');
set('old.op', ts, 1); set('old.D', ts, 0);
to('div.op', ts, ts + 0.25, 1, 'lin');
to('ba.op', ts + 0.1, ts + 0.45, 1, 'o');
to('old.D', ts + 0.1, ts + 1.3, 700, 'io'); sfx(ts + 0.1, 'swish', 0.6);
to('old.D', ts + 1.55, ts + 2.75, 180, 'io'); sfx(ts + 1.55, 'swish', 0.6);
to('old.D', ts + 3.0, ts + 3.8, 440, 'io'); sfx(ts + 3.0, 'swish', 0.4);
to('old.D', ts + 4.6, ts + 5.4, 0, 'io'); sfx(ts + 4.6, 'swish', 0.5);
to('ba.op', ts + 4.7, ts + 5.1, 0, 'io2');
to('div.op', ts + 5.25, ts + 5.5, 0, 'lin');
set('old.op', ts + 5.5, 0);

// --- outro
let to0 = ts + 5.6;
to('chip.a', to0 - 0.3, to0, 1, 'o');
DURATION = +(to0 + 3.6).toFixed(2);
camWide(to0, DURATION, 1.05, 'io2');
to('fade', DURATION - 0.8, DURATION, 1, 'io2');

// ---------- geometry helpers ----------
function flowerPoint(p) {
  const path = document.getElementById('flowerStroke');
  if (!FLOWER_LEN) FLOWER_LEN = path.getTotalLength();
  const q = path.getPointAtLength(FLOWER_LEN * p);
  return [q.x, q.y];
}

// =====================================================================
// RENDER
// =====================================================================
let camState = { fx: CX, fy: CY, k: 1 };
function appToVideo(x, y) {
  const wx = PX0 + S0 * x, wy = PY0 + S0 * y + PHONE_DY;
  return [(wx - camState.fx) * camState.k + CX, (wy - camState.fy) * camState.k + CY];
}
let PHONE_DY = 0;

function stepEls() {
  const wrap = $('stepWrap');
  const items = ['Date header', 'Week strip', 'Cycle day', 'Progress card'];
  items.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'step'; d.id = 'stepEl' + (i + 1);
    d.innerHTML = `<b>0${i + 1}</b>${s}`;
    wrap.appendChild(d);
  });
}

function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

const typedCache = {};
function renderTyping(t) {
  for (const rec of TYPE) {
    const n = rec.times.filter((x) => x <= t).length;
    let cv = 0;
    if (t >= rec.t0 - 0.25 && t <= rec.tEnd + 0.45) {
      if (t < rec.t0 || t > rec.tEnd + 0.08) cv = Math.floor((t - rec.t0) * 3.2) % 2 === 0 ? 1 : 0;
      else cv = 1;
    }
    // find the last selection window touching this element to keep the caret inside the box
    const key = n + '|' + cv;
    if (typedCache[rec.id] === key) continue;
    typedCache[rec.id] = key;
    let left = n, html = '';
    rec.segs.forEach((s, i) => {
      const part = s.t.slice(0, Math.max(0, left));
      left -= s.t.length;
      const isCaretSeg = (left < 0 || i === rec.segs.length - 1) && !html.includes('caret');
      html += `<span class="tx" style="${s.style}">${esc(part)}${isCaretSeg ? `<span class="caret" style="--cv:${cv}"></span>` : ''}</span>`;
    });
    $(rec.id).innerHTML = html;
  }
}

function shapeAt(t) { let s = 'arrow'; for (const x of SHAPES) if (x.t <= t) s = x.s; return s; }

function rectOf(target, t) {
  if (target.rect) {
    const [x0, y0, x1, y1] = target.rect(t);
    const [a, b] = appToVideo(x0, y0); const [c, d] = appToVideo(x1, y1);
    return [a, b, c, d];
  }
  const el = $(target.el);
  const spans = el.querySelectorAll('.tx');
  let r;
  if (spans.length) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const s of spans) {
      const b = s.getBoundingClientRect();
      if (b.width === 0 && b.height === 0) continue;
      x0 = Math.min(x0, b.left); y0 = Math.min(y0, b.top); x1 = Math.max(x1, b.right); y1 = Math.max(y1, b.bottom);
    }
    r = [x0, y0, Math.max(x1, x0 + 4), y1];
    const pad = 6 * camState.k;
    return [r[0] - pad, r[1] - pad * 0.4, r[2] + pad, r[3] + pad * 0.4];
  }
  const b = el.getBoundingClientRect();
  const pad = 4;
  return [b.left - pad, b.top - pad, b.right + pad, b.bottom + pad];
}

function renderSelections(t) {
  const slots = { sel: null, sel2: null, sel3: null };
  for (const s of SEL) if (t >= s.t0 && t <= s.t1 + 0.12) slots[s.slot] = s;
  for (const [slot, s] of Object.entries(slots)) {
    const el = $(slot);
    if (!s) { el.style.opacity = 0; continue; }
    const op = Math.min(1, (t - s.t0) / 0.06, (s.t1 + 0.12 - t) / 0.12);
    const [x0, y0, x1, y1] = rectOf(s.target, t);
    el.style.opacity = Math.max(0, op);
    el.style.left = x0 + 'px'; el.style.top = y0 + 'px';
    el.style.width = Math.max(2, x1 - x0) + 'px'; el.style.height = Math.max(2, y1 - y0) + 'px';
    if (slot === 'sel') {
      const tag = typeof s.tag === 'function' ? s.tag(t) : s.tag;
      $('selTag').style.display = tag ? 'block' : 'none';
      $('selTag').textContent = tag;
    }
  }
}

function renderChips(t) {
  const el = $('colorChip');
  let c = null;
  for (const x of CHIPS) if (t >= x.t0 && t <= x.t1 + 0.2) c = x;
  if (!c) { el.style.opacity = 0; return; }
  const u = Math.min(1, (t - c.t0) / 0.25);
  const op = Math.min(E.o(u), (c.t1 + 0.2 - t) / 0.2);
  const [vx, vy] = appToVideo(c.x, c.y);
  el.style.opacity = Math.max(0, op);
  el.style.transform = `translate(${vx}px, ${vy + (1 - E.o(u)) * 16}px) translateX(-50%)`;
  el.style.left = '0px'; el.style.top = '0px';
  $('chipText').textContent = c.text;
  const sw = $('swatch');
  if (c.color === 'dash') { sw.style.background = '#fff'; sw.style.boxShadow = 'inset 0 0 0 3px #fff, 0 0 0 0 #000'; sw.style.border = '3px dashed #fb3179'; sw.style.boxSizing = 'border-box'; sw.style.borderRadius = '50%'; }
  else { sw.style.background = c.color; sw.style.border = 'none'; sw.style.boxShadow = 'inset 0 0 0 1px rgba(0,0,0,0.08)'; sw.style.borderRadius = '10px'; }
}

function render(t) {
  // camera
  camState = { fx: V('cam.fx', t), fy: V('cam.fy', t), k: Math.exp(V('cam.lk', t)) };
  PHONE_DY = V('phone.dy', t);
  $('world').style.transform = `translate(${CX - camState.fx * camState.k}px, ${CY - camState.fy * camState.k}px) scale(${camState.k})`;
  $('phone').style.transform = `translateY(${PHONE_DY}px) scale(${S0})`;

  // background drift
  $('blobA').style.transform = `translate(${Math.sin(t * 0.35) * 40}px, ${Math.cos(t * 0.3) * 30}px)`;
  $('blobB').style.transform = `translate(${Math.cos(t * 0.28) * 50}px, ${Math.sin(t * 0.33) * 40}px)`;
  $('blobC').style.transform = `translate(${Math.sin(t * 0.22) * 60}px, 0px)`;

  // titles
  const zoomFade = Math.max(0, Math.min(1, (camState.k - 1.06) / 0.25));
  $('title').style.opacity = V('titles.op', t);
  $('sub').style.opacity = V('titles.op', t);
  $('title').style.transform = `translateY(${V('titles.dy', t)}px)`;
  $('sub').style.transform = `translateY(${V('titles.dy', t) * 1.4}px)`;
  $('chipBefore').style.opacity = V('chip.b', t);
  $('chipLive').style.opacity = V('chip.l', t);
  $('chipAfter').style.opacity = V('chip.a', t);
  const blink = 0.55 + 0.45 * Math.cos(t * Math.PI * 2 * 0.9);
  $('chipLive').querySelector('.dot').style.opacity = blink;
  for (let i = 1; i <= 4; i++) {
    const v = V('step' + i, t);
    const s = $('stepEl' + i);
    s.style.opacity = v;
    s.style.transform = `translateX(-50%) translateY(${(1 - v) * -14}px)`;
  }

  // old screen
  $('oldLayer').style.opacity = V('old.op', t);
  const D = V('old.D', t);
  $('oldLayer').style.clipPath = `inset(0px ${Math.max(0, 880 - D)}px 0px 0px)`;

  // header block
  $('calIcon').style.opacity = Math.min(1, V('calIcon', t) * 1.5);
  $('calIcon').style.transform = `scale(${0.4 + 0.6 * V('calIcon', t)})`;
  $('tri').style.opacity = Math.min(1, V('tri', t) * 1.5);
  $('tri').style.transform = `scale(${0.3 + 0.7 * V('tri', t)})`;

  // week strip
  for (let k = 0; k < 7; k++) {
    const c = $('circ' + k);
    const p = V('circ' + k, t);
    c.style.transformOrigin = k === 0 ? '0 0' : '50% 50%';
    c.style.transform = `scale(${Math.max(0.0001, p)})`;
    c.style.opacity = Math.min(1, p * 3);
    const f = V('fill' + k, t), d = V('dash' + k, t);
    c.querySelector('.cFill').style.opacity = f;
    c.querySelector('.cDash').style.opacity = d;
    c.querySelector('.cOutline').style.opacity = 1 - Math.max(f, d);
  }
  const r = V('ring', t);
  $('ring').style.opacity = Math.min(1, r * 2);
  $('ring').style.transform = `scale(${0.75 + 0.25 * r})`;
  const wb = V('wedBold', t);
  $('dayBold').style.opacity = wb;
  $('day3').style.opacity = 1 - wb;
  for (let k = 1; k <= 3; k++) {
    const v = V('dot' + k, t);
    $('dot' + k).style.opacity = Math.min(1, v * 2);
    $('dot' + k).style.transform = `translateY(${(1 - v) * -18}px) scale(${0.3 + 0.7 * v})`;
  }

  // flower
  const fs = $('flowerStroke');
  if (!FLOWER_LEN) FLOWER_LEN = fs.getTotalLength();
  const dr = V('flower.draw', t);
  fs.style.strokeDasharray = `${FLOWER_LEN}`;
  fs.style.strokeDashoffset = `${FLOWER_LEN * (1 - dr)}`;
  fs.style.opacity = dr > 0 ? 1 : 0;
  $('flowerFill').style.opacity = V('flower.fill', t);
  $('leaves').style.opacity = V('leaves', t);
  const bp = V('bigNum.pop', t);
  $('bigNum').style.transform = `scale(${bp > 0 ? 1 + 0.18 * Math.sin(bp * Math.PI) : 1})`;
  $('bigNum').style.transformOrigin = '444px 88px';

  // pill + card
  const pw = V('pill.w', t), ph = V('pill.h', t);
  $('pill').style.width = 392 * pw + 'px'; $('pill').style.height = 56 * ph + 'px';
  $('pill').style.opacity = pw > 0.001 ? 1 : 0;
  const cw = V('card.w', t), ch = V('card.h', t);
  $('card').style.width = 800 * cw + 'px'; $('card').style.height = 173 * ch + 'px';
  $('card').style.opacity = cw > 0.001 ? 1 : 0;
  const sh = V('card.shadow', t);
  $('card').style.boxShadow = `0 18px 44px rgba(196, 22, 92, ${0.20 * sh}), 0 4px 10px rgba(196, 22, 92, ${0.06 * sh})`;
  $('track').style.width = 734 * V('track', t) + 'px';
  const fw = V('fillw', t);
  $('fill').style.width = fw + 'px';
  $('fill').style.opacity = fw > 0.5 ? 1 : 0;

  renderTyping(t);

  // before/after divider, its knob and labels ride along the header row
  const dop = V('div.op', t);
  const [dx, dyTop] = appToVideo(D, 0);
  const [, dyBot] = appToVideo(D, 1300);
  $('divider').style.opacity = dop;
  $('divider').style.left = dx + 'px'; $('divider').style.top = dyTop + 'px'; $('divider').style.height = (Math.min(1920, dyBot) - dyTop) + 'px';
  const [kx, ky] = appToVideo(D, 70);
  $('dividerKnob').style.opacity = dop;
  $('dividerKnob').style.left = kx + 'px'; $('dividerKnob').style.top = ky + 'px';
  const ba = V('ba.op', t);
  const lb = $('labBefore'), la = $('labAfter');
  lb.style.opacity = ba * Math.max(0, Math.min(1, (D - 60) / 160));
  lb.style.left = (kx - 54 - lb.offsetWidth) + 'px'; lb.style.top = (ky - 23) + 'px';
  la.style.opacity = ba * Math.max(0, Math.min(1, (820 - D) / 160));
  la.style.left = (kx + 54) + 'px'; la.style.top = (ky - 23) + 'px';

  // keycap hints
  let kc = null;
  for (const k of KEYS) if (t >= k.t0 && t <= k.t1) kc = k;
  if (kc) {
    const u = (t - kc.t0) / (kc.t1 - kc.t0);
    const op = Math.min(1, (t - kc.t0) / 0.1, (kc.t1 - t) / 0.12);
    const press = u > 0.35 && u < 0.6 ? 6 : 0;
    $('keyText').textContent = kc.text;
    $('keycap').style.opacity = op;
    $('keycap').style.transform = `translateX(-50%) translateY(${press}px) scale(${0.92 + 0.08 * Math.min(1, (t - kc.t0) / 0.15)})`;
    $('keycap').style.boxShadow = press ? '0 1px 0 #07050a, 0 10px 24px rgba(20, 5, 15, 0.3), inset 0 1px 0 rgba(255,255,255,0.18)' : '';
  } else $('keycap').style.opacity = 0;

  // glint
  $('sweep').style.opacity = V('sweep.op', t);
  $('sweep').style.left = V('sweep.x', t) + 'px';

  // marquee
  const mp = V('marquee.p', t);
  const [m0x, m0y] = appToVideo(18, 160);
  const [m1x, m1y] = appToVideo(18 + (862 - 18) * mp, 160 + (1150 - 160) * mp);
  $('marquee').style.opacity = V('marquee.op', t);
  $('marquee').style.left = m0x + 'px'; $('marquee').style.top = m0y + 'px';
  $('marquee').style.width = Math.max(0, m1x - m0x) + 'px'; $('marquee').style.height = Math.max(0, m1y - m0y) + 'px';

  renderSelections(t);
  renderChips(t);

  // cursor: pen follows the outline while it draws
  let cx = V('cur.x', t), cy = V('cur.y', t);
  if (t >= FLOWER_PEN[0] && t <= FLOWER_PEN[1]) { const q = flowerPoint(V('flower.draw', t)); cx = q[0]; cy = q[1]; }
  const [vx, vy] = appToVideo(cx, cy);
  let press = 1;
  let lastClick = -1;
  for (const c of CLICKS) if (c <= t) lastClick = c;
  if (lastClick >= 0 && t - lastClick < 0.18) press = 0.86 + 0.14 * ((t - lastClick) / 0.18);
  $('cursor').style.transform = `translate(${vx}px, ${vy}px) scale(${press})`;
  $('cursor').style.opacity = V('cur.op', t);
  const s = shapeAt(t);
  $('curArrow').style.display = s === 'arrow' ? 'block' : 'none';
  $('curBeam').style.display = s === 'beam' ? 'block' : 'none';
  $('curCross').style.display = s === 'cross' ? 'block' : 'none';
  $('curPen').style.display = s === 'pen' ? 'block' : 'none';
  const rp = $('ripple');
  if (lastClick >= 0 && t - lastClick < 0.45 && V('cur.op', t) > 0.5) {
    const u = (t - lastClick) / 0.45;
    rp.style.opacity = (1 - u) * 0.9;
    const [rx, ry] = appToVideo(V('cur.x', lastClick), V('cur.y', lastClick));
    rp.style.left = rx + 'px'; rp.style.top = ry + 'px';
    rp.style.transform = `scale(${0.3 + 1.2 * E.o(u)})`;
  } else rp.style.opacity = 0;

  $('fade').style.opacity = V('fade', t);
}

// ---------- boot ----------
stepEls();
// hide every typed text until the timeline types it
for (const rec of TYPE) $(rec.id).innerHTML = '';
window.DURATION = DURATION;
window.SFX = SFX;
window.renderAt = (t) => { render(t); return true; };
window.REVEAL = REVEAL;
window.MARK = MARK;
const qs = new URLSearchParams(location.search);
if (qs.has('t')) render(parseFloat(qs.get('t')));
