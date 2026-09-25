// Phase 4 SHAPE — independent re-measurement (no rig raw) of the numbers the SHAPE findings rest on.
//   node audits/tools/phase4/SHAPE/verify.mjs → audits/evidence/p4/SHAPE/verify.json (+ verify-*.png)
// V1 concentric: container radius R, the inner control's inset from the container's nearest corner, the control's radius r.
// V2 side margins / column width per device (shell, Larder, Prayer, F260, Kid Verse, Timer, Tally).
// V3 Prayer's toast action (Undo / Open it) size, rendered by the app's own toast() (apps/prayer.html:1142, as :1331 calls it).
// V4 kid-mode targets: Larder ✓ / fields, shell sidebar tab (iPad landscape), park map controls.
// V5 sheet corner radii: shell .sheet (Switch), Prayer #sheet (detail), F260 modal card.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits/evidence/p4/SHAPE');
const out = {};

const concIn = (els) => {
  const [outerSel, innerSel] = els; const O = document.querySelector(outerSel), I = O && O.querySelector(innerSel);
  if (!O || !I) return { missing: !O ? outerSel : innerSel };
  const a = O.getBoundingClientRect(), b = I.getBoundingClientRect(); const so = getComputedStyle(O), si = getComputedStyle(I);
  const R = parseFloat(so.borderTopLeftRadius), r = parseFloat(si.borderTopLeftRadius);
  const corners = [[b.left - a.left, b.top - a.top], [a.right - b.right, b.top - a.top], [b.left - a.left, a.bottom - b.bottom], [a.right - b.right, a.bottom - b.bottom]];
  const inset = Math.min(...corners.map(c => Math.max(c[0], c[1])));
  return { outer: outerSel, inner: innerSel, R, inset: Math.round(inset * 10) / 10, r, want: Math.max(0, Math.round((R - inset) * 10) / 10), off: Math.round((r - Math.max(0, R - inset)) * 10) / 10 };
};
const marginsIn = () => {
  // leftmost / rightmost painted or text box that is not full-bleed, in the viewport
  const W = innerWidth; let L = 1e9, Rr = -1e9, ls = '', rs = '';
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden') continue; let fx = false; for (let e = el; e && e !== document.body; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') { fx = true; break; } } if (fx) continue;
    const b = el.getBoundingClientRect(); if (b.width < 24 || b.height < 12 || b.bottom < 0 || b.top > innerHeight || b.width >= W - 1) continue;
    const painted = (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent') || parseFloat(s.borderLeftWidth) > 0 || s.boxShadow !== 'none' || [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!painted) continue;
    if (b.left < L) { L = b.left; ls = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''); }
    if (b.right > Rr) { Rr = b.right; rs = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''); }
  }
  return { vw: W, left: Math.round(L * 10) / 10, right: Math.round((W - Rr) * 10) / 10, span: Math.round((Rr - L) * 10) / 10, leftSel: ls, rightSel: rs };
};
const sizeOf = sels => sels.map(sel => { const el = document.querySelector(sel); if (!el) return { sel, missing: true }; const b = el.getBoundingClientRect(); return { sel, w: Math.round(b.width), h: Math.round(b.height), r: getComputedStyle(el).borderTopLeftRadius }; });

const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  // V1
  out.V1 = [];
  for (const c of [
    { area: 'shell', hash: '#me', pair: ['.me-grid > .card.glass:has(#syncnow)', '#syncnow'] },
    { area: 'kidverse', pair: ['section#story', '#story-say'] },
    { area: 'leftovers', pair: ['form#add', '#name'] },
    { area: 'shell', hash: '#home', pair: ['.glance > .card.gcard', '.btn'] },
  ]) {
    const d = await L.device({ device: 'ipad-portrait', mode: 'light', profile: c.profile || 'eli' });
    let fr; if (c.hash) { await d.goto(c.hash); await sleep(2500); fr = d.page.mainFrame(); } else { fr = await d.openApp(c.area); await sleep(2500); }
    const r = await fr.evaluate(concIn, c.pair).catch(e => ({ error: e.message }));
    out.V1.push({ area: c.area, profile: c.profile || 'eli', ...r }); console.log('V1', c.area, c.profile || '', JSON.stringify(r));
    await d.close();
  }
  // V2
  out.V2 = [];
  for (const device of ['iphone-pwa', 'ipad-portrait', 'ipad-landscape', 'desktop']) {
    for (const a of ['shell', 'leftovers', 'prayer', 'f260', 'kidverse', 'timer', 'tally', 'verses']) {
      const d = await L.device({ device, mode: 'light', profile: 'eli' });
      let fr; if (a === 'shell') { await d.goto('#home'); await sleep(2500); fr = d.page.mainFrame(); } else { fr = await d.openApp(a); await sleep(2500); }
      const m = await fr.evaluate(marginsIn).catch(e => ({ error: e.message }));
      out.V2.push({ device, area: a, ...m }); console.log('V2', device, a, JSON.stringify(m));
      if (a === 'shell' && device === 'ipad-portrait') await d.page.screenshot({ path: path.join(EV, 'verify-margins-shell-ipad-portrait.png'), scale: 'css', animations: 'disabled' });
      await d.close();
    }
  }
  // V3
  {
    const d = await L.device({ device: 'ipad-portrait', mode: 'light', profile: 'eli' });
    const fr = await d.openApp('prayer'); await sleep(3000);
    const r = await fr.evaluate(() => { if (typeof toast !== 'function') return { error: 'toast() not global' }; toast('Moved to the record.', 'Undo', () => {}); const b = document.querySelector('#toastAct').getBoundingClientRect(); const t = document.querySelector('#toast').getBoundingClientRect(); const s = getComputedStyle(document.querySelector('#toastAct')); return { undo: { w: Math.round(b.width), h: Math.round(b.height), padding: s.padding, fontSize: s.fontSize }, toast: { w: Math.round(t.width), h: Math.round(t.height) } }; });
    await sleep(400);
    const box = await fr.locator('#toast').boundingBox().catch(() => null);
    if (box) await d.page.screenshot({ path: path.join(EV, 'verify-prayer-undo-toast.png'), scale: 'css', clip: { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 20), width: Math.min(820, box.width + 40), height: box.height + 40 } });
    out.V3 = r; console.log('V3', JSON.stringify(r));
    await d.close();
  }
  // V4
  out.V4 = [];
  for (const c of [
    { area: 'leftovers', device: 'ipad-portrait', sels: ['.item button.done', '#name', '#size', '#date', '#mic', 'button.log'] },
    { area: 'shell', device: 'ipad-landscape', hash: '#home', sels: ['#tabbar .tab', '#tabbar .tab.on'] },
    { area: 'shell', device: 'ipad-portrait', hash: '#home', sels: ['#tabbar .tab'] },
    { area: 'dollywood-live', device: 'ipad-portrait', sels: ['#lv-handle', '#loc-near', '#lv-family', '#lv-north', '#lv-fit', '#loc-btn'] },
    { area: 'kidverse', device: 'ipad-portrait', sels: ['#done', '#say', '#story-say'] },
    { area: 'tally', device: 'ipad-portrait', sels: ['#plus', '#minus', '#reset'] },
  ]) {
    const d = await L.device({ device: c.device, mode: 'light', profile: 'ezra' });
    let fr; if (c.hash) { await d.goto(c.hash); await sleep(2500); fr = d.page.mainFrame(); } else { fr = await d.openApp(c.area); await sleep(c.area.startsWith('dollywood') ? 6000 : 2500); }
    const kind = await fr.evaluate(() => document.documentElement.getAttribute('data-kind'));
    const r = await fr.evaluate(sizeOf, c.sels).catch(e => ({ error: e.message }));
    out.V4.push({ area: c.area, device: c.device, kind, sizes: r }); console.log('V4', c.area, c.device, kind, JSON.stringify(r));
    await d.close();
  }
  // V5 (sheet radii) is read from code: design.css:582, prayer.html:239, template.html:359/422, f260.html:385
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, 'verify.json'), JSON.stringify(out, null, 1));
console.log('wrote verify.json');
