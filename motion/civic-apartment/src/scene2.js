// SCENE 2, 2.533 to 5.1 s: low bird's-eye over Lekki Gardens Phase 5.
// Labels only. Each element lands on a beat or half-beat of the 118 BPM grid:
//   beat 5    roads draw on (expressway thicker, access roads thinner)
//   beat 5.5  site plot traced in blue, filled at 25% on beat 6
//   beat 6    pin drops, two ripple rings
//   beat 6.5  dashed radius circles start expanding; landmark 1
//   beat 7    landmark 2
//   beat 7.5  landmark 3
//   beat 8    landmarks leave; address label slides out of the pin
//   beat 9    (4.576 s) the pin head stretches into the curved frame
//   beat 10   (5.085 s) the frame has filled the screen; cut on frame 153
import {
  W, H, SAFE, COLOR, beatTime as B, beatFrameTime, cubicBezier, lerp, span, smoothstep, clamp01, easeIn, easeOut,
} from './lib.js';
import { layoutHeadline, drawHeadline } from './type.js';
import { FRAME_RADII, framePath } from './frame.js';
import {
  TARGET, ROAD, ROAD_EAST, ACCESS_ROADS, PLOT, PLOT_CENTRE, local, toScreen, kmToPx,
  drawStandInPlate, glowStroke, GLOW_MAIN, GLOW_ACCESS, drawCredit, drawStandInMarker, drawTopScrim,
} from './map.js';
import { END as START, S1, END_LOG_RATE, W1, drawArrivalFrame } from './scene1.js';

export const END = beatFrameTime(10);
const HERO = 'assets/renders/street-view.webp';

// ---------------------------------------------------------------------------
// Camera. Picks up scene 1's dive at the same speed, sinks to about 1 km of
// view width by 3.6 s, then keeps sinking slowly and turns about 10 degrees.
const T1 = 1.1;                 // seconds into the scene where the drop eases off
const LOG_W0 = Math.log10(W1), LOG_W1 = Math.log10(1.0);
const SLOW = -0.07;             // log10 width per second after T1
const S2 = [470, 1020];         // where the plot sits on screen
const ROT = (10 * Math.PI) / 180;

function logWidth(tau) {
  if (tau >= T1) return LOG_W1 + SLOW * (tau - T1);
  const s = tau / T1, s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * LOG_W0 + (s3 - 2 * s2 + s) * T1 * END_LOG_RATE
    + (-2 * s3 + 3 * s2) * LOG_W1 + (s3 - s2) * T1 * SLOW;
}

export function camera(t) {
  const tau = t - START;
  const k = smoothstep(clamp01(tau / 1.3));
  const r = clamp01(tau / (END - START));
  return {
    tx: lerp(TARGET[0], PLOT_CENTRE[0], k), ty: lerp(TARGET[1], PLOT_CENTRE[1], k),
    sx: lerp(S1[0], S2[0], k), sy: lerp(S1[1], S2[1], k),
    scale: W / Math.pow(10, logWidth(tau)),
    rot: ROT * (0.8 * smoothstep(r) + 0.2 * (tau / (END - START))),
  };
}

// ---------------------------------------------------------------------------
// Timings.
const T_ROADS = B(5);
const T_PLOT = B(5.5), T_FILL = B(6);
const T_PIN = B(6);
const T_CIRCLES = B(6.5);
// Stand-in spots, chosen to stay on screen with their pills inside the safe
// area. Replace with the real places once the landmarks are named.
const LANDMARKS = [
  { text: '[LANDMARK 1]', at: local(-0.127, 0.615), lift: 150 },
  { text: '[LANDMARK 2]', at: local(0.406, 0.066), lift: 150 },
  { text: '[LANDMARK 3]', at: local(0.055, -0.109), lift: 130 },
];

// Landmark i lands on beat 6.5 + 0.5 i; the address follows the last one, and
// the landmarks leave as it arrives. Fewer landmarks give the address more time.
const T_LANDMARKS = LANDMARKS.map((_, i) => B(6.5 + 0.5 * i));
const T_ADDRESS = B(6.5 + 0.5 * LANDMARKS.length);
const T_LANDMARKS_OUT = T_ADDRESS;
const T_ADDRESS_OUT = 4.88;
const T_MORPH = B(9);
const T_MORPH_B = T_MORPH + 0.26;
const T_FILLED = B(10);

const drawEase = cubicBezier(0.3, 0.6, 0.2, 1);

// The hero render keeps a slow push-in from the moment it appears, so the shot
// never stops. Scene 3 continues from the same function.
export const heroPush = (t) => 1 + 0.02 * Math.max(0, t - T_MORPH);

// ---------------------------------------------------------------------------
function drawRoads(ctx, t, cam) {
  // The expressway thickens on beat 5 and its east side draws on.
  const thick = easeIn(span(t, T_ROADS, 0.5));
  const main = {
    outer: lerp(GLOW_MAIN.outer, 30, thick),
    inner: lerp(GLOW_MAIN.inner, 14, thick),
    core: lerp(GLOW_MAIN.core, 6, thick),
  };
  const west = ROAD.points.map((p) => toScreen(cam, p));
  // Only the first stretch east of the target is on screen; draw that much.
  const east = ROAD_EAST.upTo(0.06 * drawEase(span(t, T_ROADS, 0.6))).map((p) => toScreen(cam, p));
  glowStroke(ctx, [...west, ...east.slice(1)], main);
  ACCESS_ROADS.forEach((road, i) => {
    const k = drawEase(span(t, T_ROADS + 0.06 * i, 0.55));
    if (k > 0) glowStroke(ctx, road.upTo(k).map((p) => toScreen(cam, p)), GLOW_ACCESS);
  });
}

function drawPlot(ctx, t, cam) {
  const k = drawEase(span(t, T_PLOT, 0.4));
  if (k <= 0) return;
  const pts = PLOT.map((p) => toScreen(cam, p));
  const fill = easeIn(span(t, T_FILL, 0.35));
  if (fill > 0) {
    ctx.save();
    ctx.globalAlpha = 0.25 * fill;
    ctx.fillStyle = COLOR.blue;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Trace the outline by perimeter length.
  const ring = [...pts, pts[0]];
  const lens = ring.slice(1).map((p, i) => Math.hypot(p[0] - ring[i][0], p[1] - ring[i][1]));
  let left = k * lens.reduce((a, b) => a + b, 0);
  ctx.save();
  ctx.strokeStyle = '#3d8bff';
  ctx.shadowColor = COLOR.blue;
  ctx.shadowBlur = 16;
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ring[0][0], ring[0][1]);
  for (let i = 0; i < lens.length && left > 0; i++) {
    const r = Math.min(1, left / lens[i]);
    ctx.lineTo(lerp(ring[i][0], ring[i + 1][0], r), lerp(ring[i][1], ring[i + 1][1], r));
    left -= lens[i];
  }
  ctx.stroke();
  ctx.restore();
}

// Two dashed radius circles around the plot, one blue, one white.
function drawRadii(ctx, t, cam) {
  const k = easeIn(span(t, T_CIRCLES, 1.0));
  if (k <= 0) return;
  const c = toScreen(cam, PLOT_CENTRE);
  const drift = 0.02 * Math.max(0, t - T_CIRCLES); // keeps growing slowly
  const rings = [
    { km: 0.2, color: COLOR.blue, width: 3.5, alpha: 1, delay: 0 },
    { km: 0.36, color: COLOR.white, width: 2.5, alpha: 0.8, delay: 0.08 },
  ];
  ctx.save();
  ctx.setLineDash([14, 12]);
  for (const r of rings) {
    const kr = easeIn(span(t, T_CIRCLES + r.delay, 1.0));
    if (kr <= 0) continue;
    ctx.globalAlpha = r.alpha * Math.min(1, kr * 3);
    ctx.lineDashOffset = -t * 18;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = r.width;
    ctx.beginPath();
    ctx.arc(c[0], c[1], kmToPx(cam, (r.km + drift) * kr), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Pin and its morph into the curved frame.
const PIN = 60;                                    // side of the head square
const PIN_RADII = { tl: 0.5, tr: 0.5, br: 0, bl: 0.5 }; // br becomes the point
const STRETCH = { w: 300, h: 390 };

function pinGeometry(t, cam) {
  const tip = toScreen(cam, PLOT_CENTRE);
  const drop = easeIn(span(t, T_PIN, 0.45));
  const tipY = tip[1] - (1 - drop) * 220;
  const head = [tip[0], tipY - (PIN * Math.SQRT2) / 2];
  const ma = easeIn(span(t, T_MORPH, 0.3));
  // Eases into the full cover rather than accelerating into it: no zoom blur.
  const mb = smoothstep(span(t, T_MORPH_B, T_FILLED - T_MORPH_B));
  const aCentre = [head[0], head[1] - 270]; // the card rises clear of the address label
  const bigW = W * 2.4, bigH = H * 2.4;
  const w = lerp(lerp(PIN, STRETCH.w, ma), bigW, mb);
  const h = lerp(lerp(PIN, STRETCH.h, ma), bigH, mb);
  const cx = lerp(lerp(head[0], aCentre[0], ma), W / 2, mb);
  const cy = lerp(lerp(head[1], aCentre[1], ma), H / 2, mb);
  const radii = Object.fromEntries(Object.keys(PIN_RADII).map((k) => [k, lerp(PIN_RADII[k], FRAME_RADII[k], ma)]));
  return { tip: [tip[0], tipY], head, drop, ma, mb, w, h, cx, cy, rot: (Math.PI / 4) * (1 - ma), radii };
}

function shapePath(ctx, g) {
  ctx.translate(g.cx, g.cy);
  ctx.rotate(g.rot);
  framePath(ctx, -g.w / 2, -g.h / 2, g.w, g.h, g.radii);
}

function drawPin(ctx, t, cam, env) {
  if (t < T_PIN) return;
  const g = pinGeometry(t, cam);
  const pre = 1 - g.ma;

  // Shadow and ripples at the tip, before the morph takes over.
  if (pre > 0) {
    ctx.save();
    ctx.globalAlpha = 0.45 * g.drop * pre;
    ctx.fillStyle = COLOR.ink;
    ctx.beginPath();
    ctx.ellipse(g.tip[0], g.tip[1] + 2, 16 * g.drop, 6 * g.drop, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    for (const [i, delay] of [[0, 0.12], [1, 0.26]]) {
      const k = span(t, T_PIN + delay, 0.75);
      if (k <= 0 || k >= 1) continue;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.9 * pre;
      ctx.strokeStyle = i ? COLOR.white : COLOR.blue;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(g.tip[0], g.tip[1], lerp(8, 90, easeIn(k)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // The head: blue pin, unfolding into the frame with the hero render inside.
  ctx.save();
  ctx.globalAlpha = Math.min(1, g.drop * 2);
  shapePath(ctx, g);
  ctx.fillStyle = COLOR.blue;
  ctx.fill();
  const img = env.image(HERO);
  const reveal = span(t, T_MORPH + 0.04, 0.2);
  if (img && reveal > 0) {
    ctx.save();
    ctx.clip();
    ctx.rotate(-g.rot);
    // The photo covers the visible part of the frame and settles as a
    // full-screen cover (10% overscan) centred on screen, where scene 3 starts.
    const settle = clamp01(g.mb * 3);
    const ox = (W / 2 - g.cx) * settle, oy = (H / 2 - g.cy) * settle;
    // Grow the cover box by the offset so the photo always covers the frame;
    // the offset is zero at the end, leaving exactly scene 3's first framing.
    const bw = Math.min(g.w, W * 1.1) + 2 * Math.abs(ox), bh = Math.min(g.h, H * 1.1) + 2 * Math.abs(oy);
    const s = Math.max(bw / img.width, bh / img.height) * heroPush(t);
    ctx.globalAlpha = reveal;
    ctx.drawImage(img, ox - img.width * s / 2, oy - img.height * s / 2, img.width * s, img.height * s);
    ctx.restore();
  }
  ctx.lineWidth = lerp(3, 4, g.ma);
  ctx.strokeStyle = COLOR.white;
  ctx.globalAlpha = Math.min(1, g.drop * 2) * (1 - g.mb);
  ctx.stroke();
  // White centre mark while it is still a pin.
  if (pre > 0) {
    ctx.globalAlpha = pre;
    ctx.fillStyle = COLOR.white;
    framePath(ctx, -8, -8, 16, 16, { tl: 0.5, tr: 0.5, br: 0.5, bl: 0.5 });
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Labels.
const LABEL_SIZE = 28;
// The facts place the site by Lekki Gardens Phase 5, not inside it.
const ADDRESS = [[{ text: 'Abraham' }, { text: 'Adesanya,' }], [{ text: 'by' }, { text: 'Lekki' }, { text: 'Gardens' }, { text: 'Phase' }, { text: '5' }]];
const ADDRESS_SIZE = 32;

const layouts = new Map();
function labelLayout(ctx, key, lines, size, lineHeight = 1.2) {
  if (!layouts.has(key)) layouts.set(key, layoutHeadline(ctx, lines, { x: 0, y: 0, size, weight: 400, lineHeight, tracking: 0 }));
  return layouts.get(key);
}

// Draw a laid-out label translated to (x, y).
function drawLabelText(ctx, layout, x, y, t, inAt) {
  ctx.save();
  ctx.translate(x, y);
  drawHeadline(ctx, layout, t, { inAt, color: COLOR.ink });
  ctx.restore();
}

function smallFrameIcon(ctx, x, y) {
  ctx.fillStyle = COLOR.blue;
  framePath(ctx, x, y, 18, 22);
  ctx.fill();
}

function drawLandmarks(ctx, t, cam) {
  const out = easeOut(span(t, T_LANDMARKS_OUT, 0.2));
  if (out >= 1) return;
  LANDMARKS.forEach((lm, i) => {
    const t0 = T_LANDMARKS[i];
    if (t < t0) return;
    const spot = toScreen(cam, lm.at);
    const line = easeIn(span(t, t0, 0.3));
    const pop = easeIn(span(t, t0 + 0.12, 0.45));
    const layout = labelLayout(ctx, lm.text, [lm.text.split(' ').map((text) => ({ text }))], LABEL_SIZE, 1);
    const pw = 22 + 18 + 12 + layout.right + 24, ph = 56;
    const top = Math.max(SAFE.top, spot[1] - lm.lift - ph);
    const left = Math.max(SAFE.left, Math.min(SAFE.right - pw, spot[0] - pw / 2));
    ctx.save();
    ctx.globalAlpha = 1 - out;
    ctx.translate(0, 20 * out);
    // Spot and leader line, drawn upward from the exact place.
    ctx.fillStyle = COLOR.white;
    ctx.strokeStyle = COLOR.blue;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(spot[0], spot[1], 6 * Math.min(1, line * 3), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const joinX = Math.max(left + ph / 2, Math.min(left + pw - ph / 2, spot[0]));
    ctx.strokeStyle = COLOR.white;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(spot[0], spot[1] - 8);
    ctx.lineTo(lerp(spot[0], joinX, line), lerp(spot[1] - 8, top + ph, line));
    ctx.stroke();
    if (pop > 0) {
      // The pill opens from its centre outward.
      const cx = left + pw / 2;
      const w = lerp(ph, pw, pop);
      ctx.fillStyle = COLOR.white;
      ctx.beginPath();
      ctx.roundRect(cx - w / 2, top, w, ph, ph / 2);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - w / 2, top, w, ph);
      ctx.clip();
      smallFrameIcon(ctx, left + 22, top + (ph - 22) / 2);
      drawLabelText(ctx, layout, left + 22 + 18 + 12, top + (ph - LABEL_SIZE) / 2, t, t0 + 0.1);
      ctx.restore();
    }
    ctx.restore();
  });
}

function drawAddress(ctx, t, cam) {
  if (t < T_ADDRESS) return;
  const out = easeOut(span(t, T_ADDRESS_OUT, 0.2));
  if (out >= 1) return;
  const g = pinGeometry(Math.min(t, T_MORPH), cam);
  const layout = labelLayout(ctx, 'address', ADDRESS, ADDRESS_SIZE);
  const padX = 26, padY = 22;
  const textX = g.head[0] + 56;
  const pw = textX - g.head[0] + layout.right + padX;
  const ph = layout.bottom + padY * 2;
  const top = g.head[1] - ph / 2;
  const open = easeIn(span(t, T_ADDRESS, 0.5));
  // The pill starts tucked under the pin head and grows to the right.
  const x0 = g.head[0] - 30;
  const w = lerp(60, pw + 30, open);
  ctx.save();
  ctx.globalAlpha = 1 - out;
  ctx.translate(0, 24 * out);
  ctx.fillStyle = COLOR.white;
  ctx.beginPath();
  ctx.roundRect(x0, top, w, ph, 30);
  ctx.fill();
  ctx.clip();
  drawLabelText(ctx, layout, textX, top + padY, t, T_ADDRESS + 0.08);
  ctx.restore();
}

// ---------------------------------------------------------------------------
export const scene2 = {
  name: 'scene2',
  start: START,
  end: END,
  images: [HERO],

  plate(pctx, t, env) {
    if (!env.drawFootage(pctx, 'scene2', t)) drawStandInPlate(pctx, camera(t));
  },
  grade: 'brightness(0.6) saturate(0.7)',

  draw(ctx, t, env) {
    const cam = camera(t);
    drawTopScrim(ctx, 1 - smoothstep(span(t, START, 0.4)));
    drawRoads(ctx, t, cam);
    drawArrivalFrame(ctx, t, cam, easeOut(span(t, START, 0.22)));
    drawRadii(ctx, t, cam);
    drawPlot(ctx, t, cam);
    drawLandmarks(ctx, t, cam);
    drawCredit(ctx);
    if (!env.hasPlate('scene2')) drawStandInMarker(ctx);
    // The address slides out from under the pin; once the frame starts to
    // fill the screen, the label stays on top until it leaves.
    if (t < T_MORPH_B) drawAddress(ctx, t, cam);
    drawPin(ctx, t, cam, env);
    if (t >= T_MORPH_B) drawAddress(ctx, t, cam);
  },

  blurWindows() {
    return [
      [T_ADDRESS, T_ADDRESS + 0.15],
      [T_LANDMARKS_OUT, T_LANDMARKS_OUT + 0.2],
      // No blur once the frame starts to fill the screen: that would be a zoom blur.
    ];
  },
};
