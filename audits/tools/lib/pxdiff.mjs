// Pixel diff between two capture folders (Phase 6 before/after). A SHA-256 mismatch alone is not a change: scaled
// photos can resample differently between runs by a few levels. This reports, per file present in both folders, how
// many pixels differ by more than --tolerance (sum of |ΔR|+|ΔG|+|ΔB|, default 48) and the bounding box of the change.
//
//   node audits/tools/lib/pxdiff.mjs <before-dir> <after-dir> [--area a] [--tolerance 48] [--only-changed]
//
// Folders are laid out like audits/screens (<area>/<file>.png). Uses the rig's Playwright WebKit (see capture.mjs).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const pos = [];
for (let i = 0; i < argv.length; i++) { if (argv[i] === '--area' || argv[i] === '--tolerance') { i++; continue; } if (!argv[i].startsWith('--')) pos.push(argv[i]); }
const [A, B] = pos;
if (!A || !B) { console.error('usage: node pxdiff.mjs <before-dir> <after-dir> [--area a] [--tolerance 48] [--only-changed]'); process.exit(2); }
const TOL = +opt('tolerance', 48), AREA = opt('area'), ONLY = argv.includes('--only-changed');
const HOME = process.env.HUB_AUDIT_HOME || path.join(process.env.LOCALAPPDATA || os.homedir(), 'house-hub-audit');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(HOME, 'browsers');
const { webkit } = createRequire(path.join(HOME, 'noop.js'))('playwright-core');

const files = [];
for (const area of fs.readdirSync(A)) {
  if (AREA && area !== AREA) continue;
  const da = path.join(A, area), db = path.join(B, area);
  if (!fs.statSync(da).isDirectory() || !fs.existsSync(db)) continue;
  for (const f of fs.readdirSync(da)) if (f.endsWith('.png') && fs.existsSync(path.join(db, f))) files.push(area + '/' + f);
}
const browser = await webkit.launch();
const page = await browser.newPage();
let changed = 0;
for (const rel of files) {
  const a = fs.readFileSync(path.join(A, rel)), b = fs.readFileSync(path.join(B, rel));
  if (a.equals(b)) { if (!ONLY) console.log(`same     ${rel}`); continue; }
  const r = await page.evaluate(async ([x, y, tol]) => {
    const load = s => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + s; });
    const [ia, ib] = await Promise.all([load(x), load(y)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return { sizeChanged: [ia.width, ia.height, ib.width, ib.height] };
    const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height; const g = c.getContext('2d');
    g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, c.width, c.height).data;
    g.clearRect(0, 0, c.width, c.height); g.drawImage(ib, 0, 0); const db = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let i = 0; i < da.length; i += 4) {
      if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) <= tol) continue;
      n++; const p = i / 4, px = p % c.width, py = (p - px) / c.width;
      if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
    }
    return { n, pct: +(100 * n / (c.width * c.height)).toFixed(3), box: n ? [x0, y0, x1, y1] : null };
  }, [a.toString('base64'), b.toString('base64'), TOL]);
  if (r.sizeChanged) { changed++; console.log(`SIZE     ${rel} ${r.sizeChanged.join('×')}`); continue; }
  if (r.n) { changed++; console.log(`CHANGED  ${rel}  ${r.n} px (${r.pct}%)  box ${r.box.join(',')}`); }
  else if (!ONLY) console.log(`noise    ${rel}  (bytes differ, no pixel over tolerance ${TOL})`);
}
await browser.close();
console.log(`${files.length} compared, ${changed} changed beyond tolerance ${TOL}`);
