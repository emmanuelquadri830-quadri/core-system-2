// Rebuild of the new home screen in its own 880 px wide coordinate space
// (the exported PNG is 880 x 1300). Every element is absolutely positioned
// so it can be animated on its own.

const BG_STOPS = [
  [0, '#fa3078'], [61, '#fa357b'], [121, '#fb397e'], [181, '#fb3d81'],
  [241, '#fb4283'], [301, '#fb4686'], [361, '#fb4a8a'], [421, '#fb4f8d'],
  [481, '#fb5491'], [541, '#fb5b95'], [601, '#fb6399'], [661, '#fb6a9d'],
  [721, '#fb70a1'], [781, '#fb76a6'], [841, '#fa7aa9'], [901, '#fb80ae'],
  [961, '#fb83b0'], [1009, '#fb88b3'], [1060, '#fb8cb6'],
];

// Text boxes. x is the left edge (or centre when align is 'center', right
// edge when 'right'); y is the top of a line box whose line-height equals
// the font size. Values were fitted against the exported PNG.
const TXT = {
  todayLine: { text: 'Today, October 8', x: 40, y: 187, size: 30, weight: 700, ls: -0.2, color: '#fff' },
  monthLine: { text: 'October 2025', x: 104, y: 249, size: 49, weight: 800, ls: -1.25, color: '#fff', family: 'Inter Display' },
  cycleTitle: { text: 'TODAY IS CYCLE DAY', x: 440.5, y: 558, size: 38, weight: 800, ls: -0.6, color: '#fff', align: 'center' },
  bigNum: { text: '3', x: 444, y: 656, size: 172, weight: 800, ls: 0, color: '#fff', align: 'center' },
  pillText: { text: 'Menstrual Phase · Day 3/5', x: 440, y: 913.5, size: 26, weight: 600, ls: 0, color: '#e01b66', align: 'center' },
  avg: { text: 'Avg. cycle: 28 days', x: 72, y: 1019, size: 25, weight: 600, ls: 0, color: '#64748b' },
  pct: { text: '11% complete', x: 808, y: 1019, size: 25, weight: 700, ls: 0.2, color: '#b32070', align: 'right' },
  fertile: { text: 'Fertile window starts Oct 15 · 7 days away', x: 71, y: 1101, size: 30, weight: 400, ls: 0, color: '#0f172a' },
  todayPillText: { text: 'Today', x: 150, y: 1291, size: 26, weight: 600, ls: 0, color: '#b4254d', align: 'center' },
};

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const NUMS = ['5', '6', '7', '8', '9', '10', '11'];
const COL_X = DAYS.map((_, k) => 97.14 + k * 114.286);
const DAY_Y = 353;   // label line box top
const CIRCLE_Y = 437; // circle centre
const NUM_SIZE = 39;

const FLOWER = { cx: 440.5, cy: 744, rp: 46.2, d: 76.84, n: 8 };

function flowerPath({ cx, cy, rp, d, n }) {
  const step = (Math.PI * 2) / n;
  const half = step / 2;
  const v = d * Math.cos(half) + Math.sqrt(rp * rp - (d * Math.sin(half)) ** 2);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * step - half;
    pts.push([cx + v * Math.cos(a), cy + v * Math.sin(a)]);
  }
  let p = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 1; i <= n; i++) {
    const q = pts[i % n];
    p += ` A ${rp} ${rp} 0 0 1 ${q[0].toFixed(2)} ${q[1].toFixed(2)}`;
  }
  return p + ' Z';
}

function el(tag, attrs = {}, parent) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'style') Object.assign(e.style, v);
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v);
  }
  if (parent) parent.appendChild(e);
  return e;
}

function textBox(id, cfg, parent) {
  const align = cfg.align || 'left';
  const style = {
    position: 'absolute', top: cfg.y + 'px', whiteSpace: 'pre',
    fontSize: cfg.size + 'px', lineHeight: cfg.size + 'px', fontWeight: cfg.weight, fontFamily: cfg.family || 'Inter',
    letterSpacing: cfg.ls + 'px', color: cfg.color,
  };
  if (align === 'left') style.left = cfg.x + 'px';
  if (align === 'center') { style.left = (cfg.x - 400) + 'px'; style.width = '800px'; style.textAlign = 'center'; }
  if (align === 'right') { style.right = (880 - cfg.x) + 'px'; style.textAlign = 'right'; }
  const e = el('div', { id, 'data-cal': id, style }, parent);
  e.textContent = cfg.text;
  return e;
}

function buildApp(root) {
  const app = el('div', { id: 'app', style: { position: 'absolute', left: 0, top: 0, width: '880px', height: '1788px', background: '#f1f2f4', overflow: 'hidden' } }, root);

  // pink hero, the edges of the PNG are flat pink up to y=1200 with 70 px bottom corners
  const grad = BG_STOPS.map(([y, c]) => `${c} ${y}px`).join(', ');
  const hero = el('div', { id: 'hero', style: { position: 'absolute', left: 0, top: '140px', width: '880px', height: '1060px', borderRadius: '0 0 70px 70px', background: `linear-gradient(180deg, ${grad})`, overflow: 'hidden' } }, app);
  el('img', { id: 'leaves', src: 'assets/leaves.png', style: { position: 'absolute', left: 0, top: '460px', width: '880px', height: '400px' } }, hero);

  // bottom "Today" card, only its top shows on screen
  const tc = el('div', { id: 'todayCard', style: { position: 'absolute', left: '31px', top: '1228px', width: '820px', height: '360px', boxSizing: 'border-box', borderRadius: '40px', border: '2px solid #f5a3c1', borderLeft: '9px solid #fb3a7e', background: 'linear-gradient(180deg, #fef5f8, #fff9fb 120px)' } }, app);
  el('div', { id: 'todayPill', style: { position: 'absolute', left: '52px', top: '48px', width: '116px', height: '46px', boxSizing: 'border-box', borderRadius: '23px', border: '2px solid #fbd5e3', background: '#fee8ef' } }, tc);
  textBox('todayPillText', TXT.todayPillText, app);

  el('img', { id: 'header', src: 'assets/header.png', style: { position: 'absolute', left: 0, top: 0, width: '880px', height: '140px' } }, app);

  textBox('todayLine', TXT.todayLine, app);
  el('div', {
    id: 'calIcon', 'data-cal': 'calIcon', style: { position: 'absolute', left: '42px', top: '252px', width: '40px', height: '42px' },
    html: `<svg width="40" height="42" viewBox="42 252 40 42" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round">
      <rect x="45.5" y="259.5" width="33" height="30.5" rx="6.5"/>
      <line x1="45.5" y1="268.5" x2="78.5" y2="268.5"/>
      <line x1="55" y1="255" x2="55" y2="263"/><line x1="69" y1="255" x2="69" y2="263"/>
      <text x="63.6" y="284.6" fill="#fff" stroke="none" font-family="Inter" font-weight="700" font-size="16.5" text-anchor="middle">12</text></svg>`,
  }, app);
  textBox('monthLine', TXT.monthLine, app);
  el('div', { id: 'tri', 'data-cal': 'tri', style: { position: 'absolute', left: '434px', top: '264px', width: 0, height: 0, borderLeft: '13px solid transparent', borderRight: '13px solid transparent', borderTop: '17px solid #fff' } }, app);

  DAYS.forEach((d, k) => {
    const c = COL_X[k];
    const today = d === 'WED';
    const lab = el('div', { id: 'day' + k, 'data-cal': 'day' + k, style: { position: 'absolute', left: (c - 60) + 'px', width: '120px', top: DAY_Y + 'px', textAlign: 'center', fontSize: '24px', lineHeight: '24px', fontWeight: 500, letterSpacing: '0.5px', color: 'rgba(255,255,255,0.92)', whiteSpace: 'pre' } }, app);
    lab.textContent = d;
    if (today) {
      const b = el('div', { id: 'dayBold', 'data-cal': 'dayBold', style: { position: 'absolute', left: (c - 60) + 'px', width: '120px', top: DAY_Y + 'px', textAlign: 'center', fontSize: '24px', lineHeight: '24px', fontWeight: 800, letterSpacing: '0.3px', color: '#fff', whiteSpace: 'pre' } }, app);
      b.textContent = d;
    }
    if (today) el('div', { id: 'ring', style: { position: 'absolute', left: (c - 53) + 'px', top: (CIRCLE_Y - 53.5) + 'px', width: '106px', height: '107px', boxSizing: 'border-box', borderRadius: '50%', border: '4px solid #fff' } }, app);
    const circ = el('div', { id: 'circ' + k, style: { position: 'absolute', left: (c - 44) + 'px', top: (CIRCLE_Y - 44) + 'px', width: '88px', height: '88px', borderRadius: '50%' } }, app);
    // three stacked looks so the edit can cross-fade between them
    el('div', { class: 'cOutline', style: { position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.6)' } }, circ);
    el('div', { class: 'cFill', style: { position: 'absolute', inset: 0, borderRadius: '50%', background: '#e01b66', border: '2px solid #fff', opacity: 0 } }, circ);
    el('div', { class: 'cDash', style: { position: 'absolute', inset: 0, borderRadius: '50%', border: '2px dashed #fff', opacity: 0 } }, circ);
    const n = el('div', { id: 'num' + k, 'data-cal': 'num' + k, style: { position: 'absolute', left: (c - 60) + 'px', width: '120px', top: (CIRCLE_Y - 24) + 'px', textAlign: 'center', fontSize: NUM_SIZE + 'px', lineHeight: '48px', fontWeight: 700, color: '#fff', whiteSpace: 'pre' } }, app);
    n.textContent = NUMS[k];
  });
  [1, 2, 3].forEach((k) => {
    el('div', { id: 'dot' + k, class: 'dot', style: { position: 'absolute', left: (COL_X[k] - 5) + 'px', top: '497.5px', width: '10px', height: '10px', borderRadius: '50%', background: '#fff' } }, app);
  });

  textBox('cycleTitle', TXT.cycleTitle, app);

  const fp = flowerPath(FLOWER);
  el('div', {
    id: 'flowerWrap', style: { position: 'absolute', left: 0, top: 0, width: '880px', height: '1300px', pointerEvents: 'none' },
    html: `<svg width="880" height="1300" viewBox="0 0 880 1300" style="position:absolute;left:0;top:0;overflow:visible">
      <path id="flowerFill" d="${fp}" fill="#fb3179"/>
      <path id="flowerStroke" d="${fp}" fill="none" stroke="#fff" stroke-width="3"/></svg>`,
  }, app);
  textBox('bigNum', TXT.bigNum, app);

  el('div', { id: 'pill', style: { position: 'absolute', left: '244px', top: '900px', width: '392px', height: '56px', borderRadius: '28px', background: '#fff' } }, app);
  textBox('pillText', TXT.pillText, app);

  el('div', { id: 'card', style: { position: 'absolute', left: '40px', top: '989px', width: '800px', height: '173px', borderRadius: '40px', background: '#fff', boxShadow: '0 18px 44px rgba(196, 22, 92, 0.20), 0 4px 10px rgba(196, 22, 92, 0.06)' } }, app);
  textBox('avg', TXT.avg, app);
  textBox('pct', TXT.pct, app);
  el('div', { id: 'track', style: { position: 'absolute', left: '73px', top: '1062px', width: '734px', height: '12px', borderRadius: '6px', background: '#f7dce7', overflow: 'hidden' } }, app);
  el('div', { id: 'fill', style: { position: 'absolute', left: '73px', top: '1062px', width: '80px', height: '12px', borderRadius: '6px', background: '#fb3179' } }, app);
  const f = textBox('fertile', TXT.fertile, app);
  f.innerHTML = '';
  el('span', { id: 'fA' }, f).textContent = 'Fertile window starts ';
  el('span', { id: 'fB', style: { fontWeight: 700 } }, f).textContent = 'Oct 15';
  el('span', { id: 'fC', style: { color: '#b32070' } }, f).textContent = ' · 7 days away';

  return app;
}
