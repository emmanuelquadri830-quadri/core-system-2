// SCENE 3, 5.1 to 8.133 s: the street-level render, revealed by scene 2's
// curved frame. A slow push-in with layered parallax: sky slowest, building
// middle, the overhanging branch fastest. The building layer holds the render's
// own pixels, untouched (see tools/separate_layers.py).
//   beat 10    (5.1 s)   the frame has filled the screen; layers start to part
//   beat 10.5  (5.339 s) title rises
//   beat 11    (5.593 s) sub-line rises
//   beat 15    (7.633 s) hard cut to the curved glass balcony detail
//   beat 16    (8.133 s) scene 4 wipes in over the detail
import { W, H, SAFE, COLOR, beatTime as B, beatFrameTime, span, smoothstep } from './lib.js';
import { layoutHeadline, drawHeadline, headlineBlurWindows } from './type.js';
import { END as START, heroPush } from './scene2.js';

export const END = beatFrameTime(16);
export const T_DETAIL = beatFrameTime(15);

const SRC = 'assets/renders/street-view.webp';
const SKY = 'assets/renders/street-view-layers/sky.png';
const MID = 'assets/renders/street-view-layers/mid.png';
const FRONT = 'assets/renders/street-view-layers/front.png';

// Scene 2 ends on a cover-fit of a 1188 x 2112 box (10% overscan) centred on
// screen, scaled by heroPush. At START every layer uses that same scale, so the
// stacked layers reproduce the flat render exactly at the cut; after it they part.
const P0 = heroPush(START);
const layerScale = {
  sky: (t) => P0 + 0.01 * (t - START),
  mid: (t) => heroPush(t), // 0.02 per second, about 6% across the scene
  front: (t) => P0 + 0.035 * (t - START),
};

function drawLayer(ctx, img, scale) {
  const s = Math.max((W * 1.1) / img.width, (H * 1.1) / img.height) * scale;
  const w = img.width * s, h = img.height * s;
  ctx.drawImage(img, W / 2 - w / 2, H / 2 - h / 2, w, h);
}

// ---------------------------------------------------------------------------
// Detail: the curved glass balcony edge. A 9:16 crop of the same render
// (source px), filled to the screen by uniform scale, pushing in 3% over the
// half second around the top-floor glass. Scene 4 keeps drawing it under its wipe.
const CROP = { x: 408, y: 370, w: 243, h: 432 };
const ANCHOR = { x: 525, y: 565 };

export function drawDetail(ctx, t, env) {
  const img = env.image(SRC);
  if (!img) return;
  const s = W / CROP.w;
  const ax = (ANCHOR.x - CROP.x) * s, ay = (ANCHOR.y - CROP.y) * s;
  const k = 1 + 0.06 * Math.max(0, t - T_DETAIL);
  ctx.save();
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(ax, ay);
  ctx.scale(k, k);
  ctx.translate(-ax, -ay);
  ctx.drawImage(img, CROP.x, CROP.y, CROP.w, CROP.h, 0, 0, W, H);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Title block, bottom-aligned to the safe area in the lower third.
const TITLE = 'Civic Apartment';
const SUB = [[{ text: '1' }, { text: 'and' }, { text: '2' }, { text: 'bedroom' }, { text: 'apartments' }]];
const SUB_SIZE = 44;
const SUB_GAP = 24;
const T_TITLE = B(10.5);
const T_SUB = B(11);

let layouts = null;
function getLayouts(ctx) {
  if (layouts) return layouts;
  const maxW = SAFE.right - SAFE.left;
  const words = TITLE.split(' ').map((text) => ({ text }));
  // One line if it fits at 112 px or more, otherwise two lines up to 150 px.
  let lines = null, size = 0;
  for (let s = 150; s >= 112; s -= 2) {
    if (layoutHeadline(ctx, [words], { x: 0, y: 0, size: s }).right <= maxW) { lines = [words]; size = s; break; }
  }
  if (!lines) {
    lines = words.map((w) => [w]);
    for (size = 150; size > 60; size -= 2) {
      if (layoutHeadline(ctx, lines, { x: 0, y: 0, size }).right <= maxW) break;
    }
  }
  const subH = SUB_SIZE * 1.2;
  const titleY = SAFE.bottom - subH - SUB_GAP - lines.length * size;
  layouts = {
    title: layoutHeadline(ctx, lines, { x: SAFE.left, y: titleY, size }),
    sub: layoutHeadline(ctx, SUB, { x: SAFE.left, y: SAFE.bottom - subH, size: SUB_SIZE, weight: 400, lineHeight: 1.2, tracking: 0 }),
    top: titleY,
  };
  return layouts;
}

// Near-black gradient under the text only; fades in after the cut so the first
// frame of the scene matches the last frame of scene 2.
function drawScrim(ctx, t, top) {
  const a = smoothstep(span(t, START, 0.4));
  if (a <= 0) return;
  const y0 = top - 300;
  const g = ctx.createLinearGradient(0, y0, 0, H);
  g.addColorStop(0, 'rgba(15,15,15,0)');
  g.addColorStop(0.45, `rgba(15,15,15,${0.55 * a})`);
  g.addColorStop(1, `rgba(15,15,15,${0.8 * a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, W, H - y0);
}

// ---------------------------------------------------------------------------
export const scene3 = {
  name: 'scene3',
  start: START,
  end: END,
  images: [SRC, SKY, MID, FRONT],

  plate() {},
  grade: 'none',

  draw(ctx, t, env) {
    if (t >= T_DETAIL) {
      drawDetail(ctx, t, env);
      return;
    }
    ctx.save();
    ctx.imageSmoothingQuality = 'high';
    drawLayer(ctx, env.image(SKY), layerScale.sky(t));
    drawLayer(ctx, env.image(MID), layerScale.mid(t));
    drawLayer(ctx, env.image(FRONT), layerScale.front(t));
    ctx.restore();
    const L = getLayouts(ctx);
    drawScrim(ctx, t, L.top);
    drawHeadline(ctx, L.title, t, { inAt: T_TITLE });
    drawHeadline(ctx, L.sub, t, { inAt: T_SUB, color: COLOR.paper });
  },

  blurWindows(ctx) {
    const L = getLayouts(ctx);
    return [
      ...headlineBlurWindows(L.title, { inAt: T_TITLE }),
      ...headlineBlurWindows(L.sub, { inAt: T_SUB }),
    ];
  },
};
