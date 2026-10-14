const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto('file://' + process.cwd() + '/index.html');
const data = await p.evaluate(() => ({ duration: window.DURATION, sfx: window.SFX, mark: window.MARK }));
writeFileSync('sfx.json', JSON.stringify(data, null, 1));
console.log(data.duration, data.sfx.length);
await b.close();
