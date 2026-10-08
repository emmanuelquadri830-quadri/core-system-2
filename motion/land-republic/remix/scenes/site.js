// 2 + 3. Brand and discovery (beats 8-20), one continuous scene on the real
// Land Hackers page, on the remix's warm off-white.
//
//  8      the pin drops in and draws the path; "Your path to the right
//         property." is revealed exactly where the pin has passed
//  10-10.75 the top of the real page arrives in four cuts, one per 16th:
//         hero image, hero copy, nav, top bar. They tile back into the page.
//  11     the line leaves, the camera pushes into the page, the cursor enters
//  13     click "Our Properties"            13.5 scroll
//  15     click "LEARN MORE"                15.5 scroll
//  17     click "Verified Listings Access"  17.5 the card lifts off the page
//  19     click the card                    19.5 it flies through the lens
//
// Nothing on the page is redrawn: every pixel is the supplied screenshot.

import { el, place, spring, trackN, clamp } from '../../film/engine.js';
import { layoutLines, makeWord, impulse, makeCursor } from '../../film/kit.js';

const LINE = ['Your', 'path', 'to', 'the', 'right', 'property.'];
const LINES = {
  '16x9': [[0, 1, 2, 3, 4, 5]],
  '1x1': [[0, 1, 2, 3], [4, 5]],
  '9x16': [[0, 1, 2, 3], [4, 5]],
};

const PIECE = [600, 34, 1];
const LAND = 0.13; // seconds from launch to first contact for PIECE

export default function site(ctx) {
  const { stage, W, H, AR, T, L, cueT, manifest: M } = ctx;
  const root = el('div', 'scene site', stage);
  root.style.background = 'var(--bg)';
  const P = M.page;
  const tg = P.targets;
  const src = ctx.asset(P.file);
  const center = (r) => [r[0] + r[2] / 2, r[1] + r[3] / 2];

  // ---------------------------------------------------------------- layout

  // Page framing during the assembly (page units -> stage): the top of the
  // page, 285 units tall, sits in the open part of the frame.
  const A = L({
    '16x9': { zoom: 1.55, camX: 286.5, camY: 142, ox: 0, oy: 110 },
    '1x1': { zoom: 1.6, camX: 286.5, camY: 142, ox: 0, oy: 170 },
    '9x16': { zoom: 1.8, camX: 286.5, camY: 142, ox: 0, oy: 260 },
  });
  // Discovery framings, page units. The content column runs x 101-471.
  const Z = L({ '16x9': 3.0, '1x1': 2.7, '9x16': 2.75 });
  const K = {
    top: [300, L({ '16x9': 130, '1x1': 150, '9x16': 330 })],
    learn: [300, L({ '16x9': 600, '1x1': 610, '9x16': 640 })],
    cards: [300, L({ '16x9': 790, '1x1': 800, '9x16': 800 })],
  };

  const camKeys = [
    [0, [A.camX - A.ox / A.zoom, A.camY - A.oy / A.zoom, A.zoom]],
    [T(11), [K.top[0], K.top[1], Z], 'glide'],
    [T(13.5), [K.learn[0], K.learn[1], Z], 'glide'],
    [T(15.5), [K.cards[0], K.cards[1], Z], 'glide'],
  ];
  const camAt = (t) => {
    const [cx, cy, z] = trackN(t, camKeys);
    // a short punch on every click
    let punch = 0;
    for (const tag of ['click-nav', 'click-learn', 'click-verified']) punch += 0.035 * impulse(t - cueT(tag), [700, 30, 1]);
    return { cx, cy, z: z * (1 + punch) };
  };
  const toStage = (cam, px, py) => [W / 2 + (px - cam.cx) * cam.z, H / 2 + (py - cam.cy) * cam.z];
  // Settled framings for aiming the cursor.
  const settled = (cx, cy) => ({ cx, cy, z: Z });

  // ---------------------------------------------------------------- nodes

  // The whole page as one image once it is assembled.
  const pageBox = el('div', 'layer', root);
  Object.assign(pageBox.style, { width: `${W}px`, height: `${H}px` });
  const pageImg = el('img', '', pageBox, { src });
  Object.assign(pageImg.style, { position: 'absolute', left: '0px', top: '0px', width: `${P.w}px`, height: `${P.h}px`, transformOrigin: '0 0', borderRadius: '8px', boxShadow: '0 40px 80px -30px rgba(52,50,45,0.38)' });

  // Four cuts of the page top that tile back into it.
  const cuts = [
    { crop: [286, 37, 287, 248], beat: 10, from: [0.55, 0.06], rot: 5 },   // hero image, from the right
    { crop: [0, 37, 286, 248], beat: 10.25, from: [-0.5, 0.04], rot: -4 }, // hero copy, from the left
    { crop: [0, 15, 573, 22], beat: 10.5, from: [0, -0.45], rot: -2 },     // nav, from above
    { crop: [0, 0, 573, 15], beat: 10.75, from: [0.1, -0.5], rot: 2 },    // top bar, from above
  ].map((c) => {
    const node = el('div', 'shot', root);
    node.style.background = 'transparent';
    const img = el('img', '', node, { src });
    Object.assign(img.style, { width: `${P.w}px`, height: `${P.h}px`, transformOrigin: '0 0' });
    return { ...c, node, img };
  });

  // The headline.
  const head = el('div', 'layer', root);
  const hs = L({ '16x9': 118, '1x1': 98, '9x16': 112 });
  const hx = L({ '16x9': 150, '1x1': 70, '9x16': 70 });
  const hy = L({ '16x9': H * 0.5, '1x1': H * 0.42, '9x16': H * 0.42 });
  const hpos = layoutLines(LINE, LINES[AR], { size: hs, leading: 1.02, x0: hx, y0: hy, weight: 500, tracking: -0.02 });
  const masks = LINES[AR].map(() => {
    const m = el('div', 'mask', head);
    return m;
  });
  const hwords = LINE.map((w) => makeWord(head, w, { size: hs, weight: 500, color: w === 'property.' ? 'var(--accent)' : 'var(--fg)' }));
  hwords.forEach((n, i) => {
    const li = hpos[i].line;
    masks[li].appendChild(n);
  });

  // The path the pin draws under the last line of the headline.
  const lastLine = LINES[AR][LINES[AR].length - 1];
  const lineFirst = hpos[lastLine[0]];
  const lineLast = hpos[lastLine[lastLine.length - 1]];
  const pathY = lineFirst.y + hs * 0.32;
  const pathX0 = lineFirst.x - 24;
  const pathX1 = Math.max(...hpos.map((p) => p.x + p.w)) + 24;
  const trail = el('div', 'layer', head);
  Object.assign(trail.style, { height: '6px', borderRadius: '3px', background: 'var(--accent)', transformOrigin: '0 50%' });
  // Head position after it lifts to make room for the page (beat 10).
  const headLift = (t) => {
    const k = spring(t - T(10) + 0.1, 'heavy');
    const up = L({ '16x9': H * 0.5 - 170, '1x1': H * 0.42 - 210, '9x16': H * 0.42 - 300 });
    return { y: -up * k, s: 1 - 0.28 * k };
  };
  const headPoint = (t, x, y) => {
    const h = headLift(t);
    const out = spring(t - T(11), 'heavy');
    // head scales about (hx, hy)
    return [hx + (x - hx) * h.s - out * W * 0.9, hy + (y - hy) * h.s + h.y];
  };
  // the pin's own spring for the trail, mirrored here so the reveal follows it
  const trailX = (t) => pathX0 + (pathX1 - pathX0) * clamp(spring(t - T(8), 'glide'), 0, 1);
  ctx.targets['path-start'] = (t) => headPoint(t, pathX0, pathY);
  ctx.targets['path-end'] = (t) => headPoint(t, pathX1, pathY);
  ctx.targets.away = () => [W * 1.15, -H * 0.2];

  // The Verified Listings card, lifted off the page as a real crop.
  const lift = el('div', 'shot', root);
  const liftImg = el('img', '', lift, { src });
  const vc = tg.cardVerified;
  Object.assign(lift.style, { background: 'transparent', borderRadius: '10px', boxShadow: '0 50px 90px -30px rgba(52,50,45,0.6)' });
  Object.assign(liftImg.style, { width: `${P.w}px`, height: `${P.h}px`, transformOrigin: '0 0' });

  const dim = el('div', 'layer', root);
  Object.assign(dim.style, { width: `${W}px`, height: `${H}px`, background: 'var(--fg)' });
  root.appendChild(lift); // above the dim

  const cursor = makeCursor(root);

  // Where the lifted card floats, in stage pixels.
  const liftZ = L({ '16x9': 5.6, '1x1': 6.4, '9x16': 7.2 });
  const liftC = L({ '16x9': [W * 0.58, H * 0.5], '1x1': [W * 0.5, H * 0.52], '9x16': [W * 0.5, H * 0.5] });

  // Cursor path, aimed at real elements in the settled framings.
  const tNav = toStage(settled(...K.top), ...center(tg.navOurProperties));
  const tLearn = toStage(settled(...K.learn), ...center(tg.learnMore));
  const tCard = toStage(settled(...K.cards), ...center(tg.cardVerified));
  const path = [
    [T(11), W * 0.86, H * 1.08],
    [T(11.25), tNav[0], tNav[1] + 4],
    [T(13.6), tLearn[0], tLearn[1] + 4],
    [T(15.6), tCard[0] + 10, tCard[1] + 10],
    [T(17.6), liftC[0] + 40, liftC[1] + 20],
  ];
  const clicks = ['click-nav', 'click-learn', 'click-verified', 'click-open'].map(cueT);

  return {
    id: 'site',
    root,
    from: T(8),
    to: T(20),
    update(t) {
      const cam = camAt(t);
      const assembled = t >= T(10.95);

      // ------------------------------------------------ page and its cuts
      const [px0, py0] = toStage(cam, 0, 0);
      pageImg.style.transform = `translate3d(${px0.toFixed(2)}px, ${py0.toFixed(2)}px, 0) scale(${cam.z.toFixed(5)})`;
      // Only the assembled top exists until the push, then the rest of the
      // page unrolls below it.
      const unroll = clamp(spring(t - T(11), 'glide'), 0, 1);
      const visH = 285 + (P.h - 285) * unroll;
      const bottom = Math.max(0, H - (py0 + visH * cam.z));
      place(pageBox, { show: assembled, clip: `inset(0 0 ${bottom.toFixed(1)}px 0)` });

      cuts.forEach((c) => {
        // Launch early so the first contact lands on the beat with the pop.
        const tb = T(c.beat) - LAND;
        const [cx, cy, cw, ch] = c.crop;
        if (assembled || t < tb) {
          place(c.node, { show: false });
          return;
        }
        const k = spring(t - tb, PIECE);
        const [sx, sy] = toStage(cam, cx, cy);
        const fx = c.from[0] * W;
        const fy = c.from[1] * H;
        c.node.style.width = `${(cw * cam.z).toFixed(2)}px`;
        c.node.style.height = `${(ch * cam.z).toFixed(2)}px`;
        c.img.style.transform = `translate3d(${(-cx * cam.z).toFixed(2)}px, ${(-cy * cam.z).toFixed(2)}px, 0) scale(${cam.z.toFixed(5)})`;
        place(c.node, { x: sx + fx * (1 - k), y: sy + fy * (1 - k), r: c.rot * (1 - k), show: true });
      });

      // ------------------------------------------------ headline
      const hl = headLift(t);
      const out = spring(t - T(11), 'heavy');
      head.style.transformOrigin = `${hx}px ${hy}px`;
      place(head, { x: -out * (W * 0.9), y: hl.y, s: hl.s, show: t < T(12.5) });
      const reveal = trailX(t);
      const lines = LINES[AR];
      lines.forEach((line, li) => {
        const m = masks[li];
        const first = hpos[line[0]];
        const last = hpos[line[line.length - 1]];
        const top = first.y - hs * 0.95;
        const isLast = li === lines.length - 1;
        Object.assign(m.style, { left: `${first.x - 10}px`, top: `${top}px`, width: `${last.x + last.w - first.x + 40}px`, height: `${hs * 1.22}px` });
        // earlier lines rise on the drop; the last line exists only where the
        // pin has already been
        const rise = isLast ? 1 : spring(t - T(8) - li * 0.045, 'snap');
        m.style.clipPath = isLast ? `inset(-20px ${Math.max(0, first.x - 10 + last.x + last.w - first.x + 40 - reveal).toFixed(1)}px -20px 0)` : 'none';
        line.forEach((wi) => {
          const p = hpos[wi];
          place(hwords[wi], { x: p.x - first.x + 10, y: (1 - rise) * hs * 1.2 + hs * 0.13, show: true });
        });
      });
      trail.style.width = `${Math.max(0, reveal - pathX0).toFixed(1)}px`;
      place(trail, { x: pathX0, y: pathY - 3, show: t >= T(8.2) });

      // ------------------------------------------------ the lifted card
      const tLift = cueT('verified-lift');
      const tOpen = cueT('open-listing');
      if (t >= tLift - 0.02) {
        const k = spring(t - tLift, 'heavy');
        const [sx, sy] = toStage(cam, vc[0], vc[1]);
        const fromC = [sx + (vc[2] * cam.z) / 2, sy + (vc[3] * cam.z) / 2];
        const z = cam.z + (liftZ - cam.z) * k;
        // fly through the lens on 19.5
        const fly = Math.max(0, spring(t - tOpen + 0.06, [160, 16, 1]));
        const zz = z * (1 + 9 * fly * fly);
        const c = [fromC[0] + (liftC[0] - fromC[0]) * k, fromC[1] + (liftC[1] - fromC[1]) * k];
        lift.style.width = `${(vc[2] * zz).toFixed(2)}px`;
        lift.style.height = `${(vc[3] * zz).toFixed(2)}px`;
        lift.style.borderRadius = `${(4 * zz / cam.z).toFixed(1)}px`;
        liftImg.style.transform = `translate3d(${(-vc[0] * zz).toFixed(2)}px, ${(-vc[1] * zz).toFixed(2)}px, 0) scale(${zz.toFixed(5)})`;
        place(lift, { x: c[0] - (vc[2] * zz) / 2, y: c[1] - (vc[3] * zz) / 2, r: -2.5 * (1 - k) + 1.5 * impulse(t - cueT('click-open'), [600, 26, 1]), show: true });
        place(dim, { show: true, o: 0.55 * clamp(k) });
      } else {
        place(lift, { show: false });
        place(dim, { show: false });
      }

      // ------------------------------------------------ cursor
      cursor.update(t, path, clicks, { show: t >= T(11) && t < tOpen + 0.05, scale: L({ '16x9': 1.5, '1x1': 1.5, '9x16': 1.9 }) });
    },
  };
}
