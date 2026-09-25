#!/usr/bin/env node
// Phase 4 ACCENT — summarise runtime.mjs output (audits/evidence/p4/ACCENT/runtime[/park-*]/<theme>/<profile>/*.json).
// Groups every accent-/person-coloured element by area (the app frame, or the shell page; the TV board is "tv") and
// selector, and reports per group: the property/token that carries the colour, how many profile × theme cases were
// measured, how many fail (text: p10 below AA, and median below AA; non-text: paint vs nearest declared background < 3),
// the worst case, and the failing profiles and themes.
//
//   node audits/tools/phase4/ACCENT/aggregate.mjs → audits/evidence/p4/ACCENT/runtime-summary.json (+ prints tables)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const BASE = path.join(ROOT, 'audits/evidence/p4/ACCENT');
const TR = JSON.parse(fs.readFileSync(path.join(ROOT, 'audits/evidence/p4/measure/tokens-resolved.json'), 'utf8'));
const COL = { eli: '#4F5D8C', christian: '#BC5A38', ezra: '#137F77', kiara: '#B4861B', mom: '#8A6A4B', dad: '#3D5A3D', niece: '#5B8143', tv: '#4C4C58' };
const HUES = ['--slate', '--terra', '--teal', '--gold', '--mocha', '--olive', '--danger', '--ok', '--warn', '--info'];
// the profile's own hex equals a fixed hue token in this theme (e.g. Eli = --slate in Hearth): a paint of that colour may be the token, not the accent
const collides = (prof, theme) => { const hx = COL[prof]; if (!hx) return null; for (const h of HUES) { const v = TR.tokens[h]; const tv = v && (v[theme] || v.all); if (tv && tv.split('/')[0].toUpperCase() === hx) return h; } return null; };
const STATE = /\.on\b|tab-ind|div\.inner > button|pin-dots|emoji-grid|swatch|seg > button/;
const dirs = ['runtime'].filter(d => fs.existsSync(path.join(BASE, d)));
const groups = {}; const jobs = { ok: 0, fail: 0, goErrors: [], themeCheck: {} };
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.json') ? [path.join(d, e.name)] : []);
for (const f of dirs.flatMap(d => walk(path.join(BASE, d)))) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!j.ok) { jobs.fail++; continue; }
  jobs.ok++;
  if (j.goError) jobs.goErrors.push(`${j.theme}/${j.profile}/${j.area}:${j.screen} ${j.goError}`);
  const theme = (j.variant === 'park' ? 'park-' : '') + j.theme;
  for (const d of j.docs) {
    if (!d.recs) continue;
    if (d.meta) { const k = j.theme; (jobs.themeCheck[k] ||= {}); jobs.themeCheck[k][`${d.meta.theme}|${d.meta.scheme}`] = (jobs.themeCheck[k][`${d.meta.theme}|${d.meta.scheme}`] || 0) + 1; }
    const area = d.doc.startsWith('frame:') ? d.doc.slice(6) : j.area === 'tv' ? 'tv' : 'shell';
    if (d.doc === 'page' && j.area !== 'tv' && j.area !== 'shell' && j.area !== 'shell-me') {
      // the shell's page behind an app: count only the pill/topbar, which stays visible over the app
      d.recs = d.recs.filter(r => /#pill|topbar/.test(r.sel));
    }
    for (const r of d.recs) {
      if (r.covered) continue;
      const m = r.matches[0];
      const who = m.tok.startsWith('person') ? 'person' : 'signed-in';
      const sel = r.sel.replace(/:nth-[^ ]+/g, '');
      const measures = [];
      const colourCarried = r.matches.some(x => ['color', 'background-color', 'ancestor-bg'].includes(x.prop) || (x.prop === 'background-image' && x.rgba[3] >= 0.5));
      if (r.kind === 'text' && colourCarried) measures.push({ type: 'text', p10: r.p10, med: r.med, req: r.req, pass: r.pass, passMed: r.passMed, fs: r.fs, text: r.text, carrier: r.matches.map(x => x.prop + ':' + x.tok).join(',') });
      if (r.nontext) measures.push({ type: r.nontext.prop === 'background-color' && !STATE.test(r.sel.split(' > ').slice(-2).join(' > ')) ? 'fill' : 'nontext', p10: r.nontext.vsDecl, med: r.nontext.vsOutside, req: 3, pass: r.nontext.pass, passMed: r.nontext.vsOutside >= 3, carrier: r.nontext.prop + ':' + r.nontext.tok });
      if (!measures.length) measures.push({ type: 'decor', carrier: r.matches.map(x => x.prop + ':' + x.tok + (x.rgba[3] < 1 ? '@' + x.rgba[3] : '')).join(',') });
      for (const ms of measures) {
        const key = `${area} | ${ms.type} | ${sel} | ${ms.carrier}`;
        const coll = m.tok === 'accent' && collides(j.profile, j.theme);
        const g = groups[key] ||= { area, type: ms.type, sel, carrier: ms.carrier, who, screens: {}, cases: 0, fails: 0, failsMed: 0, worst: null, failProfiles: {}, failThemes: {}, byTheme: {}, tintHexes: {}, collidingCases: 0, collisionTokens: {} };
        if (coll) { g.collidingCases++; g.collisionTokens[coll] = 1; }
        g.screens[`${j.area}:${j.screen}`] = 1;
        if (r.tint && r.tint.hex) g.tintHexes[r.tint.hex] = 1;
        if (ms.type === 'decor') { g.cases++; continue; }
        g.cases++;
        const bt = g.byTheme[theme] ||= { min: 99, fails: 0, n: 0 }; bt.n++; bt.min = Math.min(bt.min, ms.p10);
        if (!ms.pass) { g.fails++; bt.fails++; g.failProfiles[j.profile + (r.tint && who === 'person' ? '→' + r.tint.hex : '')] = 1; g.failThemes[theme] = 1; }
        if (!ms.passMed) g.failsMed++;
        if (!g.worst || ms.p10 < g.worst.p10) g.worst = { p10: ms.p10, med: ms.med, req: ms.req, profile: j.profile, theme, screen: `${j.area}:${j.screen}`, text: ms.text || null, fs: ms.fs || null, tint: r.tint && r.tint.hex };
      }
    }
  }
}
for (const g of Object.values(groups)) if (g.collidingCases && g.collidingCases === g.cases) { g.type = 'collision:' + g.type; }
const list = Object.values(groups).map(g => ({ ...g, collisionTokens: Object.keys(g.collisionTokens), screens: Object.keys(g.screens), failProfiles: Object.keys(g.failProfiles), failThemes: Object.keys(g.failThemes), tintHexes: Object.keys(g.tintHexes) }));
const areas = {};
for (const g of list) {
  const a = areas[g.area] ||= { groups: 0, text: 0, nontext: 0, decor: 0, fill: 0, collision: 0, textFail: 0, nontextFail: 0, byCarrier: {}, signedIn: 0, person: 0 };
  a.groups++; a[g.type.startsWith('collision') ? 'collision' : g.type]++; if (g.type === 'text' && g.fails) a.textFail++; if (g.type === 'nontext' && g.fails) a.nontextFail++;
  a[g.who === 'person' ? 'person' : 'signedIn']++;
  const c = g.carrier.split(',')[0].replace(/@.*/, ''); a.byCarrier[c] = (a.byCarrier[c] || 0) + 1;
}
list.sort((x, y) => (x.area > y.area ? 1 : x.area < y.area ? -1 : (x.worst ? x.worst.p10 : 99) - (y.worst ? y.worst.p10 : 99)));
fs.writeFileSync(path.join(BASE, 'runtime-summary.json'), JSON.stringify({ note: 'From runtime.mjs. One group per area × type × selector × carrier (the CSS property and accent token that carries the person colour: accent/deep/soft/tint = the signed-in person\'s tokens; person-raw/person-ink/person-soft = another person\'s (or an app\'s) inline --tint). text: p10/median of the rendered ratio vs AA; nontext: paint vs the nearest opaque declared background (p10 column) and vs the pixels 3-5 px outside (med column), 3:1; decor: glass pickup, washes, glows (not contrast-bearing). cases = profile × theme × screen occurrences. failProfiles lists signed-in profile (→ the person colour when another person\'s colour failed).', jobs, areas, groups: list }, null, 1));
console.log('jobs', jobs.ok, 'failed', jobs.fail, 'goErrors', jobs.goErrors.length);
console.log('themeCheck', JSON.stringify(jobs.themeCheck));
console.log('\narea'.padEnd(16), 'groups text nontext decor | textFail nontextFail | signedIn person');
for (const [a, s] of Object.entries(areas)) console.log(a.padEnd(15), s.groups, s.text, s.nontext, s.decor, '|', s.textFail, s.nontextFail, '|', s.signedIn, s.person, JSON.stringify(s.byCarrier));
console.log('\nFAILING GROUPS');
for (const g of list.filter(g => g.fails && (g.type === 'text' || g.type === 'nontext'))) console.log(`${g.area.padEnd(14)} ${g.type.padEnd(7)} ${g.sel.slice(-46).padEnd(46)} ${g.carrier.slice(0, 34).padEnd(34)} ${g.fails}/${g.cases} med-fail ${g.failsMed} worst ${g.worst.p10}/${g.worst.med} ${g.worst.profile} ${g.worst.theme} ${g.worst.tint || ''} ${g.worst.text ? '"' + g.worst.text.slice(0, 18) + '" ' + g.worst.fs + 'px' : ''} | ${g.failProfiles.join(',')} | ${g.failThemes.join(',')}`);
