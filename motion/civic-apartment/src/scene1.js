// SCENE 1, 0.0 to about 2.5 s: top-down dive from Lagos toward Ajah.
// The expressway draws itself west to east and ends at Abraham Adesanya.
import {
  W, H, SAFE, COLOR, FPS, beatTime, beatFrameTime, cubicBezier,
  lerp, span, smoothstep, clamp01, mulberry32, arcPath, easeIn,
} from './lib.js';
import { layoutHeadline, drawHeadline, headlineBlurWindows, setFont } from './type.js';
import { framePath } from './frame.js';
import { strokeGlow, glowHead, polyPath } from './glow.js';

// The cut lands on beat 5 (2.542 s), snapped to frame 76.
export const START = 0;
export const END = beatFrameTime(5);

const HEADLINE = [
  [{ text: 'Lagos' }, { text: 'keeps' }],
  [{ text: 'moving' }, { text: 'east.', blue: true }],
];
const HEAD_SIZE = 128;
const HEAD_IN = 0.1;
const HEAD_OUT = END - 0.36; // gone by the last frame before the cut

// Line draws from beat 1 to beat 4; beat 4 is the hit.
const LINE_START = beatTime(1);
const LINE_END = beatTime(4);
const lineEase = cubicBezier(0.25, 0.55, 0.2, 1);

// ---------------------------------------------------------------------------
// World space for the stand-in plate, in kilometres. Origin near Lagos Island,
// x east, y south. These shapes are a rough sketch, not survey data, and are
// only used until the Google Earth export arrives.
const coastY = (x) => 3.9 - 0.035 * x + 0.12 * Math.sin(x * 0.9) + 0.05 * Math.sin(x * 2.3);
const lagoonSouth = (x) => -0.4 - 0.1 * x + 0.35 * Math.sin(x * 0.6);
const lagoonNorth = (x) => -15 + 2.2 * Math.sin(x * 0.17) + 0.8 * Math.sin(x * 0.6);
const LAGOON_X = [-6, 44];

const ROAD = arcPath([
  [6.8, 1.5], [9.6, 1.25], [12.3, 0.85], [15.2, 0.1], [17.9, -0.75], [20.4, -1.45],
]);
const ROAD_EAST = [[20.4, -1.45], [24, -2.2], [29, -2.9], [36, -3.4], [44, -4.1]];
const TARGET = [20.4, -1.45];

function buildWorld() {
  const rnd = mulberry32(118);
  const inLagoon = (x, y) => x > LAGOON_X[0] && x < LAGOON_X[1] && y < lagoonSouth(x) && y > lagoonNorth(x);
  const patches = [];
  for (let i = 0; i < 420; i++) {
    const x = -30 + rnd() * 90, y = -40 + rnd() * 46;
    const r = 0.4 + rnd() * 2.6;
    const tone = ['#4d5a38', '#5f6745', '#6b6648', '#55623d', '#4a5636'][Math.floor(rnd() * 5)];
    patches.push({ x, y, rx: r, ry: r * (0.5 + rnd() * 0.8), rot: rnd() * Math.PI, tone });
  }
  const blocks = [];
  for (let i = 0; i < 11000; i++) {
    const x = -18 + 62 * Math.pow(rnd(), 1.5);
    const y = -24 + rnd() * 28;
    if (y > coastY(x) - 0.25 || inLagoon(x, y)) continue;
    const s = 0.04 + rnd() * 0.12;
    const tone = ['#7a766c', '#8b867a', '#6f6c64', '#9a9486'][Math.floor(rnd() * 4)];
    blocks.push({ x, y, w: s * (0.7 + rnd()), h: s * (0.7 + rnd()), tone });
  }
  const streets = [];
  for (let i = 0; i < 700; i++) {
    const x = -16 + 58 * Math.pow(rnd(), 1.4);
    const y = -22 + rnd() * 26;
    if (y > coastY(x) - 0.3 || inLagoon(x, y)) continue;
    const a = rnd() < 0.5 ? 0.08 : Math.PI / 2 + 0.08;
    const len = 0.3 + rnd() * 1.4;
    streets.push([x, y, x + Math.cos(a) * len, y + Math.sin(a) * len]);
  }
  return { patches, blocks, streets };
}
const WORLD = buildWorld();

// ---------------------------------------------------------------------------
// Camera: a straight-down dive that is already moving on frame 0 and never
// settles. Width of view in km, eased in log space so the speed reads evenly.
const W0 = 42, W1 = 4.2;
const S0 = [860, 900], S1 = [560, 1130];

export function camera(t) {
  const u = t / END;
  const uc = clamp01(u);
  const e = 0.55 * u + 0.45 * smoothstep(uc);
  const viewW = W0 * Math.pow(W1 / W0, e);
  const scale = W / viewW;
  const k = smoothstep(uc);
  const sx = lerp(S0[0], S1[0], k), sy = lerp(S0[1], S1[1], k);
  return {
    scale,
    cx: TARGET[0] - (sx - W / 2) / scale,
    cy: TARGET[1] - (sy - H / 2) / scale,
  };
}
const toScreen = (cam, p) => [(p[0] - cam.cx) * cam.scale + W / 2, (p[1] - cam.cy) * cam.scale + H / 2];

// ---------------------------------------------------------------------------
function drawStandInPlate(pctx, t) {
  const cam = camera(t);
  pctx.save();
  pctx.fillStyle = '#2b4a5c';
  pctx.fillRect(0, 0, W, H);
  pctx.translate(W / 2, H / 2);
  pctx.scale(cam.scale, cam.scale);
  pctx.translate(-cam.cx, -cam.cy);
  const px = 1 / cam.scale;
  const vx0 = cam.cx - (W / 2) * px - 1, vx1 = cam.cx + (W / 2) * px + 1;
  const vy0 = cam.cy - (H / 2) * px - 1, vy1 = cam.cy + (H / 2) * px + 1;

  // Land: everything north of the coast.
  pctx.fillStyle = '#56603f';
  pctx.beginPath();
  pctx.moveTo(-80, -80);
  for (let x = -80; x <= 90; x += 0.25) pctx.lineTo(x, coastY(x));
  pctx.lineTo(90, -80);
  pctx.closePath();
  pctx.fill();
  pctx.save();
  pctx.clip();

  for (const p of WORLD.patches) {
    if (p.x + p.rx < vx0 || p.x - p.rx > vx1 || p.y + p.rx < vy0 || p.y - p.rx > vy1) continue;
    pctx.fillStyle = p.tone;
    pctx.beginPath();
    pctx.ellipse(p.x, p.y, p.rx, p.ry, p.rot, 0, Math.PI * 2);
    pctx.fill();
  }
  for (const b of WORLD.blocks) {
    if (b.x < vx0 || b.x > vx1 || b.y < vy0 || b.y > vy1) continue;
    pctx.fillStyle = b.tone;
    pctx.fillRect(b.x, b.y, b.w, b.h);
  }
  pctx.strokeStyle = '#a29d90';
  pctx.lineWidth = Math.max(0.02, 1.2 * px);
  pctx.beginPath();
  for (const s of WORLD.streets) { pctx.moveTo(s[0], s[1]); pctx.lineTo(s[2], s[3]); }
  pctx.stroke();
  pctx.restore();

  // Lagoon, with a channel to the sea west of Lagos Island.
  pctx.fillStyle = '#2f4f5a';
  pctx.beginPath();
  pctx.moveTo(LAGOON_X[0], lagoonNorth(LAGOON_X[0]));
  for (let x = LAGOON_X[0]; x <= LAGOON_X[1]; x += 0.25) pctx.lineTo(x, lagoonNorth(x));
  for (let x = LAGOON_X[1]; x >= LAGOON_X[0]; x -= 0.25) pctx.lineTo(x, lagoonSouth(x));
  pctx.closePath();
  pctx.fill();
  pctx.fillRect(-3.4, -1, 1.6, 6);
  pctx.fillStyle = '#5f6450';
  pctx.beginPath();
  pctx.ellipse(0.4, -0.3, 1.6, 0.9, -0.2, 0, Math.PI * 2);
  pctx.fill();

  // Beach line.
  pctx.strokeStyle = '#b9ab8a';
  pctx.lineWidth = Math.max(0.06, 2.5 * px);
  pctx.beginPath();
  for (let x = -80; x <= 90; x += 0.25) (x === -80 ? pctx.moveTo : pctx.lineTo).call(pctx, x, coastY(x));
  pctx.stroke();

  // The real road, as a pale strip under the glow.
  pctx.strokeStyle = '#b3ad9f';
  pctx.lineWidth = Math.max(0.05, 3 * px);
  pctx.lineJoin = 'round';
  pctx.beginPath();
  ROAD.points.forEach((p, i) => (i ? pctx.lineTo(p[0], p[1]) : pctx.moveTo(p[0], p[1])));
  ROAD_EAST.forEach((p) => pctx.lineTo(p[0], p[1]));
  pctx.stroke();
  pctx.restore();
}

// ---------------------------------------------------------------------------
let layout = null;
function getLayout(ctx) {
  if (!layout) layout = layoutHeadline(ctx, HEADLINE, { x: SAFE.left, y: SAFE.top, size: HEAD_SIZE });
  return layout;
}

function drawExpressway(ctx, t) {
  const k = span(t, LINE_START, LINE_END - LINE_START);
  if (k <= 0) return;
  const cam = camera(t);
  const pts = ROAD.upTo(lineEase(k)).map((p) => toScreen(cam, p));
  if (pts.length < 2) return;
  strokeGlow(ctx, polyPath(pts), 1);
  // A brighter head while the line is still travelling.
  glowHead(ctx, pts[pts.length - 1], 1 - span(t, LINE_END - 0.05, 0.25), 1);
}

// On the beat-4 hit, the curved frame opens around Abraham Adesanya. It keeps
// a slow breath after it lands so the shot never fully stops.
function drawArrivalFrame(ctx, t) {
  const p = easeIn(span(t, LINE_END, 0.5));
  if (p <= 0) return;
  const cam = camera(t);
  const [x, y] = toScreen(cam, TARGET);
  const breath = 1 + 0.025 * Math.max(0, t - LINE_END);
  const w = lerp(70, 230, p) * breath, h = lerp(88, 290, p) * breath;
  ctx.save();
  ctx.globalAlpha = Math.min(1, p * 1.6);
  ctx.strokeStyle = COLOR.white;
  ctx.lineWidth = 4;
  ctx.shadowColor = COLOR.blue;
  ctx.shadowBlur = 24;
  framePath(ctx, x - w / 2, y - h / 2, w, h);
  ctx.stroke();
  ctx.restore();
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
  ctx.fillText('STAND-IN PLATE: replace with Google Earth export', W - 40, 200);
  ctx.textAlign = 'left';
}

// ---------------------------------------------------------------------------
export const scene1 = {
  name: 'scene1',
  start: START,
  end: END,

  // Plate layer: the footage (or the stand-in), before the grade.
  plate(pctx, t, env) {
    const footage = env.plateFrame?.('scene1', t);
    if (footage) {
      const s = Math.max(W / footage.width, H / footage.height);
      const dw = footage.width * s, dh = footage.height * s;
      pctx.drawImage(footage, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      drawStandInPlate(pctx, t);
    }
  },
  // Grade from the brief: 60% brightness, 30% less saturation.
  grade: 'brightness(0.6) saturate(0.7)',

  // Graphics over the graded plate.
  draw(ctx, t, env) {
    const top = ctx.createLinearGradient(0, 0, 0, 760);
    top.addColorStop(0, 'rgba(15,15,15,0.55)');
    top.addColorStop(1, 'rgba(15,15,15,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, 760);

    drawExpressway(ctx, t);
    drawArrivalFrame(ctx, t);
    drawHeadline(ctx, getLayout(ctx), t, { inAt: HEAD_IN, outAt: HEAD_OUT });
    drawCredit(ctx);
    if (!env.hasPlate?.('scene1')) drawStandInMarker(ctx);
  },

  blurWindows(ctx) {
    return headlineBlurWindows(getLayout(ctx), { inAt: HEAD_IN, outAt: HEAD_OUT });
  },

  // Exposed for checks.
  debug: { camera, toScreen, ROAD, TARGET, LINE_START, LINE_END, lineEase, HEAD_IN, HEAD_OUT },
};

export const sceneFrames = { first: Math.round(START * FPS), last: Math.round(END * FPS) - 1 };
