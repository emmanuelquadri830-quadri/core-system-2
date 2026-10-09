// 7. Next (beats 32-36): "Find your next property." on the site's light paper,
// the Civic front elevation in a window beside it. On 35 the window opens to
// the full frame; 35.75 is the silent sixteenth before the logo.

import { el, place, spring, clamp } from '../engine.js';
import { makeShot, makeWord, layoutLines } from '../kit.js';

const WORDS = ['Find', 'your', 'next', 'property.'];
const BEAT_OF = [32, 32, 32, 33];

export default function next(ctx) {
  const { stage, W, H, AR, T, L, manifest: M } = ctx;
  const root = el('div', 'scene next', stage);
  root.style.background = 'var(--paper)';
  const F = M.images.front;

  const win = makeShot(root, { src: ctx.asset(F.file), iw: F.w, ih: F.h });
  const size = L({ '16x9': 150, '1x1': 124, '9x16': 150 });
  const lines = L({ '16x9': [[0, 1], [2], [3]], '1x1': [[0, 1, 2], [3]], '9x16': [[0, 1], [2], [3]] });
  const x0 = L({ '16x9': 110, '1x1': 70, '9x16': 80 });
  const y0 = L({ '16x9': 330, '1x1': 210, '9x16': 300 });
  const pos = layoutLines(WORDS, lines, { size, leading: 1.0, x0, y0, weight: 500, tracking: -0.025 });
  const words = WORDS.map((w, i) => makeWord(root, w, { size, weight: 500, color: i === 3 ? 'var(--accent)' : 'var(--ink)' }));
  const box = L({
    '16x9': [1130, 110, 680, 860],
    '1x1': [500, 470, 520, 560],
    '9x16': [80, 900, 920, 900],
  });

  return {
    id: 'next',
    root,
    from: T(32),
    to: T(35.75),
    update(t) {
      const grow = clamp(spring(t - T(32), 'heavy'), 0, 1.1);
      const open = clamp(spring(t - T(35), 'heavy'), 0, 1);
      const [bx, by, bw, bh] = box;
      const r = [bx * (1 - open), by * (1 - open), bw + (W - bw) * open, bh + (H - bh) * open];
      const cover = Math.max(r[2] / F.w, r[3] / F.h) * 1.08;
      win.set({
        x: r[0], y: r[1], w: r[2], h: r[3],
        camX: F.w / 2, camY: F.h * 0.55 - 40 * spring(t - T(32), 'drift'), zoom: cover,
        show: true, clip: `inset(${((1 - Math.min(1, grow)) * 100).toFixed(2)}% 0 0 0 round ${(24 * (1 - open)).toFixed(1)}px)`,
      });
      win.node.style.zIndex = 5;
      WORDS.forEach((w, i) => {
        const tb = T(BEAT_OF[i]) + (i < 3 ? i * 0.04 : 0);
        const k = spring(t - tb, 'slam');
        const p = pos[i];
        words[i].style.transformOrigin = `0 ${size * 0.5}px`;
        place(words[i], { x: p.x, y: p.y - size * 0.82 + (1 - k) * size * 0.25, s: 1.3 - 0.3 * k, show: t >= tb });
      });
    },
  };
}
