// Skeptic #1 for critic-focus-invisible-tiles-picker-cards-chat-1: re-measure independently.
// Method: on each screen, first screenshot every target element (crop + 8 px) with NOTHING focused (baseline), then walk
// the page with real Tab presses (Alt+Tab in WebKit) and, while each target holds keyboard focus, re-screenshot its crop
// and read computed box-shadow/outline. A visible focus indicator = a changed style and changed pixels vs baseline.
// Also records what holds focus when the picker loads (index.html:541 focuses .pcard.last).
// Desktop 1440x900; Chromium and WebKit; light and dark.
// Usage: node audits/tools/phase4/CRIT/verify-critic-focus-invisible-tiles-picker-cards-chat-1-1.mjs
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p4/CRIT/verify-critic-focus-invisible-tiles-picker-cards-chat-1-1');
const rows = [];
// decoded pixel comparison in the page: count of pixels whose max channel delta > 8, and the max delta
const pixDiff = async (page, a, b) => page.evaluate(async ([a, b]) => {
  const load = async s => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
  const [p, q] = [await load(a), await load(b)]; let n = 0, mx = 0;
  for (let i = 0; i < Math.min(p.length, q.length); i += 4) { const d = Math.max(Math.abs(p[i] - q[i]), Math.abs(p[i + 1] - q[i + 1]), Math.abs(p[i + 2] - q[i + 2])); if (d > 8) n++; if (d > mx) mx = d; }
  return { n, mx };
}, [a.toString('base64'), b.toString('base64')]);
const SCREENS = [['#apps', 'eli', '.tile'], ['', null, '.pcard:not(.skeleton)'], ['#chat', 'eli', '.chat-form .input'], ['#me', 'eli', '.tabbar .tab']];
for (const engine of ['chromium', 'webkit']) {
  const L = await local({ variant: 'typical', engine });
  try {
    for (const mode of ['light', 'dark']) {
      for (const [hash, profile, sel] of SCREENS) {
        const d = await L.device({ device: 'desktop', profile, mode });
        try {
          await d.goto(hash); await sleep(2500);
          if (!profile) {
            const load = await d.page.evaluate(() => { const e = document.activeElement; return { cls: String(e.className), label: (e.textContent || '').trim().slice(0, 20), fv: e.matches(':focus-visible') }; });
            rows.push({ engine, mode, screen: 'picker-onload', ...load });
          }
          await d.page.evaluate(() => document.activeElement && document.activeElement.blur());
          await d.page.mouse.click(2, 2); await sleep(1500);
          const rects = await d.page.evaluate(s => [...document.querySelectorAll(s)].map((e, i) => { e.dataset.vk = i; const r = e.getBoundingClientRect(); return { i, x: r.x, y: r.y, w: r.width, h: r.height, shadow: getComputedStyle(e).boxShadow, outline: getComputedStyle(e).outlineStyle + ' ' + getComputedStyle(e).outlineWidth }; }).filter(r => r.w > 0 && r.y >= 8 && r.y + r.h <= 892), sel);
          const base = {};
          for (const r of rects) base[r.i] = { r, png: await d.page.screenshot({ clip: { x: Math.max(0, r.x - 8), y: r.y - 8, width: Math.min(1440 - Math.max(0, r.x - 8), r.w + 16), height: r.h + 16 }, animations: 'disabled', caret: 'hide' }) };
          const seen = new Set();
          for (let k = 0; k < 150 && seen.size < rects.length; k++) {
            await d.page.keyboard.press(engine === 'webkit' ? 'Alt+Tab' : 'Tab'); await sleep(80);
            const vk = await d.page.evaluate(() => document.activeElement?.dataset?.vk ?? null);
            if (vk === null || !base[vk] || seen.has(vk)) continue;
            seen.add(vk); await sleep(400);
            const f = await d.page.evaluate(() => { const e = document.activeElement, c = getComputedStyle(e); return { cls: String(e.className), label: (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24), fv: e.matches(':focus-visible'), shadow: c.boxShadow, outline: c.outlineStyle + ' ' + c.outlineWidth }; });
            const { r, png } = base[vk];
            const now = await d.page.screenshot({ clip: { x: Math.max(0, r.x - 8), y: r.y - 8, width: Math.min(1440 - Math.max(0, r.x - 8), r.w + 16), height: r.h + 16 }, animations: 'disabled', caret: 'hide' });
            const row = { engine, mode, screen: hash || 'picker', sel, cls: f.cls, label: f.label, fv: f.fv, styleChanged: f.shadow !== r.shadow || f.outline !== r.outline, scrollY: await d.page.evaluate(() => scrollY), ...(await (async () => { const p = await pixDiff(d.page, png, now); return { pixelsChanged: p.n, maxDelta: p.mx }; })()) };
            rows.push(row);
            if (engine === 'chromium' && mode === 'light' && seen.size === 2) { fs.writeFileSync(`${OUT}-${(hash || 'picker').slice(hash ? 1 : 0)}-focused.png`, now); fs.writeFileSync(`${OUT}-${(hash || 'picker').slice(hash ? 1 : 0)}-unfocused.png`, png); }
          }
          rows.push({ engine, mode, screen: hash || 'picker', summary: true, targets: rects.length, reachedByTab: seen.size });
        } finally { await d.close(); }
      }
    }
  } finally { await L.close(); }
}
for (const r of rows) console.log(JSON.stringify(r));
fs.writeFileSync(OUT + '.json', JSON.stringify(rows, null, 1));
