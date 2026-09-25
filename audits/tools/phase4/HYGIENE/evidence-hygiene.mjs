// Phase 4 evidence hygiene: which files under audits/evidence/p4 the report cites, their size, and each PNG's pixel size
// (to catch screenshots saved at device scale instead of 1x CSS). No git is used: .gitignore files under
// audits/evidence/p4 are parsed here (plain names, dir/ and simple * globs, relative to the .gitignore's folder).
//
// A file counts as cited when the report names it by path, by basename, by a brace pattern ({a,b}) that expands to it,
// or by a suffix (a token starting with "-" whose expansion ends the basename, when the rest of the basename also
// appears in the report), or by a wildcard / placeholder path (*, <…>, …) that matches it, keeps 12 literal characters
// and 6 in its file name (so a bare `verify-*.png`, `<select>` or a folder ending in … does not count).
// Uncited non-PNG files are reported but never ignored: most are summaries cited through a folder or a wildcard.
//
// Usage: node audits/tools/phase4/HYGIENE/evidence-hygiene.mjs [--write-ignore] [--why <repo path>]
//   --write-ignore  append every uncited PNG to the .gitignore of its dimension folder (audits/evidence/p4/<DIM>/.gitignore)
//   → audits/evidence/p4/HYGIENE/evidence-hygiene.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EVD = path.join(ROOT, 'audits/evidence/p4');
const REPORT = fs.readFileSync(path.join(ROOT, 'audits/04-design-system.md'), 'utf8');
const WRITE = process.argv.includes('--write-ignore');

// ── .gitignore parsing ──
const ignores = [];
(function scan(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) scan(p); else if (e.name === '.gitignore') ignores.push({ dir, pats: fs.readFileSync(p, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#')) }); } })(EVD);
const glob = s => new RegExp('^' + s.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
function ignored(abs) {
  for (const { dir, pats } of ignores) {
    if (!abs.startsWith(dir + path.sep)) continue;
    const rel = path.relative(dir, abs).split(path.sep).join('/');
    for (const p of pats) {
      if (p.endsWith('/')) { const d = p.slice(0, -1).replace(/^\//, ''); if (rel.startsWith(d + '/') || rel.split('/').slice(0, -1).includes(d)) return true; }
      else if (glob(p.replace(/^\//, '')).test(rel) || (!p.includes('/') && glob(p).test(path.basename(rel)))) return true;
    }
  }
  return false;
}
// ── files ──
const files = [];
(function scan(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) scan(p); else if (e.name !== '.gitignore') files.push(p); } })(EVD);
// ── citation tokens ──
const expand = s => { const m = s.match(/\{([^{}]*)\}/); if (!m) return [s]; return m[1].split(',').flatMap(x => expand(s.slice(0, m.index) + x + s.slice(m.index + m[0].length))); };
const raw = new Set();
for (const m of REPORT.matchAll(/`([^`\n]+)`/g)) raw.add(m[1]);
for (const m of REPORT.matchAll(/audits\/evidence\/p4\/[^\s`'"()\[\],;|]+/g)) raw.add(m[0]);
const tokens = new Set();
for (const t of raw) for (const piece of t.split(/\s+|,\s*(?![^{]*\})/)) for (const e of expand(piece.replace(/[.:;]+$/, ''))) if (e) tokens.add(e);
const full = [...tokens].filter(t => !t.startsWith('-'));
const suffixes = [...tokens].filter(t => t.startsWith('-') && /\.\w{2,4}$/.test(t));
const wildTok = full.filter(t => /[*<…]/.test(t) && t.replace(/<[^>]*>|\*|…|\//g, '').length >= 12 && t.split('/').pop().replace(/<[^>]*>|\*|…/g, '').length >= 6);
const wild = wildTok.map(t => new RegExp('(^|/)' + t.replace(/…$/, '*').replace(/<[^>]*>/g, '*').replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'));
const byBase = new Set(full.map(t => t.split('/').pop()));
function cited(rel) {
  const base = path.basename(rel);
  if (REPORT.includes(rel) || byBase.has(base)) return true;
  for (const s of suffixes) if (base.endsWith(s)) { const stem = base.slice(0, -s.length); if (stem.length > 8 && REPORT.includes(stem)) return true; }
  for (const re of wild) if (re.test(rel)) return true;
  return false;
}
const WHY = process.argv[process.argv.indexOf('--why') + 1];
if (process.argv.includes('--why')) {
  const base = path.basename(WHY);
  console.log('path in report', REPORT.includes(WHY), '| basename token', full.filter(t => t.split('/').pop() === base));
  for (const s of suffixes) if (base.endsWith(s)) console.log('suffix', s, 'stem', base.slice(0, -s.length), REPORT.includes(base.slice(0, -s.length)));
  wildTok.forEach((t, i) => { if (wild[i].test(WHY)) console.log('wild', JSON.stringify(t)); });
  process.exit(0);
}
const pngSize = abs => { const b = Buffer.alloc(24); const fd = fs.openSync(abs, 'r'); fs.readSync(fd, b, 0, 24, 0); fs.closeSync(fd); return b.toString('ascii', 12, 16) === 'IHDR' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };
// widths no 1x capture on the rig's devices can have (all device widths are ≤ 1920 CSS px) or that are exact 2x/3x device widths
const HIDPI = new Set([860, 1290, 1640, 2360, 2880, 3840, 1480, 2220]);
const rows = files.map(abs => {
  const rel = path.relative(ROOT, abs).split(path.sep).join('/');
  const st = fs.statSync(abs); const dim = rel.split('/')[3];
  const ig = ignored(abs); const isPng = /\.png$/i.test(abs); const wh = isPng ? pngSize(abs) : null;
  return { rel, dim, bytes: st.size, ignored: ig, cited: cited(rel), png: isPng, w: wh && wh[0], h: wh && wh[1], suspectScale: !!(wh && (wh[0] > 1920 || HIDPI.has(wh[0]))) };
});
const live = rows.filter(r => !r.ignored);
const sum = a => a.reduce((s, r) => s + r.bytes, 0);
const perDim = {};
for (const r of live) { const d = perDim[r.dim] ||= { files: 0, bytes: 0, png: 0, pngCited: 0, pngUncited: 0, otherUncited: 0 }; d.files++; d.bytes += r.bytes; if (r.png) { d.png++; r.cited ? d.pngCited++ : d.pngUncited++; } else if (!r.cited) d.otherUncited++; }
const uncitedPng = live.filter(r => r.png && !r.cited);
const out = {
  at: new Date().toISOString(),
  totals: { files: live.length, bytes: sum(live), mb: +(sum(live) / 1048576).toFixed(1), png: live.filter(r => r.png).length, pngCited: live.filter(r => r.png && r.cited).length, pngUncited: uncitedPng.length, uncitedNonPng: live.filter(r => !r.png && !r.cited).length, ignoredFiles: rows.filter(r => r.ignored).length },
  perDim,
  overOneMb: live.filter(r => r.bytes > 1048576).map(r => ({ rel: r.rel, bytes: r.bytes, cited: r.cited })),
  suspectScale: live.filter(r => r.suspectScale).map(r => ({ rel: r.rel, w: r.w, h: r.h, cited: r.cited })),
  uncitedPng: uncitedPng.map(r => r.rel),
};
if (WRITE) {
  const byDir = {};
  for (const r of uncitedPng) { const dir = path.join(EVD, r.dim); (byDir[dir] ||= []).push(path.relative(dir, path.join(ROOT, r.rel)).split(path.sep).join('/')); }
  for (const [dir, list] of Object.entries(byDir)) {
    const gi = path.join(dir, '.gitignore'); const had = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
    const add = list.filter(x => !had.split(/\r?\n/).includes(x));
    if (add.length) fs.writeFileSync(gi, had + (had && !had.endsWith('\n') ? '\n' : '') + '# Uncited in audits/04-design-system.md (evidence-hygiene.mjs --write-ignore); kept on disk, out of git.\n' + add.join('\n') + '\n');
  }
  out.wroteIgnore = Object.fromEntries(Object.entries(byDir).map(([d, l]) => [path.relative(ROOT, d).split(path.sep).join('/'), l.length]));
}
fs.mkdirSync(path.join(EVD, 'HYGIENE'), { recursive: true });
fs.writeFileSync(path.join(EVD, 'HYGIENE/evidence-hygiene.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.totals), '\nper dimension', JSON.stringify(perDim), '\nover 1 MB', JSON.stringify(out.overOneMb), '\nsuspect scale', JSON.stringify(out.suspectScale));
