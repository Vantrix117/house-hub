#!/usr/bin/env node
// Phase 4 · token proposal · CONSTRAINTS verifier, round 4 (independent; does not import rev2-runtime.mjs or contrast.mjs).
// On the local rig (WebKit), apps/design.css lines 14-289 are swapped for proposed-tokens.css through a route; app code unchanged.
//   A. the display profile (tv): 1920x1080 and 1024x768, light and dark, today vs proposed, plus the proposal with the 7:1 and
//      preference attributes set (data-contrast=more, data-transparency=reduce, data-text-size=xxl, data-motion=reduce), which must
//      not move the layout. Measures: .tv grid bottom, horizontal scroll (test-tv.mjs), clipped leaf text, min font, page errors.
//   B. kid mode (ezra) on iphone-pwa and ipad-portrait: Home and every kid-visible app (apps.json visibleTo incl. ezra or unset),
//      the park map included; today vs proposed, app code as it is. Measures: horizontal scroll, rendered text count, share in
//      ui-rounded, min font, page errors, and the kid tokens as resolved.
// Output: audits/evidence/p4/tokens/verify-constraints-4.json (+ two screenshots).
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p4/tokens/verify-constraints-4.json');
const lines = fs.readFileSync(path.join(ROOT, 'apps/design.css'), 'utf8').split('\n');
if (!/^:root \{/.test(lines[13]) || !/^\}/.test(lines[288])) throw new Error('design.css token section moved');
const swapped = [...lines.slice(0, 13), fs.readFileSync(path.join(ROOT, 'audits/tools/phase4/tokens/proposed-tokens.css'), 'utf8'), ...lines.slice(289)].join('\n');
const apps = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8'));
const KID_APPS = (apps.apps || apps).filter(a => !a.visibleTo || a.visibleTo.includes('ezra')).map(a => a.id);
const res = { generated: new Date().toISOString(), kidApps: KID_APPS, A: {}, B: {}, errors: [] };

const tvMeasure = () => {
  const de = document.documentElement, tv = document.querySelector('.tv');
  const r = tv && tv.getBoundingClientRect();
  const clipped = [], fonts = [];
  for (const el of document.querySelectorAll('.tv *')) {
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const b = el.getBoundingClientRect();
    if (own && b.width && b.height) fonts.push(parseFloat(getComputedStyle(el).fontSize));
    const cs = getComputedStyle(el);
    if (!el.childElementCount && el.textContent.trim() && el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible' && !/ellipsis/.test(cs.textOverflow)) clipped.push(String(el.className || el.tagName));
  }
  const rem = document.querySelector('.tv-rem'), rb = rem && rem.getBoundingClientRect();
  const past = tv ? [...tv.children].filter(c => { const b = c.getBoundingClientRect(); return b.width && (b.bottom > innerHeight + 1 || b.right > innerWidth + 1); }).map(c => String(c.className)) : [];
  return { kind: de.dataset.kind, scheme: de.dataset.scheme, tvBottom: r ? Math.round(r.bottom) : null, tvH: r ? Math.round(r.height) : null,
    scrollW: de.scrollWidth, clientW: de.clientWidth, remBottom: rb && rb.height ? Math.round(rb.bottom) : null, past, clipped,
    minFont: fonts.length ? Math.min(...fonts) : null, textEls: fonts.length, tsUser: getComputedStyle(de).getPropertyValue('--ts-user').trim() };
};
const docMeasure = () => {
  const de = document.documentElement; const o = { textEls: 0, rounded: 0, minFont: null, notRounded: [], scrollW: de.scrollWidth, clientW: de.clientWidth };
  for (const el of document.querySelectorAll('body *')) {
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const b = el.getBoundingClientRect(); if (!b.width || !b.height) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    o.textEls++; const px = parseFloat(cs.fontSize); if (o.minFont == null || px < o.minFont) o.minFont = px;
    const fam = cs.fontFamily.split(',')[0].trim().replace(/"/g, '');
    if (/ui-rounded/.test(fam)) o.rounded++; else if (o.notRounded.length < 6) o.notRounded.push(el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 20) + ' "' + el.textContent.trim().slice(0, 18) + '" → ' + fam);
  }
  const cs = getComputedStyle(de);
  o.tokens = { fontUi: cs.getPropertyValue('--font-ui').trim().split(',')[0], fontDisplay: cs.getPropertyValue('--font-display').trim().split(',')[0], fontSerif: cs.getPropertyValue('--font-serif').trim().split(',')[0], fsFloor: cs.getPropertyValue('--fs-floor').trim(), tap: cs.getPropertyValue('--tap').trim() };
  return o;
};

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const dev = async (opts, proposed) => {
    const d = await L.device(opts);
    if (proposed) await d.ctx.route('**/apps/design.css', r => r.fulfill({ status: 200, contentType: 'text/css', body: swapped }));
    return d;
  };
  // A. the TV board
  for (const [w, h] of [[1920, 1080], [1024, 768]]) for (const mode of ['light', 'dark']) for (const v of ['today', 'proposed', 'proposed-prefs']) {
    const d = await dev({ device: 'tv', profile: 'tv', mode }, v !== 'today');
    await d.page.setViewportSize({ width: w, height: h });
    await d.goto('#home');
    if (v === 'proposed-prefs') await d.page.evaluate(() => { const de = document.documentElement; de.setAttribute('data-contrast', 'more'); de.setAttribute('data-transparency', 'reduce'); de.setAttribute('data-text-size', 'xxl'); de.setAttribute('data-motion', 'reduce'); });
    await d.page.waitForTimeout(2500);
    const m = await d.page.evaluate(tvMeasure);
    m.pageErrors = d.logs.filter(l => /pageerror/.test(l));
    m.hScroll = m.scrollW > m.clientW;
    res.A[`${w}x${h}-${mode}-${v}`] = m;
    if (w === 1920 && mode === 'dark' && v === 'proposed') await d.page.screenshot({ path: path.join(ROOT, 'audits/evidence/p4/tokens/verify-constraints-4-tv-dark-proposed.png') });
    await d.close();
  }
  // B. kid mode
  for (const device of ['iphone-pwa', 'ipad-portrait']) for (const v of ['today', 'proposed']) {
    const d = await dev({ device, profile: 'ezra' }, v === 'proposed');
    const R = res.B[`${device}-${v}`] = {};
    await d.goto('#home'); await d.page.waitForTimeout(2200);
    R.home = await d.page.evaluate(docMeasure); R.home.kind = await d.page.evaluate(() => document.documentElement.dataset.kind);
    if (device === 'iphone-pwa' && v === 'proposed') await d.page.screenshot({ path: path.join(ROOT, 'audits/evidence/p4/tokens/verify-constraints-4-kid-home-proposed.png') });
    for (const app of KID_APPS) {
      try { const f = await d.openApp(app); await f.waitForTimeout(2000); R[app] = await f.evaluate(docMeasure); }
      catch (e) { R[app] = { error: String(e.message).slice(0, 200) }; }
    }
    R.pageErrors = d.logs.filter(l => /pageerror/.test(l));
    await d.close();
  }
} catch (e) { res.errors.push(String(e.stack || e).slice(0, 600)); }
finally { await L.close(); }

const A = res.A, B = res.B;
res.summary = {
  tv: Object.fromEntries(Object.entries(A).map(([k, m]) => [k, `bottom ${m.tvBottom} (h ${m.tvH}) hScroll ${m.hScroll} rem ${m.remBottom} past [${m.past}] clipped ${m.clipped.length} minFont ${m.minFont} tsUser ${m.tsUser} errors ${m.pageErrors.length}`])),
  tvPrefsMoveLayout: ['1920x1080', '1024x768'].flatMap(w => ['light', 'dark'].map(mo => [w + '-' + mo, A[`${w}-${mo}-proposed`] && A[`${w}-${mo}-proposed-prefs`] ? A[`${w}-${mo}-proposed`].tvBottom !== A[`${w}-${mo}-proposed-prefs`].tvBottom : null])),
  kid: Object.fromEntries(Object.entries(B).map(([k, R]) => [k, Object.fromEntries(Object.entries(R).filter(([a]) => a !== 'pageErrors').map(([a, m]) => [a, m.error ? 'ERROR ' + m.error : `rounded ${m.rounded}/${m.textEls} min ${m.minFont} hScroll ${m.scrollW > m.clientW}`]))])),
  kidPageErrors: Object.fromEntries(Object.entries(B).map(([k, R]) => [k, R.pageErrors])),
};
fs.writeFileSync(OUT, JSON.stringify(res, null, 2));
console.log(JSON.stringify(res.summary, null, 1));
