// SCENE 3, beat 10 to 8.0 s (5.1 to 8.0 s): the street-level render of Civic
// Apartment, which the curved frame opened onto at the end of scene 2.
//   - a slow continuous push-in, about 6% over the scene, in three layers:
//     sky slowest, building in the middle, foliage in front fastest. The
//     layers come from tools/layers.py; the building's pixels are the
//     render's own, only ever scaled.
//   - lower third: "Civic Apartment", then "1 and 2 bedroom apartments"
//   - beat 14.5 (7.37 s): a 0.5 s detail cut to the curved glass balcony
import { W, H, SAFE, FPS, beatTime, beatFrameTime, clamp01 } from './lib.js';
import { layoutHeadline, drawHeadline, headlineBlurWindows } from './type.js';

export const START = beatFrameTime(10);   // 5.1 s, scene 2's cut
export const END = beatFrameTime(15.75);  // 8.0 s
const CUT_IN = beatFrameTime(14.5);       // 7.367 s
const CUT_OUT = beatFrameTime(15.5);      // 7.867 s, 0.5 s later

const TITLE = [[{ text: 'Civic' }, { text: 'Apartment' }]];
const SUB = [[{ text: '1' }, { text: 'and' }, { text: '2' }, { text: 'bedroom' }, { text: 'apartments' }]];
const TITLE_SIZE = 132, SUB_SIZE = 50;
const TITLE_IN = beatTime(10.5), SUB_IN = beatTime(11);
const TEXT_OUT = END - 0.34; // gone by the last frame

// The push runs from 5.0 s, while scene 2's frame is still opening, so the
// camera is already moving when the frame lets go.
const PUSH_FROM = 5.0;
const LAYERS = [
  { file: 'sky', grow: 0.03 },
  { file: 'mid', grow: 0.06 },
  { file: 'front', grow: 0.10 },
];
const IMG = { w: 971, h: 1214 };
const FOCUS = [548, 600];        // render pixel the push heads for
const BASE = Math.max(W / IMG.w, H / IMG.h) * 1.02;
// where that pixel sits on screen: the render's top edge 19 px above the
// frame, so it covers top to bottom with room to spare on both edges
const FOCUS_AT = [540, FOCUS[1] * BASE - 19];
// The detail: the glass balcony wrapping the corner of the right wing.
const DETAIL = { x: 540, y: 373, w: 300, h: 533 };

const images = {};

// Draws the layered render at time t. k shrinks the whole picture and
// (ox, oy) shifts it; scene 2 uses them while its frame is still small.
export function drawStreet(ctx, t, { k = 1, ox = 0, oy = 0 } = {}) {
  const u = clamp01((t - PUSH_FROM) / (END - PUSH_FROM));
  for (const layer of LAYERS) {
    const img = images[layer.file];
    if (!img) continue;
    const z = BASE * k * (1 + layer.grow * u);
    ctx.save();
    ctx.translate(FOCUS_AT[0] + ox, FOCUS_AT[1] + oy);
    ctx.scale(z, z);
    ctx.drawImage(img, -FOCUS[0], -FOCUS[1]);
    ctx.restore();
  }
}
// Screen position of a render pixel, for scene 2 to centre the building.
export function streetPoint([x, y], k = 1) {
  return [FOCUS_AT[0] + (x - FOCUS[0]) * BASE * k, FOCUS_AT[1] + (y - FOCUS[1]) * BASE * k];
}

function drawDetail(ctx, t) {
  const img = images.mid;
  const u = clamp01((t - CUT_IN) / (CUT_OUT - CUT_IN));
  const z = (W / DETAIL.w) * (1 + 0.04 * u);
  const cx = DETAIL.x + DETAIL.w / 2 + 12 * u, cy = DETAIL.y + DETAIL.h / 2;
  ctx.save();
  ctx.fillStyle = '#E9EEF3';
  ctx.fillRect(0, 0, W, H);
  ctx.translate(W / 2, H / 2);
  ctx.scale(z, z);
  ctx.drawImage(images.sky, -cx, -cy);
  ctx.drawImage(img, -cx, -cy);
  ctx.restore();
}

let titleLayout = null, subLayout = null;
function layouts(ctx) {
  if (!titleLayout) {
    titleLayout = layoutHeadline(ctx, TITLE, { x: SAFE.left, y: 1262, size: TITLE_SIZE });
    subLayout = layoutHeadline(ctx, SUB, { x: SAFE.left + 4, y: 1262 + TITLE_SIZE + 22, size: SUB_SIZE, weight: 400 });
  }
  return [titleLayout, subLayout];
}

export const scene3 = {
  name: 'scene3',
  start: START,
  end: END,

  async load() {
    await Promise.all(LAYERS.map(async ({ file }) => {
      const img = new Image();
      img.src = `assets/renders/layers/${file}.png`;
      await img.decode();
      images[file] = img;
    }));
  },

  plate(pctx, t) {
    // The cut follows whole frames, so motion-blur samples a few ms either
    // side of a frame never mix the detail with the wide shot.
    const f = Math.round(t * FPS);
    if (f >= Math.round(CUT_IN * FPS) && f < Math.round(CUT_OUT * FPS)) drawDetail(pctx, t);
    else drawStreet(pctx, t);
  },
  grade: 'none', // the render is shown as delivered

  draw(ctx, t) {
    // Shade under the lower third. At full height this render puts the cars
    // and the ground floor behind the type, so the shade has to reach that
    // high for white type to read; it is an overlay, the render is untouched.
    const g = ctx.createLinearGradient(0, 960, 0, H);
    g.addColorStop(0, 'rgba(15,15,15,0)');
    g.addColorStop(0.35, 'rgba(15,15,15,0.5)');
    g.addColorStop(0.7, 'rgba(15,15,15,0.72)');
    g.addColorStop(1, 'rgba(15,15,15,0.8)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 960, W, H - 960);
    const [title, sub] = layouts(ctx);
    drawHeadline(ctx, title, t, { inAt: TITLE_IN, outAt: TEXT_OUT });
    drawHeadline(ctx, sub, t, { inAt: SUB_IN, outAt: TEXT_OUT + 0.04, color: 'rgba(255,255,255,0.88)' });
  },

  blurWindows(ctx) {
    const [title, sub] = layouts(ctx);
    return [
      ...headlineBlurWindows(title, { inAt: TITLE_IN, outAt: TEXT_OUT }),
      ...headlineBlurWindows(sub, { inAt: SUB_IN, outAt: TEXT_OUT + 0.04 }),
    ];
  },

  debug: { CUT_IN, CUT_OUT, drawStreet, streetPoint },
};
