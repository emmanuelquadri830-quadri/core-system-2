// SCENE 5, beat 22.5 to 15.0 s (11.43 to 15.0 s): the end card.
//   22.5   cut to the front elevation render inside the curved frame
//   23     the frame pulls back and shrinks away into near-black, toward
//          the spot where the logo will appear
//   24     the Land Republic logo, on the low hit
//   24.5   "Civic Apartment, Lekki Gardens Phase 5"
//   24.75  the blue "Book an inspection" button
//   25     "landrepublic.co"
//   25.25  "In collaboration with Gidi"
// Everything has landed by 13.4 s; from 13.5 s the frame holds completely
// still (the compositor freezes the grain too).
import { W, H, SAFE, COLOR, beatTime, beatFrameTime, lerp, span, smoothstep, easeIn, easeOut } from './lib.js';
import { layoutHeadline, drawHeadline, setFont } from './type.js';
import { FRAME_RADII } from './frame.js';

export const START = beatFrameTime(22.5); // 11.433 s, scene 4's cut
export const END = 15.0;
export const HOLD = 13.5;                 // nothing moves after this
const B = beatTime;

// Words, exactly as supplied.
const TITLE = [[{ text: 'Civic' }, { text: 'Apartment,' }], [{ text: 'Lekki' }, { text: 'Gardens' }, { text: 'Phase' }, { text: '5' }]];
const BUTTON = 'Book an inspection';
const URL = [[{ text: 'landrepublic.co' }]];
const CREDIT = [[{ text: 'In collaboration with Gidi' }]]; // one unit, so it lands in time

const T_PULL = B(23), T_LOGO = B(24), T_TITLE = B(24.5), T_BUTTON = B(24.75), T_URL = B(25), T_CREDIT = B(25.25);

// Assets.
const RENDER = { file: 'assets/renders/front-elevation-full.webp', w: 971, h: 1214 };
const LOGO = { file: 'assets/brand/logo-white@8x.png', w: 904, h: 320, markW: 300 };
const images = {};

// Layout: one centred column inside the safe area.
const LOGO_W = 500, LOGO_H = LOGO_W * (LOGO.h / LOGO.w);
const TITLE_SIZE = 56, BTN = { h: 104, text: 40, pad: 60 }, URL_SIZE = 40, CREDIT_SIZE = 28;
const GAPS = { logo: 70, title: 60, button: 50, url: 90 };
const STACK_H = LOGO_H + GAPS.logo + 2 * TITLE_SIZE + GAPS.title + BTN.h + GAPS.button + URL_SIZE + GAPS.url + CREDIT_SIZE;
const TOP = SAFE.top + (SAFE.bottom - SAFE.top - STACK_H) / 2;
const Y = {
  logo: TOP,
  title: TOP + LOGO_H + GAPS.logo,
  button: TOP + LOGO_H + GAPS.logo + 2 * TITLE_SIZE + GAPS.title,
};
Y.url = Y.button + BTN.h + GAPS.button;
Y.credit = Y.url + URL_SIZE + GAPS.url;
const LOGO_CENTRE = [W / 2, Y.logo + LOGO_H / 2];

// The framed render at the cut, and how it pulls back.
const FRAME0 = { w: 960, h: 1500, cx: W / 2, cy: H / 2 };
function frameState(t) {
  const p = easeOut(span(t, T_PULL, T_LOGO - 0.04 - T_PULL)); // accelerates away
  const s = 1 - p;
  return {
    s,
    w: FRAME0.w * s,
    h: FRAME0.h * s,
    cx: lerp(FRAME0.cx, LOGO_CENTRE[0], smoothstep(p)),
    cy: lerp(FRAME0.cy, LOGO_CENTRE[1], smoothstep(p)),
    push: 1.04 - 0.02 * span(t, START, T_PULL - START), // a slow push before it goes
  };
}

function framePath(w, h, cx, cy) {
  const m = Math.min(w, h);
  const p = new Path2D();
  p.roundRect(cx - w / 2, cy - h / 2, w, h, [FRAME_RADII.tl * m, FRAME_RADII.tr * m, FRAME_RADII.br * m, FRAME_RADII.bl * m]);
  return p;
}

function drawFrame(ctx, t) {
  const f = frameState(t);
  if (f.s <= 0.003) return;
  const path = framePath(f.w, f.h, f.cx, f.cy);
  ctx.save();
  ctx.clip(path);
  // the render covers the frame, scaled with it: the whole picture recedes
  const img = images.render;
  const z = Math.max(FRAME0.w / RENDER.w, FRAME0.h / RENDER.h) * f.push * f.s;
  ctx.drawImage(img, f.cx - (RENDER.w / 2) * z, f.cy - (RENDER.h / 2) * z, RENDER.w * z, RENDER.h * z);
  ctx.restore();
  // the frame's white edge, as in scenes 1 and 2
  ctx.save();
  ctx.strokeStyle = COLOR.white;
  ctx.lineWidth = 4;
  ctx.shadowColor = COLOR.blue;
  ctx.shadowBlur = 24;
  ctx.stroke(path);
  ctx.restore();
}

// The large, faint flower mark, bottom right, partly off the frame.
function drawMark(ctx, t) {
  const a = 0.055 * easeIn(span(t, T_PULL, 0.6));
  if (a <= 0) return;
  const scale = 3.4;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.drawImage(images.logo, 0, 0, LOGO.markW, LOGO.h, W - LOGO.markW * scale * 0.62, H - LOGO.h * scale * 0.78, LOGO.markW * scale, LOGO.h * scale);
  ctx.restore();
}

// The logo rises into place inside its own box, like the headline words.
function drawLogo(ctx, t) {
  const k = easeIn(span(t, T_LOGO, 0.5));
  if (k <= 0) return;
  const x = W / 2 - LOGO_W / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 20, Y.logo - 20, LOGO_W + 40, LOGO_H + 40);
  ctx.clip();
  ctx.drawImage(images.logo, x, Y.logo + (1 - k) * LOGO_H * 0.9, LOGO_W, LOGO_H);
  ctx.restore();
}

function drawButton(ctx, t) {
  const k = easeIn(span(t, T_BUTTON, 0.5));
  if (k <= 0) return;
  setFont(ctx, BTN.text, 500);
  const tw = ctx.measureText(BUTTON).width;
  const w = tw + 2 * BTN.pad;
  const s = lerp(0.94, 1, k);
  const cy = Y.button + BTN.h / 2 + (1 - k) * 40;
  ctx.save();
  ctx.globalAlpha = Math.min(1, span(t, T_BUTTON, 0.15) * 1.2);
  ctx.translate(W / 2, cy);
  ctx.scale(s, s);
  ctx.fillStyle = COLOR.blue;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -BTN.h / 2, w, BTN.h, BTN.h / 2);
  ctx.fill();
  ctx.fillStyle = COLOR.white;
  const cap = ctx.measureText('H').actualBoundingBoxAscent;
  ctx.fillText(BUTTON, -tw / 2, cap / 2);
  ctx.restore();
}

// Centred layouts built from the left-aligned headline layout.
function centred(ctx, lines, y, size, weight = 500) {
  let index = 0;
  const words = [];
  lines.forEach((line, row) => {
    const probe = layoutHeadline(ctx, [line], { x: 0, y: y + row * size, size, weight });
    const shift = (W - probe.right) / 2;
    for (const w of probe.words) words.push({ ...w, x: w.x + shift, index: index++ });
  });
  return { words, size, weight };
}
let L = null;
function layouts(ctx) {
  if (!L) {
    L = {
      title: centred(ctx, TITLE, Y.title, TITLE_SIZE),
      url: centred(ctx, URL, Y.url, URL_SIZE),
      credit: centred(ctx, CREDIT, Y.credit, CREDIT_SIZE, 400),
    };
  }
  return L;
}

export const scene5 = {
  name: 'scene5',
  start: START,
  end: END,
  holdFrom: HOLD,

  async load() {
    await Promise.all([['render', RENDER.file], ['logo', LOGO.file]].map(async ([key, src]) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      images[key] = img;
    }));
  },

  plate(pctx) {
    pctx.fillStyle = COLOR.ink; // near-black
    pctx.fillRect(0, 0, W, H);
  },
  grade: 'none',

  draw(ctx, t) {
    // past the hold point, draw the held frame: nothing can move
    const tt = Math.min(t, HOLD);
    const lay = layouts(ctx);
    drawMark(ctx, tt);
    drawFrame(ctx, tt);
    drawLogo(ctx, tt);
    drawHeadline(ctx, lay.title, tt, { inAt: T_TITLE });
    drawButton(ctx, tt);
    drawHeadline(ctx, lay.url, tt, { inAt: T_URL, color: 'rgba(255,255,255,0.9)' });
    drawHeadline(ctx, lay.credit, tt, { inAt: T_CREDIT, color: 'rgba(255,255,255,0.55)' });
  },

  // No motion blur: on a shrinking frame it would read as a zoom blur.
  blurWindows() {
    return [];
  },

  debug: { Y, STACK_H, frameState },
};
