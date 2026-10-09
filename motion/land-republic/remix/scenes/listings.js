// Listings (beats 20-26): the two properties from the client's flyers.
//
//  20     Civic Apartment arrives as a stack: the render on top, its flyer
//         tucked behind. Title on 20.5, the pin lands on it on 21, the facts
//         rule in on 21.5, 21.75 and 22.
//  23     Civic steps back to a thumbnail, carrying the pin; Mowe Prime
//         slides into the slot. On 24 the pin hops across to it, facts on
//         24.5, 24.75 and 25.
//
// Every figure is printed on the supplied flyers; nothing is invented.

import { el, place, spring, clamp } from '../../film/engine.js';
import { makeShot } from '../../film/kit.js';

const N = '<span style="font-family: Inter, sans-serif">₦</span>';

export default function listings(ctx) {
  const { stage, W, H, AR, T, L, cueT, manifest: M } = ctx;
  const root = el('div', 'scene listings', stage);
  root.style.background = 'var(--bg)';

  const slot = L({ '16x9': [150, 100, 720, 880], '1x1': [50, 160, 420, 760], '9x16': [110, 170, 860, 1000] });
  const R = L({ '16x9': 30, '1x1': 24, '9x16': 32 });
  const shadow = '0 50px 90px -40px rgba(52,50,45,0.45)';

  // A card is a real picture in a rounded frame.
  const card = (file, iw, ih) => {
    const s = makeShot(root, { src: ctx.asset(file), iw, ih, radius: R });
    s.node.style.boxShadow = shadow;
    s.node.style.background = '#fff';
    return { s, iw, ih };
  };
  const civicBack = card('flyers/civic.png', 413, 531);
  const civic = card(M.images.perspective.file, M.images.perspective.w, M.images.perspective.h);
  const moweBack = card('flyers/mowe-keys.png', 406, 526);
  const mowe = card('flyers/mowe-aerial.png', 406, 500);

  // Details column.
  const col = L({ '16x9': [990, 230, 800], '1x1': [560, 220, 470], '9x16': [110, 1230, 860] });
  const ks = L({ '16x9': 28, '1x1': 18, '9x16': 30 });
  const ts = L({ '16x9': 92, '1x1': 56, '9x16': 84 });
  const rs = L({ '16x9': 44, '1x1': 40, '9x16': 42 });
  // In the square the column is narrow, so each label sits over its value.
  const stacked = AR === '1x1';
  const mkBlock = (kicker, title, rows) => {
    const box = el('div', 'layer', root);
    const k = el('div', '', box, { text: kicker });
    Object.assign(k.style, { font: `500 ${ks}px var(--ui)`, letterSpacing: '0.18em', color: 'var(--accent)', whiteSpace: 'nowrap' });
    const tl = el('div', '', box, { text: title });
    Object.assign(tl.style, { font: `500 ${ts}px var(--display)`, letterSpacing: '-0.02em', color: 'var(--fg)', whiteSpace: 'nowrap', marginTop: `${ks * 0.6}px`, lineHeight: '1.05' });
    const rowEls = rows.map(([label, value]) => {
      const r = el('div', '', box);
      Object.assign(r.style, { position: 'relative', marginTop: `${rs * (stacked ? 0.55 : 0.9)}px`, paddingTop: `${rs * (stacked ? 0.45 : 0.7)}px`, display: 'flex', flexDirection: stacked ? 'column' : 'row', gap: stacked ? `${rs * 0.18}px` : '0px', justifyContent: 'space-between', alignItems: stacked ? 'flex-start' : 'baseline', width: `${col[2]}px` });
      const rule = el('div', '', r);
      Object.assign(rule.style, { position: 'absolute', left: '0px', top: '0px', height: '2px', width: '100%', background: 'var(--line)', transformOrigin: '0 50%' });
      const a = el('div', '', r, { text: label });
      Object.assign(a.style, { font: `500 ${rs * (stacked ? 0.48 : 0.62)}px var(--ui)`, letterSpacing: '0.16em', color: 'rgba(52,50,45,0.55)', whiteSpace: 'nowrap' });
      const b = el('div', '', r, { html: value });
      Object.assign(b.style, { font: `500 ${rs}px var(--display)`, color: 'var(--fg)', whiteSpace: 'nowrap' });
      return { r, rule, a, b };
    });
    return { box, k, tl, rows: rowEls };
  };
  const civicText = mkBlock('LEKKI AJAH, LAGOS', 'Civic Apartment', [
    ['UNITS', '1 &amp; 2 bedroom apartments'],
    ['PRICE', `${N}65M &nbsp;/&nbsp; ${N}85M`],
    ['INITIAL DEPOSIT', `${N}20M`],
  ]);
  const moweText = mkBlock('MOWE, OFADA AXIS, OGUN STATE', 'Mowe Prime', [
    ['STANDARD', `300 sqm &nbsp;·&nbsp; ${N}8M`],
    ['PREMIUM', `500 sqm &nbsp;·&nbsp; ${N}15M`],
    ['TITLE', 'C of O'],
  ]);

  const [sx, sy, sw, sh] = slot;
  // how far the flyer behind each card peeks out on its right
  const PEEK = L({ '16x9': 56, '1x1': 36, '9x16': 56 });
  // Civic leaves to the left on 23, carrying the pin with it.
  const civicRect = (t) => {
    const k = clamp(spring(t - cueT('mowe-in') + 0.05, 'heavy'), 0, 1.05);
    const inK = clamp(spring(t - cueT('civic-in') + 0.12, [600, 34, 1]), 0, 1.1);
    const x0 = sx + (1 - inK) * W * 0.7;
    return { x: x0 - k * (sx + sw + 260), y: sy, w: sw, h: sh, s: 1, k, inK };
  };
  const moweRect = (t) => {
    const inK = clamp(spring(t - cueT('mowe-in') + 0.12, [600, 34, 1]), 0, 1.1);
    return { x: sx + (1 - inK) * W * 0.75, y: sy, w: sw, h: sh, inK };
  };
  // Pin targets: the top-right shoulder of each main card.
  ctx.targets.civic = (t) => {
    const r = civicRect(t);
    return [r.x + r.w - 40 * r.s, r.y + 14 * r.s];
  };
  ctx.targets.mowe = (t) => {
    const r = moweRect(t);
    return [r.x + r.w - 40, r.y + 14];
  };

  const showBlock = (b, t, inCue, rowCues, outAt) => {
    const kIn = clamp(spring(t - cueT(inCue), 'soft'), 0, 1);
    const out = outAt ? clamp(spring(t - outAt, 'heavy'), 0, 1) : 0;
    place(b.box, { x: col[0], y: col[1] - out * 60, show: t >= cueT(inCue) - 0.05 && out < 0.98, clip: out > 0 ? `inset(0 0 ${(out * 100).toFixed(1)}% 0)` : null, z: 6 });
    b.k.style.clipPath = `inset(-10px ${((1 - kIn) * 100).toFixed(1)}% -10px 0)`;
    b.tl.style.transform = `translate3d(0, ${((1 - kIn) * ts * 0.5).toFixed(1)}px, 0)`;
    b.tl.style.clipPath = `inset(-20px 0 ${((1 - kIn) * 100).toFixed(1)}% 0)`;
    b.rows.forEach((r, i) => {
      const tc = cueT(rowCues[i]);
      const kr = clamp(spring(t - tc, 'glide'), 0, 1);
      const kt = clamp(spring(t - tc - 0.05, 'soft'), 0, 1);
      r.rule.style.transform = `scaleX(${kr.toFixed(4)})`;
      r.r.style.visibility = t >= tc ? 'inherit' : 'hidden';
      r.a.style.transform = r.b.style.transform = `translate3d(0, ${((1 - kt) * rs * 0.8).toFixed(1)}px, 0)`;
      r.r.style.clipPath = `inset(0 0 -20px 0)`;
    });
  };

  return {
    id: 'listings',
    root,
    from: T(20),
    to: T(26),
    update(t) {
      // Civic stack
      const c = civicRect(t);
      const fit = (img, w, h) => Math.max(w / img.iw, h / img.ih);
      civic.s.set({ x: c.x, y: c.y, w: sw, h: sh, s: c.s, camX: civic.iw * 0.55, camY: civic.ih * (0.52 - 0.04 * spring(t - cueT('civic-in'), 'drift')), zoom: fit(civic, sw, sh) * 1.04, show: true });
      civic.s.node.style.transformOrigin = '0 0';
      const bk = clamp(spring(t - cueT('civic-in') - 0.05, 'snap'), 0, 1);
      civicBack.s.set({ x: c.x + sw * 0.22 + PEEK * bk, y: c.y + 46, w: sw * 0.78, h: sh * 0.86, s: c.s, r: 2 + 3 * bk, camX: 206, camY: 265, zoom: fit(civicBack, sw * 0.78, sh * 0.86), show: t >= cueT('civic-in') - 0.1 });
      civicBack.s.node.style.transformOrigin = '0 0';
      civicBack.s.node.style.zIndex = 1;
      civic.s.node.style.zIndex = 2;

      // Mowe stack
      const m = moweRect(t);
      const mOn = t >= cueT('mowe-in') - 0.15;
      mowe.s.set({ x: m.x, y: m.y, w: sw, h: sh, camX: 203, camY: 250, zoom: fit(mowe, sw, sh), show: mOn });
      const mb = clamp(spring(t - cueT('mowe-in') - 0.05, 'snap'), 0, 1);
      moweBack.s.set({ x: m.x + sw * 0.22 + PEEK * mb, y: m.y + 46, w: sw * 0.78, h: sh * 0.86, r: 2 + 3 * mb, camX: 203, camY: 263, zoom: fit(moweBack, sw * 0.78, sh * 0.86), show: mOn });
      moweBack.s.node.style.zIndex = 3;
      mowe.s.node.style.zIndex = 4;

      showBlock(civicText, t, 'civic-title', ['civic-f1', 'civic-f2', 'civic-f3'], cueT('mowe-in') - 0.1);
      showBlock(moweText, t, 'mowe-title', ['mowe-f1', 'mowe-f2', 'mowe-f3'], null);
    },
  };
}
