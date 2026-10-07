// 1. Hook: "Finding the right land shouldn't be this hard."
// Words stamp in on their beats over a wall of real listing fragments that
// gets busier until "hard." lands and the frame recoils. On beat 7.75 the
// frame empties for the silent sixteenth before the drop.

import { el, place, spring, track, clamp } from '../engine.js';
import { layoutLines, makeWord, impulse, cssVar } from '../kit.js';

const WORDS = ['Finding', 'the', 'right', 'land', "shouldn't", 'be', 'this', 'hard.'];
const BEAT_OF = [0, 1, 1, 2, 4, 5, 5, 6];

const LINES = {
  '16x9': [[0, 1, 2, 3], [4, 5, 6, 7]],
  '1x1': [[0, 1], [2, 3], [4, 5], [6, 7]],
  '9x16': [[0], [1, 2], [3], [4], [5, 6], [7]],
};

export default function hook(ctx) {
  const { stage, W, H, AR, T, L } = ctx;
  const root = el('div', 'scene hook', stage);
  const wall = el('div', 'layer', root);
  const group = el('div', 'layer', root);

  const size = L({ '16x9': 158, '1x1': 150, '9x16': 168 });
  const lines = LINES[AR];
  const leading = 1.0;
  const blockH = size * leading * (lines.length - 1);
  const x0 = L({ '16x9': 132, '1x1': 92, '9x16': 84 });
  const y0 = L({ '16x9': H / 2 - blockH / 2 + size * 0.36, '1x1': H / 2 - blockH / 2 + size * 0.36, '9x16': H * 0.5 - blockH / 2 + size * 0.3 });
  const weight = 800;
  const pos = layoutLines(WORDS, lines, { size, leading, x0, y0, weight, tracking: -0.02 });

  const words = WORDS.map((w, i) => {
    const node = makeWord(group, w, { size, weight, color: i === 7 ? 'var(--accent)' : 'var(--paper)' });
    node.style.left = '0px';
    node.style.top = '0px';
    return node;
  });

  // Listing fragments behind the type. Filled from the manifest once the
  // site is captured; until then the wall stays empty rather than faked.
  const frags = (ctx.manifest?.hook?.fragments || []).map((f) => {
    const box = el('div', 'shot', wall);
    const img = el('img', '', box, { src: ctx.asset(f.file) });
    return { box, img, f };
  });

  const tEnd = T(7.75);
  const tHard = T(6);

  return {
    id: 'hook',
    update(t) {
      const on = t < T(8);
      root.style.visibility = on ? 'visible' : 'hidden';
      if (!on) return;

      // Gap before the drop: an empty accent field, nothing else.
      if (t >= tEnd) {
        root.style.background = 'var(--accent)';
        group.style.visibility = 'hidden';
        wall.style.visibility = 'hidden';
        return;
      }
      root.style.background = 'var(--ink)';
      group.style.visibility = 'visible';
      wall.style.visibility = 'visible';

      // Camera: a slow push out over the whole hook, a recoil when "hard." hits,
      // and on beat 7 the block is thrown up and out of frame.
      const push = 1.14 - 0.14 * spring(t, 'drift');
      const recoil = impulse(t - tHard) * L({ '16x9': 26, '1x1': 22, '9x16': 30 });
      const exit = spring(t - T(7), 'heavy');
      const gx = W * 0.5;
      const gy = H * 0.5;
      group.style.transformOrigin = `${gx}px ${gy}px`;
      place(group, { x: 0, y: recoil - exit * H * 1.1, s: push - 0.08 * exit, show: true });

      WORDS.forEach((w, i) => {
        const tb = T(BEAT_OF[i]);
        const node = words[i];
        const p = pos[i];
        if (t < tb) {
          place(node, { show: false });
          return;
        }
        const k = spring(t - tb, 'slam');
        const big = i === 7 ? 2.6 : 1.9;
        const s = big + (1 - big) * k;
        // Stamp from the word's own centre so it lands where it reads.
        node.style.transformOrigin = `${p.w / 2}px ${size * 0.46}px`;
        place(node, { x: p.x, y: p.y - size * 0.82, s, show: true });
      });

      frags.forEach(({ box }, i) => {
        place(box, { show: false });
      });
    },
  };
}
