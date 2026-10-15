// Render frames [from, to) at the given fps and pipe them into an ffmpeg encode.
const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
import { spawn } from 'node:child_process';
const [fps, from, to, out, fmt = 'png'] = [Number(process.argv[2]), Number(process.argv[3]), Number(process.argv[4]), process.argv[5], process.argv[6]];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/index.html');
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(300);
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', fmt === 'png' ? 'png' : 'mjpeg', '-i', '-',
  '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
const client = await p.context().newCDPSession(p);
const t0 = Date.now();
for (let f = from; f < to; f++) {
  await p.evaluate((t) => window.renderAt(t), f / fps);
  const shot = await client.send('Page.captureScreenshot', fmt === 'png' ? { format: 'png', optimizeForSpeed: true } : { format: 'jpeg', quality: 95, optimizeForSpeed: true });
  const buf = Buffer.from(shot.data, 'base64');
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
console.log(`${out}: frames ${from}-${to} in ${((Date.now() - t0) / 1000).toFixed(1)}s`, errs.length ? errs : '');
await b.close();
