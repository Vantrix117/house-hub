#!/usr/bin/env node
// Phase 4 · token proposal · CONSTRAINTS verifier, round 5 (independent; imports neither rev2-runtime.mjs nor contrast.mjs).
// On the local rig (WebKit), apps/design.css lines 14-289 are swapped for proposed-tokens.css through a route; app code unchanged.
//   A. the display profile (tv) at 1920x1080, every stored theme choice (system on a light and a dark OS, and each of the six
//      palette ids, graphite included), today vs proposed. Measures: .tv grid bottom, Reminders pane inside the viewport,
//      horizontal scroll, clipped leaf text, min font, VISIBLE live backdrop-filter anywhere on the page (also with
//      data-transparency=reduce), page errors, resolved theme/kind.
//   B. kid mode: ezra (iphone-pwa, ipad-landscape) and kiara (iphone-pwa): Home and every kid-visible app, today vs proposed,
//      app code as it is. Measures: horizontal scroll, text count, share in ui-rounded, min font, count under 11 px, page errors,
//      the kid tokens as resolved (--fs-floor, --tap, --font-ui).
// Output: audits/evidence/p4/tokens/verify-constraints-5.json (+ two screenshots).
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p4/tokens/verify-constraints-5.json');
const lines = fs.readFileSync(path.join(ROOT, 'apps/design.css'), 'utf8').split('\n');
if (!/^:root \{/.test(lines[13]) || !/^\}/.test(lines[288])) throw new Error('design.css token section moved');
const swapped = [...lines.slice(0, 13), fs.readFileSync(path.join(ROOT, 'audits/tools/phase4/tokens/proposed-tokens.css'), 'utf8'), ...lines.slice(289)].join('\n');
const appsJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8'));
const list = appsJ.apps || appsJ;
const kidApps = kid => list.filter(a => !a.visibleTo || a.visibleTo.includes(kid)).map(a => a.id);
const res = { generated: new Date().toISOString(), A: {}, B: {}, errors: [] };

const tvMeasure = () => {
  const de = document.documentElement, tv = document.querySelector('.tv');
  const r = tv && tv.getBoundingClientRect();
  const clipped = [], fonts = []; let liveBlur = 0; const blurEls = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!el.closest('.tv') && !(getComputedStyle(el).backdropFilter || getComputedStyle(el).webkitBackdropFilter || 'none').match(/blur/)) continue;
    const inTv = !!el.closest('.tv');
    const cs = getComputedStyle(el);
    const bf = cs.backdropFilter || cs.webkitBackdropFilter;
    if (bf && bf !== 'none') { const bb = el.getBoundingClientRect(); const vis = bb.width > 0 && bb.height > 0 && cs.visibility !== 'hidden' && bb.bottom > 0 && bb.top < innerHeight; if (vis) { liveBlur++; blurEls.push(String(el.className || el.tagName).slice(0, 40) + ' ' + bf); } }
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const b = el.getBoundingClientRect();
    if (inTv && own && b.width && b.height && cs.visibility !== 'hidden') fonts.push(parseFloat(cs.fontSize));
    if (inTv && !el.childElementCount && el.textContent.trim() && el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible' && !/ellipsis/.test(cs.textOverflow)) clipped.push(String(el.className || el.tagName));
  }
  const rem = document.querySelector('.tv-rem'), rb = rem && rem.getBoundingClientRect();
  const panes = tv ? [...tv.children].map(c => { const b = c.getBoundingClientRect(); return { c: String(c.className).slice(0, 40), top: Math.round(b.top), bottom: Math.round(b.bottom), right: Math.round(b.right) }; }) : [];
  return { theme: de.getAttribute('data-theme'), scheme: de.getAttribute('data-scheme'), kind: de.getAttribute('data-kind'),
    tvBottom: r ? Math.round(r.bottom) : null, tvH: r ? Math.round(r.height) : null, innerH: innerHeight,
    scrollW: de.scrollWidth, clientW: de.clientWidth, scrollH: de.scrollHeight,
    rem: rb && rb.height ? { top: Math.round(rb.top), bottom: Math.round(rb.bottom) } : null,
    pastViewport: panes.filter(p => p.bottom > innerHeight + 1 || p.right > innerWidth + 1).map(p => p.c),
    panes, clipped, liveBlur, blurEls, minFont: fonts.length ? Math.min(...fonts) : null, textEls: fonts.length,
    bg: getComputedStyle(document.body).backgroundColor };
};
const docMeasure = () => {
  const de = document.documentElement; const o = { textEls: 0, rounded: 0, minFont: null, under11: [], under16: 0, notRounded: [], scrollW: de.scrollWidth, clientW: de.clientWidth };
  for (const el of document.querySelectorAll('body *')) {
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const b = el.getBoundingClientRect(); if (!b.width || !b.height) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    o.textEls++; const px = parseFloat(cs.fontSize); if (o.minFont == null || px < o.minFont) o.minFont = px;
    if (px < 11 && o.under11.length < 8) o.under11.push(el.tagName.toLowerCase() + ' "' + el.textContent.trim().slice(0, 16) + '" ' + px);
    if (px < 16) o.under16++;
    const fam = cs.fontFamily.split(',')[0].trim().replace(/"/g, '');
    if (/ui-rounded/.test(fam)) o.rounded++; else if (o.notRounded.length < 6) o.notRounded.push(el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 20) + ' "' + el.textContent.trim().slice(0, 18) + '" → ' + fam);
  }
  const cs = getComputedStyle(de);
  o.kind = de.getAttribute('data-kind');
  o.tokens = { fontUi: cs.getPropertyValue('--font-ui').trim().split(',')[0], fontNumeral: cs.getPropertyValue('--font-numeral').trim().split(',')[0], fsFloor: cs.getPropertyValue('--fs-floor').trim(), tap: cs.getPropertyValue('--tap').trim(), tapLg: cs.getPropertyValue('--tap-lg').trim() };
  return o;
};

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const dev = async (opts, proposed) => {
    const d = await L.device(opts);
    if (proposed) await d.ctx.route('**/apps/design.css', r => r.fulfill({ status: 200, contentType: 'text/css', body: swapped }));
    return d;
  };
  // A. the TV board at 1920x1080, every theme choice
  const choices = [['system', 'light'], ['system', 'dark'], ['hearth', 'dark'], ['parchment', 'light'], ['frost', 'light'], ['midnight', 'light'], ['forest', 'light'], ['graphite', 'dark']];
  for (const [theme, mode] of choices) for (const v of ['today', 'proposed', 'proposed-reduce-transparency']) {
    const d = await dev({ device: 'tv', profile: 'tv', mode, localStorage: theme === 'system' ? null : { 'hub.theme': JSON.stringify(theme) } }, v !== 'today');
    await d.goto('#home');
    if (v === 'proposed-reduce-transparency') await d.page.evaluate(() => document.documentElement.setAttribute('data-transparency', 'reduce'));
    await d.page.waitForTimeout(2500);
    const m = await d.page.evaluate(tvMeasure);
    m.pageErrors = d.logs.filter(l => /pageerror/.test(l));
    m.hScroll = m.scrollW > m.clientW;
    m.fits = m.tvBottom != null && m.tvBottom <= m.innerH && !m.hScroll && m.pastViewport.length === 0 && m.clipped.length === 0;
    res.A[`${theme}-${mode}-${v}`] = m;
    if (v === 'proposed' && (theme === 'forest' || theme === 'system' && mode === 'light')) await d.page.screenshot({ path: path.join(ROOT, `audits/evidence/p4/tokens/verify-constraints-5-tv-${theme}-${mode}-proposed.png`) });
    await d.close();
  }
  // B. kid mode
  for (const [kid, device] of [['ezra', 'iphone-pwa'], ['ezra', 'ipad-landscape'], ['kiara', 'iphone-pwa']]) for (const v of ['today', 'proposed']) {
    const d = await dev({ device, profile: kid }, v === 'proposed');
    const R = res.B[`${kid}-${device}-${v}`] = {};
    await d.goto('#home'); await d.page.waitForTimeout(2000);
    R.home = await d.page.evaluate(docMeasure);
    for (const app of kidApps(kid)) {
      try { const f = await d.openApp(app); await f.waitForTimeout(1800); R[app] = await f.evaluate(docMeasure); }
      catch (e) { R[app] = { error: String(e.message).slice(0, 200) }; }
    }
    R.pageErrors = d.logs.filter(l => /pageerror/.test(l));
    await d.close();
  }
} catch (e) { res.errors.push(String(e.stack || e).slice(0, 800)); }
finally { await L.close(); }

const A = res.A, B = res.B;
res.summary = {
  tv: Object.fromEntries(Object.entries(A).map(([k, m]) => [k, `${m.theme}/${m.scheme}/${m.kind} bottom ${m.tvBottom} rem ${m.rem && m.rem.bottom} fits ${m.fits} hScroll ${m.hScroll} past [${m.pastViewport}] clipped ${m.clipped.length} blur ${m.liveBlur} [${m.blurEls}] minFont ${m.minFont} err ${m.pageErrors.length}`])),
  kid: Object.fromEntries(Object.entries(B).map(([k, R]) => [k, Object.fromEntries(Object.entries(R).filter(([a]) => a !== 'pageErrors').map(([a, m]) => [a, m.error ? 'ERROR ' + m.error : `rounded ${m.rounded}/${m.textEls} min ${m.minFont} <11 ${m.under11.length} <16 ${m.under16} hScroll ${m.scrollW > m.clientW} kind ${m.kind} floor ${m.tokens.fsFloor} tap ${m.tokens.tap}`]))])),
  kidPageErrors: Object.fromEntries(Object.entries(B).map(([k, R]) => [k, R.pageErrors])),
  errors: res.errors,
};
fs.writeFileSync(OUT, JSON.stringify(res, null, 2));
console.log(JSON.stringify(res.summary, null, 1));
