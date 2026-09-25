// Phase 4 SHAPE — cross-area spacing / margins / radii / concentric / shadows / targets from the rig's raw v2 files.
// Unlike aggregate.mjs (which pools the shell page and the app frame of an app job), this reads ONLY the area's own
// document: `frame:<app>` for app areas, `page` for shell and tv. Read-only over audits/evidence/p4/measure/raw.
//   node audits/tools/phase4/SHAPE/analyze.mjs  → audits/evidence/p4/SHAPE/analyze.json (+ prints tables)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const RAW = path.join(ROOT, 'audits/evidence/p4/measure/raw');
const OUT = path.join(ROOT, 'audits/evidence/p4/SHAPE/analyze.json');
const SP = new Set([4, 8, 12, 16, 20, 24, 32, 40, 48, 64]);
const RAD = { adult: [12, 16, 22, 28, 36], kid: [16, 22, 28, 36, 44], kiosk: [12, 16, 22, 28, 36] };

// ── box-shadow parsing ──
function splitTop(s) { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; }
function colorOf(t) {
  const m = t.match(/rgba?\([^)]*\)/); if (m) { const n = m[0].match(/[\d.]+/g).map(Number); return [n[0], n[1], n[2], n[3] == null ? 1 : n[3]]; }
  const h = t.match(/#([0-9a-f]{3,8})\b/i); if (h) { let x = h[1]; if (x.length === 3) x = [...x].map(c => c + c).join(''); return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16), x.length === 8 ? parseInt(x.slice(6, 8), 16) / 255 : 1]; }
  const cs = t.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/); if (cs) return [cs[1] * 255, cs[2] * 255, cs[3] * 255, cs[4] == null ? 1 : +cs[4]];
  if (/\bwhite\b/.test(t)) return [255, 255, 255, 1]; if (/\bblack\b/.test(t)) return [0, 0, 0, 1];
  return null;
}
function layer(t) {
  const inset = /\binset\b/.test(t); const c = colorOf(t);
  const rest = t.replace(/rgba?\([^)]*\)/, '').replace(/color\([^)]*\)/, '').replace(/#[0-9a-f]{3,8}\b/i, '').replace(/\binset\b/, '').replace(/\b(white|black)\b/, '');
  const n = (rest.match(/-?[\d.]+(px)?/g) || []).map(v => parseFloat(v)); while (n.length < 4) n.push(0);
  return { inset, x: n[0], y: n[1], blur: n[2], spread: n[3], c };
}
const same = (a, b) => a.inset === b.inset && a.x === b.x && a.y === b.y && a.blur === b.blur && a.spread === b.spread && a.c && b.c && a.c.slice(0, 3).every((v, i) => Math.abs(v - b.c[i]) < 2) && Math.abs(a.c[3] - b.c[3]) < 0.011;
function parse(s) { if (!s || s === 'none') return []; return splitTop(s).map(layer); }
function classify(shadow, levels) {
  // remove every token's layers wherever they sit (a contiguous run), longest token first; what is left is literal
  let L = parse(shadow); const used = [];
  const order = Object.entries(levels).filter(([, l]) => l.length).sort((a, b) => b[1].length - a[1].length);
  for (const [n, t] of order) { for (let i = 0; i + t.length <= L.length; i++) { if (t.every((l, k) => same(L[i + k], l))) { used.push(n); L.splice(i, t.length); break; } } }
  // --glow-accent (0 8px 24px -8px accent@35%) and --focus (0 0 0 3px accent@38%) carry the person's colour: matched by geometry
  L = L.filter(l => { if (!l.inset && l.x === 0 && l.y === 8 && l.blur === 24 && l.spread === -8) { used.push('glow'); return false; } if (!l.inset && !l.x && !l.y && !l.blur && l.spread === 3 && l.c && l.c[3] > 0.3 && l.c[3] < 0.45) { used.push('focus'); return false; } return true; });
  const inset = L.filter(l => l.inset).length; const rings = L.filter(l => !l.inset && !l.x && !l.y && !l.blur && l.spread > 0).length;
  const lit = L.filter(l => !l.inset && !(!l.x && !l.y && !l.blur && l.spread > 0));
  const alias = { 'local--shadow': 'e2', 'local--shadow-lg': 'e3', 'local--lift': 'lift(=e2)', 'local--lift-lg': 'lift-lg(=e3)', 'local--lv-glass-shadow': 'lv-glass-shadow' };
  const names = [...new Set(used.map(n => alias[n] || n))];
  const elev = names.filter(n => /^e[1-4]$|lift|lv-glass/.test(n));
  let cls = elev.length ? elev.join('+') : (lit.length ? 'literal' : (names.includes('glow') ? 'glow' : names.includes('focus') ? 'focus' : rings ? 'ring-only' : inset ? 'inset-only' : 'none'));
  if (elev.length && lit.length) cls += '+literal';
  return { cls, names, insets: inset, rings, literal: lit.map(l => `${l.x} ${l.y} ${l.blur} ${l.spread}`) };
}

const areasDoc = a => (a === 'shell' || a === 'tv') ? 'page' : 'frame:' + a;
const A = {};
const get = a => A[a] ||= { jobs: 0, spacing: {}, margins: {}, radii: { adult: {}, kid: {}, kiosk: {} }, radiiL: { adult: {}, kid: {}, kiosk: {} }, radiiSel: {}, conc: {}, concChecked: 0, shadows: {}, shadowSel: {}, targets: { adult: {}, kid: {}, kiosk: {} }, targetsMeasured: { adult: 0, kid: 0, kiosk: 0 }, span: {} };

let files = 0;
for (const run of ['themes', 'devices', 'states']) {
  const rd = path.join(RAW, run); if (!fs.existsSync(rd)) continue;
  for (const area of fs.readdirSync(rd)) {
    for (const f of fs.readdirSync(path.join(rd, area))) {
      if (!f.endsWith('.json')) continue;
      let j; try { j = JSON.parse(fs.readFileSync(path.join(rd, area, f), 'utf8')); } catch { continue; }
      if (j.v !== 2 || !j.ok) continue; files++;
      const want = areasDoc(area);
      const d = (j.docs || []).find(x => x.name === want);
      if (!d) continue;
      if (d.name !== 'page' && d.offset && d.offset.visible === false) continue;
      const S = get(area); S.jobs++;
      const id = `${run}/${area}/${f.replace(/\.json$/, '')}`;
      const kind = (d.meta && d.meta.kind) || 'adult';
      const b = d.boxes || {};
      // spacing
      for (const s of b.spacing || []) { const p = s.prop.replace(/-(top|right|bottom|left)$/, ''); const k = p + '|' + s.v; const o = S.spacing[k] ||= { prop: p, v: s.v, n: 0, ex: [] }; o.n += s.n; for (const e of s.ex) if (o.ex.length < 4 && !o.ex.includes(e)) o.ex.push(e); }
      // margins and content span per device (only for jobs where the margin was found)
      if (d.margins && d.margins.left != null) {
        const M = S.margins[j.device] ||= { vw: d.margins.vw, left: [], right: [], ex: [] };
        M.left.push(d.margins.left); M.right.push(d.margins.right); if (M.ex.length < 6) M.ex.push(`${d.margins.left}/${d.margins.right} ${j.screen}-${j.state}-${j.mode}-${j.theme} (${d.margins.leftSel} … ${d.margins.rightSel})`);
      }
      // radii
      for (const r of b.radii || []) {
        if (r.pill) continue; const v = Array.isArray(r.r) ? r.r.join('/') : String(r.r);
        S.radii[kind][v] = (S.radii[kind][v] || 0) + r.n; if (Math.min(r.w, r.h) >= 32) S.radiiL[kind][v] = (S.radiiL[kind][v] || 0) + r.n;
        const o = S.radiiSel[v] ||= { n: 0, sels: [] }; o.n += r.n; if (o.sels.length < 6 && !o.sels.includes(r.sel)) o.sels.push(r.sel);
      }
      for (const c of b.concentric || []) {
        S.concChecked++;
        const k = c.outer + '|' + c.inner; const o = S.conc[k] ||= { outer: c.outer, R: c.R, inner: c.inner, r: c.r, inset: c.inset, want: c.want, off: c.off, ok: c.ok, n: 0, kinds: [], devices: [], jobs: [] };
        o.n++; if (!o.kinds.includes(kind)) o.kinds.push(kind); if (!o.devices.includes(j.device)) o.devices.push(j.device); if (o.jobs.length < 3) o.jobs.push(id);
      }
      // shadows: classify against this document's resolved e-levels (+ local lift tokens)
      const tk = (d.tokens && d.tokens.design) || {}, loc = (d.tokens && d.tokens.local) || {};
      const levels = {}; for (const n of ['--e1', '--e2', '--e3', '--e4']) if (tk[n]) levels[n.slice(2)] = parse(tk[n].raw);
      for (const n of ['--lift', '--lift-lg', '--lv-glass-shadow', '--shadow', '--shadow-lg']) if (loc[n]) levels['local' + n] = parse(loc[n].raw);
      for (const s of b.shadows || []) {
        const c = classify(s.v, levels);
        const key = c.cls; const o = S.shadows[key] ||= { n: 0, distinct: new Set(), sels: [] }; o.n += s.n; o.distinct.add(s.v); for (const e of s.ex) if (o.sels.length < 8 && !o.sels.includes(e)) o.sels.push(e);
        if (c.literal.length) { const q = S.shadowSel[s.v] ||= { v: s.v, geometry: c.literal.join(', '), tokens: c.names.join('+'), n: 0, sels: [], themes: [] }; q.n += s.n; for (const e of s.ex) if (q.sels.length < 4 && !q.sels.includes(e)) q.sels.push(e); if (!q.themes.includes(j.theme + '-' + j.mode)) q.themes.push(j.theme + '-' + j.mode); }
      }
      // targets
      const pageFrameVisible = true;
      for (const t of d.targets || []) {
        if (t.disabled) continue; if (t.visible === false && t.onscreen) continue; if (!t.onscreen) continue;
        S.targetsMeasured[kind]++;
        const lim = kind === 'kid' ? 64 : 44; const m = Math.min(t.effW, t.effH);
        if (m >= lim) continue;
        const o = S.targets[kind][t.sel] ||= { sel: t.sel, tag: t.tag, label: t.label, minW: t.effW, minH: t.effH, inline: t.inline, under44: false, n: 0, devices: [], jobs: [] };
        o.n++; o.minW = Math.min(o.minW, t.effW); o.minH = Math.min(o.minH, t.effH); if (m < 44) o.under44 = true; if (!o.devices.includes(j.device)) o.devices.push(j.device); if (o.jobs.length < 3) o.jobs.push(id);
      }
    }
  }
}

// ── summarise ──
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const out = { note: 'Area-own document only (frame:<app> for apps; page for shell/tv). spacing: occurrences (padding/margin/gap, non-zero) — share on 4 px grid, 8 px grid, and exactly on the --sp-* token set {4,8,12,16,20,24,32,40,48,64}; macro = values >= 8 px. margins: per device min/median/max of left and right; span = vw - left - right (median). radii: non-pill painted radii occurrences per profile kind, share on the kind\'s --r-* set. concentric: every child/parent corner pair the rig checked; bad = |r - want| > max(3, 25% R). shadows: computed box-shadows classified by their outer drop layers against this document\'s resolved --e1..--e4 (and local lift tokens): eN = exactly the token (glass insets and 0-blur rings allowed on top), eN+literal = token plus extra drop layers, literal = no token, ring-only / inset-only. targets: on-screen, not covered, enabled; adults/kiosk < 44, kids < 64 (the kid --tap).', files, areas: {} };
for (const [a, S] of Object.entries(A).sort()) {
  const sp = Object.values(S.spacing); const tot = sp.reduce((x, o) => x + o.n, 0);
  const share = f => tot ? +(sp.filter(o => f(Math.abs(o.v))).reduce((x, o) => x + o.n, 0) / tot).toFixed(3) : null;
  const macro = sp.filter(o => Math.abs(o.v) >= 8); const mt = macro.reduce((x, o) => x + o.n, 0);
  const mshare = f => mt ? +(macro.filter(o => f(Math.abs(o.v))).reduce((x, o) => x + o.n, 0) / mt).toFixed(3) : null;
  const offGrid = sp.filter(o => Math.abs(o.v) % 4 !== 0).sort((x, y) => y.n - x.n).slice(0, 12).map(o => ({ prop: o.prop, v: o.v, n: o.n, ex: o.ex }));
  const byProp = {}; for (const o of sp) { const p = byProp[o.prop] ||= { n: 0, on4: 0, tok: 0 }; p.n += o.n; if (Math.abs(o.v) % 4 === 0) p.on4 += o.n; if (SP.has(Math.abs(o.v))) p.tok += o.n; }
  for (const p of Object.values(byProp)) { p.on4 = +(p.on4 / p.n).toFixed(3); p.tok = +(p.tok / p.n).toFixed(3); }
  const distinct = [...new Set(sp.map(o => Math.abs(o.v)))].sort((x, y) => x - y);
  const margins = {}; for (const [dev, M] of Object.entries(S.margins)) margins[dev] = { vw: M.vw, jobs: M.left.length, left: [Math.min(...M.left), med(M.left), Math.max(...M.left)], right: [Math.min(...M.right), med(M.right), Math.max(...M.right)], span: +(M.vw - med(M.left) - med(M.right)).toFixed(1), ex: M.ex };
  const radii = {}; for (const kind of ['adult', 'kid', 'kiosk']) { const R = S.radii[kind]; const t = Object.values(R).reduce((x, y) => x + y, 0); if (!t) continue; const on = Object.entries(R).filter(([v]) => RAD[kind].includes(+v)).reduce((x, [, n]) => x + n, 0); const RL = S.radiiL[kind]; const tl = Object.values(RL).reduce((x, y) => x + y, 0); const onl = Object.entries(RL).filter(([v]) => RAD[kind].includes(+v)).reduce((x, [, n]) => x + n, 0); radii[kind] = { occurrences: t, onToken: +(on / t).toFixed(3), largeOccurrences: tl, largeOnToken: tl ? +(onl / tl).toFixed(3) : null, largeValues: Object.fromEntries(Object.entries(RL).sort((x, y) => parseFloat(x[0]) - parseFloat(y[0]))), values: Object.fromEntries(Object.entries(R).sort((x, y) => parseFloat(x[0]) - parseFloat(y[0]))) }; }
  const radiiSel = Object.fromEntries(Object.entries(S.radiiSel).sort((x, y) => parseFloat(x[0]) - parseFloat(y[0])).map(([v, o]) => [v, o]));
  const conc = Object.values(S.conc); const bad = conc.filter(c => !c.ok).sort((x, y) => y.n - x.n);
  const shadows = {}; for (const [k, o] of Object.entries(S.shadows)) shadows[k] = { n: o.n, distinct: o.distinct.size, sels: o.sels };
  const literal = Object.values(S.shadowSel).sort((x, y) => y.n - x.n).slice(0, 25);
  const tg = {}; for (const kind of ['adult', 'kid', 'kiosk']) { const v = Object.values(S.targets[kind]).sort((x, y) => Math.min(x.minW, x.minH) - Math.min(y.minW, y.minH)); if (!S.targetsMeasured[kind]) continue; tg[kind] = { measured: S.targetsMeasured[kind], selectors: v.length, under44: v.filter(x => x.under44 && !x.inline).length, inline: v.filter(x => x.inline).length, occurrences: v.reduce((x, o) => x + o.n, 0), list: v.slice(0, 60) }; }
  out.areas[a] = { jobs: S.jobs, spacing: { occurrences: tot, distinct: distinct.length, distinctValues: distinct, grid4: share(v => v % 4 === 0), grid8: share(v => v % 8 === 0), onSpTokens: share(v => SP.has(v)), macroGrid4: mshare(v => v % 4 === 0), macroOnSpTokens: mshare(v => SP.has(v)), byProp, offGrid }, margins, radii, radiiSel, concentric: { pairsChecked: S.concChecked, distinctPairs: conc.length, bad: bad.length, okPairs: conc.filter(c => c.ok).length, examplesBad: bad.slice(0, 14), examplesOk: conc.filter(c => c.ok).sort((x, y) => y.n - x.n).slice(0, 5) }, shadows, literalShadows: literal, targets: tg };
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
// print a compact view
console.log('files', files);
for (const [a, v] of Object.entries(out.areas)) {
  const s = v.spacing;
  console.log(`\n## ${a} jobs=${v.jobs} spacing occ=${s.occurrences} distinct=${s.distinct} g4=${s.grid4} g8=${s.grid8} sp=${s.onSpTokens} macro g4=${s.macroGrid4} sp=${s.macroOnSpTokens}`);
  console.log('  values', s.distinctValues.join(' '));
  console.log('  offgrid', s.offGrid.slice(0, 6).map(o => `${o.prop}:${o.v}(${o.n}) ${o.ex[0]}`).join(' | '));
  for (const [dev, m] of Object.entries(v.margins)) console.log(`  margin ${dev} vw${m.vw} L${m.left.join('/')} R${m.right.join('/')} span${m.span} n${m.jobs}`);
  for (const [k, r] of Object.entries(v.radii)) console.log(`  radii ${k} occ=${r.occurrences} onToken=${r.onToken} large=${r.largeOccurrences} largeOn=${r.largeOnToken} L[${Object.entries(r.largeValues).map(([x, n]) => x + ':' + n).join(' ')}] ${Object.entries(r.values).map(([x, n]) => x + ':' + n).join(' ')}`);
  console.log(`  conc checked=${v.concentric.pairsChecked} distinct=${v.concentric.distinctPairs} bad=${v.concentric.bad} ok=${v.concentric.okPairs}`);
  for (const c of v.concentric.examplesBad.slice(0, 6)) console.log(`    BAD ${c.outer} R${c.R} > ${c.inner} r${c.r} inset${c.inset} want${c.want} n${c.n} ${c.kinds} ${c.devices}`);
  console.log('  shadows', Object.entries(v.shadows).map(([k, o]) => `${k}:${o.n}/${o.distinct}`).join(' '));
  for (const [k, t] of Object.entries(v.targets)) console.log(`  targets ${k} measured=${t.measured} sel=${t.selectors} under44=${t.under44} inline=${t.inline}: ${t.list.slice(0, 8).map(x => `${x.sel} ${x.minW}x${x.minH}`).join(' | ')}`);
}
