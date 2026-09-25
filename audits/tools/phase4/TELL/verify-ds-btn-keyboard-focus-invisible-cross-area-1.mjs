// TELL / verify-ds-btn-keyboard-focus-invisible-cross-area-1 (skeptic #1): independent re-measure of "no visible keyboard
// focus on .ds buttons". For each area, press Tab up to MAX times; at every stop record the element, whether it is a
// `.ds .btn` (closest('.ds') && .btn), :focus-visible, computed outline + box-shadow while focused, then blur() and read
// them again, and pixel-diff the element's box + 8 px (focused vs blurred, channel sum > 30 counts as changed).
// Then re-focus the element and Tab on. Chromium + WebKit, desktop 1440x900 (TV 1920x1080), light, System theme.
//   node audits/tools/phase4/TELL/verify-ds-btn-keyboard-focus-invisible-cross-area-1.mjs [chromium|webkit]
//   → audits/evidence/p4/TELL/verify-ds-btn-keyboard-focus-invisible-cross-area-1-<engine>.json (+ a few PNG crops)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
import { openArea, profileFor, deviceFor } from './areas.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits/evidence/p4/TELL');
const ENGINE = process.argv[2] || 'chromium';
const AREAS = (process.argv[3] || 'shell,tv,tally,timer,kidverse,verses,f260,prayer').split(',');
const MAX = 14;
const PNG_FOR = { timer: '#go', kidverse: '#done', verses: '#show', tally: '#reset' };
const L = await local({ variant: 'typical', engine: ENGINE });
const dec = await L.browser.newPage();
const diffPng = async (a, b) => dec.evaluate(async ([a, b]) => {
  const load = async s => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); return im; };
  const A = await load(a), B = await load(b); const c = document.createElement('canvas'); c.width = A.width; c.height = A.height * 2 + 4; const g = c.getContext('2d');
  g.drawImage(A, 0, 0); const da = g.getImageData(0, 0, A.width, A.height).data; g.drawImage(B, 0, A.height + 4); const db = g.getImageData(0, A.height + 4, B.width, B.height).data;
  let n = 0; for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 30) n++;
  return { changed: n, total: da.length / 4, png: c.toDataURL('image/png').split(',')[1] };
}, [a.toString('base64'), b.toString('base64')]);
const out = { engine: ENGINE, note: 'See the header of the script.', areas: {} };
try {
  for (const area of AREAS) {
    const A = { stops: [], error: null };
    try {
      const d = await L.device({ device: deviceFor(area, 'desktop'), mode: 'light', profile: profileFor(area) });
      const { doc, frameEl } = await openArea(d, area, { settle: 1500 });
      if (frameEl) { await frameEl.focus().catch(() => {}); await doc.evaluate(() => { window.focus(); document.body.tabIndex = -1; document.body.focus(); document.body.removeAttribute('tabindex'); }); }
      const off = frameEl ? await frameEl.boundingBox() : { x: 0, y: 0 };
      const seen = new Set();
      for (let i = 0; i < MAX; i++) {
        await d.page.keyboard.press('Tab'); await sleep(80);
        const info = await doc.evaluate(() => {
          const e = document.activeElement; if (!e || e === document.body) return null;
          e.dataset.vfk = e.dataset.vfk || String(Math.random()).slice(2, 8);
          const c = getComputedStyle(e); const r = e.getBoundingClientRect();
          const id = e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + [...e.classList].join('.');
          return { key: e.dataset.vfk, id, text: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30), dsBtn: !!(e.closest('.ds') && e.classList.contains('btn')), fv: e.matches(':focus-visible'), rect: [r.x, r.y, r.width, r.height], visible: r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight };
        }).catch(() => null);
        if (!info) { A.stops.push({ i, left: 'focus left the document' }); continue; }
        if (seen.has(info.key)) break; seen.add(info.key);
        if (!info.visible) { A.stops.push({ ...info, skipped: 'off-screen' }); continue; }
        await sleep(400);
        const st = () => doc.evaluate(k => { const e = document.querySelector(`[data-vfk="${k}"]`); const c = getComputedStyle(e); return { outline: `${c.outlineStyle} ${c.outlineWidth} ${c.outlineColor}`, shadow: c.boxShadow }; }, info.key);
        const f = await st();
        const clip = { x: Math.max(0, off.x + info.rect[0] - 8), y: Math.max(0, off.y + info.rect[1] - 8), width: Math.max(1, info.rect[2] + 16), height: Math.max(1, info.rect[3] + 16) };
        const pa = await d.page.screenshot({ clip, scale: 'css', animations: 'disabled', caret: 'hide' });
        await doc.evaluate(k => document.querySelector(`[data-vfk="${k}"]`).blur(), info.key); await sleep(400);
        const b = await st();
        const pb = await d.page.screenshot({ clip, scale: 'css', animations: 'disabled', caret: 'hide' });
        const df = await diffPng(pa, pb);
        const S = { i, id: info.id, text: info.text, dsBtn: info.dsBtn, fv: info.fv, styleChanged: f.outline !== b.outline || f.shadow !== b.shadow, focused: f, changedPx: df.changed, totalPx: df.total };
        if (PNG_FOR[area] === info.id) { const p = path.join(EV, `verify-ds-btn-keyboard-focus-invisible-cross-area-1-${ENGINE}-${area}.png`); fs.writeFileSync(p, Buffer.from(df.png, 'base64')); S.shot = path.relative(ROOT, p).split(path.sep).join('/'); }
        A.stops.push(S);
        await doc.evaluate(k => document.querySelector(`[data-vfk="${k}"]`).focus(), info.key); await sleep(60);
      }
      await d.close();
    } catch (e) { A.error = String(e.message || e).split('\n')[0]; }
    const m = A.stops.filter(s => s.totalPx);
    A.summary = { measured: m.length, ringed: m.filter(s => s.changedPx > 0).length, dsBtn: m.filter(s => s.dsBtn).length, dsBtnRinged: m.filter(s => s.dsBtn && s.changedPx > 0).length };
    out.areas[area] = A;
    console.log(ENGINE, area, JSON.stringify(A.summary), A.error || '');
    for (const s of A.stops) console.log('   ', s.i, s.id, JSON.stringify(s.text), s.dsBtn ? 'DS' : '--', 'fv=' + s.fv, s.skipped || s.left || `changed ${s.changedPx}/${s.totalPx} style ${s.styleChanged}`);
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, `verify-ds-btn-keyboard-focus-invisible-cross-area-1-${ENGINE}.json`), JSON.stringify(out, null, 1));
