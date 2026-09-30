// Batch 3 copy of audits/tools/phase3/prayer/critic-keys.mjs.
// What changed on purpose: Escape now closes the sheet, the Kitchen view and an inline panel, and Enter submits the Add form and a one-line panel (P3-PRAYER-26), so the clean-up and control taps that followed each key (Done, Kitchen view from the More sheet, Close, Save, Create) are made only when that control is still on screen; the More sheet is reopened before Kitchen view.
// Evidence goes to audits/evidence/p6/3 instead of p3. What it measures is unchanged.
// Completeness critic, Prayer: CLAUDE.md "Adding an app" item 6 asks for Enter/Escape on inputs and dialogs.
// The only keydown handler in apps/prayer.html is Pray mode's (1709-1714). This checks, on the desktop device with a real
// keyboard: Escape on the detail sheet, the More sheet, Kitchen view and an ask() panel; Enter in the Add form's title
// and in an ask() text field.
// Run: node "audits/tools/phase3/prayer/critic-keys.mjs" -> audits/evidence/p6/3/critic-keys.json
// Review round 1: in the Add form Enter moves to the next field (the phone keyboard's "next") and saves only from the
// last one-line field, Their number, or with Ctrl/Cmd+Enter; so the Enter-adds check presses Enter in the title (focus must
// move to Who is it for?, nothing saved) and then in Their number (saved).
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
fs.mkdirSync('audits/evidence/p6/3', { recursive: true });
const OUT = 'audits/evidence/p6/3';
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v)); };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const d = await L.device({ device: 'desktop', profile: 'eli' });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 12000 }); await sleep(700);
  const on = id => f.evaluate(id => document.getElementById(id).classList.contains('on'), id);
  // detail sheet
  await f.click('#todayList [data-open]'); await sleep(400);
  await d.page.keyboard.press('Escape'); await sleep(400);
  log('detailSheetOpenAfterEscape', await on('sheet'));
  if (await f.evaluate(() => document.getElementById('sheet').classList.contains('on'))) await f.click('[data-shut]'); await sleep(300);
  // More sheet
  await f.click('#moreBtn'); await sleep(300); await d.page.keyboard.press('Escape'); await sleep(300);
  log('moreSheetOpenAfterEscape', await on('sheet'));
  // Kitchen view
  if (!(await f.evaluate(() => document.getElementById('sheet').classList.contains('on')))) { await f.click('#moreBtn'); await sleep(400); } await f.click('[data-more="kitchen"]'); await sleep(400); await d.page.keyboard.press('Escape'); await sleep(300);
  log('kitchenOpenAfterEscape', await on('kitchen'));
  if (await f.evaluate(() => document.getElementById('kitchen').classList.contains('on'))) await f.click('#kitchenShut'); await sleep(300);
  // Pray mode, the control: Escape closes it
  await f.click('#startPray'); await sleep(300); await d.page.keyboard.press('Escape'); await sleep(300);
  log('control_prayOpenAfterEscape', await on('pray'));
  // ask() panel: Add an update on a request
  await f.click('#todayList [data-open]'); await sleep(400);
  await f.click('[data-update]'); await sleep(300);
  await f.fill('#askIn', 'Critic: typed update'); await d.page.keyboard.press('Escape'); await sleep(300);
  log('askPanelOpenAfterEscape', await f.evaluate(() => !!document.querySelector('.ask')));
  await f.click('#askCancel').catch(() => {}); await f.click('[data-shut]').catch(() => {}); await sleep(300);
  // Enter in the Add form's title
  await f.click('nav [data-go="add"]'); await sleep(300);
  const before = await f.evaluate(() => L().prayers.length);
  await f.fill('#f-title', 'Critic: Enter should add this'); await f.press('#f-title', 'Enter'); await sleep(300); const movedTo = await f.evaluate(() => document.activeElement && document.activeElement.id); const nMid = await f.evaluate(() => L().prayers.length); console.log('enterInTitle ->', JSON.stringify({ focusMovedTo: movedTo, savedYet: nMid })); await f.press('#f-phone', 'Enter'); await sleep(600);
  log('addFormEnter', { prayersBefore: before, prayersAfter: await f.evaluate(() => L().prayers.length), screen: await f.evaluate(() => document.querySelector('.screen.on').id) });
  // Enter in an ask() text field: Settings → Add a category is a plain input; use New plan (ask kind text)
  await f.click('nav [data-go="more"]'); await sleep(300);
  await f.click('#f-newplan'); await sleep(300);
  const plans = await f.evaluate(() => L().plans.length);
  await f.press('#askIn', 'Enter'); await sleep(400);
  log('askTextEnter', { plansBefore: plans, plansAfter: await f.evaluate(() => L().plans.length), panelStillOpen: await f.evaluate(() => !!document.querySelector('.ask')) });
} catch (e) { log('error', String(e.stack || e)); }
finally { fs.writeFileSync(`${OUT}/critic-keys.json`, JSON.stringify(res, null, 2)); await L.close(); }
