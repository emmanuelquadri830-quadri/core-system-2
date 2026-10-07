// 8. Lockup (beats 36-40). The six real pieces of the Land Republic mark fly
// in and lock on 36.5, the wordmark slides out from behind them, then
// "Discover. Invest. Own." lands on the closing pluck motif and the URL on
// 38.5. A large faint mark sits off to the side, as it does on the site.

import { el, place, spring, clamp } from '../engine.js';
import { makeWord, impulse } from '../kit.js';

export default function lockup(ctx) {
  const { stage, W, H, AR, T, L, cueT, manifest: M } = ctx;
  const root = el('div', 'scene lockup', stage);
  root.style.background = 'var(--ink)';
  const LG = M.logo;
  const parts = ctx.logoParts;

  // Faint watermark mark, as on the site's dark sections.
  const wm = el('img', '', root, { src: ctx.asset(LG.full) });
  const markW = 300; // mark width in 8x logo pixels
  const wmScale = L({ '16x9': 3.6, '1x1': 2.6, '9x16': 3.2 });
  Object.assign(wm.style, { position: 'absolute', left: '0px', top: '0px', width: `${LG.w}px`, height: `${LG.h}px`, transformOrigin: '0 0', opacity: '0.05', clipPath: `inset(0 ${LG.w - markW}px 0 0)` });

  const logoH = L({ '16x9': 300, '1x1': 250, '9x16': 300 });
  const k = logoH / LG.h;
  const lx = L({ '16x9': 180, '1x1': 90, '9x16': 90 });
  const ly = L({ '16x9': 230, '1x1': 250, '9x16': 620 });
  const logo = el('div', 'layer', root);
  const pieces = parts.map((p) => {
    const img = el('img', '', logo, { src: ctx.asset(p.file) });
    Object.assign(img.style, { position: 'absolute', left: '0px', top: '0px', width: `${p.w * k}px`, height: `${p.h * k}px`, transformOrigin: '50% 50%' });
    return { ...p, img };
  });
  const center = [142, 150];

  const ts = L({ '16x9': 84, '1x1': 70, '9x16': 84 });
  const tag = ['Discover.', 'Invest.', 'Own.'].map((w) => makeWord(root, w, { size: ts, weight: 500, color: 'var(--white)' }));
  tag.forEach((n) => (n.style.fontFamily = 'var(--ui)'));
  const url = makeWord(root, M.brand.url, { size: L({ '16x9': 58, '1x1': 52, '9x16': 60 }), weight: 500, color: '#4C8EF0' });
  url.style.fontFamily = 'var(--ui)';
  url.style.letterSpacing = '0.01em';

  return {
    id: 'lockup',
    root,
    from: T(35.75),
    to: 20.001,
    update(t) {
      const t0 = T(36);
      const on = t >= t0;
      // watermark drifts in from the right edge
      const d = spring(t - t0, 'drift');
      const wx = L({ '16x9': W - 620, '1x1': W - 420, '9x16': W - 560 }) + 80 * (1 - d);
      const wy = L({ '16x9': -120, '1x1': 380, '9x16': 1180 });
      wm.style.transform = `translate3d(${wx.toFixed(1)}px, ${wy.toFixed(1)}px, 0) scale(${wmScale})`;
      wm.style.visibility = on ? 'inherit' : 'hidden';

      const tl = cueT('logo-lock');
      const hit = impulse(t - tl, [700, 26, 1]);
      place(logo, { x: lx, y: ly, s: 1 + 0.03 * hit, show: on });
      pieces.forEach((p, i) => {
        if (p.name === 'wordmark') {
          const w = clamp(spring(t - tl, 'snap'), 0, 1);
          place(p.img, { x: p.x * k - (1 - w) * 120, y: p.y * k, show: t >= tl, clip: `inset(0 ${((1 - w) * 100).toFixed(1)}% 0 0)` });
          return;
        }
        // fly in along the line from the mark centre, lock on 36.5
        const cx = p.x + p.w / 2 - center[0];
        const cy = p.y + p.h / 2 - center[1];
        const len = Math.hypot(cx, cy) || 1;
        const dist = 900;
        const kk = spring(t - t0, [172, 18.3, 1]);
        const off = 1 - kk;
        place(p.img, { x: p.x * k + (cx / len) * dist * off, y: p.y * k + (cy / len) * dist * off, r: 90 * off * (i % 2 ? 1 : -1), show: on });
      });

      const under = ly + logoH + L({ '16x9': 130, '1x1': 120, '9x16': 160 });
      let x = lx + 8;
      ['t-discover', 't-invest', 't-own'].forEach((c, i) => {
        const tc = cueT(c);
        const s = spring(t - tc, 'slam');
        const w = tag[i].getBoundingClientRect ? tag[i].offsetWidth : 0;
        tag[i].style.transformOrigin = `0 ${ts / 2}px`;
        place(tag[i], { x, y: under - ts * 0.8 + (1 - s) * ts * 0.4, s: 1.25 - 0.25 * s, show: t >= tc });
        x += w + ts * 0.3;
      });
      const tu = cueT('url');
      const su = spring(t - tu, 'snap');
      place(url, { x: lx + 8, y: under + ts * 0.55 + (1 - su) * 30, show: t >= tu, clip: `inset(0 ${((1 - clamp(su)) * 100).toFixed(1)}% 0 0)` });
    },
  };
}
