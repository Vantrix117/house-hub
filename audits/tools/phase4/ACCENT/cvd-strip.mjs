#!/usr/bin/env node
// Phase 4 ACCENT — a picture of the profile colours as people with colour-vision deficiencies see them.
// Rows: normal, protanopia, deuteranopia, tritanopia (Machado 2009, severity 1, tokens.mjs CVD). Columns: every profile
// colour and swatch. Each cell shows the raw colour as an avatar ring (what index.html/hub.js paint around faces), the
// Hearth --accent-soft chip fill with the --accent-deep label (what a chip/tab/selected state paints), and the same pair
// in Midnight. Rendered with the rig's WebKit (no app code, no server).
//   node audits/tools/phase4/ACCENT/cvd-strip.mjs → audits/evidence/p4/ACCENT/cvd-strip.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { playwright } from '../../lib/local.mjs';
import { COLOURS, CVD, sim, derive, hex2, toHex } from './tokens.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p4/ACCENT/cvd-strip.png');
const rows = [['normal', null], ['protanopia', CVD.protan], ['deuteranopia', CVD.deutan], ['tritanopia', CVD.tritan]];
const f = (c, M) => toHex(M ? sim(c, M) : c);
const cell = (c, M) => {
  const L = derive(c.hex, 'system-light'), D = derive(c.hex, 'midnight');
  return `<td><div class="ring" style="border-color:${f(hex2(c.hex), M)}"></div>
    <div class="chip" style="background:${f(L.soft, M)};color:${f(L.deep, M)}">${c.name.split(' ')[0]}</div>
    <div class="chip" style="background:${f(D.soft, M)};color:${f(D.deep, M)}">${c.name.split(' ')[0]}</div></td>`;
};
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:16px;background:#F7F2EB;font:600 12px system-ui,Segoe UI,sans-serif;color:#2E251D}
table{border-collapse:separate;border-spacing:6px 10px} th{text-align:left;font-size:12px;padding-right:6px}
td{text-align:center;vertical-align:top} .ring{width:34px;height:34px;border-radius:50%;border:5px solid;margin:0 auto 5px;background:#FFFCF8}
.chip{border-radius:999px;padding:4px 8px;margin-top:4px;min-width:64px}
.dark{background:#241E19}
</style><table><tr><th></th>${COLOURS.map(c => `<th style="text-align:center">${c.hex}</th>`).join('')}</tr>
${rows.map(([n, M]) => `<tr><th>${n}</th>${COLOURS.map(c => cell(c, M)).join('')}</tr>`).join('')}</table>
<p style="max-width:1100px;font-weight:400">Each cell: the raw profile colour as an avatar ring; the Hearth chip (--accent-soft fill, --accent-deep label); the Midnight chip. Simulation: Machado et al. 2009, severity 1.0, linear RGB.</p>`;
const pw = playwright();
const b = await pw.webkit.launch();
try {
  const p = await b.newPage({ viewport: { width: 1180, height: 520 } });
  await p.setContent(html);
  await p.screenshot({ path: OUT, fullPage: true, scale: 'css' });
} finally { await b.close(); }
console.log('wrote', OUT, fs.statSync(OUT).size);
