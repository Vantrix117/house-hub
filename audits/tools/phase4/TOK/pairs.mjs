// Phase 4 TOK (5): what docs/design.html + scripts/test-design.mjs check versus what design.css's components render.
// Resolves every foreground/background token pair the shared components paint (design.css:324-609) in WebKit, in every
// theme (plus Hearth on a dark OS, which hub.js renders with the dark-scheme block — P2-VIS-03), for all ten profile
// swatches (the eight household colours the guide checks + the two guest-only swatches, index.html:449), and marks each
// pair as checked or not checked by the guide's contrast table (docs/design.html:285-305).
//   node audits/tools/phase4/TOK/pairs.mjs   → audits/evidence/p4/TOK/token-pairs.json
import fs from 'node:fs';
import path from 'node:path';
import { OUT, ROOT, parseColor, over, contrast, hex } from './lib-tok.mjs';
import { playwright } from '../../lib/local.mjs';

const SWATCH = { Eli: '#4F5D8C', Mae: '#BC5A38', Ezra: '#137F77', Kiara: '#B4861B', Elizabeth: '#8A6A4B', David: '#3D5A3D', Mea: '#5B8143', TV: '#4C4C58', 'guest-plum': '#8C4F7A', 'guest-sea': '#4C7B6A' };
const GUIDE8 = ['Eli', 'Mae', 'Ezra', 'Kiara', 'Elizabeth', 'David', 'Mea', 'TV'];
const SCEN = [
  { id: 'hearth', theme: null, os: 'light' }, { id: 'parchment', theme: 'parchment', os: 'light' }, { id: 'frost', theme: 'frost', os: 'light' },
  { id: 'midnight', theme: 'midnight', os: 'light' }, { id: 'forest', theme: 'forest', os: 'light' }, { id: 'hearth-on-dark-os', theme: null, os: 'dark' },
];
// [name, fg, bg (may be "A over B"), min, kind, where, checkedByGuide]
const N = [
  ['text on bg', 'var(--text)', 'var(--bg)', 4.5, 'text', 'body', true],
  ['text-2 on bg', 'var(--text-2)', 'var(--bg)', 4.5, 'text', '.text-2', true],
  ['muted on bg', 'var(--muted)', 'var(--bg)', 4.5, 'text', '.muted/.kicker', true],
  ['text on surface', 'var(--text)', 'var(--surface)', 4.5, 'text', '.card', true],
  ['text-2 on surface', 'var(--text-2)', 'var(--surface)', 4.5, 'text', '.row-sub/.label', true],
  ['muted on surface', 'var(--muted)', 'var(--surface)', 4.5, 'text', '.help/.empty', true],
  ['text on surface-2', 'var(--text)', 'var(--surface-2)', 4.5, 'text', '.well', true],
  ['ok-ink on ok-soft', 'var(--ok-ink)', 'var(--ok-soft)', 4.5, 'text', '.chip-ok', true],
  ['warn-ink on warn-soft', 'var(--warn-ink)', 'var(--warn-soft)', 4.5, 'text', '.chip-warn', true],
  ['danger-ink on danger-soft', 'var(--danger-ink)', 'var(--danger-soft)', 4.5, 'text', '.chip-danger/.btn-danger', true],
  ['info-ink on info-soft', 'var(--info-ink)', 'var(--info-soft)', 4.5, 'text', '.chip-info', true],
  ['bg on text (toast, opaque)', 'var(--bg)', 'var(--text)', 4.5, 'text', '.toast', true],
  // ---- rendered by design.css, not in the guide's table ----
  ['text-2 on surface-2 (.chip default, .seg idle)', 'var(--text-2)', 'var(--surface-2)', 4.5, 'text', 'design.css:509, 466', false],
  ['muted on surface-2 (muted text in a .well / .seg)', 'var(--muted)', 'var(--surface-2)', 4.5, 'text', 'design.css:405 + .muted', false],
  ['muted on hover (a muted line in a pressed row)', 'var(--muted)', 'var(--hover)', 4.5, 'text', 'design.css:484', false],
  ['muted on glass-strong over bg (.tab idle label, 12 px)', 'var(--muted)', 'var(--glass-strong) over var(--bg)', 4.5, 'text', 'design.css:560, 398', false],
  ['muted-decor on surface (input placeholder)', 'var(--muted-decor)', 'var(--surface)', 4.5, 'text', 'design.css:445', false],
  ['on-accent on the top stop of .btn-primary', 'var(--on-accent)', 'color-mix(in srgb, var(--accent-deep) 88%, white)', 4.5, 'text', 'design.css:361', false],
  ['#fff on --danger (.badge, 12 px bold)', '#ffffff', 'var(--danger)', 4.5, 'text', 'design.css:516', false],
  ['toast text on 90% text over bg', 'var(--bg)', 'color-mix(in srgb, var(--text) 90%, transparent) over var(--bg)', 4.5, 'text', 'design.css:589', false],
  ['on-accent on --olive (an app pairing a hue mid-tone with --on-accent, e.g. Verses Got it)', 'var(--on-accent)', 'var(--olive)', 4.5, 'text', 'apps/verses.html:59', false],
  ['on-accent on --gold', 'var(--on-accent)', 'var(--gold)', 4.5, 'text', 'no --on-gold token', false],
  ['on-accent on --teal', 'var(--on-accent)', 'var(--teal)', 4.5, 'text', 'no --on-teal token', false],
  ['on-accent on --terra', 'var(--on-accent)', 'var(--terra)', 4.5, 'text', 'no --on-terra token', false],
  ['gold as large text on bg (e.g. a stat numeral)', 'var(--gold)', 'var(--bg)', 3, 'large', 'Dollywood .stat b (--ochre = --gold)', false],
  // non-text (3:1)
  ['--line track vs surface (.switch off)', 'var(--line)', 'var(--surface)', 3, 'nontext', 'design.css:456', false],
  ['--ok track vs surface (.switch on)', 'var(--ok)', 'var(--surface)', 3, 'nontext', 'design.css:460', false],
  ['#fff knob vs --ok track', '#ffffff', 'var(--ok)', 3, 'nontext', 'design.css:459-460', false],
  ['--muted-decor dot vs surface (.dot / .dot-offline)', 'var(--muted-decor)', 'var(--surface)', 3, 'nontext', 'design.css:519-521', false],
  ['--warn dot vs surface (.dot-pending)', 'var(--warn)', 'var(--surface)', 3, 'nontext', 'design.css:520', false],
  ['surface-2 bar track vs surface (.bar)', 'var(--surface-2)', 'var(--surface)', 3, 'nontext', 'design.css:533', false],
  ['#7D6F62 select chevron vs surface', '#7D6F62', 'var(--surface)', 3, 'nontext', 'design.css:449', false],
  ['surface-2 skeleton vs surface', 'var(--surface-2)', 'var(--surface)', 3, 'nontext', 'design.css:540 (P2: invisible in dark)', false],
];
const PER = [
  ['on-accent on accent-deep (.btn-primary)', 'var(--on-accent)', 'var(--accent-deep)', 4.5, 'text', 'design.css:361', true],
  ['accent-deep on accent-soft (.btn-soft/.chip-accent/.tab.on)', 'var(--accent-deep)', 'var(--accent-soft)', 4.5, 'text', 'design.css:362, 510, 564', true],
  ['accent-deep on surface (.accent text)', 'var(--accent-deep)', 'var(--surface)', 4.5, 'text', 'design.css:334', true],
  ['person-chip text on its fill', 'color-mix(in srgb, var(--tint) 70%, var(--text))', 'color-mix(in srgb, var(--tint) 14%, var(--surface))', 4.5, 'text', 'design.css:500-501', false],
  ['accent-deep on accent-tint (.hero-soft kicker, .btn-soft:hover)', 'var(--accent-deep)', 'var(--accent-tint)', 4.5, 'text', 'design.css:424-426, 375', false],
  ['--tint ring vs surface (.ring .fg, .avatar ring, .app-icon glyph)', 'var(--tint)', 'var(--surface)', 3, 'nontext', 'design.css:494, 528, 608', false],
  ['--tint glyph on .app-icon tile (22% tint)', 'var(--tint)', 'color-mix(in srgb, var(--tint) 22%, var(--surface))', 3, 'nontext', 'design.css:607-608', false],
  ['--focus ring (accent 38%) over surface vs surface', 'color-mix(in srgb, var(--accent) 38%, transparent) over var(--surface)', 'var(--surface)', 3, 'nontext', 'design.css:102, 314', false],
  ['accent-soft tab indicator vs glass-strong over bg', 'var(--accent-soft)', 'var(--glass-strong) over var(--bg)', 3, 'nontext', 'design.css:566-567 (selection shown by fill only?)', false],
];

const css = fs.readFileSync(path.join(ROOT, 'apps', 'design.css'), 'utf8');
const pw = playwright(); const browser = await pw.webkit.launch({ headless: true });
const rows = [];
try {
  for (const s of SCEN) {
    const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, colorScheme: s.os });
    const page = await ctx.newPage();
    await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body class="ds"><div id="p"></div></body></html>`);
    const resolve = (exprs, accent) => page.evaluate(({ exprs, theme, accent }) => {
      const root = document.documentElement; if (theme) root.dataset.theme = theme; else delete root.dataset.theme;
      if (accent) root.style.setProperty('--accent', accent); else root.style.removeProperty('--accent');
      const p = document.getElementById('p'); if (accent) p.style.setProperty('--tint', accent); else p.style.removeProperty('--tint');
      const toRgba = v => { const m = v.match(/-?[\d.]+(?:e-?\d+)?/g); if (!m) return null; const n = m.map(Number); if (/^color\(/.test(v)) return [n[0] * 255, n[1] * 255, n[2] * 255, n.length > 3 ? n[3] : 1]; return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1]; };
      return exprs.map(e => { p.style.color = ''; p.style.color = e; return toRgba(getComputedStyle(p).color); });
    }, { exprs, theme: s.theme, accent });
    const col = a => a && { r: a[0], g: a[1], b: a[2], a: a[3] };
    const evalPair = async (pair, accent) => {
      const [name, fg, bg, min, kind, where, checked] = pair;
      const parts = e => e.split(' over ');
      const all = [...parts(fg), ...parts(bg)];
      const got = (await resolve(all, accent)).map(col);
      const nf = parts(fg).length; const fgc = got.slice(0, nf), bgc = got.slice(nf);
      const flat = arr => arr.reduceRight((acc, c) => acc ? over(c, acc) : (c.a < 1 ? over(c, { r: 255, g: 255, b: 255, a: 1 }) : c), null);
      const B = flat(bgc); const F = fgc.length > 1 ? flat(fgc) : over(fgc[0], B);
      const r = contrast(F, B);
      rows.push({ scenario: s.id, pair: name, accent: accent ? Object.keys(SWATCH).find(k => SWATCH[k] === accent) : null, fg: hex(F), bg: hex(B), ratio: r, min, kind, pass: r >= min, where, checkedByGuide: checked && (!accent || GUIDE8.includes(Object.keys(SWATCH).find(k => SWATCH[k] === accent))) });
    };
    for (const pr of N) await evalPair(pr, null);
    for (const acc of Object.values(SWATCH)) for (const pr of PER) await evalPair(pr, acc);
    await ctx.close();
  }
} finally { await browser.close(); }
const fails = rows.filter(r => !r.pass);
const byPair = {};
for (const r of rows) { const k = r.pair; const b = (byPair[k] ||= { pair: k, kind: r.kind, min: r.min, where: r.where, checkedByGuide: r.checkedByGuide, cases: 0, fails: 0, min_ratio: 99, worst: null, failingScenarios: new Set() }); b.cases++; if (!r.pass) { b.fails++; b.failingScenarios.add(r.scenario + (r.accent ? ':' + r.accent : '')); } if (r.ratio < b.min_ratio) { b.min_ratio = r.ratio; b.worst = `${r.scenario}${r.accent ? ' ' + r.accent : ''} ${r.fg} on ${r.bg}`; } if (r.checkedByGuide) b.checkedByGuide = true; }
const table = Object.values(byPair).map(b => ({ ...b, failingScenarios: [...b.failingScenarios] }));
const guideRows = rows.filter(r => r.checkedByGuide && r.scenario !== 'hearth-on-dark-os');
fs.writeFileSync(path.join(OUT, 'token-pairs.json'), JSON.stringify({ engine: 'webkit', swatches: SWATCH, guideChecksFamily: GUIDE8, scenarios: SCEN.map(s => s.id), summary: { cases: rows.length, fails: fails.length, guideCheckedCases: guideRows.length, guideCheckedFails: guideRows.filter(r => !r.pass).length, uncheckedCases: rows.filter(r => !r.checkedByGuide).length, uncheckedFails: rows.filter(r => !r.checkedByGuide && !r.pass).length }, byPair: table, rows }, null, 1));
console.log('cases', rows.length, 'fails', fails.length, 'guide-checked fails (5 themes, 8 colours)', guideRows.filter(r => !r.pass).length, '/', guideRows.length);
for (const b of table) console.log(`${b.fails ? 'FAIL' : ' ok '} ${String(b.min_ratio).padStart(5)} min ${b.min} ${b.checkedByGuide ? 'G' : '-'} ${b.pair} | ${b.fails}/${b.cases} | worst ${b.worst} | ${b.failingScenarios.slice(0, 8).join(',')}`.slice(0, 330));
