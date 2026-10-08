// Reveal and value (beats 7.33-17). A lens opens on the Lekki Ajah pin and
// the real Civic Apartment aerial grows out of it; a pin and the plot
// boundary land on the building, a tag tracks it. On 10.67 the camera drops
// through depth to the street-level render, where two amenities and the
// price come straight from the Land Republic flyer, each callout pinned to
// the picture.

import { el, place, spring, track, clamp, wipe } from '../../film/engine.js';
import { makeShot, makePin, makeBoundary } from '../../film/kit.js';
import { camera } from './map.js';
import { PLACES } from '../timeline.mjs';

const PLOT = [[30, 470], [470, 70], [965, 420], [560, 1010]];
const BUILDING = [505, 520];

export default function placeScene(ctx) {
  const { stage, W, H, AR, T, L, cueT, manifest: M } = ctx;
  const root = el('div', 'scene place', stage);
  const cam = camera(ctx);
  const A = M.images.aerial;
  const E = M.images.perspective;
  const diag = Math.hypot(W, H);

  const aerial = makeShot(root, { src: ctx.asset(A.file), iw: A.w, ih: A.h });
  const elev = makeShot(root, { src: ctx.asset(E.file), iw: E.w, ih: E.h });
  aerial.node.style.background = elev.node.style.background = 'transparent';
  const plot = makeBoundary(root, W, H);
  const rim = el('div', 'layer', root);
  Object.assign(rim.style, { borderRadius: '50%', border: '2px solid rgba(255,255,255,0.55)', boxShadow: '0 40px 120px rgba(0,0,0,0.55)' });
  const pinLayer = el('div', 'layer', root);
  pinLayer.style.zIndex = 5;
  const pin = makePin(pinLayer, { size: L({ '16x9': 72, '1x1': 66, '9x16': 80 }) });

  const ui = (size, weight = 500, track = '0.18em') => `font: ${weight} ${size}px var(--ui); letter-spacing: ${track}; white-space: nowrap; color: var(--white);`;

  // Tag tracked to the building.
  const tag = el('div', 'layer', root);
  tag.innerHTML = `<div class="stem"></div><div class="txt"><div style="${ui(L({ '16x9': 30, '1x1': 28, '9x16': 34 }))}">CIVIC APARTMENT</div><div style="${ui(L({ '16x9': 20, '1x1': 19, '9x16': 22 }), 400, '0.14em')} opacity:0.7; margin-top:6px">LEKKI AJAH, LAGOS</div></div>`;
  const tagStem = tag.querySelector('.stem');
  const tagTxt = tag.querySelector('.txt');
  Object.assign(tagStem.style, { position: 'absolute', left: '-1px', bottom: '0px', width: '2px', background: 'var(--white)' });
  Object.assign(tagTxt.style, { position: 'absolute', left: '16px' });

  // Statement, two lines, lower left.
  const ss = L({ '16x9': 74, '1x1': 62, '9x16': 72 });
  const stmt = el('div', 'layer', root);
  const s1 = el('div', '', stmt, { text: 'A PLACE TO BUILD' });
  const s2 = el('div', '', stmt, { text: 'WHAT COMES NEXT.' });
  [s1, s2].forEach((n) => Object.assign(n.style, { font: `500 ${ss}px var(--display)`, letterSpacing: '0.06em', color: 'var(--white)', whiteSpace: 'nowrap', lineHeight: '1.12', textShadow: '0 4px 30px rgba(0,0,0,0.45)' }));

  // Callouts pinned to the elevation.
  const mkCallout = (title, sub) => {
    const box = el('div', 'layer', root);
    const dot = el('div', '', box);
    Object.assign(dot.style, { position: 'absolute', left: '-9px', top: '-9px', width: '18px', height: '18px', borderRadius: '50%', background: 'var(--accent)', border: '3px solid var(--white)' });
    const line = el('div', '', box);
    Object.assign(line.style, { position: 'absolute', left: '0px', top: '-1px', height: '2px', background: 'var(--white)', transformOrigin: '0 50%' });
    const card = el('div', '', box);
    card.innerHTML = `<div style="${ui(L({ '16x9': 34, '1x1': 30, '9x16': 36 }), 500, '0.12em')}">${title}</div>${sub ? `<div style="${ui(L({ '16x9': 22, '1x1': 20, '9x16': 24 }), 400, '0.12em')} opacity:0.72; margin-top:6px">${sub}</div>` : ''}`;
    Object.assign(card.style, { position: 'absolute', padding: '16px 20px', background: 'rgba(10,14,20,0.78)', borderLeft: '3px solid var(--accent)' });
    return { box, dot, line, card };
  };
  // Cards sit in fixed, safe places; the leader runs to a tracked point.
  const callouts = [
    { ...mkCallout('24/7 SECURITY', 'CCTV SURVEILLANCE'), at: [560, 900], cue: 'callout-1', pos: L({ '16x9': [1290, 600], '1x1': [560, 640], '9x16': [470, 1180] }) },
    { ...mkCallout('UNINTERRUPTED', 'POWER SUPPLY'), at: [700, 470], cue: 'callout-2', pos: L({ '16x9': [1290, 330], '1x1': [560, 420], '9x16': [470, 520] }) },
  ];

  // Price plate.
  const plate = el('div', 'layer', root);
  const ps = L({ '16x9': 1, '1x1': 0.9, '9x16': 1.05 });
  plate.innerHTML = `<div class="a" style="${ui(24 * ps, 500, '0.16em')} opacity:0.8">1 &amp; 2 BEDROOM APARTMENTS</div>
<div class="b" style="font: 500 ${70 * ps}px var(--display); letter-spacing: 0.01em; color: var(--white); white-space: nowrap; margin-top: 10px">From <span style="font-family: Inter, var(--display)">₦</span>65M</div>
<div class="c" style="${ui(24 * ps, 500, '0.14em')} margin-top: 14px; color: #8FB6F5"><span style="font-family: Inter, var(--ui)">₦</span>20M INITIAL DEPOSIT</div>`;
  Object.assign(plate.style, { padding: `${30 * ps}px ${38 * ps}px`, background: 'rgba(10,14,20,0.84)', borderTop: '3px solid var(--accent)' });
  const pa = plate.querySelector('.a'), pb = plate.querySelector('.b'), pc = plate.querySelector('.c');

  return {
    id: 'place',
    root,
    from: T(7.33) - 0.01,
    to: T(17),
    update(t) {
      const tLens = cueT('lens');
      const tRev = cueT('reveal');
      const tEl = cueT('to-elevation');

      // ---------------------------------------------- lens -> aerial
      const [px, py] = cam.project(Math.min(t, tRev), PLACES.ajah.lon, PLACES.ajah.lat);
      const R = L({ '16x9': H * 0.47, '1x1': W * 0.45, '9x16': W * 0.46 });
      const r = track(t, [[tLens, 0], [tLens, L({ '16x9': 110, '1x1': 100, '9x16': 120 }), 'snap'], [tRev - 0.3, R, [55, 14.8, 1]], [tEl, diag * 0.8, 'heavy']]);
      const open = clamp((t - (tRev - 0.3)) / 0.5, 0, 1);
      const cx = px + (W / 2 - px) * spring(t - tRev + 0.3, 'glide');
      const cy = py + (H / 2 - py) * spring(t - tRev + 0.3, 'glide');
      // the whole plot inside the lens: 1000 image px across its diameter
      const cover = (2 * R) / 1000;
      const z0 = cover * 0.55;
      const zoom = (z0 + (cover - z0) * clamp(spring(t - tLens, 'glide'), 0, 1.05)) * (1 + 0.1 * spring(t - tRev, 'drift'));
      // depth drop into the elevation
      const dive = clamp(spring(t - tEl, 'heavy'), 0, 1.2);
      aerial.set({
        x: 0, y: 0, w: W, h: H,
        camX: BUILDING[0] + (cx - W / 2) / zoom * -1, camY: BUILDING[1] + (cy - H / 2) / zoom * -1,
        zoom: zoom * (1 + 0.6 * dive), r: -4 * (1 - clamp(spring(t - tLens, 'drift'), 0, 1)),
        show: t < tEl + 0.7, clip: `circle(${r.toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px)`, blur: 10 * clamp(dive, 0, 1),
      });
      aerial.node.style.zIndex = 1;
      rim.style.width = rim.style.height = `${(2 * r).toFixed(1)}px`;
      place(rim, { x: cx - r, y: cy - r, show: t < tEl + 0.05 && r > 2, z: 2 });
      void open;

      // pin + plot + tag on the aerial (they ride the same camera)
      const onAerial = t < tEl + 0.25;
      const [bx, by] = aerial.toStage(...BUILDING);
      pin.update(onAerial ? t : -1, tRev - 0.05, bx, by, { drop: H * 0.3 });
      plot.update(onAerial ? t : -1, cueT('boundary') - 0.1, PLOT.map((p) => aerial.toStage(...p)));
      plot.svg.style.clipPath = `circle(${r.toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px)`;
      plot.svg.style.zIndex = 3;
      plot.svg.querySelector('polygon').setAttribute('fill-opacity', (0.12 * clamp(spring(t - cueT('boundary') - 0.2, 'soft'), 0, 1)).toFixed(3));
      const [tx, ty] = aerial.toStage(820, 330);
      const tt = cueT('tag-civic');
      const kt = clamp(spring(t - tt, 'snap'), 0, 1);
      const sh = L({ '16x9': 120, '1x1': 100, '9x16': 130 });
      tagStem.style.height = `${(sh * kt).toFixed(1)}px`;
      tagTxt.style.top = `${-sh - 20}px`;
      tagTxt.style.clipPath = `inset(-10px ${((1 - clamp(spring(t - tt - 0.12, 'soft'), 0, 1)) * 100).toFixed(1)}% -10px 0)`;
      place(tag, { x: Math.min(tx, W - 420), y: ty, show: t >= tt && onAerial, z: 6 });

      // ---------------------------------------------- elevation
      const ecov = Math.max(W / E.w, H / E.h) * 1.1;
      const ez = ecov * (1.12 - 0.12 * spring(t - tEl, 'drift'));
      const ecam = [L({ '16x9': 560, '1x1': 560, '9x16': 600 }), 620 + 140 * (1 - Math.min(1, dive))];
      elev.set({ x: 0, y: 0, w: W, h: H, camX: ecam[0], camY: ecam[1], zoom: ez, show: t >= tEl, clip: wipe(Math.min(1, dive), 'up') });
      elev.node.style.zIndex = 2;

      // ---------------------------------------------- statement
      const sx = L({ '16x9': 110, '1x1': 70, '9x16': 80 });
      const sy = L({ '16x9': 110, '1x1': 90, '9x16': 170 });
      const out = -spring(t - T(12.67), 'heavy');
      [s1, s2].forEach((n, i) => {
        const tn = cueT(i ? 'line-next' : 'line-build');
        const k = clamp(spring(t - tn, 'soft'), 0, 1);
        n.style.clipPath = `inset(-20px ${((1 - k) * 100).toFixed(1)}% -20px 0)`;
        n.style.transform = `translate3d(${(-30 * (1 - k)).toFixed(1)}px, 0, 0)`;
      });
      place(stmt, { x: sx, y: sy + 400 * out, show: t >= cueT('line-build') && t < T(13.6), z: 8 });

      // ---------------------------------------------- callouts
      callouts.forEach((c) => {
        const tc = cueT(c.cue);
        const [ax, ay] = elev.toStage(...c.at);
        const [qx, qy] = [c.pos[0], c.pos[1] + 30];
        const kd = clamp(spring(t - tc, 'snap'), 0, 1.2);
        const kl = clamp(spring(t - tc - 0.06, 'glide'), 0, 1);
        const kc = clamp(spring(t - tc - 0.28, 'soft'), 0, 1);
        const dx = qx - ax, dy = qy - ay;
        const len = Math.hypot(dx, dy);
        c.line.style.width = `${(len * kl).toFixed(1)}px`;
        c.line.style.transform = `rotate(${((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(2)}deg)`;
        c.dot.style.transform = `scale(${kd.toFixed(3)})`;
        c.card.style.left = `${dx.toFixed(1)}px`;
        c.card.style.top = `${(dy - 30).toFixed(1)}px`;
        c.card.style.clipPath = `inset(0 ${((1 - kc) * 100).toFixed(1)}% 0 0)`;
        place(c.box, { x: ax, y: ay, show: t >= tc, z: 9 });
      });

      // ---------------------------------------------- price plate
      const tp = cueT('price');
      const kp = clamp(spring(t - tp, 'snap'), 0, 1);
      const kd2 = clamp(spring(t - cueT('deposit'), 'soft'), 0, 1);
      pa.style.clipPath = pb.style.clipPath = `inset(0 ${((1 - clamp(spring(t - tp - 0.1, 'soft'), 0, 1)) * 100).toFixed(1)}% 0 0)`;
      pc.style.clipPath = `inset(0 ${((1 - kd2) * 100).toFixed(1)}% 0 0)`;
      const pw = plate.offsetWidth;
      const ph = plate.offsetHeight;
      const ppos = L({ '16x9': [110, H - ph - 100], '1x1': [60, H - ph - 60], '9x16': [80, H - ph - 220] });
      place(plate, { x: ppos[0], y: ppos[1] + 40 * (1 - kp), show: t >= tp, clip: `inset(${((1 - kp) * 100).toFixed(1)}% 0 0 0)`, z: 10 });
      void pw;
    },
  };
}
