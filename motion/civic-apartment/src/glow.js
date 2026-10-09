// The glowing line used for roads in every scene: a blue glow in two passes
// under a white core, plus a bright head while the line is still travelling.
// `w` scales every width and blur, so 1 is the expressway look from scene 1.
import { COLOR } from './lib.js';

export function strokeGlow(ctx, path, w = 1) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = COLOR.blue;
  ctx.shadowColor = COLOR.blue;
  ctx.globalAlpha = 0.55;
  ctx.shadowBlur = 46 * w;
  ctx.lineWidth = 22 * w;
  ctx.stroke(path);
  ctx.globalAlpha = 0.9;
  ctx.shadowBlur = 18 * w;
  ctx.lineWidth = 10 * w;
  ctx.stroke(path);
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowBlur = 6 * w;
  ctx.shadowColor = '#FFFFFF';
  ctx.globalAlpha = 1;
  ctx.strokeStyle = COLOR.white;
  ctx.lineWidth = 4 * w;
  ctx.stroke(path);
  ctx.restore();
}

// A white-to-blue spark at the travelling end of a line. live is 0..1.
export function glowHead(ctx, [x, y], live, w = 1) {
  if (live <= 0) return;
  const r = 34 * w;
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,255,255,${0.95 * live})`);
  g.addColorStop(0.35, `rgba(22,103,208,${0.6 * live})`);
  g.addColorStop(1, 'rgba(22,103,208,0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.shadowBlur = 0;
  ctx.fillRect(x - r - 6 * w, y - r - 6 * w, 2 * r + 12 * w, 2 * r + 12 * w);
  ctx.restore();
}

// Path2D through screen points.
export function polyPath(pts, close = false) {
  const p = new Path2D();
  pts.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])));
  if (close) p.closePath();
  return p;
}
