// Phase 3 / dollywood: review the shared compliance counter's hit lists and correct them for this generated file.
// Reads audits/evidence/p3/_compliance/dollywood.json (rerun `node audits/tools/phase3/compliance.mjs dollywood` first),
// classifies every hit by what it does in the hub flavour, and writes audits/evidence/p3/dollywood/compliance-corrected.json.
// Classes (export line numbers):
//   ref    reference-flavour palette the hub remaps (CSS 7-12 except the --attr..--water map colours on 7-10) - inert in the hub
//   live   park-map-only rules/code ([data-flavor=live] CSS 382-565; JS 1286-1735 runs only from liveInit) - inert in the hub
//   data   the embedded payload (JS 682) - data, not styling
//   map    cartography: map layers, markers, labels, the 3D scene, legend swatches, coaster card track (hex exempt by screens-apps.mjs)
//   chrome everything else: UI that the house style governs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'audits/evidence/p3/_compliance/dollywood.json'), 'utf8'));
const inR = (l, rs) => rs.some(([a, b]) => l >= a && l <= (b ?? a));
const CSS_MAP = [[42], [110, 111], [131, 134], [173], [204, 207], [216, 217], [259, 285]];
function cssClass(h) {
  const l = h.line;
  if (l >= 382 && l <= 565) return 'live';
  if (l >= 7 && l <= 12) return /--(attr|shop|dine|coaster|rail|water)\b/.test(h.text) ? 'map' : 'ref';
  if (inR(l, CSS_MAP)) return 'map';
  return 'chrome';
}
const JS_MAP = [[733, 786], [803, 807], [866, 875], [905, 922], [998, 1000], [1025, 1026], [1117, 1118], [1148], [1161, 1284]];
function jsClass(h) {
  const l = h.line;
  if (l === 682) return 'data';
  if (l >= 1286 && l <= 1735) return 'live';
  if (inR(l, JS_MAP)) return 'map';
  return 'chrome';
}
const tally = (arr, cls) => { const out = { total: arr.length }; for (const h of arr) { const c = cls(h); out[c] = (out[c] || 0) + 1; } return out; };
const chromeLines = (arr, cls) => [...new Set(arr.filter(h => cls(h) === 'chrome').map(h => h.line))];
const res = { source: 'audits/evidence/p3/_compliance/dollywood.json', css: {}, js: {}, inline: {}, chromeLines: {} };
for (const k of ['colorHex', 'colorFunc', 'colorNamed', 'colorDerived', 'fontSize', 'radius', 'spacing', 'shadow', 'duration', 'zIndex', 'fontFamily']) {
  if (!j.css[k]) continue; res.css[k] = tally(j.css[k], cssClass); res.chromeLines['css.' + k] = chromeLines(j.css[k], cssClass);
}
for (const k of ['colorHex', 'colorFunc', 'styleWrites']) { if (!j.js[k]) continue; res.js[k] = tally(j.js[k], jsClass); res.chromeLines['js.' + k] = chromeLines(j.js[k], jsClass); }
res.inline = tally(j.inline.decls, jsClass); res.chromeLines.inline = chromeLines(j.inline.decls, jsClass);
// the base rules 13-207 are partly overridden by the hub rules 208-380 in the hub flavour: report them apart
const split = (arr) => ({ base_13_207: arr.filter(h => cssClass(h) === 'chrome' && h.line <= 207).length, hub_208_380: arr.filter(h => cssClass(h) === 'chrome' && h.line >= 208 && h.line <= 380).length });
res.chromeSplit = { fontSize: split(j.css.fontSize), radius: split(j.css.radius), colorHex: split(j.css.colorHex), spacing: split(j.css.spacing) };
// the chrome hex values themselves
res.chromeHex = j.css.colorHex.filter(h => cssClass(h) === 'chrome').map(h => `${h.line}: ${h.text}`);
res.chromeHexJs = j.js.colorHex.filter(h => jsClass(h) === 'chrome').map(h => `${h.line}: ${h.text.slice(0, 80)}`);
res.fontFamilies = j.css.fontFamily.map(h => `${h.line} [${cssClass(h)}]: ${h.text}`);
fs.writeFileSync(path.join(ROOT, 'audits/evidence/p3/dollywood/compliance-corrected.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify({ css: res.css, js: res.js, inline: res.inline, chromeSplit: res.chromeSplit }, null, 0));
console.log('chrome hex (CSS):', res.chromeHex.join(' | '));
console.log('chrome hex (JS):', res.chromeHexJs.join(' | '));
console.log('font families:', res.fontFamilies.join(' | '));
