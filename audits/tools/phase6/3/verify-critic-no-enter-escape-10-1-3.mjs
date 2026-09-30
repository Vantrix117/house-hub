// Batch 3 copy of audits/tools/phase3/prayer/verify-critic-no-enter-escape-10-1.mjs.
// What changed on purpose: Escape now closes the sheet, the Kitchen view and an inline panel, and Enter submits the Add form and a one-line panel (P3-PRAYER-26), so the clean-up and control taps that followed each key (Done, Kitchen view from the More sheet, Close, Save, Create) are made only when that control is still on screen; the More sheet is reopened before Kitchen view.
// Evidence goes to audits/evidence/p6/3 instead of p3. What it measures is unchanged.
// Skeptic #1 for finding critic-no-enter-escape-10 (Prayer): Escape closes only Pray mode; Enter submits nothing.
// Independent re-run. Fairness changes vs the investigator's script: focus is put on a control INSIDE each overlay before
// Escape (so the key really lands in the overlay); the ask() Enter test types a valid name; the Add form Enter test is
// followed by click controls proving the Save buttons work, so "nothing happened" is not a broken flow.
// Run: node "audits/tools/phase3/prayer/verify-critic-no-enter-escape-10-1.mjs"
//   -> audits/evidence/p6/3/verify-critic-no-enter-escape-10-1.json (+ one PNG of the sheet still open after Escape)
// Review round 1: in the Add form Enter moves to the next field (the phone keyboard's "next") and saves only from the
// last one-line field, Their number, or with Ctrl/Cmd+Enter; so the Enter-adds check presses Enter in the title (focus must
// move to Who is it for?, nothing saved) and then in Their number (saved).
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
fs.mkdirSync('audits/evidence/p6/3', { recursive: true });
const OUT = 'audits/evidence/p6/3';
const NAME = 'verify-critic-no-enter-escape-10-1';
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v)); };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const d = await L.device({ device: 'desktop', profile: 'eli' });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 15000 }); await sleep(800);
  const on = id => f.evaluate(id => document.getElementById(id).classList.contains('on'), id);
  const active = () => f.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.tagName + '.' + a.className) : null; });
  const viewerOpen = () => d.page.evaluate(() => { const fr = document.querySelector('iframe'); return !!fr && fr.getBoundingClientRect().width > 0; });

  // 1. Detail sheet: focus a button inside the sheet, press Escape.
  await f.click('#todayList [data-open]'); await sleep(500);
  await f.focus('#sheet [data-shut]').catch(() => {});
  const a1 = await active();
  await f.press('#sheet [data-shut]', 'Escape'); await sleep(400);
  log('1_detailSheet', { focusedBeforeEscape: a1, sheetOnAfterEscape: await on('sheet'), viewerStillOpen: await viewerOpen() });
  await d.page.screenshot({ path: `${OUT}/${NAME}-sheet-after-escape.png` });
  if (await f.evaluate(() => document.getElementById('sheet').classList.contains('on'))) await f.click('#sheet [data-shut]'); await sleep(400);
  log('1b_sheetClosesByButton', await on('sheet'));

  // 2. More sheet
  await f.click('#moreBtn'); await sleep(400);
  const firstBtn = await f.evaluate(() => { const b = document.querySelector('#sheet button'); b && b.focus(); return b ? (b.id || b.textContent.trim().slice(0, 30)) : null; });
  await d.page.keyboard.press('Escape'); await sleep(400);
  log('2_moreSheet', { focused: firstBtn, activeNow: await active(), sheetOnAfterEscape: await on('sheet') });

  // 3. Kitchen view (opened from the More sheet)
  if (!(await f.evaluate(() => document.getElementById('sheet').classList.contains('on')))) { await f.click('#moreBtn'); await sleep(400); } await f.click('[data-more="kitchen"]'); await sleep(500);
  await f.focus('#kitchenShut');
  await d.page.keyboard.press('Escape'); await sleep(400);
  log('3_kitchen', { kitchenOnAfterEscape: await on('kitchen') });
  if (await f.evaluate(() => document.getElementById('kitchen').classList.contains('on'))) await f.click('#kitchenShut'); await sleep(300);

  // 4. Control: Pray mode closes on Escape
  await f.click('#startPray'); await sleep(400);
  const prayOn = await on('pray');
  await d.page.keyboard.press('Escape'); await sleep(400);
  log('4_control_pray', { openedBefore: prayOn, prayOnAfterEscape: await on('pray') });

  // 5. ask() panel "Add an update", focus in its textarea/input, Escape
  await f.click('#todayList [data-open]'); await sleep(500);
  await f.click('[data-update]'); await sleep(300);
  const askKind = await f.evaluate(() => document.getElementById('askIn')?.tagName);
  await f.fill('#askIn', 'Skeptic typed update');
  await f.press('#askIn', 'Escape'); await sleep(300);
  log('5_askUpdate', { askFieldTag: askKind, askPanelAfterEscape: await f.evaluate(() => !!document.querySelector('.ask')), sheetOn: await on('sheet') });
  await f.click('#askCancel').catch(() => {}); await sleep(200);
  await f.click('#sheet [data-shut]').catch(() => {}); await sleep(400);

  // 6. Enter in Add form title (valid title), then the Save-click control
  await f.click('nav [data-go="add"]'); await sleep(400);
  const inForm = await f.evaluate(() => !!document.getElementById('f-title').closest('form'));
  const n0 = await f.evaluate(() => L().prayers.length);
  await f.fill('#f-title', 'Skeptic Enter test');
  await f.press('#f-title', 'Enter'); await sleep(300); const movedTo = await f.evaluate(() => document.activeElement && document.activeElement.id); const nMid = await f.evaluate(() => L().prayers.length); console.log('enterInTitle ->', JSON.stringify({ focusMovedTo: movedTo, savedYet: nMid })); await f.press('#f-phone', 'Enter'); await sleep(700);
  const n1 = await f.evaluate(() => L().prayers.length);
  const scr1 = await f.evaluate(() => document.querySelector('.screen.on').id);
  if (await f.evaluate(() => document.getElementById('s-add').classList.contains('on'))) await f.click('#f-save'); await sleep(700);
  const n2 = await f.evaluate(() => L().prayers.length);
  log('6_addForm', { titleInsideForm: inForm, before: n0, afterEnter: n1, screenAfterEnter: scr1, afterSaveClick: n2, screenAfterClick: await f.evaluate(() => document.querySelector('.screen.on').id) });

  // 7. Enter in ask() text field (New plan, prefilled valid "Weekday plan"), then the Create-click control
  await f.click('nav [data-go="more"]'); await sleep(400);
  await f.click('#f-newplan'); await sleep(300);
  const p0 = await f.evaluate(() => L().plans.length);
  const val = await f.inputValue('#askIn');
  const disabled = await f.evaluate(() => document.getElementById('askSave').disabled);
  await f.press('#askIn', 'Enter'); await sleep(500);
  const p1 = await f.evaluate(() => L().plans.length);
  const stillOpen = await f.evaluate(() => !!document.querySelector('.ask'));
  if (await f.evaluate(() => !!document.getElementById('askSave'))) await f.click('#askSave'); await sleep(500);
  const p2 = await f.evaluate(() => L().plans.length);
  log('7_askNewPlan', { value: val, saveDisabled: disabled, before: p0, afterEnter: p1, panelOpenAfterEnter: stillOpen, afterCreateClick: p2 });
} catch (e) { log('error', String(e.stack || e)); }
finally { fs.writeFileSync(`${OUT}/${NAME}.json`, JSON.stringify(res, null, 2)); await L.close(); }
