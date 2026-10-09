import { COLOR, easeIn, easeOut, span } from './lib.js';

export const FONT = 'Red Hat Display';
const STAGGER_IN = 0.06;   // motion rules: 60 ms between words
const DUR_IN = 0.5;        // inside the 400 to 600 ms entrance window
const STAGGER_OUT = 0.02;  // exits are faster than entrances
const DUR_OUT = 0.26;
const TRAVEL = 1.35;       // how far a word sits below its mask, in ems

// Headlines track at -2%; supporting text passes tracking 0.
export function setFont(ctx, size, weight, tracking = -0.02) {
  ctx.font = `${weight} ${size}px "${FONT}"`;
  ctx.letterSpacing = `${(tracking * size).toFixed(2)}px`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

// lines: [[{ text, blue }], ...]. Headlines are Medium with line height 1.0;
// labels pass weight 400, tracking 0 and a looser line height.
export function layoutHeadline(ctx, lines, { x, y, size, weight = 500, lineHeight = 1, tracking = -0.02 }) {
  setFont(ctx, size, weight, tracking);
  const lh = size * lineHeight;
  const m = ctx.measureText('Hg');
  const asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
  const baselineOffset = (lh - (asc + desc)) / 2 + asc;
  const space = ctx.measureText(' ').width;
  const blueCount = lines.flat().filter((w) => w.blue).length;
  if (blueCount > 1) throw new Error('Brand rule: only one blue word per headline');
  const words = [];
  let i = 0;
  lines.forEach((line, row) => {
    let cx = x;
    const top = y + row * lh;
    for (const w of line) {
      const width = ctx.measureText(w.text).width;
      words.push({ ...w, x: cx, top, baseline: top + baselineOffset, width, index: i++ });
      cx += width + space;
    }
  });
  const right = Math.max(...words.map((w) => w.x + w.width));
  return { words, size, weight, tracking, lh, right, bottom: y + lines.length * lh };
}

// Draw the headline at time t. inAt starts the first word; outAt starts the exit.
export function drawHeadline(ctx, layout, t, { inAt, outAt = Infinity, color = COLOR.white }) {
  const { size, weight, tracking, lh } = layout;
  setFont(ctx, size, weight, tracking);
  for (const w of layout.words) {
    const pin = easeIn(span(t, inAt + w.index * STAGGER_IN, DUR_IN));
    const pout = easeOut(span(t, outAt + w.index * STAGGER_OUT, DUR_OUT));
    if (pin <= 0 || pout >= 1) continue;
    const dy = (1 - pin) * TRAVEL * lh - pout * TRAVEL * lh;
    ctx.save();
    ctx.beginPath();
    // The mask is the word's own line box, with room for descenders.
    ctx.rect(w.x - 0.12 * size, w.top - 0.12 * size, w.width + 0.24 * size, lh + 0.3 * size);
    ctx.clip();
    ctx.fillStyle = w.blue ? COLOR.blue : color;
    ctx.fillText(w.text, w.x, w.baseline + dy);
    ctx.restore();
  }
}

// Time ranges where the words move fast enough to need motion blur.
export function headlineBlurWindows(layout, { inAt, outAt = Infinity }) {
  const n = layout.words.length;
  const wins = [[inAt, inAt + (n - 1) * STAGGER_IN + 0.2]];
  if (Number.isFinite(outAt)) wins.push([outAt + 0.06, outAt + (n - 1) * STAGGER_OUT + DUR_OUT]);
  return wins;
}

export const headlineTiming = { STAGGER_IN, DUR_IN, STAGGER_OUT, DUR_OUT };
