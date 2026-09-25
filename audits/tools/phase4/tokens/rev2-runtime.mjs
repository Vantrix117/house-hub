#!/usr/bin/env node
// Phase 4 · token proposal, revisions 2 and 3 · runtime checks on the local rig (WebKit), with apps/design.css lines 14-289 (the token
// section the proposal replaces) swapped for audits/tools/phase4/tokens/proposed-tokens.css through a route. App code unchanged, except
// the PLANNED batch rows (below) injected in the "planned" runs of C, D and E. Exits 1 if any verdict fails.
//   A. the display profile (tv) at 1920x1080 and 1024x768: today vs the proposal (default kiosk) vs the proposal with the
//      opt-in 10-foot scale (data-tv-scale="10ft" set on <html> after load). Fit = the .tv grid bottom <= the viewport,
//      no child past the viewport, no clipped leaf text, no horizontal scroll.
//   B. F260's theme segmented control (apps/f260.html:2028 renders <button data-theme="…">): each button must keep the
//      document's palette (color-scheme, --text-2, --surface) under the proposal.
//   C. kid mode (ezra): the share of visible text in ui-rounded on Home and every kid-visible app, Prayer and the Larder counts included,
//      as the code is and with the planned rows applied (house style: ui-rounded throughout kid mode).
//   D. big numerals (house style: ui-rounded for timer, tally and progress counts): every rule in the shell and the apps that sets
//      font-variant-numeric: tabular-nums or reads --font-display for a number must be on the batch-1a --font-numeral list (static),
//      and with that move applied every rendered one resolves to ui-rounded for an adult, a kid and the kiosk (runtime).
//   E. the text floor: no visible text under 11 px for an adult or the kiosk on Home and every app, with the named literal rows
//      moved to --fs-caption2; in kid mode no visible text under 16 px with the named kid-floor rows (KID_ROWS) moved to roles, and
//      every kid text under 16 px in the unplanned run is on one of those rows (TOKENS.md, migration table).
//   F. (round 4) the Dollywood pair, which the documents above leave out: the build guide (adults) and the park map (adults AND kids:
//      apps.json gives it no visibleTo). Screens from audits/tools/areas (the map, the whole park, waits, the cross-section, the kid's
//      map and Family pane) on the iPhone PWA and the iPad portrait. Text is measured as it RENDERS: HTML at its computed size (x any
//      CSS zoom), SVG <text>/<tspan> at computed size x sqrt|det(getScreenCTM())| (the map scales its labels), and ::before/::after
//      text. Floors: 11 px adult, 16 px kid. "planned" = the template rows TOKENS.md names (DOLLY_CSS as CSS; the SVG label rule
//      "size = max(--fs-floor, design px) / screen scale", which is JS in the template's apply(), emulated per named selector).
//   PLANNED is the exact CSS those batch rows add, injected into each document after load; "unplanned" runs show app code as it is.
// Usage: node audits/tools/phase4/tokens/rev2-runtime.mjs → audits/evidence/p4/tokens/rev2-runtime.json (+ rev2-tv-1920-proposed.png)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { local, ROOT, sleep } from '../../lib/local.mjs';
import { DEVICES } from '../../lib/devices.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p4/tokens/rev2-runtime.json');
const lines = fs.readFileSync(path.join(ROOT, 'apps/design.css'), 'utf8').split('\n');
if (!/^:root \{/.test(lines[13]) || !/^\}/.test(lines[288])) throw new Error('design.css token section moved');
const PROPOSED = fs.readFileSync(path.join(ROOT, 'audits/tools/phase4/tokens/proposed-tokens.css'), 'utf8');
const swapped = [...lines.slice(0, 13), PROPOSED, ...lines.slice(289)].join('\n');

// the batch rows TOKENS.md names (migration table), as CSS injected into each document: the --font-numeral move (batch 1a), the
// sub-11 literal rows (batch 1a) and Prayer's kid rule (Prayer batch; written for D13 = "Keep", the worst case for kid mode)
const NUMERALS = {
  shell: ['.home-hero .clock', '.park-list .pt', '.kid-chip b', '#timer-pill .tp-time', '#pill #pill-timer', ':root[data-kind="kiosk"] .tv-hero .clock', ':root[data-kind="kiosk"] .tv-face b'],
  timer: ['.time'], tally: ['.count'], kidverse: ['.stars .count', '.rewards .bank b', '.stepper .wk'], verses: ['.done .big', '.boxes .n', '.queue .when'],
};
const FILE_OF = { shell: 'index.html', timer: 'apps/timer.html', tally: 'apps/tally.html', kidverse: 'apps/kidverse.html', verses: 'apps/verses.html' };
const PLANNED = {
  ...Object.fromEntries(Object.entries(NUMERALS).map(([k, sels]) => [k, sels.join(', ') + ' { font-family: var(--font-numeral); }'])),
};
PLANNED.kidverse += ' .badges li small, .kids .days span { font-size: var(--fs-caption2); }';            // apps/kidverse.html:86, :110
PLANNED.f260 = '.tring .rn small { font-size: var(--fs-caption2); }';                                     // apps/f260.html:133
PLANNED.prayer = ':root[data-kind="kid"] body { font-family: var(--font-ui); } :root[data-kind="kid"] :is(.ansnote, #pray .last) { font-family: var(--font-serif); }';
// kid-floor rows: text a kid sees under 16 px, each moved to a role (floor 16 in kid mode) in its app's batch (TOKENS.md, migration table)
// (selector → role; the nearest role to today's adult px, ties up). Found by this script's own kid runs (E); each is a literal px.
const KID_ROWS = {
  prayer: [['.date', '--fs-subheadline', 'apps/prayer.html:57', 14]],
  leftovers: [['.tally', '--fs-caption1', 'apps/leftovers.html:24', 12], ['.lede', '--fs-subheadline', 'apps/leftovers.html:25', 14], ['.alert', '--fs-footnote', 'apps/leftovers.html:30', 13],
    ['.group h2', '--fs-footnote', 'apps/leftovers.html:67', 13], ['.group h2 small', '--fs-caption2', 'apps/leftovers.html:69', 11], ['.meta', '--fs-footnote', 'apps/leftovers.html:76', 12.5],
    ['.status', '--fs-caption1', 'apps/leftovers.html:82', 11.5], ['.hearth p', '--fs-footnote', 'apps/leftovers.html:92', 13], ['.copy', '--fs-subheadline', 'apps/leftovers.html:94', 14]],
};
const KID_FLOOR = Object.fromEntries(Object.entries(KID_ROWS).map(([k, rows]) => [k, rows.map(r => r[0])]));
KID_FLOOR.kidverse = ['.badges li small', '.kids .days span'];   // the batch-1a --fs-caption2 rows above (16 px in kid mode)
for (const [k, rows] of Object.entries(KID_ROWS)) PLANNED[k] = (PLANNED[k] || '') + ' ' + rows.map(([sel, role]) => `${sel} { font-size: var(${role}); }`).join(' ');
const inject = (target, key) => target.evaluate(css => { if (!css) return; const st = document.createElement('style'); st.id = 'planned-rows'; st.textContent = css; document.head.appendChild(st); }, PLANNED[key] || '');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const run = k => !ONLY.length || ONLY.includes(k);
// F. the Dollywood template rows (../dollywood-build-project/scripts/template.html; the two exports repeat its CSS line for line)
const DOLLY_CSS = [['.lv-north b', '--fs-caption2', 'template.html:418 (9px, the compass N)'], ['.wtile small', '--fs-caption2', ':500 (9.5px, the wait tile MIN)'],
  ['.toolbar .tg::before', '--fs-caption2', ':156 (10.5px, the toolbar group labels)']];
const DOLLY_SVG = [['.seclab', 15, ':111/:277, sized in apply() :802 (15 x min(k, 1.1) user units)'], ['.onum', 11, ':131/:281, drawn at the marker scale :800'],
  ['.clab', 9.5, ':133, sized in apply() :801 (9.5 x k)'], ['svg#prof text', 12, 'the cross-section axis (export apps/dollywood.html:936, font-size 12 in a viewBox)'],
  ['.lv-wait text', 13, ':494, drawn at the marker scale'], ['.lv-wait text tspan.u', 9, ':494 (9px, the MIN unit)'],
  ['.amk text', 11, ':513 (11px, the amenity marker labels, drawn at the marker scale)'],
  ['.famk text.famlab', 11, 'the family labels, 11 x k user units (template.html:1339; export :1221): 11 px on screen, 16 for a kid'], ['.lv-meetpin text', 11, 'the meeting-point label, 11 x k (template.html:1349)']];
PLANNED['dollywood'] = PLANNED['dollywood-live'] = DOLLY_CSS.map(([sel, role]) => `${sel} { font-size: var(${role}); }`).join(' ');
// the park map's KID-FLOOR row (template batch): every font-size literal under 16 px in the template's CSS moves to its nearest role,
// ties up (the TYPE-12 "no px font sizes" rule applied in that batch; 16 px+ in kid mode). Generated here from the park-map export, which
// repeats the template's CSS line for line; SVG label rules are left to the SVG rule above. @media wrappers are kept.
const ROLE_PX = [['--fs-caption2', 11], ['--fs-caption1', 12], ['--fs-footnote', 13], ['--fs-subheadline', 15], ['--fs-callout', 16]];
const nearestRole = px => ROLE_PX.reduce((best, r) => { const d = Math.abs(r[1] - px), bd = Math.abs(best[1] - px); return d < bd || (d === bd && r[1] > best[1]) ? r : best; })[0];
const DOLLY_KID = (() => {
  const src = fs.readFileSync(path.join(ROOT, 'apps/dollywood-live.html'), 'utf8');
  const css = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const svgSel = /(^|[\s>])(text|tspan)\b|\.onum|\.clab|\.seclab|\.famlab/;
  const out = []; let depth = 0, media = null, buf = '';
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') {
      const head = buf.trim(); buf = '';
      if (head.startsWith('@')) { media = head; depth++; continue; }
      const close = css.indexOf('}', i); const body = css.slice(i + 1, close); i = close;
      const f = body.match(/font-size:\s*([\d.]+)px/);
      if (f && +f[1] < 16) {
        const sels = head.split(',').map(x => x.trim()).filter(x => x && !svgSel.test(x));
        if (sels.length) out.push({ sel: sels.join(', '), px: +f[1], role: nearestRole(+f[1]), media: depth ? media : null });
      }
      continue;
    }
    if (ch === '}') { if (depth) { depth--; media = null; } buf = ''; continue; }
    buf += ch;
  }
  return out;
})();
// two more template rows the kid runs found: a UA-relative size (small is 'smaller' inside .lv-hero, :489) and the Archivo literal
// on the listing-number badges (:117, :131; a numeral, so --font-numeral, rounded for everyone)
const DOLLY_MORE = [['[data-flavor=live] .lv-hero small', 'font-size: var(--fs-caption1)', ':489 (UA smaller of 14px: 11.7 adult, 15 kid)'], ['.pop .badge, .onum', 'font-family: var(--font-numeral)', ':117, :131 (Archivo)']];
for (const k of ['dollywood', 'dollywood-live']) PLANNED[k] += ' ' + DOLLY_MORE.map(([sel, decl]) => sel + ' { ' + decl + '; }').join(' ');
PLANNED['dollywood-live'] += ' ' + DOLLY_KID.map(r => (r.media ? `${r.media} { ` : '') + `${r.sel} { font-size: var(${r.role}); }` + (r.media ? ' }' : '')).join(' ');
const res = { generated: new Date().toISOString(), method: 'apps/design.css lines 14-289 replaced by proposed-tokens.css through a route on the local rig; WebKit; app code unchanged except the PLANNED batch rows injected where a section says so', planned: PLANNED, plannedMore: DOLLY_MORE, plannedParkMapKidRows: { rule: 'every font-size literal under 16 px in the template CSS → its nearest role, ties up (template batch)', count: DOLLY_KID.length, rows: DOLLY_KID }, plannedSvgRule: { rule: 'font-size = max(--fs-floor, design px) / sqrt|det(getScreenCTM())| (JS in the template apply(); emulated here per named selector)', rows: DOLLY_SVG }, A: {}, B: {}, C: {}, D: {}, E: {}, F: {} };
// D (static): every tabular-nums rule and every --font-display read of a number in the shell and the apps is on the move list
{
  const listed = new Set(Object.entries(NUMERALS).flatMap(([k, sels]) => sels.map(x => FILE_OF[k] + ' ' + x)));
  const found = [];
  for (const f of ['index.html', ...fs.readdirSync(path.join(ROOT, 'apps')).filter(x => x.endsWith('.html') && !x.startsWith('dollywood')).map(x => 'apps/' + x)]) {
    const t = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of t.matchAll(/([^{}<>]+)\{([^{}]*)\}/g)) if (/tabular-nums/.test(m[2])) for (const sel of m[1].trim().split('\n').pop().split(',').map(x => x.trim())) found.push(f + ' ' + sel);
  }
  res.D.static = { tabularNumsRules: found, missingFromMoveList: found.filter(x => !listed.has(x)) };
}
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const dev = async (opts, proposed) => {
    const d = await L.device(opts);
    if (proposed) await d.ctx.route('**/apps/design.css', r => r.fulfill({ status: 200, contentType: 'text/css', body: swapped }));
    return d;
  };
  // A. the TV board
  if (run('A')) for (const [w, h] of [[1920, 1080], [1024, 768]]) {
    for (const mode of ['today', 'proposed', 'proposed-10ft-opt-in']) {
      const d = await dev({ device: 'tv', profile: 'tv' }, mode !== 'today');
      await d.page.setViewportSize({ width: w, height: h });
      await d.goto('#home');
      if (mode === 'proposed-10ft-opt-in') await d.page.evaluate(() => document.documentElement.setAttribute('data-tv-scale', '10ft'));
      await d.page.waitForTimeout(2500);
      const m = await d.page.evaluate(() => {
        const de = document.documentElement, cs = getComputedStyle(de);
        const clipped = [];
        for (const el of document.querySelectorAll('.tv *')) {
          if (!el.childElementCount && el.textContent.trim() && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible' && !/ellipsis/.test(getComputedStyle(el).textOverflow))
            clipped.push((el.className || el.tagName) + ': ' + el.textContent.trim().slice(0, 40));
        }
        const tv = document.querySelector('.tv'); const r = tv && tv.getBoundingClientRect();
        const over = []; if (tv) for (const c of tv.children) { const b = c.getBoundingClientRect(); if (b.width && (b.right > innerWidth + 1 || b.bottom > innerHeight + 1)) over.push({ cls: String(c.className), right: Math.round(b.right), bottom: Math.round(b.bottom) }); }
        const rem = document.querySelector('.tv-rem'); const rb = rem && rem.getBoundingClientRect();
        return { kind: de.dataset.kind, tvScale: de.dataset.tvScale || null, fsMd: cs.getPropertyValue('--fs-md').trim(), sp4: cs.getPropertyValue('--sp-4').trim(), margin: cs.getPropertyValue('--margin').trim(),
          scrollW: de.scrollWidth, clientW: de.clientWidth, scrollH: de.scrollHeight, innerH: innerHeight,
          tvRect: r && { w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom) },
          reminders: rb && rb.height ? { bottom: Math.round(rb.bottom), visible: rb.bottom <= innerHeight + 1 } : 'not shown (no reminders)',
          childrenPastViewport: over, clippedText: clipped.slice(0, 12) };
      });
      m.fits = !!m.tvRect && m.tvRect.bottom <= m.innerH + 1 && m.childrenPastViewport.length === 0 && m.clippedText.length === 0 && m.scrollW <= m.clientW;
      res.A[`${w}x${h}-${mode}`] = m;
      if (w === 1920 && mode === 'proposed') { const f = path.join(ROOT, 'audits/evidence/p4/tokens/rev2-tv-1920-proposed.png'); await d.page.screenshot({ path: f, scale: 'css', type: 'png' }); res.A[`${w}x${h}-${mode}`].shot = path.relative(ROOT, f).replace(/\\/g, '/'); }
      await d.close();
    }
  }
  // B. F260's theme buttons under the proposal, in a light and a dark palette
  for (const theme of run('B') ? ['hearth', 'midnight'] : []) {
    await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } }).catch(() => {});
    const d = await dev({ device: 'ipad-portrait', profile: 'eli', localStorage: { 'hub.theme': theme } }, true);
    const f = await d.openApp('f260');
    await f.waitForTimeout(2000);
    res.B[theme] = await f.evaluate(() => {
      const seg = document.getElementById('themeSeg'); if (!seg) return { error: 'no #themeSeg' };
      const made = !seg.children.length;
      if (made) seg.innerHTML = hub.THEMES.concat([{ id: 'graphite', name: 'Graphite' }]).map(t => '<button data-theme="' + t.id + '">' + t.name + '</button>').join('');
      const probe = el => { const o = { colorScheme: getComputedStyle(el).colorScheme }; for (const t of ['--text', '--text-2', '--surface', '--bg']) o[t] = getComputedStyle(el).getPropertyValue(t).trim(); return o; };
      const doc = probe(document.documentElement);
      const buttons = [...seg.querySelectorAll('button')].map(b => { const p = probe(b); return { theme: b.dataset.theme, ...p, sameAsDocument: Object.keys(doc).every(k => doc[k] === p[k]) }; });
      if (made) seg.innerHTML = '';
      return { rootTheme: document.documentElement.dataset.theme || '(none: today\'s hub.js deletes it for Hearth)', rootScheme: document.documentElement.dataset.scheme, document: doc, buttons, allSame: buttons.every(b => b.sameAsDocument) };
    });
    await d.close();
  }
  await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: 'system' } }).catch(() => {});
  // C / D / E: every document an adult, a kid and the kiosk open, measured twice: the proposal with app code as it is
  // ("unplanned") and with the PLANNED batch rows injected ("planned")
  const measure = ({ floor, rows, numerals }) => {
    const out = { textEls: 0, rounded: 0, notRounded: [], minFont: null, minEl: null, under: [], numerals: {} };
    for (const el of document.querySelectorAll('body *')) {
      if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
      if (r.bottom < 0 || r.top > innerHeight * 3) continue;
      const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
      const cls = e => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).join('.') : '');
      const label = (el.parentElement ? cls(el.parentElement) + ' > ' : '') + cls(el) + ' "' + txt.slice(0, 24) + '"';
      const px = parseFloat(cs.fontSize); out.textEls++;
      if (out.minFont == null || px < out.minFont) { out.minFont = px; out.minEl = label; }
      if (px < floor - 0.01) out.under.push({ label, px, row: rows.find(s => { try { return el.matches(s); } catch (e) { return false; } }) || null });
      const fam = cs.fontFamily.split(',')[0].trim().replace(/"/g, '');
      if (/ui-rounded/.test(fam)) out.rounded++; else if (out.notRounded.length < 8) out.notRounded.push(label + ' → ' + fam);
    }
    for (const sel of numerals) {
      const els = [...document.querySelectorAll(sel)].filter(e => e.getBoundingClientRect().width > 0 && e.textContent.trim());
      out.numerals[sel] = els.length ? els.slice(0, 3).map(e => getComputedStyle(e).fontFamily.split(',')[0].trim().replace(/"/g, '') + ' ' + getComputedStyle(e).fontSize + ' "' + e.textContent.trim().slice(0, 10) + '"') : 'NOT RENDERED';
    }
    out.under = out.under.slice(0, 40);
    return out;
  };
  const APPS = { eli: ['f260', 'prayer', 'leftovers', 'tally', 'timer', 'verses', 'kidverse'], ezra: ['kidverse', 'prayer', 'leftovers', 'tally', 'timer', 'verses'] };
  if (run('C') || run('D') || run('E')) for (const [who, device] of [['eli', 'iphone-pwa'], ['ezra', 'iphone-pwa'], ['ezra', 'ipad-portrait'], ['tv', 'tv']]) {
    for (const variant of ['unplanned', 'planned']) {
      const d = await dev({ device, profile: who }, true);
      const key = `${who}-${device}-${variant}`; const R = res.E[key] = {};
      const floor = who === 'ezra' ? 16 : 11;
      const doc = async (target, app) => {
        if (variant === 'planned') await inject(target, app);
        await target.waitForTimeout(300);
        return target.evaluate(measure, { floor, rows: KID_FLOOR[app] || [], numerals: NUMERALS[app] || [] });
      };
      await d.goto('#home'); await d.page.waitForTimeout(2200);
      if (who === 'eli') {   // a running kitchen timer, so the shell's timer pill (#timer-pill .tp-time) renders
        await d.page.evaluate(() => { try { hub.set('timer.active', { endAt: Date.now() + 600000, total: 600, startedAt: Date.now() }, { app: 'timer', scope: 'person' }); } catch (e) {} });
        await d.page.waitForTimeout(1500);
      }
      R.home = await doc(d.page, 'shell');
      R.home.kind = await d.page.evaluate(() => document.documentElement.dataset.kind);
      if (who === 'eli') await d.page.evaluate(() => { try { hub.remove('timer.active', { app: 'timer', scope: 'person' }); } catch (e) {} });
      for (const app of APPS[who] || []) {
        try { const f = await d.openApp(app); await f.waitForTimeout(1800); R[app] = await doc(f, app); }
        catch (e) { R[app] = { error: String(e.message).slice(0, 200) }; }
      }
      await d.close();
    }
  }
} finally {
  await L.close();
}
// F. the Dollywood pair: text as rendered (HTML, SVG x screen scale, pseudo-element text), unplanned then planned in the same state
const floorProbe = ({ floor, rows }) => {
  const vw = innerWidth, vh = innerHeight;
  const vis = r => r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
  const shown = el => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } return true; };
  const cls = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).join('.') : (e.className && e.className.baseVal ? '.' + e.className.baseVal.trim().split(/\s+/).join('.') : ''));
  // a text is on a row when the element that SETS its size (itself, or the nearest ancestor whose size differs from its parent's) matches it
  const sizeOwner = el => { let e = el; while (e.parentElement && getComputedStyle(e).fontSize === getComputedStyle(e.parentElement).fontSize) e = e.parentElement; return e; };
  const rowOf = (el, pseudo) => { const o = pseudo ? el : sizeOwner(el); return rows.find(sel => { try { return pseudo ? el.matches(sel.replace(/::(before|after)$/, '')) && new RegExp('::' + pseudo + '$').test(sel) : o.matches(sel); } catch (e) { return false; } }) || null; };
  const out = { textEls: 0, rounded: 0, notRounded: [], minEff: null, minEl: null, under: [] };
  const add = (el, eff, fam, kind, txt, pseudo) => {
    out.textEls++;
    const label = (el.parentElement ? cls(el.parentElement) + ' > ' : '') + cls(el) + (pseudo ? '::' + pseudo : '') + ' "' + txt.slice(0, 18) + '"';
    if (/ui-rounded/.test(fam)) out.rounded++; else if (out.notRounded.length < 6) out.notRounded.push(kind + ' ' + label + ' → ' + fam);
    if (out.minEff == null || eff < out.minEff) { out.minEff = +eff.toFixed(2); out.minEl = kind + ' ' + label; }
    if (eff < floor - 0.01 && out.under.length < 80) out.under.push({ kind, label, eff: +eff.toFixed(2), row: rowOf(el, pseudo) });
  };
  for (const el of document.querySelectorAll('body *')) {
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    const svgText = el instanceof SVGElement && /^(text|tspan|textPath)$/.test(el.tagName);
    if (own && (!(el instanceof SVGElement) || svgText)) {
      const r = el.getBoundingClientRect();
      if (vis(r) && shown(el)) {
        const cs = getComputedStyle(el); const fs = parseFloat(cs.fontSize); let eff = fs;
        if (svgText) { const m = (el.getScreenCTM && el.getScreenCTM()) || el.closest('text').getScreenCTM(); eff = m ? fs * Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) : fs; }
        else { let z = 1; for (let e = el; e; e = e.parentElement) z *= parseFloat(getComputedStyle(e).zoom || '1') || 1; eff = fs * z; }
        add(el, eff, cs.fontFamily.split(',')[0].trim().replace(/"/g, ''), svgText ? 'svg' : 'html', own);
      }
    }
    if (!(el instanceof SVGElement)) for (const which of ['before', 'after']) {
      const cs = getComputedStyle(el, '::' + which); const c = cs.content;
      if (!c || c === 'none' || c === 'normal' || cs.display === 'none') continue;
      const txt = /^attr\(/.test(c) ? (el.getAttribute(c.slice(5, -1)) || '') : c.replace(/^["']|["']$/g, '');
      if (!/[A-Za-z0-9]/.test(txt)) continue;
      const r = el.getBoundingClientRect(); if (!vis(r) || !shown(el)) continue;
      add(el, parseFloat(cs.fontSize), cs.fontFamily.split(',')[0].trim().replace(/"/g, ''), 'pseudo', txt, which);
    }
  }
  return out;
};
const injectDolly = ({ css, svg }) => {
  const st = document.createElement('style'); st.id = 'planned-rows'; st.textContent = css; document.head.appendChild(st);
  const floor = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs-floor')) || 11;
  for (const [sel, design] of svg) for (const t of document.querySelectorAll(sel)) {
    const m = (t.getScreenCTM && t.getScreenCTM()) || (t.closest('text') && t.closest('text').getScreenCTM()); if (!m) continue;
    const k = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)); if (k > 0) t.style.fontSize = (Math.max(floor, design) / k) + 'px';
  }
};
if (run('F')) {
  const ROWS = [...DOLLY_CSS.map(r => r[0]), ...DOLLY_SVG.map(r => r[0])];
  const KID_ROWS_F = [...ROWS, ...DOLLY_KID.flatMap(r => r.sel.split(', ')), '[data-flavor=live] .lv-hero small'];
  for (const [app, variant, whos] of [['dollywood', 'typical', [['eli', ['map', 'cross-section', 'steps']]]],
    ['dollywood-live', 'park', [['eli', ['map', 'whole-park', 'waits']], ['ezra', ['kid', 'whole-park', 'kid-family']], ['kiara', ['kid-viewonly', 'kid-nearby', 'ride-card-kid']]]]]) {
    const mod = await import(pathToFileURL(path.join(ROOT, 'audits/tools/areas', app + '.mjs')).href);
    const LL = await local({ variant, clock: 'demo', engine: 'webkit' });
    try {
      for (const [who, screens] of whos) for (const device of ['iphone-pwa', 'ipad-portrait']) for (const screen of screens) {
        const sc = mod.screens.find(x => x.screen === screen);
        const d = await LL.device({ device, mode: 'light', profile: who });
        await d.ctx.route('**/apps/design.css', r => r.fulfill({ status: 200, contentType: 'text/css', body: swapped }));
        const dev = DEVICES[device], page = d.page;
        const t = { page, ctx: d.ctx, state: 'typical', device, mode: 'light', variant, profile: who, dev, touch: dev.hasTouch, loading: false, offline: false, error: false, sleep,
          settle: async () => { await sleep(900); }, frame: () => page.frameLocator('#frame'), goto: h => d.goto(h),
          async openApp(id, { wait } = {}) { const f = await d.openApp(id, { wait }); await sleep(700); return f; },
          appFrame: id => page.frames().find(f => f.url().includes(`/apps/${id}.html`)),
          async tap(target, opts = {}) { const loc = typeof target === 'string' ? page.locator(target).first() : target; if (dev.hasTouch) await loc.tap(opts); else await loc.click(opts); },
          async tapIn(fl, sel, opts = {}) { const loc = sel ? fl.locator(sel).first() : fl; if (dev.hasTouch) await loc.tap(opts); else await loc.click(opts); },
          async scroll(selector = '#views', y = 'bottom', where = page) { await where.evaluate(([sel, y]) => { const el = document.querySelector(sel) || document.scrollingElement; el.scrollTop = y === 'bottom' ? el.scrollHeight : y; }, [selector, y]); await sleep(300); },
          async clockTo(when) { await d.ctx.clock.setFixedTime(new Date(when)); } };
        const key = `${who}-${device}/${app}:${screen}`; const R = res.F[key] = { kind: who === 'ezra' || who === 'kiara' ? 'kid' : 'adult' };
        try { await sc.go(t); await sleep(1000); } catch (e) { R.goError = String(e.message || e).split('\n')[0].slice(0, 200); }
        const f = t.appFrame(app);
        if (!f) { R.error = 'no app frame'; await d.close(); continue; }
        const args = { floor: R.kind === 'kid' ? 16 : 11, rows: app === 'dollywood-live' ? KID_ROWS_F : ROWS };
        try {
          R.unplanned = await f.evaluate(floorProbe, args);
          await f.evaluate(injectDolly, { css: PLANNED[app], svg: DOLLY_SVG }); await sleep(300);
          R.planned = await f.evaluate(floorProbe, args);
        } catch (e) { R.error = String(e.message).slice(0, 200); }
        await d.close();
      }
    } finally { await LL.close(); }
  }
}
const docsOf = pred => Object.entries(res.E).filter(([k]) => pred(k)).flatMap(([k, v]) => Object.entries(v).filter(([, m]) => m && !m.error && m.numerals).map(([app, m]) => [k + '/' + app, m]));
const planned = docsOf(k => k.endsWith('-planned')), unplanned = docsOf(k => k.endsWith('-unplanned'));
const numeralRows = docs => docs.flatMap(([d, m]) => Object.entries(m.numerals).map(([sel, v]) => ({ doc: d, sel, v })));
res.summary = {
  // per width: does the default proposal fit, and does it fit exactly where today fits (grid bottom within 10 px of today)?
  tvDefault: res.A['1920x1080-today'] ? ['1920x1080', '1024x768'].map(w => { const t = res.A[w + '-today'], p = res.A[w + '-proposed']; return { viewport: w, todayFits: t.fits, proposedFits: p.fits, todayBottom: t.tvRect && t.tvRect.bottom, proposedBottom: p.tvRect && p.tvRect.bottom, noRegression: p.fits || !t.fits }; }) : 'skipped',
  tv10ftOptIn: Object.entries(res.A).filter(([k]) => /opt-in/.test(k)).map(([k, v]) => [k, v.fits, v.tvRect && v.tvRect.bottom]),
  f260ButtonsKeepDocumentPalette: Object.keys(res.B).length ? Object.values(res.B).every(b => b.allSame) : 'skipped',
  // C: kid mode is rounded on Home and every kid-visible app (Prayer and the Larder counts included) once the planned rows land
  C_kidRoundedShare: Object.fromEntries(docsOf(k => k.startsWith('ezra')).map(([d, m]) => [d, m.textEls ? +(m.rounded / m.textEls).toFixed(2) : null])),
  C_kidRoundedEverywherePlanned: planned.filter(([d]) => d.startsWith('ezra')).every(([, m]) => m.rounded === m.textEls),
  C_kidNotRoundedPlanned: planned.filter(([d]) => d.startsWith('ezra')).flatMap(([d, m]) => m.notRounded.map(x => d + ': ' + x)),
  // D: big numerals in ui-rounded for the adult, the kid and the kiosk, with the batch-1a --font-numeral move
  D_staticEveryTabularNumsRuleOnTheMoveList: res.D.static ? res.D.static.missingFromMoveList.length === 0 : null,
  D_numeralsRoundedPlanned: numeralRows(planned).every(r => r.v === 'NOT RENDERED' || r.v.every(x => /^ui-rounded /.test(x))),
  D_numeralsRendered: [...new Set(numeralRows(planned).filter(r => r.v !== 'NOT RENDERED').map(r => r.sel))],
  D_numeralsNeverRendered: Object.values(NUMERALS).flat().filter(s => !numeralRows(planned).some(r => r.sel === s && r.v !== 'NOT RENDERED')),
  D_unplannedNotRounded: numeralRows(unplanned).filter(r => r.v !== 'NOT RENDERED' && r.v.some(x => !/^ui-rounded /.test(x))).map(r => `${r.doc} ${r.sel}: ${r.v[0]}`),
  // E: never below 11 px for adults and the kiosk (planned rows applied); every kid text under 16 px is on a named kid-floor row
  E_adultAndKioskNoTextUnder11Planned: planned.filter(([d]) => !d.startsWith('ezra')).every(([, m]) => m.under.length === 0),
  E_adultUnder11Planned: planned.filter(([d]) => !d.startsWith('ezra')).flatMap(([d, m]) => m.under.map(u => `${d}: ${u.label} ${u.px}`)),
  E_adultUnder11Unplanned: unplanned.filter(([d]) => !d.startsWith('ezra')).flatMap(([d, m]) => m.under.map(u => `${d}: ${u.label} ${u.px}`)),
  E_kidFloor16Planned: planned.filter(([d]) => d.startsWith('ezra')).every(([, m]) => m.under.length === 0),
  E_kidUnder16Planned: planned.filter(([d]) => d.startsWith('ezra')).flatMap(([d, m]) => m.under.map(u => `${d}: ${u.label} ${u.px}`)),
  E_kidUnder16UnplannedAllOnNamedRows: unplanned.filter(([d]) => d.startsWith('ezra')).every(([, m]) => m.under.every(u => u.row)),
  E_kidUnder16Unplanned: [...new Set(unplanned.filter(([d]) => d.startsWith('ezra')).flatMap(([d, m]) => m.under.map(u => `${d.split('/')[1]}: ${u.label.replace(/"[^"]*"$/, '')} ${u.px} → ${u.row || 'NO NAMED ROW'}`)))],
  E_minFont: Object.fromEntries(docsOf(() => true).map(([d, m]) => [d, m.minFont])),
  // F: the Dollywood pair, text as rendered (HTML, SVG x screen scale, ::before/::after)
  F_measured: Object.keys(res.F).length ? Object.fromEntries(Object.entries(res.F).map(([k, v]) => [k, v.error ? 'ERROR ' + v.error : `min ${v.unplanned.minEff} → planned ${v.planned.minEff} (${v.planned.textEls} texts; rounded ${v.planned.rounded}/${v.planned.textEls})${v.goError ? ' goError: ' + v.goError : ''}`])) : 'skipped',
  F_adultNoTextUnder11Planned: Object.keys(res.F).length ? Object.values(res.F).filter(v => v.kind === 'adult').every(v => !v.error && v.planned.under.length === 0) : null,
  F_kidNoTextUnder16Planned: Object.keys(res.F).length ? Object.values(res.F).filter(v => v.kind === 'kid').every(v => !v.error && v.planned.under.length === 0) : null,
  F_kidRoundedPlanned: Object.keys(res.F).length ? Object.values(res.F).filter(v => v.kind === 'kid').every(v => !v.error && v.planned.rounded === v.planned.textEls) : null,
  F_underUnplannedAllOnNamedRows: Object.keys(res.F).length ? Object.values(res.F).every(v => !v.error && v.unplanned.under.every(u => u.row)) : null,
  F_underUnplanned: [...new Set(Object.entries(res.F).flatMap(([k, v]) => v.unplanned ? v.unplanned.under.map(u => `${k.split('/')[1]} [${v.kind}] ${u.kind} ${u.label.replace(/"[^"]*"$/, '')} ${u.eff} → ${u.row || 'NO NAMED ROW'}`) : []))],
  F_kidNotRoundedPlanned: Object.entries(res.F).filter(([, v]) => v.kind === 'kid' && v.planned).flatMap(([k, v]) => v.planned.notRounded.map(x => k + ': ' + x)),
  F_underPlanned: [...new Set(Object.entries(res.F).flatMap(([k, v]) => v.planned ? v.planned.under.map(u => `${k} ${u.kind} ${u.label} ${u.eff}`) : []))],
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(ONLY.length ? path.join(process.env.TEMP || '.', 'rev2-runtime.partial.json') : OUT, JSON.stringify(res, null, 2));   // a partial run (--only=) never overwrites the evidence
console.log(JSON.stringify(res.summary, null, 1));
// exit 1 when any verdict fails (the TV default must not regress; F260's buttons keep the palette; C / D / E hold with the planned rows)
{
  const s = res.summary;
  const bad = [
    Array.isArray(s.tvDefault) && !s.tvDefault.every(t => t.noRegression) && 'tvDefault',
    s.f260ButtonsKeepDocumentPalette === false && 'f260ButtonsKeepDocumentPalette',
    ...['C_kidRoundedEverywherePlanned', 'D_staticEveryTabularNumsRuleOnTheMoveList', 'D_numeralsRoundedPlanned', 'E_adultAndKioskNoTextUnder11Planned', 'E_kidFloor16Planned', 'E_kidUnder16UnplannedAllOnNamedRows',
      'F_adultNoTextUnder11Planned', 'F_kidNoTextUnder16Planned', 'F_kidRoundedPlanned', 'F_underUnplannedAllOnNamedRows'].filter(k => s[k] === false),
  ].filter(Boolean);
  if (bad.length) { console.log('FAIL', bad.join(', ')); process.exitCode = 1; } else console.log('OK: every verdict holds');
}
