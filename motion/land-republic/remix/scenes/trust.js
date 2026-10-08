// Trust (beats 26-28), remix: "Find it. Own it. Build on it." in two
// seconds. The story's pin lands on the real Civic Apartment plot on 26.25,
// the boundary draws on 26.6, the building rises on 27 and the site's own
// "Verified Listings Access" card stamps on 27.5.

import { el, place, spring, clamp, wipe } from '../../film/engine.js';
import { makeShot, makeWord, makeBoundary, impulse } from '../../film/kit.js';

const PHRASES = ['Find it.', 'Own it.', 'Build on it.'];
// Plot boundary on the aerial render (image pixels), traced around the
// building along its perimeter wall.
const PLOT = [[30, 470], [470, 70], [965, 420], [560, 1010]];
const PIN_AT = [505, 520];

export default function trust(ctx) {
  const { stage, W, H, AR, T, L, cueT, manifest: M } = ctx;
  const root = el('div', 'scene trust', stage);
  root.style.background = 'var(--bg)';
  const A = M.images.aerial;
  const B = M.images.perspective;
  const P = M.page;

  const panel = L({ '16x9': [900, 70, W - 970, H - 140], '1x1': [50, 50, W - 100, 560], '9x16': [60, 90, W - 120, 1040] });
  const aerial = makeShot(root, { src: ctx.asset(A.file), iw: A.w, ih: A.h });
  const build = makeShot(root, { src: ctx.asset(B.file), iw: B.w, ih: B.h });
  const plot = makeBoundary(root, W, H);

  // The real card, cut from the page.
  const vc = P.targets.cardVerified;
  const card = el('div', 'shot', root);
  const cardImg = el('img', '', card, { src: ctx.asset(P.file) });
  const cz = L({ '16x9': 3.8, '1x1': 3.4, '9x16': 4.6 });
  Object.assign(card.style, { width: `${vc[2] * cz}px`, height: `${vc[3] * cz}px`, borderRadius: `${4 * cz}px`, background: 'transparent', boxShadow: '0 30px 60px -20px rgba(52,50,45,0.6)' });
  Object.assign(cardImg.style, { width: `${P.w}px`, height: `${P.h}px`, transformOrigin: '0 0', transform: `translate3d(${-vc[0] * cz}px, ${-vc[1] * cz}px, 0) scale(${cz})` });

  const size = L({ '16x9': 128, '1x1': 100, '9x16': 132 });
  const x0 = L({ '16x9': 110, '1x1': 64, '9x16': 80 });
  const step = size * 1.2;
  const firstBase = L({ '16x9': (H - 2 * step) / 2 + size * 0.3, '1x1': 760, '9x16': 1300 });
  const words = PHRASES.map((p) => makeWord(root, p, { size, weight: 500, color: 'var(--fg)' }));
  const beats = [26, 26.5, 27];
  aerial.node.style.borderRadius = build.node.style.borderRadius = '30px';
  aerial.node.style.boxShadow = '0 50px 90px -40px rgba(52,50,45,0.45)';
  // Pure mapping of the aerial camera, so the pin can aim at the plot at
  // any t without depending on the last frame drawn.
  const aerialZoom = (t) => Math.max(panel[2] / A.w, panel[3] / A.h) * 1.12 * (1 + 0.1 * spring(t - T(26), 'drift'));
  const aerialStage = (t, x, y) => [panel[0] + panel[2] / 2 + (x - 500) * aerialZoom(t), panel[1] + panel[3] / 2 + (y - 560) * aerialZoom(t)];
  ctx.targets.plot = (t) => aerialStage(t, ...PIN_AT);

  return {
    id: 'trust',
    root,
    from: T(26),
    to: T(28),
    update(t) {
      const [px, py, pw, ph] = panel;
      // Aerial: a slow push toward the plot.
      const cover = Math.max(pw / A.w, ph / A.h) * 1.12;
      const push = cover * (1 + 0.1 * spring(t - T(26), 'drift'));
      aerial.set({ x: px, y: py, w: pw, h: ph, camX: 500, camY: 560, zoom: push, show: true });

      // Find it: the story's pin (scenes/pin.js) lands on PIN_AT on 26.25.

      // Own it: the boundary draws from 25.
      const pts = PLOT.map(([x, y]) => aerial.toStage(x, y));
      plot.update(t, cueT('boundary') - 0.1, pts, { clip: panel });

      // Build on it: the building rises over the aerial.
      const tb = T(27);
      const rise = clamp(spring(t - tb, 'heavy'), 0, 1.15);
      const bc = Math.max(pw / B.w, ph / B.h) * 1.1;
      build.set({ x: px, y: py, w: pw, h: ph, camX: 520, camY: 600 + 180 * (1 - Math.min(1, rise)), zoom: bc * (1.05 - 0.05 * spring(t - tb, 'soft')), show: t >= tb, clip: wipe(Math.min(1, rise), 'up') });
      // The pin and the plot belong to the aerial; the building covers them.
      build.node.style.zIndex = 5;

      // Verified: the site's own card stamps onto the picture on 27.
      const ts = cueT('verified');
      const ks = spring(t - ts, 'slam');
      const cw = vc[2] * cz;
      const chh = vc[3] * cz;
      const cpos = L({ '16x9': [W - cw - 70, H - chh - 70], '1x1': [W - cw - 40, 620 - chh - 40], '9x16': [W - cw - 50, 1100 - chh - 60] });
      card.style.transformOrigin = '50% 50%';
      card.style.zIndex = 8;
      place(card, { x: cpos[0], y: cpos[1], s: 1.6 - 0.6 * ks, r: -6 * (1 - ks) + 2 * impulse(t - ts, [700, 26, 1]), show: t >= ts });

      // Phrases: the newest is white, the ones before step back.
      PHRASES.forEach((p, i) => {
        const ti = T(beats[i]);
        const node = words[i];
        const k = spring(t - ti, 'slam');
        const newest = i === 2 || t < T(beats[i + 1]);
        node.style.color = newest ? 'var(--fg)' : '#BDB8AE';
        node.style.transformOrigin = `0 ${size * 0.5}px`;
        node.style.zIndex = 9;
        place(node, { x: x0, y: firstBase + i * step - size * 0.82 + (1 - k) * size * 0.25, s: 1.35 - 0.35 * k, show: t >= ti });
      });
    },
  };
}
