// Skeptic #1 for "critic-hear-focus-redates-entry-3": does focusing an old HEAR field and leaving it (no typing)
// re-date the entry and add a journal-streak day? (apps/f260.html:1818, 1828, 1864-1868)
// Realistic path (unlike the investigator's 48 h fast-forward with auto-lock off): Tue 22 Sep he writes Apply and closes
// the app; Thu 24 Sep he opens F260 afresh on the same phone, unlocks with the passcode, opens the entry's HEAR panel,
// (control) closes it without touching a field, then reopens and taps Apply then Hear without typing, and taps away.
//   node "audits/tools/phase3/f260/verify-critic-hear-focus-redates-entry-3-1.mjs"
// Throwaway passcode on the local demo database only.
import { local, sleep, DEMO, save, shot, rows, ready } from './_lib.mjs';

const PASS = '2468', ID = '38-0', NAME = 'verify-critic-hear-focus-redates-entry-3-1';
const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const snap = async f => f.evaluate(id => ({
  saved: (document.querySelector('#jr-' + id + ' .jsaved') || {}).textContent ?? null,
  a: (document.getElementById('jf-' + id + '-a') || {}).value ?? null,
  jdays: Object.keys((hub.get('f260.jstats') || {}).days || {}),
  vaultIv: (hub.get('f260.journal.vault') || {}).iv || null,
}), ID);
const openPanel = async (f, run) => { await f.evaluate(id => document.querySelector('[data-jr="' + id + '"]').scrollIntoView({ block: 'center' }), ID); await f.locator('[data-jr="' + ID + '"]').click(); await run(600); };
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  // ── Tue 22 Sep: write one field
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, as: ph });
    const f = await d.openApp('f260'); await d.ctx.clock.runFor(3000); await ready(f);
    const run = async ms => { await d.ctx.clock.runFor(ms); await sleep(200); };
    await openPanel(f, run);
    await f.waitForSelector('#pass.on'); await f.fill('#pass1', PASS); await f.fill('#pass2', PASS); await f.locator('#passOk').click();
    for (let i = 0; i < 30 && !(await f.evaluate(id => !!document.getElementById('jf-' + id + '-a'), ID)); i++) await run(500);
    await f.locator('#jf-' + ID + '-a').fill('Share a meal with a neighbour.');
    await f.locator('#jf-' + ID + '-h').click(); await run(500); await f.locator('#tabPlan').click(); await run(4000);
    out.tue = await snap(f);
    await d.close();
  }
  const srvTue = await rows(L, 'eli');
  out.serverTue = { jdays: Object.keys(srvTue['f260.jstats']?.days || {}), vaultIv: srvTue['f260.journal.vault']?.iv || null };
  // ── Thu 24 Sep 08:40: fresh open, unlock
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO + 48 * 3600e3, as: ph });
  const f = await d.openApp('f260'); await d.ctx.clock.runFor(3000); await ready(f);
  const run = async ms => { await d.ctx.clock.runFor(ms); await sleep(200); };
  out.thuBrowserDate = await f.evaluate(() => new Date().toString());
  out.thuPulled = { vaultIv: (await snap(f)).vaultIv, jdays: (await snap(f)).jdays };
  await openPanel(f, run);
  await f.waitForSelector('#pass.on'); await f.fill('#pass1', PASS); await f.locator('#passOk').click();
  for (let i = 0; i < 30 && !(await f.evaluate(id => !!document.getElementById('jf-' + id + '-a'), ID)); i++) await run(500);
  await run(800);
  out.thuUnlocked = await snap(f);
  // control: close the panel and reopen, no field touched
  await f.locator('[data-jr="' + ID + '"]').click(); await run(500);
  out.thuPanelToggledOnly = await snap(f);
  if (!(await f.evaluate(id => document.getElementById('jr-' + id).classList.contains('on'), ID))) await openPanel(f, run);
  // the step under test: tap Apply, tap Hear, tap the Plan tab — no typing
  await f.locator('#jf-' + ID + '-a').click(); await run(300);
  await f.locator('#jf-' + ID + '-h').click(); await run(300);
  await f.locator('#tabPlan').click(); await run(4000);
  out.thuAfterTaps = await snap(f);
  await f.evaluate(id => document.getElementById('jr-' + id).scrollIntoView({ block: 'center' }), ID);
  out.shotPlan = await shot(d.page, NAME + '-plan-iphone.png');
  await f.locator('#tabJournal').click(); await run(800);
  out.journalCard = await f.evaluate(id => { const c = document.querySelector('[data-entry="' + id + '"]'); return c ? c.querySelector('.jc-hd').innerText.replace(/\s+/g, ' ') : null; }, ID);
  out.journalStat = await f.evaluate(() => document.getElementById('jStat').innerText.replace(/\s+/g, ' '));
  out.shotJournal = await shot(d.page, NAME + '-journal-iphone.png');
  const srvThu = await rows(L, 'eli');
  out.serverThu = { jdays: Object.keys(srvThu['f260.jstats']?.days || {}), vaultIv: srvThu['f260.journal.vault']?.iv || null, vaultReuploaded: srvThu['f260.journal.vault']?.iv !== out.serverTue.vaultIv };
  await d.close();
} catch (e) { out.error = String(e && e.stack || e).slice(0, 800); }
finally { await L.close(); }
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(22), JSON.stringify(v).slice(0, 400));
console.log('evidence →', save(NAME + '.json', out));
