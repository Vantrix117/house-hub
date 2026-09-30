// Batch 3 copy of audits/tools/phase3/prayer/verify-critic-no-enter-escape-10-2.mjs.
// What changed on purpose: Escape now closes the sheet, the Kitchen view and an inline panel, and Enter submits the Add form and a one-line panel (P3-PRAYER-26), so the clean-up and control taps that followed each key (Done, Kitchen view from the More sheet, Close, Save, Create) are made only when that control is still on screen; the More sheet is reopened before Kitchen view.
// Evidence goes to audits/evidence/p6/3 instead of p3. What it measures is unchanged.
// Skeptic #2 for critic-no-enter-escape-10 (Prayer): Escape closes only Pray mode; Enter submits nothing.
// Independent re-run on a fresh local instance, in WebKit AND Chromium (to rule out a WebKit-on-Windows artefact),
// desktop 1440x900 as Eli. Adds controls the investigator did not run: the mouse path (Save / Create) does work,
// and a keyboard user can still close the sheet by focusing its Done button and pressing Enter (native button).
// Run: node "audits/tools/phase3/prayer/verify-critic-no-enter-escape-10-2.mjs"
//   -> audits/evidence/p6/3/verify-critic-no-enter-escape-10-2.json
// Review round 1: in the Add form Enter moves to the next field (the phone keyboard's "next") and saves only from the
// last one-line field, Their number, or with Ctrl/Cmd+Enter; so the Enter-adds check presses Enter in the title (focus must
// move to Who is it for?, nothing saved) and then in Their number (saved).
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
fs.mkdirSync('audits/evidence/p6/3', { recursive: true });
const OUT = 'audits/evidence/p6/3/verify-critic-no-enter-escape-10-2.json';
const all = {};
for (const engine of ['webkit', 'chromium']) {
  const res = {}; all[engine] = res;
  const log = (k, v) => { res[k] = v; console.log(engine, k, '->', JSON.stringify(v)); };
  const L = await local({ variant: 'typical', clock: 'demo', engine });
  try {
    const d = await L.device({ device: 'desktop', profile: 'eli' });
    const f = await d.openApp('prayer', { wait: '#todayLine' });
    await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 15000 }); await sleep(800);
    const on = id => f.evaluate(id => document.getElementById(id).classList.contains('on'), id);
    const key = k => d.page.keyboard.press(k);

    // 1. detail sheet + Escape
    await f.click('#todayList [data-open]'); await sleep(400);
    log('detailSheetOpenBefore', await on('sheet'));
    await key('Escape'); await sleep(400);
    log('detailSheetOpenAfterEscape', await on('sheet'));
    // keyboard fallback: focus Done and press Enter (native <button>)
    await f.focus('#sheet [data-shut]'); await key('Enter'); await sleep(400);
    log('detailSheetOpenAfterEnterOnDone', await on('sheet'));

    // 2. More sheet + Escape
    await f.click('#moreBtn'); await sleep(400);
    await key('Escape'); await sleep(300);
    log('moreSheetOpenAfterEscape', await on('sheet'));

    // 3. Kitchen view + Escape
    if (!(await f.evaluate(() => document.getElementById('sheet').classList.contains('on')))) { await f.click('#moreBtn'); await sleep(400); } await f.click('[data-more="kitchen"]'); await sleep(400);
    log('kitchenOpenBefore', await on('kitchen'));
    await key('Escape'); await sleep(300);
    log('kitchenOpenAfterEscape', await on('kitchen'));
    if (await f.evaluate(() => document.getElementById('kitchen').classList.contains('on'))) await f.click('#kitchenShut'); await sleep(300);

    // 4. control: Pray mode + Escape
    await f.click('#startPray'); await sleep(400);
    log('control_prayOpenBefore', await on('pray'));
    await key('Escape'); await sleep(300);
    log('control_prayOpenAfterEscape', await on('pray'));

    // 5. ask() panel (Add an update) + Escape
    await f.click('#todayList [data-open]'); await sleep(400);
    await f.click('[data-update]'); await sleep(300);
    await f.fill('#askIn', 'Verify: typed update');
    await key('Escape'); await sleep(300);
    log('askPanelOpenAfterEscape', await f.evaluate(() => !!document.querySelector('.ask')));
    log('askFieldStillHasText', await f.evaluate(() => (document.querySelector('#askIn') || {}).value || null));
    await f.click('#askCancel').catch(() => {}); await f.click('#sheet [data-shut]').catch(() => {}); await sleep(300);

    // 6. Add form: Enter in title, then the control (click Save)
    await f.click('nav [data-go="add"]'); await sleep(400);
    const before = await f.evaluate(() => L().prayers.length);
    await f.fill('#f-title', 'Verify: Enter should add this');
    await f.press('#f-title', 'Enter'); await sleep(300); const movedTo = await f.evaluate(() => document.activeElement && document.activeElement.id); const nMid = await f.evaluate(() => L().prayers.length); console.log('enterInTitle ->', JSON.stringify({ focusMovedTo: movedTo, savedYet: nMid })); await f.press('#f-phone', 'Enter'); await sleep(600);
    const afterEnter = await f.evaluate(() => L().prayers.length);
    const screenAfterEnter = await f.evaluate(() => document.querySelector('.screen.on').id);
    log('addFormInsideFormElement', await f.evaluate(() => !!document.getElementById('f-title').closest('form')));
    if (await f.evaluate(() => document.getElementById('s-add').classList.contains('on'))) await f.click('#f-save'); await sleep(600);
    log('addForm', { before, afterEnter, screenAfterEnter, afterSaveClick: await f.evaluate(() => L().prayers.length),
      screenAfterSave: await f.evaluate(() => document.querySelector('.screen.on').id) });

    // 7. New plan ask (text, prefilled "Weekday plan"): Enter, then the control (click Create)
    await f.click('nav [data-go="more"]'); await sleep(400);
    await f.click('#f-newplan'); await sleep(300);
    const plans0 = await f.evaluate(() => L().plans.length);
    const prefill = await f.evaluate(() => document.querySelector('#askIn').value);
    await f.press('#askIn', 'Enter'); await sleep(400);
    const plansAfterEnter = await f.evaluate(() => L().plans.length);
    const panelAfterEnter = await f.evaluate(() => !!document.querySelector('.ask'));
    if (await f.evaluate(() => !!document.getElementById('askSave'))) await f.click('#askSave'); await sleep(400);
    log('newPlan', { prefill, plans0, plansAfterEnter, panelAfterEnter, plansAfterCreateClick: await f.evaluate(() => L().plans.length) });

    log('keydownListenersInSource', 'see apps/prayer.html:1709 (the only one)');
  } catch (e) { log('error', String(e.stack || e)); }
  finally { await L.close(); }
}
fs.writeFileSync(OUT, JSON.stringify(all, null, 2));
console.log('wrote', OUT);
