// Batch 9, Worker B: the Dollywood build guide, on the audit rig (a real Chromium with software WebGL, the hub's viewer, the real Worker
// and a seeded D1; the cloud runner has no WebKit, so everything below says Chromium where an earlier phase said WebKit).
//
//  sheet    P3-DOLLYWOOD-03   the … menu on a phone is a bottom action sheet (Export, Import, Reset in danger ink, Cancel, rows >= 52 px, all inside
//                             the screen), the backdrop and Escape close it, focus goes to the first row and back to …; from 700 px a popover
//  toggle   P3-DOLLYWOOD-04   the 3D button toggles (aria-pressed) and a "Back to map" capsule sits at the 3D view's top left on a phone and an iPad
//  hint     P3-DOLLYWOOD-14, VIS-DOLLYWOOD-11   leaving 3D writes the touch hint, 3D on a touch screen says "Drag to turn · pinch to zoom" and wraps
//  raf      P3-DOLLYWOOD-09   no animation frame is requested in 2D after 3D was opened (the render loop is cancelled, restarted on entering)
//  outline  GAP-DOLLYWOOD-1   in 3D the step is drawn (a line loop 3 m up in the person's accent, a 6 m curtain), framed; Previous / Next / Mark done
//                             stay in 3D and move it; Show on map goes to 2D
//  sky      VIS-DOLLYWOOD-16  the phone's 3D home view: sky at most 15 % of the part of the view above the sheet's peek
//  upright  P3-DOLLYWOOD-11, P3-DOLLYWOOD-LIVE-09   Upright never fits a section: Whole park pressed fits the whole park, otherwise it rotates the
//                             view in place (same centre, same scale); the same handler serves the park map's compass
//  phonefit P3-DOLLYWOOD-05   with Upright on, a phone's section fit frames the rotated section above the sheet
//  filter   P3-DOLLYWOOD-06, P3-DOLLYWOOD-LIVE-14   "up to 36″" keeps the rides with no minimum, in both exports' listItems
//  plot     P3-DOLLYWOOD-07, -15, -18, UX-DOLLYWOOD-12   the card follows the factor, a null plot clears the other device, the legacy dw-plot never
//                             comes back and is removed, 50-2,000 m or empty (else a role=alert line, nothing saved, nothing converted), the copy
//  sticky   UX-DOLLYWOOD-1, CONS-SHAPE-4   >= 700 px: a glass bar pinned to the bottom while the card's controls are off screen; ONE tap on its
//                             Mark done (a --btn-h-lg capsule) ticks the step; hidden on a phone and while the controls are in view
//  summary  UX-DOLLYWOOD-1   the person row `summary` (next step, section figures, totals), written 2 s after a change and only when it differs;
//                             the guide opens at the step it points to without scrolling
//  feed     UX-DOLLYWOOD-11   a tick posts nothing at once; tick + untick inside 60 s posts nothing; 3 ticks post ONE line; one per section
//  done     IMP-DOLLYWOOD-I1  finishing a section: one toast "<Section> done — N steps" and the chip's calm check, once, never on load, no feed line
//  search   UX-DOLLYWOOD-4    the results list under the field (<= 8 rows of 44 px, "Show all N in Listings", "No match for …", arrows / Enter /
//                             Escape / blur), a single match still flies to it
//  nextun   UX-DOLLYWOOD-7    Next unfinished on a phone raises the sheet to half and the new step shows
//  mapview  UX-DOLLYWOOD-2    Next / Previous / Show on map / a list tap bring the map into view at every size, unless 60 % of it already is
//  readonly UX-DOLLYWOOD-14   the display profile has no Mark done, Reset or Import, a read-only plot field; Previous / Next stay
//  cls      CONS-MOTION-4     the guide's cold open: landmark moves 0 (iPad portrait and iPhone, requests 150 ms late, and the slow first pull)
//  live     UNFILED-2         the park map never moves the guide's legacy progress or plot: 0 `step:` rows (and no `plot` row) in dollywood-live
//
//   node "audits/tools/phase6/9/guide-b-9.mjs"       ONLY=sheet,toggle,hint,raf,outline,sky,upright,phonefit,filter,plot,sticky,summary,feed,done,search,nextun,mapview,readonly,cls,live
//   OVERLAY=audits/tools/b-overlay  serves a freshly built apps/ over the repo (before the export); SHOTS=<dir> keeps pictures
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const ROOT = process.cwd();
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const want = s => !ONLY || ONLY.includes(s);
const SHOTS = process.env.SHOTS || path.join(ROOT, 'audits', 'evidence', 'p6', '9', 'guide-b'); fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x).slice(0, 700)); } };
const info = (n, x) => console.log('  ·', n, x === undefined ? '' : JSON.stringify(x).slice(0, 500));
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium', overlay: process.env.OVERLAY, args: ARGS });
const DEV = { phone: 'iphone-pwa', ipad: 'ipad-portrait', land: 'ipad-landscape', desk: 'desktop' };
const RAF = () => { window.__raf = 0; const o = window.requestAnimationFrame; window.requestAnimationFrame = f => { window.__raf++; return o.call(window, f); }; };
const LOAD = 90000;

async function open(dev, { variant = 'typical', profile = 'eli', id = 'dollywood', ls, installClock, mode = 'light', reset = true } = {}) {
  if (reset) await L.reset(variant);
  const d = await L.device({ device: DEV[dev] || dev, profile, mode, fixedTime: false, localStorage: ls, installClock });
  await d.ctx.addInitScript(RAF);
  const f = await d.openApp(id, { wait: id === 'dollywood' ? '#b-count' : '#loc-btn' });
  if (id === 'dollywood') await f.waitForFunction(() => /of \d+ done|not written/.test(document.getElementById('b-count').textContent), null, { timeout: LOAD });
  await sleep(300);
  return { d, f };
}
const fbox = async f => (await f.frameElement()).boundingBox();
// a real tap at the centre of an element: it must be what the finger hits (the element or inside it)
async function tap(d, f, sel, { scroll = true } = {}) {
  const hit = await f.evaluate(({ sel, scroll }) => {
    const e = document.querySelector(sel); if (!e) return null; if (scroll) e.scrollIntoView({ block: 'center', inline: 'center' });
    const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, h = document.elementFromPoint(cx, cy);
    return { cx, cy, ok: !!h && (h === e || e.contains(h) || h.contains(e)), hit: h ? (h.id || h.tagName) : null };
  }, { sel, scroll });
  if (!hit) throw new Error('no element ' + sel);
  const b = await fbox(f); await d.page.mouse.click(b.x + hit.cx, b.y + hit.cy); return hit;
}
const rowsOf = async (path) => { const r = await L.apiAs('eli', path); return (r.body && (r.body.items || r.body.rows || r.body.data)) || []; };
const stepRows = (app = 'dollywood') => rowsOf(`/api/data/${app}?scope=person&prefix=step:`);
const waitUntil = async (fn, ms = 20000, every = 200) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch {} await sleep(every); } return null; };
const progressNow = async () => { const o = {}; const base = (await rowsOf('/api/data/dollywood?scope=person&prefix=progress'))[0]; if (base && base.value) for (const k in base.value) if (base.value[k]) o[k] = true;
  for (const r of await stepRows()) { const id = r.key.slice(5); if (r.value === false) delete o[id]; else if (r.value) o[id] = true; } return o; };
const hexOf = (rgb) => '#' + rgb.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const rgbOf = s => (s.match(/[\d.]+/g) || []).map(Number);
const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const A = lum(a), B = lum(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };
const go3d = async (d, f) => { await tap(d, f, '#m-3d'); await f.waitForFunction(() => typeof three !== 'undefined' && !!three && window.TD, null, { timeout: 180000 }); await f.waitForFunction(() => window.TD && TD.info().step, null, { timeout: 60000 }).catch(() => {}); await sleep(400); };
const shot = async (d, name) => { try { await d.page.screenshot({ path: path.join(SHOTS, name), timeout: 180000 }); } catch (e) { info('(screenshot skipped: ' + name + ')'); } };

try {
  // ── sheet ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  if (want('sheet')) {
    console.log('\n## P3-DOLLYWOOD-03  the … menu');
    const { d, f } = await open('phone');
    await tap(d, f, '#b-menu'); await sleep(300);
    const m = await f.evaluate(() => {
      const bm = document.getElementById('bmenu'), rows = ['b-export', 'b-import', 'b-reset', 'b-cancel'].map(i => document.getElementById(i)), R = e => e.getBoundingClientRect();
      const probe = document.createElement('i'); probe.style.color = 'var(--danger-ink)'; document.body.appendChild(probe); const danger = getComputedStyle(probe).color; probe.remove();
      return { hidden: bm.hidden, pos: getComputedStyle(bm).position, rows: rows.map(e => ({ id: e.id, h: Math.round(R(e).height), vis: getComputedStyle(e).display !== 'none' && !e.hidden, in: R(e).top >= 0 && R(e).bottom <= innerHeight && R(e).left >= 0 && R(e).right <= innerWidth })),
        bd: !document.getElementById('bmenu-bd').hidden, focus: document.activeElement.id, role: bm.getAttribute('role'), danger, reset: getComputedStyle(document.getElementById('b-reset')).color, expanded: document.getElementById('b-menu').getAttribute('aria-expanded'),
        over: (() => { const mid = R(bm); const h = document.elementFromPoint(mid.left + mid.width / 2, mid.top + 6); return !!h && bm.contains(h); })() };
    });
    ok(!m.hidden && m.pos === 'fixed' && m.rows.length === 4 && m.rows.every(r => r.vis && r.h >= 52 && r.in), 'on a phone the … menu is a bottom sheet: Export, Import, Reset, Cancel, every row >= 52 px and inside the screen', m);
    ok(m.bd && m.focus === 'b-export' && m.role === 'dialog' && m.expanded === 'true', 'with a backdrop, focus on the first row, a dialog for assistive tech', m);
    ok(m.reset === m.danger, 'Reset reads in the danger ink', { reset: m.reset, danger: m.danger });
    ok(m.over, 'the sheet is on top of the build sheet (nothing clips it)');
    await shot(d, 'sheet-phone.png');
    await d.page.keyboard.press('Escape'); await sleep(200);
    ok(await f.evaluate(() => document.getElementById('bmenu').hidden && document.activeElement.id === 'b-menu'), 'Escape closes it and focus is back on …');
    await tap(d, f, '#b-menu'); await sleep(200); const fb = await fbox(f); await d.page.mouse.click(fb.x + 30, fb.y + 60); await sleep(250);
    ok(await f.evaluate(() => document.getElementById('bmenu').hidden), 'a tap on the backdrop closes it');
    await tap(d, f, '#b-menu'); await sleep(200); await tap(d, f, '#b-cancel', { scroll: false }); await sleep(250);
    ok(await f.evaluate(() => document.getElementById('bmenu').hidden && document.activeElement.id === 'b-menu'), 'Cancel closes it, focus back on …');
    await tap(d, f, '#b-menu'); await sleep(200); await tap(d, f, '#b-reset', { scroll: false }); await sleep(400);
    ok(await f.evaluate(() => { const t = document.getElementById('ask-t'); return !!t && /Reset progress/.test(t.textContent); }), 'Reset asks first (the confirm sheet), the menu has closed', await f.evaluate(() => document.getElementById('bmenu').hidden));
    await f.evaluate(() => document.getElementById('ask-no').click()); await sleep(200);
    ok(await f.evaluate(() => document.activeElement && document.activeElement.id === 'b-menu'), 'Cancel on the confirm returns focus to …', await f.evaluate(() => document.activeElement && document.activeElement.id));
    ok(Object.keys(await progressNow()).length === 24, 'nothing was reset (24 steps still done)');
    await d.close();
    { const { d, f } = await open('ipad'); await f.evaluate(() => { window.__rz = 0; window.__ev = []; window.addEventListener('resize', () => { window.__rz++; }); document.addEventListener('click', e => window.__ev.push('click:' + (e.target.id || e.target.tagName)), true); }); await tap(d, f, '#b-menu'); await sleep(300);
      if (await f.evaluate(() => document.getElementById('bmenu').hidden)) { info('the popover was closed by a resize of the frame; opening it again', await f.evaluate(() => ({ rz: window.__rz, ev: window.__ev }))); await tap(d, f, '#b-menu'); await sleep(300); }
      const p = await f.evaluate(() => { const bm = document.getElementById('bmenu'), r = bm.getBoundingClientRect(); return { hidden: bm.hidden, pos: getComputedStyle(bm).position, in: r.left >= 8 - 0.5 && r.right <= innerWidth - 8 + 0.5 && r.top >= 0 && r.bottom <= innerHeight, bd: document.getElementById('bmenu-bd').hidden, cancel: getComputedStyle(document.getElementById('b-cancel')).display }; });
      p.rz = await f.evaluate(() => window.__rz); p.ev = await f.evaluate(() => window.__ev); p.rect = await f.evaluate(() => { const r = document.getElementById('bmenu').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round); }); p.vw = await f.evaluate(() => [innerWidth, innerHeight]);
      ok(!p.hidden && p.pos === 'absolute' && p.in && p.bd && p.cancel === 'none', 'from 700 px it stays a popover (no backdrop, no Cancel), inside the viewport', p);
      await d.page.keyboard.press('Escape'); await sleep(150); ok(await f.evaluate(() => document.getElementById('bmenu').hidden), 'Escape closes the popover'); await d.close(); }
  }

  // ── toggle / hint / raf ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  if (want('toggle') || want('hint') || want('raf')) {
    console.log('\n## P3-DOLLYWOOD-04 / -09 / -14, VIS-DOLLYWOOD-11  3D: the way back, the loop, the hint');
    for (const dev of ['phone', 'ipad']) {
      const { d, f } = await open(dev);
      const hint2 = await f.evaluate(() => document.getElementById('readout').textContent);
      ok(hint2 === 'Tap anything for details · pinch to zoom', `${dev}: the boot hint is the touch hint`, hint2);
      await go3d(d, f);
      const s = await f.evaluate(() => { const b = document.getElementById('back2d'), mb = document.querySelector('.mapbox'), r = b.getBoundingClientRect(), m = mb.getBoundingClientRect(), ro = document.getElementById('readout'); return {
        mode, pressed: document.getElementById('m-3d').getAttribute('aria-pressed'), shown: getComputedStyle(b).display !== 'none', dx: Math.round(r.left - m.left), dy: Math.round(r.top - m.top), h: Math.round(r.height), text: b.textContent.trim(), hint: ro.textContent, wrap: getComputedStyle(ro).whiteSpace, fits: ro.scrollWidth <= ro.clientWidth + 1, hasIcon: !!b.querySelector('svg.sym use[href*="i-map"]') }; });
      ok(s.mode === '3d' && s.pressed === 'true', `${dev}: 3D is on and its button is pressed`, s);
      ok(s.shown && s.text === 'Back to map' && s.dx <= 16 && s.dy <= 16 && s.h >= 44 && s.hasIcon, `${dev}: "Back to map" (the map icon, >= 44 px) sits at the 3D view's top left`, s);
      ok(s.hint === 'Drag to turn · pinch to zoom' && s.wrap === 'normal' && s.fits, `${dev}: the 3D hint on a touch screen has no keys and wraps instead of scrolling`, s);
      if (want('raf')) { ok(await f.evaluate(() => TD.info().raf), `${dev}: the render loop runs in 3D`); }
      await tap(d, f, '#m-3d'); await sleep(500);
      const t = await f.evaluate(() => ({ mode, pressed: document.getElementById('m-3d').getAttribute('aria-pressed'), hint: document.getElementById('readout').textContent, back: getComputedStyle(document.getElementById('back2d')).display }));
      ok(t.mode === '2d' && t.pressed === 'false' && t.back === 'none', `${dev}: the pressed 3D button takes you back to 2D`, t);
      ok(t.hint === 'Tap anything for details · pinch to zoom', `${dev}: back in 2D the hint is the touch hint, not the mouse one`, t.hint);
      if (want('raf')) {
        await f.evaluate(() => { window.__raf = 0; }); await sleep(1800); const n = await f.evaluate(() => window.__raf);
        ok(n <= 2 && !(await f.evaluate(() => TD.info().raf)), `${dev}: no animation frame is requested in 2D after 3D (${n} in 1.8 s)`, n);
        await go3d(d, f); await tap(d, f, '#back2d'); await sleep(400);
        await f.evaluate(() => { window.__raf = 0; }); await sleep(1200); const n2 = await f.evaluate(() => window.__raf);
        ok(n2 <= 2, `${dev}: nor after Back to map (${n2})`, n2);
        await go3d(d, f); ok(await f.evaluate(() => TD.info().raf), `${dev}: entering 3D again restarts the loop`);
      }
      await d.close();
    }
  }

  // ── outline / sky ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  if (want('outline') || want('sky')) {
    console.log('\n## GAP-DOLLYWOOD-1, VIS-DOLLYWOOD-16  the step in 3D, the phone camera');
    const { d, f } = await open('ipad');
    await go3d(d, f);
    const st0 = await f.evaluate(() => { const i = TD.info(); const probe = document.createElement('i'); probe.style.color = 'var(--accent-graphic)'; document.body.appendChild(probe); const acc = getComputedStyle(probe).color; probe.remove();
      const s = i.step; const ndc = s ? [[s.cx, s.cz], [s.cx - s.size / 2, s.cz - s.size / 2], [s.cx + s.size / 2, s.cz + s.size / 2]].map(p => TD.ndc(p[0], i.target[1], p[1])) : null; return { i, acc, ndc, idx: curIdx, mode }; });
    ok(st0.i.step && st0.i.step.loops >= 1 && st0.i.step.lift === 3 && st0.i.step.curtain === 6, 'the current step is drawn in 3D: a line loop 3 m above the ground and a 6 m curtain', st0.i.step);
    ok(st0.i.step && '#' + st0.i.step.hex === hexOf(rgbOf(st0.acc)), 'in the person\'s accent graphic colour', { hex: st0.i.step && st0.i.step.hex, acc: st0.acc });
    ok(st0.ndc && st0.ndc.every(([x, y]) => Math.abs(x) <= 1.02 && Math.abs(y) <= 1.02) && Math.abs(st0.ndc[0][0]) < 0.5 && Math.abs(st0.ndc[0][1]) < 0.6, 'and the camera frames it on entering 3D (its box inside the view, centred)', st0.ndc);
    await tap(d, f, '#b-next'); await sleep(500);
    const st1 = await f.evaluate(() => ({ i: TD.info(), idx: curIdx, mode }));
    ok(st1.mode === '3d' && st1.idx === st0.idx + 1 && JSON.stringify(st1.i.step) !== JSON.stringify(st0.i.step), 'Next stays in 3D and moves the outline', { before: st0.i.step, after: st1.i.step });
    ok(JSON.stringify(st1.i.target) !== JSON.stringify(st0.i.target), 'and the camera');
    await tap(d, f, '#b-prev'); await sleep(400);
    ok(await f.evaluate(() => mode === '3d' && curIdx === 7), 'Previous stays in 3D too (back on step 8)');
    const st1b = await f.evaluate(() => ({ i: TD.info() }));
    const before = await progressNow();
    await tap(d, f, '#b-done'); await sleep(500);
    const st2 = await f.evaluate(() => ({ i: TD.info(), idx: curIdx, mode }));
    ok(st2.mode === '3d' && st2.idx === 8 && JSON.stringify(st2.i.step) !== JSON.stringify(st1b.i.step), 'Mark done stays in 3D, ticks the step and moves to the next outline', st2);
    ok(await waitUntil(async () => Object.keys(await progressNow()).length === Object.keys(before).length + 1, 15000), 'and the tick reached the house');
    await tap(d, f, '#b-show'); await sleep(500);
    ok(await f.evaluate(() => mode) === '2d', 'Show on map goes to 2D');
    await shot(d, 'outline-ipad-2d.png');
    await d.close();
    if (want('sky')) {
      const { d, f } = await open('phone'); await go3d(d, f);
      const k = await f.evaluate(() => { const i = TD.info(); const sb = document.getElementById('build').getBoundingClientRect(), mb = document.querySelector('.mapbox').getBoundingClientRect(); return { sky: TD.sky(), cover: i.cover, fov: i.fov, sheetTop: Math.round(sb.top), mapBottom: Math.round(mb.bottom), mapTop: Math.round(mb.top) }; });
      ok(k.sky <= 0.15 + 1e-6, 'the phone 3D view: sky is at most 15 % of the view above the sheet\'s peek', k);
      info('phone camera', k);
      await shot(d, 'sky-phone.png');
      await f.evaluate(() => { document.getElementById('b-next').click(); }); await sleep(400);
      ok(await f.evaluate(() => TD.sky()) <= 0.15 + 1e-6, 'and when framing a step', await f.evaluate(() => TD.sky()));
      await d.close();
    }
  }

  // ── upright / phone fit ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  if (want('upright') || want('phonefit')) {
    console.log('\n## P3-DOLLYWOOD-11, P3-DOLLYWOOD-05  Upright');
    const corners = f => f.evaluate(() => { const b = D.layers.allbox, r = svg.getBoundingClientRect(), m = (window.ROOT || svg).getScreenCTM(), pts = [[b[0], b[2]], [b[1], b[2]], [b[0], b[3]], [b[1], b[3]]].map(([x, y]) => { const p = svg.createSVGPoint(); p.x = x; p.y = HM - y; const q = p.matrixTransform(m); return [q.x, q.y]; });
      return { ROT, inside: pts.every(([x, y]) => x >= r.left - 1 && x <= r.right + 1 && y >= r.top - 1 && y <= r.bottom + 1), w: view[2], pts: pts.map(p => p.map(Math.round)), rect: [r.left, r.top, r.right, r.bottom].map(Math.round) }; });
    const centre = f => f.evaluate(() => { const r = svg.getBoundingClientRect(); const c = toMap({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }); return { c, k: mpp() }; });
    const settle = async f => { await sleep(400); await f.waitForFunction(() => { const a = view.slice(); return new Promise(r => setTimeout(() => r(a.every((v, i) => Math.abs(v - view[i]) < 1e-6)), 350)); }, null, { timeout: 15000 }).catch(() => {}); await sleep(200); };
    const insideUntil = async (f, fn) => { let c; for (let i = 0; i < 40; i++) { c = await fn(f); if (c.inside) return c; await sleep(250); } return c; };
    if (want('upright')) for (const dev of ['ipad', 'phone']) {
      const { d, f } = await open(dev);
      await f.evaluate(() => selectSection('all', true)); await settle(f);
      ok(await f.evaluate(() => secView) === 'all', `${dev}: the Whole park chip is the pressed one (secView 'all')`);
      await f.evaluate(() => document.getElementById('l-upright').click()); await settle(f);
      let c = await insideUntil(f, corners);
      ok(c.ROT !== 0 && c.inside, `${dev}: Upright on with Whole park pressed fits the whole park`, c);
      ok(await f.evaluate(() => curSec) === 'entrance', `${dev}: and fits no section`);
      await f.evaluate(() => document.getElementById('l-upright').click()); await settle(f);
      c = await insideUntil(f, corners); ok(c.ROT === 0 && c.inside, `${dev}: turned off, the whole park again`, c);
      // a section pressed: in place
      await f.evaluate(() => selectSection('show', true)); await settle(f);
      const a = await centre(f);
      await f.evaluate(() => document.getElementById('l-upright').click()); await sleep(300);
      const b = await centre(f);
      ok(Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]) < 2 && Math.abs(a.k - b.k) / a.k < 0.01, `${dev}: Upright with a section pressed rotates in place (same centre, same scale)`, { a, b });
      await f.evaluate(() => document.getElementById('l-upright').click()); await sleep(300);
      const c2 = await centre(f);
      ok(Math.hypot(a.c[0] - c2.c[0], a.c[1] - c2.c[1]) < 2 && Math.abs(a.k - c2.k) / a.k < 0.01, `${dev}: and back off again`, { a, c2 });
      ok(await f.evaluate(() => secView) === 'show', `${dev}: neither fit a section (secView unchanged)`);
      // the shared handler is what the park map's compass calls
      ok(await f.evaluate(() => typeof window.setUpright === 'function'), `${dev}: window.setUpright(on) exists for the park map's compass`);
      await d.close();
    }
    if (want('phonefit')) {
      const { d, f } = await open('phone');
      await f.evaluate(() => document.getElementById('l-upright').click()); await sleep(500);
      const bad = [];
      const secIn = (f, sid) => f.evaluate(sid => { const b = SEC[sid].box, r = svg.getBoundingClientRect(), sheetTop = document.getElementById('build').getBoundingClientRect().top, m = (window.ROOT || svg).getScreenCTM();
        const pts = [[b[0], b[2]], [b[1], b[2]], [b[0], b[3]], [b[1], b[3]]].map(([x, y]) => { const p = svg.createSVGPoint(); p.x = x; p.y = HM - y; const q = p.matrixTransform(m); return [q.x, q.y]; });
        return { sid, inside: pts.every(([x, y]) => x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= Math.min(r.bottom, sheetTop) + 2), pts: pts.map(p => p.map(Math.round)), rect: [r.left, r.top, r.right, Math.min(r.bottom, sheetTop)].map(Math.round) }; }, sid);
      for (const sid of ['show', 'dpx', 'village', 'fair', 'river', 'grove']) {
        await f.evaluate(sid => selectSection(sid, true), sid); await settle(f);
        let r; for (let i = 0; i < 20; i++) { r = await secIn(f, sid); if (r.inside) break; await sleep(250); }
        if (!r.inside) bad.push(r);
      }
      ok(!bad.length, 'phone + Upright: a section chip frames the whole rotated section above the sheet (6 sections)', bad);
      await f.evaluate(() => { selectSection('all', true); }); await settle(f);
      const c = await insideUntil(f, corners); ok(c.inside, 'phone + Upright: Whole park frames the rotated park', c);
      await shot(d, 'phonefit-upright.png');
      await d.close();
    }
  }

  // ── filter ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  if (want('filter')) {
    console.log('\n## P3-DOLLYWOOD-06, P3-DOLLYWOOD-LIVE-14  rider height');
    for (const id of ['dollywood', 'dollywood-live']) {
      const { d, f } = await open('ipad', { id });
      const r = await f.evaluate(() => { const out = {}; const H = () => document.getElementById('hf'), hf = H(); const opts = hf ? [...hf.options].map(o => o.value + ':' + o.textContent) : [];
        const exp = n => OFF.filter(o => !o.height_in || o.height_in <= n).length; const none = OFF.filter(o => !o.height_in).length;
        if (hf) for (const v of ['36', '39', '42', '48', '55']) { H().value = v; H().onchange(); out[v] = { n: listItems().length, exp: exp(+v), over: listItems().filter(o => o.height_in > +v).length, noReq: listItems().filter(o => !o.height_in).length }; }
        if (hf) { H().value = 'none'; H().onchange(); out.none = { n: listItems().length, exp: none }; H().value = 'any'; H().onchange(); }
        return { out, opts, none, total: OFF.length, fn: listItems.toString().includes('!o.height_in||o.height_in<=') }; });
      if (id === 'dollywood') {
        ok(Object.entries(r.out).every(([k, v]) => v.n === v.exp), 'the guide: "up to N″" keeps every ride with no minimum (counts equal !h || h <= N for 36 / 39 / 42 / 48 / 55)', r.out);
        ok(r.out['36'].noReq === r.none && r.out['36'].over === 0 && r.none > 40, `up to 36″ lists all ${r.none} no-minimum rides and nothing taller`, r.out['36']);
        ok(JSON.stringify(r.opts) === JSON.stringify(['any:any', 'none:no requirement', '36:up to 36"', '39:up to 39"', '42:up to 42"', '48:up to 48"', '55:up to 55"']), 'the option words are unchanged', r.opts);
        await f.selectOption('#hf', '36'); await sleep(400);
        const shown = await f.evaluate(() => (document.getElementById('tab-list').textContent.match(/(\d+) of \d+/) || [])[1]);
        ok(+shown === r.out['36'].exp, 'through a real <select> choice the list says the same count', shown);
      } else ok(r.fn, 'the park map export carries the same fixed listItems filter', r.fn);
      await d.close();
    }
  }

  // ── plot ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  if (want('plot')) {
    console.log('\n## P3-DOLLYWOOD-07 / -15 / -18, UX-DOLLYWOOD-12  the plot width');
    await L.reset('typical');
    const nd = await L.newDevice({ name: 'Rig tablet', profiles: ['eli'] });
    const A = await open('ipad', { reset: false, ls: { 'dw-plot': '999' } });
    const B = await (async () => { const d = await L.device({ device: DEV.land, profile: 'eli', fixedTime: false, as: nd }); const f = await d.openApp('dollywood', { wait: '#b-count' }); await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: LOAD }); return { d, f }; })();
    const val = f => f.evaluate(() => ({ v: document.getElementById('sc-plot').value, fac: document.getElementById('sc-fac').textContent, err: document.getElementById('sc-err').textContent, inv: document.getElementById('sc-plot').getAttribute('aria-invalid'), ls: localStorage.getItem('dw-plot'), row: hub.get('plot') }));
    let a = await val(A.f);
    ok(a.v === '400' && a.row === '400', 'signed in, the plot is the person\'s row (400), not the device\'s old dw-plot (999)', a);
    ok(await waitUntil(async () => (await val(A.f)).ls === null, 15000), 'and the stale device key is removed after the migration check');
    // the card follows the factor
    const pick = await A.f.evaluate(() => { const s = D.steps.find(x => x.elev && /\d\s*m\b(?!²)/.test(x.elev) && gameLine(x.elev, SEC[x.section])); return { sec: s.section, i: stepsOf(s.section).indexOf(s), ext: EXT }; });
    await A.f.evaluate(p => { curSec = p.sec; curIdx = p.i; renderStep(); showTab('scale'); }, pick);
    const game = () => A.f.evaluate(() => (document.querySelector('#b-now .meas.game') || {}).textContent || '');
    const pct = v => Math.round(v / pick.ext * 100);
    ok(new RegExp('at ' + pct(400) + '% scale').test(await game()), 'after load the step card reads the saved plot (400 m)', await game());
    await A.f.fill('#sc-plot', '600'); await sleep(200); await A.f.evaluate(() => document.activeElement && document.activeElement.blur());
    ok(new RegExp('at ' + pct(600) + '% scale').test(await game()), 'an edit re-renders the card at once (600 m)', await game());
    // a synced change
    await B.f.evaluate(() => showTab('scale')); await B.f.fill('#sc-plot', '800'); await B.f.evaluate(() => hub.flush());
    await A.f.evaluate(() => hub.pull()); await waitUntil(async () => (await val(A.f)).v === '800', 15000);
    ok(new RegExp('at ' + pct(800) + '% scale').test(await game()), 'a change from another device re-renders it (800 m)', await game());
    // null clears
    await B.f.fill('#sc-plot', ''); await B.f.evaluate(() => hub.flush());
    await A.f.evaluate(() => hub.pull()); const cleared = await waitUntil(async () => (await val(A.f)).v === '', 15000);
    a = await val(A.f);
    ok(cleared && a.fac === '—' && a.row == null, 'a plot cleared on one device clears the field and the factor on the other', a);
    ok(/at 1:1/.test(await game()), 'and the card goes back to 1:1', await game());
    // validation
    for (const [v, valid] of [['10', false], ['49', false], ['2001', false], ['0', false], ['-5', false], ['50', true], ['2000', true], ['640', true]]) {
      await A.f.fill('#sc-plot', ''); await A.f.evaluate(() => hub.flush());
      await A.f.evaluate(v => { const e = document.getElementById('sc-plot'); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, v); await sleep(150);
      const s = await val(A.f);
      const bad = !valid;
      ok(bad ? (s.err === 'Enter a width from 50 to 2,000 m.' && s.inv === 'true' && s.row !== v && s.fac === '—' && /at 1:1/.test(await game())) : (s.err === '' && s.inv !== 'true' && s.row === v && s.fac !== '—'),
        `${v || '(empty)'}: ${bad ? 'a role=alert line, aria-invalid, nothing saved, nothing converted' : 'valid, saved and converted'}`, s);
    }
    ok(await A.f.$eval('#sc-err', e => e.getAttribute('role')) === 'alert', 'the message is role="alert"');
    const copy = await A.f.$eval('#tab-scale', e => e.textContent);
    ok(copy.includes('Enter the width you can give it in the game, and every measurement on the step card and the listing cards is also shown in game metres.') && !/Info tab/.test(copy), 'the Scale copy no longer points to an Info tab');
    // the legacy key never brings a width back
    await A.f.fill('#sc-plot', ''); await A.f.evaluate(() => hub.flush()); await sleep(300);
    await A.f.evaluate(() => localStorage.setItem('dw-plot', '999'));
    await A.d.page.reload({ waitUntil: 'load' }); const f2 = await waitUntil(() => A.d.frame('dollywood'), 20000); await f2.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: LOAD });
    const a2 = await val(f2); ok(a2.v === '' && a2.fac === '—', 'after a reload with a cleared plot and a stale dw-plot, the field stays empty', a2);
    await A.d.close(); await B.d.close();
  }

  // ── sticky / summary ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  if (want('sticky') || want('summary')) {
    console.log('\n## UX-DOLLYWOOD-1 / CONS-SHAPE-4  the sticky Mark done, the summary row');
    await L.reset('typical');
    let puts = 0;
    const { d, f } = await open('ipad', { reset: false });
    d.page.on('request', r => { if (r.method() !== 'GET' && /\/api\/data\/dollywood(\/|\?)/.test(r.url()) && /summary/.test(r.url() + (r.postData() || ''))) puts++; });
    const s0 = await f.evaluate(() => { const b = document.getElementById('stickbar'), r = b.getBoundingClientRect(), cs = getComputedStyle(b), done = document.getElementById('sb-done'), dr = done.getBoundingClientRect(), card = document.getElementById('b-done').getBoundingClientRect();
      return { hidden: b.hidden, pos: cs.position, bottom: Math.round(innerHeight - r.bottom), left: Math.round(r.left), right: Math.round(innerWidth - r.right), glass: cs.backdropFilter || cs.webkitBackdropFilter, text: document.getElementById('sb-t').textContent, doneH: Math.round(dr.height), doneR: getComputedStyle(done).borderRadius, btns: ['sb-prev', 'sb-done', 'sb-next'].map(i => document.getElementById(i).getBoundingClientRect().height), cardH: Math.round(card.height), cardR: getComputedStyle(document.getElementById('b-done')).borderRadius, big: (() => { const p = document.createElement('i'); p.style.cssText = 'display:block;position:absolute;visibility:hidden;height:var(--btn-h-lg)'; document.body.appendChild(p); const h = p.getBoundingClientRect().height; p.remove(); return h; })(),
        cardInView: card.top >= 0 && card.bottom <= innerHeight, scrollY, bg: getComputedStyle(done).backgroundColor, accent: (() => { const p = document.createElement('i'); p.style.color = 'var(--accent-strong)'; document.body.appendChild(p); const c = getComputedStyle(p).color; p.remove(); return c; })() }; });
    ok(!s0.hidden && s0.pos === 'fixed' && s0.bottom >= 0 && s0.bottom <= 24 && /^Step 8 of 9 · .+/.test(s0.text), 'iPad: the sticky bar is pinned to the bottom while the card\'s controls are off screen: "Step 8 of 9 · <title>"', s0);
    ok(s0.glass && s0.glass !== 'none', 'and it is glass, because it floats', s0.glass);
    ok(s0.doneH >= s0.big - 1 && s0.cardH >= s0.big - 1 && s0.btns.every(h => h >= 43.5), 'Mark done (bar and card) is the --btn-h-lg capsule; Previous and Next are >= 44 px', s0);
    ok(s0.bg === s0.accent, 'in the person\'s strong tone', { bg: s0.bg, accent: s0.accent });
    ok(parseFloat(s0.doneR) >= s0.doneH / 2 - 1, 'a capsule (fully rounded)', s0.doneR);
    let fx = f;
    const before = await progressNow(); const hit = await tap(d, f, '#sb-done', { scroll: false });
    ok(hit.ok, 'a finger on the bar\'s Mark done hits it', hit);
    const rows1 = await waitUntil(async () => { const p = await progressNow(); return Object.keys(p).length === Object.keys(before).length + 1 ? p : null; }, 15000);
    ok(!!rows1, 'ONE tap ticks the step (no scroll, no second tap)');
    ok(await f.evaluate(() => curIdx) === 8 && /^Step 9 of 9 · /.test(await f.evaluate(() => document.getElementById('sb-t').textContent)), 'and the bar moves on to the next step ("Step 9 of 9")');
    if (want('summary')) {
      const row = await waitUntil(async () => { const r = (await rowsOf('/api/data/dollywood?scope=person&prefix=summary'))[0]; return r && r.value && r.value.done === 25 ? r : null; }, 12000);
      ok(!!row && row.value.total === 242 && row.value.next && row.value.next.id === 'entrance-09' && row.value.next.i === 9 && row.value.next.n === 9 && row.value.next.sec === 'entrance' && row.value.secDone === 8 && row.value.secTotal === 9 && typeof row.value.at === 'number' && typeof row.value.next.title === 'string' && typeof row.value.next.secName === 'string', 'the summary row says: next step entrance-09 (9 of 9), 8 of 9 done in its section, 25 of 242 done', row && row.value);
      ok(puts === 1, 'one tick wrote the summary once', puts);
      // tick + untick inside the 2 s window: no write
      puts = 0; await f.evaluate(() => { const id = stepsOf('crafts')[0].id; doneMap[id] = true; save([id]); doneMap[id] = false; save([id]); }); await sleep(3200);
      ok(puts === 0, 'a tick and an untick inside the 2 s window write no summary', puts);
      // the second step of the section: the next section
      await tap(d, f, '#sb-done', { scroll: false });
      const row2 = await waitUntil(async () => { const r = (await rowsOf('/api/data/dollywood?scope=person&prefix=summary'))[0]; return r && r.value && r.value.done === 26 ? r : null; }, 12000);
      ok(!!row2 && row2.value.next && row2.value.next.id === 'show-14' && row2.value.next.sec === 'show' && row2.value.next.i === 14 && row2.value.next.n === 21 && row2.value.secDone === 13 && row2.value.secTotal === 21, 'with the section done, next is show-14 (14 of 21), 13 of 21 done', row2 && row2.value);
      await d.page.reload({ waitUntil: 'load' }); const f2 = await waitUntil(() => d.frame('dollywood'), 20000);
      await f2.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: LOAD }); await sleep(500);
      fx = f2;
      const o = await f2.evaluate(() => ({ curSec, curIdx, sec: document.getElementById('b-sec').textContent, step: document.getElementById('sb-t').textContent, scroll: scrollY }));
      ok(o.curSec === 'show' && o.curIdx === 13 && /^Step 14 of 21 · /.test(o.step) && o.scroll === 0, 'the guide opens at the step the summary points to (Showstreet 14 of 21), without scrolling', o);
    }
    // the bar hides while the card's controls are in view
    await fx.evaluate(() => document.querySelector('#b-now .bctl').scrollIntoView({ block: 'center' })); await sleep(900);
    ok(await fx.evaluate(() => document.getElementById('stickbar').hidden), 'it hides while the card\'s own controls are in view');
    await fx.evaluate(() => window.scrollTo(0, 0)); await sleep(900);
    ok(!(await fx.evaluate(() => document.getElementById('stickbar').hidden)), 'and comes back when they are off screen (below the viewport)');
    await fx.evaluate(() => document.getElementById('profwrap') ? 0 : document.querySelector('.profwrap').scrollIntoView({ block: 'center' })); await sleep(900);
    ok(await fx.evaluate(() => document.getElementById('stickbar').hidden), 'and stays out of the way once the person has scrolled past the card (no cover over the cross-section or the side tabs)');
    const cover = await fx.evaluate(() => { window.scrollTo(0, 0); const b = document.getElementById('stickbar'); b.hidden = false; const r = b.getBoundingClientRect(), a = document.querySelector('aside.side').getBoundingClientRect(); return { barRight: Math.round(r.right), asideLeft: Math.round(a.left), twoCol: a.top < innerHeight && a.left > r.left }; });
    if (cover.twoCol) ok(cover.barRight <= cover.asideLeft + 1, 'in two columns the bar sits under the map column only (the side tabs stay clear)', cover);
    await shot(d, 'sticky-ipad.png');
    await d.close();
    { const { d, f } = await open('phone'); ok(await f.evaluate(() => document.getElementById('stickbar').hidden && getComputedStyle(document.getElementById('stickbar')).display === 'none'), 'phone: no sticky bar (the sheet has the controls)'); await d.close(); }
  }

  // ── feed / done ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  if (want('feed')) {
    console.log('\n## UX-DOLLYWOOD-11  the feed');
    await L.reset('empty');
    const { d, f } = await open('ipad', { reset: false, installClock: Date.now() });
    const lines = async () => ((await L.apiAs('eli', '/api/activity?limit=50')).body.activity || []).filter(a => a.app_id === 'dollywood').map(a => a.text);
    const tick = (sec, i) => f.evaluate(({ sec, i }) => { curSec = sec; curIdx = i; renderStep(); stepDone(); }, { sec, i });
    const flush = async () => { await f.evaluate(() => hub.flush()); await sleep(300); };
    await tick('entrance', 0); await d.ctx.clock.fastForward(20000); await tick('entrance', 0);   // ticked, then unticked 20 s later
    ok(!(await f.evaluate(() => doneMap['entrance-01'])), 'a step ticked and unticked inside the window');
    await d.ctx.clock.fastForward(61000); await flush();
    ok((await lines()).filter(t => /^(Built|Ticked) /.test(t)).length === 0, 'posts nothing, then nothing after 60 s', await lines());
    await tick('show', 0); await d.ctx.clock.fastForward(10000); await tick('show', 1); await d.ctx.clock.fastForward(10000); await tick('show', 2);
    await flush(); ok((await lines()).filter(t => /^(Built|Ticked) /.test(t)).length === 0, 'three ticks post nothing at once');
    await d.ctx.clock.fastForward(61000); await flush();
    let L1 = (await lines()).filter(t => /^Built /.test(t));
    const showName = await f.evaluate(() => SEC.show.name);
    ok(L1.length === 1 && L1[0] === `Built 3 steps in ${showName}`, 'three ticks in a section, one line 60 s after the last: "Built 3 steps in <section>"', L1);
    await tick('entrance', 1); await tick('dpx', 0); await tick('dpx', 1);
    await d.ctx.clock.fastForward(61000); await flush();
    L1 = (await lines()).filter(t => /^Built /.test(t));
    const t2 = await f.evaluate(() => stepsOf('entrance')[1].title), dpxName = await f.evaluate(() => SEC.dpx.name), entName = await f.evaluate(() => SEC.entrance.name);
    ok(L1.length === 3 && L1.includes(`Built ${t2} (${entName})`) && L1.includes(`Built 2 steps in ${dpxName}`), 'one line per section: a single step "Built <title> (<section>)", several "Built 2 steps in <section>"', L1);
    await tick('crafts', 0); await tick('crafts', 0);   // tick, untick
    await f.evaluate(() => stepsOf('crafts')); await tick('crafts', 3);
    await f.evaluate(() => window.dispatchEvent(new Event('pagehide'))); await sleep(600);
    L1 = (await lines()).filter(t => /^Built /.test(t));
    const ct = await f.evaluate(() => stepsOf('crafts')[3].title), cn = await f.evaluate(() => SEC.crafts.name);
    ok(L1.includes(`Built ${ct} (${cn})`) && !L1.includes(`Built 2 steps in ${cn}`), 'leaving the page flushes a waiting line at once (and the ticked-then-unticked step is not in it)', L1);
    ok(!(await lines()).some(t => /^Ticked /.test(t)), 'no "Ticked …" line is ever posted');
    await d.close();
  }
  if (want('done')) {
    console.log('\n## IMP-DOLLYWOOD-I1  a section is finished');
    const { d, f } = await open('ipad', { variant: 'overflow' });
    await f.evaluate(() => { window.__toasts = []; const o = hub.toast; hub.toast = function (m, ...a) { window.__toasts.push(String(m)); return o.call(this, m, ...a); }; });
    const c0 = await f.evaluate(() => ({ complete: [...document.querySelectorAll('#chips button[data-complete="1"]')].map(b => b.dataset.sec), just: document.querySelectorAll('#chips button.just').length, toasts: window.__toasts.length }));
    ok(c0.complete.length === 11 && c0.just === 0 && c0.toasts === 0, 'on load: 11 finished sections carry their check, no toast, no settle animation', c0);
    const undone = await f.evaluate(() => stepsOf('grove').filter(s => !doneMap[s.id]).map(s => s.id));
    ok(undone.length === 3, 'Wildwood Grove has three steps left', undone);
    const tickId = id => f.evaluate(id => { const s = D.steps.find(x => x.id === id); curSec = s.section; curIdx = stepsOf(s.section).indexOf(s); renderStep(); stepDone(); }, id);
    await tickId(undone[0]); await tickId(undone[1]); await sleep(300);
    ok(await f.evaluate(() => window.__toasts.length) === 0, 'two of three: no toast yet');
    await tickId(undone[2]); await sleep(400);
    const fin = await f.evaluate(() => { const b = document.querySelector('#chips button[data-sec="grove"]'), cd = b.querySelector('.cdone'); return { toasts: window.__toasts.slice(), complete: b.dataset.complete, just: b.classList.contains('just'), shown: getComputedStyle(cd).display !== 'none', anim: getComputedStyle(cd).animationName, name: SEC.grove.name, n: stepsOf('grove').length }; });
    ok(fin.toasts.length === 1 && fin.toasts[0] === `${fin.name} done — ${fin.n} steps`, 'the last step: ONE toast "<Section> done — 26 steps"', fin);
    ok(fin.complete === '1' && fin.just && fin.shown && fin.anim !== 'none', 'and the chip shows its check, settling once', fin);
    await sleep(1800); ok(await f.evaluate(() => !document.querySelector('#chips button.just')), 'the settle class is gone after it ran (once)');
    await f.evaluate(() => { document.documentElement.dataset.motion = 'reduce'; });
    await f.evaluate(() => { const id = stepsOf('grove')[0].id; curSec = 'grove'; curIdx = 0; renderStep(); stepDone(); stepDone(); }); await sleep(300);
    ok(await f.evaluate(() => getComputedStyle(document.querySelector('#chips button[data-sec="grove"] .cdone')).animationName) === 'none', 'under Reduce Motion the check does not animate');
    await f.evaluate(() => hub.flush()); await sleep(300);
    const act = ((await L.apiAs('eli', '/api/activity?limit=50')).body.activity || []).map(a => a.text);
    ok(!act.some(t => /done —/.test(t)), 'and no extra feed line is posted for it');
    await d.close();
  }

  // ── search ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  if (want('search')) {
    console.log('\n## UX-DOLLYWOOD-4  search');
    const { d, f } = await open('ipad');
    await tap(d, f, '#q'); await d.page.keyboard.type('ba', { delay: 40 }); await sleep(300);
    const s = await f.evaluate(() => { const q = document.getElementById('q').getBoundingClientRect(), l = document.getElementById('q-list'), lr = l.getBoundingClientRect(), rows = [...l.querySelectorAll('.qrow')];
      return { hidden: l.hidden, gap: Math.round(lr.top - q.bottom), n: rows.length, hs: rows.map(r => Math.round(r.getBoundingClientRect().height)), texts: rows.map(r => r.textContent), N: listItems().length, inView: lr.left >= 0 && lr.right <= innerWidth && lr.bottom <= innerHeight, role: l.getAttribute('role'), parts: rows.slice(0, -1).every(r => r.querySelector('.n') && r.querySelector('.nm') && r.querySelector('.ar')) }; });
    ok(!s.hidden && s.gap <= 12 && s.n >= 3 && s.n <= 9 && s.role === 'listbox' && s.inView, 'typing lists matches right under the field (<= 8 rows + Show all), inside the screen', s);
    ok(s.hs.every(h => h >= 43.5) && s.parts, 'each row is 44 px with a number badge, the name and the area', s);
    ok(await f.evaluate(() => [...document.querySelectorAll('#q-list .qrow')].every(r => { const b = r.getBoundingClientRect(), h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!h && r.contains(h); })), 'every row is what a finger hits (the toolbar does not clip or cover the list)');
    ok(s.texts[s.texts.length - 1] === `Show all ${s.N} in Listings`, 'the last row is "Show all N in Listings"', s.texts[s.texts.length - 1]);
    await d.page.keyboard.press('ArrowDown'); await d.page.keyboard.press('ArrowDown');
    const sel = await f.evaluate(() => { const r = [...document.querySelectorAll('#q-list .qrow')], i = r.findIndex(x => x.getAttribute('aria-selected') === 'true'); return { i, active: document.getElementById('q').getAttribute('aria-activedescendant'), id: r[i] && r[i].id, name: r[i] && r[i].querySelector('.nm').textContent }; });
    ok(sel.i === 1 && sel.active === sel.id, 'Arrow keys move through the rows (aria-activedescendant follows)', sel);
    await d.page.keyboard.press('Enter'); await sleep(900);
    const pop = await f.evaluate(() => ({ pop: (document.querySelector('#pop h2') || {}).textContent || '', closed: document.getElementById('q-list').hidden }));
    ok(pop.closed && pop.pop.includes(sel.name), 'Enter opens the highlighted listing\'s card and closes the list', { pop, sel });
    await tap(d, f, '#q'); await d.page.keyboard.press('Control+a'); await d.page.keyboard.type('ba', { delay: 40 }); await sleep(300);
    await d.page.keyboard.press('Escape'); ok(await f.evaluate(() => document.getElementById('q-list').hidden && document.activeElement.id === 'q'), 'Escape closes the list (the field keeps focus)');
    await d.page.keyboard.press('Backspace'); await d.page.keyboard.type('a', { delay: 40 }); await sleep(250); ok(!(await f.evaluate(() => document.getElementById('q-list').hidden)), 'typing opens it again');
    await f.evaluate(() => document.getElementById('q').blur()); await sleep(200); ok(await f.evaluate(() => document.getElementById('q-list').hidden), 'leaving the field closes it');
    await f.evaluate(() => { const q = document.getElementById('q'); q.focus(); q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); });
    await d.page.keyboard.type('zipline', { delay: 40 }); await sleep(300);
    const nm = await f.evaluate(() => ({ t: document.getElementById('q-list').textContent, hidden: document.getElementById('q-list').hidden, h: Math.round(document.querySelector('#q-list .qrow').getBoundingClientRect().height) }));
    ok(!nm.hidden && nm.t === 'No match for “zipline”' && nm.h >= 43.5, 'no match says so: No match for “zipline”', nm);
    await f.evaluate(() => { const q = document.getElementById('q'); q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); });
    await d.page.keyboard.type('mountain', { delay: 40 }); await sleep(600);
    const one = await f.evaluate(() => ({ n: listItems().filter(o => o.pos).length, hidden: document.getElementById('q-list').hidden, pop: (document.querySelector('#pop h2') || {}).textContent || '' }));
    info('mountain', one);
    await f.evaluate(() => { const q = document.getElementById('q'); q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); });
    const single = await f.evaluate(() => { const m = OFF.filter(o => o.pos).find(o => OFF.filter(p => p.pos && p.name.toLowerCase().includes(o.name.toLowerCase().slice(0, 12))).length === 1); return m && m.name.slice(0, 12); });
    await f.evaluate(() => document.getElementById('q').focus()); await d.page.keyboard.type(single, { delay: 30 }); await sleep(900);
    const sm = await f.evaluate(() => ({ hidden: document.getElementById('q-list').hidden, pop: (document.querySelector('#pop h2') || {}).textContent || '' }));
    ok(sm.hidden && sm.pop.toLowerCase().includes(single.toLowerCase().slice(0, 8)), 'a single match still flies to it and opens its card', { single, sm });
    await f.evaluate(() => { const q = document.getElementById('q'); q.focus(); q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); closePop(); });
    await d.page.keyboard.type('ba', { delay: 40 }); await sleep(300);
    const nAll = await f.evaluate(() => listItems().length);
    await tap(d, f, '#q-list .qall', { scroll: false }); await sleep(900);
    const all = await f.evaluate(() => ({ tab: document.querySelector('.tabs [aria-selected=true]').dataset.tab, top: Math.round(document.getElementById('tab-list').getBoundingClientRect().top), vh: innerHeight, n: (document.getElementById('tab-list').textContent.match(/(\d+) of \d+/) || [])[1] }));
    ok(all.tab === 'list' && all.top < all.vh && +all.n === nAll, '"Show all N in Listings" selects the Listings tab and scrolls to it', all);
    await shot(d, 'search-ipad.png');
    await d.close();
  }

  // ── nextun / mapview ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  if (want('nextun')) {
    console.log('\n## UX-DOLLYWOOD-7  Next unfinished on a phone');
    const { d, f } = await open('phone');
    ok(await f.evaluate(() => document.getElementById('build').dataset.state) === 'peek', 'the sheet starts at its peek');
    await f.evaluate(() => { selectSection('show', false); });
    await tap(d, f, '#b-nextun', { scroll: false }); await sleep(900);
    const r = await f.evaluate(() => { const b = document.getElementById('build'), br = b.getBoundingClientRect(), h3 = document.querySelector('#b-now h3').getBoundingClientRect(); return { state: b.dataset.state, sheetTop: Math.round(br.top), h3Top: Math.round(h3.top), h3Bottom: Math.round(h3.bottom), vh: innerHeight, title: document.querySelector('#b-now h3').textContent, cur: curSec + ':' + curIdx }; });
    ok(r.state === 'half' && r.h3Top >= r.sheetTop && r.h3Bottom <= r.vh, 'it raises the sheet to half and the new step is visible', r);
    await shot(d, 'nextun-phone.png');
    await d.close();
  }
  if (want('mapview')) {
    console.log('\n## UX-DOLLYWOOD-2  the map comes into view');
    for (const dev of ['ipad', 'desk']) {
      const { d, f } = await open(dev);
      await f.evaluate(() => { document.documentElement.dataset.motion = 'reduce'; });   // instant scrolling, so the check does not wait on an animation
      const vis = () => f.evaluate(() => { const r = document.querySelector('.mapbox').getBoundingClientRect(); return Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / Math.min(r.height, innerHeight); });
      await f.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(400);
      const v0 = await vis(); const y0 = await f.evaluate(() => scrollY);
      await f.evaluate(() => document.getElementById('b-next').click()); await sleep(500);
      const v1 = await vis(); ok(v0 < 0.6 && v1 >= 0.6, `${dev}: Next with the map scrolled away brings it into view (${v0.toFixed(2)} → ${v1.toFixed(2)})`, { v0, v1 });
      const y1 = await f.evaluate(() => scrollY);
      await f.evaluate(() => document.getElementById('b-prev').click()); await sleep(500);
      ok(await f.evaluate(() => scrollY) === y1, `${dev}: with the map in view, Previous does not scroll`, { y1, y: await f.evaluate(() => scrollY) });
      await f.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(300);
      await f.evaluate(() => document.getElementById('b-show').click()); await sleep(500); ok((await vis()) >= 0.6, `${dev}: Show on map does the same`);
      await f.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(300);
      await f.evaluate(() => document.querySelectorAll('#b-list .bitem')[2].click()); await sleep(500); ok((await vis()) >= 0.6, `${dev}: and a tap on the step list`);
      await d.close();
    }
  }

  // ── readonly ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  if (want('readonly')) {
    console.log('\n## UX-DOLLYWOOD-14  the display profile');
    await L.reset('typical');
    const d = await L.device({ device: 'desktop', profile: 'tv', fixedTime: false }); await d.ctx.addInitScript(RAF);
    await d.page.goto(L.site + '/apps/dollywood.html', { waitUntil: 'load' }); const f = d.page;
    await f.waitForFunction(() => window.hub && hub.profile && hub.profile.kind === 'kiosk' && /of \d+ done|not written/.test(document.getElementById('b-count').textContent), null, { timeout: LOAD });
    {
      const r = await f.evaluate(() => ({ done: !!document.getElementById('b-done'), sb: document.getElementById('sb-done').hidden, reset: document.getElementById('b-reset').hidden, imp: document.getElementById('b-import').hidden, plot: document.getElementById('sc-plot').readOnly, prev: !document.getElementById('b-prev').disabled, next: !document.getElementById('b-next').disabled, show: !document.getElementById('b-show').disabled, cur: curIdx }));
      ok(!r.done && r.sb && r.reset && r.imp && r.plot && r.prev && r.next && r.show, 'no Mark done (card or bar), no Reset, no Import, a read-only plot; Previous, Next and Show on map stay', r);
      await f.evaluate(() => document.getElementById('b-next').click()); ok(await f.evaluate(() => curIdx) === r.cur + 1, 'Next still works');
      await d.close();
    }
  }

  // ── cls ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  if (want('cls')) {
    console.log('\n## CONS-MOTION-4  landmark moves on a cold open (requests 150 ms late; and the first pull held 2.5 s)');
    const INIT = () => {
      const w = window; w.__cls = { entries: [], samples: [] };
      try { new PerformanceObserver(l => { for (const e of l.getEntries()) w.__cls.entries.push({ v: e.value, input: e.hadRecentInput }); }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
      const key = el => { const t = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 32); return t ? el.tagName.toLowerCase() + ':' + t : null; };
      const sample = () => { if (!document.body) return; const m = {}, seen = {};
        for (const el of document.querySelectorAll('h1,h2,h3,button,.card,li,[class*=hero],label')) { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue; const k = key(el); if (!k) continue; seen[k] = (seen[k] || 0) + 1; m[k] = seen[k] > 1 ? null : Math.round(r.top); }
        w.__cls.samples.push({ t: Math.round(performance.now()), m, textLen: (document.body.innerText || '').trim().length }); };
      const iv = setInterval(sample, 50); setTimeout(() => clearInterval(iv), 7000);
    };
    for (const arm of ['lat150', 'held']) for (const dev of ['ipad', 'phone']) {
      await L.reset('typical');
      const d = await L.device({ device: DEV[dev], profile: 'eli', fixedTime: false });
      await d.ctx.route(L.api + '/api/**', async r => { const hold = arm === 'held' && r.request().method() === 'GET' && /\/api\/data\//.test(r.request().url()); await sleep(hold ? 2500 : 150); r.continue().catch(() => {}); });
      await d.ctx.addInitScript(INIT);
      const t0 = Date.now(); await d.page.goto(L.site + '/apps/dollywood.html', { waitUntil: 'load' });
      await sleep(Math.max(0, t0 + 7200 - Date.now()));
      const r = await d.page.evaluate(() => { const c = window.__cls, S = c.samples, firstIdx = S.findIndex(s => s.textLen > 20), last = S[S.length - 1], moves = [];
        if (firstIdx >= 0 && last) { const firstPos = {}; for (const s of S.slice(firstIdx)) for (const [k, v] of Object.entries(s.m)) if (!(k in firstPos)) firstPos[k] = { v, t: s.t };
          for (const [k, f] of Object.entries(firstPos)) if (f.v != null && last.m[k] != null && f.t <= S[firstIdx].t + 400) { const dl = last.m[k] - f.v; if (Math.abs(dl) >= 4) moves.push({ k, from: f.v, to: last.m[k], d: dl }); } }
        moves.sort((a, b) => Math.abs(b.d) - Math.abs(a.d)); const ni = c.entries.filter(e => !e.input);
        return { cls: +ni.reduce((s, e) => s + e.v, 0).toFixed(4), moves: moves.length, max: moves.length ? Math.abs(moves[0].d) : 0, top: moves.slice(0, 5).map(m => `${m.k} ${m.from}→${m.to}`) }; });
      ok(r.moves === 0 && r.max === 0, `${arm} ${dev}: landmark moves ${r.moves} (${r.max} px), CLS ${r.cls}`, r.top);
      await d.close();
    }
  }

  // ── live ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  if (want('live')) {
    console.log('\n## UNFILED-2  the park map does not run the guide\'s migration');
    const legacy = { 'dollywood-build-progress-v2': JSON.stringify({ 'entrance-01': true, 'show-02': true }), 'dw-plot': '777' };
    await L.reset('empty');
    { const { d, f } = await open('ipad', { id: 'dollywood-live', reset: false, ls: legacy });
      await f.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: LOAD }); await sleep(2500);
      const rows = await stepRows('dollywood-live'), plot = await rowsOf('/api/data/dollywood-live?scope=person&prefix=plot'), mig = await d.page.evaluate(() => localStorage.getItem('hub.migrated'));
      ok(rows.filter(r => r.value != null).length === 0 && plot.length === 0, 'the park map with a legacy guide on the device: 0 `step:` rows and no `plot` row in dollywood-live', { steps: rows.length, plot: plot.length });
      ok(await f.evaluate(() => HUBWAIT === false), 'and never waits behind "Loading your progress"');
      await d.close(); }
    await L.reset('empty');
    { const { d, f } = await open('ipad', { id: 'dollywood', reset: false, ls: legacy });
      const moved = await waitUntil(async () => (await stepRows('dollywood')).filter(r => r.value === true).length === 2, 20000);
      ok(!!moved, 'control: the guide itself moves the legacy progress (2 step rows in dollywood)');
      await d.close(); }
  }
} finally {
  console.log(`\n${pass} passed, ${fail} failed`);
  await L.close();
  process.exitCode = fail ? 1 : 0;
}
