// Pass 1 capture of the real Land Republic site. Nothing here is redrawn: it
// saves what the site serves (screenshots, logo, fonts, images) and an
// inventory of what it found, with page URLs, so every frame and every number
// in the film can be traced back to a source.
//
//   node tools/capture.mjs [startUrl]
//
// Output: assets/ (files) and assets/inventory.json.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..');
const OUT = path.join(ROOT, 'assets');
const START = process.argv[2] || 'https://www.landrepublic.co/landhackers';
const ORIGIN = new URL(START).origin;
const MAX_PAGES = 8;

for (const d of ['shots', 'images', 'fonts', 'logo', 'video', 'css']) fs.mkdirSync(path.join(OUT, d), { recursive: true });

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const browser = await chromium.launch({ proxy });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
});

const inventory = { capturedAt: new Date().toISOString(), start: START, pages: [], fonts: [], stylesheets: [], images: [], videos: [], logos: [] };
const savedByUrl = new Map();
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);

// Save every font and stylesheet the site loads, straight from the network.
ctx.on('response', async (res) => {
  try {
    const url = res.url();
    const type = res.request().resourceType();
    if (savedByUrl.has(url) || !res.ok()) return;
    if (type === 'font') {
      const body = await res.body();
      const ext = (url.split('?')[0].match(/\.(woff2?|ttf|otf)$/i) || [, 'woff2'])[1];
      const file = `fonts/${hash(url)}.${ext}`;
      fs.writeFileSync(path.join(OUT, file), body);
      savedByUrl.set(url, file);
      inventory.fonts.push({ url, file, bytes: body.length });
    } else if (type === 'stylesheet') {
      const body = await res.text();
      const file = `css/${hash(url)}.css`;
      fs.writeFileSync(path.join(OUT, file), body);
      savedByUrl.set(url, file);
      inventory.stylesheets.push({ url, file, fontFaces: [...body.matchAll(/@font-face\s*{[^}]*}/g)].map((m) => m[0].replace(/\s+/g, ' ')) });
    }
  } catch {
    /* response bodies of redirects and aborted requests are not readable */
  }
});

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  // Walk the page so lazy images load, then return to the top.
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 700) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
}

async function download(url, sub) {
  if (!url || url.startsWith('data:')) return null;
  if (savedByUrl.has(url)) return savedByUrl.get(url);
  try {
    const res = await ctx.request.get(url, { timeout: 30000 });
    if (!res.ok()) return null;
    const body = await res.body();
    const ct = res.headers()['content-type'] || '';
    const ext =
      (url.split('?')[0].match(/\.(png|jpe?g|webp|avif|gif|svg|mp4|webm|mov)$/i) || [])[1] ||
      (ct.includes('svg') ? 'svg' : ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('avif') ? 'avif' : ct.includes('mp4') ? 'mp4' : 'jpg');
    const file = `${sub}/${hash(url)}.${ext.toLowerCase()}`;
    fs.writeFileSync(path.join(OUT, file), body);
    savedByUrl.set(url, file);
    return file;
  } catch {
    return null;
  }
}

// Everything the film needs to know about a page, read from the live DOM.
function readPage() {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05;
  };
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const best = (img) => {
    if (img.currentSrc) return img.currentSrc;
    const ss = img.getAttribute('srcset');
    if (ss) {
      const c = ss.split(',').map((s) => s.trim().split(/\s+/)).sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]));
      if (c[0]) return new URL(c[0][0], location.href).href;
    }
    return img.src;
  };
  const textOf = (el) => (el.innerText || '').replace(/\s+/g, ' ').trim();

  // Colors weighted by painted area.
  const colorArea = {};
  const add = (c, a) => {
    if (!c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent') return;
    colorArea[c] = (colorArea[c] || 0) + a;
  };
  const all = [...document.querySelectorAll('body *')].filter(vis);
  for (const el of all) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    add(cs.backgroundColor, r.width * r.height);
    if (el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) add('text:' + cs.color, r.width * r.height * 0.2);
  }
  const rootVars = {};
  const rs = getComputedStyle(document.documentElement);
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of rules) {
      if (rule.selectorText === ':root' || rule.selectorText === 'html' || rule.selectorText === 'body') {
        for (const name of rule.style) if (name.startsWith('--')) rootVars[name] = rs.getPropertyValue(name).trim() || rule.style.getPropertyValue(name).trim();
      }
    }
  }

  const fontsUsed = {};
  for (const el of all) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el);
    const k = `${cs.fontFamily} | ${cs.fontWeight} | ${el.tagName}`;
    fontsUsed[k] = (fontsUsed[k] || 0) + textOf(el).length;
  }

  const headings = [...document.querySelectorAll('h1,h2,h3,h4')].filter(vis).map((h) => {
    const cs = getComputedStyle(h);
    return { tag: h.tagName, text: textOf(h), font: cs.fontFamily, weight: cs.fontWeight, size: cs.fontSize, color: cs.color, letterSpacing: cs.letterSpacing, transform: cs.textTransform, box: box(h) };
  });
  const buttons = [...document.querySelectorAll('a,button,[role=button],input[type=submit]')].filter(vis).map((b) => {
    const cs = getComputedStyle(b);
    return { tag: b.tagName, text: textOf(b) || b.value || b.getAttribute('aria-label') || '', href: b.href || null, bg: cs.backgroundColor, color: cs.color, radius: cs.borderRadius, font: cs.fontFamily, weight: cs.fontWeight, box: box(b) };
  });
  const inputs = [...document.querySelectorAll('input,select,textarea')].filter(vis).map((i) => ({
    tag: i.tagName, type: i.type, name: i.name, placeholder: i.placeholder || '', options: i.tagName === 'SELECT' ? [...i.options].map((o) => o.text) : undefined, box: box(i),
  }));
  const images = [...document.images].filter((i) => i.naturalWidth > 120).map((i) => {
    let card = i.parentElement;
    for (let k = 0; k < 6 && card && textOf(card).length < 30; k++) card = card.parentElement;
    return { src: best(i), alt: i.alt || '', natural: [i.naturalWidth, i.naturalHeight], box: box(i), visible: vis(i), context: card ? textOf(card).slice(0, 400) : '' };
  });
  const bgImages = all
    .map((el) => ({ el, bg: getComputedStyle(el).backgroundImage }))
    .filter(({ bg }) => bg && bg.startsWith('url('))
    .map(({ el, bg }) => ({ src: new URL(bg.slice(4, -1).replace(/["']/g, ''), location.href).href, box: box(el), context: textOf(el).slice(0, 300) }))
    .filter((b) => b.box.w > 200);
  const videos = [...document.querySelectorAll('video')].map((v) => ({
    src: v.currentSrc || v.src || (v.querySelector('source') || {}).src || '', poster: v.poster || '', box: box(v),
  }));
  const logoCands = [
    ...document.querySelectorAll('header img, nav img, a[href="/"] img, [class*=logo i] img, img[alt*=logo i], img[src*=logo i], header svg, nav svg, a[href="/"] svg, [class*=logo i] svg'),
  ]
    .filter(vis)
    .map((el) => ({ tag: el.tagName, src: el.tagName === 'IMG' ? best(el) : null, svg: el.tagName.toLowerCase() === 'svg' ? el.outerHTML : null, alt: el.getAttribute('alt') || '', box: box(el) }))
    .filter((c) => c.box.y < 400);
  const numbers = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode.textContent.replace(/\s+/g, ' ').trim();
    if (/\d/.test(t) && t.length < 140) {
      const el = walker.currentNode.parentElement;
      if (!el || !vis(el)) continue;
      let ctxEl = el;
      for (let k = 0; k < 3 && ctxEl.parentElement && textOf(ctxEl).length < 40; k++) ctxEl = ctxEl.parentElement;
      numbers.push({ text: t, context: textOf(ctxEl).slice(0, 200), box: box(el) });
    }
  }
  const links = [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.href.split('#')[0]))];
  return {
    url: location.href,
    title: document.title,
    meta: {
      description: document.querySelector('meta[name=description]')?.content || '',
      ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
      themeColor: document.querySelector('meta[name=theme-color]')?.content || '',
      favicon: document.querySelector('link[rel*=icon]')?.href || '',
      generator: document.querySelector('meta[name=generator]')?.content || '',
    },
    size: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight },
    bodyFont: getComputedStyle(document.body).fontFamily,
    rootVars,
    colors: Object.entries(colorArea).sort((a, b) => b[1] - a[1]).slice(0, 24).map(([c, a]) => ({ color: c, area: Math.round(a) })),
    fontsUsed: Object.entries(fontsUsed).sort((a, b) => b[1] - a[1]).slice(0, 20),
    loadedFaces: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight} ${f.style}`),
    headings,
    buttons: buttons.slice(0, 120),
    inputs,
    images,
    bgImages,
    videos,
    logoCands,
    numbers: numbers.slice(0, 200),
    links,
  };
}

const queue = [START, ORIGIN + '/'];
const seen = new Set();
const page = await ctx.newPage();
while (queue.length && inventory.pages.length < MAX_PAGES) {
  const url = queue.shift();
  const key = url.split('?')[0].replace(/\/$/, '');
  if (seen.has(key)) continue;
  seen.add(key);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  } catch (e) {
    console.log('skip', url, e.message.split('\n')[0]);
    continue;
  }
  await settle(page);
  const info = await page.evaluate(readPage);
  const slug = (new URL(info.url).pathname.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'home').slice(0, 40);
  const full = `shots/${slug}-full.png`;
  const fold = `shots/${slug}-fold.png`;
  await page.screenshot({ path: path.join(OUT, full), fullPage: true });
  await page.screenshot({ path: path.join(OUT, fold) });
  info.shots = { full, fold, dpr: 2 };

  for (const im of info.images) im.file = await download(im.src, 'images');
  for (const im of info.bgImages) im.file = await download(im.src, 'images');
  for (const v of info.videos) {
    v.file = await download(v.src, 'video');
    v.posterFile = await download(v.poster, 'images');
  }
  for (const [k, c] of info.logoCands.entries()) {
    if (c.src) c.file = await download(c.src, 'logo');
    if (c.svg) {
      c.file = `logo/${slug}-inline-${k}.svg`;
      fs.writeFileSync(path.join(OUT, c.file), c.svg.includes('xmlns') ? c.svg : c.svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'));
    }
    // A transparent raster of exactly what the browser paints, at 4x.
    const shot = `logo/${slug}-paint-${k}.png`;
    try {
      const el = (await page.$$('header img, nav img, a[href="/"] img, [class*=logo i] img, img[alt*=logo i], img[src*=logo i], header svg, nav svg, a[href="/"] svg, [class*=logo i] svg'))[k];
      if (el) {
        await el.screenshot({ path: path.join(OUT, shot), omitBackground: true });
        c.paint = shot;
      }
    } catch {
      /* element moved or detached between read and screenshot */
    }
  }
  if (info.meta.favicon) info.meta.faviconFile = await download(info.meta.favicon, 'logo');
  if (info.meta.ogImage) info.meta.ogImageFile = await download(info.meta.ogImage, 'images');

  inventory.pages.push(info);
  console.log(`captured ${info.url}  ${info.size.w}x${info.size.h}  images ${info.images.length}  numbers ${info.numbers.length}`);

  // Follow same-site links that look like property pages first.
  const ranked = info.links
    .filter((l) => l.startsWith(ORIGIN) && !seen.has(l.split('?')[0].replace(/\/$/, '')))
    .sort((a, b) => score(b) - score(a));
  queue.push(...ranked.slice(0, 12));
}

function score(u) {
  const p = u.toLowerCase();
  let s = 0;
  if (/propert|listing|estate|land|plot|buy|invest|search|explore|location/.test(p)) s += 5;
  if (/\/(propert|listing|estate|land)s?\/[^/]+/.test(p)) s += 3;
  if (/about|faq|contact|blog|terms|privacy|career/.test(p)) s -= 4;
  return s;
}

fs.writeFileSync(path.join(OUT, 'inventory.json'), JSON.stringify(inventory, null, 1));
console.log(`fonts ${inventory.fonts.length}  stylesheets ${inventory.stylesheets.length}  pages ${inventory.pages.length}`);
await browser.close();
