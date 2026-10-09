#!/usr/bin/env python3
"""Split the street-view render into three parallax layers for scene 3.

  sky.png    RGB   a smooth sky plate fitted to the clear sky, full source size
  mid.png    RGBA  the source pixels, untouched; alpha 0 on clear sky and
                   behind the front foliage, soft only on the thin matte edge
  front.png  RGBA  the overhanging branch and the leaf tips at the top edge

The building is never altered: mid.png keeps every source RGB value, and
its alpha is 255 on everything that is not clear sky or front foliage.
The front layer only holds foliage that sits over sky, so moving it reveals
the sky plate, never invented building pixels.

  python3 tools/separate_layers.py [--preview DIR]

Prints the fit error and the verification numbers. With --preview it also
writes inspection images into DIR.
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets/renders/street-view.webp'
OUT = ROOT / 'assets/renders/street-view-layers'

# Sky model: a cubic polynomial per channel in x and y, plus fourth and
# fifth powers of y alone for the haze that lightens toward the horizon.
SKY_DEG = 3
SKY_EXTRA_Y = (4, 5)
# The sky is never seen below its lowest seed row, so the plate eases into
# the horizon colour over this many rows instead of extrapolating.
HORIZON_EASE = 40

# Key thresholds on the distance from the sky model, in 8-bit RGB units.
# The fit error on clear sky is about 1.7 rms (as an RGB distance) with
# rare compression specks near 10, so below T0 is sky, above T1 is solid
# content, and the band between is the anti-aliased matte edge.
T0 = 7.0
T1 = 14.0
# The soft edge reaches at most this many pixels out from solid content,
# which takes in the render's own sharpening halo along edges.
EDGE_REACH = 3
# Pixels less blue than the sky by this much count against being sky,
# because the building is near-white and grey while the sky is blue.
CHROMA_WEIGHT = 1.5

# Building guard: a wall run must be this tall, and gaps in the top edge up
# to this many columns wide are bridged. The roof starts at about 27% of
# the height; above WALL_MIN_Y there is only branch and sky, so a pale
# blossom up there can never start a run.
WALL_RUN = 10
WALL_BRIDGE = 7
WALL_MIN_Y = 0.2

# Sky may touch the left and right image edges above this row; lower down
# the edges are ground and hedges.
SIDE_SKY_LIMIT = 0.68

# A front component must lie entirely above this fraction of the height.
FRONT_MAX_Y = 0.46
# Detached leaves this close to the branch belong to it.
FRONT_ATTACH = 24
# Foliage at least this far from the sky colour, with neighbours that are
# too, is fully opaque.
FRONT_SOLID = 40.0

# Parallax test from the scene 3 brief: scale about the image centre.
TEST_SCALES = {'sky': 1.00, 'mid': 1.03, 'front': 1.07}


def ramp(x, lo, hi):
  return np.clip((x - lo) / (hi - lo), 0.0, 1.0)


def local_std(img, size=5):
  out = []
  for c in range(img.shape[2]):
    ch = img[..., c]
    m = ndi.uniform_filter(ch, size)
    m2 = ndi.uniform_filter(ch * ch, size)
    out.append(np.sqrt(np.maximum(m2 - m * m, 0.0)))
  return np.maximum.reduce(out)


def border_seeds(shape):
  """Top row, plus the side columns down to SIDE_SKY_LIMIT."""
  h, w = shape
  seeds = np.zeros(shape, bool)
  seeds[0] = True
  side = int(h * SIDE_SKY_LIMIT)
  seeds[:side, 0] = True
  seeds[:side, w - 1] = True
  return seeds


def connected_to(mask, seeds, structure=None):
  lab, _ = ndi.label(mask, structure=structure)
  ids = np.unique(lab[seeds & (lab > 0)])
  return np.isin(lab, ids[ids > 0])


def poly_basis(u, v, deg):
  return np.stack([u ** i * v ** j for i in range(deg + 1) for j in range(deg + 1 - i)], -1)


def ease_rows(y, y_low, k):
  """Row coordinate for the sky model: unchanged above y_low - k, then
  eased flat so it reaches y_low at y_low + k with zero slope."""
  y = y.astype(np.float64)
  out = y.copy()
  band = (y > y_low - k) & (y < y_low + k)
  out[band] = y[band] - (y[band] - (y_low - k)) ** 2 / (4 * k)
  out[y >= y_low + k] = y_low
  return out


def fit_sky(rgb, seed):
  """Robust least-squares polynomial fit to the seed pixels."""
  h, w = seed.shape
  yy, xx = np.mgrid[0:h, 0:w]
  y_low = int(yy[seed].max()) + HORIZON_EASE // 2
  u = xx / (w - 1) * 2 - 1
  v = ease_rows(yy, y_low, HORIZON_EASE) / (h - 1) * 2 - 1
  basis = np.concatenate([poly_basis(u, v, SKY_DEG)] + [v[..., None] ** p for p in SKY_EXTRA_Y], -1)
  use = seed.copy()
  for _ in range(5):
    coef = np.linalg.lstsq(basis[use], rgb[use], rcond=None)[0]
    model = basis @ coef
    err = np.sqrt(((rgb - model) ** 2).sum(-1))
    rms = np.sqrt(np.mean(err[use] ** 2))
    # Drop outliers (contaminated edge pixels, specks) and refit.
    use = seed & (err < 3 * rms + 1)
  return model, use, y_low


def building_guard(rgb, dkey):
  """Everything below the building's top edge, column by column.

  Sky seen through or under the building (open balcony ends, glass
  balustrades with sky behind them) belongs to the building and stays in
  mid. The top edge is the first pixel of a tall run of smooth, bright,
  non-sky wall. Palm fronds are textured and their highlights short, so
  they never start a run.
  """
  h, w = dkey.shape
  wall_px = (dkey > 2 * T1) & (rgb.mean(-1) > 140) & (local_std(rgb, 7) < 6)
  wall = wall_px.copy()
  for k in range(1, WALL_RUN):
    wall &= np.roll(wall_px, -k, 0)
  wall[-WALL_RUN:] = False
  wall[: int(h * WALL_MIN_Y)] = False
  top = np.where(wall.any(0), wall.argmax(0), h)
  # Bridge narrow columns with no wall run (the corner where two faces
  # meet, a recessed joint): such a column is covered from the lower of
  # its two neighbours' tops, so a notch of real sky above stays sky.
  left = ndi.minimum_filter1d(top, WALL_BRIDGE, origin=WALL_BRIDGE // 2, mode='nearest')
  right = ndi.minimum_filter1d(top, WALL_BRIDGE, origin=-(WALL_BRIDGE // 2), mode='nearest')
  top = np.minimum(top, np.maximum(left, right))
  yy = np.arange(h)[:, None]
  return yy >= top[None, :], top


def separate(src):
  h, w = src.shape[:2]
  rgb = src[..., :3].astype(np.float64)
  # The source's last column (alpha 32, darkened) and last row (alpha 0)
  # are a resampling edge. Key with copies of their neighbours; the output
  # RGB still keeps the source values.
  key = rgb.copy()
  key[:, w - 1] = key[:, w - 2]
  key[h - 1] = key[h - 2]
  r, g, b = key[..., 0], key[..., 1], key[..., 2]
  seeds = border_seeds((h, w))

  # 1. Seed: smooth, clearly blue pixels connected to the open sky.
  blue = (b - r > 25) & (b >= g) & (g >= r - 5)
  seed = connected_to(blue & (local_std(key) < 4), seeds)

  # 2. Sky model.
  sky, fit_px, y_low = fit_sky(key, seed)
  sky8 = np.clip(np.rint(sky), 0, 255)

  # 3. Distance from the sky, with a penalty for being less blue than it.
  diff = key - sky
  dist = np.sqrt((diff ** 2).sum(-1))
  chroma = b - (r + g) / 2
  sky_chroma = sky[..., 2] - (sky[..., 0] + sky[..., 1]) / 2
  dkey = np.maximum(dist, CHROMA_WEIGHT * (sky_chroma - chroma))

  # 4. Sky region: sky-coloured, connected to the open sky, and not inside
  # the building outline.
  cand = dkey < T1
  guard, guard_top = building_guard(key, dkey)
  sky_region = connected_to(cand & ~guard, seeds)
  nonsky = ~sky_region

  # 5. Front: components of non-sky that hang from the top or left edge
  # above FRONT_MAX_Y, plus detached leaves near them. Everything that
  # reaches lower down (building, palms, background trees) stays in mid.
  lab, _ = ndi.label(nonsky, structure=np.ones((3, 3)))
  objs = ndi.find_objects(lab)
  limit = int(h * FRONT_MAX_Y)
  ground = set(np.unique(lab[-1])) - {0}
  comps = []
  for i, sl in enumerate(objs, start=1):
    y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
    comps.append({'id': i, 'px': int((lab[sl] == i).sum()), 'box': (x0, y0, x1, y1),
                  'top_or_left': bool((lab[0] == i).any() or (lab[:limit, 0] == i).any()),
                  'low': y1 > limit, 'right': x1 == w, 'ground': i in ground})
  front_ids = [c['id'] for c in comps if c['top_or_left'] and not c['low'] and not c['right']]
  # Anything hanging from the top or left edge that reaches lower down is
  # joined to mid content; it stays in mid and is reported.
  joined = [c for c in comps if c['top_or_left'] and c['id'] not in front_ids]
  near = ndi.binary_dilation(np.isin(lab, front_ids), iterations=FRONT_ATTACH)
  for c in comps:
    if c['id'] in front_ids or c['low'] or c['right']:
      continue
    sl = objs[c['id'] - 1]
    if near[sl][lab[sl] == c['id']].all():
      front_ids.append(c['id'])
  front_core = np.isin(lab, front_ids)
  # Take in the outer anti-aliased edge, which lies in the sky region: two
  # pixels all round, plus any faint fringe (above T0) that runs on from
  # the foliage, so no ghost of the branch is left behind in mid.
  fringe = sky_region & (dkey > T0) & ndi.binary_dilation(front_core, iterations=6)
  fringe = connected_to(fringe | front_core, front_core, structure=np.ones((3, 3))) & ~front_core
  front_zone = front_core | fringe | (ndi.binary_dilation(front_core, iterations=2) & sky_region)

  # Does the front foliage overlap or come close to anything that is not
  # sky? Measure the gap to the nearest non-sky pixel left in mid.
  overlap = ndi.binary_dilation(front_core, iterations=3) & nonsky & ~front_core
  gap = ndi.distance_transform_edt(~(nonsky & ~front_core))[front_core].min()
  # Specks of non-sky floating in open sky (frond tips cut off by the key)
  # stay in mid; list them.
  specks = [c for c in comps if c['id'] not in front_ids and not c['ground'] and c['px'] < 50]

  # 6. Mid alpha: opaque except clear sky; soft only in the thin band
  # between T0 and T1 where a pixel is almost all sky. The background
  # behind the front foliage is sky, so mid is clear there too.
  mid_a = np.ones((h, w))
  mid_a[sky_region] = ramp(dkey[sky_region], T0, T1)
  mid_a[front_zone] = 0.0
  # Soft values belong next to solid content only; a stray noisy sky
  # pixel out in the open would otherwise leave a faint speck in mid.
  solid = (mid_a == 1) & ~sky_region
  mid_a[sky_region & ~ndi.binary_dilation(solid, iterations=EDGE_REACH)] = 0.0

  # 7. Front alpha by unmixing against the sky plate. Each pixel's foliage
  # colour comes from nearby interior pixels (solid, with solid neighbours),
  # so a thin twig or a leaf edge gets a partial alpha instead of keeping
  # the sky it was blended with. Wider searches fill in where no interior
  # pixel is close.
  zone = front_zone
  interior = ndi.binary_erosion(zone & (dist > FRONT_SOLID), structure=np.ones((3, 3)))
  fg = np.zeros_like(key)
  found = np.zeros((h, w), bool)
  for sigma in (1.5, 4.0, 12.0):
    wsum = ndi.gaussian_filter(interior.astype(float), sigma)
    est = np.stack([ndi.gaussian_filter(np.where(interior, key[..., c], 0.0), sigma)
                    for c in range(3)], -1) / np.maximum(wsum, 1e-9)[..., None]
    take = ~found & (wsum > 0.05)
    fg[take] = est[take]
    found |= take
  fg_dist = np.sqrt(((fg - sky) ** 2).sum(-1))
  fg_dist = np.where(found, np.maximum(fg_dist, FRONT_SOLID), 120.0)
  fa = ramp(dist, T0, fg_dist)
  fa[interior] = 1.0
  fa[~zone] = 0.0
  # Raise alpha where needed so the decontaminated colour stays in 0..255.
  d8 = key - sky8
  need = np.where(d8 > 0, d8 / np.maximum(255 - sky8, 1e-6), -d8 / np.maximum(sky8, 1e-6)).max(-1)
  fa = np.where(fa > 0, np.maximum(fa, need), 0.0)
  fa8 = np.ceil(np.clip(fa, 0, 1) * 255 - 1e-6)
  faq = fa8 / 255
  # Decontaminate: the colour that, laid over the sky plate at this alpha,
  # gives back the source pixel exactly.
  # Fully transparent pixels carry the sky plate colour, so the file holds
  # no building pixels and any unpremultiplied filtering bleeds only sky.
  fcol = np.where(faq[..., None] > 0, sky8 + d8 / np.maximum(faq, 1e-6)[..., None], sky8)
  fcol = np.where(faq[..., None] >= 1, key, fcol)

  mid8 = np.rint(mid_a * 255)
  layers = {
    'sky': sky8.astype(np.uint8),
    'mid': np.dstack([src[..., :3], mid8]).astype(np.uint8),
    'front': np.dstack([np.clip(np.rint(fcol), 0, 255), fa8]).astype(np.uint8),
  }
  info = {
    'seed': seed, 'fit_px': fit_px, 'y_low': y_low, 'dist': dist, 'dkey': dkey, 'sky_region': sky_region,
    'front_core': front_core, 'front_zone': front_zone, 'guard': guard, 'guard_top': guard_top,
    'overlap': int(overlap.sum()), 'gap': float(gap), 'specks': specks, 'joined': joined,
    'front_comps': [c for c in comps if c['id'] in front_ids],
    'other_comps': [c for c in comps if c['id'] not in front_ids and c['px'] >= 50],
  }
  return layers, info


def over(top, bottom):
  """Straight-alpha 'over' on float arrays in 0..1."""
  ta = top[..., 3:4]
  ba = bottom[..., 3:4]
  oa = ta + ba * (1 - ta)
  oc = (top[..., :3] * ta + bottom[..., :3] * ba * (1 - ta)) / np.maximum(oa, 1e-9)
  return np.concatenate([oc, oa], -1)


def scale_layer(rgba, s):
  """Scale a straight-alpha layer about the image centre, bilinear on
  premultiplied colour, transparent outside its edges."""
  h, w = rgba.shape[:2]
  if s == 1:
    return rgba.copy()
  cy, cx = (h - 1) / 2, (w - 1) / 2
  yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
  sy = cy + (yy - cy) / s
  sx = cx + (xx - cx) / s
  pm = np.concatenate([rgba[..., :3] * rgba[..., 3:4], rgba[..., 3:4]], -1)
  out = np.stack([ndi.map_coordinates(pm[..., c], [sy, sx], order=1, mode='constant', cval=0.0)
                  for c in range(4)], -1)
  a = out[..., 3:4]
  return np.concatenate([out[..., :3] / np.maximum(a, 1e-9), a], -1)


def as_float(layer):
  f = layer.astype(np.float64) / 255
  if f.shape[2] == 3:
    f = np.concatenate([f, np.ones(f.shape[:2] + (1,))], -1)
  return f


def composite(sky, mid, front, scales=None):
  scales = scales or {'sky': 1, 'mid': 1, 'front': 1}
  out = scale_layer(as_float(sky), scales['sky'])
  out = over(scale_layer(as_float(mid), scales['mid']), out)
  out = over(scale_layer(as_float(front), scales['front']), out)
  return out


def verify(src, files, info):
  sky = np.array(Image.open(files['sky']))
  mid = np.array(Image.open(files['mid']))
  front = np.array(Image.open(files['front']))
  rgb = src[..., :3].astype(np.float64)
  h, w = rgb.shape[:2]
  report = {}

  # (a) Opaque mid pixels are byte-identical to the source.
  opaque = mid[..., 3] == 255
  same = (mid[..., :3] == src[..., :3]).all(-1)
  report['mid_opaque_px'] = int(opaque.sum())
  report['mid_opaque_identical'] = bool(same[opaque].all())
  report['mid_rgb_identical_everywhere'] = bool(same.all())

  # Sky fit error: on the pixels the fit kept, and on all clear sky (mid
  # and front both transparent), against the 8-bit plate.
  clear = (mid[..., 3] == 0) & (front[..., 3] == 0) & (src[..., 3] == 255)
  for name, mask in (('fit', info['fit_px'] & (src[..., 3] == 255)), ('clear_sky', clear)):
    err = np.abs(sky.astype(np.float64) - rgb)[mask]
    report[f'sky_{name}_px'] = int(mask.sum())
    report[f'sky_{name}_rms'] = np.sqrt((err ** 2).mean(0)).round(2).tolist()
    report[f'sky_{name}_mean_abs'] = err.mean(0).round(2).tolist()
    report[f'sky_{name}_p999'] = np.percentile(err, 99.9, axis=0).round(1).tolist()
    report[f'sky_{name}_max'] = err.max(0).astype(int).tolist()

  # (b) Identity composite against the source.
  comp = composite(sky, mid, front)
  d = np.abs(comp[..., :3] * 255 - rgb).max(-1)
  # The source's own half-transparent last column and transparent last row.
  src_edge = src[..., 3] < 255
  soft = ((mid[..., 3] > 0) & (mid[..., 3] < 255)) | ((front[..., 3] > 0) & (front[..., 3] < 255))
  # Matte edges: soft pixels and every boundary between layers, grown by 2.
  owner = np.where(front[..., 3] > 0, 2, np.where(mid[..., 3] > 0, 1, 0))
  boundary = (owner != ndi.grey_dilation(owner, size=3)) | (owner != ndi.grey_erosion(owner, size=3))
  edges = ndi.binary_dilation(soft | boundary, iterations=2)
  inner = ~src_edge
  report['identity_max'] = float(d[inner].max().round(2))
  report['identity_mean'] = float(d[inner].mean().round(3))
  report['identity_max_incl_source_edge'] = float(d.max().round(2))
  report['identity_max_away_from_edges'] = float(d[inner & ~edges].max().round(2))
  report['identity_max_on_mid_opaque'] = float(d[inner & opaque].max().round(2))
  fz = front[..., 3] > 0
  report['identity_max_under_front'] = float(d[inner & fz].max().round(2)) if fz.any() else 0.0
  report['identity_p999'] = float(np.percentile(d[inner], 99.9).round(2))

  # (c) Parallax test.
  par = composite(sky, mid, front, TEST_SCALES)
  cov = par[..., 3]
  report['parallax_min_coverage'] = float(cov.min())
  report['parallax_holes'] = int((cov < 0.999).sum())
  # Halo bound: an opaque mid edge pixel carries the sky it was rendered
  # over; after the move the sky plate beneath it is a different point
  # of the gradient. The worst such mismatch bounds any halo.
  skyf = sky.astype(np.float64)
  cy, cx = (h - 1) / 2, (w - 1) / 2

  def sky_shift(mask, s_rel):
    ys, xs = np.nonzero(mask)
    ty = np.clip(np.rint(cy + (ys - cy) * s_rel), 0, h - 1).astype(int)
    tx = np.clip(np.rint(cx + (xs - cx) * s_rel), 0, w - 1).astype(int)
    return np.abs(skyf[ys, xs] - skyf[ty, tx]).max() if len(ys) else 0.0

  mid_edge = opaque & ndi.binary_dilation(mid[..., 3] < 255, iterations=1) & (info['dist'] < 60)
  front_full = (front[..., 3] == 255) & ndi.binary_dilation(front[..., 3] < 255, iterations=1)
  report['halo_bound_mid'] = float(np.round(sky_shift(mid_edge, TEST_SCALES['mid'] / TEST_SCALES['sky']), 2))
  report['halo_bound_front'] = float(np.round(sky_shift(front_full, TEST_SCALES['front'] / TEST_SCALES['sky']), 2))
  # Seams: where sky-coloured pixels kept in mid (sky seen inside the
  # building outline, pockets between fronds) now meet the sky plate, the
  # step between the two neighbours. A seam would show as a large step.
  fa_moved = scale_layer(as_float(front), TEST_SCALES['front'])[..., 3]
  ma_moved = scale_layer(as_float(mid), TEST_SCALES['mid'])[..., 3]
  # Eroded, so bilinear sampling of a kept pixel does not pick up a frond.
  kept = ndi.binary_erosion(opaque & (np.abs(rgb - skyf).max(-1) < 8), structure=np.ones((3, 3)))
  yy, xx = np.mgrid[0:h, 0:w]
  oy = np.clip(np.rint(cy + (yy - cy) / TEST_SCALES['mid']), 0, h - 1).astype(int)
  ox = np.clip(np.rint(cx + (xx - cx) / TEST_SCALES['mid']), 0, w - 1).astype(int)
  kept_moved = kept[oy, ox] & (ma_moved > 0.99) & (fa_moved < 0.01)
  plate = (ma_moved < 0.01) & (fa_moved < 0.01)
  pc = par[..., :3] * 255
  # Bilinear resampling leaves a pixel of partial alpha between the two, so
  # compare each kept pixel with plate pixels up to two pixels away.
  steps = []
  for dy in range(-2, 3):
    for dx in range(-2, 3):
      if dy == 0 and dx == 0:
        continue
      ys0, ys1 = slice(max(0, -dy), h - max(0, dy)), slice(max(0, dy), h - max(0, -dy))
      xs0, xs1 = slice(max(0, -dx), w - max(0, dx)), slice(max(0, dx), w - max(0, -dx))
      pair = kept_moved[ys0, xs0] & plate[ys1, xs1]
      steps.append(np.abs(pc[ys0, xs0] - pc[ys1, xs1]).max(-1)[pair])
  steps = np.concatenate(steps)
  report['seam_pairs'] = int(steps.size)
  report['seam_step_max'] = float(steps.max().round(2)) if steps.size else 0.0
  report['seam_step_mean'] = float(steps.mean().round(2)) if steps.size else 0.0
  # For scale: the same step between neighbours across the clear sky of
  # the source itself (compression noise and banding).
  clear_src = clear & (np.abs(rgb - skyf).max(-1) < 8)
  src_steps = np.abs(np.diff(rgb, axis=1)).max(-1)[clear_src[:, 1:] & clear_src[:, :-1]]
  report['source_sky_step_max'] = float(src_steps.max())
  report['source_sky_step_p999'] = float(np.percentile(src_steps, 99.9))
  # Does the moved front layer land on mid content anywhere?
  report['front_over_mid_px'] = int(((fa_moved > 0.05) & (ma_moved > 0.05)).sum())
  return report, comp, par


def save_previews(dirpath, src, layers, info, comp, par):
  d = Path(dirpath)
  d.mkdir(parents=True, exist_ok=True)
  rgb = src[..., :3].astype(np.float64)
  h, w = rgb.shape[:2]

  def on(layer, colour):
    a = layer[..., 3:4].astype(np.float64) / 255
    return (layer[..., :3] * a + np.array(colour) * (1 - a)).astype(np.uint8)

  def save(name, arr):
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(d / name)

  save('sky.png', layers['sky'])
  save('mid_on_magenta.png', on(layers['mid'], (255, 0, 255)))
  save('front_on_magenta.png', on(layers['front'], (255, 0, 255)))
  save('mid_alpha.png', layers['mid'][..., 3])
  save('front_alpha.png', layers['front'][..., 3])
  save('identity_composite.png', comp[..., :3] * 255)
  save('identity_diff_x10.png', np.abs(comp[..., :3] * 255 - rgb) * 10)
  save('parallax.png', par[..., :3] * 255)
  # A stronger test makes fringes easy to see.
  strong = composite(layers['sky'], layers['mid'], layers['front'],
                     {'sky': 1.0, 'mid': 1.10, 'front': 1.25})
  save('parallax_strong.png', strong[..., :3] * 255)
  vis = (rgb * 0.5).astype(np.uint8)
  vis[info['sky_region']] = (40, 90, 220)
  vis[info['front_zone']] = (240, 160, 0)
  vis[info['guard'] & ~info['sky_region']] = (vis[info['guard'] & ~info['sky_region']] * 0.6
                                              + np.array([0, 120, 0]) * 0.4).astype(np.uint8)
  save('regions.png', vis)

  crops = {
    'roof_corner': (640, 300, 800, 420),
    'roof_left': (380, 440, 540, 540),
    'left_wing_top': (110, 500, 330, 620),
    'right_face': (740, 380, 900, 600),
    'wing_end': (820, 560, 940, 820),
    'branch_tip': (200, 140, 350, 300),
    'branch_low': (0, 330, 140, 450),
    'leaf_tips': (440, 0, 600, 70),
    'palm': (820, 280, 971, 520),
    'left_trees': (0, 640, 160, 760),
  }
  # One sheet per crop: source, parallax test, strong parallax, mid on
  # magenta, front on magenta, scaled up with nearest neighbour.
  panels = [src[..., :3], par[..., :3] * 255, strong[..., :3] * 255,
            on(layers['mid'], (255, 0, 255)), on(layers['front'], (255, 0, 255))]
  for name, (x0, y0, x1, y1) in crops.items():
    k = max(1, int(360 / max(x1 - x0, y1 - y0)))
    tw, th = (x1 - x0) * k, (y1 - y0) * k
    sheet = Image.new('RGB', (len(panels) * (tw + 6), th), (255, 255, 255))
    for j, img in enumerate(panels):
      tile = Image.fromarray(np.clip(img[y0:y1, x0:x1], 0, 255).astype(np.uint8))
      sheet.paste(tile.resize((tw, th), Image.NEAREST), (j * (tw + 6), 0))
    sheet.save(d / f'zoom_{name}.png')


def main():
  ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
  ap.add_argument('--preview', help='write inspection images into this directory')
  args = ap.parse_args()

  src = np.array(Image.open(SRC).convert('RGBA'))
  layers, info = separate(src)
  OUT.mkdir(parents=True, exist_ok=True)
  files = {}
  for name, arr in layers.items():
    files[name] = OUT / f'{name}.png'
    Image.fromarray(arr, 'RGB' if arr.shape[2] == 3 else 'RGBA').save(files[name], optimize=True)

  report, comp, par = verify(src, files, info)
  print(f'source {src.shape[1]} x {src.shape[0]}')
  print(f'sky seed px {int(info["seed"].sum())}, fitted px {int(info["fit_px"].sum())}, '
        f'horizon row {info["y_low"]}')
  print('front components (px, box x0 y0 x1 y1):')
  for c in info['front_comps']:
    print(f'  {c["px"]:6d} {c["box"]}')
  print('other non-sky components of 50 px or more (px, box, touches ground):')
  for c in info['other_comps']:
    print(f'  {c["px"]:6d} {c["box"]} {c["ground"]}')
  print(f'hanging from the top or left edge but joined to mid content: {len(info["joined"])}')
  for c in info['joined']:
    print(f'  {c["px"]:6d} {c["box"]}')
  print(f'front pixels within 3 px of non-sky mid content: {info["overlap"]} '
        f'(closest gap {info["gap"]:.1f} px)')
  print(f'floating specks under 50 px left in mid: {len(info["specks"])}, '
        f'{sum(c["px"] for c in info["specks"])} px')
  for k, v in report.items():
    print(f'{k}: {v}')
  if args.preview:
    save_previews(args.preview, src, layers, info, comp, par)
  ok = report['mid_opaque_identical'] and report['mid_rgb_identical_everywhere'] and report['parallax_holes'] == 0
  return 0 if ok else 1


if __name__ == '__main__':
  sys.exit(main())
