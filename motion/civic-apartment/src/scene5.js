// SCENE 5, 11.7 to 15.0 s: end card.
//   beat 23    (11.7 s)   cut to the dusk render inside the curved frame
//              (11.8 s)   the frame pulls back over near-black
//              (12.08 s)  and shrinks away
//   beat 24    (12.203 s) Land Republic logo (the low hit)
//              then, 0.15 s apart: name line, button, web address, Gidi line
//              (13.5 s)   everything has settled; the frame holds completely
//                         still to 15.0 s, grain included
import { W, H, COLOR, beatTime as B, beatFrameTime, span, lerp, smoothstep, easeIn, easeOut } from './lib.js';
import { layoutHeadline, drawHeadline, setFont, measureWord } from './type.js';
import { FRAME_RADII, framePath } from './frame.js';
import { END as START } from './scene4.js';

export const END = 15;
export const STILL_FROM = 13.5;

const RENDER = 'assets/renders/street-view-dusk.webp';
const LOGO = 'assets/brand/logo-white.png';
const FLOWER = 'assets/brand/flower-large.png';

const T_PULL = 11.8;
const T_SHRINK = 12.08;
const T_GONE = 12.3;
export const T_LOGO = B(24);
const T_NAME = T_LOGO + 0.15;
const T_BUTTON = T_LOGO + 0.3;
const T_URL = T_LOGO + 0.45;
const T_GIDI = T_LOGO + 0.6;

// ---------------------------------------------------------------------------
// The frame: full screen at the cut, pulls back to a card, then shrinks away.
function frameScale(t) {
  const pull = smoothstep(span(t, T_PULL, T_SHRINK - T_PULL + 0.1));
  const away = easeOut(span(t, T_SHRINK, T_GONE - T_SHRINK));
  return lerp(lerp(1.12, 0.62, pull), 0, away);
}

function drawFrame(ctx, t, env) {
  const k = frameScale(t);
  if (k <= 0.001) return;
  const fw = W * k, fh = H * k;
  const cx = W / 2, cy = H / 2 - 60 * (1 - Math.min(1, k));
  ctx.save();
  framePath(ctx, cx - fw / 2, cy - fh / 2, fw, fh, FRAME_RADII);
  ctx.save();
  ctx.clip();
  const img = env.image(RENDER);
  if (img) {
    // The render keeps a slow push-in inside the frame; it never stops while shown.
    const push = 1 + 0.03 * (t - START);
    const s = Math.max((W * 1.1) / img.width, (H * 1.1) / img.height) * push;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, cx - (img.width * s) / 2, cy - (img.height * s) / 2, img.width * s, img.height * s);
  }
  ctx.restore();
  ctx.strokeStyle = COLOR.white;
  ctx.lineWidth = 4;
  ctx.globalAlpha = Math.min(1, (1.12 - k) * 6);
  ctx.stroke();
  ctx.restore();
}

// Large, faint flower mark, bottom right and partly off the frame. It is still,
// so the last 1.5 s can hold.
function drawFlower(ctx, t, env) {
  const img = env.image(FLOWER);
  const a = smoothstep(span(t, T_PULL, 0.6));
  if (!img || a <= 0) return;
  const h = 1150, w = (img.width / img.height) * h;
  ctx.save();
  ctx.globalAlpha = 0.06 * a;
  ctx.drawImage(img, W - w * 0.62, H - h * 0.78, w, h);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Centred stack.
const LOGO_W = 520;
const NAME_SIZE = 48;
const BUTTON = { text: 'Book an inspection', size: 38, h: 100, padX: 54 };
const URL_SIZE = 38;
const GIDI_SIZE = 28;

let L = null;
function layouts(ctx, env) {
  if (L) return L;
  const logo = env.image(LOGO);
  const logoH = logo ? (logo.height / logo.width) * LOGO_W : 172;
  const gaps = [60, 56, 44, 26];
  const nameH = NAME_SIZE * 1.15 * 2;
  const stack = logoH + gaps[0] + nameH + gaps[1] + BUTTON.h + gaps[2] + URL_SIZE * 1.2 + gaps[3] + GIDI_SIZE * 1.2;
  let y = H / 2 - stack / 2 - 40;
  const words = (s) => s.split(' ').map((text) => ({ text }));
  const out = { logo: { y, h: logoH } };
  y += logoH + gaps[0];
  out.name = layoutHeadline(ctx, [words('Civic Apartment,'), words('by Lekki Gardens Phase 5')],
    { center: W / 2, y, size: NAME_SIZE, lineHeight: 1.15 });
  y += nameH + gaps[1];
  setFont(ctx, BUTTON.size, 500, 0);
  const bw = measureWord(ctx, BUTTON.text) + BUTTON.padX * 2;
  out.button = {
    x: W / 2 - bw / 2, y, w: bw,
    text: layoutHeadline(ctx, [words(BUTTON.text)], { center: W / 2, y: y + (BUTTON.h - BUTTON.size * 1.2) / 2, size: BUTTON.size, lineHeight: 1.2, tracking: 0 }),
  };
  y += BUTTON.h + gaps[2];
  out.url = layoutHeadline(ctx, [[{ text: 'landrepublic.co' }]], { center: W / 2, y, size: URL_SIZE, weight: 400, lineHeight: 1.2, tracking: 0 });
  y += URL_SIZE * 1.2 + gaps[3];
  out.gidi = layoutHeadline(ctx, [words('In collaboration with Gidi')], { center: W / 2, y, size: GIDI_SIZE, weight: 400, lineHeight: 1.2, tracking: 0 });
  L = out;
  return L;
}

function drawLogo(ctx, t, env, lay) {
  const img = env.image(LOGO);
  const p = easeIn(span(t, T_LOGO, 0.55));
  if (!img || p <= 0) return;
  const x = W / 2 - LOGO_W / 2;
  // Masked rise, like the words.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 20, lay.y - 20, LOGO_W + 40, lay.h + 40);
  ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, x, lay.y + (1 - p) * lay.h * 1.3, LOGO_W, lay.h);
  ctx.restore();
}

function drawButton(ctx, t, b) {
  const p = easeIn(span(t, T_BUTTON, 0.5));
  if (p <= 0) return;
  ctx.save();
  ctx.translate(0, (1 - p) * 60);
  ctx.globalAlpha = Math.min(1, p * 3);
  ctx.fillStyle = COLOR.blue;
  framePath(ctx, b.x, b.y, b.w, BUTTON.h, { tl: 0.3, tr: 0.3, br: 0.5, bl: 0.3 });
  ctx.fill();
  ctx.restore();
  drawHeadline(ctx, b.text, t, { inAt: T_BUTTON + 0.06, color: COLOR.white });
}

// ---------------------------------------------------------------------------
export const scene5 = {
  name: 'scene5',
  start: START,
  end: END,
  stillFrom: STILL_FROM,
  images: [RENDER, LOGO, FLOWER],

  plate() {},
  grade: 'none',

  draw(ctx, t, env) {
    // Nothing moves after STILL_FROM; clamp time so the hold is exact.
    t = Math.min(t, STILL_FROM);
    ctx.fillStyle = COLOR.ink;
    ctx.fillRect(0, 0, W, H);
    drawFlower(ctx, t, env);
    drawFrame(ctx, t, env);
    const lay = layouts(ctx, env);
    drawLogo(ctx, t, env, lay.logo);
    drawHeadline(ctx, lay.name, t, { inAt: T_NAME });
    drawButton(ctx, t, lay.button);
    drawHeadline(ctx, lay.url, t, { inAt: T_URL, color: COLOR.paper });
    drawHeadline(ctx, lay.gidi, t, { inAt: T_GIDI, color: 'rgba(244,242,240,0.72)' });
  },

  blurWindows() {
    return [];
  },
};
