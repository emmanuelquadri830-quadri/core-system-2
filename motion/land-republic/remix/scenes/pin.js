// The pin: one object carried through the whole film. It sits above every
// scene and flies to targets the scenes register in ctx.targets. Flights are
// springs launched LAUNCH seconds before the beat so the pin touches down on
// it; hops arc, darts do not; the body leans into its own velocity and
// squashes on landing. Pure function of t like everything else.

import { el, place, spring, trackN, clamp } from '../../film/engine.js';
import { impulse } from '../../film/kit.js';
import { PIN_MOVES, LAUNCH } from '../timeline.mjs';

const FLY = [420, 28, 1]; // first touchdown ~0.155 s after launch
const DART = [900, 42, 1];

export default function pin(ctx) {
  const { stage, W, H, T, L, targets } = ctx;
  const root = el('div', 'scene pin', stage);
  root.style.pointerEvents = 'none';
  const size = L({ '16x9': 84, '1x1': 76, '9x16': 96 });
  const body = el('div', 'layer', root);
  body.innerHTML = `<svg viewBox="0 0 40 52" width="${size}" height="${size * 1.3}" xmlns="http://www.w3.org/2000/svg">
<path d="M20 51 C20 51 3 30.5 3 19 A17 17 0 0 1 37 19 C37 30.5 20 51 20 51 Z" fill="#1668D1"/>
<circle cx="20" cy="19" r="7" fill="#FFFFFF"/></svg>`;
  Object.assign(body.style, { width: `${size}px`, height: `${size * 1.3}px`, filter: 'drop-shadow(0 14px 18px rgba(52,50,45,0.28))' });

  // Visible windows (beats) and where the pin comes from when one opens.
  const WINDOWS = [
    { from: 0, to: 7.75, entry: () => [-size * 2, H * 0.2] },
    { from: 7.9, to: 11.3, entry: () => [W * 0.1, -size * 3] },
    { from: 20.6, to: 28, entry: () => [W * 1.1, -size * 2] },
    { from: 29.1, to: 31.3, entry: () => [W * 0.95, -size * 2.5] },
    { from: 33.6, to: 36.95, entry: () => [W * 0.62, -size * 3] },
  ];
  const tgt = (name, t) => (targets[name] ? targets[name](t) : [W / 2, H / 2]);

  const plan = WINDOWS.map((w) => {
    const moves = PIN_MOVES.filter((m) => m.at >= w.from && m.at <= w.to + 0.5);
    const keys = [[T(w.from) - 0.4, w.entry()]];
    for (const m of moves) {
      const land = T(m.at);
      const launch = m.trail ? T(8) : land - LAUNCH;
      keys.push([launch, tgt(m.to, land), m.trail ? 'glide' : m.dart ? DART : FLY]);
    }
    return { ...w, moves, keys };
  });

  const posAt = (t, p) => {
    const [x, y] = trackN(t, p.keys);
    // arc on hops: rise in the middle of each flight
    let arc = 0;
    let ride = [0, 0];
    p.moves.forEach((m, i) => {
      const land = T(m.at);
      const launch = p.keys[i + 1][0];
      if (t >= launch && t < land + 0.25) {
        const u = clamp((t - launch) / Math.max(0.05, land - launch), 0, 1);
        arc += (m.dart || m.trail ? 0 : m.hop ? 260 : 120) * 4 * u * (1 - u);
      }
      // ride a moving target once landed, until the next launch
      const next = p.keys[i + 2] ? p.keys[i + 2][0] : Infinity;
      if (t >= land && t < next) {
        const now = tgt(m.to, t);
        const then = tgt(m.to, land);
        ride = [now[0] - then[0], now[1] - then[1]];
      }
    });
    return [x + ride[0], y + ride[1] - arc];
  };

  return {
    id: 'pin',
    root,
    from: 0,
    to: 20.001,
    update(t) {
      const p = plan.find((w) => t >= T(w.from) - 0.4 && t < T(w.to));
      if (!p) {
        place(body, { show: false });
        return;
      }
      const [x, y] = posAt(t, p);
      const [x0] = posAt(t - 1 / 120, p);
      const vx = (x - x0) * 120;
      const lean = clamp(vx * 0.012, -28, 28);
      let squash = 0;
      let gone = 0;
      for (const m of p.moves) {
        squash = Math.max(squash, impulse(t - T(m.at), [900, 24, 1]) * (m.slam ? 0.32 : 0.16));
        // the last landing: the pin sinks into the mark, tip first
        if (m.vanish) gone = clamp(spring(t - T(m.at) - 0.03, [700, 42, 1]), 0, 1);
      }
      body.style.transformOrigin = '50% 100%';
      place(body, { x: x - size / 2, y: y - size * 1.3, r: lean * (1 - gone), s: 1 - gone, sx: 1 + squash * 0.8, sy: 1 - squash, show: gone < 0.985, z: 60 });
    },
  };
}
