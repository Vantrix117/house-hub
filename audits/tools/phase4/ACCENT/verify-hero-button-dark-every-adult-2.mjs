// Phase 4 ACCENT — skeptic #2 for "hero-button-dark-every-adult". Independent re-measure on the local rig (WebKit).
// For each adult × theme key: set the theme row through the API as that person + the hub.theme mirror, open #me on the
// iPad, read the Switch button's computed colour/background/font and the scheme, screenshot, hide the label, take the
// median painted background inside the button, and compute the label's contrast against it (computed ink vs painted bg,
// and the darkest-ink pixel vs painted bg as a cross-check). Also the kiosk (tv) reached by a hash change to #me.
//   node audits/tools/phase4/ACCENT/verify-hero-button-dark-every-adult-2.mjs [themes] [profiles] [--shot]
// → audits/evidence/p4/ACCENT/verify-hero-button-dark-every-adult-2.json (+ -<case>.png with --shot)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
import { decodePng } from './png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p4', 'ACCENT');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const SHOT = process.argv.includes('--shot');
const KEYS = { 'system-light': ['system', 'light'], 'system-dark': ['system', 'dark'], 'hearth-dark': ['hearth', 'dark'], midnight: ['midnight', 'light'], forest: ['forest', 'light'], parchment: ['parchment', 'light'], frost: ['frost', 'light'] };
const themes = (args[0] || 'system-dark,midnight,forest,hearth-dark,system-light,parchment,frost').split(',');
const profiles = (args[1] || 'eli,christian,mom,dad,niece,tv').split(',');

const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
const rgb = s => { const n = (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number); return /^color\(srgb/.test(s) ? n.map(v => Math.round(v * 255)) : n; };

async function one(L, theme, who) {
  const [th, mode] = KEYS[theme];
  if (who !== 'tv') await L.apiAs(who, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: th } });
  const ls = th === 'system' ? {} : { 'hub.theme': JSON.stringify(th) };
  const device = who === 'tv' ? 'tv' : 'ipad-portrait';
  const d = await L.device({ device, mode, profile: who, localStorage: ls });
  const out = { theme, mode, profile: who, device };
  try {
    const p = d.page;
    await d.goto(who === 'tv' ? '' : '#me');
    await sleep(2500);                       // first pull: the server's theme row wins (hub.js adoptTheme)
    if (who === 'tv') { await p.evaluate(() => { location.hash = '#me'; }); await sleep(1200); out.reachedBy = 'hashchange to #me (kiosk has no tab bar)'; }
    await p.waitForSelector('#switch', { state: 'visible', timeout: 10000 });
    await p.evaluate(() => document.querySelector('#switch').scrollIntoView({ block: 'center' }));
    await sleep(600);
    const info = await p.evaluate(() => {
      const b = document.querySelector('#switch'), cs = getComputedStyle(b), r = b.getBoundingClientRect(), html = document.documentElement, h = getComputedStyle(html);
      return { dataTheme: html.dataset.theme || null, scheme: html.dataset.scheme, kind: html.dataset.kind, profile: hub.profile && hub.profile.id,
        accent: h.getPropertyValue('--accent').trim(), accentDeep: h.getPropertyValue('--accent-deep').trim(),
        color: cs.color, bg: cs.backgroundColor, bgImage: cs.backgroundImage, fs: parseFloat(cs.fontSize), fw: cs.fontWeight, text: b.textContent.trim(),
        prefersDark: matchMedia('(prefers-color-scheme: dark)').matches, r: { x: r.left, y: r.top, w: r.width, h: r.height } };
    });
    Object.assign(out, info);
    const shown = decodePng(await p.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' }));
    await p.evaluate(() => { const s = document.createElement('style'); s.id = '__v'; s.textContent = '#switch{color:transparent!important;text-shadow:none!important}'; document.head.appendChild(s); });
    await sleep(250);
    const hidden = decodePng(await p.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' }));
    await p.evaluate(() => document.getElementById('__v').remove());
    const px = img => { const a = []; const r = info.r; for (let y = Math.ceil(r.y + 4); y < r.y + r.h - 4; y++) for (let x = Math.ceil(r.x + 8); x < r.x + r.w - 8; x++) { const i = (y * img.w + x) * 4; a.push([img.px[i], img.px[i + 1], img.px[i + 2]]); } return a; };
    const bgs = px(hidden), ink = px(shown);
    const sorted = [...bgs].sort((p1, q) => lum(p1) - lum(q));
    const bgMed = sorted[sorted.length >> 1];
    // darkest-or-lightest ink pixel that differs most from the median bg (the painted glyph core)
    let best = bgMed, bestD = 0; for (const c of ink) { const dd = Math.abs(lum(c) - lum(bgMed)); if (dd > bestD) { bestD = dd; best = c; } }
    out.paintedBg = bgMed; out.inkCore = best;
    out.ratioComputedInkVsPaintedBg = cr(rgb(info.color), bgMed);
    out.ratioInkCoreVsPaintedBg = cr(best, bgMed);
    out.passAA = out.ratioComputedInkVsPaintedBg >= 4.5;
    if (SHOT) {
      const r = info.r, m = 140;
      const clip = { x: Math.max(0, r.x - m * 3), y: Math.max(0, r.y - m), width: Math.min(r.w + m * 4, 820), height: r.h + m * 2 };
      await p.screenshot({ path: path.join(EVID, `verify-hero-button-dark-every-adult-2-${theme}-${who}.png`), clip, scale: 'css', animations: 'disabled' });
    }
  } catch (e) { out.error = e.message; }
  await d.ctx.close().catch(() => {});
  return out;
}

const L = await local({ variant: 'typical', engine: 'webkit' });
const res = [];
try {
  for (const theme of themes) for (const who of profiles) {
    if (who === 'tv' && !['system-dark', 'system-light'].includes(theme)) continue;   // the kiosk keeps a device-local theme; only the OS scheme varies it here
    const r = await one(L, theme, who);
    res.push(r);
    console.log(theme.padEnd(12), who.padEnd(9), r.error || `${r.scheme} ${r.dataTheme} ink=${r.color} bg=${r.paintedBg} -> ${r.ratioComputedInkVsPaintedBg} (core ${r.ratioInkCoreVsPaintedBg}) fs=${r.fs}/${r.fw}`);
  }
} finally { await L.close(); }
const file = path.join(EVID, 'verify-hero-button-dark-every-adult-2.json');
let prev = []; try { prev = JSON.parse(fs.readFileSync(file, 'utf8')).cases || []; } catch {}
const keyOf = c => c.theme + '|' + c.profile;
const merged = [...prev.filter(c => !res.some(r => keyOf(r) === keyOf(c))), ...res];
fs.writeFileSync(file, JSON.stringify({ script: 'audits/tools/phase4/ACCENT/verify-hero-button-dark-every-adult-2.mjs', engine: 'webkit', device: 'ipad-portrait (tv: tv)', cases: merged }, null, 1));
console.log('wrote', file, merged.length, 'cases');
