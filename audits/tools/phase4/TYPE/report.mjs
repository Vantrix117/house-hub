// Phase 4 TYPE: prints every cross-area table the TYPE draft cites, from roles.json (roles.mjs) and code-scan.json.
// Usage: node audits/tools/phase4/TYPE/report.mjs [roles.json] [section]
//   sections: ipad | kid | titles | numerals | under11 | scale | tv | tokens   (default: all)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const rf = process.argv[2] && process.argv[2].endsWith('.json') ? process.argv[2] : path.join(ROOT, 'audits/evidence/p4/TYPE/roles.json');
const want = process.argv.find(a => /^(ipad|kid|titles|numerals|under11|scale|tv|tokens)$/.test(a));
const J = JSON.parse(fs.readFileSync(rf, 'utf8'));
const on = s => !want || want === s;
const A = J.areas;
if (on('ipad')) {
  console.log('\n== iPad portrait (820) vs iPhone PWA (430): selectors seen on both, same max size / larger on iPad / smaller');
  for (const [a, X] of Object.entries(A)) {
    let same = 0, big = 0, small = 0; const grown = [];
    for (const [k, v] of Object.entries(X.scale)) { const i = v['iphone-pwa'], p = v['ipad-portrait']; if (!i || !p) continue; const mi = Math.max(...i), mp = Math.max(...p); if (mp > mi) { big++; grown.push(`${k.split('|')[1].split(' > ').pop()} ${mi}→${mp}`); } else if (mp < mi) small++; else same++; }
    console.log(a.padEnd(15), `same ${same} / larger ${big} / smaller ${small}`, grown.length ? ' grown: ' + grown.join('; ') : '');
  }
}
if (on('kid')) {
  console.log('\n== Kid mode: selectors shared with the adult document (max size, any device): larger / same; kid text boxes at <= 12 px; min');
  for (const [a, X] of Object.entries(A)) {
    const ad = {}, kd = {};
    for (const c of X.combos) { if (c.kind !== 'adult' && c.kind !== 'kid') continue; for (const s of c.sels) { const m = c.kind === 'adult' ? ad : kd; m[s] = Math.max(m[s] || 0, c.fs); } }
    const common = Object.keys(kd).filter(s => s in ad); if (!Object.keys(kd).length) { console.log(a.padEnd(15), 'no kid document'); continue; }
    const up = common.filter(s => kd[s] > ad[s]).length, same = common.filter(s => kd[s] === ad[s]);
    const kc = X.combos.filter(c => c.kind === 'kid'), tot = kc.reduce((n, c) => n + c.n, 0), le12 = kc.filter(c => c.fs <= 12).reduce((n, c) => n + c.n, 0);
    const serif = kc.filter(c => /serif|Fraunces/.test(c.ff) && !/sans/.test(c.ff)).map(c => `${c.sels[0].split(' > ').pop()} ${c.fs}/${c.fw} ${c.ff}`);
    console.log(a.padEnd(15), `larger ${up} / same ${same.length} of ${common.length}`, `| <=12 px ${(le12 / tot * 100).toFixed(0)}% of ${tot}`, '| min', Math.min(...kc.map(c => c.fs)), '| same:', same.map(s => s.split(' > ').pop() + '=' + kd[s]).join(', '), serif.length ? '| serif display: ' + serif.join('; ') : '');
  }
}
if (on('titles')) {
  console.log('\n== Text >= 24 px that is not a numeral (titles), by area');
  for (const [a, X] of Object.entries(A)) for (const t of X.titles) console.log(a.padEnd(15), t.kind.padEnd(6), t.sel.slice(-44).padEnd(45), t.ff.padEnd(11), `${t.fs.join('/')}px`, t.fw, 'ls', t.ls.join('/'), JSON.stringify(t.text[0]));
}
if (on('numerals')) {
  console.log('\n== Numerals >= 24 px');
  for (const [a, X] of Object.entries(A)) for (const t of X.numerals) console.log(a.padEnd(15), t.kind.padEnd(6), t.sel.slice(-30).padEnd(31), t.ff.padEnd(11), `${t.fs.join('/')}px`, t.fw, 'ls', t.ls.join('/'), t.fvn, JSON.stringify(t.text));
}
if (on('under11')) {
  console.log('\n== HTML text under 11 px (rig inventory; SVG text and ::before are in hidden-text.json)');
  for (const [a, X] of Object.entries(A)) for (const u of X.under11) console.log(a.padEnd(15), u.kind.padEnd(6), `${u.fs}px/${u.fw}`, u.fullSel.slice(-70), JSON.stringify(u.text), 'boxes', u.n, 'devices', u.devices.join(','));
}
if (on('scale')) {
  const TOK = { adult: [12, 14, 16, 18, 22, 28, 36, 48], kiosk: [12, 18, 22, 26, 32, 40, 56, 84] }, DT = [34, 28, 22, 20, 17, 16, 15, 13, 12, 11];
  console.log('\n== Adult (TV: kiosk) sizes per area: distinct / fractional / on a Dynamic Type size / on a --fs token value; share of text boxes on a token value and on a DT size; weights; declared first families');
  for (const [a, X] of Object.entries(A)) {
    const k = a === 'tv' ? 'kiosk' : 'adult', cs = X.combos.filter(c => c.kind === k), sizes = [...new Set(cs.map(c => c.fs))].sort((x, y) => x - y);
    const tot = cs.reduce((n, c) => n + c.n, 0), tokN = cs.filter(c => TOK[k].includes(c.fs)).reduce((n, c) => n + c.n, 0), dtN = cs.filter(c => DT.includes(c.fs)).reduce((n, c) => n + c.n, 0);
    console.log(a.padEnd(15), `${sizes.length} [${sizes.join(',')}]`, `frac ${sizes.filter(s => s % 1).length}`, `DT ${sizes.filter(s => DT.includes(s)).length}`, `tok ${sizes.filter(s => TOK[k].includes(s)).length}`, `boxes on token ${(tokN / tot * 100).toFixed(0)}%`, `on DT ${(dtN / tot * 100).toFixed(0)}%`, [...new Set(cs.map(c => c.fw))].sort().join('/'), [...new Set(cs.map(c => c.ff))].join('+'));
  }
}
if (on('tv')) {
  // 55" 16:9 1080p panel: 0.634 mm per px; viewed at 3.0 m. iPad 264 ppi at 2x: 0.1924 mm per CSS px, held at 0.40 m.
  const f55 = (0.634 * 400) / (3000 * 0.1924), f65 = (0.75 * 400) / (3000 * 0.1924);
  console.log(`\n== TV board (kiosk, 1920×1080): each text size and the iPad-at-40-cm size that subtends the same angle (55" at 3 m ×${f55.toFixed(3)}; 65" ×${f65.toFixed(3)})`);
  const seen = new Set();
  for (const c of A.tv.combos.filter(c => c.kind === 'kiosk' && c.devices.includes('tv')).sort((x, y) => x.fs - y.fs)) {
    const k = c.fs + '|' + c.sels[0]; if (seen.has(k)) continue; seen.add(k);
    console.log(`${c.fs}px/${c.fw}`.padEnd(12), `≈ iPad ${(c.fs * f55).toFixed(1)}–${(c.fs * f65).toFixed(1)} px`.padEnd(24), c.sels.slice(0, 2).join(' | ').slice(0, 90), JSON.stringify(c.texts[0]));
  }
}
if (on('tokens')) {
  const cs = JSON.parse(fs.readFileSync(path.join(ROOT, 'audits/evidence/p4/TYPE/code-scan.json'), 'utf8'));
  console.log('\n== Declared font sizes per file (code-scan.json): token = var(--fs-*)');
  for (const [f, r] of Object.entries(cs.files)) console.log(f.padEnd(52), JSON.stringify(r.sizeKinds), 'distinct literal sizes', Object.keys(r.sizes).length, 'under 11:', r.under11.map(u => `${u.line}:${u.value}`).join(' '));
}
