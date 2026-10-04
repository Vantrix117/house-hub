// BATCH 7 PINNED COPY of audits/tools/phase3/kidverse/verify-critic-reset-crossweek-keeps-verse-stars-1-1.mjs (the phase-3 script is untouched).
// Why a copy: the original is date-dependent and proves nothing today, before or after the batch. It was written on the evening of
// Sun 27 Sep 2026 / that week against the rig's REAL clock, so its fixture ("this week" stars, the Reset week button) only exists
// that week; on any other date Me's Reset week button is disabled (this week's count is 0) and the script times out or reads undefined.
// What is pinned here: the rig runs in demo-clock mode, its Worker clock is moved to 2026-09-27T19:00:00-04:00 (L.clock) and the database re-seeded
// there (L.reset), and every browser context starts at that instant (installClock) — so the fixture week is the week the script
// was written for, on any day it is run. Its scenario times (Sun 27 Sep 20:00 .. Mon 28 Sep 07:30) are kept as they are.
// Also changed: Reset week asks through the shared confirm sheet since batch 0i (not a native confirm(): the original never confirmed, so no
// reset row was ever written); the copy presses the sheet's button (answerSheet in _kv-7.mjs). The stars are read from the family mirror stars:<kid> (what Kid Verse writes since batch 0f; the person row
// 'stars' is only a read-only base now), and the evidence folder is EVID7 (else audits/evidence/p6/7).
import { answerSheet } from './_kv-7.mjs';
// Skeptic #1 for "critic-reset-crossweek-keeps-verse-stars-1": does a Reset week that Kid Verse applies only after the
// ISO week rolls over leave that week's verse stars on the balance?
//   node "audits/tools/phase6/7/verify-critic-reset-crossweek-keeps-verse-stars-1-1-7.mjs"   (both arms, ~1.5 min)
// Independent of the investigator's helpers: uses only audits/tools/lib/local.mjs.
// Overflow variant, real server clock. Browser clocks: Mom resets Sun 27 Sep 2026 20:00 New York.
//   control: Ezra opens Kid Verse Sun 20:30.   late: Mom's Me re-read Mon 28 Sep 07:00, Ezra opens Kid Verse Mon 07:30.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const PIN_ISO = '2026-09-27T19:00:00-04:00', PIN = Date.parse(PIN_ISO);
// the rig in demo-clock mode, its Worker clock moved to the pin and the data seeded there
async function pinned(variant) { const L = await local({ variant, clock: 'demo' }); await L.clock(PIN_ISO); await L.reset(variant); return L; }


const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = process.env.EVID7 || path.join(ROOT, 'audits', 'evidence', 'p6', '7');
const PFX = 'verify-critic-reset-crossweek-keeps-verse-stars-1-1-7';
fs.mkdirSync(EVID, { recursive: true });
const T = s => Date.parse(s);
const WEEK = d => d >= '2026-09-21' && d <= '2026-09-27';

async function starsRow(L) {
  const r = await L.apiAs('eli', '/api/data/kidverse?scope=family&key=stars%3Aezra');
  const v = r.body && r.body.item && r.body.item.value; if (!v) return null;
  const pick = o => Object.fromEntries(Object.entries(o || {}).filter(([k]) => WEEK(k)));
  return { week: v.week, count: v.count, total: v.total, earned: v.earned, days: pick(v.days),
    story: pick(v.credited && v.credited.story), prayed: pick(v.credited && v.credited.prayed), applied: Object.keys(v.applied || {}).length };
}
async function waitFor(fn, ms = 15000) { const until = Date.now() + ms; while (Date.now() < until) { if (await fn().catch(() => false)) return true; await sleep(150); } return false; }
const synced = f => waitFor(() => f.evaluate(() => window.hub && hub.sync.state === 'synced' && hub.sync.lastPull > 0 &&
  !Object.keys(localStorage).some(k => k.startsWith('hub.queue.') && Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length)));

async function openMe(L, at, dialogs) {
  const d = await L.device({ device: 'iphone-pwa', profile: 'mom', installClock: at });
  d.page.on('dialog', dl => { dialogs.push(dl.message()); dl.accept(); });
  await d.goto('#home');
  await waitFor(() => d.page.evaluate(() => window.hub && hub.sync.lastPull > 0), 20000); await sleep(600);
  await d.page.click('#tabbar .tab[data-tab="me"]');
  await d.page.waitForSelector('#rewards-body [data-resetweek="ezra"]', { timeout: 15000 }); await sleep(800);
  return d;
}
const meLine = d => d.page.evaluate(() => { const e = document.querySelector('#rewards-body [data-kid="ezra"]'); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; });

async function arm(name) {
  const L = await pinned('overflow');
  const o = { arm: name, dialogs: [] };
  try {
    o.serverBefore = await starsRow(L);
    const m = await openMe(L, T('2026-09-27T20:00:00-04:00'), o.dialogs);
    o.meBeforeReset = await meLine(m);
    await m.page.click('#rewards-body [data-resetweek="ezra"]'); await answerSheet(m.page); await sleep(800); await synced(m.page);
    o.meAfterReset = await meLine(m);
    await m.close();
    const led = (await L.apiAs('eli', '/api/data/kidverse?scope=family&prefix=ledger:ezra:')).body.items || [];
    o.ledger = led.map(i => ({ key: i.key, kind: i.value.kind, date: i.value.date, days: i.value.days })).pop();
    o.serverBeforeKidOpens = await starsRow(L);
    if (name === 'late') { const m2 = await openMe(L, T('2026-09-28T07:00:00-04:00'), o.dialogs); o.meMondayBeforeKid = await meLine(m2); await m2.close(); }
    const k = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: name === 'control' ? T('2026-09-27T20:30:00-04:00') : T('2026-09-28T07:30:00-04:00') });
    const f = await k.openApp('kidverse');
    await synced(f); await sleep(2500); await synced(f);
    o.kidBank = await f.evaluate(() => { const e = document.querySelector('#rw-bank'); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; });
    o.serverAfterKid = await starsRow(L);
    await f.evaluate(() => { const r = document.querySelector('#rewards'); if (r) r.scrollIntoView({ block: 'start' }); });
    const png = path.join(EVID, `${PFX}-${name}-kid.png`);
    await k.page.screenshot({ path: png, scale: 'css', animations: 'disabled' }); o.shot = path.relative(ROOT, png).replace(/\\/g, '/');
    await k.close();
  } finally { await L.close(); }
  console.log(`\n[${name}] server before:`, JSON.stringify(o.serverBefore));
  console.log(`[${name}] Me before reset: ${o.meBeforeReset}\n[${name}] confirm: ${JSON.stringify(o.dialogs[0])}\n[${name}] Me after reset: ${o.meAfterReset}`);
  console.log(`[${name}] ledger:`, JSON.stringify(o.ledger));
  console.log(`[${name}] server before kid opens:`, JSON.stringify(o.serverBeforeKidOpens));
  if (o.meMondayBeforeKid) console.log(`[${name}] Me Monday 07:00 before kid opens: ${o.meMondayBeforeKid}`);
  console.log(`[${name}] kid bank: ${o.kidBank}`);
  console.log(`[${name}] server after kid applies:`, JSON.stringify(o.serverAfterKid));
  return o;
}
const res = { control: await arm('control'), late: await arm('late') };
res.verdict = { controlTotal: res.control.serverAfterKid && res.control.serverAfterKid.total, lateTotal: res.late.serverAfterKid && res.late.serverAfterKid.total };
console.log('\nTOTALS control vs late:', JSON.stringify(res.verdict));
const out = path.join(EVID, PFX + '.json'); fs.writeFileSync(out, JSON.stringify(res, null, 1)); console.log('wrote', path.relative(ROOT, out));
