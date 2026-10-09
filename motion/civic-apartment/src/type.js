import { COLOR, SAFE, easeIn, easeOut, span } from './lib.js';

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

// Red Hat Display has no naira sign. It is drawn as the font's own N with
// two bars across it, so the U+20A6 character never reaches a fallback font.
const NAIRA = '\u20A6';
export const measureWord = (ctx, text) => ctx.measureText(text.split(NAIRA).join('N')).width;

export function fillWord(ctx, text, x, y) {
  if (!text.includes(NAIRA)) {
    ctx.fillText(text, x, y);
    return;
  }
  let cx = x;
  for (const part of text.split(/(\u20A6)/)) {
    if (!part) continue;
    if (part !== NAIRA) {
      ctx.fillText(part, cx, y);
      cx += ctx.measureText(part).width;
      continue;
    }
    ctx.fillText('N', cx, y);
    const m = ctx.measureText('N');
    const size = parseFloat(/(\d+(\.\d+)?)px/.exec(ctx.font)[1]);
    const capH = m.actualBoundingBoxAscent;
    const left = cx - m.actualBoundingBoxLeft, right = cx + m.actualBoundingBoxRight;
    const bar = 0.065 * size, over = 0.07 * size;
    for (const k of [0.36, 0.6]) ctx.fillRect(left - over, y - capH * k - bar / 2, right - left + 2 * over, bar);
    cx += m.width;
  }
}

// lines: [[{ text, blue }], ...]. Headlines are Medium with line height 1.0;
// labels pass weight 400, tracking 0 and a looser line height. With `center`,
// each line is centred on that x instead of starting at x.
export function layoutHeadline(ctx, lines, { x = 0, y, size, weight = 500, lineHeight = 1, tracking = -0.02, center }) {
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
    const widths = line.map((w) => measureWord(ctx, w.text));
    const lineW = widths.reduce((a, b) => a + b, 0) + space * (line.length - 1);
    let cx = center === undefined ? x : center - lineW / 2;
    const top = y + row * lh;
    line.forEach((w, k) => {
      words.push({ ...w, x: cx, top, baseline: top + baselineOffset, width: widths[k], index: i++ });
      cx += widths[k] + space;
    });
  });
  const right = Math.max(...words.map((w) => w.x + w.width));
  const left = Math.min(...words.map((w) => w.x));
  return { words, size, weight, tracking, lh, left, right, bottom: y + lines.length * lh };
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
    // The mask is the word's own line box, with room for descenders below. Its
    // top is the line top: the tallest ascenders sit 0.13 em under it at line
    // height 1.0, and a word leaving upward never shows above its line.
    // Never taller than the safe area, so no rising or leaving word shows
    // outside it. Labels draw in translated coordinates, so convert the bounds.
    const m = ctx.getTransform();
    const top = Math.max(w.top, (SAFE.top - m.f) / m.d);
    const bottom = Math.min(w.top + lh + 0.18 * size, (SAFE.bottom - m.f) / m.d);
    ctx.rect(w.x - 0.12 * size, top, w.width + 0.24 * size, bottom - top);
    ctx.clip();
    ctx.fillStyle = w.blue ? COLOR.blue : color;
    fillWord(ctx, w.text, w.x, w.baseline + dy);
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
