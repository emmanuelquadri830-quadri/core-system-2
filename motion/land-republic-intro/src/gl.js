// WebGL plates: sky over a cloud deck (scene B) and the aerial land (scenes D2/D3).
// Pure function of the uniforms passed in; no state is kept between frames.

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uMode;      // 0 sky, 1 land
// sky
uniform float uCamH;
uniform float uPitch;
uniform float uTravel;
// land
uniform vec2 uCam;
uniform float uPx;        // pixels per metre
uniform float uRot;
uniform float uWisp;      // 0..1 cloud wisps crossing the lens
uniform float uWispZ;     // wisp parallax travel
uniform float uExpose;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash12(i), b = hash12(i + vec2(1, 0)), c = hash12(i + vec2(0, 1)), d = hash12(i + vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
const mat2 ROT = mat2(0.8, -0.6, 0.6, 0.8);
float fbm(vec2 p, int oct) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 7; i++) {
    if (i >= oct) break;
    s += a * vnoise(p);
    p = ROT * p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s;
}
// Anti-aliased fbm: octaves finer than ~2 px fade to their mean (fw = metres per pixel).
float fbmAA(vec2 p, float f0, int oct, float fw) {
  float s = 0.0, a = 0.5, f = f0, norm = 0.0;
  vec2 q = p * f0;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    float k = 1.0 - smoothstep(0.22, 0.5, f * fw);
    s += a * (k * vnoise(q) + (1.0 - k) * 0.5);
    norm += a;
    q = ROT * q * 2.03 + 17.1;
    f *= 2.03;
    a *= 0.5;
  }
  return s / norm;
}
float billow(vec2 p, int oct) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    s += a * (1.0 - abs(2.0 * vnoise(p) - 1.0));
    p = ROT * p * 2.07 + 9.3;
    a *= 0.5;
  }
  return s;
}

// ---------------------------------------------------------------- sky
vec3 skyColor(vec3 d) {
  float h = clamp(d.y, 0.0, 1.0);
  vec3 zen = vec3(0.17, 0.38, 0.64);
  vec3 hor = vec3(0.74, 0.83, 0.92);
  vec3 c = mix(hor, zen, pow(h, 0.5));
  vec2 q = d.xz / max(d.y, 0.04) * 0.5 + vec2(uTravel * 0.0015, 0.0);
  float ci = smoothstep(0.52, 0.86, fbm(q * vec2(0.5, 2.2), 6));
  return mix(c, vec3(0.95, 0.96, 0.99), ci * 0.4 * smoothstep(0.0, 0.3, h));
}

float cloudH(vec2 p, int oct) {
  float base = fbm(p * 0.0011 + 3.7, 5);
  float cov = smoothstep(0.36, 0.60, base);
  float heads = billow(p * 0.0045, oct);
  return cov * (0.25 + 0.75 * heads);
}

vec3 sky(vec2 frag) {
  vec2 p = (frag - 0.5 * uRes) / uRes.y;
  vec3 d = normalize(vec3(p.x, p.y, 1.1));
  float cp = cos(uPitch), sp = sin(uPitch);
  d = vec3(d.x, d.y * cp - d.z * sp, d.y * sp + d.z * cp);
  vec3 col = skyColor(d);
  if (d.y < 0.0) {
    float s = uCamH / -d.y;
    vec2 xz = vec2(d.x * s, d.z * s + uTravel);
    int oct = s < 2500.0 ? 6 : (s < 6000.0 ? 5 : 4);
    float e = max(3.0, s * 0.004);
    float h = cloudH(xz, oct);
    float hx = cloudH(xz + vec2(e, 0.0), oct) - h;
    float hz = cloudH(xz + vec2(0.0, e), oct) - h;
    vec3 n = normalize(vec3(-hx * 140.0 / e, 1.0, -hz * 140.0 / e));
    vec3 L = normalize(vec3(-0.35, 0.62, 0.70));
    float dif = clamp(dot(n, L) * 0.65 + 0.35, 0.0, 1.0);
    // self-shadow: is the deck higher a little way toward the sun?
    float occ = cloudH(xz + L.xz * 60.0, 4) - h;
    float shadow = 1.0 - 0.55 * smoothstep(0.0, 0.25, occ);
    float ao = 0.55 + 0.45 * smoothstep(0.0, 0.9, h);
    vec3 lit = vec3(1.0, 0.985, 0.96);
    vec3 shd = vec3(0.52, 0.61, 0.74);
    vec3 cloud = mix(shd, lit, dif * shadow) * ao;
    cloud = mix(cloud, vec3(1.0), smoothstep(0.75, 1.0, h) * 0.25);
    vec3 deep = mix(vec3(0.16, 0.27, 0.40), vec3(0.24, 0.36, 0.48), fbm(xz * 0.0008, 3));
    float a = smoothstep(0.03, 0.22, h);
    vec3 surf = mix(deep, cloud, a);
    float fog = 1.0 - exp(-s * 0.00022);
    col = mix(surf, skyColor(vec3(d.x, 0.015, d.z)), clamp(fog, 0.0, 1.0));
  }
  return col;
}

// ---------------------------------------------------------------- land
// World units are metres, y down (same as the SVG survey overlay).
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }

// Estate layout (illustrative): 5 columns of 20 m plots, rows 25 m deep, 8 m roads.
// Returns the road mask in .x and the distance to the nearest road centreline in .y.
vec2 roads(vec2 w, float fw) {
  float inside = 1.0 - smoothstep(-2.0, 2.0, sdBox(w, vec2(58.0, 62.0)));
  float dh = min(abs(w.y), abs(abs(w.y) - 58.0));
  float dv = abs(abs(w.x) - 54.0);
  float ay = 9.0 * sin(w.x * 0.011 + 0.6) * smoothstep(-58.0, -160.0, w.x);
  float da = abs(w.y - ay) + (w.x > -54.0 ? 1e3 : 0.0);
  float edgeN = (vnoise(w * 0.7) - 0.5) * 0.9;
  float dist = min(min(dh, dv) + (inside > 0.5 ? 0.0 : 1e3), da);
  float aa = max(0.3, fw);
  float m = 1.0 - smoothstep(3.6 - aa + edgeN, 4.0 + aa + edgeN, dist);
  return vec2(m, dist);
}

vec3 land(vec2 frag) {
  vec2 sp = vec2(frag.x, uRes.y - frag.y);
  vec2 c = sp - 0.5 * uRes;
  float cr = cos(uRot), sr = sin(uRot);
  vec2 w = uCam + mat2(cr, sr, -sr, cr) * c / uPx;
  float fw = 1.0 / uPx;                        // metres per pixel
  float lod = 1.0 - smoothstep(0.35, 1.2, fw);  // are metre-scale features resolvable?

  // --- ground cover: derived savanna mosaic
  float v = fbmAA(w + 31.0, 0.0028, 6, fw);     // bush density
  float g = fbmAA(w + 7.0, 0.011, 6, fw);       // grass greenness
  float speck = fbmAA(w + 2.0, 0.55, 4, fw);
  vec3 dryG = vec3(0.56, 0.53, 0.37);
  vec3 grnG = vec3(0.41, 0.46, 0.25);
  vec3 bushC = vec3(0.25, 0.31, 0.16);
  vec3 col = mix(dryG, grnG, smoothstep(0.35, 0.65, g));
  col = mix(col, bushC, smoothstep(0.42, 0.68, v));
  col *= 0.9 + 0.2 * speck;

  // --- estate clearing
  float edgeN = (fbmAA(w, 0.05, 4, fw) - 0.5) * 10.0;
  float cleared = 1.0 - smoothstep(-1.0, 1.0, sdBox(w, vec2(58.0, 62.0)) + edgeN);
  vec2 cell = floor((w + vec2(50.0, 0.0)) / vec2(20.0, 25.0));
  float ph = hash12(cell + 3.0);                // per-plot variation
  vec3 soil = mix(vec3(0.54, 0.40, 0.30), vec3(0.64, 0.50, 0.37), fbmAA(w + 5.0, 0.045, 6, fw));
  soil *= 0.92 + 0.16 * fbmAA(w + 9.0, 0.9, 3, fw);
  float cover = 0.25 + 0.5 * ph;
  float regrow = smoothstep(1.0 - cover - 0.10, 1.0 - cover + 0.10, 0.6 * fbmAA(w + 13.0, 0.06, 5, fw) + 0.4 * fbmAA(w + 21.0, 0.35, 5, fw));
  vec3 regC = mix(vec3(0.46, 0.47, 0.28), vec3(0.55, 0.53, 0.36), fbmAA(w, 0.3, 3, fw));
  vec3 site = mix(soil, regC, regrow * 0.85);
  float st = hash12(floor(w * 2.5));            // stones and debris at metre scale
  site *= 1.0 + lod * (step(0.985, st) * 0.25 - step(st, 0.012) * 0.25);
  col = mix(col, site, cleared);

  // --- trees and shrubs: cellular, irregular crowns, shadows cast away from the light
  vec2 Ld = normalize(vec2(-0.55, -0.83));      // light from screen top-left
  float shadowAcc = 0.0;
  vec3 crownCol = vec3(0.0);
  float crownA = 0.0, crownTop = -1.0;
  for (int layer = 0; layer < 2; layer++) {
    float cs = layer == 0 ? 11.0 : 4.5;
    vec2 gi = floor(w / cs);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 cl = gi + vec2(float(i), float(j));
      vec2 o = hash22(cl + float(layer) * 37.0);
      vec2 cp = (cl + 0.12 + 0.76 * o) * cs;
      float dens = fbm(cp * 0.0028 + 31.0, 4);
      float inSite = 1.0 - smoothstep(-6.0, 2.0, sdBox(cp, vec2(58.0, 62.0)));
      float p = layer == 0 ? smoothstep(0.38, 0.62, dens) * 0.9 : 0.18 + 0.4 * smoothstep(0.3, 0.6, dens);
      p *= 1.0 - inSite * (layer == 0 ? 0.985 : 0.96);
      float r = hash12(cl + 11.0 + float(layer));
      if (r > p) continue;
      float rad = layer == 0 ? 3.0 + 4.2 * pow(hash12(cl + 5.0), 1.5) : 0.8 + 1.1 * hash12(cl + 6.0);
      vec2 dv = w - cp;
      float ang = atan(dv.y, dv.x);
      float lump = 1.0 + 0.16 * (vnoise(vec2(ang * 2.2, hash12(cl) * 50.0)) - 0.5) + 0.08 * sin(ang * 5.0 + r * 20.0);
      float fluff = (fbmAA(w + cp * 1.7, 0.9, 3, fw) - 0.5) * 0.32;
      float dd = length(dv) / (rad * lump) - fluff;
      float aa = fw / rad + 0.02;
      float m = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, dd);
      float sd = length(w - cp + Ld * rad * 0.75) / (rad * lump * 1.05);
      shadowAcc = max(shadowAcc, 1.0 - smoothstep(0.85, 1.25, sd));
      if (m > 0.0 && rad > crownTop) {
        float q = clamp(dd, 0.0, 1.0);
        vec3 nrm = normalize(vec3(normalize(dv + 1e-4) * q, sqrt(max(0.0, 1.0 - q * q))));
        vec3 L3 = normalize(vec3(Ld, 0.75));
        float leaf = fbmAA(w + cp, 0.8, 5, fw);
        float lit = 0.38 + 0.8 * max(dot(nrm, L3), 0.0);
        lit *= 0.78 + 0.44 * leaf;                     // leaf clumps catch the light
        vec3 base = layer == 0 ? mix(vec3(0.19, 0.28, 0.12), vec3(0.29, 0.38, 0.17), hash12(cl + 2.0))
                               : vec3(0.33, 0.40, 0.20);
        crownCol = base * lit;
        crownA = m;
        crownTop = rad;
      }
    }
  }
  col *= 1.0 - 0.34 * shadowAcc;

  // --- roads: dusty laterite, two tyre tracks
  vec2 rd = roads(w, fw);
  vec3 lat = mix(vec3(0.70, 0.52, 0.38), vec3(0.78, 0.60, 0.45), fbmAA(w + 1.0, 0.12, 5, fw));
  float track = 1.0 - smoothstep(0.35, 0.9, abs(rd.y - 1.7));
  lat *= 1.0 - 0.10 * track * lod;
  col = mix(col, lat, rd.x);

  col = mix(col, crownCol, crownA);

  // --- gentle relief, cloud shadows, haze with altitude
  float hgt = fbm(w * 0.0022, 4);
  float hx = fbm((w + vec2(5.0, 0.0)) * 0.0022, 4) - hgt;
  float hy = fbm((w + vec2(0.0, 5.0)) * 0.0022, 4) - hgt;
  col *= 1.0 + clamp((-hx - hy) * 18.0, -0.10, 0.10);
  float csh = smoothstep(0.5, 0.75, fbm(w * 0.0035 + vec2(uWispZ * 0.4, 0.1), 5));
  col *= 1.0 - 0.22 * csh * uWisp;
  float haze = clamp(0.30 - uPx * 0.04, 0.0, 0.30);
  col = mix(col, vec3(0.70, 0.75, 0.78), haze);

  // grade: gentle S-curve, warm highlights
  col = clamp(col, 0.0, 1.0);
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.35);
  col *= vec3(1.03, 1.0, 0.97);

  // wisps between lens and ground
  if (uWisp > 0.0) {
    vec2 q = c / uRes.y;
    float k = 1.0 / (1.0 + uWispZ * 2.2);           // wisps grow as we fall through them
    vec2 qq = q * 0.9 * k + vec2(0.0, -uWispZ * 0.6) + 4.0;
    float wsp = fbm(qq, 5);
    float a = smoothstep(0.38, 0.72, wsp) * uWisp;
    float shade = 0.86 + 0.14 * smoothstep(0.4, 0.8, fbm(qq * 1.7 + 2.0, 4));
    col = mix(col, vec3(0.96, 0.97, 0.99) * shade, a);
  }
  // soft lens falloff
  col *= 1.0 - 0.16 * pow(clamp(length(c / uRes.y) * 1.25, 0.0, 1.0), 2.5);
  return col * uExpose;
}

void main() {
  vec3 col = uMode < 0.5 ? sky(gl_FragCoord.xy) : land(gl_FragCoord.xy);
  // dither against banding in the encode
  float dn = hash12(gl_FragCoord.xy) - 0.5;
  gl_FragColor = vec4(col + dn / 255.0, 1.0);
}
`;

export function createGL(canvas) {
  const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, alpha: false });
  if (!gl) throw new Error('WebGL unavailable');
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  for (const n of ['uRes', 'uMode', 'uCamH', 'uPitch', 'uTravel', 'uCam', 'uPx', 'uRot', 'uWisp', 'uWispZ', 'uExpose']) {
    U[n] = gl.getUniformLocation(prog, n);
  }
  gl.viewport(0, 0, canvas.width, canvas.height);

  return function draw(s) {
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uMode, s.mode);
    gl.uniform1f(U.uCamH, s.camH ?? 400);
    gl.uniform1f(U.uPitch, s.pitch ?? 0.3);
    gl.uniform1f(U.uTravel, s.travel ?? 0);
    gl.uniform2f(U.uCam, s.cam?.[0] ?? 0, s.cam?.[1] ?? 0);
    gl.uniform1f(U.uPx, s.px ?? 1);
    gl.uniform1f(U.uRot, s.rot ?? 0);
    gl.uniform1f(U.uWisp, s.wisp ?? 0);
    gl.uniform1f(U.uWispZ, s.wispZ ?? 0);
    gl.uniform1f(U.uExpose, s.expose ?? 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  };
}
