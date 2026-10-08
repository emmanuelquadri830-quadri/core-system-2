// Brand moment (beats 17-20). The front elevation, a controlled push in, an
// ink panel slides across from the left and carries the real logo, the line
// and the address. The film ends on movement, not a fade.

import { el, place, spring, clamp } from '../../film/engine.js';
import { makeShot, impulse } from '../../film/kit.js';

export default function brand(ctx) {
  const { stage, W, H, AR, T, L, cueT, manifest: M } = ctx;
  const root = el('div', 'scene brand', stage);
  root.style.background = 'var(--ink)';
  const F = M.images.front;
  const front = makeShot(root, { src: ctx.asset(F.file), iw: F.w, ih: F.h });

  const panel = el('div', 'layer', root);
  const pw = L({ '16x9': 820, '1x1': W, '9x16': W });
  const ph = L({ '16x9': H, '1x1': 470, '9x16': 760 });
  Object.assign(panel.style, { width: `${pw}px`, height: `${ph}px`, background: 'rgba(16,16,16,0.92)' });

  const LG = M.logo;
  const parts = ctx.logoParts;
  const logoH = L({ '16x9': 180, '1x1': 140, '9x16': 190 });
  const k = logoH / LG.h;
  const logo = el('div', 'layer', root);
  const pieces = parts.map((p) => {
    const img = el('img', '', logo, { src: ctx.asset(p.file) });
    Object.assign(img.style, { position: 'absolute', left: '0px', top: '0px', width: `${p.w * k}px`, height: `${p.h * k}px` });
    return { ...p, img };
  });

  const ls = L({ '16x9': 56, '1x1': 48, '9x16': 58 });
  const line = el('div', 'layer', root);
  line.innerHTML = 'OWN WHERE THE<br>FUTURE IS GOING.';
  Object.assign(line.style, { font: `500 ${ls}px var(--display)`, letterSpacing: '0.06em', lineHeight: '1.18', color: 'var(--white)', whiteSpace: 'nowrap' });
  const url = el('div', 'layer', root, { text: 'www.landrepublic.co' });
  Object.assign(url.style, { font: `500 ${L({ '16x9': 34, '1x1': 30, '9x16': 36 })}px var(--ui)`, letterSpacing: '0.08em', color: '#8FB6F5', whiteSpace: 'nowrap' });

  return {
    id: 'brand',
    root,
    from: T(17),
    to: 15.001,
    update(t) {
      const t0 = cueT('brand');
      const cov = Math.max(W / F.w, H / F.h) * 1.08;
      // controlled push for the whole shot, continuing to the last frame
      const z = cov * (1 + 0.07 * spring(t - t0, 'drift'));
      const cx = L({ '16x9': 440, '1x1': 485, '9x16': 485 });
      front.set({ x: 0, y: 0, w: W, h: H, camX: cx, camY: L({ '16x9': 640, '1x1': 560, '9x16': 640 }), zoom: z, show: true });

      const kp = clamp(spring(t - t0, 'heavy'), 0, 1);
      const isWide = AR === '16x9';
      place(panel, { x: isWide ? -pw * (1 - kp) : 0, y: isWide ? 0 : H - ph * kp, show: true });

      const ox = L({ '16x9': 110, '1x1': 70, '9x16': 80 });
      const oy = L({ '16x9': 300, '1x1': H - 470 + 60, '9x16': H - 760 + 90 });
      const shift = isWide ? -pw * (1 - kp) : 0;
      const lift = isWide ? 0 : ph * (1 - kp);
      // logo: the six real pieces settle into place on 17.67
      const tl = cueT('logo');
      const hit = impulse(t - tl, [700, 26, 1]);
      place(logo, { x: ox + shift, y: oy + lift, s: 1 + 0.02 * hit, show: t >= t0 });
      pieces.forEach((p, i) => {
        if (p.name === 'wordmark') {
          const w = clamp(spring(t - tl, 'snap'), 0, 1);
          place(p.img, { x: p.x * k - (1 - w) * 60, y: p.y * k, show: t >= tl, clip: `inset(0 ${((1 - w) * 100).toFixed(1)}% 0 0)` });
          return;
        }
        const cx2 = p.x + p.w / 2 - 142;
        const cy2 = p.y + p.h / 2 - 150;
        const len = Math.hypot(cx2, cy2) || 1;
        const off = 1 - spring(t - t0 - 0.1, [172, 18.3, 1]);
        place(p.img, { x: p.x * k + (cx2 / len) * 160 * off, y: p.y * k + (cy2 / len) * 160 * off, show: t >= t0 + 0.1 });
      });
      const ly = oy + logoH + L({ '16x9': 90, '1x1': 60, '9x16': 80 });
      const kt = clamp(spring(t - cueT('tagline'), 'soft'), 0, 1);
      place(line, { x: ox + shift, y: ly + lift + 20 * (1 - kt), show: t >= cueT('tagline'), clip: `inset(-10px ${((1 - kt) * 100).toFixed(1)}% -10px 0)` });
      const ku = clamp(spring(t - cueT('url'), 'soft'), 0, 1);
      place(url, { x: ox + shift, y: ly + lift + ls * 2.7, show: t >= cueT('url'), clip: `inset(-10px ${((1 - ku) * 100).toFixed(1)}% -10px 0)` });
    },
  };
}
