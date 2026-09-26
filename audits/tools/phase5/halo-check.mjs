// Phase 5 · token revisions 6b-6c · the halo on see-through glass (decision D8), measured as RENDERED, in WebKit and Chromium.
// A blurred glow gated as one flat layer overstated what engines paint (verify-rev6, round 1), and a median over a ring that is mostly
// outline passes by construction (round 2). So this harness gates the p10 of the INNER ring (0.5-1 CSS px round each glyph core:
// outside the anti-aliased fringe, inside the 1 px outline) for text at 11, 13 and 15 px and for a 1.75 px stroke icon, on Clear and
// Current, over the page, a card, #767676 and the worst photo (black under light glass, white under dark), under the full sheen and
// pickup, in all six palettes. The OUTER ring (1.5-3 CSS px, what lies behind the outline) is reported, as are Frosted (no halo)
// and an opaque-card control. Thresholds: text 7, text-2 4.5, text-3 4.5 (text-3 never over photos or on pills: a lint row), icons 3.
//   node audits/tools/phase5/halo-check.mjs → audits/evidence/p5/halo-check.json
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { contrast } from '../phase4/tokens/colour-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const TOKENS = path.join(ROOT, 'audits', 'tools', 'phase4', 'tokens', 'proposed-tokens.css');
const OUTDIR = path.join(ROOT, 'audits', 'evidence', 'p5');
const H = process.env.HUB_AUDIT_HOME || path.join(process.env.LOCALAPPDATA, 'house-hub-audit');
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(H, 'browsers');
const { webkit, chromium } = createRequire(path.join(H, 'noop.js'))('playwright-core');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const css = fs.readFileSync(TOKENS, 'utf8');

// ── a minimal PNG decoder (8-bit RGB / RGBA, non-interlaced: what Playwright writes) ─────────────────────────────
function decodePng(buf) {
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; if (data[8] !== 8 || data[12] !== 0) throw new Error('PNG: 8-bit non-interlaced only'); }
    else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0; if (!bpp) throw new Error('PNG colour type ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(w * h * 3);
  const prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]; raw.copy(cur, 0, y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = cur[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = v & 255;
    }
    for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) out[(y * w + x) * 3 + k] = cur[x * bpp + k];
    cur.copy(prev);
  }
  return { w, h, px: out };
}

// the rings: Chebyshev distance in device px from a glyph core (a pixel within 1.25:1 of the ink). At device scale 2:
//   INNER ring = distance 2 (0.5-1 CSS px): outside the 1-device-px anti-aliased fringe (distance 1, excluded), inside the 1 CSS px
//   outline. Its p10 is GATED: it is what the stroke is read against.  OUTER ring = distance 3-6 (1.5-3 CSS px): what lies behind the
//   outline, the glass over the photo. REPORTED.
function rings(img, box, ink) {
  const { w, px } = img, x0 = Math.round(box.x * 2), y0 = Math.round(box.y * 2), bw = Math.round(box.width * 2), bh = Math.round(box.height * 2);
  const col = (x, y) => { const i = ((y0 + y) * w + (x0 + x)) * 3; return { r: px[i] / 255, g: px[i + 1] / 255, b: px[i + 2] / 255, a: 1 }; };
  const dist = new Uint8Array(bw * bh).fill(255), q = [];
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (contrast(col(x, y), ink) <= 1.25) { dist[y * bw + x] = 0; q.push(y * bw + x); }
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi], x = i % bw, y = (i / bw) | 0, d = dist[i]; if (d >= 6) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue; const j = ny * bw + nx; if (dist[j] > d + 1) { dist[j] = d + 1; q.push(j); } }
  }
  const stat = (lo, hi) => { const v = []; for (let i = 0; i < dist.length; i++) if (dist[i] >= lo && dist[i] <= hi) v.push(contrast(ink, col(i % bw, (i / bw) | 0))); v.sort((a, b) => a - b);
    const at = f => v[Math.min(v.length - 1, Math.floor(f * v.length))]; return { n: v.length, p10: at(0.1), median: at(0.5) }; };
  return { cores: q.length, inner: stat(2, 2), outer: stat(3, 6) };
}

const THEMES = { hearth: 'light', parchment: 'light', frost: 'light', midnight: 'dark', forest: 'dark', graphite: 'dark' };
const LEVELS = ['frosted', 'current', 'clear'];
const ROLES = [['text', 7], ['text-2', 4.5], ['text-3', 4.5]];
const SIZES = [11, 13, 15];                        // caption2, footnote, 15 px
const ICONS = [['text-2', 3], ['accent-ink', 3]];  // an unselected and a selected tab icon: non-text, 3:1 (WCAG 1.4.11)
const ACCENT = 'bubblegum';                        // a strong pickup tone in both schemes
const SAMPLE = 'Stir the soup gently now';
const ICON = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="filter:var(--glass-icon-filter)"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/><circle cx="18" cy="6" r="2.5"/></svg>';
const fl = v => Math.floor(v * 100 + 1e-9) / 100;
const report = { generated: new Date().toISOString(), script: 'audits/tools/phase5/halo-check.mjs', tokens: 'audits/tools/phase4/tokens/proposed-tokens.css', tokensSha256: crypto.createHash('sha256').update(css).digest('hex'),
  method: 'rendered at device scale 2; text at 11, 13 and 15 px regular system-ui with --glass-text-shadow, and a 1.75 px stroke icon with --glass-icon-filter, under the full sheen and pickup; inner ring = device distance 2 from a glyph core (0.5-1 CSS px), its p10 GATED on Clear and Current (text 7, text-2 4.5, text-3 4.5, icons 3); outer ring = 1.5-3 CSS px, reported; Frosted and an opaque-card control reported', engines: {}, fails: [] };

for (const [ename, launcher, opts] of [['webkit', webkit, {}], ['chromium', chromium, CHROME ? { executablePath: CHROME } : {}]]) {
  const browser = await launcher.launch(opts);
  const E = report.engines[ename] = { version: browser.version(), cells: [] };
  try {
    for (const [theme, scheme] of Object.entries(THEMES)) for (const level of LEVELS) {
      const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
      await ctx.route('**/*', r => r.request().url().startsWith('data:') || r.request().url() === 'about:blank' ? r.continue() : r.abort());
      const page = await ctx.newPage();
      const attrs = `data-theme="${theme}" data-scheme="${scheme}" data-accent="${ACCENT}" data-kind="adult"${level === 'frosted' ? '' : ` data-glass="${level}" data-transparency="full"`}`;
      const backs = { page: 'var(--bg)', card: 'var(--surface)', mid: '#767676', worst: scheme === 'light' ? '#000000' : '#FFFFFF' };
      const cells = [];
      for (const [bn, bv] of Object.entries(backs)) for (const mat of ['glass', 'glass-strong']) {
        for (const [role, thr] of ROLES) for (const size of SIZES) cells.push({ id: `${bn}-${mat}-${role}-${size}`, bn, bv, mat, role, size, thr, kind: 'text' });
        for (const [role, thr] of ICONS) cells.push({ id: `${bn}-${mat}-icon-${role}`, bn, bv, mat, role, thr, kind: 'icon' });
      }
      for (const [role, thr] of ROLES) cells.push({ id: `control-${role}`, bn: 'control', bv: 'var(--surface)', mat: 'none', role, size: 15, thr, kind: 'text' });
      const cellHtml = c => `<div class="back" style="background:${c.bv}"><div class="g ${c.mat}">${c.kind === 'icon'
        ? `<span class="ic" id="${c.id}" style="color:var(--${c.role})">${ICON}</span>`
        : `<span class="t" id="${c.id}" style="color:var(--${c.role});font-size:${c.size}px">${SAMPLE}</span>`}</div></div>`;
      await page.setContent(`<!doctype html><html ${attrs}><head><style>${css}
        body { margin: 0; padding: 8px; background: var(--bg); display: grid; grid-template-columns: repeat(4, 320px); gap: 8px; font: 400 15px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif; }
        .back { padding: 10px; } .g { height: 50px; padding: 6px 10px; box-sizing: border-box; display: flex; align-items: flex-start; }
        .g.glass { background: var(--glass-bg-tinted); } .g.glass-strong { background: var(--glass-bg-strong-tinted); } .g.none { background: var(--surface); }
        .t { text-shadow: var(--glass-text-shadow); white-space: nowrap; } .ic { display: inline-flex; }
      </style></head><body>${cells.map(cellHtml).join('')}</body></html>`);
      await page.evaluate(() => document.fonts.ready);
      const info = await page.evaluate(ids => Object.fromEntries(ids.map(id => { const el = document.getElementById(id), r = el.getBoundingClientRect(); return [id, { x: r.x - 4, y: r.y - 4, width: r.width + 8, height: r.height + 8, color: getComputedStyle(el).color }]; })), cells.map(c => c.id));
      const img = decodePng(await page.screenshot({ fullPage: true, type: 'png' }));
      for (const c of cells) {
        const m = info[c.id].color.match(/rgba?\(([^)]*)\)/)[1].split(/[\s,/]+/).map(Number);
        const ink = { r: m[0] / 255, g: m[1] / 255, b: m[2] / 255, a: 1 };
        const r = rings(img, info[c.id], ink);
        // gated: the see-through levels; text-3 never over a photo nor on pills and buttons (a lint row); icons everywhere
        const gated = c.bn !== 'control' && level !== 'frosted' && !(c.kind === 'text' && c.role === 'text-3' && (c.bn === 'worst' || c.mat === 'glass'));
        const cell = { theme, level, backdrop: c.bn, material: c.mat, kind: c.kind, role: c.role, size: c.size ?? null, threshold: c.thr, innerP10: fl(r.inner.p10), innerMedian: fl(r.inner.median), outerP10: fl(r.outer.p10), outerMedian: fl(r.outer.median), innerPixels: r.inner.n, cores: r.cores, gated };
        E.cells.push(cell);
        if (!r.cores || r.inner.n < 20) report.fails.push(`${ename} ${theme}/${level} ${c.id}: glyph cores not found (${r.cores}, ring ${r.inner.n})`);
        else if (gated && r.inner.p10 < c.thr) report.fails.push(`${ename} ${theme}/${level} ${c.kind} ${c.role}${c.size ? ' ' + c.size + 'px' : ''} on ${c.mat} over ${c.bn}: inner-ring p10 ${fl(r.inner.p10)} < ${c.thr}`);
      }
      await ctx.close();
    }
  } finally { await browser.close(); }
}
// summaries: per engine x level x kind/role, the lowest inner-ring p10 (gated on the see-through levels) and the lowest outer-ring p10
report.summary = {};
for (const [en, e] of Object.entries(report.engines)) for (const c of e.cells) {
  const k = `${en} ${c.level}${c.backdrop === 'control' ? ' (control: opaque card)' : ''} ${c.kind === 'icon' ? 'icon ' : ''}${c.role}${c.gated || c.level === 'frosted' || c.backdrop === 'control' ? '' : ' (reported)'}`;
  const s2 = report.summary[k] ??= { lowestInnerP10: Infinity, at: '', lowestOuterP10: Infinity };
  if (c.innerP10 < s2.lowestInnerP10) { s2.lowestInnerP10 = c.innerP10; s2.at = `${c.theme} ${c.material} over ${c.backdrop}${c.size ? ' ' + c.size + 'px' : ''}`; }
  s2.lowestOuterP10 = Math.min(s2.lowestOuterP10, c.outerP10);
}
report.ok = report.fails.length === 0;
fs.mkdirSync(OUTDIR, { recursive: true });
fs.writeFileSync(path.join(OUTDIR, 'halo-check.json'), JSON.stringify(report, null, 1));
for (const [k, v] of Object.entries(report.summary)) console.log(k.padEnd(56), 'inner p10', String(v.lowestInnerP10).padEnd(6), 'outer p10', String(v.lowestOuterP10).padEnd(6), v.at);
for (const f of report.fails.slice(0, 30)) console.log('FAIL', f);
console.log(report.ok ? 'OK' : `NOT OK: ${report.fails.length} failing cells`);
process.exit(report.ok ? 0 : 1);
