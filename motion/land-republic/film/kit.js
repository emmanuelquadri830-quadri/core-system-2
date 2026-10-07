// Shared building blocks for scenes. Everything is created once at build time
// and then written in full on every seek.

import { el, svg, place, spring, SPRINGS, clamp, trackN } from './engine.js';

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

// ------------------------------------------------------------------ shots

// A window onto a real screenshot or photo. The camera is set in the image's
// own CSS pixel space (page coordinates for screenshots), so a cursor target
// read from the live DOM lands on the right pixel at any zoom.
//
//   const s = makeShot(parent, { src, iw, ih, dpr });
//   s.set({ x, y, w, h, camX, camY, zoom });   // every frame
//   s.toStage(pageX, pageY)                    // after set()
export function makeShot(parent, { src, iw, ih, dpr = 1, radius = 0, cls = '' }) {
  const node = el('div', `shot ${cls}`, parent);
  const img = el('img', '', node, { src, draggable: 'false' });
  img.style.width = `${iw}px`;
  img.style.height = `${ih}px`;
  node.style.borderRadius = radius ? `${radius}px` : '0';
  let cam = { x: 0, y: 0, w: 0, h: 0, camX: 0, camY: 0, zoom: 1 };
  return {
    node,
    img,
    pageW: iw / dpr,
    pageH: ih / dpr,
    set({ x, y, w, h, camX, camY, zoom = 1, show = true, clip = null, r = 0, s = 1, o = 1, blur = 0 }) {
      cam = { x, y, w, h, camX, camY, zoom };
      node.style.left = '0px';
      node.style.top = '0px';
      node.style.width = `${w.toFixed(2)}px`;
      node.style.height = `${h.toFixed(2)}px`;
      node.style.transformOrigin = '50% 50%';
      place(node, { x, y, s, r, show, clip, o, blur });
      const k = zoom / dpr;
      const tx = w / 2 - camX * zoom;
      const ty = h / 2 - camY * zoom;
      img.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${k.toFixed(5)})`;
    },
    toStage(px, py) {
      return [cam.x + cam.w / 2 + (px - cam.camX) * cam.zoom, cam.y + cam.h / 2 + (py - cam.camY) * cam.zoom];
    },
  };
}

// A rectangle cut from a screenshot, so a real page can be pulled apart and
// put back together. crop is in page coordinates.
export function makePiece(parent, { src, iw, ih, dpr = 1, crop, radius = 0, shadow = true }) {
  const node = el('div', 'shot piece', parent);
  node.style.width = `${crop.w}px`;
  node.style.height = `${crop.h}px`;
  node.style.borderRadius = radius ? `${radius}px` : '0';
  if (shadow) node.style.boxShadow = '0 18px 40px -18px rgba(0,0,0,0.55)';
  const img = el('img', '', node, { src, draggable: 'false' });
  img.style.width = `${iw / dpr}px`;
  img.style.height = `${ih / dpr}px`;
  img.style.transform = `translate3d(${-crop.x}px, ${-crop.y}px, 0)`;
  return {
    node,
    crop,
    // x, y: where the crop's top-left sits on stage; s scales about its centre.
    set({ x, y, s = 1, r = 0, show = true, clip = null }) {
      node.style.left = '0px';
      node.style.top = '0px';
      node.style.transformOrigin = '50% 50%';
      place(node, { x, y, s, r, show, clip });
    },
  };
}

// ------------------------------------------------------------------ cursor

const CURSOR_SVG = `<svg viewBox="0 0 28 28" width="44" height="44" xmlns="http://www.w3.org/2000/svg">
<path d="M6 3.5 L6 22.2 L10.4 17.9 L13.4 24.6 L16.5 23.3 L13.6 16.7 L19.8 16.7 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

// Cursor with a press on every click. path: [[t, x, y, springName?], ...] in
// stage pixels; clicks: [t, ...]. The tip of the arrow is the hotspot.
export function makeCursor(parent) {
  const node = el('div', 'cursor', parent, { html: CURSOR_SVG });
  const ring = el('div', 'click-ring', parent);
  Object.assign(ring.style, { position: 'absolute', left: '0px', top: '0px', width: '64px', height: '64px', marginLeft: '-32px', marginTop: '-32px', borderRadius: '50%', border: '3px solid var(--accent)', zIndex: 49 });
  return {
    node,
    update(t, path, clicks, { show = true, scale = 1 } = {}) {
      if (!show || !path.length || t < path[0][0]) {
        place(node, { show: false });
        place(ring, { show: false });
        return [0, 0];
      }
      const keys = path.map(([tk, x, y, sp]) => [tk, [x, y], sp || 'glide']);
      const [x, y] = trackN(t, keys);
      let press = 1;
      let last = -1;
      for (const c of clicks) {
        if (t >= c) {
          press = Math.min(press, 1 - 0.16 * impulse(t - c, [1600, 48, 1]));
          last = c;
        }
      }
      // hotspot at (6, 4) of the 44px box, scaled from 28px artwork
      node.style.transformOrigin = '9px 6px';
      place(node, { x: x - 9, y: y - 6, s: press * scale, show: true });
      const dt = t - last;
      if (last >= 0 && dt < 0.42) {
        const k = spring(dt, 'soft');
        ring.style.borderWidth = `${(3.2 * (1 - k)).toFixed(2)}px`;
        place(ring, { x, y, s: 0.35 + 1.0 * k, show: k < 0.98 });
      } else {
        place(ring, { show: false });
      }
      return [x, y];
    },
  };
}

// ------------------------------------------------------------------ map pieces

export function makePin(parent, { size = 64 } = {}) {
  const node = el('div', 'pin', parent);
  Object.assign(node.style, { position: 'absolute', left: '0px', top: '0px', width: `${size}px`, height: `${size * 1.3}px`, transformOrigin: '50% 100%' });
  node.innerHTML = `<svg viewBox="0 0 40 52" width="${size}" height="${size * 1.3}" xmlns="http://www.w3.org/2000/svg">
<path d="M20 51 C20 51 3 30.5 3 19 A17 17 0 0 1 37 19 C37 30.5 20 51 20 51 Z" fill="var(--accent)" stroke="var(--paper)" stroke-width="2"/>
<circle cx="20" cy="19" r="6.5" fill="var(--paper)"/></svg>`;
  const shadow = el('div', 'pin-shadow', parent);
  Object.assign(shadow.style, { position: 'absolute', left: '0px', top: '0px', width: `${size * 0.7}px`, height: `${size * 0.18}px`, marginLeft: `${-size * 0.35}px`, marginTop: `${-size * 0.09}px`, borderRadius: '50%', background: 'rgba(0,0,0,0.35)' });
  return {
    // (x, y) is where the needle touches the ground.
    update(t, t0, x, y, { drop = 220 } = {}) {
      if (t < t0) {
        place(node, { show: false });
        place(shadow, { show: false });
        return;
      }
      const k = spring(t - t0, 'bounce');
      const land = impulse(t - t0 - 0.09, [900, 22, 1]);
      const sy = 1 - 0.18 * Math.max(0, land);
      const sx = 1 + 0.12 * Math.max(0, land);
      place(node, { x: x - size / 2, y: y - size * 1.3 - drop * (1 - k), sx, sy, show: true });
      place(shadow, { x, y, s: 0.4 + 0.6 * clamp(k), show: true });
    },
  };
}

// Plot boundary drawn as a line, then filled. pts in stage pixels.
export function makeBoundary(parent, W, H) {
  const s = svg('svg', parent, { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
  Object.assign(s.style, { position: 'absolute', left: '0px', top: '0px', overflow: 'visible' });
  const fill = svg('polygon', s, { fill: 'var(--accent)', 'fill-opacity': '0.22' });
  const line = svg('polygon', s, { fill: 'none', stroke: 'var(--white)', 'stroke-width': '7', 'stroke-linejoin': 'round' });
  const dots = [];
  return {
    svg: s,
    // clip: optional [x, y, w, h] the drawing must stay inside.
    update(t, t0, pts, { drawSpring = 'glide', clip = null } = {}) {
      if (t < t0) {
        s.style.visibility = 'hidden';
        return;
      }
      s.style.visibility = 'inherit';
      s.style.clipPath = clip ? `inset(${clip[1]}px ${W - clip[0] - clip[2]}px ${H - clip[1] - clip[3]}px ${clip[0]}px)` : 'none';
      const str = pts.map((p) => p.join(',')).join(' ');
      line.setAttribute('points', str);
      fill.setAttribute('points', str);
      let per = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        per += Math.hypot(b[0] - a[0], b[1] - a[1]);
      }
      const p = clamp(spring(t - t0, drawSpring), 0, 1);
      line.setAttribute('stroke-dasharray', `${per}`);
      line.setAttribute('stroke-dashoffset', `${(per * (1 - p)).toFixed(2)}`);
      const f = clamp(spring(t - t0 - 0.28, 'soft'));
      fill.setAttribute('fill-opacity', (0.32 * f).toFixed(3));
      while (dots.length < pts.length) {
        const d = svg('rect', s, { width: 14, height: 14, fill: 'var(--paper)', stroke: 'var(--accent)', 'stroke-width': 3 });
        dots.push(d);
      }
      dots.forEach((d, i) => {
        if (i >= pts.length) {
          d.setAttribute('visibility', 'hidden');
          return;
        }
        const k = clamp(spring(t - t0 - 0.05 * i, 'snap'), 0, 1.2);
        d.setAttribute('visibility', k > 0.01 ? 'inherit' : 'hidden');
        d.setAttribute('x', pts[i][0] - 7 * k);
        d.setAttribute('y', pts[i][1] - 7 * k);
        d.setAttribute('width', 14 * k);
        d.setAttribute('height', 14 * k);
      });
    },
  };
}

// ------------------------------------------------------------------ numbers

// Rolling digits. Each column slides to its new digit on the tick where it
// changes, so the roll and the tick sounds share one schedule.
export function makeCounter(parent, { target, digits, size, weight = 800, family = 'var(--display)', color = 'var(--paper)' }) {
  const node = el('div', 'counter display', parent);
  Object.assign(node.style, { position: 'absolute', left: '0px', top: '0px', display: 'flex', fontSize: `${size}px`, fontWeight: weight, fontFamily: family, color, lineHeight: '1', fontVariantNumeric: 'tabular-nums' });
  const cols = Array.from({ length: digits }, () => {
    const mask = el('div', '', node);
    Object.assign(mask.style, { position: 'relative', height: `${size}px`, overflow: 'hidden', width: '0.62em' });
    const strip = el('div', '', mask);
    Object.assign(strip.style, { position: 'absolute', left: '0px', top: '0px', width: '100%' });
    // 0..9 then 0 again, so 9 -> 0 rolls forward like an odometer.
    for (let d = 0; d <= 10; d++) {
      const c = el('div', '', strip, { text: String(d % 10) });
      Object.assign(c.style, { height: `${size}px`, textAlign: 'center' });
    }
    return { mask, strip };
  });
  const digitAt = (v, i) => Math.floor(v / Math.pow(10, digits - 1 - i)) % 10;
  const ROLL = [600, 49, 1]; // critically damped: lands without peeking past
  return {
    node,
    update(t, ticks) {
      const values = ticks.map((tk) => Math.round(target * tk.x));
      let now = 0;
      for (let k = 0; k < ticks.length; k++) if (t >= ticks[k].t) now = k;
      const shown = values[now];
      cols.forEach(({ mask, strip }, i) => {
        // Absolute forward position of this wheel: every change adds the
        // forward distance to the new digit, sprung from its tick.
        let pos = digitAt(values[0], i);
        let cur = pos;
        for (let k = 1; k <= now; k++) {
          const d = digitAt(values[k], i);
          if (d !== cur) {
            const step = (d - cur + 10) % 10;
            pos += step * Math.min(1, spring(t - ticks[k].t, ROLL));
            cur = d;
          }
        }
        const wheel = ((pos % 10) + 10) % 10;
        strip.style.transform = `translate3d(0, ${(-wheel * size).toFixed(2)}px, 0)`;
        // Columns keep their place so the final layout never moves; leading
        // zeros are not drawn until the number reaches them.
        const needed = i === digits - 1 || shown >= Math.pow(10, digits - 1 - i);
        mask.style.visibility = needed ? 'inherit' : 'hidden';
      });
    },
  };
}
