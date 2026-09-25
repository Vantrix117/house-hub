// Phase 4 "migration" token proposal: writes tokens.css (the complete proposed token set).
//   node audits/tools/phase4/tokens/migration/build-tokens.mjs <out-dir>
// The hue values come from palette.mjs (deterministic); everything else is written here by hand.
// contrast.mjs then parses the written tokens.css on its own and checks every pair (it does not import this file).
import fs from 'node:fs';
import path from 'node:path';
import * as C from './color.mjs';
import { buildPalette, NEUTRALS, HOUSE, SEMANTIC, themesOf } from './palette.mjs';

const outDir = process.argv[2] || '.';
const pal = buildPalette();
const hx = c => C.toHex(c);
const HUES = Object.keys(HOUSE);
const SEM = Object.keys(SEMANTIC);
const FAMILIES = [...HUES, ...SEM, 'graphite'];

// Parchment is darker paper: its own searched set of person tones (same CVD gate), semantic/neutral tones darkened if needed
const parch = NEUTRALS.parchment;
const parchSurf = [parch.bg, parch.surface, parch.surface2, parch.elev, parch.track].map(C.parseHex);
const parchStrong = { ...pal.parchment };
for (const f of FAMILIES) {
  if (parchStrong[f]) continue;
  let c = pal.light[f].strong; let o = C.oklch(c); let n = 0;
  while (Math.min(...parchSurf.map(x => C.contrast(c, x))) < 3.05 && n++ < 200) { o = { ...o, L: o.L - 0.004 }; c = C.parseHex(C.toHex(C.fromOklch(o.L, o.C, o.H))); }
  if (n) parchStrong[f] = c;
}

// ── springs as CSS linear() ────────────────────────────────────────────────────────────────────
function spring({ response, damping, eps }) {
  const w = (2 * Math.PI) / response, z = damping;
  const x = t => {
    if (z < 1) { const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t)); }
    return 1 - Math.exp(-w * t) * (1 + w * t);
  };
  let T = 0.05; while (T < 2) { let settled = true; for (let t = T; t < T + 0.3; t += 0.005) if (Math.abs(1 - x(t)) > eps) { settled = false; break; } if (settled) break; T += 0.005; }
  const N = 24; const pts = [];
  for (let i = 0; i <= N; i++) { const t = (i / N) * T; pts.push([+(x(t) / x(T)).toFixed(4), +((i / N) * 100).toFixed(1)]); }
  let max = Math.max(...pts.map(p => p[0]));
  const body = pts.map(([v, p], i) => (i === 0 ? '0' : i === N ? '1' : `${v} ${p}%`)).join(', ');
  return { css: `linear(${body})`, ms: Math.round(T * 1000 / 10) * 10, overshoot: +((max - 1) * 100).toFixed(1) };
}
const SPR = {
  snappy: spring({ response: 0.24, damping: 0.78, eps: 0.006 }),
  gentle: spring({ response: 0.28, damping: 1.0, eps: 0.006 }),
  bouncy: spring({ response: 0.27, damping: 0.62, eps: 0.012 }),
};

// ── helpers to print blocks ─────────────────────────────────────────────────────────────────────
const L = []; const w = s => L.push(s);
const neutral = (t, g) => `  --bg: ${t.bg}; --surface: ${t.surface}; --surface-2: ${t.surface2}; --surface-elev: ${t.elev}; --hover: ${t.hover};
  --text: ${t.text}; --text-2: ${t.text2}; --text-3: ${t.muted}; --muted: var(--text-3); --placeholder: var(--text-3); --muted-decor: ${t.decor};
  --line: ${t.line}; --line-soft: ${t.lineSoft}; --field-border: ${t.fieldBorder}; --track: ${t.track};
  --shadow-rgb: ${t.shadow};
  --glass: ${g.glass}; --glass-strong: ${g.strong}; --glass-solid: ${g.solid}; --glass-strong-solid: ${g.strongSolid}; --glass-line: ${g.line};
  --glass-spec: ${g.spec}; --glass-edge: ${g.edge}; --glass-ring: ${g.ring}; --glass-inner: ${g.inner}; --glass-pickup: ${g.pickup};`;
const GL = {
  frost:     { glass: 'rgba(255,255,255,.78)', strong: 'rgba(255,255,255,.9)', solid: '#F9F9FB', strongSolid: '#FCFCFD', line: 'rgba(255,255,255,.7)', spec: 'rgba(255,255,255,.75)', edge: 'rgba(28,28,40,.10)', ring: 'rgba(255,255,255,.7)', inner: 'rgba(28,28,40,.10)', pickup: '10%' },
  hearth:    { glass: 'rgba(255,252,248,.78)', strong: 'rgba(255,252,248,.9)', solid: '#FBF7F2', strongSolid: '#FDFAF6', line: 'rgba(255,255,255,.55)', spec: 'rgba(255,255,255,.62)', edge: 'rgba(58,46,36,.10)', ring: 'rgba(255,255,255,.55)', inner: 'rgba(58,46,36,.10)', pickup: '12%' },
  parchment: { glass: 'rgba(246,239,224,.78)', strong: 'rgba(246,239,224,.9)', solid: '#F1E8D4', strongSolid: '#F4ECDB', line: 'rgba(255,250,240,.6)', spec: 'rgba(255,250,240,.6)', edge: 'rgba(58,42,26,.12)', ring: 'rgba(255,250,240,.55)', inner: 'rgba(58,42,26,.12)', pickup: '12%' },
  graphite:  { glass: 'rgba(36,36,38,.78)', strong: 'rgba(36,36,38,.9)', solid: '#1C1C1E', strongSolid: '#242426', line: 'rgba(255,255,255,.10)', spec: 'rgba(255,255,255,.12)', edge: 'rgba(0,0,0,.5)', ring: 'rgba(255,255,255,.09)', inner: 'rgba(0,0,0,.4)', pickup: '14%' },
  midnight:  { glass: 'rgba(45,38,33,.78)', strong: 'rgba(45,38,33,.9)', solid: '#2A231F', strongSolid: '#2F2823', line: 'rgba(255,255,255,.09)', spec: 'rgba(255,255,255,.14)', edge: 'rgba(0,0,0,.45)', ring: 'rgba(255,255,255,.08)', inner: 'rgba(0,0,0,.4)', pickup: '16%' },
  forest:    { glass: 'rgba(28,40,44,.78)', strong: 'rgba(28,40,44,.9)', solid: '#1A2629', strongSolid: '#1E2B2F', line: 'rgba(255,255,255,.09)', spec: 'rgba(255,255,255,.13)', edge: 'rgba(0,0,0,.45)', ring: 'rgba(255,255,255,.08)', inner: 'rgba(0,0,0,.4)', pickup: '16%' },
};
// palette selectors: one source per palette (GAP-TOK-8). .tp previews ride on the same lists.
const SEL = {
  frost: [':root', ':root[data-theme="frost"]', '.tp[data-preview="frost"]', '.tp[data-preview="system"]'],
  hearth: [':root[data-theme="hearth"]', ':root[data-theme="light"]', '.tp[data-preview="hearth"]'],
  parchment: [':root[data-theme="parchment"]', '.tp[data-preview="parchment"]'],
  graphite: [':root[data-theme="graphite"]', ':root[data-theme="system"][data-scheme="dark"]', ':root:not([data-theme])[data-scheme="dark"]', '.tp[data-preview="graphite"]', '.tp[data-preview="system"] .tp-half'],
  midnight: [':root[data-theme="midnight"]', ':root[data-theme="dark"]', '.tp[data-preview="midnight"]'],
  forest: [':root[data-theme="forest"]', '.tp[data-preview="forest"]'],
};
const DARK_SEL = [':root[data-scheme="dark"]', ':root[data-theme="midnight"]', ':root[data-theme="forest"]', ':root[data-theme="graphite"]', ':root[data-theme="dark"]', '.tp[data-preview="midnight"]', '.tp[data-preview="forest"]', '.tp[data-preview="graphite"]', '.tp[data-preview="system"] .tp-half'];
const LIGHT_SEL = [':root', '.tp[data-preview="frost"]', '.tp[data-preview="hearth"]', '.tp[data-preview="parchment"]', '.tp[data-preview="system"]'];
// every scope that must re-derive the aliases and the accent (GAP-TOK-6, GAP-TOK-8): the root, previews, person scopes
const SCOPE = [':root', '.tp', '.tp-half', '[data-accent]', '[data-tint]'];

w(`/* ════════════════════════════════════════════════════════════════════════════════════════════════
   House Hub design tokens v3 — Phase 4 proposal "migration" (audits/04-design-system.md).
   Generated by audits/tools/phase4/tokens/migration/build-tokens.mjs; verified by contrast.mjs in the same folder.

   Drop-in shape: this file replaces the token half of apps/design.css (lines 14-289); the .ds component half stays.
   Every token name design.css has today still resolves (aliases at the end of each section), so apps adopt the new
   role names one at a time. No build step: plain custom properties, attribute selectors, calc()/max()/round().

   hub.js contract (the only runtime writes):
     <html data-theme="system|hearth|parchment|frost|midnight|forest|graphite"   (never deleted; "system" is explicit)
           data-scheme="light|dark"         resolved; System follows the OS live
           data-kind="adult|kid|kiosk|guest"
           data-accent="<hue>"              the signed-in person's palette name (never a hex)
           data-text-size="s|m|l|xl|xxl"    person preference (like the theme)
           data-transparency="reduce|full"  person preference, 'auto' resolves from prefers-reduced-transparency
           data-contrast="more|normal"      resolved from prefers-contrast
           data-motion="reduce|full">       resolved from prefers-reduced-motion, live
     and per element: data-tint="<hue>" for any person-coloured element (avatar, feed row, tile).
   A synchronous <head> bootstrap sets the same attributes from localStorage before first paint.
   Licences: system-ui / ui-rounded stacks only (no SF Pro web font); icons from Lucide (ISC), never SF Symbols.
   ════════════════════════════════════════════════════════════════════════════════════════════════ */
`);

// ── 1. scales ────────────────────────────────────────────────────────────────────────────────────
w(`/* ── 1. scales: type, spacing, radius, targets, layout, layers, icons, motion (theme-independent) ── */
:root {
  /* type faces: a plain text face for everyone, the rounded face for numerals and kid mode, serif for reading only */
  --font-text: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  --font-rounded: ui-rounded, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-reading: ui-serif, "New York", "Iowan Old Style", "Palatino Linotype", Georgia, serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --font-numeric: var(--font-rounded);
  --font-ui: var(--font-text);                 /* re-pointed to rounded in kid mode */

  /* Dynamic Type: size = base x tier (iPad) x kind (kid/kiosk) x the person's text size, never under --fs-min */
  --type-tier: 1; --type-kind: 1; --text-size: 1;
  --type-scale: calc(var(--type-tier) * var(--type-kind) * var(--text-size));
  --fs-min: 11px;
  --fs-large-title: max(var(--fs-min), calc(34px * var(--type-scale)));
  --fs-title-1:     max(var(--fs-min), calc(28px * var(--type-scale)));
  --fs-title-2:     max(var(--fs-min), calc(22px * var(--type-scale)));
  --fs-title-3:     max(var(--fs-min), calc(20px * var(--type-scale)));
  --fs-headline:    max(var(--fs-min), calc(17px * var(--type-scale)));
  --fs-body:        max(var(--fs-min), calc(17px * var(--type-scale)));
  --fs-callout:     max(var(--fs-min), calc(16px * var(--type-scale)));
  --fs-subhead:     max(var(--fs-min), calc(15px * var(--type-scale)));
  --fs-footnote:    max(var(--fs-min), calc(13px * var(--type-scale)));
  --fs-caption-1:   max(var(--fs-min), calc(12px * var(--type-scale)));
  --fs-caption-2:   max(var(--fs-min), calc(11px * var(--type-scale)));
  --fs-display-1:   calc(48px * var(--type-scale));                     /* big stats, TV clock */
  --fs-display-2:   calc(64px * var(--type-scale));
  --fs-numeral:     clamp(calc(56px * var(--type-kind)), 16vw, calc(128px * var(--type-kind)));   /* timer, tally, star counts */
  --fs-field:       max(16px, var(--fs-body));                          /* inputs never under 16 px: no iOS focus zoom */
  --fw-regular: 400; --fw-medium: 500; --fw-semibold: 600; --fw-bold: 700; --fw-heavy: 800;   /* heavy: numerals only */
  --fw-large-title: var(--fw-bold); --fw-title: var(--fw-bold); --fw-title-3: var(--fw-semibold); --fw-headline: var(--fw-semibold);
  --fw-body: var(--fw-regular); --fw-caption: var(--fw-medium); --fw-button: var(--fw-semibold); --fw-numeral: var(--fw-bold);
  --lh-large-title: 1.2; --lh-title: 1.22; --lh-headline: 1.3; --lh-body: 1.3; --lh-caption: 1.33; --lh-read: 1.5;
  --ls-large-title: -0.022em; --ls-title-1: -0.016em; --ls-title-2: -0.01em; --ls-title-3: -0.008em; --ls-body: 0em; --ls-caps: .06em; --ls-numeral: -0.03em;
  --num: tabular-nums;                          /* font-variant-numeric for every changing number */

  /* spacing: the 4 pt grid; role tokens scale with the device tier and the kind, snapped back to the grid */
  --sp-0-5: 2px; --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-5: 20px;
  --sp-6: 24px; --sp-8: 32px; --sp-10: 40px; --sp-12: 48px; --sp-16: 64px;
  --space-tier: 1; --space-kind: 1;
  --margin-base: 16px;
  --margin:   round(nearest, calc(var(--margin-base) * var(--space-kind)), 4px);
  --pad-card: round(nearest, calc(16px * var(--space-tier) * var(--space-kind)), 4px);
  --pad-row-y: round(nearest, calc(12px * var(--space-kind)), 4px);
  --pad-row-x: round(nearest, calc(16px * var(--space-kind)), 4px);
  --pad-sheet: round(nearest, calc(20px * var(--space-tier) * var(--space-kind)), 4px);
  --gap-list: round(nearest, calc(12px * var(--space-kind)), 4px);
  --gap-grid: round(nearest, calc(16px * var(--space-tier) * var(--space-kind)), 4px);
  --gap-inline: var(--sp-2);

  /* layout: named columns and the breakpoints hub.js and the lint know (media queries cannot read var()):
     compact < 744 px (iPhone) · regular >= 744 (iPad portrait) · wide >= 1024 (iPad landscape, sidebar) · xl >= 1366 */
  --col-narrow: 560px; --col-read: 720px; --col-wide: 1200px;
  --bp-regular: 744px; --bp-wide: 1024px; --bp-xl: 1366px;
  --safe-top: env(safe-area-inset-top, 0px); --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px); --safe-right: env(safe-area-inset-right, 0px);

  /* radius: roles, concentric by construction (card = control + card padding) */
  --r-control: round(nearest, calc(12px * var(--space-kind)), 2px);
  --r-card: calc(var(--r-control) + var(--pad-card));
  --r-sheet: calc(var(--r-card) + var(--sp-2));
  --r-button: 999px; --r-chip: 999px; --r-full: 999px;
  --r-field: var(--r-control);
  --r-inner: max(0px, calc(var(--r-outer, var(--r-card)) - var(--inset, var(--pad-card))));   /* set --r-outer/--inset on the parent */
  --tile: 56px; --tile-radius-ratio: .25;
  --r-tile: calc(var(--tile) * var(--tile-radius-ratio));

  /* targets and borders */
  --tap: 44px; --tap-lg: 60px; --tap-min: 44px;
  --btn-h: var(--tap); --btn-h-lg: var(--tap-lg); --btn-pad-x: round(nearest, calc(20px * var(--space-kind)), 4px);
  --bw: 1px; --bw-strong: 1.5px; --bw-focus: 3px; --focus-offset: 2px;
  --ring-gap: 2px; --ring-w: 2.5px; --ring-w-lg: 4px;

  /* layers: one ladder for every document */
  --z-raised: 1; --z-sticky: 10; --z-nav: 20; --z-fab: 30; --z-scrim: 40; --z-sheet: 50; --z-toast: 60; --z-top: 70;

  /* icons: one size scale, one stroke; scaled by kind */
  --icon-kind: 1;
  --icon-xs: calc(16px * var(--icon-kind)); --icon-sm: calc(20px * var(--icon-kind)); --icon-md: calc(24px * var(--icon-kind));
  --icon-lg: calc(28px * var(--icon-kind)); --icon-xl: calc(32px * var(--icon-kind));
  --icon-stroke: 1.75;                          /* with vector-effect: non-scaling-stroke, 1.75 px at every size */
  --icon-duo-opacity: .2;                       /* duotone fill: set --icon-duo on the <svg>, read by the sprite's .duo path */

  /* motion: durations, springs as linear() approximations, press, reduce-motion distances */
  --dur-press: 90ms; --dur-1: 120ms; --dur-2: 220ms; --dur-3: 320ms; --dur-exit: 180ms;
  --dur-progress: 800ms; --dur-pulse: 1200ms; --dur-shimmer: 1400ms; --dur-ambient: 2400ms; --dur-crossfade: 2500ms;
  --ambient-cycles: 3;                          /* ambient loops stop after N cycles; 0 under reduce */
  --ease: cubic-bezier(.2, .7, .2, 1);
  --ease-in-out: cubic-bezier(.65, 0, .35, 1);
  --ease-exit: cubic-bezier(.4, 0, 1, 1);
  --spring-snappy: ${SPR.snappy.css};
  --dur-spring-snappy: ${SPR.snappy.ms}ms;     /* overshoot ${SPR.snappy.overshoot} % — presses, toggles, tab indicator */
  --spring-gentle: ${SPR.gentle.css};
  --dur-spring-gentle: ${SPR.gentle.ms}ms;     /* overshoot ${SPR.gentle.overshoot} % — sheets, pages, layout */
  --spring-bouncy: ${SPR.bouncy.css};
  --dur-spring-bouncy: ${SPR.bouncy.ms}ms;     /* overshoot ${SPR.bouncy.overshoot} % — celebration only (stars, badges) */
  --press-scale: .97; --press-scale-sm: .94; --press-scale-lg: .985;
  --rise: 24px; --rise-sm: 8px; --pop-scale: .96;

  /* glass: composite recipe (CONS-GLASS-1) — apps write var(--glass-bg) / var(--glass-filter) / var(--glass-shadow) */
  --blur-sm: 10px; --blur: 18px; --blur-lg: 28px; --scrim-blur: 0px;
  --glass-saturate: 1.4; --glass-brightness: 1.02;
  --glass-filter: blur(var(--blur)) saturate(var(--glass-saturate)) brightness(var(--glass-brightness));
  --sheen-x: 30%;
}
@media (min-width: 744px)  { :root { --type-tier: 1.12; --space-tier: 1.25; --margin-base: 24px; } }
@media (min-width: 1024px) { :root { --margin-base: 32px; } }
`);

// ── 2. neutral palettes ──────────────────────────────────────────────────────────────────────────
w(`/* ── 2. palettes: neutrals, glass and shadow tint, one block per palette ───────────────────────────
   System = Frost by day, Graphite by night (the HOUSE STYLE grouped neutrals). Hearth, Parchment, Midnight and Forest
   stay as named choices. Midnight and Forest cards now lift 1.2:1 off the page and their wells are lighter than cards. */`);
for (const [id, sel] of Object.entries(SEL)) {
  const t = NEUTRALS[id];
  w(`${sel.join(',\n')} {\n  color-scheme: ${t.scheme};\n${neutral(t, GL[id])}\n}`);
}

// ── 3. hue families ──────────────────────────────────────────────────────────────────────────────
const famLight = f => { const v = pal.light[f]; return `  --${f}-fill: ${hx(v.fill)}; --${f}-fill-2: ${hx(v.fill2)}; --${f}-strong: ${hx(v.strong)}; --${f}-ink: ${hx(v.ink)}; --${f}: var(--${f}-ink); --on-${f}: ${hx(v.on)};`; };
const famDark = f => { const v = pal.dark[f]; return `  --${f}-strong: ${hx(v.strong)}; --${f}-ink: ${hx(v.ink)}; --${f}: var(--${f}-ink); --on-${f}: ${hx(v.on)};\n  --${f}-fill: color-mix(in oklab, var(--${f}-strong) ${v.pct[0]}%, var(--surface)); --${f}-fill-2: color-mix(in oklab, var(--${f}-strong) ${v.pct[1]}%, var(--surface));`; };
w(`
/* ── 3. hue families: the eight house pastels (people, apps, categories), three semantic families, a neutral ──
   Roles per family:  -fill (pastel background) · -fill-2 (the saturated end of a tile gradient) · -strong (graphics:
   rings, bars, markers; >= 3:1) · -ink (text and icons on the fill and on every surface; >= 4.5:1) · bare name = the
   ink (so every existing color: var(--gold) becomes AA) · on-<family> (text on a solid bare-name fill; >= 4.5:1).
   Light: the house fills exactly, inks darkened only where a pair failed. Dark: the pastel is the glowing ink,
   fills are deep tints of the strong tone in the palette's own surface. Semantic hues sit between person hues. */
${LIGHT_SEL.join(',\n')} {
${FAMILIES.map(famLight).join('\n')}
}
${DARK_SEL.join(',\n')} {
  color-scheme: dark;
${FAMILIES.map(famDark).join('\n')}
}
/* Parchment is darker paper: its own set of strong tones (searched under the same colour-blind gate) */
:root[data-theme="parchment"], .tp[data-preview="parchment"] {
${Object.entries(parchStrong).map(([f, c]) => `  --${f}-strong: ${hx(c)};`).join('\n')}
}
`);

// ── 4. roles derived from the palette (re-declared in every scope) ──────────────────────────────────
w(`/* ── 4. roles and aliases, re-derived in every scope that can change a palette or a person ──────────
   (:root, the theme previews, and any element carrying data-accent / data-tint). This is what makes a local
   person colour repaint its soft, tint, deep, graphic and focus tokens (GAP-TOK-6). */
${SCOPE.join(', ')} {
  /* the signed-in person (or data-tint element) → accent roles */
  --accent: var(--p-strong);                  /* graphic role (rings, bars, glows); never small text */
  --accent-graphic: var(--p-strong);
  --accent-soft: var(--p-fill);
  --accent-tint: var(--p-fill-2);
  --accent-deep: var(--p-ink);                /* the ink role: text, icons, filled-button background */
  --accent-fg: var(--p-ink);
  --on-accent: var(--p-on);
  --accent-glow: color-mix(in srgb, var(--p-strong) 35%, transparent);
  --tint: var(--p-strong); --tint-fill: var(--p-fill); --tint-fill-2: var(--p-fill-2); --tint-ink: var(--p-ink); --tint-graphic: var(--p-strong);
  --tile-bg: linear-gradient(160deg, var(--p-fill), var(--p-fill-2));
  --hero-bg: radial-gradient(120% 120% at 100% 0%, var(--p-fill) 0%, var(--p-fill-2) 100%);
  --hero-ink: var(--p-ink); --hero-ink-2: var(--text); --hero-btn-bg: var(--surface); --hero-btn-ink: var(--p-ink);
  --sel-fill: var(--p-fill); --sel-ink: var(--p-ink); --sel-indicator: var(--p-strong); --sel-weight: var(--fw-bold);
  --today-ring: var(--p-strong);
  /* a whole page or card washed in a person/app hue (F260 New Testament weeks, Prayer family list): text stays AA */
  --paper-tint: color-mix(in oklab, var(--p-fill) 40%, var(--bg)); --surface-tint: color-mix(in oklab, var(--p-fill) 30%, var(--surface)); --well-tint: color-mix(in oklab, var(--p-fill) 30%, var(--surface-2));
  --focus-ring-color: var(--p-ink);
  --focus-ring: 0 0 0 var(--focus-offset) var(--surface), 0 0 0 calc(var(--focus-offset) + var(--bw-focus)) var(--focus-ring-color);
  --wash: radial-gradient(120% 70% at 50% -10%, color-mix(in srgb, var(--p-strong) 10%, transparent), transparent 60%);
  --glass-bg: linear-gradient(to bottom, var(--glass-spec) 0, transparent 34%),
              radial-gradient(90% 70% at var(--sheen-x) -10%, color-mix(in srgb, var(--p-strong) var(--glass-pickup), transparent), transparent 62%), var(--glass);
  --glass-bg-strong: linear-gradient(to bottom, var(--glass-spec) 0, transparent 34%),
              radial-gradient(90% 70% at var(--sheen-x) -10%, color-mix(in srgb, var(--p-strong) var(--glass-pickup), transparent), transparent 62%), var(--glass-strong);
  --material-chrome-bg: var(--glass-bg-strong);
  --glow-accent: 0 8px 24px -8px var(--accent-glow); --glow-accent-lg: 0 20px 48px -20px var(--accent-glow);
  --accent-strong: var(--accent-deep); --focus: var(--focus-ring);   /* legacy names */
}
/* palette-level roles and legacy names: re-derived on the root and in the theme previews only */
:root, .tp, .tp-half {
  /* neutral roles */
  --fill: var(--surface-2);
  --cell-empty: var(--track); --cell-empty-border: var(--field-border);
  --switch-off: var(--field-border); --switch-on: var(--ok); --switch-knob: var(--on-ok);
  --status-synced: var(--ok-strong); --status-pending: var(--warn-strong); --status-offline: var(--field-border); --status-error: var(--danger-strong);
  --attention: var(--warn); --attention-fill: var(--warn-fill);   /* "time's up", "use it up": not --danger */
  --select-chevron: linear-gradient(45deg, transparent 50%, var(--text-3) 50%) no-repeat right calc(var(--sp-4) + 5px) center / 6px 6px,
                    linear-gradient(135deg, var(--text-3) 50%, transparent 50%) no-repeat right var(--sp-4) center / 6px 6px;
  --scrollbar-thumb: color-mix(in srgb, var(--text) 28%, transparent); --scrollbar-track: transparent;
  --viewer-loading-bg: var(--bg);
  --skeleton: var(--surface-2); --skeleton-sheen: color-mix(in srgb, var(--surface) 70%, transparent);

  /* elevation roles over --e1..--e4, tinted per palette; dark adds a top highlight instead of more black */
  --e1: 0 1px 2px rgba(var(--shadow-rgb), calc(.06 * var(--shadow-k))), 0 1px 1px rgba(var(--shadow-rgb), calc(.04 * var(--shadow-k)));
  --e2: 0 1px 2px rgba(var(--shadow-rgb), calc(.05 * var(--shadow-k))), 0 6px 18px -8px rgba(var(--shadow-rgb), calc(.16 * var(--shadow-k)));
  --e3: 0 2px 6px rgba(var(--shadow-rgb), calc(.06 * var(--shadow-k))), 0 18px 40px -16px rgba(var(--shadow-rgb), calc(.26 * var(--shadow-k)));
  --e4: 0 4px 12px rgba(var(--shadow-rgb), calc(.08 * var(--shadow-k))), 0 32px 72px -24px rgba(var(--shadow-rgb), calc(.36 * var(--shadow-k)));
  --elev-card: var(--hl-top), var(--e1); --elev-control: var(--hl-top), var(--e2); --elev-float: var(--hl-top), var(--e3);
  --elev-overlay: var(--hl-top), var(--e4); --elev-toast: var(--e3);
  --elev-up: 0 -12px 40px -24px rgba(var(--shadow-rgb), calc(.26 * var(--shadow-k)));
  --inset-pressed: inset 0 1px 3px rgba(var(--shadow-rgb), calc(.16 * var(--shadow-k)));
  /* highlight and shade overlays: the only rgba literals allowed in components */
  --hi-1: rgba(255,255,255,.06); --hi-2: rgba(255,255,255,.14); --hi-3: rgba(255,255,255,.22); --hi-4: rgba(255,255,255,.6);
  --shade-1: rgba(0,0,0,.04); --shade-2: rgba(0,0,0,.08); --shade-3: rgba(0,0,0,.12); --shade-4: rgba(0,0,0,.25); --shade-5: rgba(0,0,0,.45);

  /* glass composites and material roles (the person-tinted --glass-bg / --glass-bg-strong are in the rule above) */
  --glass-shadow: inset 0 1px 0 var(--hairline), inset 0 -1px 0 var(--glass-edge), inset 0 -12px 28px -18px var(--glass-inner), 0 0 0 1px var(--glass-ring), var(--e2);
  --glass-look: color-mix(in srgb, var(--surface) 78%, var(--bg));      /* content "glass": the look, no blur */
  --material-chrome-filter: var(--glass-filter);
  --material-look-bg: var(--glass-look); --material-look-filter: none;
  --toast-bg: var(--glass-inverse); --toast-ink: var(--glass-inverse-ink); --toast-action: var(--glass-inverse-ink);

  /* legacy names (design.css v2) → roles; delete each once the lint finds no reader */
  --gold: var(--butter); --gold-soft: var(--butter-fill); --gold-ink: var(--butter-ink);
  --olive: var(--ok); --olive-soft: var(--ok-fill); --olive-ink: var(--ok-ink);
  --terra: var(--danger); --terra-soft: var(--danger-fill); --terra-ink: var(--danger-ink);
  --teal: var(--aqua); --teal-soft: var(--aqua-fill); --teal-ink: var(--aqua-ink);
  --slate: var(--periwinkle); --slate-soft: var(--periwinkle-fill); --slate-ink: var(--periwinkle-ink);
  --mocha: var(--peach); --mocha-soft: var(--peach-fill); --mocha-ink: var(--peach-ink);
  --ok-soft: var(--ok-fill); --warn-soft: var(--warn-fill); --danger-soft: var(--danger-fill);
  --info: var(--sky); --info-soft: var(--sky-fill); --info-ink: var(--sky-ink);        /* unused today: deprecated */
  --bg-2: var(--surface-2);
  --shadow-sm: var(--e1); --shadow: var(--e2); --shadow-lg: var(--e3);
  --font-sans: var(--font-ui); --font-serif: var(--font-reading); --font-display: var(--font-text);
  --fs-xs: var(--fs-caption-1); --fs-sm: var(--fs-subhead); --fs-md: var(--fs-body); --fs-lg: var(--fs-title-3);
  --fs-xl: var(--fs-title-2); --fs-2xl: var(--fs-title-1); --fs-3xl: var(--fs-large-title); --fs-4xl: var(--fs-display-1);
  --fs-hero: clamp(calc(34px * var(--type-scale)), 7.5vw, calc(46px * var(--type-scale)));
  --lh-tight: 1.1; --lh-snug: 1.25; --lh: 1.45; --ls-tight: var(--ls-large-title);
  --r-sm: 12px; --r: 16px; --r-lg: 22px; --r-xl: 28px; --r-2xl: 36px;
  --max: var(--col-wide); --max-read: var(--col-read);
  --spring: var(--spring-snappy); --ease-out: var(--ease);            /* --dur (0 readers) is removed */
  /* app colours: a hue family per app (apps.json "hue"); tiles paint --tile-bg through data-tint */
${[['f260', 'periwinkle'], ['leftovers', 'mint'], ['prayer', 'lavender'], ['tally', 'aqua'], ['timer', 'peach'], ['dollywood', 'bubblegum'], ['dollywood-live', 'sky'], ['kidverse', 'butter'], ['verses', 'periwinkle']].map(([a, h]) => `  --app-${a}: var(--${h}-strong); --app-${a}-fill: var(--${h}-fill); --app-${a}-ink: var(--${h}-ink);`).join('\n')}
  /* categorical ramp (F260 book groups, Prayer --d0..d7, map categories): families in a fixed order */
  --cat-1: var(--butter); --cat-2: var(--peach); --cat-3: var(--mint); --cat-4: var(--aqua); --cat-5: var(--periwinkle); --cat-6: var(--lavender); --cat-7: var(--bubblegum); --cat-8: var(--sky);
  --cat-1-fill: var(--butter-fill); --cat-2-fill: var(--peach-fill); --cat-3-fill: var(--mint-fill); --cat-4-fill: var(--aqua-fill);
  --cat-5-fill: var(--periwinkle-fill); --cat-6-fill: var(--lavender-fill); --cat-7-fill: var(--bubblegum-fill); --cat-8-fill: var(--sky-fill);
  /* semantic ramp (Larder freshness, park wait bands): good → watch → act → off */
  --ramp-good: var(--ok); --ramp-good-fill: var(--ok-fill); --ramp-good-solid: var(--ok); --on-ramp-good: var(--on-ok);
  --ramp-watch: var(--warn); --ramp-watch-fill: var(--warn-fill); --ramp-watch-solid: var(--warn); --on-ramp-watch: var(--on-warn);
  --ramp-act: var(--danger); --ramp-act-fill: var(--danger-fill); --ramp-act-solid: var(--danger); --on-ramp-act: var(--on-danger);
  --ramp-off: var(--graphite); --ramp-off-fill: var(--graphite-fill); --ramp-off-solid: var(--graphite); --on-ramp-off: var(--on-graphite);
}
/* the neutral default: signed out, the PIN pad before a person is known, and the TV (--accent-none) */
:root, .tp, .tp-half { --p-strong: var(--graphite-strong); --p-fill: var(--graphite-fill); --p-fill-2: var(--graphite-fill-2); --p-ink: var(--graphite-ink); --p-on: var(--on-graphite); }
${[...HUES, 'graphite'].map(h => `[data-accent="${h}"], [data-accent="${h}"] .tp, [data-accent="${h}"] .tp-half, [data-tint="${h}"] { --p-strong: var(--${h}-strong); --p-fill: var(--${h}-fill); --p-fill-2: var(--${h}-fill-2); --p-ink: var(--${h}-ink); --p-on: var(--on-${h}); }`).join('\n')}

/* scheme-level role values */
${LIGHT_SEL.join(', ')} {
  --shadow-k: 1; --hl-top: inset 0 0 0 transparent;
  --hairline: rgba(255,255,255,.6); --scrim: rgba(var(--shadow-rgb), .45);
  --glass-inverse: rgba(28,28,30,.9); --glass-inverse-solid: #1C1C1E; --glass-inverse-line: rgba(255,255,255,.12); --glass-inverse-ink: #FFFFFF;
  --press-filter: brightness(.95);
}
${DARK_SEL.join(', ')} {
  --shadow-k: 3; --hl-top: inset 0 1px 0 rgba(255,255,255,.07);
  --hairline: rgba(255,255,255,.08); --scrim: rgba(0,0,0,.62);
  --glass-inverse: rgba(72,72,74,.92); --glass-inverse-solid: #3A3A3C; --glass-inverse-line: rgba(255,255,255,.14); --glass-inverse-ink: #F5F5F7;
  --press-filter: brightness(1.15);
}
`);

// ── 5. kinds and preferences ─────────────────────────────────────────────────────────────────────
w(`/* ── 5. kinds: kids (pre-readers) and the 10-foot TV ─────────────────────────────────────────────── */
:root[data-kind="kid"] {
  --font-ui: var(--font-rounded); --font-text: var(--font-rounded);
  --type-kind: 1.18; --fs-min: 16px; --space-kind: 1.25; --icon-kind: 1.25;
  --tap: 64px; --tap-lg: 84px; --tap-min: 64px;
  --r-sm: 16px; --r: 22px; --r-lg: 28px; --r-xl: 36px; --r-2xl: 44px;   /* legacy radii, as today */
}
:root[data-kind="kiosk"] {
  --type-kind: 1.5; --fs-min: 28px; --space-kind: 1.5; --icon-kind: 1.5;
  --tap: 56px; --tap-lg: 76px; --tap-min: 56px;
  --glass-filter: none; --material-chrome-filter: none;   /* the TV board paints the glass look, never a live blur */
  --ambient-cycles: infinite;                              /* the board's slow crossfade is its purpose */
}

/* ── 6. person preferences and accessibility modes (hub.js resolves each to an attribute, live) ───────── */
:root[data-text-size="s"] { --text-size: .9; }   :root[data-text-size="l"] { --text-size: 1.12; }
:root[data-text-size="xl"] { --text-size: 1.25; } :root[data-text-size="xxl"] { --text-size: 1.4; }
:root[data-transparency="reduce"] {
  --glass: var(--glass-solid); --glass-strong: var(--glass-strong-solid); --glass-inverse: var(--glass-inverse-solid);
  --glass-filter: none; --material-chrome-filter: none; --glass-pickup: 0%; --glass-spec: transparent; --scrim-blur: 0px;
}
:root[data-contrast="more"] {
  --glass: var(--glass-solid); --glass-strong: var(--glass-strong-solid); --glass-inverse: var(--glass-inverse-solid);
  --glass-pickup: 0%; --glass-edge: var(--field-border); --hairline: var(--field-border);
  --text-3: var(--text-2); --line: var(--field-border); --line-soft: var(--field-border);
  --bw: 1.5px; --bw-focus: 4px;
}
:root[data-motion="reduce"] {
  --rise: 0px; --rise-sm: 0px; --pop-scale: 1; --press-scale: 1; --press-scale-sm: 1; --press-scale-lg: 1;
  --spring-snappy: var(--ease); --spring-gentle: var(--ease); --spring-bouncy: var(--ease);   /* crossfade, no travel */
  --dur-progress: 0ms; --ambient-cycles: 0; --dur-crossfade: 400ms;
}
`);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'tokens.css'), L.join('\n'));
fs.writeFileSync(path.join(outDir, 'palette.json'), JSON.stringify({
  note: 'Derived by palette.mjs + build-tokens.mjs; the values tokens.css was written with.',
  meta: pal.meta, springs: Object.fromEntries(Object.entries(SPR).map(([k, v]) => [k, { ms: v.ms, overshootPct: v.overshoot }])),
  light: Object.fromEntries(Object.entries(pal.light).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([r, c]) => [r, Array.isArray(c) ? c : hx(c)]))])),
  dark: Object.fromEntries(Object.entries(pal.dark).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([r, c]) => [r, Array.isArray(c) ? c : hx(c)]))])),
  parchmentStrong: Object.fromEntries(Object.entries(parchStrong).map(([k, c]) => [k, hx(c)])),
}, null, 2));
console.log('wrote', path.join(outDir, 'tokens.css'), L.join('\n').length, 'chars; springs', JSON.stringify(Object.fromEntries(Object.entries(SPR).map(([k, v]) => [k, [v.ms, v.overshoot]]))), 'parchment overrides', Object.keys(parchStrong).join(','));
