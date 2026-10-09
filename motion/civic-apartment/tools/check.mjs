// Checks the film against the brief's rules by watching every piece of text
// it draws. For each frame sampled, records the text, its font and where it
// lands on screen (through the canvas transform), then reports:
//   - any font that is not Red Hat Display
//   - any text at rest outside the safe area
//   - every distinct string on screen, to read against the property facts
// Text that is still sliding in under a mask is ignored for the safe-area
// test by sampling the frames where each scene's type is at rest.
//   node tools/check.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  return createRequire(path.join(execSync('npm root -g').toString().trim(), 'noop.js'))('playwright');
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] ?? 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto(`http://127.0.0.1:${server.address().port}/film.html`);
await page.evaluate(() => window.ready);

// Frames where every scene's type has landed and is not yet leaving.
const REST = [1.6, 2.2, 4.45, 6.6, 7.6, 11.35, 14.0];
const ALL = Array.from({ length: 450 }, (_, f) => f / 30);

const result = await page.evaluate(async ({ REST, ALL }) => {
  const SAFE = { left: 90, right: 1080 - 160, top: 260, bottom: 1920 - 400 };
  const log = [];
  const orig = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...rest) {
    if (this.canvas.width === 1080 && this.globalAlpha > 0.01) {
      const m = this.measureText(text);
      const align = this.textAlign;
      const x0 = align === 'right' || align === 'end' ? x - m.width : align === 'center' ? x - m.width / 2 : x;
      const T = this.getTransform();
      const pts = [[x0, y - m.actualBoundingBoxAscent], [x0 + m.width, y + m.actualBoundingBoxDescent]].map(([px, py]) => [T.a * px + T.c * py + T.e, T.b * px + T.d * py + T.f]);
      log.push({ text: String(text), font: this.font, box: [Math.min(pts[0][0], pts[1][0]), Math.min(pts[0][1], pts[1][1]), Math.max(pts[0][0], pts[1][0]), Math.max(pts[0][1], pts[1][1])] });
    }
    return orig.call(this, text, x, y, ...rest);
  };
  const fonts = new Set();
  const strings = new Set();
  for (const t of ALL) {
    log.length = 0;
    await window.seek(t);
    for (const e of log) { fonts.add(e.font.replace(/^\d+ \d+px /, '')); strings.add(e.text); }
  }
  const outside = [];
  for (const t of REST) {
    log.length = 0;
    await window.seek(t);
    for (const e of log) {
      const [x0, y0, x1, y1] = e.box;
      if (x0 < SAFE.left - 1 || x1 > SAFE.right + 1 || y0 < SAFE.top - 1 || y1 > SAFE.bottom + 1) outside.push({ t, text: e.text, box: e.box.map(Math.round) });
    }
  }
  return { fonts: [...fonts], strings: [...strings], outside };
}, { REST, ALL });

console.log('fonts used:', result.fonts.join(' | '));
console.log('text on screen:');
for (const s of result.strings) console.log('  ' + JSON.stringify(s));
console.log(result.outside.length ? 'OUTSIDE THE SAFE AREA:' : 'no text outside the safe area at rest');
for (const o of result.outside) console.log(`  ${o.t}s ${JSON.stringify(o.text)} ${o.box.join(',')}`);
await browser.close();
server.close();
process.exitCode = result.outside.length || result.fonts.some((f) => !/Red Hat Display/.test(f)) ? 1 : 0;
