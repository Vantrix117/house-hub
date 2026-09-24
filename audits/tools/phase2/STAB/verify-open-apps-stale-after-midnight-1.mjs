// Skeptic #1 for STAB finding "open-apps-stale-after-midnight": F260 and Kid Verse left open across midnight keep showing
// yesterday. Independent minimal reproduction (own clock stepping, own reads) on the local instance, plus controls:
//   A  F260 as Elizabeth (mom), Tue 22 → Wed 23 Sep 2026 (she read on Tuesday in the typical seed)
//      A1 before/after midnight (3 min of page time with real 30 s pulls)   A2 a visibility hide/show cycle
//      A3 tap Done on the stale card: which day is logged?   A4 a data change from another device: does it repaint?
//   B  Kid Verse as Ezra, Sun 27 → Mon 28 Sep 2026 (a new ISO week)
//      B1 Ezra taps Done ★ on Sunday 23:59 · B2 after midnight: main stars card, the Done button, the rewards card
//      B3 a visibility cycle · B4 tap Done ★ on Monday: what is stored · B5 close + reopen the app
//   node "audits/tools/phase2/STAB/verify-open-apps-stale-after-midnight-1.mjs"
// Output: audits/evidence/p2/STAB/verify-stale-midnight-1.json + verify-stale-midnight-1-*.png
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const R = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });

// step the page's installed clock in 5 s slices (hub.request aborts after 12 s of page time) and let real requests finish
function inflightTracker(d) {
  if (d._n) return d._n; const n = { v: 0 };
  d.page.on('request', () => n.v++); d.page.on('requestfinished', () => n.v--); d.page.on('requestfailed', () => n.v--);
  return (d._n = n);
}
async function quiet(d) { const n = inflightTracker(d); await sleep(30); const until = Date.now() + 4000; let q = 0; while (Date.now() < until) { if (n.v <= 0) { if (++q >= 5) return; } else q = 0; await sleep(15); } }
async function step(d, ms) { inflightTracker(d); for (let t = 0; t < ms; t += 5000) { await d.ctx.clock.runFor(Math.min(5000, ms - t)); await quiet(d); } }
async function visCycle(d, frame) {
  for (const f of [d.page, frame]) await f.evaluate(() => {
    const set = h => { Object.defineProperty(document, 'hidden', { get: () => h, configurable: true }); Object.defineProperty(document, 'visibilityState', { get: () => h ? 'hidden' : 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); };
    set(true); set(false);
  });
  await step(d, 2000);
}
const shot = async (d, name) => { const f = path.join(OUT, `verify-stale-midnight-1-${name}.png`); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f).replace(/\\/g, '/'); };

try {
  // ───────────── A: F260, Tuesday → Wednesday ─────────────
  await L.clock('2026-09-22T23:58:00-04:00'); await L.reset('typical');
  const a = await L.device({ device: 'ipad-portrait', profile: 'mom', installClock: Date.parse('2026-09-22T23:59:20-04:00') });
  await a.goto('#home'); await a.page.waitForSelector('#view-home .hero-title', { timeout: 15000 });
  let f = await a.openApp('f260'); await f.waitForSelector('#todayDate', { timeout: 15000 });
  await step(a, 20000);
  const readF = async () => (a.frame('f260')).evaluate(() => ({ browserNow: new Date().toString().slice(0, 24), todayKind: document.getElementById('todayKind').innerText, todayDate: document.getElementById('todayDate').innerText, readClass: document.getElementById('today').classList.contains('read'), todayTitle: document.getElementById('todayTitle').innerText, vault: document.body.className }));
  R.f260 = { before: await readF() };
  R.f260.beforeShot = await shot(a, 'f260-before');
  await L.clock('2026-09-23T00:00:10-04:00');
  await step(a, 180000);
  R.f260.after3min = await readF();
  R.f260.afterShot = await shot(a, 'f260-after');
  f = a.frame('f260');
  await visCycle(a, f);
  R.f260.afterVisibilityCycle = await readF();
  // A4 control: a change to one of Elizabeth's F260 rows from another device (value unchanged) — hub.onChange → mergeRemote → render
  const put = await L.apiAs('mom', '/api/data/f260/f260.autolock?scope=person', { method: 'PUT', body: { value: 15, updated_at: Date.parse('2026-09-23T00:03:30-04:00') } });
  await step(a, 35000);
  R.f260.afterRemoteChange = { put: put.status, ...(await readF()) };
  // A3: tap Done (on whatever the card shows) — which day lands in f260.log?
  const logBefore = ((await L.apiAs('mom', '/api/data/f260?scope=person')).body.items || []).find(r => r.key === 'f260.log');
  await f.click('#todayDone'); await step(a, 5000);
  const logAfter = ((await L.apiAs('mom', '/api/data/f260?scope=person')).body.items || []).find(r => r.key === 'f260.log');
  const lk = r => Object.keys((r && r.value) || {}).sort().slice(-3);
  R.f260.doneTap = { logLast3Before: lk(logBefore), logLast3After: lk(logAfter), card: await readF() };
  await a.close();

  // ───────────── B: Kid Verse, Sunday → Monday (new ISO week) ─────────────
  await L.clock('2026-09-27T23:58:00-04:00'); await L.reset('typical');
  const b = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: Date.parse('2026-09-27T23:59:10-04:00') });
  await b.goto('#home'); await b.page.waitForSelector('#view-home .hero-title', { timeout: 15000 });
  const homeStars = () => b.page.evaluate(() => document.querySelector('#view-home .stars-card')?.innerText.replace(/\s+/g, ' ').trim() || null);
  R.kidverse = { homeBefore: await homeStars() };
  let k = await b.openApp('kidverse'); await k.waitForSelector('#mine:not([hidden])', { timeout: 15000 });
  await step(b, 15000);
  const readK = async () => (b.frame('kidverse')).evaluate(() => {
    const mine = document.getElementById('mine'), done = document.getElementById('done');
    return { browserNow: new Date().toString().slice(0, 24),
      mainCount: document.getElementById('star-count')?.innerText, mainSub: mine.querySelector('.sub')?.innerText,
      days: [...mine.querySelectorAll('.days span')].map(s => (s.classList.contains('today') ? '[' : '') + (s.classList.contains('on') ? '*' : s.textContent) + (s.classList.contains('today') ? ']' : '')).join(' '),
      doneLabel: done.querySelector('span').innerText, donePressed: done.getAttribute('aria-pressed'),
      rewardsWeek: document.getElementById('rw-week')?.innerText, rewardsTotal: document.getElementById('rw-total')?.innerText };
  });
  R.kidverse.before = await readK();
  // B1: Ezra taps Done ★ at Sunday ~23:59:25 (if today's star is not already there)
  k = b.frame('kidverse');
  if (R.kidverse.before.donePressed !== 'true') { await k.click('#done'); await step(b, 3000); }
  R.kidverse.afterSundayTap = await readK();
  R.kidverse.beforeShot = await shot(b, 'kidverse-before');
  await L.clock('2026-09-28T00:00:10-04:00');
  await step(b, 180000);
  R.kidverse.after3min = await readK();
  R.kidverse.afterShot = await shot(b, 'kidverse-after');
  await visCycle(b, b.frame('kidverse'));
  R.kidverse.afterVisibilityCycle = await readK();
  // B4: tap Done ★ on Monday with the stale card — what does the stored row say?
  const starsRow = async () => { const it = ((await L.apiAs('ezra', '/api/data/kidverse?scope=person')).body.items || []).find(r => r.key === 'stars'); const v = it && it.value; return v && { week: v.week, count: v.count, total: v.total, dayKeys: Object.keys(v.days || {}).sort().slice(-3) }; };
  R.kidverse.storedBeforeMondayTap = await starsRow();
  await b.frame('kidverse').click('#done'); await step(b, 3000);
  R.kidverse.storedAfterMondayTap = await starsRow();
  R.kidverse.afterMondayTap = await readK();
  // B5: close the app (Home) and reopen it
  await b.page.evaluate(() => { location.hash = '#home'; }); await step(b, 2000);
  R.kidverse.homeAfterMidnight = await homeStars();
  await b.page.evaluate(() => { location.hash = '#kidverse'; });
  const until = Date.now() + 10000; while (Date.now() < until) { const fr = b.frame('kidverse'); if (fr && await fr.$('#star-count').catch(() => null)) break; await step(b, 500); }
  await step(b, 3000);
  R.kidverse.reopened = await readK();
  await b.close();

  console.log(JSON.stringify(R, null, 1));
  fs.writeFileSync(path.join(OUT, 'verify-stale-midnight-1.json'), JSON.stringify(R, null, 1));
} finally { await L.close(); }
