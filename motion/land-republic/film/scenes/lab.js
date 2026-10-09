// Component test bench on a synthetic page made by tools/fixture.py into
// build/test/fixture.png.
// Not part of the film: load with ?scenes=lab.

import { el, place, spring, track, trackN } from '../engine.js';
import { makeShot, makePiece, makeCursor, makePin, makeBoundary, makeCounter } from '../kit.js';
import { counterTicks } from '../../timeline.mjs';

export default function lab(ctx) {
  const { stage, W, H, T } = ctx;
  const root = el('div', 'scene', stage);
  const src = '../build/test/fixture.png';
  const shot = makeShot(root, { src, iw: 2880, ih: 3600, dpr: 2, radius: 18 });
  const pieces = [
    { x: 80, y: 400, w: 520, h: 80 },
    { x: 80, y: 400, w: 420, h: 400 },
    { x: 520, y: 400, w: 420, h: 400 },
  ].map((crop) => makePiece(root, { src, iw: 2880, ih: 3600, dpr: 2, crop, radius: 12 }));
  const cursor = makeCursor(root);
  const pins = [makePin(root), makePin(root)];
  const plot = makeBoundary(root, W, H);
  const counter = makeCounter(root, { target: 500, digits: 3, size: 300 });

  return {
    id: 'lab',
    root,
    from: 0,
    to: 20,
    update(t) {
      // 0-4 s: camera pushes into the page, cursor clicks btnA (page 1260,40).
      const zoom = track(t, [[0, 0.9], [0.5, 1.6, 'glide'], [2.0, 1.1, 'glide']]);
      const [cx, cy] = trackN(t, [[0, [720, 600]], [0.5, [1200, 120], 'glide'], [2.0, [720, 700], 'glide']]);
      shot.set({ x: 160, y: 90, w: W - 320, h: H - 180, camX: cx, camY: cy, zoom, show: t < 4 });
      const target = shot.toStage(1260, 40);
      const card = shot.toStage(290, 600);
      cursor.update(t, [[0.2, W * 0.7, H * 0.9], [0.6, target[0], target[1]], [1.6, card[0], card[1]]], [T(2), T(4)], { show: t < 4 });

      // 4-6 s: pieces fly in and lock on beats 8, 9, 10.
      pieces.forEach((p, i) => {
        const tb = T(8 + i);
        const k = spring(t - tb, 'heavy');
        const fx = [W + 200, -600, W * 0.5][i];
        const fy = [200, H * 0.4, H + 300][i];
        const tx = 200 + i * 460;
        const ty = 300;
        p.set({ x: fx + (tx - fx) * k, y: fy + (ty - fy) * k, r: (1 - k) * [8, -6, 4][i], show: t >= tb && t < 6 });
      });

      // 6-10 s: pins and the plot boundary.
      const show2 = t >= 6 && t < 10;
      pins[0].update(show2 ? t : -1, T(13), W * 0.35, H * 0.55);
      pins[1].update(show2 ? t : -1, T(13.5), W * 0.62, H * 0.48);
      plot.update(show2 ? t : -1, T(14), [[W * 0.3, H * 0.35], [W * 0.7, H * 0.3], [W * 0.75, H * 0.7], [W * 0.28, H * 0.72]]);

      // 14-16 s: counter rolls on the shared tick schedule.
      const ticks = counterTicks(ctx.cueT('count'), ctx.clock.period);
      counter.update(t, ticks);
      place(counter.node, { x: W * 0.3, y: H * 0.3, show: t >= T(28) && t < 16 });
    },
  };
}
