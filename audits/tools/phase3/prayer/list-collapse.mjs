// On the List screen a tick re-renders the whole list with every category group closed (apps/prayer.html:1265 calls
// renderAll(); renderAll -> groupedHTML(act, !!q) at 950 opens groups only while searching). So the group you opened
// to tick a request folds shut under your finger after each tick. The same happens on any remote change (absorbRemote,
// 699-705 -> renderAllScreens) while the List screen is showing.
// Steps (Eli, iPhone PWA, typical seed): List -> open "Health Needs" -> tick "Dad's knee recovery" -> is the group open?
//   Then open it again and let a remote change arrive (Mae's API write to Eli? no: Eli's own other device writes
//   a person-scope row) and see whether it folds again.
// Run: node "audits/tools/phase3/prayer/list-collapse.mjs" -> audits/evidence/p3/prayer/list-collapse.json + PNGs
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = {};
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0); await sleep(600);
  await f.click('nav [data-go="all"]'); await sleep(400);
  const openState = () => f.evaluate(() => [...document.querySelectorAll('#allList details.cat')].map(x => ({ cat: x.querySelector('summary span').textContent.trim(), open: x.open })).filter(x => x.open));
  const sum = await f.$('#allList details.cat:has(button[data-copycat="Health Needs"]) > summary');
  await sum.click(); await sleep(300);
  res.openBeforeTick = await openState();
  await d.shot(`${OUT}/list-collapse-1-open.png`);
  await f.click('#allList [data-pray="p003"]'); await sleep(600);
  res.openAfterTick = await openState();
  res.tickStored = await f.evaluate(() => D.lists.personal.prayers.find(p => p.id === 'p003').lastPrayedAt === TODAY);
  await d.shot(`${OUT}/list-collapse-2-after-tick.png`);
  console.log('open before tick', JSON.stringify(res.openBeforeTick), '| after tick', JSON.stringify(res.openAfterTick), '| tick stored', res.tickStored);
  // remote change while the group is open
  await (await f.$('#allList details.cat:has(button[data-copycat="Health Needs"]) > summary')).click(); await sleep(300);
  res.openBeforeRemote = await openState();
  const now = Date.now();
  const w = await L.apiAs('eli', '/api/data/prayer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'prayer:p004', value: { ...(await f.evaluate(() => D.lists.personal.prayers.find(p => p.id === 'p004'))), detail: 'edited on the phone' }, updated_at: now }] } });
  res.remoteWrite = w.status;
  await f.evaluate(() => hub.pull()); await sleep(1500);            // stands in for the 30 s poll / a visibility pull
  res.openAfterRemote = await openState();
  console.log('remote write', w.status, '| open before remote', JSON.stringify(res.openBeforeRemote), '| after remote', JSON.stringify(res.openAfterRemote));
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/list-collapse.json`, JSON.stringify(res, null, 1)); await L.close(); }
