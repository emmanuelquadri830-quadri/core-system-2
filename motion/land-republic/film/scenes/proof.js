// 6. Proof (beats 28-32): one number from the site, rolled up on the counter
// schedule that also drives the tick sounds, with the Civic renders drifting
// behind it. On 29.5 the site's own card slides in as the source. From 31 the
// paper of the next section rises and takes the frame.
//
// The number is the blue card on the Land Hackers page: "SELL LAND OR
// PROPERTY / 10% - 15% / Commission".

import { el, place, spring, clamp } from '../engine.js';
import { makeShot, makeCounter, makeWord, textWidth, impulse } from '../kit.js';
import { counterTicks } from '../../timeline.mjs';

export default function proof(ctx) {
  const { stage, W, H, AR, T, L, cueT, clock, manifest: M } = ctx;
  const root = el('div', 'scene proof', stage);
  root.style.background = 'var(--ink)';
  const I = M.images;
  const pf = M.proof;
  const P = M.page;

  // Property imagery moving behind the number: three strips, opposite drifts.
  const strips = ['front', 'perspective', 'aerial'].map((k) => {
    const s = makeShot(root, { src: ctx.asset(I[k].file), iw: I[k].w, ih: I[k].h });
    s.node.style.background = 'transparent';
    return { s, im: I[k] };
  });
  const shade = el('div', 'layer', root);
  Object.assign(shade.style, { width: `${W}px`, height: `${H}px`, background: 'var(--ink)' });

  const size = L({ '16x9': 300, '1x1': 230, '9x16': 250 });
  const group = el('div', 'layer', root);
  const a = makeCounter(group, { target: pf.from, digits: 2, size, weight: 500 });
  const pct1 = makeWord(group, '%', { size, weight: 500, color: 'var(--white)' });
  const dash = makeWord(group, '–', { size, weight: 500, color: 'var(--white)' });
  const b = makeCounter(group, { target: pf.to, digits: 2, size, weight: 500 });
  const pct2 = makeWord(group, '%', { size, weight: 500, color: 'var(--white)' });
  const kicker = el('div', 'layer', group, { text: pf.kicker.toUpperCase() });
  const label = el('div', 'layer', group, { text: pf.label });
  const ks = L({ '16x9': 40, '1x1': 34, '9x16': 42 });
  const ls = L({ '16x9': 84, '1x1': 68, '9x16': 80 });
  Object.assign(kicker.style, { font: `500 ${ks}px var(--ui)`, letterSpacing: '0.16em', color: '#4C8EF0', whiteSpace: 'nowrap' });
  Object.assign(label.style, { font: `400 ${ls}px var(--ui)`, color: 'var(--white)', whiteSpace: 'nowrap' });

  // Measure the number so it can be laid out as one line (two in 9:16).
  const digitW = size * 0.62;
  const pctW = textWidth('%', { size, weight: 500 });
  const dashW = textWidth('–', { size, weight: 500 }) + size * 0.12;
  const twoLines = AR !== '16x9';
  const x0 = L({ '16x9': 130, '1x1': 70, '9x16': 80 });
  const lineW1 = digitW * 2 + pctW + (twoLines ? 0 : dashW);
  const top = L({ '16x9': 300, '1x1': 250, '9x16': 560 });

  // The source card, a real crop.
  const cb = P.targets.cardBlue;
  const cz = L({ '16x9': 2.6, '1x1': 2.2, '9x16': 2.9 });
  const card = el('div', 'shot', root);
  const cimg = el('img', '', card, { src: ctx.asset(P.file) });
  Object.assign(card.style, { width: `${cb[2] * cz}px`, height: `${cb[3] * cz}px`, borderRadius: `${3 * cz}px`, background: 'transparent', boxShadow: '0 30px 60px -20px rgba(0,0,0,0.6)' });
  Object.assign(cimg.style, { width: `${P.w}px`, height: `${P.h}px`, transformOrigin: '0 0', transform: `translate3d(${-cb[0] * cz}px, ${-cb[1] * cz}px, 0) scale(${cz})` });

  // The paper that rises into the next section.
  const paper = el('div', 'layer', root);
  Object.assign(paper.style, { width: `${W}px`, height: `${H}px`, background: 'var(--paper)' });

  return {
    id: 'proof',
    root,
    from: T(28),
    to: T(32),
    update(t) {
      const t0 = T(28);
      // strips
      const n = strips.length;
      strips.forEach(({ s, im }, i) => {
        const vertical = AR !== '9x16';
        const w = vertical ? W / n : W;
        const h = vertical ? H : H / n;
        const x = vertical ? i * w : 0;
        const y = vertical ? 0 : i * h;
        const z = Math.max(w / im.w, h / im.h) * 1.25;
        const dir = i % 2 ? 1 : -1;
        const drift = dir * 90 * spring(t - t0, 'drift');
        s.set({ x, y, w, h, camX: im.w / 2 + (vertical ? 0 : drift / z), camY: im.h / 2 + (vertical ? drift / z : 0), zoom: z, show: true });
      });
      place(shade, { show: true, o: 0.78 });

      // number
      const hit = spring(t - t0, 'slam');
      group.style.transformOrigin = `${x0}px ${top + size / 2}px`;
      place(group, { x: 0, y: impulse(t - t0) * 18, s: 1.12 - 0.12 * hit, show: true });
      const ticks = counterTicks(cueT('count'), clock.period);
      a.update(t, ticks);
      b.update(t, ticks);
      let x = x0;
      const y = top;
      place(a.node, { x, y, show: true });
      x += digitW * 2;
      place(pct1, { x, y: y - size * 0.02, show: true });
      x += pctW;
      if (twoLines) {
        place(dash, { x: x + size * 0.06, y: y - size * 0.02, show: true });
        place(b.node, { x: x0, y: y + size * 1.02, show: true });
        place(pct2, { x: x0 + digitW * 2, y: y + size * 1.0, show: true });
      } else {
        place(dash, { x: x + size * 0.04, y: y - size * 0.02, show: true });
        x += dashW;
        place(b.node, { x, y, show: true });
        place(pct2, { x: x + digitW * 2, y: y - size * 0.02, show: true });
      }
      place(kicker, { x: x0 + 8, y: y - ks * 2.4, show: true });
      const below = twoLines ? y + size * 2.15 : y + size * 1.12;
      place(label, { x: x0 + 6, y: below, show: true });

      // source card on 29.5
      const tc = cueT('source-card');
      const kc = spring(t - tc, 'snap');
      const cw = cb[2] * cz;
      const ch = cb[3] * cz;
      const cpos = L({ '16x9': [W - cw - 110, H - ch - 100], '1x1': [W - cw - 60, H - ch - 60], '9x16': [W - cw - 70, 1480] });
      place(card, { x: cpos[0] + (1 - kc) * (cw + 140), y: cpos[1], r: 4 * (1 - kc), show: t >= tc });

      // paper rises from 31 and owns the frame by 32
      const pr = clamp(spring(t - T(31), 'heavy'), 0, 1);
      place(paper, { y: H * (1 - pr), show: t >= T(31) });
    },
  };
}
