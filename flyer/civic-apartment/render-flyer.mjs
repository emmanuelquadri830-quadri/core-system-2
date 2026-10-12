// node render-flyer.mjs
// Prints flyer.html to out/civic-apartment-flyer-A4-bleed.pdf (vector text,
// 216 x 303 mm: A4 plus 3 mm bleed) and out/civic-apartment-flyer-A4.png
// (the trimmed A4 at 300 dpi, 2480 x 3508).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const TYPES = { '.html': 'text/html', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] ?? 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const { chromium } = createRequire(path.join(execSync('npm root -g').toString().trim(), 'x.js'))('playwright');
const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });

const MM = 96 / 25.4; // CSS px per mm
const page = await browser.newPage({ viewport: { width: Math.ceil(216 * MM), height: Math.ceil(303 * MM) }, deviceScaleFactor: 300 / 96 });
page.on('console', (m) => m.type() === 'error' && console.error('[page]', m.text()));
await page.goto(`http://127.0.0.1:${server.address().port}/flyer.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
await page.pdf({ path: path.join(ROOT, 'out/civic-apartment-flyer-A4-bleed.pdf'), width: '216mm', height: '303mm', printBackground: true, preferCSSPageSize: true });
await page.screenshot({ path: path.join(ROOT, 'out/civic-apartment-flyer-A4.png'), clip: { x: 3 * MM, y: 3 * MM, width: 210 * MM, height: 297 * MM } });
await browser.close();
server.close();
console.log('wrote out/civic-apartment-flyer-A4-bleed.pdf and out/civic-apartment-flyer-A4.png');
