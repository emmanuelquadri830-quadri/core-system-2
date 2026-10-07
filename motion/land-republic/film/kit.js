// Shared building blocks for scenes. Everything is created once at build time
// and then written in full on every seek.

import { el, spring, SPRINGS, clamp } from './engine.js';

const probe = document.createElement('canvas').getContext('2d');

export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function textWidth(text, { size, weight = 700, family = cssVar('--display'), tracking = -0.02 }) {
  probe.font = `${weight} ${size}px ${family}`;
  return probe.measureText(text).width + tracking * size * Math.max(0, text.length - 1);
}

// Impulse response of a damped spring, normalised to peak at 1. Used for
// recoils and shakes: a hit pushes, the spring brings it home.
export function impulse(t, name = [1400, 30, 1]) {
  if (t <= 0) return 0;
  const [k, c, m] = Array.isArray(name) ? name : SPRINGS[name];
  const w0 = Math.sqrt(k / m);
  const z = c / (2 * Math.sqrt(k * m));
  const wd = w0 * Math.sqrt(Math.max(1e-6, 1 - z * z));
  const tPeak = Math.atan(wd / (z * w0)) / wd;
  const peak = Math.exp(-z * w0 * tPeak) * Math.sin(wd * tPeak);
  return (Math.exp(-z * w0 * t) * Math.sin(wd * t)) / peak;
}

// Lays out words in explicit lines. lines: [[wordIndex, ...], ...].
// Returns per-word {x, y, w} with y as the baseline.
export function layoutLines(words, lines, { size, leading = 0.98, x0 = 0, y0 = 0, weight, family, tracking, align = 'left', boxW = 0 }) {
  const space = textWidth(' ', { size, weight, family, tracking: 0 });
  const out = [];
  lines.forEach((line, li) => {
    const widths = line.map((i) => textWidth(words[i], { size, weight, family, tracking }));
    const total = widths.reduce((a, b) => a + b, 0) + space * (line.length - 1);
    let x = align === 'left' ? x0 : align === 'right' ? x0 + boxW - total : x0 + (boxW - total) / 2;
    line.forEach((i, k) => {
      out[i] = { x, y: y0 + li * size * leading, w: widths[k], line: li };
      x += widths[k] + space;
    });
  });
  return out;
}

// A display word that stamps in on its beat: big, then home on a stiff spring.
export function makeWord(parent, text, { size, weight = 800, color = 'var(--paper)', cls = '' }) {
  const node = el('div', `word display ${cls}`, parent, { text });
  node.style.fontSize = `${size}px`;
  node.style.fontWeight = weight;
  node.style.color = color;
  return node;
}

export const visible = (t, a, b = Infinity) => t >= a && t < b;
export const after = (t, a) => Math.max(0, t - a);
export const springIn = (t, a, name) => clamp(spring(t - a, name), -0.5, 1.5);
