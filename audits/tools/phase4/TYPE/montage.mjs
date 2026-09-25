// Phase 4 TYPE: a contact sheet of every area's title treatment, cropped from the committed Phase 1 captures
// (System theme, light, iPad portrait 820×1180 at 1×; the park map from its park-day capture).
// Usage: node audits/tools/phase4/TYPE/montage.mjs  -> audits/evidence/p4/TYPE/titles-ipad-portrait.png
// Each tile shows the top `h` CSS px of the capture (the app tiles include the shell's 14/16 px viewer bar).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { playwright } from '../../lib/local.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const S = p => path.join(ROOT, 'audits/screens', p);
const TILES = [
  ['Shell · Apps (view title 36/400 serif)', 'shell/apps-typical-ipad-portrait-light.png', 0, 200],
  ['Shell · Home (hero 44/400 serif)', 'shell/home-typical-ipad-portrait-light.png', 0, 200],
  ['F260 (h1 30/700 rounded, −0.03em)', 'f260/today-typical-ipad-portrait-light.png', 0, 200],
  ['Larder Ledger (h1 28/700 serif, −0.01em)', 'leftovers/main-typical-ipad-portrait-light.png', 0, 200],
  ['Prayer (h1 31/600 Manrope, −0.032em)', 'prayer/today-typical-ipad-portrait-light.png', 0, 290],
  ['Kitchen timer (h1 18/600 serif, +0.01em)', 'timer/idle-typical-ipad-portrait-light.png', 330, 360],
  ['Tally (no title; 12/700 caps kicker)', 'tally/main-typical-ipad-portrait-light.png', 0, 200],
  ['Kid Verse, adult (no title; ref 56/400 serif)', 'kidverse/adult-typical-ipad-portrait-light.png', 170, 200],
  ['Verses (no title; ref 56/400 serif)', 'verses/trainer-typical-ipad-portrait-light.png', 150, 200],
  ['Build guide (h1 28/400 serif)', 'dollywood/map-typical-ipad-portrait-light.png', 0, 200],
];
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#fff;font:600 13px system-ui,Segoe UI,sans-serif;color:#222}
.g{display:grid;grid-template-columns:repeat(2,820px);gap:8px;padding:8px}
.t{border:1px solid #ccc}.t b{display:block;padding:4px 8px;background:#eee}
.c{width:820px;overflow:hidden;background-repeat:no-repeat}
</style><div class="g">${TILES.map(([l, f, y, h]) => `<div class="t"><b>${l}</b><div class="c" style="height:${h}px;background-image:url('${pathToFileURL(S(f)).href}');background-position:0 -${y}px"></div></div>`).join('')}</div>`;
const tmp = path.join(os.tmpdir(), 'p4-type-montage.html');
fs.writeFileSync(tmp, html);
const pw = playwright();
const b = await pw.webkit.launch();
try {
  const p = await b.newPage({ viewport: { width: 1664, height: 800 }, deviceScaleFactor: 1 });
  await p.goto(pathToFileURL(tmp).href);
  await p.waitForTimeout(500);
  const out = path.join(ROOT, 'audits/evidence/p4/TYPE/titles-ipad-portrait.png');
  await p.screenshot({ path: out, fullPage: true });
  console.log(out, (fs.statSync(out).size / 1024).toFixed(0), 'KB');
} finally { await b.close(); }
