// Skeptic #1 for finding "unanswer-erases-note": does one tap on "Put back on the list" (apps/prayer.html:1013,
// handler 1335-1338) erase the answer note with no confirm/undo, and does the loss reach another device?
// Independent of unanswer.mjs: Kitchen iPad (portrait) as Eli taps; a second paired phone (Eli) pulls afterwards.
// Also searches the whole server row (updates[], history, any field) for any surviving copy of the note text.
// Run: node "audits/tools/phase3/prayer/verify-unanswer-erases-note-1.mjs"
//   -> audits/evidence/p3/prayer/verify-unanswer-erases-note-1.json (+ -ipad-after.png, -phone-after.png)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const PFX = `${OUT}/verify-unanswer-erases-note-1`;
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const row = async () => { const r = await L.apiAs('eli', '/api/data/prayer?scope=person'); return r.body.items.find(i => i.key === 'prayer:p015')?.value; };
try {
  const before = await row();
  res.before = { title: before.title, status: before.status, answeredAt: before.answeredAt, answerNote: before.answerNote, updates: before.updates };
  const needle = (before.answerNote || '').slice(0, 20);
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  // phone first opens the app so it caches the answered row
  const fp = await phone.openApp('prayer', { wait: '#todayLine' }); await sleep(1200);
  res.phoneBefore = await fp.evaluate(() => { try { return JSON.stringify(localStorage).includes('county hospital'); } catch (e) { return String(e); } });
  const f = await ipad.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0); await sleep(600);
  await f.click('nav [data-go="answered"]'); await sleep(400);
  await f.click('#answeredList [data-open="p015"]'); await sleep(500);
  res.sheet = await f.evaluate(() => ({ buttons: [...document.querySelectorAll('#sheetInner button')].map(b => b.textContent.trim()), noteShown: document.querySelector('#sheetInner .ansnote')?.textContent }));
  // one tap; watch for any confirm dialog, ask-sheet or toast for 3 s
  let dialogs = 0; ipad.page.on('dialog', d => { dialogs++; d.dismiss(); });
  await f.click('[data-reopen="p015"]');
  const seen = new Set();
  for (let i = 0; i < 15; i++) {
    const s = await f.evaluate(() => ({ toast: document.getElementById('toast')?.classList.contains('on') ? document.getElementById('toastMsg').textContent + ' | ' + document.getElementById('toastAct').textContent : null, askOpen: !!document.getElementById('askIn') && document.getElementById('askIn').offsetParent !== null, screen: document.querySelector('.screen.on')?.id }));
    seen.add(JSON.stringify(s)); await sleep(200);
  }
  res.afterTapStates = [...seen].map(JSON.parse); res.nativeDialogs = dialogs;
  await sleep(1500);
  const after = await row();
  res.serverAfter = { status: after.status, answeredAt: after.answeredAt, answerNote: after.answerNote, updates: after.updates };
  res.noteTextAnywhereInServerRow = JSON.stringify(after).includes(needle);
  res.noteTextInIpadLocalStorage = await f.evaluate(n => { try { return JSON.stringify(localStorage).includes(n); } catch (e) { return String(e); } }, needle);
  await ipad.shot(`${PFX}-ipad-after.png`);
  // second device pulls
  await phone.goto('#home'); await sleep(500);
  const fp2 = await phone.openApp('prayer', { wait: '#todayLine' }); await sleep(2500);
  res.phoneAfter = await fp2.evaluate(n => { let ls; try { ls = JSON.stringify(localStorage).includes(n); } catch (e) { ls = String(e); } return { noteInLocalStorage: ls, answeredListHasP015: !!document.querySelector('#answeredList [data-open="p015"]') }; }, needle);
  await fp2.click('nav [data-go="answered"]'); await sleep(400);
  res.phoneAfter.answeredListHasP015AfterNav = await fp2.evaluate(() => !!document.querySelector('#answeredList [data-open="p015"]'));
  await phone.shot(`${PFX}-phone-after.png`);
  // re-answer prefill on the iPad
  await f.click('nav [data-go="all"]'); await f.fill('#f-search', 'Luke'); await sleep(300);
  await f.click('#allList [data-open="p015"]'); await sleep(400); await f.click('[data-answer="p015"]'); await sleep(300);
  res.reAnswerPrefill = await f.evaluate(() => document.getElementById('askIn').value);
  console.log(JSON.stringify(res, null, 1));
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${PFX}.json`, JSON.stringify(res, null, 1)); await L.close(); }
