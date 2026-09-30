// Reviewer probe (batch 3, core): (A) P3-PRAYER-21 untick on My list with the same person's second device stale;
// (A2) the same on the Family list; (B) UX-PRAYER-13 one feed line when the viewer is closed mid-run and reopened.
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
const out = {};
const openPrayer = async (d, list) => {
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => typeof D !== 'undefined' && D && hub.isLoaded()); await sleep(500);
  await f.evaluate(l => { D.activeList = l; save(); go('today'); }, list); await sleep(300);
  return f;
};
try {
  // ── A: My list ──
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const fi = await openPrayer(ipad, 'personal'), fp = await openPrayer(phone, 'personal');
  out.A_cleared = await fi.evaluate(() => { const done = D.lists.personal.prayers.filter(p => p.lastPrayedAt === TODAY); for (const p of done) setPrayed(p, false); renderToday(); return { ids: done.map(p => p.id), hasToday: D.lists.personal.prayerDays.includes(TODAY) }; });
  await fi.evaluate(() => hub.flush()); await sleep(500); await fp.evaluate(() => hub.pull()); await sleep(800);
  const ids = await fi.evaluate(() => todaySet().filter(p => !doneToday(p)).map(p => p.id));
  const [A, B] = ids; out.A_ids = [A, B];
  out.A_start = await fi.evaluate(() => ({ today: TODAY, hasToday: D.lists.personal.prayerDays.includes(TODAY) }));
  await fi.click(`#todayList [data-pray="${A}"]`); await fi.evaluate(() => hub.flush()); await sleep(500);
  await fp.evaluate(() => hub.pull()); await sleep(800);
  await ipad.setOffline(true); await sleep(300);
  await fp.click(`#todayList [data-pray="${B}"]`); await fp.evaluate(() => hub.flush()); await sleep(500);
  await fi.click(`#todayList [data-pray="${A}"]`); await sleep(300);   // untick A on the stale, offline iPad
  await ipad.setOffline(false); await sleep(300); await fi.evaluate(() => hub.flush()); await sleep(800);
  await fp.evaluate(() => hub.pull()); await sleep(1500);
  const srv = (await L.apiAs('eli', '/api/data/prayer?scope=person')).body.items;
  const days = (srv.find(i => i.key === 'prayerDays') || {}).value || [];
  const today = out.A_start.today;
  out.A_result = { serverDaysHasToday: days.includes(today), serverB_lastPrayedAt: (srv.find(i => i.key === 'prayer:' + B) || {}).value?.lastPrayedAt,
    phone: await fp.evaluate(b => ({ B_done: doneToday(byIdAny(b)), recordHasToday: recordDays().has(TODAY), streak: currentStreak(), strip: el('todayStrip').textContent }), B) };
  console.log('A', JSON.stringify(out.A_result));
  await ipad.close(); await phone.close();

  if (!process.env.WITH_A2) { await L.reset('typical'); } else {
  // ── A2: Family list: Eli (stale iPad) unticks his own tick while Mom's tick is on its way ──
  await L.reset('typical');
  const ipad2 = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const mom = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false });
  const gi = await openPrayer(ipad2, 'shared'), gm = await openPrayer(mom, 'shared');
  const fids = await gi.evaluate(() => todaySet().map(p => ({ id: p.id, any: prayedToday(p).length })));
  out.A2_start = fids;
  const clean = fids.filter(x => !x.any).map(x => x.id);
  if (fids.some(x => x.any)) out.A2_note = 'seed already has ticks today on some family rows';
  const [F1, F2] = clean;
  await gi.click(`#todayList [data-pray="${F1}"]`); await gi.evaluate(() => hub.flush()); await sleep(500);
  await ipad2.setOffline(true); await sleep(300);
  await gm.evaluate(() => hub.pull()); await sleep(500);
  await gm.click(`#todayList [data-pray="${F2}"]`); await gm.evaluate(() => hub.flush()); await sleep(500);
  await gi.click(`#todayList [data-pray="${F1}"]`); await sleep(300);
  await ipad2.setOffline(false); await sleep(300); await gi.evaluate(() => hub.flush()); await sleep(800);
  await gi.evaluate(() => hub.pull()); await sleep(1500);
  const fs2 = (await L.apiAs('eli', '/api/data/prayer?scope=family')).body.items;
  const fdays = (fs2.find(i => i.key === 'prayerDays') || {}).value || [];
  out.A2_result = { serverFamilyDaysHasToday: fdays.includes(today), F2_prayedBy: (fs2.find(i => i.key === 'prayer:' + F2) || {}).value?.prayedBy,
    eliIpad: await gi.evaluate(() => ({ recordHasToday: recordDays().has(TODAY), streak: currentStreak() })) };
  console.log('A2', JSON.stringify(out.A2_result));
  await ipad2.close(); await mom.close();
  }
  // ── B: one feed line per Pray now run, when the viewer is closed mid-run and reopened within 60 s ──
  await L.reset('typical');
  const ph = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const f = await openPrayer(ph, 'shared');


  await f.click('#startPray'); await sleep(600);
  out.B_immersiveOn = await ph.page.evaluate(() => document.getElementById('viewer').classList.contains('immersive'));
  await f.click('#prayNext'); await sleep(300);
  await ph.page.evaluate(() => document.getElementById('pill-home').click()); await sleep(800);
  out.B_afterClose = { immersive: await ph.page.evaluate(() => document.getElementById('viewer').classList.contains('immersive')), prayStillOn: await f.evaluate(() => el('pray').classList.contains('on')), session: await f.evaluate(() => praySession === null ? null : praySession.size) };
  await ph.page.evaluate(() => { location.hash = '#prayer'; }); await sleep(1200);
  const f2 = ph.frame('prayer');
  out.B_sameFrame = f2 === f;
  await f2.click('#prayNext'); await sleep(300); await f2.click('#prayNext'); await sleep(300);
  await f2.click('#prayShut'); await sleep(500);
  await f2.evaluate(() => hub.flush()); await ph.page.evaluate(() => hub.flush && hub.flush()); await sleep(2500);
  const after = (await L.apiAs('eli', '/api/activity?limit=100')).body.activity;
  out.B_lines = after.filter(a => /^Prayed/.test(a.text)).map(a => a.text + ' / ' + a.profile_id + ' / ' + new Date(a.created_at).toISOString());
  console.log('B', JSON.stringify(out.B_immersiveOn), JSON.stringify(out.B_afterClose), out.B_sameFrame, JSON.stringify(out.B_lines, null, 1));
} catch (e) { console.error(e); out.error = String(e.stack || e); }
finally {
  const fs = await import('node:fs');
  fs.writeFileSync('C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/rev3-core/probe1.json', JSON.stringify(out, null, 1));
  await L.close();
}
