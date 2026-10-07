// Contact sheets for review.
//
//   node tools/contact.mjs --mode beats --ar 16x9   one frame per beat (40)
//   node tools/contact.mjs --mode story            one frame per section, all ratios
//   node tools/contact.mjs --times 1.2,3.4 --ar 9x16
//
// Frames are taken a little after each beat (--offset, default 0.1 s) so the
// hit that lands on the beat is visible. Thumbnails are sized close to how the
// film reads on a phone, which doubles as the readability check.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import { SECTIONS, BEATS } from '../timeline.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]] : acc), []),
);
const MODE = args.mode || (args.times ? 'times' : 'beats');
const OFFSET = +(args.offset ?? 0.1);
const grid = JSON.parse(fs.readFileSync(path.join(ROOT, 'beats.json'), 'utf8'));
const T = (b) => grid.offset + b * grid.period;
const SIZES = { '16x9': [1920, 1080], '1x1': [1080, 1080], '9x16': [1080, 1920] };
const outDir = path.join(ROOT, 'build', 'sheets');
fs.mkdirSync(path.join(outDir, 'frames'), { recursive: true });

const { server, port } = await serve(ROOT);
const browser = await chromium.launch({ args: ['--font-render-hinting=none'] });

async function grab(ar, times, tag) {
  const [W, H] = SIZES[ar];
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => console.error('page error', e.message));
  await page.goto(`http://127.0.0.1:${port}/film/index.html?ar=${ar}&render=1${args.scenes ? `&scenes=${args.scenes}` : ''}`);
  await page.waitForFunction(() => window.ready, null, { timeout: 120000 });
  await page.evaluate(() => window.ready);
  const files = [];
  for (const [i, t] of times.entries()) {
    await page.evaluate((x) => window.seek(x), t);
    const f = path.join(outDir, 'frames', `${tag}-${ar}-${String(i).padStart(2, '0')}.png`);
    await page.screenshot({ path: f });
    files.push(f);
  }
  await page.close();
  return files;
}

const sectionOf = (t) => SECTIONS.find((s) => t >= T(s.from) && t < T(s.to)) || (t < T(0) ? SECTIONS[0] : SECTIONS[SECTIONS.length - 1]);

let html;
let name;
if (MODE === 'beats' || MODE === 'times') {
  const ar = args.ar || '16x9';
  const times = MODE === 'beats' ? Array.from({ length: BEATS }, (_, b) => T(b) + OFFSET) : String(args.times).split(',').map(Number);
  const files = await grab(ar, times, MODE);
  const cols = ar === '16x9' ? 5 : ar === '1x1' ? 6 : 8;
  const tw = ar === '16x9' ? 384 : ar === '1x1' ? 300 : 216;
  name = `${MODE}-${ar}`;
  html = `<div class="grid" style="grid-template-columns:repeat(${cols},${tw}px)">${files
    .map((f, i) => {
      const t = times[i];
      const b = (t - grid.offset) / grid.period;
      return `<figure><img src="file://${f}" style="width:${tw}px"><figcaption><b>${MODE === 'beats' ? `beat ${i}` : `#${i}`}</b> ${t.toFixed(2)}s · ${sectionOf(t).id}${MODE === 'times' ? ` · b${b.toFixed(2)}` : ''}</figcaption></figure>`;
    })
    .join('')}</div>`;
} else {
  // story: the hero frame of every section, in every ratio, one row each
  const rows = [];
  const ars = ['16x9', '1x1', '9x16'];
  const times = SECTIONS.map((s) => T(s.hero ?? (s.from + s.to) / 2));
  const shots = {};
  for (const ar of ars) shots[ar] = await grab(ar, times, 'story');
  const h = 360;
  SECTIONS.forEach((s, i) => {
    rows.push(`<div class="row"><div class="cap"><b>${i + 1}. ${s.label}</b><br>${times[i].toFixed(2)}s · beat ${(s.hero ?? (s.from + s.to) / 2).toFixed(1)}</div>${ars
      .map((ar) => `<img src="file://${shots[ar][i]}" style="height:${h}px">`)
      .join('')}</div>`);
  });
  name = 'story';
  html = rows.join('');
}

const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const sheetHtml = path.join(outDir, `${name}.html`);
fs.writeFileSync(sheetHtml, `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 24px; background: #0d0d0f; color: #ddd; font: 14px/1.35 'DejaVu Sans', sans-serif; width: max-content; }
  .grid { display: grid; gap: 18px 14px; }
  figure { margin: 0; }
  img { display: block; background: #222; }
  figcaption { padding-top: 6px; color: #aaa; }
  figcaption b { color: #fff; }
  .row { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 22px; }
  .cap { width: 190px; flex: none; color: #aaa; }
  .cap b { color: #fff; font-size: 16px; }
</style></head><body>${html}</body></html>`);
await page.goto(`file://${sheetHtml}`);
await page.waitForLoadState('load');
const file = path.join(outDir, `${name}.png`);
await page.screenshot({ path: file, fullPage: true });
await browser.close();
server.close();
console.log('wrote', path.relative(ROOT, file));
