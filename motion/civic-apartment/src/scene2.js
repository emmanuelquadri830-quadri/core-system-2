// SCENE 2, beat 5 to beat 10 (2.533 to 5.1 s): a low bird's-eye view over
// Lekki Gardens Phase 5. The camera keeps sinking slowly and turns 10 degrees.
// No headline, labels only. Each step starts on the 118 BPM grid:
//   5        the roads draw on: Lekki-Epe Expressway first, thick
//   5.25     then the access roads around the estate, thin
//   5.5      the site plot is traced in bright blue
//   6        and filled with blue at 25%
//   6.5      a blue pin drops into the middle of the plot, two ripple rings
//   7        two dashed radius circles start to grow slowly, blue and white
//   7.25, 7.5, 7.75   the landmark callouts, one at a time
//   8        the address pill slides out of the pin
//   9        the pin's head stretches into the curved frame, which grows to
//            fill the screen by 5.0 s; the cut is on beat 10 (5.1 s)
import {
  W, H, SAFE, COLOR, beatTime, beatFrameTime, cubicBezier,
  lerp, span, smoothstep, clamp01, mulberry32, arcPath, easeIn, easeOut,
} from './lib.js';
import { setFont } from './type.js';
import { FRAME_RADII } from './frame.js';
import { strokeGlow, glowHead, polyPath } from './glow.js';
import { drawStreet, streetPoint } from './scene3.js';

export const START = beatFrameTime(5); // 2.533 s, scene 1's cut
export const END = beatFrameTime(10);  // 5.100 s
const B = beatTime;

// ---------------------------------------------------------------------------
// Words on screen, exactly as supplied.
const ADDRESS = 'Abraham Adesanya, Lekki Gardens Phase 5';
// Up to three callouts: { name, at: [metres east, metres south of the site],
// side: 'left' | 'right', icon: 'place' | 'school' | 'shop' | 'hospital' }.
// Empty until the landmarks are named and placed on real coordinates: a label
// on a guessed spot would break the rule that every label sits on its real
// location. They come in on beats 7.25, 7.5 and 7.75.
const LANDMARKS = [];

// Timing, in beats.
const T_EXPRESS = B(5), EXPRESS_DUR = 0.42;
const T_ACCESS = B(5.25), ACCESS_DUR = 0.3, ACCESS_STAGGER = 0.04;
const T_TRACE = B(5.5), TRACE_DUR = 0.26;
const T_FILL = B(6), FILL_DUR = 0.3;
const T_PIN = B(6.5), FALL = 0.2;
const T_RINGS = B(7);
const T_LANDMARKS = [B(7.25), B(7.5), B(7.75)];
const T_ADDRESS = B(8);
const T_MORPH = B(9);
const T_FULL = 5.0;           // the frame covers the screen from here
const ADDRESS_OUT = B(9.75);  // the pill clears before the cut

const lineEase = cubicBezier(0.25, 0.55, 0.2, 1); // same as scene 1's line

// ---------------------------------------------------------------------------
// Stand-in geography, in metres around the centre of the site. A sketch to be
// replaced by the Google Earth export; only the words above are real.
const expY = (x) => 255 - 0.233 * x + 0.00002 * x * x;
const EXPRESSWAY = arcPath(Array.from({ length: 21 }, (_, i) => -1000 + i * 100).map((x) => [x, expY(x)]), 8);
const ACCESS = [
  arcPath([[-330, expY(-330)], [-318, 120], [-300, -150], [-292, -420], [-312, -720]]), // west, up from the expressway
  arcPath([[-298, -205], [-60, -228], [180, -236], [420, -214], [660, -246]]),           // north edge of the estate
  arcPath([[410, expY(410)], [405, -20], [420, -214], [446, -520]]),                      // east, up from the expressway
];
const PLOT = [[-78, -66], [70, -58], [84, 48], [-10, 66], [-82, 44]];
const shoreY = (x) => -780 + 45 * Math.sin(x / 170 + 0.4) + 22 * Math.sin(x / 61);

// ---------------------------------------------------------------------------
// Camera: arrives fast after the cut, then keeps sinking slowly and turning.
// It never settles. The site's centre sits at (x, y) on screen.
const VIEW0 = 1500, VIEW1 = 880;          // metres across the frame
const TURN = (10 * Math.PI) / 180;        // clockwise over the scene
const AT0 = [560, 1130], AT1 = [540, 1000];

export function camera(t) {
  const u = clamp01((t - START) / (END - START));
  const e = 0.5 * (1 - Math.pow(1 - u, 3)) + 0.5 * u;
  const viewW = VIEW0 * Math.pow(VIEW1 / VIEW0, e);
  const k = smoothstep(u);
  return { scale: W / viewW, rot: TURN * (0.35 * u + 0.65 * k), x: lerp(AT0[0], AT1[0], k), y: lerp(AT0[1], AT1[1], k) };
}
export function toScreen(cam, [x, y]) {
  const c = Math.cos(cam.rot), s = Math.sin(cam.rot);
  return [cam.x + (x * c - y * s) * cam.scale, cam.y + (x * s + y * c) * cam.scale];
}

// ---------------------------------------------------------------------------
// Stand-in plate: the world is painted once into a texture (layout only, no
// animation state) and drawn through the camera every frame.
const TEX = 1.5; // texture pixels per metre
const BOUNDS = { x0: -950, x1: 900, y0: -1700, y1: 1250 };
let texCanvas = null;

function distToPath(path, x, y) {
  let best = Infinity;
  const p = path.points;
  for (let i = 1; i < p.length; i++) {
    const [ax, ay] = p[i - 1], [bx, by] = p[i];
    const dx = bx - ax, dy = by - ay;
    const k = clamp01(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1));
    best = Math.min(best, Math.hypot(x - ax - k * dx, y - ay - k * dy));
  }
  return best;
}

// Smooth value noise for where the land is built up and where it is bush.
function valueNoise(seed) {
  const cell = (i, j) => mulberry32((i * 73856093) ^ (j * 19349663) ^ seed)();
  return (x, y) => {
    const i = Math.floor(x), j = Math.floor(y);
    const fx = smoothstep(x - i), fy = smoothstep(y - j);
    const a = lerp(cell(i, j), cell(i + 1, j), fx), b = lerp(cell(i, j + 1), cell(i + 1, j + 1), fx);
    return lerp(a, b, fy);
  };
}

function inPlot(x, y, grow = 0) {
  // the plot is convex; test against each edge pushed out by `grow`
  for (let i = 0; i < PLOT.length; i++) {
    const [ax, ay] = PLOT[i], [bx, by] = PLOT[(i + 1) % PLOT.length];
    const nx = by - ay, ny = -(bx - ax);
    const len = Math.hypot(nx, ny);
    if (((x - ax) * nx + (y - ay) * ny) / len > grow) return false;
  }
  return true;
}

function paintWorld(g) {
  const rnd = mulberry32(5205);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const bush = valueNoise(77);
  const { x0, x1, y0, y1 } = BOUNDS;

  // Ground and large soft variation, in scene 1's palette.
  g.fillStyle = '#55603e';
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let i = 0; i < 700; i++) {
    const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), r = 25 + rnd() * 140;
    g.fillStyle = pick(['#4d5a38', '#5f6745', '#6b6648', '#55623d', '#4a5636']);
    g.globalAlpha = 0.55;
    g.beginPath();
    g.ellipse(x, y, r, r * (0.5 + rnd() * 0.7), rnd() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;

  const nearMajor = (x, y, pad) => Math.abs(y - expY(x)) * 0.974 < 24 + pad || ACCESS.some((r) => distToPath(r, x, y) < 8 + pad);
  const isBush = (x, y) => bush(x / 230, y / 230) > 0.64;
  const nearSite = (x, y) => (x / 165) ** 2 + (y / 140) ** 2 < 1;
  const land = (x, y) => y > shoreY(x) + 30;

  // Housing: street grids, square to the compass north of the expressway and
  // square to the expressway south of it, houses on both sides of each street.
  const streets = [];
  const houses = [];
  for (const zone of [{ ang: 0.035, north: true }, { ang: -0.229, north: false }]) {
    const c = Math.cos(zone.ang), s = Math.sin(zone.ang);
    const toW = (u, v) => [u * c - v * s, u * s + v * c];
    const inZone = (x, y) => (zone.north ? y < expY(x) - 30 : y > expY(x) + 30);
    for (let v = -1800; v <= 1800; v += 78) {
      for (let u = -1400; u <= 1400; u += 20) {
        const [mx, my] = toW(u + 10, v);
        if (!inZone(mx, my) || !land(mx, my) || nearMajor(mx, my, 2) || nearSite(mx, my) || isBush(mx, my)) continue;
        if (mx < x0 || mx > x1 || my < y0 || my > y1) continue;
        streets.push([toW(u, v), toW(u + 20.5, v)]);
        for (const side of [-1, 1]) {
          if (rnd() < 0.14) continue; // empty lots
          const w = 10 + rnd() * 6, d = 9 + rnd() * 5;
          const [hx, hy] = toW(u + 10 + (rnd() - 0.5) * 3, v + side * (6 + d / 2 + rnd() * 2));
          if (!inZone(hx, hy) || nearMajor(hx, hy, 4) || nearSite(hx, hy)) continue;
          houses.push({ x: hx, y: hy, w, d, ang: zone.ang, tone: pick(['#8b867a', '#7a766c', '#9a9486', '#6f6c64', '#8d6a55', '#7d5d4c', '#68767a']) });
        }
      }
    }
  }
  g.strokeStyle = '#8f8b7f';
  g.lineWidth = 6.5;
  g.lineCap = 'butt';
  g.beginPath();
  for (const [[ax, ay], [bx, by]] of streets) { g.moveTo(ax, ay); g.lineTo(bx, by); }
  g.stroke();
  for (const h of houses) {
    g.save();
    g.translate(h.x, h.y);
    g.rotate(h.ang);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(-h.w / 2 + 1.6, -h.d / 2 + 1.6, h.w, h.d); // shadow
    g.fillStyle = h.tone;
    g.fillRect(-h.w / 2, -h.d / 2, h.w, h.d);
    g.fillStyle = 'rgba(0,0,0,0.13)';
    g.fillRect(-h.w / 2, 0, h.w, h.d / 2);                // the far pitch of the roof
    g.restore();
  }

  // The site: freshly cleared earth inside a fence, a few tents on it.
  g.fillStyle = '#8c7b58';
  g.beginPath();
  g.ellipse(4, 0, 128, 104, 0.1, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#a48d63';
  g.fill(polyPath(PLOT, true));
  g.strokeStyle = '#8b7652';
  g.lineWidth = 1.6;
  for (let i = 0; i < 9; i++) {
    const y = -50 + i * 12 + rnd() * 5;
    g.beginPath();
    g.moveTo(-70, y);
    g.bezierCurveTo(-20, y + rnd() * 14 - 7, 20, y + rnd() * 14 - 7, 74, y + rnd() * 8 - 4);
    g.stroke();
  }
  g.strokeStyle = '#ddd7ca';
  g.lineWidth = 1.3;
  g.stroke(polyPath(PLOT, true));
  g.fillStyle = '#efece6';
  for (const [x, y] of [[-58, -48], [-46, -50], [-34, -46]]) g.fillRect(x, y, 8, 5);

  // Trees: thick in the bush, a ring of scrub around the clearing, a few in
  // the gardens of the estates.
  for (let i = 0; i < 16000; i++) {
    const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
    if (!land(x, y) || nearMajor(x, y, 0) || inPlot(x, y, 6)) continue;
    const ring = nearSite(x, y) && !inPlot(x, y, 18);
    const chance = isBush(x, y) ? 0.85 : ring ? 0.7 : 0.07;
    if (rnd() > chance) continue;
    const r = 2.6 + rnd() * 5.2;
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.arc(x + 1.4, y + 1.4, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = pick(['#3c4a2c', '#43512f', '#4b5a34', '#36432a', '#506038']);
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }

  // Roads, pale under the glow that draws on later.
  const strokePath = (path, width, color) => {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.stroke(polyPath(path.points));
  };
  strokePath(EXPRESSWAY, 46, '#9d998d');
  strokePath(EXPRESSWAY, 6, '#56623f');
  for (const r of ACCESS) strokePath(r, 14, '#9d998d');

  // Lagoon to the north, as at the top of scene 1.
  g.fillStyle = '#2f4f5a';
  g.beginPath();
  g.moveTo(x0, y0);
  for (let x = x0; x <= x1; x += 10) g.lineTo(x, shoreY(x));
  g.lineTo(x1, y0);
  g.closePath();
  g.fill();
  g.strokeStyle = '#6f7562';
  g.lineWidth = 5;
  g.beginPath();
  for (let x = x0; x <= x1; x += 10) (x === x0 ? g.moveTo : g.lineTo).call(g, x, shoreY(x));
  g.stroke();
}

function standInTexture() {
  if (!texCanvas) {
    texCanvas = document.createElement('canvas');
    texCanvas.width = Math.round((BOUNDS.x1 - BOUNDS.x0) * TEX);
    texCanvas.height = Math.round((BOUNDS.y1 - BOUNDS.y0) * TEX);
    const g = texCanvas.getContext('2d');
    g.scale(TEX, TEX);
    g.translate(-BOUNDS.x0, -BOUNDS.y0);
    paintWorld(g);
  }
  return texCanvas;
}

function drawStandInPlate(pctx, t) {
  const cam = camera(t);
  pctx.save();
  pctx.fillStyle = '#2f4f5a';
  pctx.fillRect(0, 0, W, H);
  pctx.translate(cam.x, cam.y);
  pctx.rotate(cam.rot);
  pctx.scale(cam.scale / TEX, cam.scale / TEX);
  pctx.imageSmoothingQuality = 'high';
  pctx.drawImage(standInTexture(), BOUNDS.x0 * TEX, BOUNDS.y0 * TEX);
  pctx.restore();
}

// ---------------------------------------------------------------------------
// Overlays.

function vignette(ctx) {
  const g = ctx.createRadialGradient(W / 2, 1000, 380, W / 2, 1000, 1250);
  g.addColorStop(0, 'rgba(15,15,15,0)');
  g.addColorStop(1, 'rgba(15,15,15,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// 1. Roads: the expressway west to east, then the access roads out of it.
function drawRoads(ctx, t, cam) {
  const k = span(t, T_EXPRESS, EXPRESS_DUR);
  if (k > 0) {
    const pts = EXPRESSWAY.upTo(lineEase(k)).map((p) => toScreen(cam, p));
    if (pts.length > 1) {
      strokeGlow(ctx, polyPath(pts), 1.15);
      glowHead(ctx, pts[pts.length - 1], 1 - span(t, T_EXPRESS + EXPRESS_DUR - 0.05, 0.2), 1.1);
    }
  }
  ACCESS.forEach((road, i) => {
    const a = T_ACCESS + i * ACCESS_STAGGER;
    const q = span(t, a, ACCESS_DUR);
    if (q <= 0) return;
    const pts = road.upTo(lineEase(q)).map((p) => toScreen(cam, p));
    if (pts.length < 2) return;
    strokeGlow(ctx, polyPath(pts), 0.42);
    glowHead(ctx, pts[pts.length - 1], 1 - span(t, a + ACCESS_DUR - 0.05, 0.2), 0.55);
  });
}

// Points along a closed polygon up to fraction k of its perimeter.
function perimeterUpTo(pts, k) {
  const ring = [...pts, pts[0]];
  const lens = ring.slice(1).map((p, i) => Math.hypot(p[0] - ring[i][0], p[1] - ring[i][1]));
  let left = clamp01(k) * lens.reduce((a, b) => a + b, 0);
  const out = [ring[0]];
  for (let i = 0; i < lens.length; i++) {
    if (left >= lens[i]) { out.push(ring[i + 1]); left -= lens[i]; continue; }
    const r = left / lens[i];
    out.push([lerp(ring[i][0], ring[i + 1][0], r), lerp(ring[i][1], ring[i + 1][1], r)]);
    break;
  }
  return out;
}

// 2. The plot: traced in bright blue, then filled at 25%.
function drawPlot(ctx, t, cam) {
  const k = span(t, T_TRACE, TRACE_DUR);
  if (k <= 0) return;
  const pts = PLOT.map((p) => toScreen(cam, p));
  const f = easeIn(span(t, T_FILL, FILL_DUR));
  if (f > 0) {
    ctx.save();
    ctx.globalAlpha = 0.25 * f;
    ctx.fillStyle = COLOR.blue;
    ctx.fill(polyPath(pts, true));
    ctx.restore();
  }
  const done = k >= 1;
  const trace = done ? [...pts, pts[0]] : perimeterUpTo(pts, lineEase(k));
  const path = polyPath(trace, done);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = COLOR.blue;
  ctx.shadowBlur = 22;
  ctx.strokeStyle = COLOR.blue;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 11;
  ctx.stroke(path);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 8;
  ctx.strokeStyle = '#5B9CFF';
  ctx.lineWidth = 4;
  ctx.stroke(path);
  ctx.restore();
  if (!done) glowHead(ctx, trace[trace.length - 1], 1, 0.6);
}

// The pin: a teardrop standing on its tip. `tail` is how far the tip sits
// below the head's centre, in head radii; at 1 the pin is a plain circle.
function pinPath(cx, cy, r, tail) {
  const p = new Path2D();
  const d = Math.max(r, tail * r);
  const a = Math.acos(Math.min(1, r / d));
  p.moveTo(cx, cy + d);
  p.arc(cx, cy, r, Math.PI / 2 - a, Math.PI / 2 + a, true);
  p.closePath();
  return p;
}
const PIN_R = 34;   // head radius, px
const PIN_TAIL = 1.8;

function pinState(t, cam) {
  // falls toward the ground (and the camera) and lands on the beat
  const q = span(t, T_PIN - FALL, FALL);
  const lift = (1 - q * q) * 200;
  const near = 1 + 0.45 * (1 - q * q);
  const d = t - T_PIN;
  const sq = d > 0 ? 0.2 * Math.exp(-d * 12) * Math.sin(d * 34) : 0;
  return { tipX: cam.x, tipY: cam.y - lift, s: near, sx: 1 + 0.6 * sq, sy: 1 - sq, alpha: clamp01(q * 3), landed: q >= 1 };
}

function drawPin(ctx, t, cam) {
  if (t < T_PIN - FALL || t >= T_MORPH) return;
  const p = pinState(t, cam);
  ctx.save();
  // contact shadow, growing as the pin comes down
  const g = clamp01(span(t, T_PIN - FALL, FALL));
  ctx.globalAlpha = 0.45 * g * g;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(cam.x, cam.y, 20 * g, 7 * g, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = p.alpha;
  ctx.translate(p.tipX, p.tipY);
  ctx.scale(p.s * p.sx, p.s * p.sy);
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = COLOR.blue;
  ctx.fill(pinPath(0, -PIN_TAIL * PIN_R, PIN_R, PIN_TAIL));
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = COLOR.white;
  ctx.beginPath();
  ctx.arc(0, -PIN_TAIL * PIN_R, PIN_R * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 3. Two ripple rings from the landing.
function drawRipples(ctx, t, cam) {
  [T_PIN, T_PIN + 0.14].forEach((t0, i) => {
    const k = span(t, t0, 0.7);
    if (k <= 0 || k >= 1) return;
    ctx.save();
    ctx.globalAlpha = 0.9 * Math.pow(1 - k, 1.6);
    ctx.strokeStyle = i ? '#5B9CFF' : COLOR.white;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cam.x, cam.y, 18 + 130 * easeIn(k), (18 + 130 * easeIn(k)) * 0.92, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

// 4. Two dashed radius circles, slowly growing for the rest of the scene.
const RINGS = [
  { r: 230, delay: 0, color: COLOR.blue, width: 3, dash: [18, 14], glow: true },
  { r: 345, delay: 0.12, color: COLOR.white, width: 2, dash: [6, 12], glow: false },
];
function drawRings(ctx, t, cam) {
  for (const ring of RINGS) {
    const t0 = T_RINGS + ring.delay;
    const p = span(t, t0, END - t0);
    if (p <= 0) continue;
    const rad = ring.r * (1 - (1 - p) * (1 - p)) * cam.scale;
    ctx.save();
    ctx.setLineDash(ring.dash);
    ctx.lineDashOffset = -(t - t0) * 36;
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = ring.width;
    ctx.globalAlpha = ring.glow ? 1 : 0.85;
    if (ring.glow) { ctx.shadowColor = COLOR.blue; ctx.shadowBlur = 10; }
    ctx.beginPath();
    ctx.arc(cam.x, cam.y, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// Small icons for the callouts, drawn white on a blue disc of radius r.
function drawIcon(ctx, kind, x, y, r) {
  ctx.save();
  ctx.fillStyle = COLOR.blue;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOR.white;
  ctx.strokeStyle = COLOR.white;
  ctx.lineWidth = r * 0.14;
  const s = r * 0.5;
  if (kind === 'school') {
    ctx.beginPath();
    ctx.moveTo(x - s * 1.1, y - s * 0.15); ctx.lineTo(x, y - s * 0.7); ctx.lineTo(x + s * 1.1, y - s * 0.15); ctx.lineTo(x, y + s * 0.4);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(x - s * 0.55, y + s * 0.1, s * 1.1, s * 0.55);
  } else if (kind === 'shop') {
    ctx.strokeRect(x - s * 0.7, y - s * 0.3, s * 1.4, s * 1.0);
    ctx.beginPath(); ctx.arc(x, y - s * 0.3, s * 0.4, Math.PI, 0); ctx.stroke();
  } else if (kind === 'hospital') {
    ctx.fillRect(x - s * 0.2, y - s * 0.75, s * 0.4, s * 1.5);
    ctx.fillRect(x - s * 0.75, y - s * 0.2, s * 1.5, s * 0.4);
  } else {
    ctx.fill(pinPath(x, y - s * 0.35, s * 0.62, 1.7));
    ctx.fillStyle = COLOR.blue;
    ctx.beginPath(); ctx.arc(x, y - s * 0.35, s * 0.24, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// Rounded-end label. Returns nothing; draws the pill from (x, y, w, h).
function pill(ctx, x, y, w, h, shadow = true) {
  ctx.save();
  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
  }
  ctx.fillStyle = COLOR.white;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.restore();
}

// 5. Landmark callouts: the spot, a thin leader up from it, then the pill
// opening sideways from the leader.
const CALL = { h: 58, text: 30, icon: 19, lead: 130 };
function drawLandmarks(ctx, t, cam) {
  LANDMARKS.forEach((lm, i) => {
    const t0 = T_LANDMARKS[i];
    if (t < t0) return;
    const [sx, sy] = toScreen(cam, lm.at);
    const kDot = easeIn(span(t, t0, 0.25));
    const kLead = easeIn(span(t, t0, 0.3));
    const kPill = easeIn(span(t, t0 + 0.07, 0.38));
    // leader
    const top = sy - CALL.lead;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx, lerp(sy, top, kLead));
    ctx.stroke();
    // spot
    ctx.fillStyle = COLOR.white;
    ctx.beginPath(); ctx.arc(sx, sy, 6.5 * kDot, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COLOR.blue;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(sx, sy, 11 * kDot, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    if (kPill <= 0) return;
    // pill, opening away from the leader
    setFont(ctx, CALL.text, 500);
    const tw = ctx.measureText(lm.name).width;
    const full = CALL.h / 2 + CALL.icon + 14 + tw + 26;
    const w = lerp(CALL.h, full, kPill);
    const right = lm.side === 'right';
    const y = top - CALL.h + (1 - kPill) * 10;
    const x = right ? sx - CALL.h / 2 : sx + CALL.h / 2 - w;
    pill(ctx, x, y, w, CALL.h);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, CALL.h, CALL.h / 2);
    ctx.clip();
    drawIcon(ctx, lm.icon, sx, y + CALL.h / 2, CALL.icon);
    ctx.fillStyle = COLOR.ink;
    const cap = ctx.measureText('H').actualBoundingBoxAscent;
    const tx = right ? sx + CALL.icon + 14 : sx - CALL.icon - 14 - tw;
    ctx.fillText(lm.name, tx, y + CALL.h / 2 + cap / 2);
    ctx.restore();
  });
}

// 6. The address pill slides down out of the pin and opens to full width.
const ADDR = { h: 72, text: 34, pad: 34, gap: 26 };
function drawAddress(ctx, t, cam) {
  if (t < T_ADDRESS || t >= END) return;
  const p = pinState(t, cam);
  const headY = p.tipY - PIN_TAIL * PIN_R;
  setFont(ctx, ADDR.text, 500);
  const tw = ctx.measureText(ADDRESS).width;
  const full = tw + 2 * ADDR.pad;
  const k = easeIn(span(t, T_ADDRESS, 0.5));
  const kw = easeIn(span(t, T_ADDRESS + 0.07, 0.48));
  const out = easeOut(span(t, ADDRESS_OUT, 0.14));
  const start = PIN_R * 1.3;
  const h = lerp(start, ADDR.h, k) * (1 - 0.5 * out);
  const w = lerp(start, full, kw) * (1 - out);
  if (w < 2) return;
  const cy = lerp(headY, p.tipY + ADDR.gap + ADDR.h / 2, k) + out * 24;
  const x = p.tipX - w / 2, y = cy - h / 2;
  pill(ctx, x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.clip();
  ctx.fillStyle = COLOR.ink;
  const cap = ctx.measureText('H').actualBoundingBoxAscent;
  ctx.fillText(ADDRESS, p.tipX - tw / 2, cy + cap / 2);
  ctx.restore();
}

// At beat 9 the head stretches into the curved frame and the frame grows to
// fill the screen, opening onto the street-level render scene 3 continues.
const FRAME0 = [150, 190];  // the frame's size once it has its shape
const FRAME1 = 2200;        // width when it has passed every edge
function morphState(t, cam) {
  const tail = easeIn(span(t, T_MORPH, 0.1));
  const shape = smoothstep(span(t, T_MORPH + 0.1, 0.2));
  const growP = span(t, T_MORPH + 0.1, T_FULL - (T_MORPH + 0.1)); // starts as the shape does, so nothing jumps
  const grow = Math.pow(FRAME1 / FRAME0[0], Math.pow(growP, 1.4));
  const r = lerp(PIN_R, 40, tail);
  const head = [cam.x, cam.y - PIN_TAIL * PIN_R];
  const m = smoothstep(growP);
  return {
    tail, shape, growP, r,
    w: lerp(2 * r, FRAME0[0], shape) * grow,
    h: lerp(2 * r, FRAME0[1], shape) * grow,
    cx: lerp(head[0], W / 2, m),
    cy: lerp(head[1], H / 2, m),
    head,
  };
}

function framePathAt(w, h, x, y, shape) {
  const mn = Math.min(w, h);
  const rad = (f) => lerp(0.5, f, shape) * mn;
  const p = new Path2D();
  p.roundRect(x, y, w, h, [rad(FRAME_RADII.tl), rad(FRAME_RADII.tr), rad(FRAME_RADII.br), rad(FRAME_RADII.bl)]);
  return p;
}

function drawMorph(ctx, t, cam) {
  if (t < T_MORPH) return;
  const s = morphState(t, cam);
  // First the tail pulls up into the head, then the head takes the frame's
  // shape and grows.
  const shapePath = t < T_MORPH + 0.1
    ? pinPath(s.head[0], s.head[1], s.r, lerp(PIN_TAIL, 1, s.tail))
    : framePathAt(s.w, s.h, s.cx - s.w / 2, s.cy - s.h / 2, s.shape);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = COLOR.blue;
  ctx.fill(shapePath);
  ctx.restore();

  // Inside: the street-level render that scene 3 continues, with the blue
  // clearing off it. While the frame is small the whole building sits inside
  // it, centred where the pin was; by the time the frame covers the screen
  // the picture is exactly scene 3's first frame.
  const reveal = easeIn(span(t, T_MORPH + 0.12, 0.24));
  if (reveal > 0) {
    ctx.save();
    ctx.clip(shapePath);
    const k = Math.min(1, s.w / 1000);
    const pull = 1 - smoothstep(clamp01((s.w - 300) / 700));
    const [bx, by] = streetPoint([560, 600], k); // middle of the building
    drawStreet(ctx, t, { k, ox: (s.cx - bx) * pull, oy: (s.cy - by) * pull });
    ctx.globalAlpha = 1 - reveal;
    ctx.fillStyle = COLOR.blue;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  // The white dot of the pin shrinks away while the tail pulls in.
  const dot = PIN_R * 0.38 * (1 - easeIn(span(t, T_MORPH, 0.12)));
  if (dot > 0.3) {
    ctx.fillStyle = COLOR.white;
    ctx.beginPath();
    ctx.arc(s.head[0], s.head[1], dot, 0, Math.PI * 2);
    ctx.fill();
  }
  // The frame's white edge, as in scene 1.
  if (s.shape > 0) {
    ctx.save();
    ctx.globalAlpha = s.shape;
    ctx.strokeStyle = COLOR.white;
    ctx.lineWidth = 4;
    ctx.shadowColor = COLOR.blue;
    ctx.shadowBlur = 24;
    ctx.stroke(shapePath);
    ctx.restore();
  }
}

function drawCredit(ctx) {
  setFont(ctx, 24, 400);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.fillText('Google Earth', SAFE.left, SAFE.bottom - 6);
}

function drawStandInMarker(ctx) {
  setFont(ctx, 20, 400);
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  // bottom line of the safe area, opposite the credit, so no text sits outside it
  ctx.fillText('STAND-IN PLATE: replace with Google Earth export', SAFE.right, SAFE.bottom - 6);
  ctx.textAlign = 'left';
}

// ---------------------------------------------------------------------------
export const scene2 = {
  name: 'scene2',
  start: START,
  end: END,

  async load() {
    standInTexture();
  },

  plate(pctx, t, env) {
    const footage = env.plateFrame?.('scene2', t);
    if (footage) {
      const s = Math.max(W / footage.width, H / footage.height);
      const dw = footage.width * s, dh = footage.height * s;
      pctx.drawImage(footage, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      drawStandInPlate(pctx, t);
    }
  },
  grade: 'brightness(0.6) saturate(0.7)', // same grade as scene 1

  draw(ctx, t, env) {
    const cam = camera(t);
    vignette(ctx);
    drawRoads(ctx, t, cam);
    drawPlot(ctx, t, cam);
    drawRings(ctx, t, cam);
    drawRipples(ctx, t, cam);
    drawLandmarks(ctx, t, cam);
    drawCredit(ctx);
    if (!env.hasPlate?.('scene2')) drawStandInMarker(ctx);
    drawMorph(ctx, t, cam);
    // the pill hangs under the pin and stays on top of the opening frame
    drawAddress(ctx, t, cam);
    drawPin(ctx, t, cam);
  },

  blurWindows() {
    return [
      [T_EXPRESS, T_EXPRESS + EXPRESS_DUR],
      [T_PIN - FALL, T_PIN + 0.08],
      [T_ADDRESS, T_ADDRESS + 0.3],
      // no blur on the frame opening: blurred, it reads as a zoom-blur transition
    ];
  },

  debug: { camera, toScreen, LANDMARKS, PLOT, T_PIN, T_ADDRESS, T_MORPH, T_FULL },
};
