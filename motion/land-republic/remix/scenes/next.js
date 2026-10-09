// Next (beats 32-36), remix: "Find your next property." on the light paper,
// the real Civic front render in a window beside it. On 34 the pin drops onto
// the full stop and takes its place; on 35 the window opens to the frame and
// on 35.5 the pin hops onto the roof of the building it has been pointing at.
// 35.75 is the silent sixteenth before the logo.

import { el, place, spring, clamp } from '../../film/engine.js';
import { makeShot, makeWord, layoutLines, textWidth, impulse } from '../../film/kit.js';

const WORDS = ['Find', 'your', 'next', 'property'];
const BEAT_OF = [32, 32, 32, 33];
// Top of the central core on civic-front.webp, in image pixels.
const ROOF = [490, 498];

export default function next(ctx) {
  const { stage, W, H, T, L, manifest: M } = ctx;
  const root = el('div', 'scene next', stage);
  root.style.background = 'var(--bg)';
  const F = M.images.front;

  const win = makeShot(root, { src: ctx.asset(F.file), iw: F.w, ih: F.h });
  win.node.style.boxShadow = '0 50px 90px -40px rgba(52,50,45,0.45)';
  const size = L({ '16x9': 166, '1x1': 124, '9x16': 156 });
  const lines = L({ '16x9': [[0, 1], [2], [3]], '1x1': [[0, 1, 2], [3]], '9x16': [[0, 1], [2], [3]] });
  const x0 = L({ '16x9': 130, '1x1': 70, '9x16': 80 });
  const y0 = L({ '16x9': 350, '1x1': 220, '9x16': 330 });
  const tracking = -0.025;
  const pos = layoutLines(WORDS, lines, { size, leading: 1.0, x0, y0, weight: 500, tracking });
  const words = WORDS.map((w, i) => {
    const n = makeWord(root, w, { size, weight: 500, color: i === 3 ? 'var(--accent)' : 'var(--fg)' });
    n.style.letterSpacing = `${tracking}em`;
    return n;
  });
  // The full stop is its own glyph inside the word, so it scales with the
  // word as it lands and the pin can take its place on 34.
  const dot = el('span', '', words[3], { text: '.' });
  Object.assign(dot.style, { display: 'inline-block', marginLeft: '0.03em', transformOrigin: `50% ${size * 0.82}px` });
  const dotW = textWidth('.', { size, weight: 500, tracking: 0 });
  const p3 = pos[3];
  // left edge of the dot: the word's advance plus its last letter-spacing
  const dotX = p3.x + p3.w + tracking * size + size * 0.03;
  // a touch right of the dot's centre, so the pin's head clears the y
  ctx.targets.period = () => [dotX + dotW / 2 + size * 0.11, p3.y];

  const box = L({
    '16x9': [1150, 110, 660, 860],
    '1x1': [560, 450, 450, 560],
    '9x16': [80, 860, 920, 960],
  });
  const R = L({ '16x9': 30, '1x1': 24, '9x16': 32 });
  // The window's frame and camera as pure functions of t, so the pin can
  // aim at the roof at any time.
  const frame = (t) => {
    const open = clamp(spring(t - T(35), 'heavy'), 0, 1);
    const [bx, by, bw, bh] = box;
    const r = [bx * (1 - open), by * (1 - open), bw + (W - bw) * open, bh + (H - bh) * open];
    const zoom = Math.max(r[2] / F.w, r[3] / F.h) * 1.08;
    const camY = F.h * 0.55 - 40 * spring(t - T(32), 'drift');
    return { r, zoom, camY, open };
  };
  ctx.targets.home = (t) => {
    const { r, zoom, camY } = frame(t);
    return [r[0] + r[2] / 2 + (ROOF[0] - F.w / 2) * zoom, r[1] + r[3] / 2 + (ROOF[1] - camY) * zoom];
  };

  return {
    id: 'next',
    root,
    from: T(32),
    to: T(35.75),
    update(t) {
      const grow = clamp(spring(t - T(32) + 0.04, 'heavy'), 0, 1.1);
      const { r, zoom, camY, open } = frame(t);
      win.set({
        x: r[0], y: r[1], w: r[2], h: r[3],
        camX: F.w / 2, camY, zoom,
        show: true, clip: `inset(${((1 - Math.min(1, grow)) * 100).toFixed(2)}% 0 0 0 round ${(R * (1 - open)).toFixed(1)}px)`,
      });
      win.node.style.borderRadius = `${(R * (1 - open)).toFixed(1)}px`;
      win.node.style.zIndex = 5;
      WORDS.forEach((w, i) => {
        const tb = T(BEAT_OF[i]) + (i < 3 ? i * 0.04 : 0);
        // pressed in from above like the hook's words: a short drop and a
        // squash about the baseline, so neighbours never touch
        const k = spring(t - tb, 'slam');
        const squash = impulse(t - tb - 0.03, [900, 26, 1]) * (i === 3 ? 0.1 : 0.07);
        const p = pos[i];
        words[i].style.transformOrigin = `${p.w / 2}px ${size * 0.82}px`;
        place(words[i], { x: p.x, y: p.y - size * 0.82 - (1 - k) * size * 0.35, sx: 1 + squash, sy: 1 - squash, show: t >= tb });
      });
      // The pin hammers the full stop flat on 34 and stands in its place.
      const flat = clamp(spring(t - T(34) + 0.015, [900, 40, 1]), 0, 1);
      dot.style.transform = `scale(${(1 + 0.6 * flat).toFixed(4)}, ${(1 - flat).toFixed(4)})`;
      dot.style.visibility = flat < 0.97 ? 'inherit' : 'hidden';
    },
  };
}
