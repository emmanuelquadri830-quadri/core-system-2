// node render.mjs --ar 16x9 [--fps 30] [--blur 4] [--shutter 0.5] [--from 0] [--to 20]
//                 [--workers 3] [--crf 16] [--out out/land-republic-16x9.mp4]
//
// Frames come from window.seek(t) in headless Chromium. With --blur N each
// output frame averages N sub-frames spread across a centred shutter
// (0.5 = 180 degrees), which gives real motion blur on fast moves. Workers
// render contiguous chunks to lossless RGB segments; the final pass encodes
// H.264 yuv420p (BT.709) at CRF 16 and muxes the mastered score.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './tools/serve.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]] : acc), []),
);
const AR = args.ar || '16x9';
const FPS = +(args.fps || 30);
const BLUR = Math.max(1, +(args.blur || 1));
const SHUTTER = +(args.shutter || 0.5);
const FROM = +(args.from || 0);
const TO = +(args.to || 20);
const WORKERS = +(args.workers || Math.max(1, Math.min(4, os.cpus().length - 1)));
const CRF = +(args.crf || 16);
const OUT = path.resolve(ROOT, args.out || `out/land-republic-${AR}.mp4`);
const AUDIO = path.join(ROOT, 'build', 'audio', 'mix.wav');
const SIZES = { '16x9': [1920, 1080], '1x1': [1080, 1080], '9x16': [1080, 1920] };
const [W, H] = SIZES[AR];

const frames = Math.round((TO - FROM) * FPS);
const segDir = path.join(ROOT, 'build', 'segments', AR);
fs.rmSync(segDir, { recursive: true, force: true });
fs.mkdirSync(segDir, { recursive: true });
fs.mkdirSync(path.dirname(OUT), { recursive: true });

function run(cmd, argv, { feed } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv, { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}\n${err.slice(-2000)}`))));
    if (feed) {
      feed(p).catch((e) => {
        p.kill('SIGKILL');
        reject(e);
      });
    } else {
      p.stdin.end();
    }
  });
}

const subOffsets = Array.from({ length: BLUR }, (_, j) => (BLUR === 1 ? 0 : ((j + 0.5) / BLUR - 0.5) * (SHUTTER / FPS)));

const { server, port } = await serve(ROOT);
const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--font-render-hinting=none'] });
const url = `http://127.0.0.1:${port}/film/index.html?ar=${AR}&render=1`;

async function worker(k, start, end) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error(`[worker ${k}] page error`, e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.ready, null, { timeout: 120000 });
  await page.evaluate(() => window.ready);
  const cdp = await page.context().newCDPSession(page);
  const seg = path.join(segDir, `seg-${String(k).padStart(2, '0')}.mkv`);
  const vf = [];
  if (BLUR > 1) vf.push(`tmix=frames=${BLUR}`, `select='eq(mod(n\\,${BLUR})\\,${BLUR - 1})'`, `setpts=N/(${FPS}*TB)`);
  const ff = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS * BLUR), '-c:v', 'png', '-i', '-'];
  if (vf.length) ff.push('-vf', vf.join(','));
  ff.push('-r', String(FPS), '-c:v', 'libx264rgb', '-preset', 'ultrafast', '-qp', '0', '-pix_fmt', 'rgb24', seg);
  await run('ffmpeg', ff, {
    feed: async (p) => {
      for (let f = start; f < end; f++) {
        const t = FROM + f / FPS;
        for (const off of subOffsets) {
          const ts = Math.min(Math.max(t + off, 0), TO - 1e-4);
          await page.evaluate((x) => window.seek(x), ts);
          const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
          const buf = Buffer.from(data, 'base64');
          if (!p.stdin.write(buf)) await new Promise((r) => p.stdin.once('drain', r));
        }
        if (k === 0 && f % 30 === 0) process.stdout.write(`\r${AR}: frame ${f - start}/${end - start} (worker 0)   `);
      }
      p.stdin.end();
    },
  });
  await page.close();
  return seg;
}

const t0 = Date.now();
const chunk = Math.ceil(frames / WORKERS);
const jobs = [];
for (let k = 0; k < WORKERS; k++) {
  const a = k * chunk;
  const b = Math.min(frames, a + chunk);
  if (a < b) jobs.push(worker(k, a, b));
}
const segs = await Promise.all(jobs);
await browser.close();
server.close();
process.stdout.write('\n');

const list = path.join(segDir, 'list.txt');
fs.writeFileSync(list, segs.map((s) => `file '${s}'`).join('\n'));
const enc = [
  '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
];
const withAudio = fs.existsSync(AUDIO);
if (withAudio) enc.push('-ss', String(FROM), '-t', String(TO - FROM), '-i', AUDIO);
enc.push(
  '-map', '0:v',
  ...(withAudio ? ['-map', '1:a'] : []),
  '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', String(CRF), '-profile:v', 'high', '-pix_fmt', 'yuv420p',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-r', String(FPS), '-movflags', '+faststart',
  ...(withAudio ? ['-c:a', 'aac', '-b:a', '320k', '-ar', '48000'] : []),
  '-shortest', OUT,
);
await run('ffmpeg', enc);
fs.rmSync(segDir, { recursive: true, force: true });
const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`wrote ${path.relative(ROOT, OUT)}  ${W}x${H} ${FPS}fps blur ${BLUR}  ${frames} frames in ${secs}s`);
