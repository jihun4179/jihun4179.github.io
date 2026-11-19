// 자동 플레이 밸런스 검사: node tools/sim.mjs [판 수=200] [index.html 경로]
// 봇이 처음부터 끝까지 등반을 반복하고, 전투마다 라운드 수 · 잃은 체력 · 족보 · 폴드를 모은다.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const RUNS = +(process.argv[2] || 200);
const src = process.argv[3] || path.join(here, '..', 'index.html');
let html = fs.readFileSync(src, 'utf8')
  .replace('const sleep = ms => new Promise(r => setTimeout(r, ms));', 'const sleep = ms => Promise.resolve();')
  .replace(/url\('data:image\/jpeg;base64,[^']*'\)/g, 'none')
  .replace(/'data:image\/jpeg;base64,[^']*'/g, "''");
const tmp = path.join(here, `.sim-${process.pid}.html`);
fs.writeFileSync(tmp, html);

const BOT = async (RUNS) => {
  window.__allinFast = true;
  const S = { runs: 0, wins: 0, deathAt: {}, fights: [], cats: Array(10).fill(0), enCats: Array(10).fill(0), rounds: 0, folds: { me: 0, en: 0 } };
  let cur = null;
  const oStart = startBattle; window.startBattle = (k) => { cur = { key: k, floor: run.floor, type: k === 'boss' ? 'boss' : ENEMIES[k].elite ? 'elite' : 'normal', hp0: run.hp, rounds: 0 }; return oStart(k); };
  const oWin = winBattle; window.winBattle = () => { cur.rounds = b.round; cur.lost = cur.hp0 - run.hp; cur.won = true; S.fights.push(cur); return oWin(); };
  const oEnd = showEnd; window.showEnd = (w) => { S.runs++; if (w) S.wins++; else { const k = run.floor + '-' + (cur && cur.type); S.deathAt[k] = (S.deathAt[k] || 0) + 1; if (cur && !cur.won) { cur.rounds = b.round; cur.lost = cur.hp0; cur.won = false; S.fights.push(cur); } } return oEnd(w); };
  const oSd = showdown; window.showdown = () => { const me = myBest(), en = enBest(); S.cats[me.cat]++; S.enCats[en.cat]++; return oSd(); };
  const oFold = foldBy; window.foldBy = (w) => { S.folds[w]++; return oFold(w); };

  const equity = () => {
    const mine = playable(b.my); if (!mine.length) return 0;
    const known = new Set([...mine, ...b.board].map(c => c.r + c.s));
    const pool = deck52().filter(c => !known.has(c.r + c.s)); let w = 0; const N = 120;
    for (let i = 0; i < N; i++) { shuffle(pool); let k = 0; const board = [...b.board]; while (board.length < 5) board.push(pool[k++]);
      const e = best([pool[k++], pool[k++], ...board]).score, p = best([...mine, ...board], evalRules()).score; w += p > e ? 1 : p === e ? .5 : 0; }
    return w / N;
  };
  const pickTwo = () => {
    const opts = b.offered; let bestPair = null, bs = -1;
    for (let i = 0; i < opts.length; i++) for (let j = i + 1; j < opts.length; j++) {
      const a = opts[i], c = opts[j]; const curses = opts.filter(x => x.curse).map(x => x.id);
      if (curses.length && !curses.every(id => id === a.id || id === c.id)) continue;
      const pc = [a, c].filter(x => !x.curse); let s = pc.reduce((t, x) => t + x.r, 0);
      if (pc.length === 2 && pc[0].r === pc[1].r) s += 30; if (pc.length === 2 && pc[0].s === pc[1].s) s += 8; if (pc.length === 2 && Math.abs(pc[0].r - pc[1].r) <= 2) s += 4; if (pc.some(x => x.wild)) s += 40;
      if (s > bs) { bs = s; bestPair = [a.id, c.id]; }
    }
    b.sel = new Set(bestPair); confirmPick();
  };
  const click = sel => { const el = document.querySelector(sel); if (el) { el.click(); return true; } return false; };
  const pickIdx = (els, f) => { if (!els.length) return false; els[f(els.length)].click(); return true; };
  let guard = 0;
  let lastKey='', same=0;
  while (S.runs < RUNS && guard++ < 4e6) {
    await new Promise(r => setTimeout(r, 0));
    const key = (document.querySelector('h2')?.textContent || '') + '|' + (b && b.phase) + '|' + (document.querySelector('#app')?.firstElementChild?.className || '');
    if (guard % 5000 === 0) console.log('prog ' + S.runs + ' ' + key + ' floor' + (run && run.floor) + ' step' + (run && run.step) + ' hp' + (run && run.hp) + ' bhp' + (b && b.hp) + ' r' + (b && b.round));
    if (key === lastKey) { if (++same === 3000) { console.log('STUCK ' + key + ' :: ' + (document.querySelector('#app')?.innerText || '').slice(0, 300).replace(/\s+/g, ' ')); S.stuck = (S.stuck || 0) + 1; same = 0; newRun(); continue; } } else { same = 0; lastKey = key; }
    
    const h2 = document.querySelector('h2')?.textContent || '';
    if (document.querySelector('.end') || document.querySelector('.title:not(.chars)') || document.querySelector('.chars:not(.relicpick)')) { newRun(); continue; }
    if (document.querySelector('.relicpick')) { pickIdx($$('.relic'), n => Math.floor(Math.random() * n)); continue; }
    if (document.querySelector('.doors')) {
      const ds = $$('.door'); const types = run.offer ? run.offer.map(d => d.type) : [];
      const low = run.hp < run.maxHp * .45; let i = 0;
      const pref = low ? ['rest', 'treasure', 'shop', 'event', 'forge', 'fight', 'elite', 'boss'] : ['fight', 'elite', 'forge', 'shop', 'treasure', 'event', 'rest', 'boss'];
      i = types.map((t, k) => [pref.indexOf(t), k]).sort((a, c) => a[0] - c[0])[0]?.[1] ?? 0;
      ds[i]?.click(); continue;
    }
    if (document.querySelector('.battle') && b) {
      if (b.phase === 'pick') { pickTwo(); continue; }
      if (b.phase === 'act' || b.phase === 'respond') {
        const eq = equity();
        // 기술: 에너지 있으면 리버에서 방어 · 집합 · 매복, 강하면 판돈 두 배
        if (b.phase === 'act' && b.street >= 3) { const i = b.hand.findIndex(t => ['guard', 'rally', 'ambush'].includes(t) && TRICKS[t].cost <= b.energy); if (i >= 0) useTrick(i); }
        if (b.phase === 'act' && eq > .72) { const i = b.hand.indexOf('double'); if (i >= 0 && TRICKS.double.cost <= b.energy) useTrick(i); }
        if (b.phase === 'respond') { await playerAction(eq > .38 || b.street === 0 ? 'call' : 'fold'); continue; }
        if (b.street >= 1 && eq < .22 && b.stake <= 2) { await playerAction('fold'); continue; }
        await playerAction(eq > .62 && canRaise() ? 'raise' : 'check'); continue;
      }
      continue;
    }
    // 보상 · 상점 · 휴식 · 사건 · 공방
    if (h2.includes('격파')) { pickIdx($$('.choice'), () => 0); continue; }
    if (h2.includes('칩 슬롯이 꽉')) { click('#skip'); continue; }
    if (document.querySelector('.choice.wide[data-c]')) { pickIdx($$('.choice.wide[data-c]'), () => 0); continue; }
    if (h2 === '금고') { if (!pickIdx($$('.choice'), () => 0)) click('#skip'); continue; }
    if (h2 === '바 라운지') { if (run.hp < run.maxHp * .85 && !chip('greedWallet')) click('#heal'); else click('#trim'); continue; }
    if (h2.includes('버릴 카드')) { const els = $$('.pickable'); const ci = run.deck.findIndex(c => c.curse); const cards = run.deck; let k = 0; if (ci >= 0) { k = [...els].findIndex(e => +e.dataset.id === cards[ci].id); } else { let lo = 99; els.forEach((e, q) => { const c = cards.find(x => x.id === +e.dataset.id); if (c && c.r < lo) { lo = c.r; k = q; } }); } els[Math.max(0, k)]?.click(); continue; }
    if (h2 === '암시장') { const its = $$('.item:not(.sold):not(.poor)'); const chipEl = run.chips.length < run.slots ? its.find(e => e.querySelector('.chipcard[data-c]')) : null; const cardEl = its.find(e => e.querySelector('.card')); if (chipEl) { chipEl.click(); continue; } if (cardEl && run.gold > 90) { cardEl.click(); continue; } click('#leave'); continue; }
    if (h2.includes('카드 공방') || h2.includes('복사할 카드')) { pickIdx($$('.pickable'), n => Math.floor(Math.random() * n)); continue; }
    if (h2.includes('무엇을 할까요') || h2.includes('어느 무늬') || h2.includes('어떤 속성')) { pickIdx($$('.choice'), () => 0); continue; }
    if (document.querySelector('.choice')) { pickIdx($$('.choice'), n => Math.floor(Math.random() * n)); continue; }
    click('#skip') || click('#leave') || click('#back');
  }
  const tr = window.__trace || []; S.zero = tr.filter(l => l.includes('toFoe0 toMe0')).length; S.fightRounds = tr.filter(l => l.includes(' toFoe')).length; S.long = S.fights.filter(f => f.rounds > 15).length;
  const num = (l, k) => +((l.match(new RegExp(k + '(\\d+)')) || [0, 0])[1]);
  const fl = tr.filter(l => l.includes(' toFoe')); S.toMe = fl.reduce((a, l) => a + num(l, 'toMe'), 0); S.toFoe = fl.reduce((a, l) => a + num(l, 'toFoe'), 0);
  S.sdW = fl.filter(l => / W:/.test(l)).length; S.sdL = fl.filter(l => / L:/.test(l)).length;
  S.foldMeDmg = tr.filter(l => l.includes('fold-me')).reduce((a, l) => a + num(l, 'stake') + BAL.foldBase, 0);
  return { toMe: S.toMe, toFoe: S.toFoe, sdW: S.sdW, sdL: S.sdL, foldMeDmg: S.foldMeDmg, zero: S.zero, fightRounds: S.fightRounds, long: S.long, runs: S.runs, wins: S.wins, deathAt: S.deathAt, fights: S.fights, cats: S.cats, enCats: S.enCats, folds: S.folds };
};

const PAR = +(process.env.PAR || 4);
const browser = await chromium.launch();
const t0 = Date.now(); const errs = [];
const parts = await Promise.all(Array.from({ length: PAR }, async (_, i) => {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => console.error('[p' + i + '] ' + m.text()));
  if (process.env.BAL) await page.addInitScript(`window.__BAL = ${process.env.BAL};`);
  await page.route(/^https?:/, r => r.abort()); await page.goto('file://' + tmp, { waitUntil: 'domcontentloaded' });
  return page.evaluate(BOT, Math.ceil(RUNS / PAR));
}));
// 합치기
const out = { toMe: 0, toFoe: 0, sdW: 0, sdL: 0, foldMeDmg: 0, zero: 0, fightRounds: 0, long: 0, runs: 0, wins: 0, deathAt: {}, fights: [], cats: Array(10).fill(0), enCats: Array(10).fill(0), folds: { me: 0, en: 0 } };
for (const p of parts) { for (const k of ['toMe', 'toFoe', 'sdW', 'sdL', 'foldMeDmg']) out[k] += p[k]; out.zero += p.zero; out.fightRounds += p.fightRounds; out.long += p.long; out.runs += p.runs; out.wins += p.wins; for (const k in p.deathAt) out.deathAt[k] = (out.deathAt[k] || 0) + p.deathAt[k]; out.fights.push(...p.fights); p.cats.forEach((c, i) => out.cats[i] += c); p.enCats.forEach((c, i) => out.enCats[i] += c); out.folds.me += p.folds.me; out.folds.en += p.folds.en; }
const by = {}; for (const f of out.fights) { const k = `${f.floor}-${f.type}`; (by[k] = by[k] || { n: 0, lost: 0, rounds: 0, die: 0 }); by[k].n++; by[k].lost += f.lost; by[k].rounds += f.rounds; if (!f.won) by[k].die++; }
for (const k in by) { by[k].lost = +(by[k].lost / by[k].n).toFixed(1); by[k].rounds = +(by[k].rounds / by[k].n).toFixed(1); by[k].diePct = +(by[k].die / by[k].n * 100).toFixed(1); }
const tot = out.cats.reduce((a, c) => a + c, 0);
const pct = a => a.map(c => +(c / tot * 100).toFixed(1));
console.log(JSON.stringify({ perFightRound: { toMe: +(out.toMe / out.fightRounds).toFixed(2), toFoe: +(out.toFoe / out.fightRounds).toFixed(2), showdownWinPct: +(out.sdW / (out.sdW + out.sdL) * 100).toFixed(1) }, foldDmgPerRun: +(out.foldMeDmg / out.runs).toFixed(1), zeroDamageRounds: +(out.zero / out.fightRounds * 100).toFixed(1), fightsOver15Rounds: out.long, runs: out.runs, winRate: +(out.wins / out.runs * 100).toFixed(1), deathAt: out.deathAt, byFloorType: by, myHands: pct(out.cats), enHands: pct(out.enCats), folds: out.folds, seconds: Math.round((Date.now() - t0) / 1000), errors: errs.slice(0, 5) }, null, 1));
await browser.close();
try { fs.unlinkSync(tmp); } catch {}
