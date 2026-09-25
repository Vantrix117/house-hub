#!/usr/bin/env node
// Phase 4 · token proposal · independent constraints verifier, round 3. Local rig only (WebKit), app code unchanged:
// apps/design.css lines 14-289 are swapped for proposed-tokens.css through a route (as rev2-runtime.mjs does).
//   A. the display profile: the TV board at 1920x1080, variants typical + overflow, light + dark OS; today vs proposed.
//      Fit (grid bottom, reminders, clipped text, horizontal scroll) and a per-element rect diff inside .tv.
//   B. kid mode renders (ezra): Home + the kid-visible apps at iphone-pwa and ipad-portrait; horizontal scroll, the smallest
//      visible text, the share of visible text in ui-rounded; today vs proposed; screenshots of the proposed Home.
//   C. adults never below 11 px: the smallest visible text on Home and each app at iphone-pwa, today vs proposed.
// Usage: node audits/tools/phase4/tokens/verify-constraints-3.mjs → audits/evidence/p4/tokens/verify-constraints-3.json
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT } from '../../lib/local.mjs';

const EV = path.join(ROOT, 'audits/evidence/p4/tokens');
const OUT = path.join(EV, 'verify-constraints-3.json');
const lines = fs.readFileSync(path.join(ROOT, 'apps/design.css'), 'utf8').split('\n');
if (!/^:root \{/.test(lines[13]) || !/^\}/.test(lines[288])) throw new Error('design.css token section moved');
const swapped = [...lines.slice(0, 13), fs.readFileSync(path.join(ROOT, 'audits/tools/phase4/tokens/proposed-tokens.css'), 'utf8'), ...lines.slice(289)].join('\n');

const res = { generated: new Date().toISOString(), A: {}, B: {}, C: {} };

const measureText = () => {
  const out = { scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth, minFont: null, minFontEl: null, below11: [], textEls: 0, rounded: 0, notRounded: [] };
  for (const el of document.querySelectorAll('body *')) {
    if ([...el.childNodes].every(n => n.nodeType !== 3 || !n.textContent.trim())) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    if (r.bottom < 0 || r.top > innerHeight * 3) continue;
    const fs = parseFloat(cs.fontSize); out.textEls++;
    const label = (el.className && typeof el.className === 'string' ? el.tagName.toLowerCase() + '.' + el.className.split(' ')[0] : el.tagName.toLowerCase()) + ' "' + el.textContent.trim().slice(0, 24) + '"';
    if (out.minFont == null || fs < out.minFont) { out.minFont = fs; out.minFontEl = label; }
    if (fs < 11) out.below11.push(label + ' ' + fs);
    const fam = cs.fontFamily.split(',')[0].trim().replace(/"/g, '');
    if (/ui-rounded/.test(fam)) out.rounded++; else if (out.notRounded.length < 8) out.notRounded.push(label + ' → ' + fam);
  }
  out.below11 = out.below11.slice(0, 10);
  return out;
};

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const dev = async (opts, proposed) => {
    const d = await L.device(opts);
    if (proposed) await d.ctx.route('**/apps/design.css', r => r.fulfill({ status: 200, contentType: 'text/css', body: swapped }));
    return d;
  };
  // A. the TV board
  for (const variant of ['typical', 'overflow']) {
    await L.reset(variant);
    for (const mode of ['light', 'dark']) {
      const rects = {};
      for (const which of ['today', 'proposed']) {
        const d = await dev({ device: 'tv', profile: 'tv', mode }, which === 'proposed');
        await d.goto('#home');
        await d.page.waitForTimeout(2500);
        const m = await d.page.evaluate(() => {
          const de = document.documentElement, tv = document.querySelector('.tv');
          const r = tv && tv.getBoundingClientRect();
          const clipped = [];
          for (const el of document.querySelectorAll('.tv *')) {
            if (!el.childElementCount && el.textContent.trim() && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible' && !/ellipsis/.test(getComputedStyle(el).textOverflow)) clipped.push(String(el.className) + ': ' + el.textContent.trim().slice(0, 30));
          }
          const past = []; if (tv) for (const el of tv.querySelectorAll('*')) { const b = el.getBoundingClientRect(); if (b.width && b.height && (b.right > innerWidth + 1 || b.bottom > innerHeight + 1)) past.push(String(el.className || el.tagName).slice(0, 40) + ' ' + Math.round(b.bottom)); }
          const rem = document.querySelector('.tv-rem'), rb = rem && rem.getBoundingClientRect();
          const all = tv ? [...tv.querySelectorAll('*')].map(el => { const b = el.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height), parseFloat(getComputedStyle(el).fontSize)]; }) : [];
          let minFont = null; if (tv) for (const el of tv.querySelectorAll('*')) { if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue; const b = el.getBoundingClientRect(); if (!b.width) continue; const f = parseFloat(getComputedStyle(el).fontSize); if (minFont == null || f < minFont) minFont = f; }
          return { theme: de.dataset.theme || null, scheme: de.dataset.scheme, tv: r && { h: Math.round(r.height), bottom: Math.round(r.bottom) }, reminders: rb && rb.height ? { bottom: Math.round(rb.bottom), visible: rb.bottom <= innerHeight + 1 } : 'none shown',
            scrollW: de.scrollWidth, clientW: de.clientWidth, scrollH: de.scrollHeight, clipped: clipped.slice(0, 8), pastViewport: past.slice(0, 8), minFont, all };
        });
        m.fits = !!m.tv && m.tv.bottom <= 1081 && !m.pastViewport.length && !m.clipped.length && m.scrollW <= m.clientW;
        rects[which] = m.all; delete m.all;
        res.A[`${variant}-${mode}-${which}`] = m;
        if (which === 'proposed' && variant === 'overflow') await d.shot(path.join(EV, `verify-constraints-3-tv-overflow-${mode}-proposed.png`));
        await d.close();
      }
      const t = rects.today, p = rects.proposed;
      let moved = 0, fontChanged = 0;
      for (let i = 0; i < Math.min(t.length, p.length); i++) { if (t[i].slice(0, 4).some((v, j) => Math.abs(v - p[i][j]) > 1)) moved++; if (t[i][4] !== p[i][4]) fontChanged++; }
      res.A[`${variant}-${mode}-diff`] = { elementsToday: t.length, elementsProposed: p.length, rectsMovedOver1px: moved, fontSizeChanged: fontChanged };
    }
  }
  await L.reset('typical');
  // B. kid mode, C. adult floor
  const APPS_KID = ['kidverse', 'prayer', 'leftovers', 'tally', 'timer', 'verses'];
  const APPS_ADULT = ['f260', 'prayer', 'leftovers', 'tally', 'timer', 'verses', 'kidverse'];
  for (const [section, profile, apps, devices] of [['B', 'ezra', APPS_KID, ['iphone-pwa', 'ipad-portrait']], ['C', 'eli', APPS_ADULT, ['iphone-pwa']]]) {
    for (const device of devices) {
      for (const which of ['today', 'proposed']) {
        const d = await dev({ device, profile }, which === 'proposed');
        const key = `${device}-${which}`; res[section][key] = {};
        await d.goto('#home'); await d.page.waitForTimeout(2000);
        const home = await d.page.evaluate(measureText);
        home.kind = await d.page.evaluate(() => document.documentElement.dataset.kind);
        home.tiles = await d.page.evaluate(() => [...document.querySelectorAll('.tile')].filter(t => t.getBoundingClientRect().width > 0).length);
        res[section][key].home = home;
        if (section === 'B' && which === 'proposed') await d.shot(path.join(EV, `verify-constraints-3-kid-home-${device}-proposed.png`));
        for (const app of apps) {
          try {
            const f = await d.openApp(app); await f.waitForTimeout(1800);
            res[section][key][app] = await f.evaluate(measureText);
            if (section === 'B' && which === 'proposed' && device === 'iphone-pwa' && app === 'kidverse') await d.shot(path.join(EV, `verify-constraints-3-kid-kidverse-${device}-proposed.png`));
          } catch (e) { res[section][key][app] = { error: String(e.message).slice(0, 200) }; }
        }
        res[section][key].pageErrors = d.logs.filter(l => /pageerror/.test(l)).slice(0, 5);
        await d.close();
      }
    }
  }
} finally {
  await L.close();
}
// summaries
const sum = { tv: {}, kid: {}, adult: {} };
for (const k of Object.keys(res.A)) if (!k.endsWith('-diff')) sum.tv[k] = { fits: res.A[k].fits, bottom: res.A[k].tv && res.A[k].tv.bottom, reminders: res.A[k].reminders, minFont: res.A[k].minFont };
for (const k of Object.keys(res.A)) if (k.endsWith('-diff')) sum.tv[k] = res.A[k];
for (const [sec, dst] of [['B', sum.kid], ['C', sum.adult]]) for (const [k, v] of Object.entries(res[sec])) {
  dst[k] = Object.fromEntries(Object.entries(v).filter(([a]) => a !== 'pageErrors').map(([a, m]) => [a, m.error ? m.error : { hScroll: m.scrollW > m.clientW, minFont: m.minFont, minEl: m.minFontEl, below11: m.below11.length, roundedShare: m.textEls ? +(m.rounded / m.textEls).toFixed(2) : null, tiles: m.tiles }]));
  dst[k].pageErrors = v.pageErrors;
}
res.summary = sum;
fs.writeFileSync(OUT, JSON.stringify(res, null, 2));
console.log(JSON.stringify(sum, null, 1));
