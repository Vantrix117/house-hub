// Skeptic #2 for "unanswer-erases-note": does "Put back on the list" (apps/prayer.html:1013, handler 1335-1338) erase
// an answered prayer's note with one tap, no confirm, no Undo, on every device? Independent of unanswer.mjs:
// Chromium engine, a second device (Eli's iPad) checked after a pull, the activity feed and every row field searched
// for any surviving copy of the note, and the Mark-answered path checked for its Undo toast as the contrast.
// Run: node "audits/tools/phase3/prayer/verify-unanswer-erases-note-2.mjs"
//   -> audits/evidence/p3/prayer/verify-unanswer-erases-note-2.json (+ -sheet.png, -after.png)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const PRE = `${OUT}/verify-unanswer-erases-note-2`;
const L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
const res = {};
const row = async () => { const r = await L.apiAs('eli', '/api/data/prayer?scope=person'); return r.body.items.find(i => i.key === 'prayer:p015')?.value; };
try {
  const before = await row();
  res.before = { title: before.title, status: before.status, answeredAt: before.answeredAt, answerNote: before.answerNote, updates: before.updates };
  const NOTE = before.answerNote;
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', as: ph });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  const f = await phone.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0); await sleep(800);
  await f.click('nav [data-go="answered"]'); await sleep(400);
  await f.click('#answeredList [data-open="p015"]'); await sleep(500);
  res.sheet = await f.evaluate(() => ({
    buttons: [...document.querySelectorAll('#sheetInner button')].map(b => b.textContent.trim()),
    firstRowBtns: [...document.querySelectorAll('#sheetInner .rowbtns')][0]?.textContent.trim(),
    noteShown: document.querySelector('#sheetInner .ansnote')?.textContent }));
  await phone.shot(`${PRE}-sheet.png`);
  const dialogs = []; phone.page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
  await f.click('[data-reopen="p015"]'); await sleep(300);
  res.immediately = await f.evaluate(() => ({
    askOpen: !!document.querySelector('#ask.on, .ask.on, [id^="ask"].on'),
    toastOn: document.getElementById('toast')?.classList.contains('on') || false,
    toastText: document.getElementById('toastMsg')?.textContent || null,
    toastAction: document.getElementById('toastAct')?.textContent || null,
    screen: document.querySelector('.screen.on')?.id }));
  res.nativeDialogs = dialogs;
  await sleep(2500);
  const after = await row();
  res.serverAfter = { status: after.status, answeredAt: after.answeredAt, answerNote: after.answerNote, updates: after.updates };
  res.noteSurvivesAnywhereInRow = JSON.stringify(after).includes(NOTE.slice(0, 20));
  await phone.shot(`${PRE}-after.png`);
  // second device: Eli's iPad, fresh open, pulls
  const g = await ipad.openApp('prayer', { wait: '#todayLine' });
  await g.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0); await sleep(1500);
  res.ipad = await g.evaluate(note => ({ htmlHasNote: document.body.innerHTML.includes(note.slice(0, 20)), lsHasNote: Object.keys(localStorage).some(k => (localStorage.getItem(k) || '').includes(note.slice(0, 20))) }), NOTE);
  // any other copy: family feed / hub rows
  const feed = await L.apiAs('eli', '/api/data/hub?scope=family');
  res.feedHasNote = JSON.stringify(feed.body).includes(NOTE.slice(0, 20));
  const allPrayer = await L.apiAs('eli', '/api/data/prayer?scope=person');
  res.anyPrayerRowHasNote = JSON.stringify(allPrayer.body).includes(NOTE.slice(0, 20));
  // re-answer path: prefill + Undo contrast
  await f.click('nav [data-go="all"]'); await f.fill('#f-search', 'Luke'); await sleep(300);
  await f.click('#allList [data-open="p015"]'); await sleep(300);
  await f.click('[data-answer="p015"]'); await sleep(300);
  res.reAnswerPrefill = await f.evaluate(() => document.getElementById('askIn')?.value);
  await f.fill('#askIn', 'Answered again for the test.');
  await f.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Mark answered' && !x.dataset.answer && x.offsetParent); b && b.click(); });
  await sleep(400);
  res.markAnsweredToast = await f.evaluate(() => ({ on: document.getElementById('toast')?.classList.contains('on'), msg: document.getElementById('toastMsg')?.textContent, act: document.getElementById('toastAct')?.textContent }));
  console.log(JSON.stringify(res, null, 1));
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${PRE}.json`, JSON.stringify(res, null, 1)); await L.close(); }
