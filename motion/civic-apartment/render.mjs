// node render.mjs [--from 0] [--to 15] [--out out/film.mp4] [--audio audio/mix.wav]
//                 [--still 1.2 --out out/still.png]
// Seeks the film frame by frame in headless Chromium and pipes PNGs to ffmpeg:
// H.264, yuv420p, CRF 16, BT.709 tags, faststart.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true]);
    return acc;
  }, []),
);

async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const globalRoot = execSync('npm root -g').toString().trim();
  return createRequire(path.join(globalRoot, 'noop.js'))('playwright');
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

function serve() {
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] ?? 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

const server = await serve();
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-lcd-text'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('console', (m) => m.type() === 'error' && console.error('[page]', m.text()));
page.on('pageerror', (e) => { console.error('[page]', e.message); process.exitCode = 1; });
await page.goto(`http://127.0.0.1:${server.address().port}/film.html`);
await page.evaluate(() => window.ready);
const canvas = page.locator('#film');

const grab = () => canvas.screenshot({ type: 'png' });

if (args.still !== undefined) {
  const t = Number(args.still);
  await page.evaluate((t) => window.seek(t), t);
  const outPath = path.resolve(ROOT, args.out ?? `out/still-${t}.png`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, await grab());
  console.log('wrote', outPath);
} else {
  const film = await page.evaluate(() => window.FILM);
  const from = Number(args.from ?? 0);
  const to = Number(args.to ?? film.DURATION);
  const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS);
  const outPath = path.resolve(ROOT, args.out ?? 'out/film.mp4');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const ff = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-'];
  if (args.audio) ff.push('-ss', String(from), '-t', String((f1 - f0) / FPS), '-i', path.resolve(ROOT, args.audio));
  ff.push(
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-r', String(FPS), '-frames:v', String(f1 - f0),
  );
  // The still hold must decode to identical frames. x264 would otherwise keep
  // refining it frame by frame, so the hold starts on a keyframe at high
  // quality and the frames after it are coded so coarsely that every block is
  // simply copied from it.
  const h = film.holdFrom === null ? -1 : film.holdFrom - f0;
  if (h > 0 && h < f1 - f0 - 1) {
    ff.push('-force_key_frames', `expr:eq(n,${h})`, '-x264-params', `zones=${h},${h},q=6/${h + 1},${f1 - f0 - 1},q=40`);
  }
  if (args.audio) ff.push('-c:a', 'aac', '-b:a', '256k', '-ar', '48000');
  ff.push('-movflags', '+faststart', outPath);

  const enc = spawn('ffmpeg', ff, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((ok, fail) => enc.on('close', (c) => (c === 0 ? ok() : fail(new Error('ffmpeg exited ' + c)))));
  const started = Date.now();
  for (let f = f0; f < f1; f++) {
    await page.evaluate((t) => window.seek(t), f / FPS);
    const png = await grab();
    if (!enc.stdin.write(png)) await new Promise((ok) => enc.stdin.once('drain', ok));
    if ((f - f0) % 15 === 0) process.stdout.write(`\rframe ${f - f0 + 1}/${f1 - f0}`);
  }
  enc.stdin.end();
  await done;
  console.log(`\nwrote ${outPath} (${f1 - f0} frames, ${((Date.now() - started) / 1000).toFixed(1)} s)`);
}

await browser.close();
server.close();
