// Phase 3 shared platform-compliance counter: one method for every app, so the counts in audits/03-apps/*.md and the
// Phase 4 scorecard compare like with like. Static analysis only (regex over the file, comments stripped with line
// numbers kept); every hit is listed with its line so a reader can check it. It reads files and writes JSON; it runs no app.
//
//   node audits/tools/phase3/compliance.mjs                 → the shell (index.html) + all apps in apps.json, table on stdout
//   node audits/tools/phase3/compliance.mjs tally timer     → just those
//
// Output: audits/evidence/p3/_compliance/<app>.json (full hit lists) and _summary.json.
// Buckets:
//   css.*   declarations inside <style> blocks            js.*    string literals / style writes inside inline <script>
//   inline  style="…" attributes in the markup             svg     fill/stroke/stop-color attributes (markup and JS)
// A "literal" is a value that does not come from var(--…). 0, inherit, currentColor, transparent, none are not literals.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = path.join(ROOT, 'audits', 'evidence', 'p3', '_compliance');
fs.mkdirSync(OUT, { recursive: true });

// The shell (index.html) is counted too, as the pseudo-app "shell" (added for Phase 4).
const apps = [{ id: 'shell', file: 'index.html' }, ...JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps];
const want = process.argv.slice(2);
const list = want.length ? apps.filter(a => want.includes(a.id)) : apps;

// Tokens defined by design.css (custom properties anywhere in the file).
const designCss = fs.readFileSync(path.join(ROOT, 'apps', 'design.css'), 'utf8');
const DEFINED = new Set([...designCss.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)].map(m => m[1]));
// Tokens hub.js sets at runtime (style.setProperty('--x', …)).
const hubJs = fs.readFileSync(path.join(ROOT, 'apps', 'hub.js'), 'utf8');
for (const m of hubJs.matchAll(/setProperty\(\s*['"`](--[A-Za-z0-9_-]+)/g)) DEFINED.add(m[1]);

const NAMED = /\b(white|black|red|green|blue|gray|grey|silver|gold|orange|yellow|purple|pink|navy|teal|maroon|olive|lime|aqua|fuchsia|brown|tan|beige|ivory|khaki|coral|salmon|crimson|indigo|violet|lavender|plum|orchid|turquoise|cyan|magenta|wheat|linen|snow|azure)\b/i;
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
const FUNC = /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(/gi;
const COLOR_PROPS = /^(color|background|background-color|background-image|border|border-(?:top|right|bottom|left)(?:-color)?|border-color|outline|outline-color|fill|stroke|box-shadow|text-shadow|caret-color|accent-color|text-decoration(?:-color)?|column-rule|stop-color|flood-color|--[a-z0-9-]+)$/i;

function stripComments(src, re) { return src.replace(re, m => m.replace(/[^\n]/g, ' ')); }
const lineAt = (src, i) => src.slice(0, i).split('\n').length;

function blocks(src, tag) {
  const out = [], re = new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi');
  let m; while ((m = re.exec(src))) {
    if (tag === 'script' && /\ssrc\s*=/.test(m[1] || '')) continue;
    const start = m.index + m[0].indexOf('>') + 1;
    out.push({ start, end: start + m[2].length, attrs: m[1] || '' });
  }
  return out;
}

const isLiteralLen = v => /(?<![\w-])-?\d*\.?\d+(px|rem|em|pt|vh|vw|vmin|vmax|%|ch|ex)?(?![\w-])/.test(v.replace(/var\([^)]*\)/g, '')) && !/^\s*(0|0px|inherit|initial|unset|none|auto|normal)\s*(!important)?\s*$/.test(v);
// A value whose only colour functions are color-mix() of var(--token)s (and transparent/currentColor) is derived from
// tokens, not hardcoded: counted as css.colorDerived, not as a literal.
const tokenOnly = v => {
  let s = v; for (let i = 0; i < 4; i++) s = s.replace(/var\([^()]*(\([^()]*\)[^()]*)*\)/g, 'TOKEN');
  s = s.replace(/color-mix\(\s*in\s+[a-z-]+\s*,/gi, '(');
  return /TOKEN/.test(s) && !(s.match(HEX) || []).length && !/\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/i.test(s) && !NAMED.test(s);
};
const hasHexOrFunc = v => { const s = v.replace(/var\([^()]*(\([^()]*\)[^()]*)*\)/g, ''); return (s.match(HEX) || []).length + (s.match(FUNC) || []).length; };

function analyse(app) {
  const file = path.join(ROOT, app.file);
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split('\n').length;
  const r = {
    app: app.id, file: app.file, lines,
    css: { colorHex: [], colorFunc: [], colorDerived: [], colorNamed: [], fontSize: [], radius: [], spacing: [], shadow: [], duration: [], zIndex: [], fontFamily: [] },
    js: { colorHex: [], colorFunc: [], styleWrites: [] },
    inline: { decls: [] }, svg: { color: [] },
    tokens: { used: {}, undefinedUsed: [], localDefined: [] },
    scheme: { prefersColorScheme: [], dataScheme: [], dataTheme: [], reducedMotion: [], reducedTransparency: [], prefersContrast: [] },
    platform: {}, bypass: { localStorage: [], sessionStorage: [], indexedDB: [], fetch: [], xhr: [], alert: [], confirm: [], prompt: [], serviceWorker: [], externalUrl: [] },
    native: { hoverRules: [], hoverGuarded: 0, tapHighlight: [], userSelect: [], touchAction: [], overscroll: [], safeArea: [], focusVisible: [] },
  };
  const hit = (arr, i, text) => arr.push({ line: lineAt(raw, i), text: text.trim().slice(0, 140) });

  // ---- CSS ----
  const styles = blocks(raw, 'style');
  for (const b of styles) {
    const css = stripComments(raw.slice(b.start, b.end), /\/\*[\s\S]*?\*\//g);
    const base = b.start;
    // hover guard: find @media (hover: hover) block ranges
    const guarded = [];
    for (const m of css.matchAll(/@media[^{]*hover\s*:\s*hover[^{]*\{/g)) {
      let depth = 1, j = m.index + m[0].length; while (j < css.length && depth) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
      guarded.push([m.index, j]);
    }
    for (const m of css.matchAll(/([^{}]*:hover[^{}]*)\{/g)) {
      const inG = guarded.some(([a, z]) => m.index >= a && m.index < z);
      if (inG) r.native.hoverGuarded++; else hit(r.native.hoverRules, base + m.index, m[1]);
    }
    for (const m of css.matchAll(/@media[^{]*prefers-color-scheme[^{]*/g)) hit(r.scheme.prefersColorScheme, base + m.index, m[0]);
    for (const m of css.matchAll(/@media[^{]*prefers-reduced-motion[^{]*/g)) hit(r.scheme.reducedMotion, base + m.index, m[0]);
    for (const m of css.matchAll(/@media[^{]*prefers-reduced-transparency[^{]*/g)) hit(r.scheme.reducedTransparency, base + m.index, m[0]);
    for (const m of css.matchAll(/@media[^{]*prefers-contrast[^{]*/g)) hit(r.scheme.prefersContrast, base + m.index, m[0]);
    for (const m of css.matchAll(/:focus-visible/g)) hit(r.native.focusVisible, base + m.index, ':focus-visible');
    for (const m of css.matchAll(/([a-zA-Z-]+)\s*:\s*([^;{}]+)(?=[;}])/g)) {
      const prop = m[1].toLowerCase(), val = m[2], at = base + m.index, txt = `${prop}: ${val}`;
      if (prop.startsWith('--')) r.tokens.localDefined.push({ line: lineAt(raw, at), name: prop });
      const colorCount = hasHexOrFunc(val);
      if (colorCount && (COLOR_PROPS.test(prop) || /gradient/.test(val))) {
        const s = val.replace(/var\([^()]*(\([^()]*\)[^()]*)*\)/g, '');
        if ((s.match(HEX) || []).length) hit(r.css.colorHex, at, txt);
        else if (tokenOnly(val)) hit(r.css.colorDerived, at, txt);
        else hit(r.css.colorFunc, at, txt);
      } else if (COLOR_PROPS.test(prop) && !prop.startsWith('--') && NAMED.test(val.replace(/var\([^)]*\)/g, ''))) hit(r.css.colorNamed, at, txt);
      if (prop === 'font-size' && isLiteralLen(val)) hit(r.css.fontSize, at, txt);
      if (prop === 'font' && /\d/.test(val.replace(/var\([^)]*\)/g, ''))) hit(r.css.fontSize, at, txt);
      if (prop === 'font-family' || (prop === 'font' && /[a-z]-?[a-z]+\s*(,|$)/i.test(val))) hit(r.css.fontFamily, at, txt);
      if (/^border(-(top|bottom)-(left|right))?-radius$/.test(prop) && isLiteralLen(val)) hit(r.css.radius, at, txt);
      if (/^(margin|padding|gap|row-gap|column-gap|inset)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$/.test(prop) && isLiteralLen(val)) hit(r.css.spacing, at, txt);
      if (/^(box-shadow|text-shadow)$/.test(prop) && !/^\s*none\s*$/.test(val) && /\d/.test(val.replace(/var\([^)]*\)/g, ''))) hit(r.css.shadow, at, txt);
      if (/^(transition|transition-duration|animation|animation-duration)$/.test(prop) && /\d+m?s\b/.test(val.replace(/var\([^)]*\)/g, ''))) hit(r.css.duration, at, txt);
      if (prop === 'z-index' && /\d/.test(val.replace(/var\([^)]*\)/g, ''))) hit(r.css.zIndex, at, txt);
      if (prop === '-webkit-tap-highlight-color') hit(r.native.tapHighlight, at, txt);
      if (/user-select$/.test(prop)) hit(r.native.userSelect, at, txt);
      if (prop === 'touch-action') hit(r.native.touchAction, at, txt);
      if (/^overscroll-behavior/.test(prop)) hit(r.native.overscroll, at, txt);
    }
  }
  // ---- JS ----
  const scripts = blocks(raw, 'script');
  for (const b of scripts) {
    const js = stripComments(raw.slice(b.start, b.end), /\/\*[\s\S]*?\*\/|(?<![:'"`\\])\/\/[^\n]*/g);
    const base = b.start;
    for (const m of js.matchAll(/(['"`])(#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4}))\1/g)) {
      const before = js.slice(Math.max(0, m.index - 40), m.index);
      if (/(querySelector(All)?|getElementById|closest|matches|\$\$?)\(\s*$/.test(before)) continue;
      hit(r.js.colorHex, base + m.index, js.slice(Math.max(0, m.index - 30), m.index + m[0].length + 10));
    }
    for (const m of js.matchAll(/(?:color|background|fill|stroke|border|shadow)[^'"`\n]{0,20}?[:=]\s*['"`]?\s*(#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b)/gi)) {
      if (!r.js.colorHex.some(h => h.line === lineAt(raw, base + m.index))) hit(r.js.colorHex, base + m.index, m[0]);
    }
    for (const m of js.matchAll(/\b(?:rgba?|hsla?|oklch)\(\s*\d/gi)) hit(r.js.colorFunc, base + m.index, js.slice(Math.max(0, m.index - 20), m.index + 40));
    for (const m of js.matchAll(/\.style\.([a-zA-Z]+)\s*=\s*([^;\n]+)/g)) hit(r.js.styleWrites, base + m.index, m[0]);
    for (const m of js.matchAll(/\bstyle\s*=\s*\\?["']([^"'\\]*)/g)) if (/\d|#/.test(m[1])) hit(r.inline.decls, base + m.index, m[0]);
    for (const m of js.matchAll(/(fill|stroke|stop-color)\s*=\s*\\?["'](#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/g)) hit(r.svg.color, base + m.index, m[0]);
    const pat = (arr, re) => { for (const m of js.matchAll(re)) hit(arr, base + m.index, js.slice(m.index, m.index + 70)); };
    pat(r.bypass.localStorage, /\blocalStorage\b/g); pat(r.bypass.sessionStorage, /\bsessionStorage\b/g); pat(r.bypass.indexedDB, /\bindexedDB\b/g);
    pat(r.bypass.fetch, /\bfetch\s*\(/g); pat(r.bypass.xhr, /\bXMLHttpRequest\b/g); pat(r.bypass.serviceWorker, /navigator\.serviceWorker/g);
    pat(r.bypass.alert, /(?<![.\w])(?:window\.)?alert\s*\(/g); pat(r.bypass.confirm, /(?<![.\w])(?:window\.)?confirm\s*\(/g); pat(r.bypass.prompt, /(?<![.\w])(?:window\.)?prompt\s*\(/g);
    for (const m of js.matchAll(/matchMedia\(\s*['"`][^'"`]*prefers-color-scheme/g)) hit(r.scheme.prefersColorScheme, base + m.index, m[0]);
    for (const m of js.matchAll(/matchMedia\(\s*['"`][^'"`]*prefers-reduced-motion/g)) hit(r.scheme.reducedMotion, base + m.index, m[0]);
    for (const [k, re] of Object.entries({ get: /\bhub\.get\(/g, set: /\bhub\.set\(/g, remove: /\bhub\.remove\(/g, list: /\bhub\.list\(/g, onChange: /\bhub\.onChange\(/g, activity: /\bhub\.activity\(/g, migrate: /\bhub\.migrate\(/g, ready: /\bhub\.ready\(/g, canWrite: /\bhub\.canWrite\b/g, profile: /\bhub\.profile\b/g, voiceInput: /\bhub\.voiceInput\(/g, people: /\bhub\.people\(/g, avatarHtml: /\bhub\.avatarHtml\(/g, kioskNudge: /\bhub\.kioskNudge\(/g, setTheme: /\bhub\.setTheme\(/g, sync: /\bhub\.sync\b/g, other: /\bhub\.(?!get\(|set\(|remove\(|list\(|onChange\(|activity\(|migrate\(|ready\(|canWrite\b|profile\b|voiceInput\(|people\(|avatarHtml\(|kioskNudge\(|setTheme\(|sync\b)[A-Za-z_]+/g })) {
      const n = (js.match(re) || []).length; if (n) r.platform['hub.' + k] = (r.platform['hub.' + k] || 0) + n;
    }
    for (const m of js.matchAll(/\bhub\.(?!get\(|set\(|remove\(|list\(|onChange\(|activity\(|migrate\(|ready\(|canWrite\b|profile\b|voiceInput\(|people\(|avatarHtml\(|kioskNudge\(|setTheme\(|sync\b)([A-Za-z_]+)/g)) r.platform.otherNames = [...new Set([...(r.platform.otherNames || []), m[1]])];
  }
  // ---- markup (outside style/script) ----
  const skip = [...styles, ...scripts].map(b => [b.start, b.end]);
  const inSkip = i => skip.some(([a, z]) => i >= a && i < z);
  for (const m of raw.matchAll(/\sstyle\s*=\s*"([^"]*)"/g)) if (!inSkip(m.index) && /\d|#/.test(m[1])) hit(r.inline.decls, m.index, m[0]);
  for (const m of raw.matchAll(/\s(fill|stroke|stop-color)\s*=\s*"(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))"/g)) if (!inSkip(m.index)) hit(r.svg.color, m.index, m[0]);
  for (const m of raw.matchAll(/https?:\/\/[^\s"'`)<>]+/g)) if (!/w3\.org\/(2000|1999|XML)/.test(m[0])) hit(r.bypass.externalUrl, m.index, m[0]);
  for (const m of raw.matchAll(/env\(\s*safe-area-inset-[a-z]+/g)) hit(r.native.safeArea, m.index, m[0]);
  for (const m of raw.matchAll(/\[data-scheme[^\]]*\]|dataset\.scheme|data-scheme/g)) hit(r.scheme.dataScheme, m.index, m[0]);
  for (const m of raw.matchAll(/\[data-theme[^\]]*\]|dataset\.theme/g)) hit(r.scheme.dataTheme, m.index, m[0]);
  // tokens
  const local = new Set(r.tokens.localDefined.map(t => t.name));
  // Custom properties the app sets itself: inline style="--x:…", JS strings, style.setProperty('--x', …).
  for (const m of raw.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) local.add(m[1]);
  for (const m of raw.matchAll(/setProperty\(\s*['"`](--[A-Za-z0-9_-]+)/g)) local.add(m[1]);
  for (const m of raw.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)) {
    r.tokens.used[m[1]] = (r.tokens.used[m[1]] || 0) + 1;
    if (!DEFINED.has(m[1]) && !local.has(m[1]) && !r.tokens.undefinedUsed.some(u => u.name === m[1])) r.tokens.undefinedUsed.push({ name: m[1], line: lineAt(raw, m.index) });
  }
  r.platform.designCssLinked = /<link[^>]+href=["'][^"']*design\.css["']/.test(raw);
  const hubTag = raw.match(/<script[^>]+src=["'][^"']*hub\.js["'][^>]*>/);
  r.platform.hubJsTag = hubTag ? hubTag[0] : null;
  r.platform.dsBody = /<body[^>]*class=["'][^"']*\bds\b/.test(raw);
  r.platform.viewportFitCover = /viewport-fit\s*=\s*cover/.test(raw);
  return r;
}

const summary = [];
for (const a of list) {
  const r = analyse(a);
  fs.writeFileSync(path.join(OUT, `${a.id}.json`), JSON.stringify(r, null, 1));
  const n = x => x.length;
  summary.push({
    app: a.id, lines: r.lines,
    hex: n(r.css.colorHex) + n(r.js.colorHex), func: n(r.css.colorFunc) + n(r.js.colorFunc), derived: n(r.css.colorDerived), named: n(r.css.colorNamed), svg: n(r.svg.color),
    fontSize: n(r.css.fontSize), radius: n(r.css.radius), spacing: n(r.css.spacing), shadow: n(r.css.shadow), duration: n(r.css.duration), zIndex: n(r.css.zIndex),
    inlineStyle: n(r.inline.decls), styleWrites: n(r.js.styleWrites),
    tokensUsed: Object.keys(r.tokens.used).length, tokenRefs: Object.values(r.tokens.used).reduce((s, x) => s + x, 0), undefinedTokens: n(r.tokens.undefinedUsed),
    prefersColorScheme: n(r.scheme.prefersColorScheme), dataScheme: n(r.scheme.dataScheme), reducedMotion: n(r.scheme.reducedMotion),
    hoverUnguarded: n(r.native.hoverRules), confirmAlertPrompt: n(r.bypass.confirm) + n(r.bypass.alert) + n(r.bypass.prompt),
    localStorage: n(r.bypass.localStorage), fetch: n(r.bypass.fetch), externalUrls: n(r.bypass.externalUrl),
    designCss: r.platform.designCssLinked, ds: r.platform.dsBody,
  });
}
// A filtered run (named apps) updates only those rows of _summary.json, so it always holds every app.
const sumFile = path.join(OUT, '_summary.json');
let all = [];
try { all = JSON.parse(fs.readFileSync(sumFile, 'utf8')); } catch {}
for (const s of summary) { const i = all.findIndex(x => x.app === s.app); if (i >= 0) all[i] = s; else all.push(s); }
all.sort((x, y) => apps.findIndex(a => a.id === x.app) - apps.findIndex(a => a.id === y.app));
fs.writeFileSync(sumFile, JSON.stringify(all, null, 1));
console.table(summary);
console.log('Written:', path.relative(ROOT, OUT).replace(/\\/g, '/'));
