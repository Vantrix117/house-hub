// TELL / tells-chromium: the web tells Chromium measures better than WebKit, run the SAME way in all 11 areas.
//   node audits/tools/phase4/TELL/tells-chromium.mjs [area…]   → audits/evidence/p4/TELL/tells-chromium.json (merged per area)
// Desktop 1440x900 (no touch, classic scrollbars as on Windows or a Mac with a mouse), System theme, light OS:
//   tapHi     computed -webkit-tap-highlight-color on every visible control (Chromium computes it; WebKit here does not)
//   keyboard  Tab from the document start, up to 14 stops: is each stop :focus-visible and does a ring paint
//             (outline or box-shadow different from the same element's unfocused style)?
//   scrollbars every scroller in the document with its classic scrollbar px, scrollbar-width and whether it is chrome
//   fields    every input/select/textarea in the DOM (rendered or not) with its computed font-size (< 16 px zooms on iOS focus)
// iPad portrait (touch, Chromium mobile emulation):
//   tapDelay  touchend → click latency for a tap on the area's safe control (areas.mjs TAP)
// Screenshots (1x) only where a classic scrollbar paints on chrome: audits/evidence/p4/TELL/scrollbar-<area>-desktop.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
import { AREAS, TAP, openArea, profileFor, deviceFor } from './areas.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits/evidence/p4/TELL');
const OUT = path.join(EV, 'tells-chromium.json');
const want = process.argv.slice(2).length ? process.argv.slice(2) : AREAS;
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { areas: {} };
const out = { note: 'See the header of audits/tools/phase4/TELL/tells-chromium.mjs.', engine: 'chromium', areas: prev.areas || {} };

const PROBE = () => {
  const CTL = 'button, a[href], [role=button], [role=tab], [role=switch], summary, label, .tile, .chip, [data-open]';
  const shown = e => { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const sel = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '');
  const ctl = [...document.querySelectorAll(CTL)].filter(e => shown(e) && !e.closest('svg'));
  const th = {}; for (const e of ctl) { const v = getComputedStyle(e).webkitTapHighlightColor; th[v] = (th[v] || 0) + 1; }
  const px = v => parseFloat(v) || 0;
  const sc = [];
  const se = document.scrollingElement;
  const docBar = innerWidth - document.documentElement.clientWidth;
  if (se.scrollHeight > se.clientHeight + 1) sc.push({ sel: 'document', vbar: docBar, hbar: innerHeight - document.documentElement.clientHeight, scrollbarWidth: getComputedStyle(document.documentElement).scrollbarWidth, chrome: false });
  for (const el of document.querySelectorAll('*')) {
    const s = getComputedStyle(el); if (!/(auto|scroll)/.test(s.overflowY + s.overflowX)) continue; if (!shown(el)) continue;
    const y = /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1, x = /(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1;
    if (!x && !y) continue;
    const vbar = el.offsetWidth - el.clientWidth - px(s.borderLeftWidth) - px(s.borderRightWidth), hbar = el.offsetHeight - el.clientHeight - px(s.borderTopWidth) - px(s.borderBottomWidth);
    let chrome = false; for (let a = el; a && a !== document.body; a = a.parentElement) { const c = getComputedStyle(a); if (/fixed|sticky/.test(c.position) || a.matches('nav, header, aside, [role=tablist], .tabbar, .topbar, .chips, .sheet, .side, .miles, .lv-sheet, .lv-body, .pop, #views')) { chrome = true; break; } }
    sc.push({ sel: sel(el), x, y, vbar: Math.round(vbar), hbar: Math.round(hbar), scrollbarWidth: s.scrollbarWidth, chrome, w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) });
    if (sc.length > 30) break;
  }
  const fields = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=button]):not([type=submit]), select, textarea')]
    .map(e => ({ sel: sel(e), type: e.type, fs: parseFloat(getComputedStyle(e).fontSize), rendered: shown(e) }));
  return { controls: ctl.length, tapHighlight: th, scrollers: sc, fields, fieldsUnder16: fields.filter(f => f.fs < 16) };
};

const TABSTOP = () => {
  const a = document.activeElement; if (!a || a === document.body) return null;
  const c = getComputedStyle(a);
  const sel = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '');
  const base = a.getAttribute('data-tell-base'); const now = c.outlineStyle + ' ' + c.outlineWidth + ' ' + c.outlineColor + ' | ' + c.boxShadow;
  return { sel: sel(a), focusVisible: a.matches(':focus-visible'), now: now.slice(0, 160), base: base && base.slice(0, 160), ring: base !== null && base !== now && !(c.outlineStyle === 'none' && c.boxShadow === (base.split(' | ')[1] || '')) };
};
const BASELINE = () => { for (const e of document.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex], iframe')) { const c = getComputedStyle(e); e.setAttribute('data-tell-base', c.outlineStyle + ' ' + c.outlineWidth + ' ' + c.outlineColor + ' | ' + c.boxShadow); } };

const L = await local({ variant: 'typical', engine: 'chromium' });
try {
  for (const area of want) {
    const R = { area };
    try {
      const d = await L.device({ device: deviceFor(area, 'desktop'), mode: 'light', profile: profileFor(area) });
      const { doc } = await openArea(d, area, { settle: 1500 });
      R.desktop = await doc.evaluate(PROBE);
      if (R.desktop.scrollers.some(s => s.chrome && (s.vbar > 0 || s.hbar > 0)) || R.desktop.scrollers.some(s => s.sel === 'document' && s.vbar > 0)) {
        const f = path.join(EV, `scrollbar-${area}-desktop.png`); await d.page.screenshot({ path: f, scale: 'css' }); R.desktop.shot = path.relative(ROOT, f).replace(/\\/g, '/');
      }
      // keyboard: baseline styles, then Tab from the start of the document
      await doc.evaluate(BASELINE);
      if (doc !== d.page.mainFrame()) await doc.evaluate(() => { window.focus(); document.activeElement && document.activeElement.blur && document.activeElement.blur(); });
      R.keyboard = [];
      for (let i = 0; i < 14; i++) {
        await d.page.keyboard.press('Tab'); await sleep(120);
        const st = await doc.evaluate(TABSTOP).catch(() => null);
        if (!st) { R.keyboard.push({ sel: '(left the document or body)' }); continue; }
        R.keyboard.push(st);
      }
      const seen = new Set(); const k = R.keyboard.filter(x => x.focusVisible !== undefined && !seen.has(x.sel + x.now) && seen.add(x.sel + x.now));
      R.keyboardSummary = { stops: k.length, focusVisible: k.filter(x => x.focusVisible).length, ringPainted: k.filter(x => x.ring).length, noRing: [...new Set(k.filter(x => !x.ring).map(x => x.sel))].slice(0, 10) };
      if (k.length) { const f = path.join(EV, `keyboard-${area}-desktop.png`); /* only the first stop's box, small */ const box = await doc.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }).catch(() => null); R.keyboardShotBox = box; }
      await d.close();
      // shell: the chat composer and the add-guest sheet hold the shell's only on-demand fields
      if (area === 'shell') {
        const d4 = await L.device({ device: 'desktop', mode: 'light', profile: 'eli' });
        await d4.goto('#chat'); await sleep(1500);
        const chat = await d4.page.evaluate(() => [...document.querySelectorAll('input, textarea, select')].filter(e => e.offsetParent).map(e => ({ sel: e.tagName.toLowerCase() + '#' + e.id, fs: parseFloat(getComputedStyle(e).fontSize) })));
        await d4.goto('#me'); await sleep(1500);
        await d4.page.click('#guest-add').catch(() => {}); await sleep(700);
        const guest = await d4.page.evaluate(() => [...document.querySelectorAll('.sheet input, .sheet select, .sheet textarea')].map(e => ({ sel: e.tagName.toLowerCase() + '#' + e.id + '[' + e.type + ']', fs: parseFloat(getComputedStyle(e).fontSize) })));
        R.shellOnDemandFields = { chat, guest };
        await d4.close();
      }
      // tap delay on the iPad (touch)
      if (TAP[area]) {
        const d2 = await L.device({ device: deviceFor(area, 'ipad-portrait'), mode: 'light', profile: profileFor(area) });
        const { doc: doc2 } = await openArea(d2, area);
        await doc2.evaluate(() => { window.__td = {}; addEventListener('touchend', () => { window.__td.end = performance.now(); }, true); addEventListener('click', () => { if (window.__td.click == null) window.__td.click = performance.now(); }, true); });
        await doc2.tap(TAP[area], { timeout: 3000 }).catch(e => { R.tapErr = e.message.slice(0, 80); });
        await sleep(600);
        const td = await doc2.evaluate(() => window.__td).catch(() => ({}));
        R.tapDelay = { control: TAP[area], touchendToClickMs: td.end != null && td.click != null ? +(td.click - td.end).toFixed(1) : null, raw: td };
        await d2.close();
      }
    } catch (e) { R.error = String(e.message || e).split('\n')[0]; }
    out.areas[area] = R;
    console.log(area, JSON.stringify({ th: R.desktop && R.desktop.tapHighlight, kb: R.keyboardSummary, sb: R.desktop && R.desktop.scrollers.filter(s => s.vbar || s.hbar).map(s => `${s.sel}${s.chrome ? '(chrome)' : ''} v${s.vbar} h${s.hbar} ${s.scrollbarWidth}`), f16: R.desktop && R.desktop.fieldsUnder16.map(f => f.sel + ' ' + f.fs), td: R.tapDelay && R.tapDelay.touchendToClickMs, err: R.error }));
    fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  }
} finally { await L.close(); }
console.log('wrote', path.relative(ROOT, OUT));
