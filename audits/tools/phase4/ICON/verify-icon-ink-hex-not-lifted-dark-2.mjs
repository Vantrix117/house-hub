// Skeptic #2 for ICON "icon-ink-hex-not-lifted-dark": independent re-measure of tile glyphs, Home card-head glyphs,
// the kid "Let's play" sparkle and the TV board heads, per theme. For each target <svg> it reads the computed ink
// (the svg's `color`, which the strokes use via currentColor), hides every target svg, screenshots at CSS scale, and
// takes the median pixel of the svg's box as the background; ratio = WCAG contrast of ink vs that background.
// Also reports the ink source (inline --tint hex from apps.json/profile vs a var() token) from the holder's style attr.
//   node audits/tools/phase4/ICON/verify-icon-ink-hex-not-lifted-dark-2.mjs [themes]
// -> audits/evidence/p4/ICON/verify-icon-ink-hex-not-lifted-dark-2.json (+ one PNG)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const OUT = path.resolve('audits/evidence/p4/ICON');
const THEMES = (process.argv[2] || 'midnight,forest,parchment,hearth').split(',');
const TARGETS = '#grid .tile .ticon svg, .card h2 > .app-icon svg, .kid-cta .app-icon svg, .tv-pane h2 .app-icon svg';

const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = p => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };

async function measure(d) {
  const page = d.page;
  const items = await page.evaluate(sel => [...document.querySelectorAll(sel)].map((svg, i) => {
    const r = svg.getBoundingClientRect(); svg.dataset.v2 = i;
    const holder = svg.closest('[style*="--tint"]');
    const tile = svg.closest('.tile, .card, .kid-cta, .tv-pane');
    const h = tile && (tile.querySelector('h2') || tile);
    return { i, where: tile ? (tile.dataset.id || h.textContent.replace(/\s+/g, ' ').trim().slice(0, 30)) : '?',
      kind: svg.closest('.tile') ? 'tile' : svg.closest('.tv-pane') ? 'tv-head' : svg.closest('.kid-cta') ? 'kid-cta' : 'home-head',
      ink: getComputedStyle(svg).color, inkSource: holder ? ((holder.getAttribute('style').match(/--tint:([^;"]+)/) || [])[1] || '?') : 'inherit (--accent)',
      rect: { x: r.x, y: r.y, w: r.width, h: r.height }, inView: r.bottom > 0 && r.top < innerHeight && r.width > 0 };
  }), TARGETS);
  const vis = items.filter(it => it.inView);
  await page.evaluate(() => document.querySelectorAll('[data-v2]').forEach(s => s.style.setProperty('visibility', 'hidden', 'important')));
  await sleep(80);
  const png = await page.screenshot({ scale: 'css', animations: 'disabled' });
  await page.evaluate(() => document.querySelectorAll('[data-v2]').forEach(s => s.style.removeProperty('visibility')));
  const res = await page.evaluate(async ([b64, its]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
    const D = cx.getImageData(0, 0, img.width, img.height);
    const c1 = document.createElement('canvas').getContext('2d');
    const rgb = s => { c1.clearRect(0, 0, 1, 1); c1.fillStyle = '#000'; c1.fillStyle = s; c1.fillRect(0, 0, 1, 1); return [...c1.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    return its.map(it => {
      const px = [];
      for (let y = Math.max(0, Math.floor(it.rect.y)); y < Math.min(D.height, Math.ceil(it.rect.y + it.rect.h)); y++)
        for (let x = Math.max(0, Math.floor(it.rect.x)); x < Math.min(D.width, Math.ceil(it.rect.x + it.rect.w)); x++) { const k = (y * D.width + x) * 4; px.push([D.data[k], D.data[k + 1], D.data[k + 2]]); }
      const s = px.map(p => p[0] * 0.3 + p[1] * 0.59 + p[2] * 0.11); const idx = s.map((_, i) => i).sort((a, b) => s[a] - s[b]);
      return { i: it.i, bg: px[idx[Math.floor(idx.length / 2)]], inkRgb: rgb(it.ink) };
    });
  }, [png.toString('base64'), vis]);
  return vis.map(it => { const r = res.find(q => q.i === it.i); return { kind: it.kind, where: it.where, inkSource: it.inkSource, ink: it.ink, inkRgb: r.inkRgb, bg: r.bg, ratio: ratio(r.inkRgb, r.bg) }; });
}

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = { script: 'verify-icon-ink-hex-not-lifted-dark-2.mjs', engine: 'webkit', variant: 'typical', themes: {} };
try {
  for (const theme of THEMES) {
    const mode = ['midnight', 'forest'].includes(theme) ? 'dark' : 'light';
    for (const p of ['eli', 'ezra']) await L.apiAs(p, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme, updated_at: Date.now() } });
    const T = out.themes[theme] = { mode, surfaces: {} };
    const runs = [
      ['adult-apps', 'ipad-portrait', 'eli', 'apps'], ['adult-home', 'ipad-portrait', 'eli', null],
      ['kid-apps', 'ipad-portrait', 'ezra', 'apps'], ['kid-home', 'ipad-portrait', 'ezra', null],
    ];
    if (theme === 'midnight') runs.push(['tv', 'tv', 'tv', null]);
    for (const [name, device, profile, tab] of runs) {
      const d = await L.device({ device, mode, profile, localStorage: { 'hub.theme': JSON.stringify(theme) } });
      try {
        await d.goto('#home');
        await d.page.waitForSelector(profile === 'tv' ? '#tv' : '#view-home .home-hero', { timeout: 15000 });
        await d.page.waitForFunction(() => !!(window.hub && hub.sync && hub.sync.lastPull), null, { timeout: 10000 }).catch(() => {});
        await sleep(1500);
        if (tab) { await d.page.click(`#tabbar .tab[data-tab="${tab}"]`); await d.page.waitForSelector('#grid .tile'); await sleep(900); }
        const applied = await d.page.evaluate(() => ({ theme: document.documentElement.dataset.theme || '(none)', scheme: document.documentElement.dataset.scheme, kind: document.documentElement.dataset.kind, accent: document.documentElement.style.getPropertyValue('--accent') }));
        const items = await measure(d);
        T.surfaces[name] = { device, profile, applied, items };
        if (theme === 'midnight' && name === 'kid-apps') await d.page.screenshot({ path: path.join(OUT, 'verify-icon-ink-hex-not-lifted-dark-2-kid-apps-midnight-ipad.png'), scale: 'css' });
        console.log(theme, name, JSON.stringify(applied), items.map(i => `${i.kind}:${i.where}=${i.ratio}`).join(' | '));
      } catch (e) { T.surfaces[name] = { error: String(e.message || e).slice(0, 300) }; console.log(theme, name, 'ERROR', String(e.message || e).slice(0, 200)); }
      await d.close();
    }
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'verify-icon-ink-hex-not-lifted-dark-2.json'), JSON.stringify(out, null, 1));
console.log('wrote audits/evidence/p4/ICON/verify-icon-ink-hex-not-lifted-dark-2.json');
