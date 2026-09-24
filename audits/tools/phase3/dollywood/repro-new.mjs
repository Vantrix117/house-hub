// Phase 3 / dollywood: focused reproductions for defects this phase found that no earlier phase listed.
//   node "audits/tools/phase3/dollywood/repro-new.mjs" [3d-exit] [feed] [reset]
// 3d-exit  On a phone (< 700 px) the 2D button is hidden (CSS :333) and the 3D button's handler always calls setMode('3d')
//          (:1156), so tapping it again does not leave 3D. Control: a section chip does leave 3D (selectSection :1119).
//          Also records the readout text after returning to 2D on a touch device (:1154 hard-codes the mouse hint).
// feed     Each "Mark done" posts "Ticked <step title>" to the family feed (:1086): five ticks = five feed lines.
// reset    "Reset progress" is a native confirm() (:1098) and clears every section at once, with no undo.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const want = process.argv.slice(2); const on = a => !want.length || want.includes(a);
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const L = await local({ variant: 'typical', engine: 'webkit' });
const open = async device => { const d = await L.device({ device, profile: 'eli', fixedTime: false }); const f = await d.openApp('dollywood', { wait: '#b-count' }); await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 }); await sleep(600); return { d, f }; };
const tap = async (d, f, sel) => { const el = await f.$(sel); await el.scrollIntoViewIfNeeded(); const b = await el.boundingBox(); await d.page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
try {
  if (on('3d-exit')) {
    const { d, f } = await open('iphone-pwa');
    const btns = () => f.evaluate(() => ({ mode, m2d: { display: getComputedStyle(document.getElementById('m-2d')).display }, m3d: { text: document.getElementById('m-3d').textContent, pressed: document.getElementById('m-3d').getAttribute('aria-pressed') }, readout: document.getElementById('readout').textContent }));
    await tap(d, f, '#m-3d');
    await f.waitForFunction(() => typeof three !== 'undefined' && three, null, { timeout: 90000 }); await sleep(1200);
    const in3d = await btns();
    await tap(d, f, '#m-3d'); await sleep(800);
    const afterSecondTap = await btns();
    await tap(d, f, '#m-3d'); await sleep(800);
    const afterThirdTap = await btns();
    // what else on screen could take the person back: every visible button whose text or label says 2D / map / back
    const exits = await f.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent && /2d|map view|back|exit/i.test((b.textContent + ' ' + (b.getAttribute('aria-label') || '')))).map(b => b.id || b.textContent.trim()));
    await d.page.screenshot({ path: path.join(EV, 'phone-3d-after-second-tap.png'), scale: 'css', animations: 'disabled' });
    // control: a section chip leaves 3D
    await tap(d, f, '#chips button[data-sec="show"]'); await sleep(900);
    const afterChip = await btns();
    log('3d-exit', { in3d, afterSecondTap, afterThirdTap, visibleExitButtons: exits, afterSectionChip: afterChip, coarsePointer: await f.evaluate(() => matchMedia('(pointer:coarse)').matches), png: 'audits/evidence/p3/dollywood/phone-3d-after-second-tap.png' });
    await d.close();
  }
  if (on('feed')) {
    await L.reset('typical');
    const { d, f } = await open('ipad-portrait');
    const before = (await L.apiAs('eli', '/api/activity?limit=30')).body.activity || [];
    for (let i = 0; i < 5; i++) { await f.evaluate(() => document.getElementById('b-done').click()); await sleep(700); }
    await sleep(2500);
    const after = (await L.apiAs('eli', '/api/activity?limit=30')).body.activity || [];
    const newLines = after.filter(a => !before.some(b => b.id === a.id)).map(a => `${a.app_id}: ${a.text}`);
    log('feed', { newFeedLines: newLines.length, lines: newLines, readerIsFamily: 'GET /api/activity is the family feed read by Home and the TV (index.html loadFeed)' });
    await d.close();
  }
  if (on('reset')) {
    await L.reset('typical');
    const { d, f } = await open('ipad-portrait');
    const dialogs = []; d.page.on('dialog', async dg => { dialogs.push(`${dg.type()}: ${dg.message()}`); await dg.accept(); });
    await f.evaluate(() => document.getElementById('b-menu').click()); await sleep(200);
    await f.evaluate(() => document.getElementById('b-reset').click()); await sleep(2500);
    const r = await L.apiAs('eli', '/api/data/dollywood?scope=person&since=0'); const it = r.body.items.find(i => i.key === 'progress');
    log('reset', { dialogs, serverTicksAfter: it ? Object.keys(it.value).length : 0, chips: await f.evaluate(() => [...document.querySelectorAll('#chips .cl')].slice(1, 4).map(c => c.textContent.replace(/\s+/g, ' '))), undoOffered: await f.evaluate(() => /undo/i.test(document.body.innerText)) });
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(EV, 'repro-new' + (want.length ? '-' + want.join('-') : '') + '.json'), JSON.stringify(out, null, 1));
  await L.close();
}
