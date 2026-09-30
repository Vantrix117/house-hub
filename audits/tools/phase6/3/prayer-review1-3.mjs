// Batch 3, review round 1 (Worker A): the smaller fixes, on the rig's typical seed as Eli on the desktop (a real keyboard).
//  5  Escape in the edit form closes at once when nothing changed, and asks "Discard your changes?" when something did
//  6  "One category only" starts on a real category (Personal), so Today is not empty until one is picked
//  8  a finished Today shows no bare "N days in a row." cheer under the strip's own streak
//  4  an inline New plan panel opened in Settings is gone once the person leaves Settings
//  7  Enter in the Add form's title moves to the next field; Enter in Their number saves
// Run: node "audits/tools/phase6/3/prayer-review1-3.mjs" -> audits/evidence/p6/3/prayer-review1-3.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p6/3';
fs.mkdirSync(OUT, { recursive: true });
const res = {}; let pass = 0, fail = 0;
const ok = (c, n, x) => { res[n] = { ok: !!c, x }; if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, JSON.stringify(x)); } };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const d = await L.device({ device: 'desktop', profile: 'eli' });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 15000 }); await sleep(800);
  const on = id => f.evaluate(i => document.getElementById(i).classList.contains('on'), id);
  const key = k => d.page.keyboard.press(k);
  // 5: the edit form
  const id = await f.evaluate(() => todaySet()[0].id);
  await f.evaluate(i => editSheet(i), id); await sleep(400);
  await f.focus('#e-for'); await key('Escape'); await sleep(400);
  ok(!(await on('sheet')) && !(await f.$('.hub-ask')), '5 Escape with nothing changed closes the edit form at once');
  await f.evaluate(i => editSheet(i), id); await sleep(400);
  await f.fill('#e-for', 'Someone new'); await key('Escape'); await sleep(400);
  const asked = await f.evaluate(() => { const s = document.querySelector('.hub-ask'); return s ? s.innerText.replace(/\s+/g, ' ') : null; });
  ok(!!asked && /Discard your changes/.test(asked) && (await on('sheet')), '5 Escape after a change asks first', asked);
  await key('Escape'); await sleep(400);
  ok((await on('sheet')) && (await f.inputValue('#e-for')) === 'Someone new', '5 …and Cancel keeps the form and what was typed');
  await key('Escape'); await sleep(400); await f.click('.hub-ask .btn-danger'); await sleep(400);
  ok(!(await on('sheet')) && (await f.evaluate(i => byId(i).for, id)) !== 'Someone new', '5 …Discard closes it and nothing is saved');
  // 6: One category only
  await f.click('nav [data-go="more"]'); await sleep(400);
  await f.click('[data-mode="focus"]'); await sleep(400);
  const foc = await f.evaluate(() => ({ focus: PL().focusCategory, select: (document.getElementById('p-focus') || {}).value, today: todaySet().length }));
  ok(foc.focus === 'Personal' && foc.select === 'Personal' && foc.today > 0, '6 One category only starts on Personal and Today is not empty', foc);
  await f.click('[data-mode="everything"]'); await sleep(300);
  // 4: an inline panel left behind in Settings
  await f.click('#f-newplan'); await sleep(300);
  const panelBefore = await f.evaluate(() => !!document.querySelector('#s-more .ask'));
  await f.click('nav [data-go="today"]'); await sleep(300); await f.click('nav [data-go="more"]'); await sleep(300);
  ok(panelBefore && !(await f.evaluate(() => !!document.querySelector('#s-more .ask'))) && (await f.evaluate(() => !el('f-newplan').hidden)), '4 the New plan panel is gone after leaving Settings, and its button is back');
  // 8: a finished Today
  await f.click('nav [data-go="today"]'); await sleep(300);
  await f.evaluate(() => { todaySet().forEach(p => { if (!doneToday(p)) setPrayed(p, true); }); renderAllScreens(); }); await sleep(300);
  const done = await f.evaluate(() => ({ line: el('todayLine').textContent, cheer: el('cheer').textContent, strip: el('todayStrip').textContent, streak: currentStreak() }));
  // batch 3 rescore (ICO-2, on purpose): the check after "All prayed" is a drawn SVG (svg.hcheck), not a text ✓
  done.drawnCheck = await f.evaluate(() => !!document.querySelector('#todayLine svg.hcheck'));
  ok(done.line === 'All prayed' && done.drawnCheck && !/^\d+ days in a row\.$/.test(done.cheer), '8 a finished Today has no bare streak cheer under the strip', done);
  // 7: Enter in the Add form
  await f.click('nav [data-go="add"]'); await sleep(300);
  const n0 = await f.evaluate(() => L().prayers.length);
  await f.fill('#f-title', 'Review: Enter moves on'); await f.press('#f-title', 'Enter'); await sleep(300);
  const mid = await f.evaluate(() => ({ focus: document.activeElement.id, n: L().prayers.length, screen: document.querySelector('.screen.on').id }));
  await f.press('#f-for', 'Enter'); await sleep(200);
  const mid2 = await f.evaluate(() => document.activeElement.id);
  await f.press('#f-phone', 'Enter'); await sleep(500);
  const end = await f.evaluate(() => ({ n: L().prayers.length, screen: document.querySelector('.screen.on').id }));
  ok(mid.focus === 'f-for' && mid.n === n0 && mid.screen === 's-add' && mid2 === 'f-detail' && end.n === n0 + 1 && end.screen === 's-today', '7 Enter moves title → for → detail; Enter in Their number saves', { n0, mid, mid2, end });
} catch (e) { fail++; console.log('  ✗ threw', e.stack); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/prayer-review1-3.json`, JSON.stringify(res, null, 1)); await L.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
