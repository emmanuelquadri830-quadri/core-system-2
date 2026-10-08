// Lockup (beats 36-40), remix: the Land Republic mark in its own blue with a
// charcoal wordmark on the light paper, the way the site's footer sets it.
// The six real pieces of the mark fly in and lock on 36.5, the moment the pin
// lands in the middle of them and sinks into the mark. "Discover. Invest.
// Own." on 37, 37.5 and 38, the URL on 38.5.

import { el, place, spring, clamp } from '../../film/engine.js';
import { makeWord, impulse, textWidth, cssVar } from '../../film/kit.js';

// A logo piece is a white-on-transparent PNG used as a mask, so it can take
// any brand colour without being redrawn.
function tinted(parent, src, w, h, color) {
  const n = el('div', '', parent);
  Object.assign(n.style, { position: 'absolute', left: '0px', top: '0px', width: `${w}px`, height: `${h}px`, background: color, transformOrigin: '50% 50%' });
  n.style.webkitMaskImage = n.style.maskImage = `url(${src})`;
  n.style.webkitMaskSize = n.style.maskSize = '100% 100%';
  n.style.webkitMaskRepeat = n.style.maskRepeat = 'no-repeat';
  return n;
}

export default function lockup(ctx) {
  const { stage, W, H, T, L, cueT, manifest: M } = ctx;
  const root = el('div', 'scene lockup', stage);
  root.style.background = 'var(--bg)';
  const LG = M.logo;
  const parts = ctx.logoParts;
  const center = [142, 150];

  // A very large, very faint mark off to the side, as on the site.
  const markW = 300; // mark width in 8x logo pixels
  const wmScale = L({ '16x9': 3.6, '1x1': 2.6, '9x16': 3.2 });
  const wm = tinted(root, ctx.asset(LG.full), LG.w, LG.h, 'var(--fg)');
  Object.assign(wm.style, { transformOrigin: '0 0', opacity: '0.045', clipPath: `inset(0 ${LG.w - markW}px 0 0)` });

  const logoH = L({ '16x9': 300, '1x1': 250, '9x16': 300 });
  const k = logoH / LG.h;
  const lx = L({ '16x9': 180, '1x1': 90, '9x16': 90 });
  const ly = L({ '16x9': 230, '1x1': 250, '9x16': 620 });
  const logo = el('div', 'layer', root);
  const pieces = parts.map((p) => ({ ...p, node: tinted(logo, ctx.asset(p.file), p.w * k, p.h * k, p.name === 'wordmark' ? 'var(--fg)' : 'var(--accent)') }));
  // The logo group pulses about the mark centre on the lock.
  ctx.targets.logo = () => [lx + center[0] * k, ly + center[1] * k];

  const ts = L({ '16x9': 84, '1x1': 70, '9x16': 84 });
  const tag = ['Discover.', 'Invest.', 'Own.'].map((w) => makeWord(root, w, { size: ts, weight: 500, color: 'var(--fg)' }));
  tag.forEach((n) => (n.style.fontFamily = 'var(--ui)'));
  const url = makeWord(root, M.brand.url, { size: L({ '16x9': 58, '1x1': 52, '9x16': 60 }), weight: 500, color: 'var(--accent)' });
  url.style.fontFamily = 'var(--ui)';
  url.style.letterSpacing = '0.01em';
  const tagW = tag.map((n) => textWidth(n.textContent, { size: ts, weight: 500, family: cssVar('--ui') }));

  return {
    id: 'lockup',
    root,
    from: T(35.75),
    to: 20.001,
    update(t) {
      const t0 = T(36);
      const on = t >= t0;
      const d = spring(t - t0, 'drift');
      const wx = L({ '16x9': W - 620, '1x1': W - 420, '9x16': W - 560 }) + 80 * (1 - d);
      const wy = L({ '16x9': -120, '1x1': 380, '9x16': 1180 });
      place(wm, { x: wx, y: wy, s: wmScale, o: 0.045, show: on });

      const tl = cueT('logo-lock');
      const hit = impulse(t - tl, [700, 26, 1]);
      logo.style.transformOrigin = `${center[0] * k}px ${center[1] * k}px`;
      place(logo, { x: lx, y: ly, s: 1 + 0.035 * hit, show: on });
      pieces.forEach((p, i) => {
        if (p.name === 'wordmark') {
          const w = clamp(spring(t - tl, 'snap'), 0, 1);
          place(p.node, { x: p.x * k - (1 - w) * 120, y: p.y * k, show: t >= tl, clip: `inset(0 ${((1 - w) * 100).toFixed(1)}% 0 0)` });
          return;
        }
        // Fly in along the line from the mark centre and lock on 36.5.
        const cx = p.x + p.w / 2 - center[0];
        const cy = p.y + p.h / 2 - center[1];
        const len = Math.hypot(cx, cy) || 1;
        const off = 1 - spring(t - t0, [172, 18.3, 1]);
        place(p.node, { x: p.x * k + (cx / len) * 900 * off, y: p.y * k + (cy / len) * 900 * off, r: 90 * off * (i % 2 ? 1 : -1), show: on });
      });

      const under = ly + logoH + L({ '16x9': 130, '1x1': 120, '9x16': 160 });
      let x = lx + 8;
      ['t-discover', 't-invest', 't-own'].forEach((c, i) => {
        const tc = cueT(c);
        const s = spring(t - tc, 'slam');
        tag[i].style.transformOrigin = `0 ${ts / 2}px`;
        place(tag[i], { x, y: under - ts * 0.8 + (1 - s) * ts * 0.4, s: 1.25 - 0.25 * s, show: t >= tc });
        x += tagW[i] + ts * 0.3;
      });
      const tu = cueT('url');
      const su = spring(t - tu, 'snap');
      place(url, { x: lx + 8, y: under + ts * 0.55 + (1 - su) * 30, show: t >= tu, clip: `inset(0 ${((1 - clamp(su)) * 100).toFixed(1)}% 0 0)` });
    },
  };
}
