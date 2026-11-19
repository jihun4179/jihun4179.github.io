// 실제 전투 한 라운드를 손으로 하듯 진행하며 찍는다: node tools/play-shot.mjs [출력 폴더]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import path from 'path'; import fs from 'fs'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(here, 'shots'); fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.route(/^https?:/, r => r.abort());
await page.goto('file://' + path.join(here, '..', 'index.html'), { waitUntil: 'domcontentloaded' });
const shot = n => page.screenshot({ path: path.join(out, n + '.png') });
await page.evaluate(() => { newRun(); document.querySelector('.relic').click(); startBattle('thug'); });
for (let r = 0; r < 3; r++) {
  await page.waitForFunction(() => b.phase === 'pick');
  await page.evaluate(() => { b.sel = new Set(b.offered.filter(c => !c.curse).slice(0, 2).map(c => c.id).concat(b.offered.filter(c => c.curse).map(c => c.id)).slice(0, 2)); confirmPick(); });
  for (let s = 0; s < 12; s++) {
    await page.waitForFunction(() => ['act', 'respond', 'pick', 'fight', 'show'].includes(b.phase) || !document.querySelector('.battle'), null, { timeout: 20000 }).catch(async () => { console.log('STUCK', await page.evaluate(() => b.phase + ' ' + b.street), errs); process.exit(1); });
    const ph = await page.evaluate(() => b.phase);
    if (ph !== 'act' && ph !== 'respond') break;
    await page.evaluate(ph => playerAction(ph === 'respond' ? 'call' : 'check'), ph);
    if (r === 0 && s === 0) { await page.waitForTimeout(150); await shot('r0-flop-deal'); }
  }
  await page.waitForFunction(() => b.phase === 'show' || b.phase === 'fight' || b.phase === 'pick' || !document.querySelector('.battle'), null, { timeout: 20000 });
  if (await page.evaluate(() => b.phase === 'pick')) { r--; continue; }   // 상대가 접었다 — 쇼다운 장면을 다시 노린다
  if (r === 0) { await page.waitForTimeout(250); await shot('r0-showdown'); await page.waitForTimeout(1300); await shot('r0-fight'); }
  await page.waitForFunction(() => !document.querySelector('.battle') || b.phase === 'pick', null, { timeout: 40000 }).catch(() => {});
  if (!(await page.$('.battle'))) break;
}
await shot('end');
console.log(JSON.stringify({ errors: errs }));
await browser.close();
