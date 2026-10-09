// SCENE 4, 8.0 s to beat 22.5 (8.0 to 11.43 s): prices and the payment plan.
//   8.0           the curved frame wipes across, left to right, to warm
//                 off-white; it covers the screen on beat 16
//   16.25         "Outright from"
//   16.5          the two price cards slide up, 0.15 s apart
//   17            the small print
//   17.5          the segmented control slides in, the blue indicator on "0-3"
//   19, 19.5, 20  the indicator steps to "6", then "9", and stops on
//                 "12 months"; the headline builds alongside, and its blue
//                 "12 months." lands with the indicator
// Words and figures are the client's, as supplied. The prices are the
// outright (0-3 months) prices on the price list.
import { W, H, SAFE, COLOR, beatTime, beatFrameTime, lerp, span, easeIn } from './lib.js';
import { layoutHeadline, drawHeadline, headlineBlurWindows, setFont } from './type.js';
import { FRAME_RADII } from './frame.js';
import { drawStreet } from './scene3.js';

export const START = beatFrameTime(15.75); // 8.0 s, scene 3's cut
export const END = beatFrameTime(22.5);    // 11.433 s
const B = beatTime;

const PAPER = '#F4F2F0';
const INK = COLOR.ink;
// Red Hat Display has no naira sign; Inter, listed second, supplies it.
const font = (size, weight = 500) => `${weight} ${size}px "Red Hat Display", Inter`;

// Words, exactly as supplied.
const LABEL = [[{ text: 'Outright' }, { text: 'from' }]];
const CARDS = [{ kind: '1 Bedroom', price: '₦65M' }, { kind: '2 Bedroom', price: '₦85M' }];
const OPTIONS = ['0-3', '6', '9', '12 months'];
// "12 months." is one unit so it is the headline's single blue accent.
const HEADLINE = [[{ text: 'Spread' }, { text: 'it' }, { text: 'over' }], [{ text: '12 months.', blue: true }]];
const SMALL = [[{ text: 'Outright prices shown. Instalment prices differ.' }]];

// Timing.
const WIPE_DUR = 0.5;
const T_LABEL = B(16.25);
const T_CARDS = [B(16.5), B(16.5) + 0.15];
const T_SMALL = B(17);
const T_CONTROL = B(17.5);
const T_STEPS = [B(19), B(19.5), B(20)]; // to "6", "9", "12 months"
const T_HEAD = B(19), T_ACCENT = B(20);

// Layout, inside the safe area.
const X0 = SAFE.left, CW = SAFE.right - SAFE.left;
const LABEL_Y = 440, LABEL_SIZE = 40;
const CARD = { y: 500, h: 300, gap: 24, pad: 40, kind: 36, price: 112 };
CARD.w = (CW - CARD.gap) / 2;
const CTRL = { y: 864, h: 104, text: 38, inset: 8, pad: 30 };
const HEAD_Y = 1066, HEAD_SIZE = 124;
const SMALL_SIZE = 28;

// The curved frame's corners for a box of this size.
const frameRadii = (w, h) => {
  const m = Math.min(w, h);
  return [FRAME_RADII.tl * m, FRAME_RADII.tr * m, FRAME_RADII.br * m, FRAME_RADII.bl * m];
};

// ---------------------------------------------------------------------------
// The wipe: an off-white panel in the curved frame's shape slides in from the
// left; its leading edge ends in the frame's big sweep at the bottom.
function drawWipe(ctx, t) {
  const k = easeIn(span(t, START, WIPE_DUR));
  const right = lerp(-40, W + 640, k);
  const w = 1700, top = -80, h = H + 220;
  ctx.save();
  ctx.shadowColor = 'rgba(15,15,15,0.35)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetX = 18;
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.roundRect(right - w, top, w, h, frameRadii(w, h));
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Layout that needs the font, measured once.
let L = null;
function layout(ctx) {
  if (L) return L;
  const label = layoutHeadline(ctx, LABEL, { x: X0, y: LABEL_Y, size: LABEL_SIZE });
  const head = layoutHeadline(ctx, HEADLINE, { x: X0, y: HEAD_Y, size: HEAD_SIZE });
  const small = layoutHeadline(ctx, SMALL, { x: X0, y: SAFE.bottom - SMALL_SIZE - 6, size: SMALL_SIZE, weight: 400 });
  const part = (lo, hi) => ({ ...head, words: head.words.filter((w) => w.index >= lo && w.index <= hi).map((w, i) => ({ ...w, index: i })) });
  // Segments: each as wide as its label plus padding, the spare width of
  // the track shared out equally.
  ctx.font = font(CTRL.text);
  const tw = OPTIONS.map((o) => ctx.measureText(o).width);
  const inner = CW - 2 * CTRL.inset;
  const spare = (inner - tw.reduce((a, b) => a + b + 2 * CTRL.pad, 0)) / OPTIONS.length;
  let x = X0 + CTRL.inset;
  const segs = OPTIONS.map((text, i) => {
    const w = tw[i] + 2 * CTRL.pad + spare;
    const s = { text, x, w, tw: tw[i] };
    x += w;
    return s;
  });
  L = { label, head, lead: part(0, 2), accent: part(3, 3), small, segs };
  return L;
}

// A white card that slides up, its price rising inside it a beat behind.
function drawCard(ctx, t, i) {
  const t0 = T_CARDS[i];
  const k = easeIn(span(t, t0, 0.55));
  if (k <= 0) return;
  const x = X0 + i * (CARD.w + CARD.gap);
  const y = CARD.y + (1 - k) * 170;
  const { kind, price } = CARDS[i];
  ctx.save();
  ctx.globalAlpha = Math.min(1, span(t, t0, 0.12) * 1.2);
  ctx.shadowColor = 'rgba(15,15,15,0.10)';
  ctx.shadowBlur = 44;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = COLOR.white;
  ctx.beginPath();
  ctx.roundRect(x, y, CARD.w, CARD.h, frameRadii(CARD.w, CARD.h));
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.beginPath();
  ctx.roundRect(x, y, CARD.w, CARD.h, frameRadii(CARD.w, CARD.h));
  ctx.clip();
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = '0px';
  ctx.font = font(CARD.kind);
  ctx.fillStyle = 'rgba(15,15,15,0.62)';
  const kp = easeIn(span(t, t0 + 0.06, 0.5));
  const cap = ctx.measureText('H').actualBoundingBoxAscent;
  ctx.fillText(kind, x + CARD.pad, y + CARD.pad + cap + (1 - kp) * 30);
  // The naira sign comes from Inter at its regular weight, which matches
  // the stroke of Red Hat Display's medium figures; the figures follow it.
  const py = y + CARD.h - CARD.pad - 8 + (1 - kp) * 60;
  ctx.fillStyle = INK;
  ctx.font = `400 ${CARD.price}px Inter`;
  ctx.fillText(price[0], x + CARD.pad - 4, py);
  const sign = ctx.measureText(price[0]).width;
  ctx.font = font(CARD.price);
  ctx.letterSpacing = `${(-0.02 * CARD.price).toFixed(2)}px`;
  ctx.fillText(price.slice(1), x + CARD.pad - 4 + sign + 2, py);
  ctx.restore();
}

// The indicator's edges: each step moves the leading edge first and the
// trailing edge 50 ms later, so the pill stretches toward the next option
// and settles. Steps add on top of each other, so the run never stops dead.
function indicatorEdges(t, segs) {
  let l = segs[0].x, r = segs[0].x + segs[0].w;
  T_STEPS.forEach((ts, j) => {
    const a = segs[j], b = segs[j + 1];
    const lead = easeIn(span(t, ts, 0.34));
    const trail = easeIn(span(t, ts + 0.05, 0.34));
    r += (b.x + b.w - (a.x + a.w)) * lead;
    l += (b.x - a.x) * trail;
  });
  return [l, r];
}

function drawControl(ctx, t, segs) {
  const k = easeIn(span(t, T_CONTROL, 0.55));
  if (k <= 0) return;
  const dx = (1 - k) * -160;
  const y = CTRL.y, h = CTRL.h;
  ctx.save();
  ctx.translate(dx, 0);
  ctx.globalAlpha = Math.min(1, span(t, T_CONTROL, 0.12) * 1.2);
  // track
  ctx.save();
  ctx.shadowColor = 'rgba(15,15,15,0.08)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = COLOR.white;
  ctx.beginPath();
  ctx.roundRect(X0, y, CW, h, h / 2);
  ctx.fill();
  ctx.restore();
  // indicator, appearing on "0-3" as the control lands
  const ki = easeIn(span(t, T_CONTROL + 0.18, 0.4));
  const [l, r] = indicatorEdges(t, segs);
  const ih = (h - 2 * CTRL.inset) * lerp(0.7, 1, ki);
  const iy = y + h / 2 - ih / 2;
  const cx = (l + r) / 2, iw = (r - l) * lerp(0.7, 1, ki);
  const pill = new Path2D();
  pill.roundRect(cx - iw / 2, iy, iw, ih, ih / 2);
  // labels: ink everywhere, white where the indicator covers them
  ctx.font = font(CTRL.text);
  ctx.letterSpacing = '0px';
  ctx.textBaseline = 'alphabetic';
  const cap = ctx.measureText('H').actualBoundingBoxAscent;
  const labels = (color) => {
    ctx.fillStyle = color;
    for (const s of segs) ctx.fillText(s.text, s.x + (s.w - s.tw) / 2, y + h / 2 + cap / 2);
  };
  labels('rgba(15,15,15,0.72)');
  if (ki > 0) {
    ctx.save();
    ctx.globalAlpha *= Math.min(1, ki * 1.5);
    ctx.fillStyle = COLOR.blue;
    ctx.fill(pill);
    ctx.clip(pill);
    labels(COLOR.white);
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
export const scene4 = {
  name: 'scene4',
  start: START,
  end: END,

  // Until the panel has covered it, the street from scene 3 keeps moving
  // underneath; after that the plate is the paper itself.
  plate(pctx, t) {
    if (t < START + 0.3) drawStreet(pctx, t);
    else {
      pctx.fillStyle = PAPER;
      pctx.fillRect(0, 0, W, H);
    }
  },
  grade: 'none',

  draw(ctx, t) {
    if (t < START + WIPE_DUR) drawWipe(ctx, t);
    const lay = layout(ctx);
    // a slow drift up, so the held layout still breathes
    ctx.save();
    ctx.translate(0, -16 * span(t, B(16), END - B(16)));
    drawHeadline(ctx, lay.label, t, { inAt: T_LABEL, color: 'rgba(15,15,15,0.62)' });
    drawCard(ctx, t, 0);
    drawCard(ctx, t, 1);
    drawControl(ctx, t, lay.segs);
    drawHeadline(ctx, lay.lead, t, { inAt: T_HEAD, color: INK });
    drawHeadline(ctx, lay.accent, t, { inAt: T_ACCENT, color: INK });
    ctx.restore();
    drawHeadline(ctx, lay.small, t, { inAt: T_SMALL, color: 'rgba(15,15,15,0.58)' });
  },

  blurWindows(ctx) {
    const lay = layout(ctx);
    return [
      [START, START + 0.22, 32], // the wipe crosses the screen in a few frames
      [T_CARDS[0], T_CARDS[1] + 0.3],
      [T_CONTROL, T_CONTROL + 0.3],
      ...headlineBlurWindows(lay.lead, { inAt: T_HEAD }),
      [T_STEPS[0], T_STEPS[2] + 0.3],
    ];
  },

  debug: { layout, T_STEPS, T_ACCENT },
};
