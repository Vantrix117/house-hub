// Skeptic #2 for critic-hear-focus-redates-entry-3: does tapping into an old HEAR entry and away (no typing) re-date it?
// Realistic path (not a panel left open for 48 h): write on Tue 22 Sep, then two days later RELOAD the app, unlock with the
// passcode, open the entry's HEAR panel, tap into Apply, tap into Hear, tap the Journal tab. Control: open the panel only.
//   node "audits/tools/phase3/f260/verify-critic-hear-focus-redates-entry-3-2.mjs"
// Throwaway passcode on the local demo database only. Code: apps/f260.html:1824-1837 (saveJournal), 1814-1820, 1864-1868.
import { local, sleep, DEMO, save, shot, ready } from './_lib.mjs';
const PASS = '1357';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, as: ph });
  let f = await d.openApp('f260'); await d.ctx.clock.runFor(3000); await ready(f);
  const run = async ms => { await d.ctx.clock.runFor(ms); await sleep(200); };
  const state = () => f.evaluate(() => ({
    now: new Date().toISOString(),
    a: (document.getElementById("jf-38-0-a") || {}).value,
    card: (() => { const c = document.querySelector("[data-entry=\"38-0\"] .when"); return c ? c.textContent : null; })(),
    saved: (document.querySelector('#jr-38-0 .jsaved') || {}).textContent,
    days: Object.keys((hub.get('f260.jstats') || {}).days || {}),
    vaultCt: (hub.get('f260.journal.vault') || {}).ct ? hub.get('f260.journal.vault').ct.slice(0, 16) : null }));
  const openPanel = async () => {
    await f.evaluate(() => { const b = document.querySelector('[data-jr="38-0"]'); b.scrollIntoView({ block: 'center' }); });
    await f.locator('[data-jr="38-0"]').click(); await run(600);
  };
  // Day 1: set passcode, write Apply, leave the field
  await openPanel();
  await f.waitForSelector('#pass.on'); await f.fill('#pass1', PASS); await f.fill('#pass2', PASS); await f.locator('#passOk').click();
  for (let i = 0; i < 30 && !(await f.evaluate(() => !!document.getElementById('jf-38-0-a'))); i++) await run(500);
  await f.locator('#jf-38-0-a').fill('Share a meal with a neighbour.'); await f.locator('#jf-38-0-h').click(); await run(2000);
  await f.locator('#tabJournal').click(); await run(1500);
  out.day1 = await state();
  // Two days later: reload the app from scratch (the vault is locked again)
  await d.ctx.clock.fastForward('48:00:00');
  await d.page.reload(); await sleep(500);
  f = await d.openApp('f260'); await run(3000); await ready(f);
  out.reopened = await state();
  await f.locator('#tabPlan').click(); await run(800);
  await openPanel();
  await f.waitForSelector('#pass.on'); await f.fill('#pass1', PASS); await f.locator('#passOk').click();
  for (let i = 0; i < 30 && !(await f.evaluate(() => !!document.querySelector('#jr-38-0.on #jf-38-0-a'))); i++) await run(500);
  await run(1500);
  out.controlPanelOpenOnly = await state();          // control: opened + unlocked, no field touched
  await f.locator('#jf-38-0-a').click(); await run(300);   // tap into Apply to reread
  await f.locator('#jf-38-0-h').click(); await run(300);   // tap into Hear
  await f.locator('#tabJournal').click(); await run(2000); // leave
  out.afterTapInAndAway = await state();
  out.journalCard = await f.evaluate(() => { const c = document.querySelector('[data-entry="38-0"]'); return c ? c.querySelector('.jc-hd').innerText.replace(/\s+/g, ' ') : null; });
  out.journalStat = await f.evaluate(() => document.getElementById('jStat').innerText.replace(/\s+/g, ' '));
  out.shot = await shot(d.page, 'verify-critic-hear-focus-redates-entry-3-2-journal-iphone.png');
  out.serverJstats = ((await L.apiAs('eli', '/api/data/f260?scope=person')).body.items || []).filter(i => i.key === 'f260.jstats').map(i => Object.keys(i.value.days || {}));
} catch (e) { out.error = String(e && e.stack || e); }
finally { await L.close(); }
out.file = save('verify-critic-hear-focus-redates-entry-3-2.json', out);
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(22), JSON.stringify(v).slice(0, 400));
