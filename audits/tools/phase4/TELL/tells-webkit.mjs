// TELL / tells-webkit: the web tells that WebKit (Playwright, closest to Safari) can show, run the SAME way in all 11 areas.
//   node audits/tools/phase4/TELL/tells-webkit.mjs [area…]     → audits/evidence/p4/TELL/tells-webkit.json (merged per area)
// iPad portrait (820x1180, touch), System theme, light OS; the TV area on the 1920x1080 TV as the kiosk.
// Per area (the app's own frame document; the page for shell/tv):
//   select   computed -webkit-user-select on every visible CONTROL (button, a, [role=button|tab|switch], summary, label,
//            .tile, .chip, [data-open]); a double-click on up to 3 chrome labels (selection proxy for long-press)
//   callout  images and links a long-press would offer a callout for (no -webkit-touch-callout rule exists: static.json)
//   focusTap tap a safe control (areas.mjs TAP) with touch; is it :focus-visible and does its ring paint?
//   zoom     visible text fields / selects under 16 px (iOS zooms the page when such a field is focused)
//   touch    computed touch-action on controls
//   over     overscroll-behavior of html (the viewport's) and body, whether body is a scroll container, the canvas colour
//            (html background, else body's, which propagates) against the content's top and bottom edge pixels,
//            in System light, System dark and Midnight (light OS)
// Nothing here writes household data except the Tally + tap and theme rows (local rig only; reset to system after).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
import { AREAS, TAP, openArea, profileFor, deviceFor } from './areas.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p4/TELL/tells-webkit.json');
const want = process.argv.slice(2).length ? process.argv.slice(2) : AREAS;
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { areas: {} };
const out = { note: 'See the header of audits/tools/phase4/TELL/tells-webkit.mjs.', engine: 'webkit', areas: prev.areas || {} };

const PROBE = () => {
  const CTL = 'button, a[href], [role=button], [role=tab], [role=switch], summary, label, .tile, .chip, [data-open]';
  const shown = e => { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const sel = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '');
  const ctl = [...document.querySelectorAll(CTL)].filter(e => shown(e) && !e.closest('svg') && !e.matches('input,textarea,select'));
  const us = {}; const selectable = {};
  for (const e of ctl) { const s = getComputedStyle(e); const v = s.webkitUserSelect || s.userSelect; us[v] = (us[v] || 0) + 1; if (!/none/.test(v)) selectable[sel(e)] = (selectable[sel(e)] || 0) + 1; }
  const ta = {}; for (const e of ctl) { const v = getComputedStyle(e).touchAction; ta[v] = (ta[v] || 0) + 1; }
  const imgs = [...document.querySelectorAll('img')].filter(shown);
  const links = [...document.querySelectorAll('a[href]')].filter(shown);
  const fields = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]), select, textarea')].filter(shown)
    .map(e => ({ sel: sel(e), type: e.type, fs: parseFloat(getComputedStyle(e).fontSize) }));
  const cs = e => getComputedStyle(e);
  const H = document.documentElement, B = document.body;
  const rgba = c => { const m = c.match(/[\d.]+/g); if (!m) return [0, 0, 0, 0]; const v = m.map(Number); if (/^color\(srgb/.test(c)) { const o = v.slice(0, 3).map(x => Math.round(x * 255)); o.push(v.length > 3 ? v[3] : 1); return o; } return v.concat(v.length === 3 ? [1] : []); };
  const hb = rgba(cs(H).backgroundColor), bb = rgba(cs(B).backgroundColor);
  const canvas = hb[3] > 0 ? { from: 'html', c: hb } : { from: 'body (propagated)', c: bb };
  const se = document.scrollingElement;
  const labels = [];
  const pick = s => { const e = [...document.querySelectorAll(s)].find(x => shown(x) && x.textContent.trim().length > 2 && !x.closest('svg') && !labels.includes(x)); if (e) labels.push(e); };
  ['[role=tab], .tab, .seg button', 'header h1, .topbar h1, .hero-title, .view-title h1, h1', 'button, [role=button]'].forEach(pick);
  labels.forEach((e, i) => e.setAttribute('data-tell-lbl', String(i)));
  return {
    controls: ctl.length, userSelect: us, selectable: Object.entries(selectable).sort((a, b) => b[1] - a[1]).slice(0, 15), touchAction: ta,
    imgs: imgs.length, imgsDraggable: imgs.filter(i => i.draggable).length, links: links.length,
    fields, fieldsUnder16: fields.filter(f => f.fs < 16),
    over: { html: cs(H).overscrollBehaviorY, body: cs(B).overscrollBehaviorY, bodyOverflow: cs(B).overflowY, bodyPos: cs(B).position,
      docScrolls: se.scrollHeight > se.clientHeight + 1, scrollingElement: se.tagName, canvas, htmlBg: hb, bodyBg: bb, bodyImg: cs(B).backgroundImage !== 'none' },
    viewport: (document.querySelector('meta[name=viewport]') || {}).content || null,
    chromeLabels: labels.map(sel),
  };
};
const RL = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const x = RL(a), y = RL(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };

const L = await local({ variant: 'typical', engine: 'webkit' });
const dec = await L.browser.newPage();
async function edgeColours(png, rect) {
  return dec.evaluate(async ([b64, r]) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const row = y => { const d = g.getImageData(Math.round(r.x), Math.round(y), Math.max(1, Math.round(r.w)), 2).data; const px = []; for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]); px.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2])); return px[px.length >> 1]; };
    return { top: row(r.y + 1), bottom: row(r.y + r.h - 3) };
  }, [png.toString('base64'), rect]);
}
try {
  for (const area of want) {
    const R = { area };
    try {
      const d = await L.device({ device: deviceFor(area, 'ipad-portrait'), mode: 'light', profile: profileFor(area) });
      const { doc } = await openArea(d, area);
      R.probe = await doc.evaluate(PROBE);
      // selection proxy: double-click each chrome label, read the selection
      R.dblclick = [];
      for (let i = 0; i < R.probe.chromeLabels.length; i++) {
        const s = `[data-tell-lbl="${i}"]`;
        await doc.evaluate(() => getSelection().removeAllRanges()).catch(() => {});
        const before = d.page.url();
        const pos = await doc.evaluate(q => { const e = document.querySelector(q); const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT, { acceptNode: n => n.textContent.trim().length > 1 ? 1 : 3 }); const t = w.nextNode(); if (!t) return null; const i = t.textContent.search(/\S/); const r = document.createRange(); r.setStart(t, i); r.setEnd(t, Math.min(t.textContent.length, i + 2)); const a = r.getBoundingClientRect(), b = e.getBoundingClientRect(); return { x: a.x - b.x + a.width / 2, y: a.y - b.y + a.height / 2 }; }, s).catch(() => null);
        await doc.dblclick(s, { timeout: 2000, noWaitAfter: true, ...(pos ? { position: pos } : {}) }).catch(() => {});
        await sleep(250);
        const got = await doc.evaluate(() => getSelection().toString().trim().slice(0, 40)).catch(() => '(frame gone)');
        R.dblclick.push({ label: R.probe.chromeLabels[i], selected: got, navigated: d.page.url() !== before });
        await doc.evaluate(() => getSelection().removeAllRanges()).catch(() => {});
        if (d.page.url() !== before) break;
      }
      await d.close();
      // focus ring after a touch tap (fresh device so the double-clicks above do not interfere)
      if (TAP[area]) {
        const d2 = await L.device({ device: deviceFor(area, 'ipad-portrait'), mode: 'light', profile: profileFor(area) });
        const { doc: doc2 } = await openArea(d2, area);
        const before = await doc2.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); return { outline: c.outlineStyle + ' ' + c.outlineWidth, shadow: c.boxShadow.slice(0, 90) }; }, TAP[area]);
        await doc2.tap(TAP[area], { timeout: 3000 }).catch(e => { R.tapErr = e.message.slice(0, 80); });
        await sleep(400);
        R.focusTap = await doc2.evaluate(([s, b]) => { const a = document.activeElement; const e = document.querySelector(s); const c = a ? getComputedStyle(a) : null;
          return { control: s, found: !!e, activeIsControl: a === e, active: a && (a.id || a.tagName), focusVisible: !!(a && a !== document.body && a.matches(':focus-visible')), outline: c && c.outlineStyle + ' ' + c.outlineWidth, shadow: c && c.boxShadow.slice(0, 90), before: b }; }, [TAP[area], before]).catch(e => ({ err: e.message.slice(0, 80) }));
        R.focusTap.ringPainted = !!(R.focusTap.activeIsControl && before && (R.focusTap.shadow !== before.shadow || R.focusTap.outline !== before.outline));
        await d2.close();
      }
      // overscroll colours: canvas vs the content's edge pixels (top at scroll 0, bottom at the end)
      R.over = {};
      for (const [mode, theme] of [['light', 'system'], ['dark', 'system'], ['light', 'midnight']]) {
        const p0 = profileFor(area);
        const extra = theme === 'system' ? null : { 'hub.theme': JSON.stringify(theme) };
        if (theme !== 'system' && p0 !== 'tv') await L.apiAs(p0, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } });
        const d3 = await L.device({ device: deviceFor(area, 'ipad-portrait'), mode, profile: p0, localStorage: extra });
        const { doc: doc3, frameEl: fe } = await openArea(d3, area, { settle: 1500 });
        const p = await doc3.evaluate(PROBE);
        const vs = d3.page.viewportSize();
        const off = fe ? await fe.boundingBox() : { x: 0, y: 0, width: vs.width, height: vs.height };
        let rect = { x: off.x, y: off.y, w: off.width, h: off.height };
        if (area === 'shell' || area === 'tv') { const v = await d3.page.$eval('#views', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }).catch(() => null); if (v) rect = v; }
        const top = await edgeColours(await d3.page.screenshot({ scale: 'css' }), rect);
        await doc3.evaluate(a => { const s = (a === 'shell' || a === 'tv') ? document.querySelector('#views') : document.scrollingElement; s.scrollTop = s.scrollHeight; }, area).catch(() => {});
        await sleep(500);
        const bot = await edgeColours(await d3.page.screenshot({ scale: 'css' }), rect);
        const cv = p.over.canvas.c.slice(0, 3);
        R.over[`${theme}-${mode}`] = { theme: await doc3.evaluate(() => [document.documentElement.dataset.theme || '(none)', document.documentElement.dataset.scheme]).catch(() => null), canvas: p.over.canvas, html: p.over.html, body: p.over.body, bodyOverflow: p.over.bodyOverflow, bodyPos: p.over.bodyPos, docScrolls: p.over.docScrolls, top: top.top, bottom: bot.bottom,
          ratioTop: p.over.canvas.c[3] > 0 ? ratio(cv, top.top) : null, ratioBottom: p.over.canvas.c[3] > 0 ? ratio(cv, bot.bottom) : null };
        await d3.close();
        if (theme !== 'system' && p0 !== 'tv') await L.apiAs(p0, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: 'system' } });
      }
    } catch (e) { R.error = String(e.message || e).split('\n')[0]; }
    out.areas[area] = R;
    console.log(area, JSON.stringify({ controls: R.probe && R.probe.controls, us: R.probe && R.probe.userSelect, dbl: R.dblclick && R.dblclick.map(x => x.selected), tap: R.focusTap && [R.focusTap.focusVisible, R.focusTap.ringPainted], zoom: R.probe && R.probe.fieldsUnder16.length, over: R.over && Object.fromEntries(Object.entries(R.over).map(([k, v]) => [k, [v.ratioTop, v.ratioBottom]])), err: R.error }));
    fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  }
} finally { await L.close(); }
console.log('wrote', path.relative(ROOT, OUT));
