#!/usr/bin/env node
// Phase 4 ACCENT skeptic #2 — re-measure "raw-accent graphics fall below 3:1" independently.
// For each case: sign in, set the theme (server row + localStorage), open the screen, read the COMPUTED paint colour of
// the graphic (box-shadow ring / svg stroke / fill / color), then hide that graphic and take the median of the pixels under
// its box (the backdrop it sits on, glass included as WebKit paints it). Ratio = WCAG contrast paint vs backdrop.
// Also records --tint, --accent and --gold at that point, to tell the person colour from a theme token.
//   node audits/tools/phase4/ACCENT/verify-raw-accent-graphics-light-and-apps-2.mjs [--no-park | --park-only]
// -> audits/evidence/p4/ACCENT/verify-raw-accent-graphics-light-and-apps-2[-main|-park].json (+ a few 1x PNG crops)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO, ROOT } from '../../lib/local.mjs';
import { decodePng } from './png.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p4/ACCENT');
const NAME = 'verify-raw-accent-graphics-light-and-apps-2';
const argv = process.argv.slice(2);
const lum = ([r, g, b]) => { const c = [r, g, b].map(v => v / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
const parseRgb = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; return m[1].split(/[ ,/]+/).filter(Boolean).slice(0, 3).map(Number); };
const THEMES = { parchment: ['parchment', 'light'], frost: ['frost', 'light'], 'system-light': ['system', 'light'], 'system-dark': ['system', 'dark'] };

function median(img, box, pad) {
  const R = [], G = [], B = [];
  for (let y = Math.max(0, Math.floor(box.y - pad)); y < Math.min(img.h, Math.ceil(box.y + box.height + pad)); y++)
    for (let x = Math.max(0, Math.floor(box.x - pad)); x < Math.min(img.w, Math.ceil(box.x + box.width + pad)); x++) {
      const i = (y * img.w + x) * 4; R.push(img.px[i]); G.push(img.px[i + 1]); B.push(img.px[i + 2]);
    }
  const m = a => a.sort((p, q) => p - q)[a.length >> 1];
  return [m(R), m(G), m(B)];
}

async function measure(d, where, sel, prop, label, shot) {
  const loc = where.locator(sel).first();
  if (!(await loc.count().catch(() => 0))) return { label, sel, missing: true };
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  await sleep(300);
  const info = await loc.evaluate((el, prop) => {
    const cs = getComputedStyle(el);
    let paint = null;
    if (prop === 'ring') { const all = cs.boxShadow.match(/rgba?\([^)]+\)/g) || []; paint = all[1] || all[0] || null; }
    else paint = cs[prop];
    const root = getComputedStyle(document.documentElement);
    return { paint, tint: cs.getPropertyValue('--tint').trim(), accent: root.getPropertyValue('--accent').trim(), gold: root.getPropertyValue('--gold').trim(),
      dataTheme: document.documentElement.dataset.theme || null, scheme: document.documentElement.dataset.scheme || null };
  }, prop);
  const box = await loc.boundingBox();
  if (!box) return { label, sel, missing: true, why: 'no box', ...info };
  const pad = prop === 'ring' ? 5 : 0;
  await loc.evaluate(el => { el.dataset.vhide = el.style.visibility; el.style.visibility = 'hidden'; });
  await sleep(150);
  const under = decodePng(await d.page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' }));
  await loc.evaluate(el => { el.style.visibility = el.dataset.vhide || ''; });
  const bg = median(under, box, pad);
  const rgb = parseRgb(info.paint);
  const res = { label, sel, prop, ...info, box: { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) }, backdrop: bg, ratio: rgb ? cr(rgb, bg) : null };
  if (shot) {
    const clip = { x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 30), width: Math.min(box.width + 280, 600), height: Math.min(box.height + 60, 500) };
    await d.page.screenshot({ path: path.join(OUT, `${NAME}-${shot}.png`), clip, scale: 'css', animations: 'disabled' });
    res.shot = `audits/evidence/p4/ACCENT/${NAME}-${shot}.png`;
  }
  return res;
}

async function dev(L, theme, profile) {
  const [th, mode] = THEMES[theme];
  await L.apiAs(profile, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: th } });
  return L.device({ device: 'ipad-portrait', mode, profile, localStorage: { 'hub.theme': JSON.stringify(th) } });
}

const results = [];
async function main() {
  const doPark = !argv.includes('--no-park'), doMain = !argv.includes('--park-only');
  const L = await local({ variant: doMain ? 'typical' : 'park', clock: 'demo', engine: 'webkit' });
  try {
    if (doMain) {
      await L.reset('typical');
      for (const p of ['eli', 'dad', 'kiara', 'ezra'])
        await L.apiAs(p, '/api/data/timer/timer.active?scope=person', { method: 'PUT', body: { value: { endAt: DEMO + 380000, total: 600, startedAt: DEMO - 220000 } } });
      // 1. Kiara's avatar ring in the Kids chip on an adult's Home, light palettes
      for (const theme of ['parchment', 'frost', 'system-light']) {
        const d = await dev(L, theme, 'eli');
        await d.goto('#home'); await sleep(2500);
        results.push({ case: 'home kids-chip Kiara ring (eli)', theme, ...(await measure(d, d.page, '.kid-chip:has-text("Kiara") .avatar', 'ring', 'kid-chip avatar ring', theme === 'parchment' ? 'kidchip-parchment' : null)) });
        results.push({ case: 'home kids-chip Kiara name text (eli)', theme, ...(await measure(d, d.page, '.kid-chip:has-text("Kiara") > span:not(.avatar)', 'color', 'kid-chip name')) });
        await d.close();
      }
      // 2. Kiara's own timer pill ring; the pill's time text
      for (const theme of ['parchment', 'system-light']) {
        const d = await dev(L, theme, 'kiara');
        await d.goto('#home'); await sleep(2500);
        results.push({ case: 'timer pill ring (kiara)', theme, ...(await measure(d, d.page, '#timer-pill .tp-ring .ring .fg', 'stroke', 'timer-pill ring fg', theme === 'parchment' ? 'pill-kiara-parchment' : null)) });
        results.push({ case: 'timer pill time text (kiara)', theme, ...(await measure(d, d.page, '#timer-pill .tp-time', 'color', 'timer-pill time')) });
        await d.close();
      }
      // 3. Timer app ring in dark for Dad and Eli
      for (const p of ['dad', 'eli']) {
        const d = await dev(L, 'system-dark', p);
        const f = await d.openApp('timer'); await sleep(2500);
        const r = await measure(d, f, '.dial .ring .fg', 'stroke', 'timer dial ring fg', p === 'dad' ? 'timer-dad-dark' : null);
        r.dialText = await f.locator('.dial').first().innerText().catch(() => null);
        results.push({ case: `timer app ring (${p})`, theme: 'system-dark', ...r });
        await d.close();
      }
      // 4. Kid Verse earned day star: the person's colour or the theme's --gold? Kiara vs Ezra
      for (const p of ['kiara', 'ezra']) for (const theme of ['system-light', 'parchment']) {
        const d = await dev(L, theme, p);
        const f = await d.openApp('kidverse'); await sleep(3000);
        results.push({ case: `kidverse earned day star (${p})`, theme, ...(await measure(d, f, '.days span.on svg.icon.star', 'color', 'days star')) });
        await d.close();
      }
      // 5. Prayer avatar rings (Eli, dark)
      {
        const d = await dev(L, 'system-dark', 'eli');
        const f = await d.openApp('prayer'); await sleep(3000);
        for (const s of ['.kid .avatar', '.asker .avatar']) results.push({ case: 'prayer avatar ring (eli)', theme: 'system-dark', ...(await measure(d, f, s, 'ring', s)) });
        await d.close();
      }
    }
    if (doPark) {
      await L.reset('park');
      for (const [p, theme] of [['dad', 'system-dark'], ['eli', 'system-dark'], ['christian', 'system-dark'], ['kiara', 'system-light'], ['kiara', 'parchment']]) {
        const d = await dev(L, theme, p);
        const f = await d.openApp('dollywood-live');
        await f.waitForSelector('#lv-pill[data-state]', { timeout: 12000 }).catch(() => {});
        await sleep(1500);
        await f.locator('#loc-near').first().click().catch(() => {});
        await sleep(900);
        const r = await measure(d, f, '.lv-tabs button[aria-pressed=true] svg', 'stroke', 'selected sheet tab icon', p === 'dad' ? 'park-tab-dad-dark' : null);
        r.pressedText = await f.locator('.lv-tabs button[aria-pressed=true]').first().innerText().catch(() => null);
        r.labelColor = await f.locator('.lv-tabs button[aria-pressed=true]').first().evaluate(e => getComputedStyle(e).color).catch(() => null);
        r.unpressedStroke = await f.locator('.lv-tabs button[aria-pressed=false] svg').first().evaluate(e => getComputedStyle(e).stroke).catch(() => null);
        results.push({ case: `park selected tab icon (${p})`, theme, ...r });
        await d.close();
      }
    }
  } finally { await L.close(); }
  const file = path.join(OUT, `${NAME}${doMain && doPark ? '' : doPark ? '-park' : '-main'}.json`);
  fs.writeFileSync(file, JSON.stringify({ note: 'paint = computed colour of the graphic; backdrop = median of the pixels under its box with the graphic hidden (WebKit, ipad-portrait, 1x); ratio = WCAG contrast', results }, null, 1));
  for (const r of results) console.log(r.case.padEnd(40), String(r.theme).padEnd(13), r.missing ? 'MISSING ' + r.sel + ' ' + (r.why || '') : `${r.paint} on ${JSON.stringify(r.backdrop)} = ${r.ratio}  tint=${r.tint} accent=${r.accent} gold=${r.gold} ${r.dataTheme}/${r.scheme}${r.pressedText ? ' tab=' + JSON.stringify(r.pressedText) + ' label=' + r.labelColor + ' off=' + r.unpressedStroke : ''}${r.dialText ? ' dial=' + JSON.stringify(r.dialText) : ''}`);
  console.log('->', path.relative(ROOT, file));
}
main().catch(e => { console.error(e); process.exit(1); });
