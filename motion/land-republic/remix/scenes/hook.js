// Hook (beats 0-8). The pin places the problem: it lands on each word as the
// word stamps in, searches the real Lagos aerial on beat 3, slams "hard."
// into place, then is thrown out of the top as the charcoal field rises.

import { el, place, spring, clamp } from '../../film/engine.js';
import { layoutLines, makeWord, impulse, makeShot } from '../../film/kit.js';

const WORDS = ['Finding', 'the', 'right', 'land', "shouldn't", 'be', 'this', 'hard.'];
const BEAT_OF = [0, 1, 1, 2, 4, 5, 5, 6];
const PIN_WORD = { 'w-finding': 0, 'w-the': 1, 'w-land': 3, 'w-shouldnt': 4, 'w-be': 5, 'w-hard': 7 };
const LINES = {
  '16x9': [[0, 1], [2, 3], [4, 5], [6, 7]],
  '1x1': [[0, 1], [2, 3], [4, 5], [6, 7]],
  '9x16': [[0], [1, 2], [3], [4], [5, 6], [7]],
};

export default function hook(ctx) {
  const { stage, W, H, AR, T, L, manifest: M } = ctx;
  const root = el('div', 'scene hook', stage);
  root.style.background = 'var(--bg)';
  const page = M.page;
  const city = makeShot(root, { src: ctx.asset(page.file), iw: page.w, ih: page.h, radius: 28 });

  const group = el('div', 'layer', root);
  const chip = el('div', 'shot', group);
  const chipImg = el('img', '', chip, { src: ctx.asset(M.images.aerial.file) });
  const size = L({ '16x9': 196, '1x1': 158, '9x16': 188 });
  const lines = LINES[AR];
  const leading = 1.08;
  const x0 = L({ '16x9': 150, '1x1': 74, '9x16': 82 });
  const blockH = size * leading * lines.length;
  const y0 = (H - blockH) / 2 + size * 0.78 + L({ '16x9': 30, '1x1': 30, '9x16': 40 });
  const pos = layoutLines(WORDS, lines, { size, leading, x0, y0, weight: 500, tracking: -0.03 });
  const words = WORDS.map((w, i) => {
    const n = makeWord(group, w, { size, weight: 500, color: i === 7 ? 'var(--accent)' : 'var(--fg)' });
    n.style.letterSpacing = '-0.03em';
    return n;
  });
  const field = el('div', 'layer', root);
  Object.assign(field.style, { width: `${W}px`, height: `${H}px`, background: 'var(--fg)' });

  const push = (t) => 1.06 - 0.06 * spring(t, 'drift');
  const recoil = (t) => impulse(t - T(6)) * L({ '16x9': 34, '1x1': 28, '9x16': 38 });
  // Stage position of a word's top centre, following the group's camera.
  const wordTop = (i, t) => {
    const p = pos[i];
    const s = push(t);
    const ox = x0;
    const oy = H / 2;
    const x = ox + (p.x + p.w / 2 - ox) * s;
    const y = oy + (p.y - size * 0.74 - oy) * s + recoil(t);
    return [x, y];
  };
  for (const [name, i] of Object.entries(PIN_WORD)) ctx.targets[name] = (t) => wordTop(i, t);
  ctx.targets['search-1'] = () => [W * 0.8, H * 0.32];
  ctx.targets['search-2'] = () => [W * 0.64, H * 0.74];
  ctx.targets['search-3'] = () => [W * 0.9, H * 0.58];
  ctx.targets['exit-top'] = () => [W * 0.55, -H * 0.3];

  return {
    id: 'hook',
    root,
    from: 0,
    to: T(8),
    update(t) {
      const chaos = t >= T(3) && t < T(4);
      // Beat 3: the pin searches the real city, framed as a card.
      const cw = W * L({ '16x9': 0.86, '1x1': 0.88, '9x16': 0.88 });
      const chh = H * L({ '16x9': 0.8, '1x1': 0.72, '9x16': 0.5 });
      const kc = clamp(spring(t - T(3), 'snap'), 0, 1);
      city.set({ x: (W - cw) / 2, y: (H - chh) / 2, w: cw, h: chh, camX: 430, camY: 160, zoom: Math.max(cw / 287, chh / 248) * (1.08 - 0.05 * kc), show: chaos, s: 0.94 + 0.06 * kc });
      city.node.style.boxShadow = '0 40px 90px -30px rgba(52,50,45,0.45)';

      const rise = clamp(spring(t - T(7), 'heavy'), 0, 1.2);
      const fieldTop = H * (1 - Math.min(1, rise));
      group.style.transformOrigin = `${x0}px ${H / 2}px`;
      const blockBottom = (H + blockH) / 2 + size * 0.3;
      const shove = Math.max(0, blockBottom - fieldTop);
      place(group, { y: recoil(t) - shove, s: push(t), show: t < T(7.75) && !chaos });
      place(field, { y: fieldTop, show: t >= T(7) });

      WORDS.forEach((w, i) => {
        const tb = i === 0 ? 0 : T(BEAT_OF[i]);
        const p = pos[i];
        if (t < tb) {
          place(words[i], { show: false });
          if (w === 'land') place(chip, { show: false });
          return;
        }
        // Words are pressed in from above by the pin: a short drop, a squash.
        const k = spring(t - tb, 'slam');
        const squash = impulse(t - tb - 0.03, [900, 26, 1]) * (i === 7 ? 0.14 : 0.08);
        words[i].style.transformOrigin = `${p.w / 2}px ${size * 0.9}px`;
        place(words[i], { x: p.x, y: p.y - size * 0.82 - (1 - k) * size * 0.35, sx: 1 + squash, sy: 1 - squash, show: true });
        if (w === 'land') {
          const padX = size * 0.14;
          const cwd = p.w + padX * 2;
          const chH = size * 0.92;
          const open = clamp(spring(t - tb, 'snap'), 0, 1);
          chip.style.width = `${cwd}px`;
          chip.style.height = `${chH}px`;
          place(chip, { x: p.x - padX, y: p.y - size * 0.78, show: true, clip: `inset(0 ${((1 - open) * 100).toFixed(2)}% 0 0 round ${size * 0.12}px)` });
          const k2 = Math.max(cwd / 300, 1.6);
          const cx = 360 + 60 * spring(t - tb, 'drift');
          Object.assign(chipImg.style, { width: `${M.images.aerial.w}px`, height: `${M.images.aerial.h}px`, transformOrigin: '0 0', filter: 'saturate(1.05)' });
          chipImg.style.transform = `translate3d(${(cwd / 2 - cx * k2).toFixed(2)}px, ${(chH / 2 - 72 * k2).toFixed(2)}px, 0) scale(${k2.toFixed(4)})`;
          words[i].style.color = '#FFFFFF';
        }
      });
    },
  };
}
