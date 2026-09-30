// Round 2: does load()'s My-list day repair (P3-PRAYER-21 review fix) put back a day the person unticked on another
// device, because hub.js applies a pull row by row and Prayer reloads on each row's change event?
import fs from 'node:fs';
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const OUT = 'C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/rev3-core/probe4.json';
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
const out = {}; const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const openPrayer = async (d, list) => {
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => typeof D !== 'undefined' && D && hub.isLoaded()); await sleep(500);
  if (list) { await f.evaluate(l => { D.activeList = l; save(); go('today'); }, list); await sleep(300); }
  return f;
};
let today;
const days = async () => { const s = (await L.apiAs('eli', '/api/data/prayer?scope=person')).body.items; return ((s.find(i => i.key === 'prayerDays') || {}).value || []).includes(today); };
try {
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const fi = await openPrayer(ipad, 'personal'), fp = await openPrayer(phone, 'personal');
  today = await fi.evaluate(() => TODAY);
  const hook = () => fp.evaluate(() => { window.__rep = window.__rep || []; if (!window.__hooked) { window.__hooked = 1; const m = window.markDay; window.markDay = function (l) { window.__rep.push(new Error().stack.split('\n')[2].trim().slice(0, 60)); return m.apply(this, arguments); }; } });
  await hook();
  log('S_start', { server: await days(), prayedToday: await fi.evaluate(() => D.lists.personal.prayers.filter(p => p.lastPrayedAt === TODAY).map(p => p.id)) });
  await fi.evaluate(() => { for (const p of D.lists.personal.prayers.filter(p => p.lastPrayedAt === TODAY)) setPrayed(p, false); renderToday(); });
  await fi.evaluate(() => hub.flush()); await sleep(800);
  log('S0_afterClearOnIpad', { server: await days() });
  await fp.evaluate(() => hub.pull()); await sleep(1000); await fp.evaluate(() => hub.flush()); await sleep(800);
  log('S0b_afterPhonePull', { server: await days(), repairs: await fp.evaluate(() => window.__rep.slice()) });
  // clean state again if the phone put it back
  await fi.evaluate(() => hub.pull()); await sleep(800);
  const A = await fi.evaluate(() => todaySet().filter(p => !doneToday(p))[0].id);
  await fi.click(`#todayList [data-pray="${A}"]`); await fi.evaluate(() => hub.flush()); await sleep(600);
  await fp.evaluate(() => hub.pull()); await sleep(1000); await fp.evaluate(() => { window.__rep.length = 0; hub.flush(); }); await sleep(600);
  log('S1_afterTick', { server: await days() });
  await fi.click(`#todayList [data-pray="${A}"]`); await fi.evaluate(() => hub.flush()); await sleep(600);
  log('S2_afterUntickOnIpad', { server: await days(), ipadPrayedToday: await fi.evaluate(() => D.lists.personal.prayers.filter(p => p.lastPrayedAt === TODAY).length) });
  await fp.evaluate(() => hub.pull()); await sleep(1000); await fp.evaluate(() => hub.flush()); await sleep(800);
  log('S3_afterPhonePull', { server: await days(), repairs: await fp.evaluate(() => window.__rep.slice()), phone: await fp.evaluate(() => ({ prayedToday: D.lists.personal.prayers.filter(p => p.lastPrayedAt === TODAY).length, record: recordDays().has(TODAY) })) });
  await fi.evaluate(() => hub.pull()); await sleep(800);
  log('S4_ipadAfterPull', await fi.evaluate(() => ({ prayedToday: D.lists.personal.prayers.filter(p => p.lastPrayedAt === TODAY).length, days: D.lists.personal.prayerDays.includes(TODAY), strip: el('todayStrip').textContent })));
} catch (e) { console.error(e); out.error = String(e.stack || e); }
finally { fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); await L.close(); }
