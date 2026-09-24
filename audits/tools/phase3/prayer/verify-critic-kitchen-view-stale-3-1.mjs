// Skeptic #1 for "Kitchen view never refreshes" (apps/prayer.html:699-705 absorbRemote, 1645-1656 openKitchen).
// Eli's Kitchen iPad (landscape, real clock, WebKit) opens Family -> More -> Kitchen view. Then:
//   (1) Mae adds a family request through the Add form on her own phone;
//   (2) Mae marks an existing active family request answered (raw write as Mae, standing in for her phone's sync).
// Waits for the iPad's own poll, then compares the app's data (D), the Today list and #kitchenBody; then Close + reopen.
// Run: node "audits/tools/phase3/prayer/verify-critic-kitchen-view-stale-3-1.mjs"
//   -> audits/evidence/p3/prayer/verify-critic-kitchen-view-stale-3-1.json (+ -ipad.png)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const P = 'verify-critic-kitchen-view-stale-3-1';
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v).slice(0, 600)); };
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  const ipad = await L.device({ device: 'ipad-landscape', profile: 'eli', fixedTime: false });
  const f = await ipad.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 15000 }); await sleep(800);
  await f.click('#listSwitch [data-list="shared"]'); await sleep(600);
  await f.click('#moreBtn'); await sleep(400); await f.click('[data-more="kitchen"]'); await sleep(600);
  const kitchenText = () => f.evaluate(() => document.getElementById('kitchenBody').innerText);
  const before = await kitchenText();
  // pick an active family request that the Kitchen shows, to be answered remotely
  const target = await f.evaluate(() => D.lists.shared.prayers.find(p => p.status === 'active')?.title);
  log('kitchenOpen', { on: await f.evaluate(() => document.getElementById('kitchen').classList.contains('on')), activeList: await f.evaluate(() => D.activeList), targetToAnswer: target, targetShown: before.includes(target) });

  const NEW = 'Skeptic: safe travel for Grandpa';
  const ph = await L.newDevice({ name: 'Mae phone (skeptic)', profiles: ['christian'] });
  const mae = await L.device({ device: 'iphone-pwa', profile: 'christian', fixedTime: false, as: ph });
  const mf = await mae.openApp('prayer', { wait: '#todayLine' }); await sleep(1500);
  await mf.click('#listSwitch [data-list="shared"]'); await sleep(500);
  await mf.click('nav [data-go="add"]'); await sleep(300); await mf.fill('#f-title', NEW); await mf.click('#f-save'); await sleep(3000);

  // Mae answers `target` (value as the app stores it, status answered, fresh updated_at)
  const srv = await L.apiAs('christian', '/api/data/prayer?scope=family');
  const items = srv.body.items || [];
  log('newOnServer', items.some(i => i.value && i.value.title === NEW));
  const row = items.find(i => i.value && i.value.title === target);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const now = Date.now();
  const ans = await L.apiAs('christian', '/api/data/prayer/batch?scope=family', { method: 'POST', body: { items: [{ key: row.key, value: { ...row.value, status: 'answered', answeredAt: today, updatedAt: new Date(now).toISOString() }, updated_at: now }] } });
  log('answerWrite', { status: ans.status, key: row.key });

  const t0 = Date.now(); let st = {};
  while (Date.now() - t0 < 50000) {
    await sleep(1000);
    st = await f.evaluate(([n, t]) => ({ newInD: D.lists.shared.prayers.some(p => p.title === n), targetStatusInD: D.lists.shared.prayers.find(p => p.title === t)?.status }), [NEW, target]);
    if (st.newInD && st.targetStatusInD === 'answered') break;
  }
  log('ipadPulled', { ...st, afterMs: Date.now() - t0 });
  await sleep(2000);
  const kt = await kitchenText();
  const todayTxt = await f.evaluate(() => document.getElementById('todayList').innerText);
  log('afterPull', { kitchenStillOpen: await f.evaluate(() => document.getElementById('kitchen').classList.contains('on')),
    kitchenShowsNew: kt.includes(NEW), kitchenStillShowsAnswered: kt.includes(target), kitchenUnchanged: kt === before,
    todayListShowsNew: todayTxt.includes(NEW) });
  await ipad.page.screenshot({ path: `${OUT}/${P}-ipad.png`, scale: 'css' });  // 1x CSS
  // does anything later refresh it? wait another full poll cycle
  await sleep(32000);
  const kt2 = await kitchenText();
  log('after2ndPoll', { kitchenShowsNew: kt2.includes(NEW), kitchenStillShowsAnswered: kt2.includes(target) });
  await f.click('#kitchenShut'); await sleep(300); await f.click('#moreBtn'); await sleep(400); await f.click('[data-more="kitchen"]'); await sleep(600);
  const kt3 = await kitchenText();
  log('reopened', { kitchenShowsNew: kt3.includes(NEW), kitchenStillShowsAnswered: kt3.includes(target) });
} catch (e) { log('error', String(e.stack || e)); }
finally { fs.writeFileSync(`${OUT}/${P}.json`, JSON.stringify(res, null, 2)); await L.close(); }
