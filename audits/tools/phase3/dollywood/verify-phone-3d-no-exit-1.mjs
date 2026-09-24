// Phase 3 / dollywood, skeptic #1 for finding "phone-3d-no-exit": on a phone (< 700 px) is there no way back from 3D
// through the 3D/2D controls?  node "audits/tools/phase3/dollywood/verify-phone-3d-no-exit-1.mjs"
// Code under test: apps/dollywood.html:333 (#m-2d display:none inside @media(max-width:699px) opened at :313, closed :380),
// :1156 (#m-3d onclick always setMode('3d')), :856 (T key toggles), :1119 / :1087 / :1149 (chip, Show on map, legend leave 3D).
// Real mouse clicks at element centres; records mode after each tap, which buttons are visible in the viewport in 3D,
// whether the chips / sheet "Show on map" are on screen, and a control on ipad-portrait (2D button visible there).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const L = await local({ variant: 'typical', engine: 'webkit' });
const open = async device => {
  const d = await L.device({ device, profile: 'eli', fixedTime: false });
  const f = await d.openApp('dollywood', { wait: '#b-count' });
  await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 30000 });
  await sleep(800); return { d, f };
};
const click = async (d, f, sel) => { const el = await f.$(sel); await el.scrollIntoViewIfNeeded(); const b = await el.boundingBox(); await d.page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
const state = f => f.evaluate(() => ({
  mode, innerWidth,
  m2d: { display: getComputedStyle(document.getElementById('m-2d')).display, pressed: document.getElementById('m-2d').getAttribute('aria-pressed') },
  m3d: { text: document.getElementById('m-3d').textContent.trim(), pressed: document.getElementById('m-3d').getAttribute('aria-pressed') },
  view3d: getComputedStyle(document.getElementById('view3d')).display,
  readout: document.getElementById('readout').textContent,
}));
// every visible control inside the iframe viewport, with its label, so a reader can see what the person is offered in 3D
const visibleControls = f => f.evaluate(() => [...document.querySelectorAll('button,[role=button],select')].filter(b => {
  const r = b.getBoundingClientRect(); const cs = getComputedStyle(b);
  return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
}).map(b => ({ id: b.id || null, sec: b.dataset.sec || null, text: (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30), label: b.getAttribute('aria-label') || b.title || null, top: Math.round(b.getBoundingClientRect().top) })));
try {
  // 1. phone: tap 3D, wait for the model, tap 3D twice more
  {
    const { d, f } = await open('iphone-pwa');
    const before = await state(f);
    await click(d, f, '#m-3d');
    await f.waitForFunction(() => typeof three !== 'undefined' && three, null, { timeout: 120000 }); await sleep(1500);
    const in3d = await state(f);
    await click(d, f, '#m-3d'); await sleep(900); const tap2 = await state(f);
    await click(d, f, '#m-3d'); await sleep(900); const tap3 = await state(f);
    const controls = await visibleControls(f);
    const exitWords = controls.filter(c => /\b2d\b|map|back|exit|close|flat/i.test(`${c.text} ${c.label || ''}`));
    await d.page.screenshot({ path: path.join(EV, 'verify-phone-3d-no-exit-1-phone-3d.png'), scale: 'css', animations: 'disabled' });
    // is any help text on screen about leaving 3D?
    const helpMentionsExit = await f.evaluate(() => /2d|flat map|back to|exit 3d|leave 3d/i.test(document.getElementById('readout').textContent + ' ' + (document.getElementById('maphint')?.textContent || '')));
    // the Fit button: does it leave 3D? (z-fit :821 calls fitTarget only)
    await click(d, f, '#z-fit'); await sleep(900); const afterFit = await state(f);
    // control exit 1: a section chip (selectSection :1119)
    const chipSel = await f.evaluate(() => { const b = [...document.querySelectorAll('#chips button')].find(x => x.dataset.sec !== 'all'); return b ? `#chips button[data-sec="${b.dataset.sec}"]` : null; });
    await click(d, f, chipSel); await sleep(1200); const afterChip = await state(f);
    // back to 3D, control exit 2: the sheet's "Show on map" (go :1087)
    await click(d, f, '#m-3d'); await sleep(1500); const back3d = await state(f);
    const showBtnVisible = await f.evaluate(() => { const b = document.getElementById('b-show'); if (!b) return null; const r = b.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), innerHeight, inViewport: r.bottom > 0 && r.top < innerHeight && r.height > 0 }; });
    await click(d, f, '#b-show'); await sleep(1200); const afterShow = await state(f);
    // keyboard T (:856) is not available on a phone without a keyboard; recorded only as the desktop toggle
    log('phone', { before, in3d, tap2, tap3, afterFit, chipSel, afterChip, back3d, showBtnVisible, afterShow, helpMentionsExit, exitWordControlsVisibleIn3d: exitWords, visibleControlsIn3d: controls, coarse: await f.evaluate(() => matchMedia('(pointer:coarse)').matches), png: 'audits/evidence/p3/dollywood/verify-phone-3d-no-exit-1-phone-3d.png' });
    await d.close();
  }
  // 2. control: iPad portrait (820 px) — the 2D button is shown and leaves 3D
  {
    const { d, f } = await open('ipad-portrait');
    await click(d, f, '#m-3d');
    await f.waitForFunction(() => typeof three !== 'undefined' && three, null, { timeout: 120000 }); await sleep(1200);
    const in3d = await state(f);
    await click(d, f, '#m-3d'); await sleep(700); const tap2 = await state(f);
    await click(d, f, '#m-2d'); await sleep(900); const after2d = await state(f);
    log('ipad', { in3d, tap2, after2d });
    await d.close();
  }
} catch (e) { console.error('ERROR', e); out.error = String(e); }
finally {
  fs.writeFileSync(path.join(EV, 'verify-phone-3d-no-exit-1.json'), JSON.stringify(out, null, 1));
  await L.close();
}
