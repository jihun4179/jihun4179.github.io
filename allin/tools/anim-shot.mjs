// 연출 확인: node tools/anim-shot.mjs [출력 폴더] — #demo 전장에서 싸움을 돌리며 일정 간격으로 찍는다 + 오류 0 확인
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import path from 'path'; import fs from 'fs'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(here, 'shots'); fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_')) errs.push(m.text()); });
await page.route(/^https?:/, r => r.abort());
await page.goto('file://' + path.join(here, '..', 'index.html') + '?fight#demo', { waitUntil: 'domcontentloaded' });
const times = [350, 520, 700, 900, 1200, 1600, 2200, 3000];
let last = 0; for (const t of times) { await page.waitForTimeout(t - last); last = t; await page.screenshot({ path: path.join(out, `fight-${String(t).padStart(4, '0')}.png`), clip: { x: 300, y: 80, width: 1320, height: 560 } }); }
await page.waitForTimeout(9000);
await page.screenshot({ path: path.join(out, 'fight-end.png') });
console.log(JSON.stringify({ errors: errs, lastFightMs: await page.evaluate(() => window.__lastFight) }));
await browser.close();
