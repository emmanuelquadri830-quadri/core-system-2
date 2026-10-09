// Map layer shared by scenes 1 and 2: the stand-in geography, the camera
// transform, glowing road strokes and the Google Earth credit.
//
// World space is in kilometres. Origin near Lagos Island, x east, y south.
// Every shape here is a rough sketch, not survey data. It exists only so the
// graphics can be timed and judged until the Google Earth export arrives.
import { W, H, SAFE, COLOR, mulberry32, arcPath } from './lib.js';
import { setFont } from './type.js';

const coastY = (x) => 3.9 - 0.035 * x + 0.12 * Math.sin(x * 0.9) + 0.05 * Math.sin(x * 2.3);
const lagoonSouth = (x) => -0.4 - 0.1 * x + 0.35 * Math.sin(x * 0.6);
const lagoonNorth = (x) => -15 + 2.2 * Math.sin(x * 0.17) + 0.8 * Math.sin(x * 0.6);
const LAGOON_X = [-6, 44];

// Abraham Adesanya, where the scene 1 line ends.
export const TARGET = [20.4, -1.45];

// Lekki-Epe Expressway: the part scene 1 draws, and the part east of the target.
export const ROAD = arcPath([[6.8, 1.5], [9.6, 1.25], [12.3, 0.85], [15.2, 0.1], [17.9, -0.75], TARGET]);
export const ROAD_EAST = arcPath([TARGET, [21.6, -1.78], [24, -2.2], [29, -2.9], [36, -3.4], [44, -4.1]]);

// Local estate frame at the target: u runs along the expressway, v across it
// (positive v is south). Both in km.
const DIR = (() => {
  const dx = TARGET[0] - 17.9, dy = TARGET[1] + 0.75, l = Math.hypot(dx, dy);
  return [dx / l, dy / l];
})();
const NORM = [-DIR[1], DIR[0]];
export const ESTATE_ANGLE = Math.atan2(DIR[1], DIR[0]);
export const local = (u, v) => [TARGET[0] + u * DIR[0] + v * NORM[0], TARGET[1] + u * DIR[1] + v * NORM[1]];

// Access roads around the site, in local coordinates.
export const ACCESS_ROADS = [
  [[0, 0], [0.02, 0.5], [0, 1.05]],
  [[-0.95, 0.22], [0, 0.22], [0.95, 0.24]],
  [[-0.95, 0.5], [0, 0.5], [0.95, 0.49]],
  [[-0.4, 0.02], [-0.41, 0.5], [-0.4, 0.95]],
  [[0.12, 0], [0.18, -0.4], [0.24, -0.85]],
].map((pts) => arcPath(pts.map(([u, v]) => local(u, v))));

// The site plot (stand-in shape), in local coordinates.
const PLOT_LOCAL = [[0.075, 0.322], [0.168, 0.322], [0.168, 0.398], [0.097, 0.398], [0.075, 0.376]];
export const PLOT = PLOT_LOCAL.map(([u, v]) => local(u, v));
export const PLOT_CENTRE = local(0.122, 0.36);

function buildWorld() {
  const rnd = mulberry32(118);
  const inLagoon = (x, y) => x > LAGOON_X[0] && x < LAGOON_X[1] && y < lagoonSouth(x) && y > lagoonNorth(x);
  const nearEstate = (x, y) => Math.hypot(x - TARGET[0], y - TARGET[1]) < 1.35;
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
    const s = 0.04 + rnd() * 0.12;
    const tone = ['#7a766c', '#8b867a', '#6f6c64', '#9a9486'][Math.floor(rnd() * 4)];
    const w = s * (0.7 + rnd()), h = s * (0.7 + rnd());
    if (y > coastY(x) - 0.25 || inLagoon(x, y) || nearEstate(x, y)) continue;
    blocks.push({ x, y, w, h, tone });
  }
  const streets = [];
  for (let i = 0; i < 700; i++) {
    const x = -16 + 58 * Math.pow(rnd(), 1.4);
    const y = -22 + rnd() * 26;
    const a = rnd() < 0.5 ? 0.08 : Math.PI / 2 + 0.08;
    const len = 0.3 + rnd() * 1.4;
    if (y > coastY(x) - 0.3 || inLagoon(x, y) || nearEstate(x, y)) continue;
    streets.push([x, y, x + Math.cos(a) * len, y + Math.sin(a) * len]);
  }
  // Estate houses on a grid aligned with the expressway, in local coordinates.
  const houses = [];
  const roadsU = [0, -0.4], roadsV = [0, 0.22, 0.5];
  for (let u = -1.25; u <= 1.25; u += 0.032) {
    for (let v = -1.1; v <= 1.2; v += 0.034) {
      const ju = u + (rnd() - 0.5) * 0.006, jv = v + (rnd() - 0.5) * 0.006;
      const keep = rnd() > 0.28;
      const s = 0.011 + rnd() * 0.009, r = 0.75 + rnd() * 0.5;
      const tone = ['#9a958a', '#a8a397', '#8c6f5c', '#7f8079', '#b2ada2'][Math.floor(rnd() * 5)];
      if (!keep) continue;
      if (roadsU.some((x) => Math.abs(ju - x) < 0.025) || roadsV.some((y) => Math.abs(jv - y) < 0.025)) continue;
      if (ju > 0.05 && ju < 0.19 && jv > 0.3 && jv < 0.42) continue; // the plot itself
      const [x, y] = local(ju, jv);
      if (y > coastY(x) - 0.1 || inLagoon(x, y) || Math.hypot(ju, jv) > 1.35) continue;
      houses.push({ u: ju, v: jv, w: s, h: s * r, tone });
    }
  }
  return { patches, blocks, streets, houses };
}
const WORLD = buildWorld();

// ---------------------------------------------------------------------------
// Camera: a tracked world point (tx, ty) placed at screen (sx, sy), with a
// scale in px per km and a rotation in radians.
export function toScreen(cam, p) {
  const dx = p[0] - cam.tx, dy = p[1] - cam.ty;
  const c = Math.cos(cam.rot), s = Math.sin(cam.rot);
  return [cam.sx + (dx * c - dy * s) * cam.scale, cam.sy + (dx * s + dy * c) * cam.scale];
}
export function applyCamera(ctx, cam) {
  ctx.translate(cam.sx, cam.sy);
  ctx.rotate(cam.rot);
  ctx.scale(cam.scale, cam.scale);
  ctx.translate(-cam.tx, -cam.ty);
}
export const kmToPx = (cam, km) => km * cam.scale;

export function drawStandInPlate(pctx, cam) {
  pctx.save();
  pctx.fillStyle = '#2b4a5c';
  pctx.fillRect(0, 0, W, H);
  applyCamera(pctx, cam);
  const px = 1 / cam.scale;
  // Visible world area, as a circle around the screen centre (rotation safe).
  const c = Math.cos(-cam.rot), s = Math.sin(-cam.rot);
  const ox = (W / 2 - cam.sx) * px, oy = (H / 2 - cam.sy) * px;
  const vcx = cam.tx + ox * c - oy * s, vcy = cam.ty + ox * s + oy * c;
  const vr = (Math.hypot(W, H) / 2) * px + 0.3;
  const visible = (x, y, r = 0) => Math.abs(x - vcx) < vr + r && Math.abs(y - vcy) < vr + r;

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
    if (!visible(p.x, p.y, p.rx)) continue;
    pctx.fillStyle = p.tone;
    pctx.beginPath();
    pctx.ellipse(p.x, p.y, p.rx, p.ry, p.rot, 0, Math.PI * 2);
    pctx.fill();
  }
  for (const b of WORLD.blocks) {
    if (!visible(b.x, b.y)) continue;
    pctx.fillStyle = b.tone;
    pctx.fillRect(b.x, b.y, b.w, b.h);
  }
  pctx.strokeStyle = '#a29d90';
  pctx.lineWidth = Math.max(0.02, 1.2 * px);
  pctx.beginPath();
  for (const st of WORLD.streets) { pctx.moveTo(st[0], st[1]); pctx.lineTo(st[2], st[3]); }
  pctx.stroke();

  // Estate: houses and pale access roads, drawn in the local frame.
  if (cam.scale > 120) {
    pctx.save();
    pctx.translate(TARGET[0], TARGET[1]);
    pctx.rotate(ESTATE_ANGLE);
    pctx.fillStyle = '#6a6f52';
    pctx.fillRect(0.06, 0.31, 0.12, 0.1); // cleared ground around the plot
    for (const h of WORLD.houses) {
      pctx.fillStyle = h.tone;
      pctx.fillRect(h.u - h.w / 2, h.v - h.h / 2, h.w, h.h);
    }
    pctx.restore();
  }
  pctx.strokeStyle = '#b3ad9f';
  pctx.lineCap = 'round';
  pctx.lineJoin = 'round';
  pctx.lineWidth = Math.max(0.008, 1.5 * px);
  for (const r of ACCESS_ROADS) {
    pctx.beginPath();
    r.points.forEach((p, i) => (i ? pctx.lineTo(p[0], p[1]) : pctx.moveTo(p[0], p[1])));
    pctx.stroke();
  }
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

  pctx.strokeStyle = '#b9ab8a';
  pctx.lineWidth = Math.max(0.06, 2.5 * px);
  pctx.beginPath();
  for (let x = -80; x <= 90; x += 0.25) (x === -80 ? pctx.moveTo : pctx.lineTo).call(pctx, x, coastY(x));
  pctx.stroke();

  // The expressway itself, as a pale strip under the glow.
  pctx.strokeStyle = '#b3ad9f';
  pctx.lineWidth = Math.max(0.03, 3 * px);
  pctx.beginPath();
  ROAD.points.forEach((p, i) => (i ? pctx.lineTo(p[0], p[1]) : pctx.moveTo(p[0], p[1])));
  ROAD_EAST.points.forEach((p) => pctx.lineTo(p[0], p[1]));
  pctx.stroke();
  pctx.restore();
}

// ---------------------------------------------------------------------------
// Glowing road: white core, blue glow. Widths are screen pixels.
export const GLOW_MAIN = { outer: 22, inner: 10, core: 4 };
export const GLOW_ACCESS = { outer: 12, inner: 6, core: 2.2 };

export function glowStroke(ctx, pts, widths = GLOW_MAIN, alpha = 1) {
  if (pts.length < 2 || alpha <= 0) return;
  const path = new Path2D();
  pts.forEach((p, i) => (i ? path.lineTo(p[0], p[1]) : path.moveTo(p[0], p[1])));
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = COLOR.blue;
  ctx.shadowColor = COLOR.blue;
  ctx.globalAlpha = 0.55 * alpha;
  ctx.shadowBlur = widths.outer * 2.1;
  ctx.lineWidth = widths.outer;
  ctx.stroke(path);
  ctx.globalAlpha = 0.9 * alpha;
  ctx.shadowBlur = widths.inner * 1.8;
  ctx.lineWidth = widths.inner;
  ctx.stroke(path);
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowBlur = 6;
  ctx.shadowColor = '#FFFFFF';
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = COLOR.white;
  ctx.lineWidth = widths.core;
  ctx.stroke(path);
  ctx.restore();
}

export function drawCredit(ctx) {
  setFont(ctx, 24, 400, 0);
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.fillText('Google Earth', SAFE.left, SAFE.bottom - 6);
}

export function drawStandInMarker(ctx) {
  setFont(ctx, 20, 400, 0);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('STAND-IN PLATE: replace with Google Earth export', W - 40, 200);
  ctx.textAlign = 'left';
}

// Top scrim in near-black, used behind headlines.
export function drawTopScrim(ctx, alpha = 1) {
  if (alpha <= 0) return;
  const g = ctx.createLinearGradient(0, 0, 0, 760);
  g.addColorStop(0, `rgba(15,15,15,${0.55 * alpha})`);
  g.addColorStop(1, 'rgba(15,15,15,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 760);
}
