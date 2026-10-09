// 4. Montage (beats 20-24): Civic Apartment, the three supplied renders.
//
// 16:9 and 1:1 build a set of panels, one per beat, each revealed through a
// mask while the picture inside drifts the other way. 9:16 runs them full
// bleed. Beat 23 opens the front elevation to the full frame and pushes in on
// the building's own sign; the name lands on 23.5.

import { el, place, spring, clamp, wipe } from '../engine.js';
import { makeShot, makeWord, layoutLines } from '../kit.js';

export default function montage(ctx) {
  const { stage, W, H, AR, T, L, cueT, manifest: M } = ctx;
  const root = el('div', 'scene montage', stage);
  root.style.background = 'var(--ink)';
  const I = M.images;
  const order = ['perspective', 'front', 'aerial'];
  const shots = order.map((k) => makeShot(root, { src: ctx.asset(I[k].file), iw: I[k].w, ih: I[k].h, dpr: 1 }));
  shots.forEach((s) => (s.node.style.background = 'transparent'));

  const gap = 10;
  // Panel rectangles per ratio: [x, y, w, h]
  const panels = L({
    '16x9': [[0, 0, W / 3 - gap / 2, H], [W / 3 + gap / 2, 0, W / 3 - gap, H], [(2 * W) / 3 + gap / 2, 0, W / 3 - gap / 2, H]],
    '1x1': [[0, 0, W / 2 - gap / 2, H], [W / 2 + gap / 2, 0, W / 2 - gap / 2, H], [0, 0, W, H]],
    '9x16': [[0, 0, W, H], [0, 0, W, H], [0, 0, W, H]],
  });
  // How each panel opens.
  const dirs = L({ '16x9': ['up', 'down', 'up'], '1x1': ['up', 'down', 'up'], '9x16': ['up', 'left', 'up'] });
  // Where the eye goes in each picture (image pixels).
  const focus = [
    [560, 640],
    [480, 640],
    [480, 560],
  ];
  const SIGN = [612, 836]; // "CIVIC Apartment" lettering on the front elevation

  const nameSize = L({ '16x9': 150, '1x1': 118, '9x16': 132 });
  const name = el('div', 'layer', root);
  const n1 = makeWord(name, 'Civic', { size: nameSize, weight: 500, color: 'var(--white)' });
  const n2 = makeWord(name, 'Apartment', { size: nameSize, weight: 500, color: 'var(--white)' });
  [n1, n2].forEach((n) => (n.style.textShadow = '0 6px 40px rgba(0,0,0,0.35)'));
  const nameLines = AR === '16x9' ? [[0, 1]] : [[0], [1]];
  const nameBase = H - L({ '16x9': 120, '1x1': 90, '9x16': 300 }) - (nameLines.length - 1) * nameSize;
  const namePos = layoutLines(['Civic', 'Apartment'], nameLines, { size: nameSize, leading: 1, x0: L({ '16x9': 110, '1x1': 70, '9x16': 80 }), y0: nameBase, weight: 500, tracking: -0.02 });

  return {
    id: 'montage',
    root,
    from: T(20),
    to: T(24),
    update(t) {
      const tOpen = cueT('cut-4');
      const open = clamp(spring(t - tOpen, 'heavy'), 0, 1.1);

      shots.forEach((s, i) => {
        const tb = T(20 + i);
        const [x, y, w, h] = panels[i];
        const im = I[order[i]];
        const k = clamp(spring(t - tb, 'snap'), 0, 1);
        const settle = 1 + 0.06 * (1 - spring(t - tb, 'soft'));
        const cover = Math.max(w / im.w, h / im.h) * 1.12 * settle;
        // Parallax: the picture drifts against the reveal.
        const drift = (1 - spring(t - tb, 'drift')) * 60;
        const dy = dirs[i] === 'down' ? -drift : drift;
        const isFront = i === 1;
        let rect = [x, y, w, h];
        let camX = focus[i][0];
        let camY = focus[i][1] + dy / cover;
        let zoom = cover;
        if (isFront && t >= tOpen) {
          // Beat 23: the front elevation takes the frame and leans into its sign.
          rect = [x + (0 - x) * open, y + (0 - y) * open, w + (W - w) * open, h + (H - h) * open];
          const full = Math.max(W / im.w, H / im.h) * 1.12;
          zoom = cover + (full * 1.9 - cover) * clamp(spring(t - tOpen, 'glide'), 0, 1);
          camX = focus[i][0] + (SIGN[0] - focus[i][0]) * clamp(spring(t - tOpen, 'glide'), 0, 1);
          camY = focus[i][1] + (SIGN[1] + 40 - focus[i][1]) * clamp(spring(t - tOpen, 'glide'), 0, 1);
        }
        const hidden = t < tb || (AR === '9x16' && i < 2 && t >= T(21 + i) && !(isFront && t >= tOpen)) || (!isFront && t >= tOpen + 0.3);
        s.set({ x: rect[0], y: rect[1], w: rect[2], h: rect[3], camX, camY, zoom, show: !hidden, clip: wipe(k, dirs[i]) });
        s.node.style.zIndex = isFront && t >= tOpen ? 5 : i;
      });

      // The name, on 23.5.
      const tn = cueT('name');
      name.style.zIndex = 9;
      [n1, n2].forEach((n, j) => {
        const tj = tn + j * 0.06;
        const k = spring(t - tj, 'slam');
        const p = namePos[j];
        n.style.transformOrigin = `0 ${nameSize * 0.5}px`;
        place(n, { x: p.x, y: p.y - nameSize * 0.82 + (1 - k) * nameSize * 0.3, s: 1.25 - 0.25 * k, show: t >= tj });
      });
      place(name, { show: true });
    },
  };
}
