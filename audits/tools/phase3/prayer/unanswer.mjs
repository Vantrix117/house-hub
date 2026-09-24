// The answered-prayer record: "Put back on the list" (apps/prayer.html:1013, handler 1335-1338) sets answeredAt and
// answerNote to null with one tap — no confirm, no Undo toast — so the answer ("the part worth keeping, so it cannot be
// left blank", 1327) is erased on every device. Marking it answered again starts from an empty note.
// Steps (Eli, iPhone PWA, demo clock): Record -> "A job for Luke" (p015, answered 12 days ago with a note) ->
// Put back on the list -> read the row in memory and on the server -> open it and tap Mark answered: what is prefilled?
// Run: node "audits/tools/phase3/prayer/unanswer.mjs" -> audits/evidence/p3/prayer/unanswer.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const srv = async () => { const r = await L.apiAs('eli', '/api/data/prayer?scope=person'); const v = r.body.items.find(i => i.key === 'prayer:p015').value; return { status: v.status, answeredAt: v.answeredAt, answerNote: v.answerNote }; };
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0); await sleep(600);
  res.before = await srv();
  await f.click('nav [data-go="answered"]'); await sleep(300);
  await f.click('#answeredList [data-open="p015"]'); await sleep(400);
  res.sheetButtons = await f.evaluate(() => [...document.querySelectorAll('#sheetInner .rowbtns button')].map(b => b.textContent));
  await f.click('[data-reopen="p015"]'); await sleep(1500);
  res.afterOneTap = { server: await srv(), toast: await f.evaluate(() => document.getElementById('toast').classList.contains('on') ? document.getElementById('toastMsg').textContent + ' / ' + document.getElementById('toastAct').textContent : null), screen: await f.evaluate(() => document.querySelector('.screen.on').id) };
  await f.click('nav [data-go="all"]'); await f.fill('#f-search', 'Luke'); await sleep(300);
  await f.click('#allList [data-open="p015"]'); await sleep(300); await f.click('[data-answer="p015"]'); await sleep(200);
  res.reAnswerPrefill = await f.evaluate(() => document.getElementById('askIn').value);
  console.log(JSON.stringify(res));
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/unanswer.json`, JSON.stringify(res, null, 1)); await L.close(); }
