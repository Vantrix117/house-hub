// Phase 5 · decision D5 (household answer 2026-09-25): app tiles get their OWN hue families, nine in-between pastels, none shared
// with a person. This derives them from the eight house pastels in proposed-tokens.css:
//   1. The slots. Each family is placed at a position on the circle of the people's LIGHT -fill hues. The nine positions were
//      chosen by a maximin search (`--search` re-runs it). It maximised, in both schemes, the smallest of four ratios:
//      app-vs-app CIEDE2000 on the tile end (-fill-strong) / 8, app-vs-app on -graphic / 10, app-vs-person on -fill-strong / 4
//      and app-vs-person on -graphic / 5.
//   2. The roles. Every role (wash, fill, fill-strong, strong, graphic, ink, ink-hi, on) takes the OKLCH of the two neighbouring
//      people's same role, interpolated at that position (L, C and H, with H unwrapped). So each app family inherits the
//      house's lightness and chroma ladder.
//   3. The gate rules. Each role's lightness is nudged, at constant hue and chroma (clamped to the sRGB gamut), until it meets
//      the rules contrast.mjs applies to a person family, in every palette of its scheme, with a +0.03 margin.
// Output: the CSS lines to paste into proposed-tokens.css §2 and a report
// (audits/evidence/p5/app-hues.json: every family's hexes, its contrast minima and the distance tables).
//   node audits/tools/phase5/app-hues.mjs [--search] [--css]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseColour, over, contrast, oklch, fromOklch, de2000, simulate, hex } from '../phase4/tokens/colour-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const TOKENS = path.join(ROOT, 'audits', 'tools', 'phase4', 'tokens', 'proposed-tokens.css');
const OUT = path.join(ROOT, 'audits', 'evidence', 'p5', 'app-hues.json');
const css = fs.readFileSync(TOKENS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const PEOPLE = ['bubblegum', 'peach', 'butter', 'mint', 'aqua', 'sky', 'periwinkle', 'lavender'];
const ROLES = ['wash', 'fill', 'fill-strong', 'strong', 'graphic', 'ink', 'ink-hi', 'on'];
// the nine app families: name, slot (a position on the people's light -fill hue circle, degrees), the app, its colour today
export const APP_HUES = [
  ['coral', 13.6, 'timer', '#B8623A'],
  ['apricot', 45.7, 'prayer', '#8A6A4B'],
  ['honey', 73.1, 'kidverse', '#B4861B'],
  ['pistachio', 119.1, 'verses', '#5B8143'],
  ['leaf', 142.9, 'leftovers', '#3D5A3D'],
  ['seafoam', 177.0, 'tally', '#4C7B6A'],
  ['lagoon', 214.5, 'dollywood-live', '#1F6FB2'],
  ['cornflower', 264.5, 'f260', '#4F5D8C'],
  ['orchid', 333.9, 'dollywood', '#7A4FA3'],
];

// ── read the house families and the neutral grounds from the token file ─────────────────────────────────────
const hueBlock = sel => { const i = css.indexOf(sel); const b = css.indexOf('{', i), e = css.indexOf('}', b); return css.slice(b + 1, e); };
const LIGHT_BODY = hueBlock(':root, [data-scheme="light"], :root[data-theme="hearth"]');
const DARK_BODY = hueBlock('[data-scheme="dark"], :root[data-theme="midnight"]');
const famOf = body => Object.fromEntries(PEOPLE.map(f => [f, Object.fromEntries(ROLES.map(r => [r, parseColour(body.match(new RegExp(`--${f}-${r}: (#[0-9A-Fa-f]{6})`))[1])]))]));
const FAM = { light: famOf(LIGHT_BODY), dark: famOf(DARK_BODY) };
const neutral = sel => {
  const body = hueBlock(sel), g = n => { const m = body.match(new RegExp(`--${n}: (#[0-9A-Fa-f]{6}|rgba?\\([^)]*\\))`)); return m ? parseColour(m[1]) : null; };
  return { bg: g('bg'), surface: g('surface'), 'surface-2': g('surface-2'), 'surface-raised': g('surface-raised'), 'fill-field': g('fill-field'), hover: g('hover'),
    text: g('text'), 'text-2': g('text-2'), 'text-3': g('text-3'), 'text-2-hi': g('text-2-hi'), spec: g('glass-spec'),
    alphaStrong: +body.match(/--glass-alpha-strong: (\d+)%/)[1] / 100 };
};
const PAL = {
  light: { hearth: neutral(':root, :root[data-theme="hearth"]'), parchment: neutral(':root[data-theme="parchment"], [data-theme-preview="parchment"]'), frost: neutral(':root[data-theme="frost"], [data-theme-preview="frost"]') },
  dark: { midnight: neutral(':root[data-theme="midnight"], :root[data-theme="dark"], [data-theme-preview="midnight"]'), forest: neutral(':root[data-theme="forest"], [data-theme-preview="forest"]'), graphite: neutral(':root[data-theme="graphite"], [data-theme-preview="graphite"]') },
};
const OPAQUE = ['bg', 'surface', 'surface-2', 'surface-raised', 'fill-field', 'hover'];
const MID = parseColour('#767676');
// the grounds a tab label and an identity mark sit on in a bar: --glass-strong over #767676, with and without the full sheen
const barGrounds = p => { const gs = over({ ...p.surface, a: p.alphaStrong }, MID); return [gs, over(p.spec, gs)]; };

// ── interpolation on the people's circle ────────────────────────────────────────────────────────────────────
const ORDER = [...PEOPLE].sort((a, b) => oklch(FAM.light[a].fill).H - oklch(FAM.light[b].fill).H);
const BASE = ORDER.map(f => oklch(FAM.light[f].fill).H);
function neighbours(pos) {
  for (let k = 0; k < ORDER.length; k++) {
    const a = BASE[k], b = BASE[(k + 1) % ORDER.length] + (k + 1 === ORDER.length ? 360 : 0);
    const p = pos < a && k + 1 === ORDER.length ? pos + 360 : pos;
    if (p >= a && p < b) return { a: ORDER[k], b: ORDER[(k + 1) % ORDER.length], t: (p - a) / (b - a) };
  }
  const last = ORDER.length - 1; const a = BASE[last], b = BASE[0] + 360; const p = pos + 360;
  return { a: ORDER[last], b: ORDER[0], t: (p - a) / (b - a) };
}
function interp(scheme, pos, role) {
  const { a, b, t } = neighbours(pos);
  const A = oklch(FAM[scheme][a][role]), B = oklch(FAM[scheme][b][role]);
  let dH = B.H - A.H; if (dH > 180) dH -= 360; if (dH < -180) dH += 360;
  return { L: A.L + (B.L - A.L) * t, C: A.C + (B.C - A.C) * t, H: (A.H + dH * t + 360) % 360 };
}
// quantised to the 8-bit hex the token file stores, so every distance and ratio here is the shipped one (verify-rev6 round 2 found a
// status distance that held on the float and failed on the hex)
const q8 = v => Math.round(v * 255) / 255;
const rgb = o => { const c = fromOklch(o.L, o.C, o.H); return { r: q8(c.r), g: q8(c.g), b: q8(c.b), a: 1 }; };

// ── the rules contrast.mjs applies to a person family (thresholds + margin) ───────────────────────────────────
const M = 0.03;
function rules(scheme, f) {
  const pals = Object.values(PAL[scheme]);
  const out = [];
  const add = (role, name, fg, bg, thr) => out.push({ role, name, v: contrast(fg, bg), thr });
  for (const p of pals) {
    for (const fg of ['text-2', 'text-3']) add('wash', `${fg}/wash`, p[fg], f.wash, 4.5);
    add('wash', 'text-2-hi/wash (7:1 modes)', p['text-2-hi'], f.wash, 7);
    for (const s of OPAQUE) {
      add('ink', `ink/${s}`, f.ink, p[s], 4.5); add('ink-hi', `ink-hi/${s}`, f['ink-hi'], p[s], 7);
      add('graphic', `graphic/${s}`, f.graphic, p[s], 3);
      add('strong', `strong/${s}`, f.strong, p[s], scheme === 'dark' ? 7 : 4.5);      // dark: the pastel solid is not swapped in the 7:1 modes
    }
    for (const g of barGrounds(p)) { add('ink', 'ink/bar ground', f.ink, g, 4.5); add('ink-hi', 'ink-hi/bar ground (7:1 modes)', f['ink-hi'], g, 7); add('graphic', 'graphic/bar ground', f.graphic, g, 3); }
    if (scheme === 'dark') add('fill', 'fill off surface (dark chip)', f.fill, p.surface, 1.5);
  }
  for (const bg of ['wash', 'fill']) { add('ink', `ink/${bg}`, f.ink, f[bg], 4.5); add('ink-hi', `ink-hi/${bg}`, f['ink-hi'], f[bg], 7); }
  add('ink', 'ink/fill-strong (tile glyph)', f.ink, f['fill-strong'], 3);
  add('strong', 'strong/fill (progress)', f.strong, f.fill, 3);
  add('on', 'on/strong', f.on, f.strong, scheme === 'dark' ? 7 : 4.5);
  if (scheme === 'light') add('ink-hi', 'on/ink-hi (the 7:1 solid in light)', f.on, f['ink-hi'], 7);
  return out;
}
const chromaOk = (scheme, f) => oklch(f.fill).C >= (scheme === 'light' ? 0.055 : 0.05) + 0.002 && oklch(f.strong).C >= 0.092;

// which way lightness moves to fix a role: +1 lighter, -1 darker
const DIR = { light: { wash: +1, fill: +1, 'fill-strong': +1, strong: -1, graphic: -1, ink: -1, 'ink-hi': -1, on: +1 },
  dark: { wash: -1, fill: +1, 'fill-strong': +1, strong: +1, graphic: +1, ink: +1, 'ink-hi': +1, on: -1 } };

function build(scheme, pos, others = {}) {
  // distinctness kept while moving a role: vs every person (and, from the second pass, every other app) at the gate's floors + 0.3
  // revision 6d (verify-rev6 round 3, issue 1): EVERY role is kept off every person, at the person floor of that role and scheme
  // (PERSON_FLOOR: half the people's own closest spacing, never under the tile-end 4 / mark 5); the tile end and mark also off every app
  const distinct = (r, c) => { const pf = PERSON_FLOOR[scheme][r], d = DIST[r];
    return PEOPLE.every(p => de2000(c, FAM[scheme][p][r]) >= pf + 0.3) && (!d || Object.values(others).every(o2 => de2000(c, o2[scheme][r]) >= d.app + 0.3)); };
  const o = Object.fromEntries(ROLES.map(r => [r, interp(scheme, pos, r)]));
  if (scheme === 'light') o.on = { L: 1, C: 0, H: 0 };                  // white, as every light person family
  const f = () => Object.fromEntries(ROLES.map(r => [r, rgb(o[r])]));
  const nudges = Object.fromEntries(ROLES.map(r => [r, 0]));
  const hueShift = Object.fromEntries(ROLES.map(r => [r, 0]));
  const nudge = () => { for (let it = 0; it < 400; it++) {
    const fam = f();
    const bad = rules(scheme, fam).filter(x => x.v < x.thr + M);
    if (!bad.length) break;
    const role = bad[0].role;
    o[role].L = Math.min(0.995, Math.max(0.12, o[role].L + DIR[scheme][role] * 0.002)); nudges[role]++;
  } };
  nudge();
  // chroma floors (the gate's chroma checks, + margin). Where the sRGB gamut cannot give that chroma at this lightness and hue (a
  // teal solid at L 0.49 tops out near 0.085), the hue steps 1° at a time towards the neighbour whose same role holds more chroma.
  const { a, b } = neighbours(pos);
  for (const r of ['fill', 'strong']) {
    const floor = r === 'fill' ? (scheme === 'light' ? 0.058 : 0.053) : 0.095;
    o[r].C = Math.max(o[r].C, floor + 0.004);
    // a light pastel fill first gives up a little lightness (the gamut narrows towards white), never its hue
    if (r === 'fill') for (let k = 0; k < 20 && oklch(rgb(o[r])).C < floor; k++) o[r].L += scheme === 'light' ? -0.002 : 0.002;
    const towards = oklch(FAM[scheme][a][r]).C >= oklch(FAM[scheme][b][r]).C ? oklch(FAM[scheme][a][r]).H : oklch(FAM[scheme][b][r]).H;
    for (let k = 0; k < 40 && oklch(rgb(o[r])).C < floor; k++) {
      let d = towards - o[r].H; if (d > 180) d -= 360; if (d < -180) d += 360;
      o[r].H = (o[r].H + Math.sign(d) + 360) % 360; hueShift[r] += Math.sign(d);
    }
  }
  nudge();
  // Revision 6b (the independent verifier's issue 2): no app colour may sit closer to a status colour (success, warning, danger)
  // than the closest PERSON colour already does. The people's own minima set each role's floor (SEM_FLOOR). Where a role is too
  // close, a grid search over hue (±30°), lightness (±0.24) and chroma (x1, 0.85, 0.7) picks the least change that clears the floor (+0.3) and keeps
  // every contrast rule and the chroma floors; the ink roles are then re-nudged.
  const semMoves = {};
  for (let round = 0; round < 3; round++) { for (const r of STATUS_ROLES) {
    if (SEM_FLOOR[scheme][r] < 0.05 && PERSON_FLOOR[scheme][r] < 0.05) continue;   // light -on is white for every family: nothing to separate
    if (semDist(scheme, r, rgb(o[r])) >= SEM_FLOOR[scheme][r] + 0.3 && distinct(r, rgb(o[r]))) continue;
    let best = null;
    for (let dH = -30; dH <= 30; dH++) for (let dL = -0.24; dL <= 0.2401; dL += 0.006) for (const kC of [1, 0.85, 0.7]) {
      const cand = { L: o[r].L + dL, C: o[r].C * kC, H: (o[r].H + dH + 360) % 360 }, c = rgb(cand);
      if (semDist(scheme, r, c) < SEM_FLOOR[scheme][r] + 0.3 || !distinct(r, c)) continue;
      const fam = { ...f(), [r]: c };
      if (!chromaOk(scheme, fam) && (r === 'fill')) continue;
      if (rules(scheme, fam).some(x => x.v < x.thr + M)) continue;
      const cost = Math.abs(dH) / 10 + Math.abs(dL) / 0.02 + (1 - kC) * 10;
      if (!best || cost < best.cost) best = { cost, cand, dH, dL: +dL.toFixed(3), kC };
    }
    if (best) { o[r] = best.cand; semMoves[r] = { dH: best.dH, dL: best.dL, kC: best.kC }; } else semMoves[r] = 'NO CANDIDATE';
  }
  nudge(); }
  const fam = f();
  const semFails = STATUS_ROLES.filter(r => semDist(scheme, r, fam[r]) < SEM_FLOOR[scheme][r]).map(r => `${r} ${semDist(scheme, r, fam[r]).toFixed(2)} < ${SEM_FLOOR[scheme][r]} from a status colour`);
  return { fam, nudges, hueShift, semMoves, fails: [...rules(scheme, fam).filter(x => x.v < x.thr).map(x => x), ...semFails.map(name => ({ name, v: 0, thr: 1 }))], chroma: chromaOk(scheme, fam), oklch: Object.fromEntries(ROLES.map(r => [r, oklch(fam[r])])) };
}
// the status families, and the people's own closest approach to them per role (CIEDE2000, both schemes; the gate's floors)
const SEMANTIC = ['success', 'warning', 'danger'];
const semOf = body => Object.fromEntries(SEMANTIC.map(f => [f, Object.fromEntries(ROLES.map(r => [r, parseColour(body.match(new RegExp(`--${f}-${r}: (#[0-9A-Fa-f]{6})`))[1])]))]));
const SEM = { light: semOf(LIGHT_BODY), dark: semOf(DARK_BODY) };
const DIST = { 'fill-strong': { person: 4, app: 8 }, graphic: { person: 5, app: 10 } };   // the gate's app-hue floors (contrast.mjs H2)
// app vs person, per role and scheme: half the people's own closest spacing in that role, rounded down to 0.1, and never under the
// tile end's 4 or the mark's 5 (light -on is white for everyone: 0, nothing to separate)
const PERSON_FLOOR = Object.fromEntries(['light', 'dark'].map(sc => [sc, Object.fromEntries(ROLES.map(r => {
  let m = Infinity; for (let i = 0; i < PEOPLE.length; i++) for (let j = i + 1; j < PEOPLE.length; j++) m = Math.min(m, de2000(FAM[sc][PEOPLE[i]][r], FAM[sc][PEOPLE[j]][r]));
  return [r, Math.max(Math.floor(m / 2 * 10) / 10, DIST[r]?.person ?? 0)];
}))]));
// per scheme, per role: the people's own closest approach to a status colour, rounded down (the gate computes the same); the mark: 10
// revision 6c (verify-rev6 round 2, issue 1): EVERY role, not four: a tile's glyph (ink), a solid and its label (strong, on) must
// not read as a status chip either. Order: the grounds first, the inks last (they depend on the fills).
const STATUS_ROLES = ['wash', 'fill', 'fill-strong', 'graphic', 'strong', 'on', 'ink', 'ink-hi'];
export const SEM_FLOOR = Object.fromEntries(['light', 'dark'].map(sc => [sc, Object.fromEntries(STATUS_ROLES.map(r => [r, r === 'graphic' ? 10 : Math.floor(Math.min(...SEMANTIC.flatMap(s => PEOPLE.map(p => de2000(SEM[sc][s][r], FAM[sc][p][r])))) * 10) / 10]))]));
function semDist(scheme, role, c) { return Math.min(...SEMANTIC.map(s => de2000(c, SEM[scheme][s][role]))); }

// ── distances ────────────────────────────────────────────────────────────────────────────────────────────────
function distances(built) {
  const t = {};
  for (const scheme of ['light', 'dark']) for (const role of ['fill', 'fill-strong', 'graphic']) for (const vis of ['normal', 'protan', 'deutan']) {
    const A = APP_HUES.map(([n]) => [n, simulate(built[n][scheme].fam[role], vis)]);
    const Pp = PEOPLE.map(p => [p, simulate(FAM[scheme][p][role], vis)]);
    let aa = [Infinity, ''], ap = [Infinity, ''], pp = [Infinity, ''];
    for (let i = 0; i < A.length; i++) {
      for (let j = i + 1; j < A.length; j++) { const d = de2000(A[i][1], A[j][1]); if (d < aa[0]) aa = [d, A[i][0] + '/' + A[j][0]]; }
      for (const [p, c] of Pp) { const d = de2000(A[i][1], c); if (d < ap[0]) ap = [d, A[i][0] + '/' + p]; }
    }
    for (let i = 0; i < Pp.length; i++) for (let j = i + 1; j < Pp.length; j++) { const d = de2000(Pp[i][1], Pp[j][1]); if (d < pp[0]) pp = [d, Pp[i][0] + '/' + Pp[j][0]]; }
    t[`${scheme} ${role} ${vis}`] = { appVsApp: +aa[0].toFixed(2), closestApps: aa[1], appVsPerson: +ap[0].toFixed(2), closestPerson: ap[1], personVsPerson: +pp[0].toFixed(2) };
  }
  return t;
}

if (process.argv.includes('--search')) {
  // maximin re-run of the slots (random coordinate ascent from the rounded slots above)
  const score = hs => { let v = Infinity; for (const s of ['light', 'dark']) { const F = hs.map(h => rgb(interp(s, h, 'fill-strong'))), G = hs.map(h => rgb(interp(s, h, 'graphic')));
    for (let i = 0; i < hs.length; i++) { for (let j = i + 1; j < hs.length; j++) v = Math.min(v, de2000(F[i], F[j]) / 8, de2000(G[i], G[j]) / 10);
      for (const p of PEOPLE) v = Math.min(v, de2000(F[i], FAM[s][p]['fill-strong']) / 4, de2000(G[i], FAM[s][p].graphic) / 5); } } return v; };
  let cur = APP_HUES.map(x => x[1]), cv = score(cur);
  for (let it = 0; it < 6000; it++) { const c = cur.slice(); c[it % c.length] = (c[it % c.length] + Math.random() * 6 - 3 + 360) % 360; const v = score(c); if (v >= cv) { cur = c; cv = v; } }
  console.log('slots', cur.map(h => h.toFixed(1)).join(' '), 'score', cv.toFixed(3));
  process.exit(0);
}

// passes, one app at a time (each sees the others' latest colours): the first keeps each app off the people and the status
// colours, the later ones also off every other app, until nothing moves
let built = Object.fromEntries(APP_HUES.map(([n, pos]) => [n, { light: build('light', pos), dark: build('dark', pos) }]));
for (let pass = 0; pass < 6; pass++) {
  let moved = false;
  for (const [n, pos] of APP_HUES) {
    const others = Object.fromEntries(Object.entries(built).filter(([m]) => m !== n).map(([m, v]) => [m, { light: v.light.fam, dark: v.dark.fam }]));
    const next = { light: build('light', pos, others), dark: build('dark', pos, others) };
    if (ROLES.some(r => ['light', 'dark'].some(sc => hex(next[sc].fam[r]) !== hex(built[n][sc].fam[r])))) moved = true;
    built[n] = next;
  }
  if (!moved) break;
}
// the gate's distinctness floors, checked on the result (normal vision)
const distinctFails = [];
for (const sc of ['light', 'dark']) for (const r of ROLES) for (let i = 0; i < APP_HUES.length; i++) {
  const d = { person: PERSON_FLOOR[sc][r], app: DIST[r]?.app ?? 0 };
  const ci = built[APP_HUES[i][0]][sc].fam[r];
  for (const p of PEOPLE) if (de2000(ci, FAM[sc][p][r]) < d.person) distinctFails.push(`${sc} ${r} ${APP_HUES[i][0]}/${p}`);
  for (let j = i + 1; j < APP_HUES.length; j++) if (de2000(ci, built[APP_HUES[j][0]][sc].fam[r]) < d.app) distinctFails.push(`${sc} ${r} ${APP_HUES[i][0]}/${APP_HUES[j][0]}`);
}
const report = { generated: new Date().toISOString(), script: 'audits/tools/phase5/app-hues.mjs', source: 'audits/tools/phase4/tokens/proposed-tokens.css',
  method: 'OKLCH interpolation between the two neighbouring house families per role, then lightness nudges (constant H, C clamped to gamut) until every gate rule for a person family holds with a +0.03 margin, in every palette of the scheme',
  peopleOrder: ORDER.map((p, i) => `${p} ${BASE[i].toFixed(1)}°`), families: {}, distances: distances(built), distinctFails, ok: distinctFails.length === 0 };
for (const [n, pos, app, today] of APP_HUES) {
  const e = report.families[n] = { slot: pos, between: (({ a, b, t }) => `${a} → ${b} at ${t.toFixed(2)}`)(neighbours(pos)), app, todayHex: today };
  for (const s of ['light', 'dark']) {
    const b = built[n][s];
    e[s] = { hex: Object.fromEntries(ROLES.map(r => [r, hex(b.fam[r])])), nudgeSteps: b.nudges, hueShiftDeg: b.hueShift, statusMoves: b.semMoves, statusDistance: Object.fromEntries(STATUS_ROLES.map(r => [r, +semDist(s, r, b.fam[r]).toFixed(2)])), chromaOk: b.chroma,
      minima: Object.fromEntries(['wash', 'fill', 'ink', 'ink-hi', 'strong', 'graphic', 'on'].map(role => { const xs = rules(s, b.fam).filter(x => x.role === role); return [role, xs.length ? Math.min(...xs.map(x => +(x.v / x.thr).toFixed(3))) : null]; })),
      fails: b.fails.map(x => `${x.name} ${x.v.toFixed(2)} < ${x.thr}`) };
    if (b.fails.length || !b.chroma) report.ok = false;
  }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
const line = (n, s) => `  ${ROLES.map(r => `--${n}-${r}: ${report.families[n][s].hex[r]};`).join(' ')}`;
if (process.argv.includes('--css')) {
  console.log('/* light */'); for (const [n] of APP_HUES) console.log(line(n, 'light'));
  console.log('/* dark */'); for (const [n] of APP_HUES) console.log(line(n, 'dark'));
} else {
  for (const [n] of APP_HUES) console.log(n.padEnd(11), report.families[n].between.padEnd(28), 'light', report.families[n].light.fails.length ? 'FAIL ' + report.families[n].light.fails.join('; ') : 'ok', '· dark', report.families[n].dark.fails.length ? 'FAIL ' + report.families[n].dark.fails.join('; ') : 'ok', report.families[n].light.chromaOk && report.families[n].dark.chromaOk ? '' : 'CHROMA');
  for (const [k, v] of Object.entries(report.distances)) if (k.includes('normal') || k.includes('graphic')) console.log(k.padEnd(28), JSON.stringify(v));
}
process.exit(report.ok ? 0 : 1);
