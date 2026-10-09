// SCENE 1, 0.0 to 2.533 s: top-down dive from Lagos toward Ajah.
// The expressway draws itself west to east and ends at Abraham Adesanya.
import {
  W, SAFE, COLOR, beatTime, beatFrameTime, cubicBezier, lerp, span, smoothstep, clamp01, easeIn,
} from './lib.js';
import { layoutHeadline, drawHeadline, headlineBlurWindows } from './type.js';
import { framePath } from './frame.js';
import {
  TARGET, ROAD, toScreen, drawStandInPlate, glowStroke, drawCredit, drawStandInMarker, drawTopScrim,
} from './map.js';

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
export const LINE_START = beatTime(1);
export const LINE_END = beatTime(4);
const lineEase = cubicBezier(0.25, 0.55, 0.2, 1);

// ---------------------------------------------------------------------------
// Camera: a straight-down dive that is already moving on frame 0 and never
// settles. Width of view in km, eased in log space so the speed reads evenly.
export const W0 = 42, W1 = 4.2;
const S0 = [860, 900];
export const S1 = [560, 1130];
// Rate of change of log10(view width) per second at END, for scene 2 to match.
export const END_LOG_RATE = (0.55 * Math.log10(W1 / W0)) / END;

export function camera(t) {
  const u = t / END;
  const uc = clamp01(u);
  const e = 0.55 * u + 0.45 * smoothstep(uc);
  const viewW = W0 * Math.pow(W1 / W0, e);
  const k = smoothstep(uc);
  return {
    tx: TARGET[0], ty: TARGET[1],
    sx: lerp(S0[0], S1[0], k), sy: lerp(S0[1], S1[1], k),
    scale: W / viewW, rot: 0,
  };
}

// ---------------------------------------------------------------------------
let layout = null;
function getLayout(ctx) {
  if (!layout) layout = layoutHeadline(ctx, HEADLINE, { x: SAFE.left, y: SAFE.top, size: HEAD_SIZE });
  return layout;
}

function drawExpressway(ctx, t, cam) {
  const k = span(t, LINE_START, LINE_END - LINE_START);
  if (k <= 0) return;
  const pts = ROAD.upTo(lineEase(k)).map((p) => toScreen(cam, p));
  glowStroke(ctx, pts);
  // A brighter head while the line is still travelling.
  const head = pts[pts.length - 1];
  const live = 1 - span(t, LINE_END - 0.05, 0.25);
  if (live > 0) {
    ctx.save();
    const g = ctx.createRadialGradient(head[0], head[1], 0, head[0], head[1], 34);
    g.addColorStop(0, `rgba(255,255,255,${0.95 * live})`);
    g.addColorStop(0.35, `rgba(22,103,208,${0.6 * live})`);
    g.addColorStop(1, 'rgba(22,103,208,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(head[0] - 40, head[1] - 40, 80, 80);
    ctx.restore();
  }
}

// On the beat-4 hit, the curved frame opens around Abraham Adesanya. It keeps
// a slow breath after it lands so the shot never fully stops. Scene 2 takes it
// away on its first beat. `exit` runs 0 to 1.
export function drawArrivalFrame(ctx, t, cam, exit = 0) {
  const p = easeIn(span(t, LINE_END, 0.5));
  if (p <= 0 || exit >= 1) return;
  const [x, y] = toScreen(cam, TARGET);
  const breath = 1 + 0.025 * Math.max(0, t - LINE_END);
  const shrink = 1 - 0.6 * exit;
  const w = lerp(70, 230, p) * breath * shrink, h = lerp(88, 290, p) * breath * shrink;
  ctx.save();
  ctx.globalAlpha = Math.min(1, p * 1.6) * (1 - exit);
  ctx.strokeStyle = COLOR.white;
  ctx.lineWidth = 4;
  ctx.shadowColor = COLOR.blue;
  ctx.shadowBlur = 24;
  framePath(ctx, x - w / 2, y - h / 2, w, h);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
export const scene1 = {
  name: 'scene1',
  start: START,
  end: END,

  // Plate layer: the footage (or the stand-in), before the grade.
  plate(pctx, t, env) {
    if (!env.drawFootage(pctx, 'scene1', t)) drawStandInPlate(pctx, camera(t));
  },
  // Grade from the brief: 60% brightness, 30% less saturation.
  grade: 'brightness(0.6) saturate(0.7)',

  draw(ctx, t, env) {
    const cam = camera(t);
    drawTopScrim(ctx);
    drawExpressway(ctx, t, cam);
    drawArrivalFrame(ctx, t, cam);
    drawHeadline(ctx, getLayout(ctx), t, { inAt: HEAD_IN, outAt: HEAD_OUT });
    drawCredit(ctx);
    if (!env.hasPlate('scene1')) drawStandInMarker(ctx);
  },

  blurWindows(ctx) {
    return headlineBlurWindows(getLayout(ctx), { inAt: HEAD_IN, outAt: HEAD_OUT });
  },
};
