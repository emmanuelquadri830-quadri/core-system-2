const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
const times = process.argv.slice(2).map(Number);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('file://' + process.cwd() + '/index.html');
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(400);
const info = await p.evaluate(() => ({ d: window.DURATION, n: window.SFX && window.SFX.length, m: Object.fromEntries(Object.entries(window.MARK).map(([k,v])=>[k,+v.toFixed(2)])) }));
console.log(JSON.stringify(info), errs.join('\n'));
for (const t of times) {
  await p.evaluate(t => window.renderAt(t), t);
  await p.screenshot({ path: `prev_${t.toFixed(2)}.png` });
}
await b.close();
