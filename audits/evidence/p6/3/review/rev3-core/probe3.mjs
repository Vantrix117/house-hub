// Reviewer probe, round 2 (batch 3 core). In-memory rig, Chromium.
// R1 a pull landing the untick's rows one by one: does load()'s day repair put back a day the person unticked elsewhere?
// R2 untick then reload on the same device. R4 Escape from inside the Prayer frame: Kitchen view, Pray now.
// R5 the edit form's discard confirm and Escape. R6 the Add form's Enter path. R7 "One category only" default.
import fs from 'node:fs';
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const OUT = 'C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/rev3-core/probe3.json';
const L = await local({ variant: 'typical', clock: 'real', engine: process.env.ENGINE || 'chromium' });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const openPrayer = async (d, list) => {
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => typeof D !== 'undefined' && D && hub.isLoaded()); await sleep(500);
  if (list) { await f.evaluate(l => { D.activeList = l; save(); go('today'); }, list); await sleep(300); }
  return f;
};
const srvPerson = async () => (await L.apiAs('eli', '/api/data/prayer?scope=person')).body.items;
try {
  // ── R1 ──
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const fi = await openPrayer(ipad, 'personal'), fp = await openPrayer(phone, 'personal');
  await fi.evaluate(() => { for (const p of D.lists.personal.prayers.filter(p => p.lastPrayedAt === TODAY)) setPrayed(p, false); renderToday(); });
  await fi.evaluate(() => hub.flush()); await sleep(500); await fp.evaluate(() => hub.pull()); await sleep(800);
  const A = await fi.evaluate(() => todaySet().filter(p => !doneToday(p))[0].id);
  await fi.click(`#todayList [data-pray="${A}"]`); await fi.evaluate(() => hub.flush()); await sleep(600);
  await fp.evaluate(() => hub.pull()); await sleep(800);
  const today = await fp.evaluate(() => TODAY);
  log('R1_phoneAfterTick', await fp.evaluate(a => ({ aDone: doneToday(byIdAny(a)), days: D.lists.personal.prayerDays.includes(TODAY) }), A));
  await fi.click(`#todayList [data-pray="${A}"]`); await fi.evaluate(() => hub.flush()); await sleep(600);   // the iPad unticks A
  let s = await srvPerson();
  log('R1_serverAfterUntick', { daysHasToday: ((s.find(i => i.key === 'prayerDays') || {}).value || []).includes(today), aLast: (s.find(i => i.key === 'prayer:' + A) || {}).value.lastPrayedAt,
    order: s.filter(i => i.key === 'prayerDays' || i.key === 'prayer:' + A).map(i => i.key) });
  const since = await fp.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /^hub\.cache\.prayer\.person\./.test(k)))).since);
  const delta = (await L.apiAs('eli', `/api/data/prayer?scope=person&since=${since}`)).body.items.map(i => i.key);
  log('R1_pullOrder', delta);
  await fp.evaluate(() => { window.__loads = []; const o = window.load; window.load = function () { const r = o.apply(this, arguments); return r; }; });
  await fp.evaluate(() => hub.pull()); await sleep(800); await fp.evaluate(() => hub.flush()); await sleep(800);
  s = await srvPerson();
  log('R1_serverAfterPhonePull', { daysHasToday: ((s.find(i => i.key === 'prayerDays') || {}).value || []).includes(today), aLast: (s.find(i => i.key === 'prayer:' + A) || {}).value.lastPrayedAt,
    phone: await fp.evaluate(a => ({ aDone: doneToday(byIdAny(a)), days: D.lists.personal.prayerDays.includes(TODAY), recordToday: recordDays().has(TODAY), strip: el('todayStrip').textContent }), A) });

  // ── R2: untick then reload on the same device ──
  await fi.click(`#todayList [data-pray="${A}"]`); await fi.evaluate(() => hub.flush()); await sleep(500);
  await fi.click(`#todayList [data-pray="${A}"]`); await sleep(200);
  const f2 = await openPrayer(ipad, null); await f2.evaluate(() => hub.flush()); await sleep(600);
  s = await srvPerson();
  log('R2_afterReload', { daysHasToday: ((s.find(i => i.key === 'prayerDays') || {}).value || []).includes(today), recordToday: await f2.evaluate(() => { D.activeList = 'personal'; return recordDays().has(TODAY); }) });
  await ipad.close(); await phone.close();

  // ── R4: Escape pressed inside the Prayer frame ──
  await L.reset('typical');
  const d = await L.device({ device: 'ipad-landscape', profile: 'eli', fixedTime: false });
  let f = await openPrayer(d, 'shared');
  const bar = () => d.page.evaluate(() => ({ immersive: document.getElementById('viewer').classList.contains('immersive'), on: document.getElementById('viewer').classList.contains('on') }));
  await f.click('#moreBtn'); await sleep(400); await f.click('[data-more="kitchen"]'); await sleep(500);
  const k1 = { kitchen: await f.evaluate(() => el('kitchen').classList.contains('on')), ...(await bar()), focusInFrame: await f.evaluate(() => document.hasFocus()) };
  await d.page.keyboard.press('Escape'); await sleep(400);
  log('R4_kitchen', { before: k1, after: { kitchen: await f.evaluate(() => el('kitchen').classList.contains('on')), ...(await bar()) } });
  // the kitchen view opened, then a tap on it (focus in the frame), then Escape
  await f.click('#moreBtn'); await sleep(400); await f.click('[data-more="kitchen"]'); await sleep(500);
  await f.click('#kitchenBody', { position: { x: 30, y: 30 } }).catch(() => {}); await d.page.keyboard.press('Escape'); await sleep(400);
  log('R4_kitchenAfterTap', { kitchen: await f.evaluate(() => el('kitchen').classList.contains('on')), ...(await bar()) });
  // the shell's own Escape (focus in the shell) while the Kitchen view is up
  await f.click('#moreBtn'); await sleep(400); await f.click('[data-more="kitchen"]'); await sleep(500);
  await d.page.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); document.body.focus(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); }); await sleep(400);
  log('R4_shellEscape1', { kitchen: await f.evaluate(() => el('kitchen').classList.contains('on')), ...(await bar()) });
  await f.evaluate(() => { if (el('kitchen').classList.contains('on')) el('kitchenShut').click(); }); await sleep(300);
  log('R4_afterClose', { kitchen: await f.evaluate(() => el('kitchen').classList.contains('on')), ...(await bar()) });
  // Pray now: Escape from inside the frame
  await f.click('#startPray'); await sleep(500);
  const p1 = await bar(); await d.page.keyboard.press('Escape'); await sleep(400);
  log('R4_pray', { before: p1, after: { pray: await f.evaluate(() => el('pray').classList.contains('on')), ...(await bar()) } });

  // ── R5: edit form discard ──
  await f.evaluate(() => { D.activeList = 'personal'; save(); go('today'); }); await sleep(300);
  const pid = await f.evaluate(() => todaySet()[0].id);
  await f.click(`#todayList [data-open="${pid}"]`); await sleep(400); await f.click(`[data-edit="${pid}"]`); await sleep(300);
  await d.page.keyboard.press('Escape'); await sleep(300);
  const r5a = { sheetOpen: await f.evaluate(() => el('sheet').classList.contains('on')), asks: await f.evaluate(() => document.querySelectorAll('.hub-ask').length) };
  await f.click(`#todayList [data-open="${pid}"]`); await sleep(400); await f.click(`[data-edit="${pid}"]`); await sleep(300);
  await f.fill('#e-detail', 'changed words'); await d.page.keyboard.press('Escape'); await sleep(400);
  const r5b = { sheetOpen: await f.evaluate(() => el('sheet').classList.contains('on')), asks: await f.evaluate(() => document.querySelectorAll('.hub-ask').length) };
  await d.page.keyboard.press('Escape'); await sleep(400);
  const r5c = { sheetOpen: await f.evaluate(() => el('sheet').classList.contains('on')), asks: await f.evaluate(() => document.querySelectorAll('.hub-ask').length), detail: await f.evaluate(() => (el('e-detail') || {}).value), immersive: (await bar()).immersive, viewerOn: (await bar()).on };
  await d.page.keyboard.press('Escape'); await sleep(400);
  await f.click('.hub-ask .btn-danger'); await sleep(400);
  const r5d = { sheetOpen: await f.evaluate(() => el('sheet').classList.contains('on')), saved: await f.evaluate(i => byIdAny(i).detail, pid) };
  log('R5_edit', { noChange: r5a, changed: r5b, escOnConfirm: r5c, discard: r5d });

  // ── R6: Add form Enter ──
  await f.evaluate(() => go('add')); await sleep(300);
  const n0 = await f.evaluate(() => L().prayers.length);
  await f.click('#f-title'); await d.page.keyboard.type('Enter path test'); await d.page.keyboard.press('Enter'); await sleep(150);
  const a1 = await f.evaluate(() => document.activeElement.id);
  await d.page.keyboard.type('Someone'); await d.page.keyboard.press('Enter'); await sleep(150);
  const a2 = await f.evaluate(() => document.activeElement.id);
  await d.page.keyboard.type('line one'); await d.page.keyboard.press('Enter'); await d.page.keyboard.type('line two'); await sleep(150);
  const a3 = { focus: await f.evaluate(() => document.activeElement.id), n: await f.evaluate(() => L().prayers.length), detail: await f.evaluate(() => el('f-detail').value) };
  await d.page.keyboard.press('Control+Enter'); await sleep(400);
  const a4 = await f.evaluate(() => ({ n: L().prayers.length, last: L().prayers[L().prayers.length - 1].title + ' | ' + L().prayers[L().prayers.length - 1].detail, screen: document.querySelector('.screen.on').id }));
  log('R6_add', { n0, afterTitleEnter: a1, afterForEnter: a2, inDetail: a3, ctrlEnter: a4 });
  await f.evaluate(() => go('add')); await sleep(200);
  await f.click('#f-title'); await d.page.keyboard.press('Enter'); await sleep(200);
  log('R6_emptyTitleEnter', await f.evaluate(() => ({ focus: document.activeElement.id, err: el('f-titleErr').textContent })));
  await f.fill('#f-title', 'Phone path'); await f.click('#f-phone'); await d.page.keyboard.press('Enter'); await sleep(300);
  log('R6_phoneEnter', await f.evaluate(() => ({ last: L().prayers[L().prayers.length - 1].title, screen: document.querySelector('.screen.on').id })));

  // ── R7: One category only ──
  await f.evaluate(() => go('more')); await sleep(200);
  await f.click('[data-mode="focus"]'); await sleep(300);
  log('R7_focus', await f.evaluate(() => ({ list: D.activeList, focus: PL().focusCategory, today: todaySet().length })));
  log('logs', d.logs.filter(l => /error/i.test(l)).slice(0, 5));
} catch (e) { console.error(e); out.error = String(e.stack || e); }
finally { fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); await L.close(); }
