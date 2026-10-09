// The film is a pure function of time: window.seek(t) paints frame t.
// Caches below hold decoded images and layout only, never animation state.
import { W, H, FPS, DURATION, mulberry32 } from './lib.js';
import { scene1 } from './scene1.js';
import { scene2 } from './scene2.js';
import { scene3 } from './scene3.js';
import { scene4 } from './scene4.js';
import { scene5 } from './scene5.js';

const SCENES = [scene1, scene2, scene3, scene4, scene5];

const MOTION_BLUR_SAMPLES = 10;
const SHUTTER = 0.5 / FPS; // 180 degree shutter
const GRAIN = 0.03;        // about 3% of full range
const GRAIN_CELL = 2;      // 2 px grain
const GRAIN_HOLD = 2;      // new grain every second frame

const view = document.getElementById('film');
view.width = W; view.height = H;
const out = view.getContext('2d');

const make = () => {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  return [c, c.getContext('2d', { willReadFrequently: false })];
};
const [plateCanvas, pctx] = make();
const [workCanvas, wctx] = make();
const [accCanvas, actx] = make();

// ---------------------------------------------------------------------------
// Footage plates: assets/plates/plates.json, if present, maps a scene to an
// image sequence. Without it each scene draws its stand-in.
let plates = {};
const bitmaps = new Map();

async function loadPlates() {
  try {
    const r = await fetch('assets/plates/plates.json');
    if (r.ok) plates = await r.json();
  } catch { plates = {}; }
}

function plateIndex(name, t) {
  const p = plates[name];
  const i = (p.firstFrame ?? 1) + (p.offset ?? 0) + Math.round(t * FPS);
  return Math.min(i, (p.firstFrame ?? 1) + p.frames - 1);
}
const platePath = (name, i) => plates[name].pattern.replace(/%0(\d)d/, (_, n) => String(i).padStart(Number(n), '0'));

async function preloadPlate(name, t) {
  if (!plates[name]) return;
  const path = platePath(name, plateIndex(name, t));
  if (bitmaps.has(path)) return;
  const blob = await (await fetch(path)).blob();
  bitmaps.set(path, await createImageBitmap(blob));
  if (bitmaps.size > 12) {
    const first = bitmaps.keys().next().value;
    bitmaps.get(first).close();
    bitmaps.delete(first);
  }
}

// Stills (renders, logo) listed by each scene, decoded once at startup.
const stills = new Map();
async function loadStills() {
  const paths = [...new Set(SCENES.flatMap((s) => s.images ?? []))];
  await Promise.all(paths.map(async (p) => {
    const blob = await (await fetch(p)).blob();
    stills.set(p, await createImageBitmap(blob));
  }));
}

const env = {
  hasPlate: (name) => Boolean(plates[name]),
  image: (path) => stills.get(path),
  // Draws the scene's footage frame cover-fit, if there is footage. Returns
  // false when the scene should draw its stand-in instead.
  drawFootage(pctx, name, t) {
    const img = plates[name] ? bitmaps.get(platePath(name, plateIndex(name, t))) : null;
    if (!img) return false;
    const s = Math.max(W / img.width, H / img.height);
    pctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
    return true;
  },
};

// ---------------------------------------------------------------------------
const sceneAt = (t) => SCENES.find((s) => t >= s.start && t < s.end) ?? SCENES[SCENES.length - 1];

function paintSample(scene, t) {
  pctx.setTransform(1, 0, 0, 1, 0, 0);
  pctx.clearRect(0, 0, W, H);
  scene.plate(pctx, t, env);
  wctx.setTransform(1, 0, 0, 1, 0, 0);
  wctx.globalAlpha = 1;
  wctx.globalCompositeOperation = 'source-over';
  wctx.fillStyle = '#0F0F0F';
  wctx.fillRect(0, 0, W, H);
  wctx.filter = scene.grade ?? 'none';
  wctx.drawImage(plateCanvas, 0, 0);
  wctx.filter = 'none';
  wctx.save();
  scene.draw(wctx, t, env);
  wctx.restore();
}

// Number of motion blur samples at t: 1 outside the scene's fast windows.
// A window may carry its own sample count as a third value.
function blurSamples(scene, t) {
  const win = (scene.blurWindows?.(wctx) ?? []).find(([a, b]) => t >= a && t <= b);
  return win ? win[2] ?? MOTION_BLUR_SAMPLES : 1;
}

function applyGrain(ctx, frame) {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const rnd = mulberry32(0x9e3779b9 ^ Math.floor(frame / GRAIN_HOLD));
  const cw = W / GRAIN_CELL, ch = H / GRAIN_CELL;
  const cells = new Float32Array(cw * ch);
  const amp = GRAIN * 255 * 1.7;
  // Sum of two uniforms gives a softer, film-like distribution.
  for (let i = 0; i < cells.length; i++) cells[i] = (rnd() + rnd() - 1) * amp;
  for (let y = 0; y < H; y++) {
    const row = ((y / GRAIN_CELL) | 0) * cw;
    for (let x = 0; x < W; x++) {
      const n = cells[row + ((x / GRAIN_CELL) | 0)];
      const o = (y * W + x) * 4;
      d[o] += n; d[o + 1] += n; d[o + 2] += n;
    }
  }
  ctx.putImageData(img, 0, 0);
}

async function seek(t) {
  const frame = Math.round(t * FPS);
  const scene = sceneAt(t);
  await preloadPlate(scene.name, t);

  const samples = blurSamples(scene, t);
  if (samples > 1) {
    actx.globalCompositeOperation = 'source-over';
    for (let k = 0; k < samples; k++) {
      const ts = t + (k / (samples - 1) - 0.5) * SHUTTER;
      paintSample(scene, ts);
      actx.globalAlpha = 1 / (k + 1); // running average of opaque frames
      actx.drawImage(workCanvas, 0, 0);
    }
    actx.globalAlpha = 1;
  } else {
    paintSample(scene, t);
    actx.globalAlpha = 1;
    actx.drawImage(workCanvas, 0, 0);
  }
  // A scene's still hold freezes the grain too, so those frames are identical.
  const grainFrame = t >= (scene.stillFrom ?? Infinity) ? Math.round(scene.stillFrom * FPS) : frame;
  applyGrain(actx, grainFrame);
  out.drawImage(accCanvas, 0, 0);
  return frame;
}

const hold = SCENES.find((s) => s.stillFrom !== undefined);
window.FILM = {
  W, H, FPS, DURATION,
  scenes: SCENES.map((s) => ({ start: s.start, end: s.end })),
  holdFrom: hold ? Math.round(hold.stillFrom * FPS) : null, // first frame of the final still hold
};
window.seek = seek;
window.ready = (async () => {
  await document.fonts.load('500 64px "Red Hat Display"');
  await document.fonts.load('400 64px "Red Hat Display"');
  await document.fonts.ready;
  await loadPlates();
  await loadStills();
  return true;
})();
