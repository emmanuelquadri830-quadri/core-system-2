// 1. Hook (beats 0-8): "Finding the right land shouldn't be this hard."
//
// Type stamps in word by word on the beat. "land" is a window onto the real
// Civic Apartment aerial. Beat 3 cuts to the real Lagos aerial from the site's
// hero for one beat while eight pins rain onto it, one per 32nd note. "hard."
// lands in the brand blue, the block recoils, and on beat 7 a blue field rises
// and shoves the type out of frame. Beat 7.75 is the silent sixteenth.

import { el, place, spring, clamp, mulberry32 } from '../engine.js';
import { layoutLines, makeWord, impulse, makeShot, makePin } from '../kit.js';

const WORDS = ['Finding', 'the', 'right', 'land', "shouldn't", 'be', 'this', 'hard.'];
const BEAT_OF = [0, 1, 1, 2, 4, 5, 5, 6];
const LINES = {
  '16x9': [[0, 1], [2, 3], [4, 5], [6, 7]],
  '1x1': [[0, 1], [2, 3], [4, 5], [6, 7]],
  '9x16': [[0], [1, 2], [3], [4], [5, 6], [7]],
};

export default function hook(ctx) {
  const { stage, W, H, AR, T, L, manifest: M } = ctx;
  const root = el('div', 'scene hook', stage);
  root.style.background = 'var(--ink)';

  // The real hero aerial: right half of the hero, where the site has no text.
  const page = M.page;
  const city = makeShot(root, { src: ctx.asset(page.file), iw: page.w * page.dpr, ih: page.h * page.dpr, dpr: page.dpr });
  const pins = Array.from({ length: 8 }, () => makePin(root, { size: L({ '16x9': 92, '1x1': 80, '9x16': 96 }) }));

  const group = el('div', 'layer', root);
  // A real photo chip behind "land": the Civic Apartment plot from above.
  const chip = el('div', 'shot', group);
  const chipImg = el('img', '', chip, { src: ctx.asset(M.images.aerial.file) });
  const size = L({ '16x9': 232, '1x1': 176, '9x16': 208 });
  const lines = LINES[AR];
  const leading = 0.98;
  const x0 = L({ '16x9': 150, '1x1': 74, '9x16': 82 });
  const blockH = size * leading * lines.length;
  const y0 = (H - blockH) / 2 + size * 0.78;
  const weight = 500;
  const pos = layoutLines(WORDS, lines, { size, leading, x0, y0, weight, tracking: -0.025 });

  const aerial = M.images.aerial;
  const words = WORDS.map((w, i) => {
    const node = makeWord(group, w, { size, weight, color: i === 7 ? 'var(--accent)' : 'var(--white)' });
    node.style.letterSpacing = '-0.025em';
    return node;
  });

  // The blue field that rises on beat 7 and fills the gap before the drop.
  const field = el('div', 'layer', root);
  Object.assign(field.style, { width: `${W}px`, height: `${H}px`, background: 'var(--accent)' });

  // Pin landing spots on the city, seeded so every render agrees.
  const r = mulberry32(31);
  const spots = Array.from({ length: 8 }, () => [W * (0.12 + 0.76 * r()), H * (0.2 + 0.7 * r())]);

  return {
    id: 'hook',
    root,
    from: 0,
    to: T(8),
    update(t) {
      const tHard = T(6);
      const chaos = t >= T(3) && t < T(4);

      // Beat 3: one beat of the real city, pins raining on 32nds.
      const zoom = L({ '16x9': 6.9, '1x1': 4.4, '9x16': 7.9 }) * (1.06 - 0.06 * spring(t - T(3), 'glide'));
      city.set({ x: 0, y: 0, w: W, h: H, camX: 432, camY: 160, zoom, show: chaos, blur: 2.5, o: 0.62 });
      pins.forEach((p, k) => {
        const [px, py] = spots[k];
        p.update(chaos ? t : -1, T(3 + k / 8), px, py, { drop: H * 0.35 });
      });

      // Camera: slow push out, a recoil on "hard.", then the blue field shoves
      // the block up and out.
      const push = 1.08 - 0.08 * spring(t, 'drift');
      const recoil = impulse(t - tHard) * L({ '16x9': 30, '1x1': 26, '9x16': 34 });
      const rise = clamp(spring(t - T(7), 'heavy'), 0, 1.2);
      const fieldTop = H * (1 - Math.min(1, rise));
      group.style.transformOrigin = `${x0}px ${H / 2}px`;
      // Once the field reaches the bottom of the block it carries it out.
      const blockBottom = (H + blockH) / 2 + size * 0.1;
      const shove = Math.max(0, blockBottom - fieldTop);
      place(group, { x: 0, y: recoil - shove, s: push, show: t < T(7.75) });
      place(field, { y: fieldTop, show: t >= T(7) });

      WORDS.forEach((w, i) => {
        // The first word owns frame zero, so the film never opens on black.
        const tb = i === 0 ? 0 : T(BEAT_OF[i]);
        const node = words[i];
        const p = pos[i];
        if (t < tb) {
          place(node, { show: false });
          if (w === 'land') place(chip, { show: false });
          return;
        }
        const k = spring(t - tb, 'slam');
        const big = i === 0 ? 1.7 : i === 7 ? 1.9 : 1.55;
        node.style.transformOrigin = i === 0 ? `0px ${size * 0.5}px` : `${p.w / 2}px ${size * 0.5}px`;
        place(node, { x: p.x, y: p.y - size * 0.82 + (1 - k) * size * 0.12, s: big + (1 - big) * k, show: true });
        if (w === 'land') {
          // The chip wipes open left to right under the word, the plot
          // drifting inside it.
          const padX = size * 0.14;
          const cw = p.w + padX * 2;
          const chH = size * 0.92;
          const open = clamp(spring(t - tb, 'snap'), 0, 1);
          chip.style.width = `${cw}px`;
          chip.style.height = `${chH}px`;
          chip.style.borderRadius = `${size * 0.1}px`;
          chip.style.transformOrigin = '0 50%';
          place(chip, { x: p.x - padX, y: p.y - size * 0.78, show: true, clip: `inset(0 ${((1 - open) * 100).toFixed(2)}% 0 0 round ${size * 0.1}px)` });
          // Tree canopy along the top of the aerial: unmistakably land.
          const im = aerial;
          const k2 = Math.max(cw / 300, 1.6);
          const drift = spring(t - tb, 'drift');
          const cx = 360 + 60 * drift;
          const cy = 72;
          chipImg.style.width = `${im.w}px`;
          chipImg.style.height = `${im.h}px`;
          chipImg.style.transformOrigin = '0 0';
          chipImg.style.filter = 'brightness(0.8) saturate(1.1)';
          chipImg.style.transform = `translate3d(${(cw / 2 - cx * k2).toFixed(2)}px, ${(chH / 2 - cy * k2).toFixed(2)}px, 0) scale(${k2.toFixed(4)})`;
        }
      });
    },
  };
}
