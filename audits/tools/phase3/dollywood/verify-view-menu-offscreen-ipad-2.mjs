// Skeptic #2 for finding "view-menu-offscreen-ipad": does the View ▾ popover (#vmenu) run past the right edge on iPad
// portrait, is anything actually unreachable, and is it engine/font dependent? Rerunnable:
//   node "audits/tools/phase3/dollywood/verify-view-menu-offscreen-ipad-2.mjs"
// Writes audits/evidence/p3/dollywood/verify-view-menu-offscreen-ipad-2.json (+ one PNG).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };

async function measure(L, device, tag, shotName) {
  const d = await L.device({ device, profile: 'eli', fixedTime: false });
  const f = await d.openApp('dollywood', { wait: '#b-count' });
  await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 30000 });
  await sleep(500);
  const frameBox = await (await f.frameElement()).boundingBox();
  const btnVisible = await f.evaluate(() => { const b = document.getElementById('view-btn'); return !!b && getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().width > 0; });
  if (!btnVisible) { log(tag, { device, viewBtnVisible: false, note: 'View button hidden at this width (More disclosure instead)' }); await d.close(); return; }
  // real tap on the View button (page mouse, through the shell)
  const vb = await f.evaluate(() => { const r = document.getElementById('view-btn').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await d.page.mouse.click(frameBox.x + vb.x, frameBox.y + vb.y); await sleep(400);
  const m = await f.evaluate(() => {
    const R = e => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width) }; };
    const menu = document.getElementById('vmenu'), sel = document.getElementById('cint'), cb = document.getElementById('v-slope');
    const cbr = cb.getBoundingClientRect(), sr = sel.getBoundingClientRect();
    const hitCb = document.elementFromPoint(cbr.left + cbr.width / 2, cbr.top + cbr.height / 2);
    const hitSel = document.elementFromPoint(Math.min(innerWidth - 2, sr.left + sr.width / 2), sr.top + sr.height / 2);
    return {
      menuHidden: menu.hidden, menu: R(menu), viewBtn: R(document.getElementById('view-btn')), toolbar: R(document.getElementById('toolbar')),
      select: R(sel), checkbox: R(cb), vw: innerWidth, docScrollW: document.documentElement.scrollWidth, docClientW: document.documentElement.clientWidth,
      bodyOverflowX: getComputedStyle(document.body).overflowX, htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
      overflowPx: Math.round(menu.getBoundingClientRect().right - innerWidth),
      checkboxCentreOnScreen: cbr.left + cbr.width / 2 <= innerWidth, checkboxCentreHit: hitCb ? (hitCb.id || hitCb.tagName) : null,
      selectCentreClampedHit: hitSel ? (hitSel.id || hitSel.tagName) : null,
      checkboxVisiblePx: Math.max(0, Math.round(Math.min(cbr.right, innerWidth) - cbr.left)), checkboxW: Math.round(cbr.width),
      selectVisiblePx: Math.max(0, Math.round(Math.min(sr.right, innerWidth) - sr.left)), selectW: Math.round(sr.width),
      font: getComputedStyle(document.getElementById('view-btn')).fontFamily,
      flavor: document.documentElement.dataset.flavor || document.body.dataset.flavor || null,
      toolbarRowWidthsLeftOfView: [...document.querySelectorAll('#toolbar button')].filter(b => b.getBoundingClientRect().width && b.getBoundingClientRect().right <= document.getElementById('view-btn').getBoundingClientRect().left + 1).length,
    };
  });
  // Is the steepness toggle still reachable by tapping its visible label text?
  let labelTap = null;
  if (!m.menuHidden) {
    const lab = await f.evaluate(() => { const s = document.querySelector('#v-slope').closest('label').querySelector('span').getBoundingClientRect(); return { x: s.x + s.width / 2, y: s.y + s.height / 2 }; });
    const before = await f.evaluate(() => document.getElementById('v-slope').checked);
    await d.page.mouse.click(frameBox.x + lab.x, frameBox.y + lab.y); await sleep(400);
    const after = await f.evaluate(() => ({ v: document.getElementById('v-slope').checked, l: document.getElementById('l-slope').checked, menuHidden: document.getElementById('vmenu').hidden }));
    labelTap = { before, after };
  }
  log(tag, { device, frameBox: { x: Math.round(frameBox.x), w: Math.round(frameBox.width) }, ...m, labelTapTogglesSteepness: labelTap });
  if (shotName) { await d.page.screenshot({ path: path.join(EV, shotName), scale: 'css', animations: 'disabled', caret: 'hide' }); log(tag + '.png', 'audits/evidence/p3/dollywood/' + shotName); }
  await d.close();
}

for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', engine });
  try {
    await measure(L, 'ipad-portrait', engine + '.ipad-portrait', engine === 'webkit' ? 'verify-view-menu-offscreen-ipad-2-webkit.png' : null);
    await measure(L, 'ipad-landscape', engine + '.ipad-landscape', null);
    if (engine === 'webkit') await measure(L, 'desktop', engine + '.desktop', null);
  } catch (e) { log(engine + '.error', String(e && e.stack || e)); }
  finally { await L.close(); }
}
fs.writeFileSync(path.join(EV, 'verify-view-menu-offscreen-ipad-2.json'), JSON.stringify(out, null, 1));
console.log('wrote audits/evidence/p3/dollywood/verify-view-menu-offscreen-ipad-2.json');
