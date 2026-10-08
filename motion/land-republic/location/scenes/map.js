// Discovery and journey (beats 0-8.5): a 3D camera over real OpenStreetMap
// coastline, from the Bight of Benin down to Lekki Ajah.
//
// One 4x4 matrix (DOMMatrix) drives everything: the canvas map is projected
// vertex by vertex through it, the ground text uses it as a CSS matrix3d, and
// every upright label is placed by transforming its ground point with it. So
// nothing drifts against the land.
//
// The coastline data is about 1 km detailed, honest at regional scale and
// crude at street scale, so the camera never shows it closer than ~40 km:
// past that the map defocuses and the real aerial opens through a lens.

import { el, place, spring, track, clamp } from '../../film/engine.js';
import { PLACES, ROUTE } from '../timeline.mjs';

const R = 6378.137;
const merc = (lon, lat) => [R * (lon * Math.PI) / 180, -R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];


// The camera, shared with the reveal scene so the lens opens exactly on the
// pin. Zoom moves in log space so the descent decelerates evenly at every
// altitude.
export function camera(ctx) {
  const { W, H, T, L } = ctx;
  const A = merc(PLACES.ajah.lon, PLACES.ajah.lat);
  const diag = Math.hypot(W, H);
  const DIVE = [12, 7.2, 1]; // critically damped, long and heavy
  const camAt = (t) => {
    const lw = track(t, [
      [0, Math.log(1700)],
      [0, Math.log(900), 'drift'],
      [T(4) - 0.2, Math.log(115), DIVE],
      [T(7.33), Math.log(60), 'glide'],
    ]);
    const mid = merc(3.48, 6.455);
    const cx = track(t, [[0, merc(3.0, 4.6)[0]], [0, merc(3.2, 5.5)[0], 'drift'], [T(4) - 0.2, mid[0], DIVE], [T(7.33), A[0], 'glide']]);
    const cy = track(t, [[0, merc(3.0, 4.6)[1]], [0, merc(3.2, 5.5)[1], 'drift'], [T(4) - 0.2, mid[1], DIVE], [T(7.33), A[1], 'glide']]);
    const tilt = track(t, [[0, 26], [0, 34, 'drift'], [T(4) - 0.2, 50, DIVE], [T(7.33), 38, 'glide']]);
    const head = track(t, [[0, -9], [0, -4, 'drift'], [T(4) - 0.2, 5, DIVE]]);
    return { cx, cy, s: diag / Math.exp(lw), tilt, head };
  };
  const P = H * 1.6;
  const persp = new DOMMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1 / P, 0, 0, 0, 1]);
  const matrix = (c) =>
    new DOMMatrix()
      .translate(W / 2, H * L({ '16x9': 0.56, '1x1': 0.56, '9x16': 0.6 }))
      .multiply(persp)
      .rotate(c.tilt, 0, 0)
      .rotate(0, 0, c.head)
      .scale(c.s, c.s, 1)
      .translate(-c.cx, -c.cy);

  const project = (t, lon, lat) => {
    const M = matrix(camAt(t));
    const [x, y] = merc(lon, lat);
    const p = M.transformPoint(new DOMPoint(x, y, 0, 1));
    return [p.x / p.w, p.y / p.w];
  };
  return { camAt, matrix, project };
}

export default function map(ctx) {
  const { stage, W, H, AR, T, L, cueT, geo } = ctx;
  const root = el('div', 'scene map', stage);
  root.style.background = '#0A131D';
  const DPR = 1;
  const canvas = el('canvas', '', root);
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  Object.assign(canvas.style, { position: 'absolute', left: '0px', top: '0px', width: `${W}px`, height: `${H}px` });
  const g = canvas.getContext('2d');

  // Horizon haze and edge falloff, part of the atmosphere, not the type.
  const haze = el('div', 'layer', root);
  Object.assign(haze.style, { width: `${W}px`, height: `${H}px`, background: 'linear-gradient(180deg, rgba(150,178,214,0.20) 0%, rgba(150,178,214,0.06) 22%, rgba(0,0,0,0) 45%), radial-gradient(ellipse at 50% 60%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)' });

  // Ground text: lies on the sea south of Lagos and tilts with it.
  const groundText = el('div', 'layer', root);
  const gtSize = 64;
  Object.assign(groundText.style, { transformOrigin: '0 0', font: `500 ${gtSize}px var(--display)`, letterSpacing: '0.24em', color: 'rgba(255,255,255,0.86)', whiteSpace: 'nowrap', lineHeight: '1.15' });
  const gl1 = el('div', '', groundText, { text: 'LOCATION' });
  const gl2 = el('div', '', groundText, { text: 'CHANGES EVERYTHING.' });
  [gl1, gl2].forEach((n) => Object.assign(n.style, { position: 'relative', overflow: 'hidden' }));
  const GT = merc(L({ '16x9': 0.45, '1x1': 1.25, '9x16': 1.75 }), 5.3); // world anchor of the text block (open sea)
  const GT_KM = L({ '16x9': 0.62, '1x1': 0.46, '9x16': 0.36 }); // km per text pixel

  // Upright labels pinned to ground points.
  const mkLabel = (name, sub) => {
    const box = el('div', 'layer', root);
    const dot = el('div', '', box);
    Object.assign(dot.style, { position: 'absolute', left: '-6px', top: '-6px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--white)' });
    const stem = el('div', '', box);
    Object.assign(stem.style, { position: 'absolute', left: '-1px', bottom: '0px', width: '2px', background: 'rgba(255,255,255,0.8)', transformOrigin: '50% 100%' });
    const text = el('div', '', box);
    Object.assign(text.style, { position: 'absolute', left: '14px', whiteSpace: 'nowrap', font: `500 ${L({ '16x9': 38, '1x1': 36, '9x16': 42 })}px var(--ui)`, letterSpacing: '0.2em', color: 'var(--white)' });
    text.textContent = name;
    let subEl = null;
    if (sub) {
      subEl = el('div', '', text, { text: sub });
      Object.assign(subEl.style, { font: `400 ${L({ '16x9': 24, '1x1': 23, '9x16': 26 })}px var(--ui)`, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.62)', marginTop: '6px' });
    }
    return { box, dot, stem, text };
  };
  const labels = [
    { ...mkLabel('LAGOS'), p: PLACES.lagos, cue: 'label-lagos', h: 120, left: true },
    { ...mkLabel('LEKKI'), p: PLACES.lekki, cue: 'label-lekki', h: 50, left: true },
    { ...mkLabel('LEKKI AJAH', '6.47° N   3.57° E'), p: PLACES.ajah, cue: 'pin-ajah', h: AR === '9x16' ? 230 : 150, left: AR === '9x16' },
  ];
  // Pin pulse at Ajah.
  const pulse = el('div', 'layer', root);
  Object.assign(pulse.style, { width: '120px', height: '120px', marginLeft: '-60px', marginTop: '-60px', borderRadius: '50%', border: '3px solid var(--accent)' });
  const core = el('div', 'layer', root);
  Object.assign(core.style, { width: '22px', height: '22px', marginLeft: '-11px', marginTop: '-11px', borderRadius: '50%', background: 'var(--accent)', border: '3px solid var(--white)' });

  const land = geo.land.map((r) => Float64Array.from(r));
  const water = geo.water.map((r) => Float64Array.from(r));
  const routeM = ROUTE.map(([lo, la]) => merc(lo, la));
  const A = merc(PLACES.ajah.lon, PLACES.ajah.lat);
  const diag = Math.hypot(W, H);

  const { camAt, matrix } = camera(ctx);

  return {
    id: 'map',
    root,
    from: 0,
    to: T(11.4),
    camAt,
    matrix,
    update(t) {
      const c = camAt(t);
      const M = matrix(c);
      const m = [M.m11, M.m12, M.m14, M.m21, M.m22, M.m24, M.m41, M.m42, M.m44];
      const proj = (x, y) => {
        const w = m[2] * x + m[5] * y + m[8];
        return [(m[0] * x + m[3] * y + m[6]) / w, (m[1] * x + m[4] * y + m[7]) / w, w];
      };

      // ---------------------------------------------- the map
      const ocean = g.createLinearGradient(0, 0, 0, H);
      ocean.addColorStop(0, '#132536');
      ocean.addColorStop(1, '#07111C');
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      g.fillStyle = ocean;
      g.fillRect(0, 0, W, H);
      const EPS = 0.08;
      const ring = (r) => {
        // project with near-plane clipping in homogeneous space
        const n = r.length / 2;
        let started = false;
        let prev = null;
        for (let i = 0; i <= n; i++) {
          const k = (i % n) * 2;
          const x = r[k], y = r[k + 1];
          const w = m[2] * x + m[5] * y + m[8];
          const cur = { x, y, w };
          if (prev) {
            if ((prev.w >= EPS) !== (w >= EPS)) {
              const f = (EPS - prev.w) / (w - prev.w);
              const ix = prev.x + (x - prev.x) * f, iy = prev.y + (y - prev.y) * f;
              const [sx, sy] = proj(ix, iy);
              if (!started) { g.moveTo(sx, sy); started = true; } else g.lineTo(sx, sy);
            }
          }
          if (w >= EPS) {
            const sx = (m[0] * x + m[3] * y + m[6]) / w, sy = (m[1] * x + m[4] * y + m[7]) / w;
            if (!started) { g.moveTo(sx, sy); started = true; } else g.lineTo(sx, sy);
          }
          prev = cur;
        }
        g.closePath();
      };
      g.beginPath();
      for (const r of land) ring(r);
      g.fillStyle = '#2B3238';
      g.fill('evenodd');
      g.beginPath();
      for (const r of water) ring(r);
      g.fillStyle = '#0F1E2C';
      g.fill('evenodd');
      g.beginPath();
      for (const r of land) ring(r);
      g.strokeStyle = 'rgba(224,234,246,0.38)';
      g.lineWidth = 1.3;
      g.stroke();

      // graticule, one degree
      g.beginPath();
      for (let lon = -1; lon <= 9; lon++) {
        for (let lat = 3; lat < 10; lat += 0.25) {
          const [a, b] = [merc(lon, lat), merc(lon, lat + 0.25)];
          const p1 = proj(...a), p2 = proj(...b);
          if (p1[2] > EPS && p2[2] > EPS) { g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); }
        }
      }
      for (let lat = 3; lat <= 10; lat++) {
        for (let lon = -1; lon < 9; lon += 0.25) {
          const [a, b] = [merc(lon, lat), merc(lon + 0.25, lat)];
          const p1 = proj(...a), p2 = proj(...b);
          if (p1[2] > EPS && p2[2] > EPS) { g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); }
        }
      }
      g.strokeStyle = 'rgba(255,255,255,0.055)';
      g.lineWidth = 1;
      g.stroke();

      // route, drawn along the peninsula from Lagos to Ajah
      const tr = cueT('route');
      const rp = clamp(spring(t - tr, 'glide'), 0, 1);
      if (t >= tr) {
        const pts = routeM.map(([x, y]) => proj(x, y));
        let total = 0;
        const seg = [];
        for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); total += d; }
        let left = total * rp;
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        let head = pts[0];
        for (let i = 1; i < pts.length && left > 0; i++) {
          const f = Math.min(1, left / seg[i - 1]);
          head = [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
          g.lineTo(head[0], head[1]);
          left -= seg[i - 1];
        }
        g.strokeStyle = '#3B82F0';
        g.lineWidth = L({ '16x9': 5, '1x1': 5, '9x16': 6 });
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.stroke();
      }
      // depth of field as the camera passes the honest limit of the data
      const dof = clamp(spring(t - cueT('pin-ajah') - 0.2, 'glide'), 0, 1) * 7;
      canvas.style.filter = dof > 0.05 ? `blur(${dof.toFixed(2)}px)` : 'none';

      // ---------------------------------------------- ground text
      const tg = new DOMMatrix().multiply(M).translate(GT[0], GT[1]).scale(GT_KM, GT_KM, 1);
      groundText.style.transform = tg.toString();
      [gl1, gl2].forEach((n, i) => {
        const k = clamp(spring(t - cueT(i ? 'line-2' : 'line-1'), 'soft'), 0, 1);
        n.style.clipPath = `inset(0 ${((1 - k) * 100).toFixed(2)}% 0 0)`;
      });
      place(groundText, { show: t < T(4) - 0.15 });
      groundText.style.transform = tg.toString();

      // ---------------------------------------------- labels
      for (const lb of labels) {
        const [x, y] = merc(lb.p.lon, lb.p.lat);
        const [sx, sy, w] = proj(x, y);
        const t0 = cueT(lb.cue);
        const k = clamp(spring(t - t0, 'snap'), 0, 1);
        const vis = t >= t0 && w > EPS && t < T(7.33) + (lb.cue === 'pin-ajah' ? 0.2 : 0);
        place(lb.box, { x: sx, y: sy, show: vis });
        lb.stem.style.height = `${(lb.h * k).toFixed(1)}px`;
        lb.text.style.top = `${-lb.h - 18}px`;
        if (lb.left) { lb.text.style.left = 'auto'; lb.text.style.right = '14px'; }
        lb.text.style.clipPath = `inset(-10px ${((1 - clamp(spring(t - t0 - 0.12, 'soft'), 0, 1)) * 100).toFixed(1)}% -10px 0)`;
        lb.dot.style.visibility = lb.cue === 'pin-ajah' ? 'hidden' : 'inherit';
      }
      const [ax, ay] = proj(A[0], A[1]);
      const tp = cueT('pin-ajah');
      const kp = spring(t - tp, 'bounce');
      place(core, { x: ax, y: ay, s: clamp(kp, 0, 1.3), show: t >= tp && t < T(7.6) });
      const ph = ((t - tp) % 1.2) / 1.2;
      pulse.style.borderWidth = `${(3 * (1 - ph)).toFixed(2)}px`;
      place(pulse, { x: ax, y: ay, s: 0.2 + 1.1 * spring(ph * 1.2, 'soft'), show: t >= tp && t < T(7.6) });
    },
  };
}
