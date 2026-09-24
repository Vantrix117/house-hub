// Skeptic #1 for "critic-streak-breaks-on-nothing-due-day-1": does a day with nothing due reset the Verses day streak?
// Independent reproduction (own state reader, no _lib.mjs). Two runs on the local typical seed, WebKit, iPhone PWA, Elizabeth (mom):
//   A: Tue 22 Sep 08:40 open Verses, rate nothing; then Wed 23 and Thu 24 at 08:40 on fresh devices -> streak shown.
//   B (control): same, but on Tuesday tap "Practise one anyway" and rate Got it -> Wednesday's streak.
// Run: node "audits/tools/phase3/verses/verify-critic-streak-breaks-on-nothing-due-day-1-1.mjs"
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const P = 'audits/evidence/p3/verses/verify-critic-streak-breaks-on-nothing-due-day-1-1';
const VIEW = '#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])';
const read = f => f.evaluate(() => {
  const q = s => document.querySelector(s), vis = s => { const e = q(s); return !!e && !e.hidden; }, t = s => q(s) ? q(s).textContent.replace(/\s+/g, ' ').trim() : null;
  return { who: t('#who'), trainer: vis('#trainer'), doneBig: vis('#done') ? t('#done-big') : null, doneSub: vis('#done') ? t('#done-sub') : null,
    again: vis('#again') ? t('#again') : null, stDue: t('#st-due'), stStreak: t('#st-streak'), statsSub: t('#stats-sub'),
    queue: [...document.querySelectorAll('#queue-list li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()).slice(0, 3) };
});
async function open(L, iso) {
  const d = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: Date.parse(iso) });
  await d.goto('#home');
  const f = await d.openApp('verses');
  await f.waitForSelector(VIEW, { timeout: 15000 }); await sleep(800);
  return { d, f };
}
async function logRow(L) { const r = await L.apiAs('mom', '/api/data/verses?scope=person'); const it = (r.body.items || []).find(i => i.key === 'log'); return it ? it.value : null; }
async function summaryRow(L) { const r = await L.apiAs('mom', '/api/data/verses?scope=person'); const it = (r.body.items || []).find(i => i.key === 'summary'); return it ? it.value : null; }
const out = { A: {}, B: {} };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  // ---- A: nothing rated on Tuesday
  const tue = '2026-09-22T08:40:00-04:00', wed = '2026-09-23T08:40:00-04:00', thu = '2026-09-24T08:40:00-04:00';
  let { d, f } = await open(L, tue);
  out.A.tue = await read(f);
  const lg0 = await logRow(L); out.A.logLast5 = Object.keys(lg0 || {}).sort().slice(-5);
  await d.page.screenshot({ path: P + '-A-tue-iphone.png', scale: 'css' });
  await d.close();
  await L.clock(wed); ({ d, f } = await open(L, wed)); out.A.wed = await read(f); await sleep(1500); out.A.wedSummary = await summaryRow(L);
  await d.page.screenshot({ path: P + '-A-wed-iphone.png', scale: 'css' }); await d.close();
  await L.clock(thu); ({ d, f } = await open(L, thu)); out.A.thu = await read(f); await d.close();
} finally { await L.close(); }
// ---- B (control): a fresh instance (a reset after moving the clock reseeds relative to the moved clock); rate one anyway on Tuesday
const L2 = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const tue = '2026-09-22T08:40:00-04:00', wed = '2026-09-23T08:40:00-04:00';
  let { d, f } = await open(L2, tue);
  out.B.tueBefore = await read(f);
  await f.click('#again'); await sleep(400);
  await f.click('#show'); await f.waitForSelector('#act-rate:not([hidden])', { timeout: 4000 });
  await f.click('#act-rate [data-rate="got"]'); await sleep(2500);
  out.B.tueAfter = await read(f);
  const lg1 = await logRow(L2); out.B.logLast3 = Object.fromEntries(Object.entries(lg1 || {}).sort().slice(-3));
  await d.close();
  await L2.clock(wed); ({ d, f } = await open(L2, wed)); out.B.wed = await read(f); await d.close();
} finally { await L2.close(); }
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(P + '.json', JSON.stringify(out, null, 1));
