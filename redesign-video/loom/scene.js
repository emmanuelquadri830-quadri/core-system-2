// Scene for the Loom walkthrough. Every frame is a pure function of t, so
// frames can be rendered in any order and in parallel.

const $ = (id) => document.getElementById(id);
const DURATION = window.CUE_END;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const E = {
  lin: (t) => t,
  io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  o: (t) => 1 - Math.pow(1 - t, 3),
  o4: (t) => 1 - Math.pow(1 - t, 4),
};

// ---------- the app on the phone, in its finished state ----------
buildApp($('appHost'));
for (const k of [1, 2, 3]) {
  const c = $('circ' + k);
  c.querySelector('.cFill').style.opacity = 1;
  c.querySelector('.cOutline').style.opacity = 0;
}
for (const k of [4, 5]) {
  const c = $('circ' + k);
  c.querySelector('.cDash').style.opacity = 1;
  c.querySelector('.cOutline').style.opacity = 0;
}
$('day3').style.opacity = 0;
document.querySelectorAll('.cFill').forEach((e) => { e.style.background = 'var(--deep)'; });
const dot4 = document.createElement('div');
dot4.id = 'dot4';
Object.assign(dot4.style, { position: 'absolute', left: COL_X[4] - 5 + 'px', top: '497.5px', width: '10px', height: '10px', borderRadius: '50%', background: '#fff', opacity: 0 });
$('app').appendChild(dot4);

// ---------- tracks ----------
const TR = {};
function init(n, v) { TR[n] = [[0, v]]; }
function to(n, t0, t1, v, ease = 'io') {
  const k = TR[n]; const prev = k[k.length - 1][1];
  if (t0 > k[k.length - 1][0]) k.push([t0, prev]);
  k.push([t1, v, ease]);
}
function V(n, t) {
  const k = TR[n];
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i][0]) {
      const [t0, v0] = k[i - 1]; const [t1, v1, e] = k[i];
      return v0 + (v1 - v0) * E[e || 'io'](t1 === t0 ? 1 : (t - t0) / (t1 - t0));
    }
  }
  return k[k.length - 1][1];
}
const S = (id) => CUE[id].start;

// ---------- phone camera ----------
const PS = 0.7, PBX = 110, PBY = 70;
const APX = PBX + PS * 27, APY = PBY + PS * 147;
const LCX = 410, LCY = 540;
const APP_BOTTOM = APY + PS * 1296;
init('fx', LCX); init('fy', LCY); init('lk', 0); init('dy', 520);
function camTo(t0, t1, ax, ay, k) {
  to('fx', t0, t1, APX + PS * ax); to('fy', t0, t1, Math.min(APY + PS * ay, APP_BOTTOM - LCY / k)); to('lk', t0, t1, Math.log(k));
}
function camWide(t0, t1) { to('fx', t0, t1, LCX); to('fy', t0, t1, LCY); to('lk', t0, t1, 0); }
to('dy', 0, 1.1, 0, 'o4');
camTo(S('c6') - 0.2, S('c6') + 0.7, 440, 800, 1.32);
camWide(S('c10'), S('c10') + 0.9);
camTo(S('c15') - 0.1, S('c15') + 0.7, 440, 437, 1.4);
camWide(S('c22'), S('c22') + 0.9);
camTo(S('c27') - 0.2, S('c27') + 0.6, 440, 470, 1.5);
camTo(S('c29') - 0.2, S('c29') + 0.6, 440, 1075, 1.5);
camWide(S('c30'), S('c30') + 0.9);

// old screen in, then wiped away by the redesign
init('old', 0); init('wipe', 0);
to('old', S('c6') - 0.3, S('c6') + 0.2, 1, 'lin');
to('wipe', S('c8'), S('c8') + 1.0, 880, 'io');

// ---------- highlight rings on the phone (app coordinates) ----------
const RINGS = [
  { from: wordTime('c6', 'cycle day'), to: S('c8'), r: [302, 616, 542, 852], kind: 'bad', rad: '50%' },
  { from: wordTime('c6', 'day 3'), to: S('c8'), r: [282, 884, 598, 938], kind: 'bad', rad: '40px' },
  { from: S('c7'), to: S('c8'), r: [42, 982, 838, 998], kind: 'bad', rad: '16px' },
  { from: wordTime('c7', 'label'), to: S('c8'), r: [696, 1002, 840, 1028], kind: 'bad', rad: '16px' },
  { from: wordTime('c9', 'day 3'), to: S('c10') + 0.4, r: [315, 619, 566, 869], kind: 'good', rad: '50%' },
  { from: wordTime('c9', 'cycle is'), to: S('c10') + 0.4, r: [244, 900, 636, 956], kind: 'good', rad: '40px' },
  { from: wordTime('c9', 'bar shows'), to: S('c10') + 0.4, r: [66, 1016, 814, 1080], kind: 'good', rad: '22px' },
  { from: wordTime('c15', 'main pink'), to: wordTime('c15', 'deeper') - 0.1, r: [315, 619, 566, 869], kind: 'info', rad: '50%' },
  { from: wordTime('c15', 'deeper'), to: S('c17'), r: [163, 383, 497, 491], kind: 'info', rad: '60px' },
  { from: S('c18'), to: S('c20'), r: [46, 388, 834, 514], kind: 'info', rad: '34px' },
  { from: S('c29') + 0.3, to: S('c30'), r: [62, 1050, 818, 1086], kind: 'info', rad: '22px' },
];
for (const ring of RINGS) {
  const d = document.createElement('div');
  d.className = 'ring ' + ring.kind;
  const pad = 12;
  Object.assign(d.style, { left: ring.r[0] - pad + 'px', top: ring.r[1] - pad + 'px', width: ring.r[2] - ring.r[0] + 2 * pad + 'px', height: ring.r[3] - ring.r[1] + 2 * pad + 'px', borderRadius: ring.rad });
  $('hl').insertBefore(d, $('tap'));
  ring.el = d;
}

// ---------- panel slides and reveals ----------
const SLIDES = [...document.querySelectorAll('.slide, .sub')].map((el) => ({
  el, from: S(el.dataset.from), to: el.dataset.to === 'end' ? DURATION + 1 : S(el.dataset.to), sub: el.classList.contains('sub'),
}));
function revealTime(el) {
  let id = el.dataset.at;
  if (!id) { const sl = el.closest('.sub, .slide'); id = sl.dataset.from; }
  const base = el.dataset.word ? wordTime(id, el.dataset.word) : S(id);
  return base + (parseFloat(el.dataset.off) || 0);
}
const REVEALS = [...document.querySelectorAll('.rv')].map((el) => ({ el, t: revealTime(el) }));

// ---------- easing curve on the panel ----------
const BZ = [0.22, 1, 0.36, 1];
function bez(s, p1, p2) { const u = 1 - s; return 3 * u * u * s * p1 + 3 * u * s * s * p2 + s * s * s; }
function easeAt(x) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (bez(m, BZ[0], BZ[2]) < x) lo = m; else hi = m; }
  return bez((lo + hi) / 2, BZ[1], BZ[3]);
}
const cx = (x) => 60 + 370 * x, cy = (y) => 260 - 200 * y;
{
  let d = '';
  for (let i = 0; i <= 60; i++) { const s = i / 60; d += (i ? ' L ' : 'M ') + cx(bez(s, BZ[0], BZ[2])).toFixed(1) + ' ' + cy(bez(s, BZ[1], BZ[3])).toFixed(1); }
  $('easePath').setAttribute('d', d);
}

// ---------- subtitles ----------
const CHUNKS = [];
for (const c of CUES) {
  const words = c.text.split(' ');
  const L = c.text.length;
  let pos = 0;
  const wts = words.map((w) => { const t0 = c.start + c.speak * (pos / L); pos += w.length + 1; return { w, t: t0 }; });
  const n = Math.ceil(L / 90);
  const target = L / n;
  const groups = [];
  let cur = [], len = 0;
  for (const wt of wts) {
    cur.push(wt); len += wt.w.length + 1;
    const punct = /[,.?!:]$/.test(wt.w);
    if (groups.length < n - 1 && ((len >= target - 14 && punct) || len >= target + 8)) { groups.push(cur); cur = []; len = 0; }
  }
  if (cur.length) groups.push(cur);
  groups.forEach((g, i) => CHUNKS.push({ words: g, start: g[0].t - 0.15, end: i < groups.length - 1 ? groups[i + 1][0].t - 0.15 : c.slotEnd - 0.15 }));
}
let shownChunk = null;
function renderSubs(t) {
  const box = $('subs');
  const ch = CHUNKS.find((c) => t >= c.start && t < c.end);
  box.style.opacity = clamp((t - (CUES[0].start - 0.4)) / 0.3) * clamp((DURATION - 1.2 - t) / 0.4);
  if (!ch) return;
  if (ch !== shownChunk) {
    box.innerHTML = ch.words.map((w, i) => `<span class="w" data-i="${i}">${w.w.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`).join(' ');
    shownChunk = ch;
  }
  const spans = box.querySelectorAll('.w');
  let nowIdx = -1;
  ch.words.forEach((w, i) => { if (t >= w.t) nowIdx = i; });
  spans.forEach((s, i) => { s.className = 'w' + (i < nowIdx ? ' on' : i === nowIdx ? ' now' : ''); });
}

// ---------- colour token demo ----------
function mix(a, b, m) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * m).toString(16).padStart(2, '0')).join('');
}
const SWAP_ON = S('c21') + 1.0, SWAP_OFF = S('c22') - 0.6;

// ---------- render ----------
let MT_W = null;
function render(t) {
  // background drift
  $('blobA').style.transform = `translate(${Math.sin(t * 0.3) * 40}px, ${Math.cos(t * 0.25) * 30}px)`;
  $('blobB').style.transform = `translate(${Math.cos(t * 0.22) * 50}px, ${Math.sin(t * 0.28) * 40}px)`;
  $('blobC').style.transform = `translate(${Math.sin(t * 0.2) * 50}px, 0px)`;

  // progress bar across the top
  $('topfill').style.width = (1920 * clamp(t / DURATION)).toFixed(1) + 'px';

  // phone camera
  const fx = V('fx', t), fy = V('fy', t), k = Math.exp(V('lk', t));
  $('world').style.transform = `translate(${LCX - fx * k}px, ${LCY - fy * k}px) scale(${k})`;
  $('phone').style.transform = `translateY(${V('dy', t)}px) scale(${PS})`;

  // old screen and the wipe to the new one
  const wipe = V('wipe', t);
  $('oldLayer').style.opacity = wipe >= 879 ? 0 : V('old', t);
  $('oldLayer').style.clipPath = `inset(0px 0px 0px ${wipe}px)`;

  // rings
  for (const r of RINGS) {
    const op = clamp((t - r.from) / 0.25) * clamp((r.to - t) / 0.25);
    r.el.style.opacity = op;
    r.el.style.transform = `scale(${1 + 0.012 * Math.sin(t * 7.5)})`;
  }

  // colour token swap
  const m = clamp((t - SWAP_ON) / 0.4) * clamp((SWAP_OFF - t) / 0.4);
  const deep = mix('#e01b66', '#7c3aed', E.io(m));
  document.documentElement.style.setProperty('--deep', deep);
  document.querySelectorAll('.deephex').forEach((e) => { e.textContent = m > 0.5 ? '#7C3AED' : '#E01B66'; });

  // demo 1: logging a period day on circle 9
  const D0 = S('c27') + 0.7, D1 = S('c29') - 0.15, L1 = 2.4;
  const c4 = $('circ4');
  let f = 0, d = 0, g = 0, pop = 0, tapOp = 0, tapS = 1;
  if (t >= D0 && t < D1) {
    const u = (t - D0) % L1;
    const fr = clamp((u - 0.08) / 0.25);
    f = E.o(fr); pop = Math.sin(Math.PI * fr);
    d = E.o(clamp((u - 0.16) / 0.25));
    g = clamp((u - 0.08) / 1.0);
    const r = clamp((u - 1.95) / 0.3);
    f *= 1 - r; d *= 1 - r;
    const tp = clamp(u / 0.45);
    tapOp = u < 0.45 ? 0.9 * (1 - tp) : 0; tapS = 0.4 + 0.9 * E.o(tp);
  }
  c4.querySelector('.cFill').style.opacity = f;
  c4.querySelector('.cDash').style.opacity = 1 - f;
  c4.style.transform = `scale(${1 + 0.07 * pop})`;
  dot4.style.opacity = d;
  dot4.style.transform = `translateY(${(1 - d) * -16}px)`;
  const tap = $('tap');
  tap.style.left = COL_X[4] + 'px'; tap.style.top = CIRCLE_Y + 'px';
  tap.style.opacity = tapOp; tap.style.transform = `scale(${tapS})`;
  const ex = cx(g), ey = cy(easeAt(g));
  $('easeDot').setAttribute('cx', ex.toFixed(1)); $('easeDot').setAttribute('cy', ey.toFixed(1));
  // feel scale marker slides to 250 ms
  const sm = E.io(clamp((t - S('c28') - 0.4) / 0.8));
  $('scMark').style.left = 40 + 170 * sm + 'px';

  // demo 2: progress bar on open
  const P0 = S('c29') + 0.7, P1 = S('c30'), L2 = 2.2;
  let pw = 1;
  if (t >= P0 && t < P1) {
    const u = (t - P0) % L2;
    pw = E.o(clamp((u - 0.15) / 0.4)) * (1 - clamp((u - 1.75) / 0.25));
  } else if (t >= S('c29') && t < P0) pw = 1;
  $('fill').style.width = 80 * pw + 'px';
  $('fill').style.opacity = pw > 0.01 ? 1 : 0;
  $('bbFill').style.width = 11 * pw + '%';

  // motion token bars
  if (MT_W === null) MT_W = $('mt0').parentElement.offsetWidth;
  const M0 = S('c30') + 0.3, L3 = 2.6;
  [0.15, 0.25, 0.4].forEach((dur, i) => {
    const frac = [0.3, 0.5, 0.8][i];
    let p = 0;
    if (t >= M0) { const u = (t - M0) % L3; p = E.o(clamp((u - 0.1) / (dur * 4))) * (1 - clamp((u - 2.3) / 0.2)); }
    $('mt' + i).style.left = MT_W * frac * p + 'px';
  });

  // reduce motion demo
  const kn = E.io(clamp((t - S('c33') - 0.4) / 0.3));
  $('rmKnob').style.left = 6 + 54 * kn + 'px';
  $('rmToggle').style.background = mix('#e5e0e3', '#34c759', kn);
  let dd = 0, df = 0;
  const R0 = S('c33') + 0.8;
  if (t >= R0) {
    const u = (t - R0) % 1.8;
    const out = 1 - clamp((u - 1.45) / 0.25);
    dd = E.o(clamp((u - 0.1) / 0.4)) * out;
    df = clamp((u - 0.1) / 0.4) * out;
  }
  $('rmDrop').style.opacity = dd; $('rmDrop').style.transform = `translateY(${(1 - dd) * -40}px)`;
  $('rmFade').style.opacity = df;

  // section pills
  const bounds = [0.4, S('c11'), S('c24'), S('c34'), DURATION + 1];
  for (let i = 0; i < 4; i++) {
    const op = clamp((t - bounds[i]) / 0.3) * clamp((bounds[i + 1] - t) / 0.3);
    $('pill' + (i + 1)).style.opacity = op;
  }

  // layer cards: the active one turns pink
  $('L1').classList.toggle('active', t >= S('c14') && t < S('c17'));
  $('L2').classList.toggle('active', t >= S('c17') && t < S('c22'));
  $('L3').classList.toggle('active', t >= S('c22') && t < S('c24'));

  // slides
  for (const s of SLIDES) {
    const fi = clamp((t - s.from + 0.05) / 0.35);
    const fo = clamp((s.to + 0.05 - t) / 0.3);
    const op = Math.min(fi, fo);
    s.el.style.opacity = op;
    s.el.style.visibility = op > 0 ? 'visible' : 'hidden';
    if (!s.sub) s.el.style.transform = `translateY(${(1 - E.o(fi)) * 24 - (1 - fo) * 16}px)`;
  }
  for (const r of REVEALS) {
    const p = E.o(clamp((t - r.t) / 0.45));
    r.el.style.opacity = p;
    r.el.style.transform = `translateY(${(1 - p) * 18}px)`;
  }

  renderSubs(t);
  $('fade').style.opacity = clamp((t - (DURATION - 0.8)) / 0.8);
}

window.DURATION = DURATION;
window.renderAt = (t) => { render(t); return true; };
window.CUE_DATA = CUES.map((c) => ({ id: c.id, text: c.text, say: c.say || c.text, start: c.start, end: c.end, slotEnd: c.slotEnd }));
const qs = new URLSearchParams(location.search);
if (qs.has('t')) render(parseFloat(qs.get('t')));
