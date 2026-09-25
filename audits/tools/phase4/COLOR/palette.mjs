// Phase 4 COLOR: the palette against the house style. Pure computation (no browser):
//  A. the eight house pastel fill/ink pairs: WCAG contrast, OKLCH, and the ink each needs (darkened along OKLCH L, hue kept)
//     for 4.5:1 and 7:1, plus the dark-mode role flip (the pastel as the glowing ink on a deep tinted surface);
//  B. the system's own hue families per theme (tokens-resolved.json): soft fill chroma vs the house pastels, -ink on -soft,
//     the mid tone used as text (on bg / surface / its own soft), neutral surfaces vs the iOS grouped background;
//  C. per-profile accent recipes (hub.js sets --accent to the raw profile colour, apps/hub.js:80): raw accent, accent-deep,
//     --tint-ink (index.html:955), on-accent on accent-deep, accent-deep on 92% white (hero buttons), per theme.
// Usage: node audits/tools/phase4/COLOR/palette.mjs  -> audits/evidence/p4/COLOR/palette.json
import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../../../..');
const OUT = path.join(ROOT, 'audits/evidence/p4/COLOR'); fs.mkdirSync(OUT, { recursive: true });
const TR = JSON.parse(fs.readFileSync(path.join(ROOT, 'audits/evidence/p4/measure/tokens-resolved.json')));
export const hex2 = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
export const toHex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const unlin = v => 255 * (v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055);
export const lum = c => { const [r, g, b] = c.map(lin); return .2126 * r + .7152 * g + .0722 * b; };
export const cr = (a, b) => { a = typeof a === 'string' ? hex2(a) : a; b = typeof b === 'string' ? hex2(b) : b; const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + .05) / (y + .05)).toFixed(2); };
export const mix = (a, b, p) => { a = hex2(a); b = hex2(b); return toHex(a.map((v, i) => v * p + b[i] * (1 - p))); };   // color-mix(in srgb, a p, b)
export function oklch(h) {
  const [r, g, b] = hex2(h).map(lin);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  const L = .2104542553 * l + .793617785 * m - .0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, B = .0259040371 * l + .7827717662 * m - .808675766 * s;
  return { L: +L.toFixed(3), C: +Math.hypot(A, B).toFixed(3), H: +((Math.atan2(B, A) * 180 / Math.PI + 360) % 360).toFixed(1) };
}
function fromOklch(L, C, H) {
  const a = C * Math.cos(H * Math.PI / 180), b = C * Math.sin(H * Math.PI / 180);
  const l = (L + .3963377774 * a + .2158037573 * b) ** 3, m = (L - .1055613458 * a - .0638541728 * b) ** 3, s = (L - .0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s];
}
function inGamut(L, C, H) { let c = C; for (;;) { const rgb = fromOklch(L, c, H); if (rgb.every(v => v >= -1e-4 && v <= 1.0001) || c <= 0) return toHex(rgb.map(v => unlin(Math.max(0, Math.min(1, v))))); c -= .002; } }
// darken (dir -1) or lighten (dir +1) an ink along OKLCH L, hue kept, chroma kept where the gamut allows, until contrast >= target
export function fixInk(ink, bg, target = 4.5, dir = -1) {
  const o = oklch(ink); if (cr(ink, bg) >= target) return { ink, ratio: cr(ink, bg), changed: false };
  for (let L = o.L; L > 0 && L < 1; L += dir * .002) { const h = inGamut(L, o.C, o.H); if (cr(h, bg) >= target) return { ink: h, ratio: cr(h, bg), changed: true, dL: +(L - o.L).toFixed(3), oklch: oklch(h) }; }
  return null;
}
const MAIN = import.meta.url === url.pathToFileURL(process.argv[1] || '').href;
if (MAIN) main();
function main() {
const HOUSE = { Bubblegum: ['#FFC8DD', '#A3134F'], Peach: ['#FFD6B8', '#9A3F0A'], Butter: ['#FFF1A8', '#735A00'], Mint: ['#B9F2D0', '#0E6B3B'], Aqua: ['#B5EEF0', '#0B6468'], Sky: ['#BFDDFF', '#1A4F9C'], Periwinkle: ['#CCD3FF', '#3440A8'], Lavender: ['#E0CCFF', '#5E2BAE'] };
const IOS = { light: { bg: '#F2F2F7', card: '#FFFFFF' }, dark: { bg: '#000000', card: '#1C1C1E', card2: '#2C2C2E' } };
const out = { note: 'Contrast = WCAG 2.x; OKLCH from sRGB hex. house = the constitution pastels; themes = design.css hue families per theme as resolved on the shell page (audits/evidence/p4/measure/tokens-resolved.json); profiles = accent recipes per profile colour (worker/seed.sql:4-11, index.html:449 swatches). Targets: 4.5 text, 3 large text/icons/non-text. darkRole.deepTint = 28% of the ink over the iOS elevated dark card #1C1C1E.', house: {}, themes: {}, profiles: {}, neutrals: {} };
for (const [n, [fill, ink]] of Object.entries(HOUSE)) {
  const r = cr(fill, ink), deepTint = mix(ink, IOS.dark.card, .28);
  out.house[n] = {
    fill, ink, fillOKLCH: oklch(fill), inkOKLCH: oklch(ink), inkOnFill: r, passText: r >= 4.5, passLargeIcon: r >= 3, inkOnWhite: cr(ink, '#FFFFFF'), inkOnIOSbg: cr(ink, IOS.light.bg), fillVsWhiteCard: cr(fill, '#FFFFFF'),
    darkRole: { deepTint, pastelOnDeepTint: cr(fill, deepTint), pastelOnIOSCard: cr(fill, IOS.dark.card), pastelOnBlack: cr(fill, '#000000'), deepTintVsCard: cr(deepTint, IOS.dark.card) },
    inkFor45: fixInk(ink, fill, 4.5), inkFor7: fixInk(ink, fill, 7),
  };
}
const T = TR.themes, tok = (name, th) => (TR.tokens[name] || {})[th];
const FAM = ['mocha', 'gold', 'olive', 'teal', 'terra', 'slate'];
const SEM = { ok: 'olive', warn: 'gold', danger: 'terra', info: 'teal' };
for (const th of T) {
  const bg = tok('--bg', th), surface = tok('--surface', th), s2 = tok('--surface-2', th), text = tok('--text', th);
  const fam = {};
  for (const f of FAM) {
    const base = tok('--' + f, th), soft = tok(`--${f}-soft`, th), ink = tok(`--${f}-ink`, th);
    fam[f] = { base, soft, ink, softOKLCH: oklch(soft), baseOKLCH: oklch(base), inkOnSoft: cr(ink, soft), inkOnSurface: cr(ink, surface), inkOnBg: cr(ink, bg), baseOnBg: cr(base, bg), baseOnSurface: cr(base, surface), baseOnSoft: cr(base, soft), softVsSurface: cr(soft, surface), whiteOnBase: cr('#FFFFFF', base), onAccentOnBase: cr(tok('--on-accent', th), base) };
  }
  out.themes[th] = {
    bg, surface, surface2: s2, text, textOnBg: cr(text, bg), text2OnSurface: cr(tok('--text-2', th), surface), text2OnSurface2: cr(tok('--text-2', th), s2), mutedOnBg: cr(tok('--muted', th), bg), mutedOnSurface: cr(tok('--muted', th), surface), mutedOnSurface2: cr(tok('--muted', th), s2),
    mutedDecorOnSurface: cr(tok('--muted-decor', th), surface), mutedDecorOnSurface2: cr(tok('--muted-decor', th), s2), lineOnSurface: cr(tok('--line', th), surface), surfaceVsBg: cr(surface, bg), surface2VsSurface: cr(s2, surface), surface2VsBg: cr(s2, bg), bgOKLCH: oklch(bg), surfaceOKLCH: oklch(surface), families: fam,
    softChroma: [Math.min(...FAM.map(f => fam[f].softOKLCH.C)), Math.max(...FAM.map(f => fam[f].softOKLCH.C))],
    semantic: Object.fromEntries(Object.entries(SEM).map(([k, f]) => [k, { family: f, base: fam[f].base, soft: fam[f].soft, ink: fam[f].ink, H: fam[f].baseOKLCH.H, baseOnBg: fam[f].baseOnBg, inkOnSoft: fam[f].inkOnSoft }])),
  };
}
const houseC = Object.values(out.house).map(h => h.fillOKLCH.C); out.houseFillChroma = [Math.min(...houseC), Math.max(...houseC)];
const houseL = Object.values(out.house).map(h => h.fillOKLCH.L); out.houseFillL = [Math.min(...houseL), Math.max(...houseL)];
out.neutrals = {
  iOS: { light: { bg: IOS.light.bg, card: IOS.light.card, cardVsBg: cr(IOS.light.card, IOS.light.bg), bgOKLCH: oklch(IOS.light.bg) }, dark: { bg: '#000000', card: IOS.dark.card, cardVsBg: cr(IOS.dark.card, '#000000'), card2: IOS.dark.card2, card2VsCard: cr(IOS.dark.card2, IOS.dark.card) } },
  themes: Object.fromEntries(T.map(th => [th, { bg: tok('--bg', th), surface: tok('--surface', th), cardVsBg: cr(tok('--surface', th), tok('--bg', th)), bgOKLCH: oklch(tok('--bg', th)), surfaceOKLCH: oklch(tok('--surface', th)) }])),
};
// C. profile accents. accent-deep = mix(accent 72%, black) in Hearth/Frost (design.css:88, 149), 66% in Parchment (:123), mix(accent 58%, white) in dark (:172, 202)
const PROFILES = { eli: '#4F5D8C', christian: '#BC5A38', ezra: '#137F77', kiara: '#B4861B', mom: '#8A6A4B', dad: '#3D5A3D', niece: '#5B8143', tv: '#4C4C58', swatch9: '#8C4F7A', swatch10: '#4C7B6A' };
const DARK = ['system-dark', 'hearth-dark', 'midnight', 'forest'];
const deepOf = (a, th) => th === 'parchment' ? mix(a, '#000000', .66) : (DARK.includes(th) ? mix(a, '#FFFFFF', .58) : mix(a, '#000000', .72));
for (const [p, a] of Object.entries(PROFILES)) {
  out.profiles[p] = { color: a, oklch: oklch(a), themes: {} };
  for (const th of T) {
    const bg = tok('--bg', th), surface = tok('--surface', th), text = tok('--text', th), deep = deepOf(a, th), soft = mix(a, surface, .14), onA = tok('--on-accent', th), tintInk = mix(a, text, .70), white92 = mix('#FFFFFF', surface, .92);
    out.profiles[p].themes[th] = { rawOnBg: cr(a, bg), rawOnSurface: cr(a, surface), deep, deepOnSurface: cr(deep, surface), deepOnSoft: cr(deep, soft), onAccentOnDeep: cr(onA, deep), deepOn92White: cr(deep, white92), tintInk, tintInkOnSurface: cr(tintInk, surface), soft, softOKLCH: oklch(soft) };
  }
}
fs.writeFileSync(path.join(OUT, 'palette.json'), JSON.stringify(out, null, 1));
console.log('House pairs: name fill ink | ink/fill | ink/white | ink for 4.5 | ink for 7 | fill OKLCH | dark role');
for (const [n, h] of Object.entries(out.house)) console.log(n, h.fill, h.ink, '|', h.inkOnFill, '|', h.inkOnWhite, '|', h.inkFor45.changed ? `${h.inkFor45.ink} ${h.inkFor45.ratio}` : 'ok', '|', `${h.inkFor7.ink} ${h.inkFor7.ratio}`, '| L', h.fillOKLCH.L, 'C', h.fillOKLCH.C, 'H', h.fillOKLCH.H, '| ink L', h.inkOKLCH.L, 'C', h.inkOKLCH.C, '| pastel on #1C1C1E', h.darkRole.pastelOnIOSCard, 'on deep tint', h.darkRole.deepTint, h.darkRole.pastelOnDeepTint, 'tint vs card', h.darkRole.deepTintVsCard);
console.log('house fill chroma', out.houseFillChroma, 'L', out.houseFillL);
for (const th of T) {
  const t = out.themes[th];
  console.log('\n' + th, 'bg', t.bg, 'surface', t.surface, 's2', t.surface2, 'card/bg', t.surfaceVsBg, 's2/surface', t.surface2VsSurface, 'soft C', t.softChroma.join('-'), '| muted on bg', t.mutedOnBg, 'surface', t.mutedOnSurface, 's2', t.mutedOnSurface2, '| text-2 on s2', t.text2OnSurface2, '| decor', t.mutedDecorOnSurface, '| line', t.lineOnSurface);
  for (const f of FAM) { const x = t.families[f]; console.log('  ', f.padEnd(6), 'base', x.base, 'onBg', x.baseOnBg, 'onSurf', x.baseOnSurface, 'onSoft', x.baseOnSoft, '| ink/soft', x.inkOnSoft, 'ink/surf', x.inkOnSurface, '| soft', x.soft, 'L', x.softOKLCH.L, 'C', x.softOKLCH.C, 'soft/surf', x.softVsSurface, '| white/base', x.whiteOnBase, 'onAccent/base', x.onAccentOnBase); }
}
console.log('\nProfiles per theme: raw/surface deep/surface deep/soft onAccent/deep deep/92%white tintInk/surface');
for (const [p, o] of Object.entries(out.profiles)) console.log(p, o.color, 'C', o.oklch.C, T.map(th => { const x = o.themes[th]; return `${th}:${x.rawOnSurface}/${x.deepOnSurface}/${x.deepOnSoft}/${x.onAccentOnDeep}/${x.deepOn92White}/${x.tintInkOnSurface}`; }).join(' '));
console.log('\nneutrals', JSON.stringify(out.neutrals));
}
