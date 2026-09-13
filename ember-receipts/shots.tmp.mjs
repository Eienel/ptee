import { chromium } from 'playwright-core';
import { VARIANTS } from './variants.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
for (const v of VARIANTS) {
  await p.goto('file://' + process.cwd() + `/card-${v.id}.svg`);
  await p.waitForTimeout(500);
  await p.screenshot({ path: `card-${v.id}.png` });
}
await b.close();
console.log('shots done');
