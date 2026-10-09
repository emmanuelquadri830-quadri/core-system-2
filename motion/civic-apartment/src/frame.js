// The curved frame, taken from the Civic facade: a white frame with small
// corners on three sides and one large sweep where the balcony slab turns.
// Radii are fractions of the shorter side.
export const FRAME_RADII = { tl: 0.07, tr: 0.07, br: 0.34, bl: 0.07 };

export function framePath(ctx, x, y, w, h, radii = FRAME_RADII) {
  const m = Math.min(w, h);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, [radii.tl * m, radii.tr * m, radii.br * m, radii.bl * m]);
}
