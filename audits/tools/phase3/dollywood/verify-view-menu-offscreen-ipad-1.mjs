// Phase 3 / dollywood skeptic check: does the View ▾ popover run past the right edge on iPad portrait?
// Opens the build guide in the hub viewer as Eli (typical seed), taps View ▾ with a real mouse click (after scrolling it
// into view), measures the popover and its controls against the iframe viewport and the page, and screenshots it.
// Compares iPad portrait (WebKit + Chromium) with iPad landscape and desktop.
//   node "audits/tools/phase3/dollywood/verify-view-menu-offscreen-ipad-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
async function check(L, engineTag, device, shotName) {
  const d = await L.device({ device, profile: 'eli', fixedTime: false });
  try {
    const f = await d.openApp('dollywood', { wait: '#b-count' });
    await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 30000 });
    await sleep(500);
    const pre = await f.evaluate(() => { const b = document.getElementById('view-btn'); const cs = getComputedStyle(b); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { btnDisplay: cs.display, btn: { x: Math.round(r.x), r: Math.round(r.right), y: Math.round(r.y), h: Math.round(r.height) } }; });
    await sleep(300);
    const br = await f.evaluate(() => { const r = document.getElementById('view-btn').getBoundingClientRect(); return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, vis: r.width > 0 }; });
    const fr = await (await f.frameElement()).boundingBox();
    if (br.vis) await d.page.mouse.click(fr.x + br.cx, fr.y + br.cy); await sleep(400);
    const m = await f.evaluate(() => {
      const q = s => document.querySelector(s); const R = e => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), r: Math.round(r.right), y: Math.round(r.y), b: Math.round(r.bottom), w: Math.round(r.width) }; };
      const vm = q('#vmenu');
      // nearest ancestor that clips horizontally
      let clip = null; for (let e = vm.parentElement; e; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if (o !== 'visible') { clip = { tag: e.tagName, id: e.id, cls: e.className, overflowX: o, ...R(e) }; break; } }
      return { hidden: vm.hidden, display: getComputedStyle(vm).display, position: getComputedStyle(vm).position, menu: R(vm), select: R(q('#cint')), steepCheckbox: R(q('#v-slope')), rows: [...vm.querySelectorAll('.vrow')].map(r => r.textContent.trim().replace(/\s+/g, ' ')), themeRow: !!q('#theme-row'),
        vw: innerWidth, docClientW: document.documentElement.clientWidth, docScrollW: document.documentElement.scrollWidth, bodyScrollW: document.body.scrollWidth, htmlOverflowX: getComputedStyle(document.documentElement).overflowX, bodyOverflowX: getComputedStyle(document.body).overflowX, clipAncestor: clip, scrollX };
    });
    const res = { device, engine: engineTag, iframeInPage: { x: Math.round(fr.x), w: Math.round(fr.width) }, pageW: d.page.viewportSize().width, ...pre, ...m, overflowPx: m.menu ? m.menu.r - m.vw : null, checkboxOffscreen: m.steepCheckbox ? m.steepCheckbox.r > m.vw : null, selectOffscreen: m.select ? m.select.r > m.vw : null };
    log(`${engineTag}.${device}`, res);
    if (shotName) { const p = path.join(EV, shotName); await d.page.screenshot({ path: p, scale: 'css', animations: 'disabled', caret: 'hide' }); log(`${engineTag}.${device}.png`, path.relative(process.cwd(), p).split(path.sep).join('/')); }
    // tapping the checkbox where it is: does it toggle?
    if (m.steepCheckbox && m.steepCheckbox.w) {
      const cx = Math.min(m.steepCheckbox.x + 9, m.vw - 1);
      await d.page.mouse.click(fr.x + cx, fr.y + m.steepCheckbox.y + 9); await sleep(200);
      log(`${engineTag}.${device}.tapCheckboxAtVisiblePart`, await f.evaluate(() => ({ checked: document.getElementById('v-slope').checked, menuHidden: document.getElementById('vmenu').hidden })));
    }
  } finally { await d.close(); }
}
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  await check(L, 'webkit', 'ipad-portrait', 'verify-view-menu-offscreen-ipad-1-portrait.png');
  await check(L, 'webkit', 'ipad-landscape', null);
  await check(L, 'webkit', 'desktop', null);
} finally { await L.close(); }
const L2 = await local({ variant: 'typical', engine: 'chromium' });
try { await check(L2, 'chromium', 'ipad-portrait', null); } finally { await L2.close(); }
fs.writeFileSync(path.join(EV, 'verify-view-menu-offscreen-ipad-1.json'), JSON.stringify(out, null, 1));
console.log('wrote audits/evidence/p3/dollywood/verify-view-menu-offscreen-ipad-1.json');
