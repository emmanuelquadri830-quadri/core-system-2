// SCENE 4, 8.133 to 11.7 s: outright prices and the payment plan control.
//   beat 16    (8.133 s) the curved frame wipes across to warm off-white
//   beat 16.5  (8.390 s) "Outright from"
//   beat 17    (8.644 s) card "1 Bedroom ₦65M"; small print with the first price
//              (8.794 s) card "2 Bedroom ₦85M", 0.15 s later
//   beat 17.5  (8.898 s) segmented control slides in
//   beat 18    (9.153 s) blue indicator appears on "0-3"
//   beat 18.5, 19, 19.5  indicator steps to "6", "9", "12 months" and stops
//   beat 20    (10.169 s) headline "Spread it over 12 months."
//   beat 23    (11.7 s)  cut to scene 5
import { W, H, SAFE, COLOR, beatTime as B, beatFrameTime, span, lerp, easeIn } from './lib.js';
import { layoutHeadline, drawHeadline, headlineBlurWindows, setFont } from './type.js';
import { framePath } from './frame.js';
import { END as START, drawDetail } from './scene3.js';

export const END = beatFrameTime(23);

const T_WIPE = START;
const T_LABEL = B(16.5);
const T_CARDS = [B(17), B(17) + 0.15];
const T_PRINT = B(17);
const T_CONTROL = B(17.5);
const T_INDICATOR = B(18);
// Each entry is the time the indicator starts moving onto that option.
export const T_STEPS = [B(18.5), B(19), B(19.5)];
const T_HEADLINE = B(20);

// ---------------------------------------------------------------------------
// Layout, top to bottom, centred in the safe area above the small print.
const GAP = 24;
const HEAD_SIZE = 104;
const LABEL_SIZE = 36;
const CARD_H = 250;
const CONTROL_H = 104;
const STACK = HEAD_SIZE * 2 + 64 + LABEL_SIZE * 1.2 + 20 + CARD_H + 48 + CONTROL_H;
const TOP = SAFE.top + (SAFE.bottom - 80 - SAFE.top - STACK) / 2;
const Y = {
  head: TOP,
  label: TOP + HEAD_SIZE * 2 + 64,
  cards: TOP + HEAD_SIZE * 2 + 64 + LABEL_SIZE * 1.2 + 20,
};
Y.control = Y.cards + CARD_H + 48;
const CARD_W = (SAFE.right - SAFE.left - GAP) / 2;

const CARDS = [
  { unit: '1 Bedroom', price: '₦65M' },
  { unit: '2 Bedroom', price: '₦85M' },
];
const OPTIONS = ['0-3', '6', '9', '12 months'];
const PRINT = 'Outright prices shown. Instalment prices differ.';

let L = null;
function layouts(ctx) {
  if (L) return L;
  const label = (text, x, y, size, weight = 400) =>
    layoutHeadline(ctx, [text.split(' ').map((t) => ({ text: t }))], { x, y, size, weight, lineHeight: 1.2, tracking: weight === 500 ? -0.02 : 0 });
  L = {
    // "12 months." travels as one accent: the number and its unit read as one value.
    head: layoutHeadline(ctx, [[{ text: 'Spread' }, { text: 'it' }, { text: 'over' }], [{ text: '12 months.', blue: true }]], { x: SAFE.left, y: Y.head, size: HEAD_SIZE }),
    label: label('Outright from', SAFE.left, Y.label, LABEL_SIZE),
    cards: CARDS.map((c, i) => {
      const x = SAFE.left + i * (CARD_W + GAP);
      return {
        x,
        unit: label(c.unit, x + 32, Y.cards + 30, 34),
        price: layoutHeadline(ctx, [[{ text: c.price }]], { x: x + 30, y: Y.cards + CARD_H - 32 - 104, size: 104 }),
      };
    }),
  };
  return L;
}

// ---------------------------------------------------------------------------
// The wipe: a blue curved frame leads, the off-white one follows and stays.
// Their big rounded corner leads the move across the screen, right to left.
const WIPE_RADII = { tl: 0.07, tr: 0.07, br: 0.07, bl: 0.34 };
function wipePanel(ctx, t, delay, color) {
  const p = easeIn(span(t, T_WIPE + delay, 0.5));
  if (p <= 0) return 0;
  const w = W + 520;
  const x = lerp(W, -360, p);
  ctx.fillStyle = color;
  framePath(ctx, x, -40, w, H + 80, WIPE_RADII);
  ctx.fill();
  return p;
}

function drawCard(ctx, t, i) {
  const t0 = T_CARDS[i];
  const p = easeIn(span(t, t0, 0.5));
  if (p <= 0) return;
  const c = layouts(ctx).cards[i];
  ctx.save();
  ctx.translate(0, (1 - p) * 140);
  ctx.globalAlpha = Math.min(1, p * 3);
  ctx.shadowColor = 'rgba(15,15,15,0.10)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = COLOR.white;
  framePath(ctx, c.x, Y.cards, CARD_W, CARD_H);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  drawHeadline(ctx, c.unit, t, { inAt: t0 + 0.08, color: COLOR.ink });
  drawHeadline(ctx, c.price, t, { inAt: t0 + 0.14, color: COLOR.ink });
  ctx.restore();
}

// Indicator position along the options, 0 to 3, eased between steps.
function indicatorPos(t) {
  let pos = 0;
  T_STEPS.forEach((ts, i) => { pos = lerp(pos, i + 1, easeIn(span(t, ts, 0.32))); });
  return pos;
}

function drawControl(ctx, t) {
  const p = easeIn(span(t, T_CONTROL, 0.5));
  if (p <= 0) return;
  const x = SAFE.left, w = SAFE.right - SAFE.left, y = Y.control, h = CONTROL_H;
  const seg = w / OPTIONS.length;
  ctx.save();
  ctx.translate(0, (1 - p) * 120);
  ctx.globalAlpha = Math.min(1, p * 3);
  ctx.fillStyle = COLOR.white;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(15,15,15,0.08)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Indicator: a blue pill that grows in on "0-3", then steps right.
  const show = easeIn(span(t, T_INDICATOR, 0.4));
  const pos = indicatorPos(t);
  const inset = 8;
  if (show > 0) {
    const iw = (seg - inset * 2) * lerp(0.4, 1, show);
    const ix = x + seg * pos + seg / 2 - iw / 2;
    ctx.fillStyle = COLOR.blue;
    ctx.globalAlpha = Math.min(1, p * 3) * Math.min(1, show * 2);
    ctx.beginPath();
    ctx.roundRect(ix, y + inset, iw, h - inset * 2, (h - inset * 2) / 2);
    ctx.fill();
    ctx.globalAlpha = Math.min(1, p * 3);
  }

  // Labels: white where the indicator sits over them, ink elsewhere.
  setFont(ctx, 32, 500, 0);
  ctx.textAlign = 'center';
  OPTIONS.forEach((label, i) => {
    const ty = y + h / 2 + 11;
    const k = easeIn(span(t, T_CONTROL + 0.1 + i * 0.06, 0.5)); // word by word, rising
    if (k <= 0) return;
    const on = show > 0 ? Math.max(0, 1 - Math.abs(pos - i)) * Math.min(1, show * 2) : 0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + seg * i, y, seg, h);
    ctx.clip();
    const dy = (1 - k) * 60;
    ctx.fillStyle = COLOR.ink;
    ctx.globalAlpha = Math.min(1, p * 3) * (1 - on);
    ctx.fillText(label, x + seg * i + seg / 2, ty + dy);
    ctx.fillStyle = COLOR.white;
    ctx.globalAlpha = Math.min(1, p * 3) * on;
    ctx.fillText(label, x + seg * i + seg / 2, ty + dy);
    ctx.restore();
  });
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawPrint(ctx, t) {
  const p = easeIn(span(t, T_PRINT, 0.5));
  if (p <= 0) return;
  setFont(ctx, 26, 400, 0);
  ctx.save();
  ctx.globalAlpha = 0.72 * Math.min(1, p * 2);
  ctx.fillStyle = COLOR.ink;
  ctx.fillText(PRINT, SAFE.left, SAFE.bottom - 8); // fades in place, so it never leaves the safe area
  ctx.restore();
}

// ---------------------------------------------------------------------------
export const scene4 = {
  name: 'scene4',
  start: START,
  end: END,
  images: [],

  plate() {},
  grade: 'none',

  draw(ctx, t, env) {
    const covered = easeIn(span(t, T_WIPE + 0.08, 0.5)) >= 1;
    if (!covered) {
      drawDetail(ctx, t, env); // scene 3's detail keeps pushing in under the wipe
      wipePanel(ctx, t, 0, COLOR.blue);
      wipePanel(ctx, t, 0.08, COLOR.paper);
    } else {
      ctx.fillStyle = COLOR.paper;
      ctx.fillRect(0, 0, W, H);
    }
    const Lz = layouts(ctx);
    drawHeadline(ctx, Lz.label, t, { inAt: T_LABEL, color: COLOR.ink });
    drawCard(ctx, t, 0);
    drawCard(ctx, t, 1);
    drawControl(ctx, t);
    drawHeadline(ctx, Lz.head, t, { inAt: T_HEADLINE, color: COLOR.ink });
    drawPrint(ctx, t);
  },

  blurWindows(ctx) {
    const Lz = layouts(ctx);
    return [
      [T_WIPE, T_WIPE + 0.3, 32], // the fast start of the wipe needs more samples to stay smooth
      ...headlineBlurWindows(Lz.head, { inAt: T_HEADLINE }),
    ];
  },
};
