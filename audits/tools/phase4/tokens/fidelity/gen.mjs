// Phase 4 · token proposal "fidelity" · derives the colour scales that tokens.css carries.
// node audits/tools/phase4/tokens/fidelity/gen.mjs          -> table of every step (OKLCH, luminance)
// node audits/tools/phase4/tokens/fidelity/gen.mjs --css    -> the two palette blocks pasted into tokens.css
//
// Kept exactly: the eight house pastels and inks (audits/HUB-AUDIT-PROMPT.md:57-64). The 7:1 inks start from
// audits Phase 4 Table COLOR-9 and are darkened where Parchment's page needs it (inkHi()). Solved in OKLCH at the family's hue for a target WCAG luminance:
//   wash        light: L .972 C .024 · dark: L .285 C .05           tinted grounds, row highlights (decor only)
//   fill        light: the house pastel · dark: L .355 C .075       chips, selected pills, tile top, soft buttons
//   fill-strong light: Y .47 · dark: L .43 C .105                   tile gradient end, meters' track-on-fill (never text)
//   strong      light: Y .158 (white label >= 4.5) · dark: L .80    solid buttons, progress fill, badges
//   graphic     per hue, lightness-tiered (optimise-cvd.mjs)        identity rings, map markers, today ring (>= 3:1)
//   ink         light: the house ink · dark: L .875 C .085          text and icons on wash/fill/surface
//   ink-hi      light: the house 7:1 ink · dark: L .935 C .045      kiosk / Increase Contrast / 10-foot text
//   on          light: #FFFFFF · dark: L .235 C .055                label on the solid `strong` fill
import { parseHex, fromOklch, oklch, lum, contrast, hex } from './colour-lib.mjs';

export const HOUSE = {
  pink:       { name: 'Bubblegum',  fill: '#FFC8DD', ink: '#A3134F', inkHi: '#85003D' },
  peach:      { name: 'Peach',      fill: '#FFD6B8', ink: '#9A3F0A', inkHi: '#7A2E01' },
  butter:     { name: 'Butter',     fill: '#FFF1A8', ink: '#735A00', inkHi: '#634E01' },
  mint:       { name: 'Mint',       fill: '#B9F2D0', ink: '#0E6B3B', inkHi: '#01562D' },
  aqua:       { name: 'Aqua',       fill: '#B5EEF0', ink: '#0B6468', inkHi: '#025255' },
  sky:        { name: 'Sky',        fill: '#BFDDFF', ink: '#1A4F9C', inkHi: '#08408C' },
  periwinkle: { name: 'Periwinkle', fill: '#CCD3FF', ink: '#3440A8', inkHi: '#2A339A' },
  lavender:   { name: 'Lavender',   fill: '#E0CCFF', ink: '#5E2BAE', inkHi: '#531AA0' },
};
// Identity (graphic) tones from optimise-cvd.mjs: light `YMAX=0.21 RESTARTS=25 node optimise-cvd.mjs 11`,
// dark `SCHEMES=dark DYMIN=0.2 DLMAX=0.92 RESTARTS=40 node optimise-cvd.mjs 5`.
export const GRAPHIC = {
  light: { pink: '#D72D77', peach: '#954C00', butter: '#9C7A00', mint: '#006F46', aqua: '#007E79', sky: '#0071AB', periwinkle: '#606FFE', lavender: '#581DB2' },
  dark:  { pink: '#F2749E', peach: '#EE842C', butter: '#FFDB7E', mint: '#00976B', aqua: '#00C0B7', sky: '#9CD0FF', periwinkle: '#859FFF', lavender: '#8569D6' },
};
// Hue used for the solved steps (strong, fill-strong): nudged where the fill's own hue would turn muddy.
const STRONG_H = { pink: 356, peach: 45, butter: 80, mint: 158, aqua: 205, sky: 252, periwinkle: 276, lavender: 300 };
const DARK_H = { pink: 354, peach: 55, butter: 95, mint: 158, aqua: 200, sky: 250, periwinkle: 276, lavender: 302 };
// Semantic families: hue angles between the person hues; always shown with a glyph.
export const SEMANTIC = {
  success: { H: 148, strongY: 0.17, darkStrongL: 0.83, fillL: 0.93 },
  warning: { H: 70, strongY: 0.165, darkStrongL: 0.84, fillL: 0.915 },
  danger:  { H: 24, strongY: 0.06, darkStrongL: 0.72, fillL: 0.88 },
};

// 7:1 ink: the Table COLOR-9 value, darkened (same hue and chroma) until it reaches 7:1 on Parchment's page too (Y <= .062)
function inkHi(h) { const c = parseHex(h); if (lum(c) <= 0.062) return h; const o = oklch(c); return hex(solveY(0.062, o.C, o.H)); }
function solveY(targetLum, C, H, lo = 0.05, hi = 0.99) {
  for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (lum(fromOklch(m, C, H)) < targetLum) lo = m; else hi = m; }
  return fromOklch((lo + hi) / 2, C, H);
}
const DK = { washL: 0.285, washC: 0.05, fillL: 0.372, fillC: 0.075, fillStrongL: 0.445, fillStrongC: 0.105, strongL: 0.8, strongC: 0.14, inkL: 0.875, inkC: 0.085, inkHiL: 0.935, inkHiC: 0.045, onL: 0.235, onC: 0.055 };
function darkSet(Hd, strongL = DK.strongL) {
  return {
    wash: hex(fromOklch(DK.washL, DK.washC, Hd)),
    fill: hex(fromOklch(DK.fillL, DK.fillC, Hd)),
    'fill-strong': hex(fromOklch(DK.fillStrongL, DK.fillStrongC, Hd)),
    strong: hex(fromOklch(strongL, DK.strongC, Hd)),
    ink: hex(fromOklch(DK.inkL, DK.inkC, Hd)),
    'ink-hi': hex(fromOklch(DK.inkHiL, DK.inkHiC, Hd)),
    on: hex(fromOklch(DK.onL, DK.onC, Hd)),
  };
}
export function scales() {
  const out = {};
  for (const [k, h] of Object.entries(HOUSE)) {
    const H = oklch(parseHex(h.fill)).H, Hs = STRONG_H[k];
    out[k] = {
      name: h.name,
      light: {
        wash: hex(fromOklch(0.972, 0.024, H)), fill: h.fill,
        'fill-strong': hex(solveY(0.47, 0.15, Hs)), strong: hex(solveY(0.158, 0.2, Hs)),
        graphic: GRAPHIC.light[k], ink: h.ink, 'ink-hi': inkHi(h.inkHi), on: '#FFFFFF',
      },
      dark: { ...darkSet(DARK_H[k]), graphic: GRAPHIC.dark[k] },
    };
  }
  for (const [k, s] of Object.entries(SEMANTIC)) {
    const H = s.H;
    const strong = hex(solveY(s.strongY, 0.2, H));
    const d = darkSet(H, s.darkStrongL);
    out[k] = {
      name: k,
      light: {
        wash: hex(fromOklch(0.972, 0.024, H)), fill: hex(fromOklch(s.fillL, 0.08, H)),
        'fill-strong': hex(solveY(0.47, 0.15, H)), strong, graphic: strong,
        ink: hex(solveY(0.08, 0.16, H)), 'ink-hi': hex(solveY(0.048, 0.15, H)), on: '#FFFFFF',
      },
      dark: { ...d, graphic: d.strong },
    };
  }
  // graphite: the neutral accent (kiosk, signed out, a guest who picks "none")
  out.graphite = {
    name: 'Graphite',
    light: { wash: '#F4F4F7', fill: '#E3E3E8', 'fill-strong': hex(solveY(0.47, 0.012, 270)), strong: hex(solveY(0.158, 0.014, 270)), graphic: hex(solveY(0.06, 0.012, 270)), ink: '#48484F', 'ink-hi': '#2C2C30', on: '#FFFFFF' },
    dark: { wash: '#26262A', fill: '#3C3C41', 'fill-strong': '#4C4C52', strong: '#C4C4CC', graphic: '#E4E7F0', ink: '#DADADF', 'ink-hi': '#EDEDF0', on: '#1C1C1F' },
  };
  return out;
}
const ORDER = ['wash', 'fill', 'fill-strong', 'strong', 'graphic', 'ink', 'ink-hi', 'on'];
export function css() {
  const S = scales();
  const block = sch => Object.entries(S).map(([k, s]) => '  ' + ORDER.map(n => `--${k}-${n}: ${s[sch][n]};`).join(' ')).join('\n');
  return { light: block('light'), dark: block('dark') };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('/gen.mjs');
if (isMain && process.argv.includes('--css')) {
  const c = css();
  console.log('/* light */\n' + c.light + '\n/* dark */\n' + c.dark);
} else if (isMain) {
  const S = scales();
  const surf = { light: parseHex('#FFFFFF'), dark: parseHex('#1E1C1A') };
  for (const [k, s] of Object.entries(S)) for (const sch of ['light', 'dark']) {
    console.log(k.padEnd(10), sch.padEnd(5), ORDER.map(n => { const c = parseHex(s[sch][n]), o = oklch(c); return `${n}=${s[sch][n]}(L${o.L.toFixed(2)} C${o.C.toFixed(3)} Y${lum(c).toFixed(3)} ${contrast(c, surf[sch]).toFixed(2)})`; }).join(' '));
  }
}
