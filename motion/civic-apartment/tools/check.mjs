// node tools/check.mjs [--step 1]
// Seeks every frame and records each piece of text the film draws: its string,
// font and visible ink box (clipped by the masks in force when it was drawn).
// Then checks the rules that can be checked mechanically:
//   - 450 frames, 15.0 s
//   - no visible text outside the safe area
//   - every font is Red Hat Display, and no character is missing from it
//   - the final 1.5 s are identical frames
//   - frames are a pure function of time (out-of-order seeks match)
// It prints every distinct string drawn so the copy can be read against the facts.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stepArg = process.argv.indexOf('--step');
const STEP = stepArg > 0 ? Number(process.argv[stepArg + 1]) : 1;
const SAFE = { left: 90, right: 920, top: 260, bottom: 1520 };

const { chromium } = createRequire(path.join(execSync('npm root -g').toString().trim(), 'x.js'))('playwright');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2',
  '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] ?? 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));

// Instrumentation, injected before the film loads. It tracks rectangular clip
// regions through save/restore and records text ink boxes in screen space.
const instrument = () => {
  const P = CanvasRenderingContext2D.prototype;
  const state = new WeakMap();
  const st = (ctx) => {
    if (!state.has(ctx)) state.set(ctx, { clip: null, stack: [], pending: [] });
    return state.get(ctx);
  };
  const box = (ctx, x, y, w, h) => {
    const m = ctx.getTransform();
    const pts = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([px, py]) => [m.a * px + m.c * py + m.e, m.b * px + m.d * py + m.f]);
    return { x0: Math.min(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), x1: Math.max(...pts.map((p) => p[0])), y1: Math.max(...pts.map((p) => p[1])) };
  };
  const inter = (a, b) => (!a ? b : !b ? a : { x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) });
  const wrap = (name, fn) => { const orig = P[name]; P[name] = function (...args) { fn(this, args); return orig.apply(this, args); }; };
  wrap('save', (ctx) => { const s = st(ctx); s.stack.push(s.clip); });
  wrap('restore', (ctx) => { const s = st(ctx); s.clip = s.stack.length ? s.stack.pop() : null; });
  wrap('beginPath', (ctx) => { st(ctx).pending = []; });
  wrap('rect', (ctx, [x, y, w, h]) => { st(ctx).pending.push(box(ctx, x, y, w, h)); });
  wrap('roundRect', (ctx, [x, y, w, h]) => { st(ctx).pending.push(box(ctx, x, y, w, h)); });
  wrap('clip', (ctx) => {
    const s = st(ctx);
    if (!s.pending.length) return;
    const u = s.pending.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }));
    s.clip = inter(s.clip, u);
  });
  window.__text = [];
  wrap('fillText', (ctx, [text, x, y]) => {
    if (ctx.globalAlpha <= 0.01) return;
    const m = ctx.measureText(text);
    let b = box(ctx, x - m.actualBoundingBoxLeft, y - m.actualBoundingBoxAscent,
      m.actualBoundingBoxLeft + m.actualBoundingBoxRight, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
    b = inter(st(ctx).clip, b);
    if (b.x1 - b.x0 < 0.5 || b.y1 - b.y0 < 0.5) return; // fully masked
    if (b.x1 < 0 || b.y1 < 0 || b.x0 > 1080 || b.y0 > 1920) return; // off the canvas
    window.__text.push({ text, font: ctx.font, ...b });
  });
};

const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.addInitScript(instrument);
await page.goto(`http://127.0.0.1:${server.address().port}/film.html`);
await page.evaluate(() => window.ready);
const film = await page.evaluate(() => window.FILM);

const frames = Math.round(film.DURATION * film.FPS);
const issues = [];
const strings = new Map();
const fonts = new Set();
const chars = new Set();
const hashes = [];
for (let f = 0; f < frames; f += STEP) {
  const recs = await page.evaluate(async (t) => { window.__text = []; await window.seek(t); return window.__text; }, f / film.FPS);
  for (const r of recs) {
    const tag = `${r.text}`;
    if (!strings.has(tag)) strings.set(tag, f);
    fonts.add(r.font.replace(/^\d+ \d+(\.\d+)?px /, ''));
    for (const c of r.text) chars.add(c);
    const out = r.x0 < SAFE.left - 0.5 || r.x1 > SAFE.right + 0.5 || r.y0 < SAFE.top - 0.5 || r.y1 > SAFE.bottom + 0.5;
    if (out) issues.push(`frame ${f}: "${r.text}" ink box ${[r.x0, r.y0, r.x1, r.y1].map(Math.round).join(',')} outside the safe area`);
  }
  if (f >= frames - 46) {
    const png = await page.locator('#film').screenshot();
    hashes.push([f, crypto.createHash('sha1').update(png).digest('hex')]);
  }
  if (f % 30 === 0) process.stdout.write(`\rframe ${f}/${frames}`);
}
process.stdout.write('\n');

// Out-of-order seeks must reproduce the same frames.
const probe = [449, 12, 230, 77, 340, 160, 405];
const first = {};
let pure = true;
for (const f of [...probe, ...probe.slice().reverse()]) {
  await page.evaluate((t) => window.seek(t), f / film.FPS);
  const h = crypto.createHash('sha1').update(await page.locator('#film').screenshot()).digest('hex');
  if (first[f] && first[f] !== h) pure = false;
  first[f] ??= h;
}
await browser.close();
server.close();

// Glyph coverage: every character drawn must exist in the bundled Red Hat Display.
const fontFiles = fs.readdirSync(path.join(ROOT, 'assets/fonts')).filter((f) => f.endsWith('.woff2')).map((f) => path.join(ROOT, 'assets/fonts', f));
const missing = execFileSync('python3', ['-c', `
import sys, json
from fontTools.ttLib import TTFont
have = set()
for f in sys.argv[2:]:
    have |= set(TTFont(f).getBestCmap().keys())
print(json.dumps([c for c in json.loads(sys.argv[1]) if ord(c) not in have]))
`, JSON.stringify([...chars]), ...fontFiles]).toString().trim();

const holdFrames = hashes.filter(([f]) => f >= 405);
const holdStill = holdFrames.length > 0 && new Set(holdFrames.map(([, h]) => h)).size === 1;

console.log(`frames: ${frames} (${frames / film.FPS} s), checked every ${STEP}`);
console.log(`fonts used: ${[...fonts].join(' | ')}`);
console.log(`characters missing from Red Hat Display: ${missing}`);
console.log(`final hold, frames 405 to ${frames - 1}: ${holdStill ? 'identical' : 'NOT identical'} (${holdFrames.length} frames compared)`);
console.log(`out-of-order seeks: ${pure ? 'identical' : 'MISMATCH'}`);
console.log(`text outside the safe area: ${issues.length} records`);
const groups = new Map();
for (const i of issues) {
  const [, f, text, box] = /frame (\d+): "(.*)" ink box (\S+) outside/.exec(i);
  const g = groups.get(text) ?? { frames: [], boxes: [] };
  g.frames.push(Number(f)); g.boxes.push(box);
  groups.set(text, g);
}
for (const [text, g] of groups) {
  console.log(`  "${text}": frames ${Math.min(...g.frames)} to ${Math.max(...g.frames)} (${g.frames.length} records), e.g. ${g.boxes[0]}`);
}
console.log('distinct strings drawn (first frame):');
for (const [s, f] of strings) console.log(`  ${String(f).padStart(3)}  ${s}`);
