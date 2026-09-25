// Phase 5: contact sheets for the design-preview captures, without touching audits/01-capture.md (lib/sheets.mjs's
// buildSheets also rewrites that file's index, which belongs to the Phase 1 baseline).
//   node audits/tools/capture.mjs --area preview --out audits/screens-preview
//   node audits/tools/phase5/preview-sheets.mjs   → audits/screens-preview/_sheets/preview--<section>.jpg
// Each sheet is one section: rows light / dark, columns the five devices, each capture scaled to 360 px wide (full page).
import fs from 'node:fs';
import path from 'node:path';
import { playwright, ROOT } from '../lib/local.mjs';
const OUT = path.join(ROOT, 'audits', 'screens-preview');
const man = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8'));
const DEV = ['iphone-pwa', 'iphone-safari', 'ipad-portrait', 'ipad-landscape', 'desktop'];
const W = 360;
fs.mkdirSync(path.join(OUT, '_sheets'), { recursive: true });
const pw = playwright();
const browser = await pw.webkit.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const screens = [...new Set(man.captures.filter(c => c.area === 'preview').map(c => c.screen))];
for (const s of screens) {
  const cell = c => c ? `<td><img src="data:image/png;base64,${fs.readFileSync(path.join(ROOT, c.file)).toString('base64')}" style="width:${W}px"></td>` : '<td>—</td>';
  const rows = ['light', 'dark'].map(m => `<tr><th>${m}</th>${DEV.map(d => cell(man.captures.find(c => c.screen === s && c.device === d && c.mode === m))).join('')}</tr>`).join('');
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:16px;font:13px system-ui;background:#f2f2f7}h1{font-size:18px;margin:0 0 8px}table{border-spacing:8px}th{text-align:left;vertical-align:top;color:#3c3c43}td{vertical-align:top}img{display:block;border-radius:6px;box-shadow:0 0 0 1px rgba(0,0,0,.12)}</style><h1>design preview / ${s}</h1><table><tr><th></th>${DEV.map(d => `<th>${d}</th>`).join('')}</tr>${rows}</table>`, { waitUntil: 'load' });
  await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
  const box = await page.evaluate(() => { const r = document.querySelector('table').getBoundingClientRect(); return { w: Math.ceil(r.right + 16), h: Math.ceil(r.bottom + 16) }; });
  const h = Math.min(box.h, 16000);
  await page.setViewportSize({ width: box.w, height: h });
  const file = path.join(OUT, '_sheets', `preview--${s}.jpg`);
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: box.w, height: h }, type: 'jpeg', quality: 78 });
  console.log(path.relative(ROOT, file), fs.statSync(file).size, 'bytes');
}
await browser.close();
