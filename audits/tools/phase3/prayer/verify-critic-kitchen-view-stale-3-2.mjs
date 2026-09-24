// Skeptic #2 for critic-kitchen-view-stale-3: does an open Kitchen view pick up another adult's changes?
// Eli on the Kitchen iPad (landscape, real clock, WebKit) opens Family -> More -> Kitchen view.
// Mae on her own phone (a second paired device) (1) adds a family request through the Add form and
// (2) marks an existing active family request answered through the app's own write path (stamp + save).
// We wait for the iPad's own poll, then compare D, #todayList and #kitchenBody; then close + reopen.
// Run: node "audits/tools/phase3/prayer/verify-critic-kitchen-view-stale-3-2.mjs"
//  -> audits/evidence/p3/prayer/verify-critic-kitchen-view-stale-3-2.json (+ .png)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const TAG = 'verify-critic-kitchen-view-stale-3-2';
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v).slice(0, 600)); };
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  const ipad = await L.device({ device: 'ipad-landscape', profile: 'eli', fixedTime: false });
  const f = await ipad.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 12000 }); await sleep(800);
  await f.click('#listSwitch [data-list="shared"]'); await sleep(500);
  await f.click('#moreBtn'); await sleep(300); await f.click('[data-more="kitchen"]'); await sleep(600);
  const kitchenText = () => f.evaluate(() => document.getElementById('kitchenBody').innerText);
  const before = await kitchenText();
  const activeShared = await f.evaluate(() => D.lists.shared.prayers.filter(p => p.status === 'active').map(p => ({ id: p.id, title: p.title })));
  const target = activeShared.find(p => before.includes(p.title));
  log('before', { kitchenOn: await f.evaluate(() => document.getElementById('kitchen').classList.contains('on')), activeCount: activeShared.length, answerTarget: target });

  const ph = await L.newDevice({ name: 'Mae phone', profiles: ['christian'] });
  const mae = await L.device({ device: 'iphone-pwa', profile: 'christian', fixedTime: false, as: ph });
  const mf = await mae.openApp('prayer', { wait: '#todayLine' }); await sleep(1500);
  await mf.click('#listSwitch [data-list="shared"]'); await sleep(400);
  const NEW = 'Skeptic2: new roof for Grandma';
  await mf.click('nav [data-go="add"]'); await mf.fill('#f-title', NEW); await mf.click('#f-save'); await sleep(1200);
  const answered = await mf.evaluate(id => { const p = D.lists.shared.prayers.find(x => x.id === id); if (!p) return false;
    p.status = 'answered'; p.answeredAt = TODAY; p.answerNote = 'skeptic2'; stamp(p); save(); renderAllScreens(); return true; }, target && target.id);
  log('maeWrote', { added: NEW, answered });
  await sleep(3000);
  const srv = await L.apiAs('mom', '/api/data/prayer?scope=family');
  const items = (srv.body.items || []).map(i => i.value).filter(Boolean);
  log('onServer', { newThere: items.some(v => v.title === NEW), targetAnswered: items.some(v => target && v.id === target.id && v.status === 'answered') });

  const t0 = Date.now(); let pulled = false;
  while (Date.now() - t0 < 50000 && !pulled) { await sleep(1000);
    pulled = await f.evaluate(([t, id]) => D.lists.shared.prayers.some(p => p.title === t) && D.lists.shared.prayers.some(p => p.id === id && p.status === 'answered'), [NEW, target && target.id]); }
  log('ipadPulled', { pulled, afterMs: Date.now() - t0 });
  await sleep(6000); // leave absorbRemote (4 s retry) time to run
  const after = await kitchenText();
  log('kitchenAfterPull', { stillOpen: await f.evaluate(() => document.getElementById('kitchen').classList.contains('on')),
    kitchenShowsNew: after.includes(NEW), kitchenStillShowsAnswered: target ? after.includes(target.title) : null,
    kitchenUnchanged: after === before,
    todayListHasNew: await f.evaluate(t => document.getElementById('todayList').innerText.includes(t), NEW),
    allListAnsweredMoved: await f.evaluate(id => (D.lists.shared.prayers.find(p => p.id === id) || {}).status, target && target.id) });
  await ipad.page.screenshot({ path: `${OUT}/${TAG}-ipad-kitchen-after-pull.png`, scale: 'css' });
  await f.click('#kitchenShut'); await sleep(300); await f.click('#moreBtn'); await sleep(300); await f.click('[data-more="kitchen"]'); await sleep(600);
  const re = await kitchenText();
  log('kitchenReopened', { kitchenShowsNew: re.includes(NEW), stillShowsAnswered: target ? re.includes(target.title) : null });
} catch (e) { log('error', String(e.stack || e)); }
finally { fs.writeFileSync(`${OUT}/${TAG}.json`, JSON.stringify(res, null, 2)); await L.close(); }
