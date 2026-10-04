// BATCH 7 PINNED COPY of audits/tools/phase3/kidverse/verify-critic-reset-crossweek-keeps-verse-stars-1-2.mjs (the phase-3 script is untouched).
// Why a copy: the original is date-dependent and proves nothing today, before or after the batch. It was written on the evening of
// Sun 27 Sep 2026 / that week against the rig's REAL clock, so its fixture ("this week" stars, the Reset week button) only exists
// that week; on any other date Me's Reset week button is disabled (this week's count is 0) and the script times out or reads undefined.
// What is pinned here: the rig runs in demo-clock mode, its Worker clock is moved to 2026-09-27T19:00:00-04:00 (L.clock) and the database re-seeded
// there (L.reset), and every browser context starts at that instant (installClock) — so the fixture week is the week the script
// was written for, on any day it is run. Its scenario times (Sun 27 Sep 21:15 .. Mon 28 Sep 00:40) are kept as they are.
// Also changed: Reset week asks through the shared confirm sheet since batch 0i (not a native confirm(): the original never confirmed, so no
// reset row was ever written); the copy presses the sheet's button (answerSheet in _kv-7.mjs). The stars are read from the family mirror stars:<kid> (what Kid Verse writes since batch 0f; the person row
// 'stars' is only a read-only base now), and the evidence folder is EVID7 (else audits/evidence/p6/7).
import { answerSheet } from './_kv-7.mjs';
// Skeptic 2 for "critic-reset-crossweek-keeps-verse-stars-1": a Reset week that Kid Verse applies only after the ISO
// week rolls over leaves that week's verse stars on the balance.
//   node "audits/tools/phase6/7/verify-critic-reset-crossweek-keeps-verse-stars-1-2-7.mjs"
// Independent of the investigator's script: no _kv.mjs helpers, different times (the boundary is probed on both sides of
// Sunday midnight: Ezra opens Kid Verse at Sun 27 Sep 23:40 in arm "sun", at Mon 28 Sep 00:20 in arm "mon").
// Overflow variant (Ezra's balance is large, so the max(0, …) floor cannot hide a difference), real server clock.
// Mom resets Ezra's week through the shipped UI (Me → Kids' rewards → Reset week, confirm accepted) at Sun 27 Sep 21:15.
// In arm "mon" Mom's Me is also read at Mon 00:05, before Ezra opens Kid Verse.
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
const PFX = 'verify-critic-reset-crossweek-keeps-verse-stars-1-2-7';
fs.mkdirSync(EVID, { recursive: true });
const NY = s => Date.parse(s);

async function starsRow(L) {
  const r = await L.apiAs('eli', '/api/data/kidverse?scope=family&key=stars%3Aezra');
  const v = r.body && r.body.item && r.body.item.value; if (!v) return null;
  const wk = o => Object.fromEntries(Object.entries(o || {}).filter(([k]) => k >= '2026-09-21' && k <= '2026-09-27'));
  return { week: v.week, count: v.count, total: v.total, earned: v.earned, days: v.days, story: wk(v.credited && v.credited.story), prayed: wk(v.credited && v.credited.prayed),
    verseStamps: Object.fromEntries(Object.entries(v.earnedAt || {}).filter(([k]) => /^verse:2026-09-2[1-7]$/.test(k))) };
}
async function mirrorRow(L) {
  const r = await L.apiAs('mom', '/api/data/kidverse?scope=family&key=' + encodeURIComponent('stars:ezra'));
  const v = r.body && r.body.item && r.body.item.value; return v ? { week: v.week, count: v.count, total: v.total, days: v.days } : null;
}
async function waitSynced(fr) {
  for (let i = 0; i < 100; i++) {
    const ok = await fr.evaluate(() => window.hub && hub.sync.lastPull > 0 && hub.sync.state === 'synced' && !Object.keys(localStorage).some(k => k.startsWith('hub.queue.') && localStorage.getItem(k) !== '{}' && localStorage.getItem(k) !== '[]')).catch(() => false);
    if (ok) return true; await sleep(150);
  }
  return false;
}
async function openMe(L, at, dialogs) {
  const d = await L.device({ device: 'ipad-portrait', profile: 'mom', installClock: at });
  d.page.on('dialog', dl => { dialogs.push(dl.message()); dl.accept(); });
  await d.goto('#home'); await waitSynced(d.page); await sleep(500);
  await d.page.click('#tabbar .tab[data-tab="me"]');
  await d.page.waitForSelector('#rewards-body [data-kid="ezra"]', { timeout: 20000 }); await sleep(800);
  return d;
}
const meText = d => d.page.evaluate(() => { const e = document.querySelector('#rewards-body [data-kid="ezra"] .grow > div'); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; });

async function arm(name) {
  const L = await pinned('overflow');
  const out = { arm: name, dialogs: [] };
  try {
    out.before = await starsRow(L);
    const m = await openMe(L, NY('2026-09-27T21:15:00-04:00'), out.dialogs);
    out.meSunBefore = await meText(m);
    await m.page.click('#rewards-body [data-resetweek="ezra"]'); await answerSheet(m.page); await sleep(800); await waitSynced(m.page);
    out.meSunAfterReset = await meText(m);
    await m.close();
    const led = (await L.apiAs('mom', '/api/data/kidverse?scope=family&prefix=ledger:ezra:')).body.items || [];
    out.resetRow = led.map(i => ({ key: i.key, ...i.value })).filter(x => x.kind === 'reset').sort((a, b) => a.at - b.at).pop();
    if (name === 'mon') {
      const m2 = await openMe(L, NY('2026-09-28T00:05:00-04:00'), out.dialogs);
      out.meMonBeforeKid = await meText(m2); await m2.close();
    }
    const kidAt = name === 'sun' ? NY('2026-09-27T23:40:00-04:00') : NY('2026-09-28T00:20:00-04:00');
    const k = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: kidAt });
    const f = await k.openApp('kidverse', { wait: '#done:not([hidden])' });
    await waitSynced(f); await sleep(2500); await waitSynced(f);
    out.kidRewards = await f.evaluate(() => { const t = s => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; }; return { total: t('#rw-total'), week: t('#rw-week') }; });
    const png = path.join(EVID, `${PFX}-${name}-kid.png`);
    await k.page.screenshot({ path: png, scale: 'css' }); out.shot = path.relative(ROOT, png).replace(/\\/g, '/');
    await k.close();
    out.after = await starsRow(L);
    out.mirrorAfter = await mirrorRow(L);
    if (name === 'mon') {
      const m3 = await openMe(L, NY('2026-09-28T00:40:00-04:00'), out.dialogs);
      out.meMonAfterKid = await meText(m3); await m3.close();
    }
  } finally { await L.close(); }
  return out;
}

const res = {};
for (const a of ['sun', 'mon']) {
  res[a] = await arm(a);
  const r = res[a];
  console.log(`\n[${a}] before: total=${r.before && r.before.total} week=${r.before && r.before.week} days=${JSON.stringify(r.before && r.before.days)} verseStamps=${JSON.stringify(r.before && r.before.verseStamps)}`);
  console.log(`[${a}] confirm: ${JSON.stringify(r.dialogs[0])}`);
  console.log(`[${a}] Me Sun before reset: ${r.meSunBefore}`);
  console.log(`[${a}] Me Sun after reset:  ${r.meSunAfterReset}`);
  console.log(`[${a}] reset row: date=${r.resetRow && r.resetRow.date} days=${JSON.stringify(r.resetRow && r.resetRow.days)} at=${r.resetRow && r.resetRow.at}`);
  if (r.meMonBeforeKid) console.log(`[${a}] Me Mon 00:05 before Kid Verse opens: ${r.meMonBeforeKid}`);
  console.log(`[${a}] Kid Verse rewards: ${JSON.stringify(r.kidRewards)}`);
  console.log(`[${a}] after: total=${r.after && r.after.total} week=${r.after && r.after.week} days=${JSON.stringify(r.after && r.after.days)} story=${JSON.stringify(r.after && r.after.story)} prayed=${JSON.stringify(r.after && r.after.prayed)}`);
  console.log(`[${a}] mirror after: ${JSON.stringify(r.mirrorAfter)}`);
  if (r.meMonAfterKid) console.log(`[${a}] Me Mon 00:40 after Kid Verse: ${r.meMonAfterKid}`);
}
const f = path.join(EVID, PFX + '.json'); fs.writeFileSync(f, JSON.stringify(res, null, 1)); console.log('\nwrote', path.relative(ROOT, f));
