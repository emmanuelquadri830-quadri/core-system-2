// Proof (beats 28-32), remix: one verified number. The Mowe Prime keys flyer
// prints "₦2 MILLION INITIAL DEPOSIT"; the odometer rolls to it on the same
// tick schedule the sound pass uses. On 29 the flyer itself slides in as the
// source, on 29.5 the pin lands on that exact line of it, on 31 the pin
// leaves and the paper of the next section rises over everything.

import { el, place, spring, clamp } from '../../film/engine.js';
import { makeShot, textWidth, impulse } from '../../film/kit.js';
import { counterTicks } from '../timeline.mjs';

const TARGET = 2000000;
const PATTERN = 'd,ddd,ddd';
// The deposit badge on mowe-keys.png, in flyer pixels.
const BADGE = [12, 140, 190, 56];
const ROLL = [1600, 80, 1]; // critically damped and quick: settled 0.15 s after the last tick

// Digit wheels with fixed separators. All seven wheels show from the start,
// so the line reads like a meter and never reflows: 0,000,000 to 2,000,000.
function makeOdometer(parent, { size, color }) {
  const node = el('div', 'counter display', parent);
  Object.assign(node.style, { position: 'absolute', left: '0px', top: '0px', display: 'flex', color, fontSize: `${size}px`, fontWeight: 500, fontFamily: 'var(--display)', lineHeight: '1', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' });
  const digitW = textWidth('0', { size, weight: 500, tracking: 0 });
  const sepW = textWidth(',', { size, weight: 500, tracking: 0 });
  const n = PATTERN.replace(/[^d]/g, '').length;
  const wheels = [];
  for (const ch of PATTERN) {
    if (ch !== 'd') {
      const s = el('div', '', node, { text: ch });
      Object.assign(s.style, { height: `${size}px`, width: `${sepW}px` });
      continue;
    }
    const mask = el('div', '', node);
    Object.assign(mask.style, { position: 'relative', height: `${size}px`, width: `${digitW}px`, overflow: 'hidden' });
    const strip = el('div', '', mask);
    Object.assign(strip.style, { position: 'absolute', left: '0px', top: '0px', width: '100%' });
    // 0..9 then 0 again, so 9 -> 0 rolls forward.
    for (let d = 0; d <= 10; d++) {
      const c = el('div', '', strip, { text: String(d % 10) });
      Object.assign(c.style, { height: `${size}px`, textAlign: 'center' });
    }
    wheels.push({ strip, unit: Math.pow(10, n - 1 - wheels.length) });
  }
  const width = digitW * n + sepW * (PATTERN.length - n);
  return {
    node,
    width,
    update(t, ticks) {
      const values = ticks.map((tk) => Math.round(TARGET * tk.x));
      let now = 0;
      for (let k = 0; k < ticks.length; k++) if (t >= ticks[k].t) now = k;
      for (const { strip, unit } of wheels) {
        const digit = (v) => Math.floor(v / unit) % 10;
        let pos = digit(values[0]);
        let cur = pos;
        for (let k = 1; k <= now; k++) {
          const d = digit(values[k]);
          if (d !== cur) {
            pos += ((d - cur + 10) % 10) * Math.min(1, spring(t - ticks[k].t, ROLL));
            cur = d;
          }
        }
        const wheel = ((pos % 10) + 10) % 10;
        strip.style.transform = `translate3d(0, ${(-wheel * size).toFixed(2)}px, 0)`;
      }
    },
  };
}

export default function proof(ctx) {
  const { stage, W, H, AR, T, L, cueT, clock } = ctx;
  const root = el('div', 'scene proof', stage);
  root.style.background = 'var(--fg)';

  const size = L({ '16x9': 196, '1x1': 132, '9x16': 150 });
  const x0 = L({ '16x9': 130, '1x1': 70, '9x16': 80 });
  const top = L({ '16x9': 400, '1x1': 250, '9x16': 400 });

  const group = el('div', 'layer', root);
  const naira = el('div', '', group, { text: '₦' });
  Object.assign(naira.style, { position: 'absolute', left: '0px', top: '0px', font: `500 ${size}px Inter, sans-serif`, color: '#FFFFFF', lineHeight: '1' });
  const nairaW = textWidth('₦', { size, weight: 500, family: 'Inter, sans-serif', tracking: 0 }) + size * 0.04;
  const odo = makeOdometer(group, { size, color: '#FFFFFF' });

  const ks = L({ '16x9': 32, '1x1': 24, '9x16': 30 });
  const kicker = el('div', 'layer', group, { text: 'MOWE PRIME · INITIAL DEPOSIT' });
  Object.assign(kicker.style, { font: `500 ${ks}px var(--ui)`, letterSpacing: '0.18em', color: '#8FB6F5', whiteSpace: 'nowrap' });
  const ls = L({ '16x9': 56, '1x1': 40, '9x16': 48 });
  const labelLines = L({ '16x9': ['Own a piece of Mowe Prime today.'], '1x1': ['Own a piece of', 'Mowe Prime today.'], '9x16': ['Own a piece of', 'Mowe Prime today.'] });
  const label = el('div', 'layer', group, { html: labelLines.join('<br>') });
  Object.assign(label.style, { font: `400 ${ls}px var(--ui)`, color: 'rgba(255,255,255,0.74)', whiteSpace: 'nowrap', lineHeight: '1.18' });

  // The flyer, a real card. It arrives on 29, a little tilted, like a print
  // laid on the desk next to the figure.
  const fl = { w: 406, h: 526 };
  const card = makeShot(root, { src: ctx.asset('flyers/mowe-keys.png'), iw: fl.w, ih: fl.h, radius: L({ '16x9': 22, '1x1': 18, '9x16': 24 }) });
  card.node.style.boxShadow = '0 50px 100px -30px rgba(0,0,0,0.65)';
  const slot = L({ '16x9': [1340, 250, 450, 583], '1x1': [610, 420, 390, 505], '9x16': [200, 860, 680, 881] });
  const tilt = L({ '16x9': 3, '1x1': 3, '9x16': 2 });
  const cardIn = cueT('source-in');
  const cardK = (t) => clamp(spring(t - cardIn + 0.1, [380, 30, 1]), 0, 1.08);
  // Stage position of a flyer pixel, rotation included. Pure in t.
  const flyerToStage = (t, fx, fy) => {
    const [sx, sy, sw, sh] = slot;
    const k = cardK(t);
    const z = sw / fl.w;
    const cx = sx + sw / 2;
    const cy = sy + sh / 2 + (1 - k) * (H - sy + 80);
    const r = ((tilt + 9 * (1 - k)) * Math.PI) / 180;
    const dx = (fx - fl.w / 2) * z;
    const dy = (fy - fl.h / 2) * z;
    return [cx + dx * Math.cos(r) - dy * Math.sin(r), cy + dx * Math.sin(r) + dy * Math.cos(r)];
  };
  // The pin lands on the top edge of the badge, right of the figure.
  ctx.targets.badge = (t) => flyerToStage(t, BADGE[0] + BADGE[2] * 0.9, BADGE[1] + 4);
  ctx.targets['proof-exit'] = () => [W * L({ '16x9': 0.86, '1x1': 0.8, '9x16': 0.75 }), -H * 0.3];

  const paper = el('div', 'layer', root);
  Object.assign(paper.style, { width: `${W}px`, height: `${H}px`, background: 'var(--bg)' });

  return {
    id: 'proof',
    root,
    from: T(28),
    to: T(32),
    update(t) {
      const t0 = T(28);
      // The figure lands hard on the downbeat and keeps a slow drift.
      const hit = spring(t - t0, 'slam');
      const drift = spring(t - t0, 'drift');
      group.style.transformOrigin = `${x0}px ${top + size / 2}px`;
      place(group, { x: -16 * drift, y: impulse(t - t0) * 16, s: 1.14 - 0.14 * hit + 0.02 * drift, show: true });
      place(naira, { x: x0, y: top, show: true });
      odo.update(t, counterTicks(cueT('count'), clock.period));
      place(odo.node, { x: x0 + nairaW, y: top, show: true });

      const kk = clamp(spring(t - t0 - 0.04, 'soft'), 0, 1);
      place(kicker, { x: x0 + 6, y: top - ks * 2.3, show: true, clip: `inset(-10px ${((1 - kk) * 100).toFixed(1)}% -10px 0)` });
      const tl = T(28.5);
      const kl = clamp(spring(t - tl, 'soft'), 0, 1);
      place(label, { x: x0 + 4, y: top + size * 1.08 + (1 - kl) * ls * 0.6, show: t >= tl, clip: `inset(-10px 0 ${((1 - kl) * 100).toFixed(1)}% 0)` });

      const k = cardK(t);
      const [sx, sy, sw, sh] = slot;
      card.set({ x: sx, y: sy + (1 - k) * (H - sy + 80), w: sw, h: sh, r: tilt + 9 * (1 - k), camX: fl.w / 2, camY: fl.h / 2, zoom: sw / fl.w, show: t >= cardIn - 0.12 });

      // Paper rises from 31 and owns the frame by 32.
      const pr = clamp(spring(t - T(31), 'heavy'), 0, 1);
      place(paper, { y: H * (1 - pr), show: t >= T(31) });
      paper.style.zIndex = 10;
    },
  };
}
