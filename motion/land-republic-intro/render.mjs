// Render the film by seeking every frame in headless Chromium.
//
//   node render.mjs                 full render -> out/land-republic-intro_0-9s.mp4
//   node render.mjs --sheet         one frame per measured beat -> out/sheet.png
//   node render.mjs --times 0.5,2.3 specific frames -> out/frames/t_*.png
//   node render.mjs --clip 3.0,4.2  short clip with audio -> out/clip_*.mp4
//
// Encode: H.264 yuv420p, CRF 16, 30 fps, AAC audio from audio/score.wav.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');
const FPS = 30, DURATION = 9, FRAMES = FPS * DURATION;   // frames 0..269, stops at 9.000 s
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
const port = server.address().port;

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force-color-profile=srgb', '--font-render-hinting=none'],
});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/index.html?render`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 }).catch(() => {});
if (errors.length) { console.error(errors.join('\n')); }
if (!(await page.evaluate(() => window.ready === true))) { await browser.close(); server.close(); process.exit(1); }

const el = await page.$('#frame');
async function shot(t, type = 'png') {
  await page.evaluate(tt => window.seek(tt), t);
  return el.screenshot({ type, ...(type === 'jpeg' ? { quality: 95 } : {}) });
}

const beats = JSON.parse(fs.readFileSync(path.join(ROOT, 'beats.json'), 'utf8'));

if (flag('--verify')) {
  for (const f of fs.readdirSync(path.join(OUT, 'frames'))) if (f.startsWith('verify_')) fs.unlinkSync(path.join(OUT, 'frames', f));
  // Render contract check: every sampled frame must be pixel-identical whether it is
  // painted in sequence or on a freshly loaded page.
  // Paint every frame consecutively, exactly like the final render, keep a sample.
  const sample = [];
  const only = val('--frames');
  if (only) sample.push(...only.split(',').map(Number));
  else { for (let f = 0; f < FRAMES; f += 6) sample.push(f); sample.push(FRAMES - 1); }
  const seq = new Map();
  const want = new Set(sample);
  const last = Math.max(...sample);
  for (let f = 0; f <= last; f++) {
    const buf = await shot(f / FPS);
    if (want.has(f)) seq.set(f, buf);
  }
  let bad = 0;
  const fresh = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  for (const f of sample) {
    await fresh.goto(`http://127.0.0.1:${port}/index.html?render`);
    await fresh.waitForFunction(() => window.ready === true);
    await fresh.evaluate(tt => window.seek(tt), f / FPS);
    const buf = await (await fresh.$('#frame')).screenshot({ type: 'png' });
    if (!buf.equals(seq.get(f))) {
      bad++;
      console.log(`MISMATCH frame ${f} (t=${(f / FPS).toFixed(3)})`);
      fs.writeFileSync(path.join(OUT, 'frames', `verify_${f}_seq.png`), seq.get(f));
      fs.writeFileSync(path.join(OUT, 'frames', `verify_${f}_fresh.png`), buf);
    }
  }
  console.log(bad ? `${bad}/${sample.length} frames not bit-identical; checking tolerance` : `verify OK: ${sample.length} frames bit-identical in sequence and fresh`);
  if (bad) {
    try { execFileSync('python3', [path.join(ROOT, 'verify_diff.py')], { cwd: ROOT, stdio: 'inherit' }); console.log('verify OK within rasteriser noise'); }
    catch { console.log('verify FAILED'); process.exitCode = 2; }
  }
} else if (flag('--sheet') || val('--times')) {
  // Snap to frame times so the sheet shows exactly what the encode will show.
  let times = flag('--sheet')
    ? [...beats.beats.filter(b => b < DURATION), (FRAMES - 1) / FPS]
    : val('--times').split(',').map(Number);
  times = times.map(t => Math.min(FRAMES - 1, Math.round(t * FPS)) / FPS);
  const files = [];
  for (const t of times) {
    const f = path.join(OUT, 'frames', `t_${t.toFixed(3)}.png`);
    fs.writeFileSync(f, await shot(t));
    files.push([t, f]);
    process.stdout.write(`.`);
  }
  process.stdout.write('\n');
  if (flag('--sheet')) {
    // 5 columns, labelled with time; each tile at 1/4 scale (270x480 = phone-ish size)
    const list = files.map(([, f]) => ['-i', f]).flat();
    const n = files.length, cols = 5, rows = Math.ceil(n / cols);
    const fontfile = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
    const parts = files.map(([t], i) => `[${i}:v]scale=270:480,drawtext=fontfile=${fontfile}:text='${t.toFixed(2)}s':x=8:y=8:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4[v${i}]`);
    const pad = [];
    for (let i = n; i < rows * cols; i++) pad.push(`color=c=black:s=270x480:d=1[v${i}]`);
    const inputs = Array.from({ length: rows * cols }, (_, i) => `[v${i}]`).join('');
    const layout = Array.from({ length: rows * cols }, (_, i) => `${(i % cols) * 270}_${Math.floor(i / cols) * 480}`).join('|');
    const fc = [...parts, ...pad, `${inputs}xstack=inputs=${rows * cols}:layout=${layout}:fill=black[out]`].join(';');
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...list, '-filter_complex', fc, '-map', '[out]', '-frames:v', '1', path.join(OUT, 'sheet.png')]);
    console.log('sheet ->', path.join(OUT, 'sheet.png'));
  }
} else {
  const clip = val('--clip');
  let [a, b] = clip ? clip.split(',').map(Number) : [0, DURATION];
  const f0 = Math.round(a * FPS), f1 = Math.min(FRAMES, Math.round(b * FPS));
  const outFile = clip ? path.join(OUT, `clip_${a}-${b}.mp4`) : path.join(OUT, 'land-republic-intro_0-9s.mp4');
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
  const t0 = Date.now();
  for (let i = f0; i < f1; i++) {
    const buf = await shot(i / FPS);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((i - f0) % 30 === 0) process.stdout.write(`frame ${i}/${f1} ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('video ->', outFile);
}
if (errors.length) console.error('page errors:\n' + errors.join('\n'));
await browser.close();
server.close();
