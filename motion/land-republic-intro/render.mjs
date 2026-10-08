// Render the film by seeking frames in headless Chromium.
//
//   node render.mjs                 full render -> out/land-republic-intro_0-9s.mp4
//   node render.mjs --sheet         one frame per measured beat -> out/sheet.png
//   node render.mjs --times 0.5,2.3 specific frames -> out/frames/t_*.png
//   node render.mjs --clip 3.0,4.2  short clip with audio -> out/clip_a-b.mp4
//   node render.mjs --verify        determinism check (each sample painted twice)
//
// Every frame is painted on a freshly loaded page. Painting frames one after another
// on the same page let Chromium reuse stale raster tiles from earlier frames (survey
// lines from 7.2 s showing up at 7.4 s, a masked map layer leaking into the land), so
// the render contract "no state carried between frames" is enforced structurally here.
//
// Encode: H.264 High, yuv420p, CRF 16, 30 fps, AAC 320k from audio/score.wav.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');
const FPS = 30, DURATION = 24, FRAMES = FPS * DURATION;   // frames 0..719, stops at 24.000 s
const WORKERS = 3;
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });

const args = process.argv.slice(2);
const flag = n => args.includes(n);
const val = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

// Static server (fetch() of JSON and fonts needs http, not file://).
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/index.html?render`;

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force-color-profile=srgb', '--font-render-hinting=none'],
});
const errors = [];
const pages = await Promise.all(Array.from({ length: WORKERS }, async () => {
  const p = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return p;
}));

// Paint frame f on a freshly loaded document.
async function paint(page, f) {
  await page.goto(URL_);
  try {
    await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
  } catch (e) {
    console.error('page never became ready:\n' + [...new Set(errors)].join('\n'));
    throw e;
  }
  await page.evaluate(tt => window.seek(tt), f / FPS);
  return (await page.$('#frame')).screenshot({ type: 'png' });
}

// Paint a list of frames across the worker pages; deliver them in order.
async function paintAll(frames, onFrame) {
  const done = new Map();
  let next = 0, emit = 0;
  let wake = null;
  const workers = pages.map(async page => {
    while (next < frames.length) {
      const i = next++;
      done.set(i, await paint(page, frames[i]));
      if (wake) { const w = wake; wake = null; w(); }
    }
  });
  while (emit < frames.length) {
    if (done.has(emit)) { await onFrame(frames[emit], done.get(emit)); done.delete(emit); emit++; }
    else await new Promise(r => { wake = r; });
  }
  await Promise.all(workers);
}

const beats = JSON.parse(fs.readFileSync(path.join(ROOT, 'beats.json'), 'utf8'));
const t0 = Date.now();

if (flag('--verify')) {
  for (const f of fs.readdirSync(path.join(OUT, 'frames'))) if (f.startsWith('verify_')) fs.unlinkSync(path.join(OUT, 'frames', f));
  const only = val('--frames');
  const sample = only ? only.split(',').map(Number) : [...Array.from({ length: Math.ceil(FRAMES / 9) }, (_, k) => k * 9), FRAMES - 1];
  const first = new Map();
  await paintAll(sample, (f, buf) => { first.set(f, buf); });
  let bad = 0;
  await paintAll([...sample].reverse(), (f, buf) => {   // second pass: other order, other workers
    if (!buf.equals(first.get(f))) {
      bad++;
      fs.writeFileSync(path.join(OUT, 'frames', `verify_${f}_seq.png`), first.get(f));
      fs.writeFileSync(path.join(OUT, 'frames', `verify_${f}_fresh.png`), buf);
    }
  });
  console.log(bad ? `${bad}/${sample.length} frames not bit-identical; checking tolerance` : `verify OK: ${sample.length} frames bit-identical across two independent paints`);
  if (bad) {
    try { execFileSync('python3', [path.join(ROOT, 'verify_diff.py')], { cwd: ROOT, stdio: 'inherit' }); console.log('verify OK within rasteriser noise'); }
    catch { console.log('verify FAILED'); process.exitCode = 2; }
  }
} else if (flag('--sheet') || val('--times')) {
  // Snap to frame times so the sheet shows exactly what the encode will show.
  const times = flag('--sheet')
    ? [...beats.beats.filter(b => b < DURATION), (FRAMES - 1) / FPS]
    : val('--times').split(',').map(Number);
  const frames = times.map(t => Math.min(FRAMES - 1, Math.round(t * FPS)));
  const files = [];
  await paintAll(frames, (f, buf) => {
    const file = path.join(OUT, 'frames', `t_${(f / FPS).toFixed(3)}.png`);
    fs.writeFileSync(file, buf);
    files.push([f / FPS, file]);
  });
  if (flag('--sheet')) {
    // 5 columns, each tile 270x480 (roughly phone size on a laptop screen), labelled with time
    const n = files.length, cols = 5, rows = Math.ceil(n / cols);
    const fontfile = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
    const parts = files.map(([t], i) => `[${i}:v]scale=270:480,drawtext=fontfile=${fontfile}:text='${t.toFixed(2)}s':x=8:y=8:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4[v${i}]`);
    const pad = [];
    for (let i = n; i < rows * cols; i++) pad.push(`color=c=black:s=270x480:d=1[v${i}]`);
    const inputs = Array.from({ length: rows * cols }, (_, i) => `[v${i}]`).join('');
    const layout = Array.from({ length: rows * cols }, (_, i) => `${(i % cols) * 270}_${Math.floor(i / cols) * 480}`).join('|');
    const fc = [...parts, ...pad, `${inputs}xstack=inputs=${rows * cols}:layout=${layout}:fill=black[out]`].join(';');
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...files.map(([, f]) => ['-i', f]).flat(), '-filter_complex', fc, '-map', '[out]', '-frames:v', '1', path.join(OUT, 'sheet.png')]);
    console.log('sheet ->', path.join(OUT, 'sheet.png'));
  }
} else {
  const clip = val('--clip');
  const [a, b] = clip ? clip.split(',').map(Number) : [0, DURATION];
  const f0 = Math.round(a * FPS), f1 = Math.min(FRAMES, Math.round(b * FPS));
  const outFile = clip ? path.join(OUT, `clip_${a}-${b}.mp4`) : path.join(OUT, 'land-republic-intro.mp4');
  const ff = spawn('ffmpeg', [
    '-v', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-ss', String(f0 / FPS), '-t', String((f1 - f0) / FPS), '-i', path.join(ROOT, 'audio', 'score.wav'),
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
    '-t', String((f1 - f0) / FPS), '-movflags', '+faststart', outFile,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const frames = Array.from({ length: f1 - f0 }, (_, k) => f0 + k);
  await paintAll(frames, async (f, buf) => {
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - f0) % 30 === 0) process.stdout.write(`frame ${f}/${f1} ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
  });
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('video ->', outFile);
}
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
if (errors.length) console.error('page errors:\n' + [...new Set(errors)].join('\n'));
await browser.close();
server.close();
