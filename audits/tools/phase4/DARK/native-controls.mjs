// Phase 4 DARK: native (UA-painted) form controls follow the OS colour scheme, not the hub theme.
// design.css sets `color-scheme: light dark` once on :root (apps/design.css:15) and never per theme, so the used
// colour scheme — which decides how the browser paints default-appearance selects, buttons, checkboxes and
// scrollbars — is the OS preference. This script opens the Larder (select#size) and the build guide (select#bmap,
// a native checkbox) as Eli in each theme x OS mode, reads computed styles, samples the rendered fill with the text
// hidden, and repeats with a counterfactual `color-scheme` matching the theme to prove the cause.
//   node audits/tools/phase4/DARK/native-controls.mjs [--engine webkit|chromium|both]
// Writes audits/evidence/p4/DARK/native-controls.json and a few 1x crops (native-*.png).
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';

const OUTD = path.join(ROOT, 'audits/evidence/p4/DARK');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const ENGINES = arg('engine', 'both') === 'both' ? ['webkit', 'chromium'] : [arg('engine')];
const CASES = [
  { theme: 'system', mode: 'light' },
  { theme: 'system', mode: 'dark' },
  { theme: 'midnight', mode: 'light' },
  { theme: 'forest', mode: 'light' },
  { theme: 'midnight', mode: 'dark' },
  { theme: 'parchment', mode: 'dark' },
  { theme: 'frost', mode: 'dark' },
  { theme: 'midnight', mode: 'light', inject: 'dark' },     // counterfactual: color-scheme follows the theme
  { theme: 'parchment', mode: 'dark', inject: 'light' },
];
const TARGETS = [
  { app: 'leftovers', sel: '#size', wait: '#size' },
  { app: 'dollywood', sel: '#bmap', wait: '#bmap' },
];

const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const Lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const CR = (a, b) => { const x = Lum(a), y = Lum(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
const parse = s => { const m = String(s).match(/[\d.]+/g); return m ? m.slice(0, 4).map(Number) : null; };
const hex = c => c ? '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase() : null;

async function medianOf(page, b64, inset, rightSkip) {
  return page.evaluate(async ({ b64, inset, rightSkip }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const x0 = inset, y0 = inset, w = Math.max(1, img.width - inset * 2 - rightSkip), h = Math.max(1, img.height - inset * 2);
    const d = g.getImageData(x0, y0, w, h).data; const r = [], gg = [], b = [];
    for (let i = 0; i < d.length; i += 4) { r.push(d[i]); gg.push(d[i + 1]); b.push(d[i + 2]); }
    const med = a => a.sort((p, q) => p - q)[a.length >> 1];
    return [med(r), med(gg), med(b)];
  }, { b64, inset, rightSkip });
}

const results = [];
for (const engine of ENGINES) {
  const L = await local({ variant: 'typical', engine });
  try {
    for (const c of CASES) {
      await L.reset('typical');
      if (c.theme !== 'system') { const r = await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: c.theme } }); if (r.status >= 300) throw new Error('theme row ' + r.status); }
      const d = await L.device({ device: 'ipad-portrait', mode: c.mode, profile: 'eli', localStorage: c.theme === 'system' ? null : { 'hub.theme': JSON.stringify(c.theme) } });
      try {
        for (const t of TARGETS) {
          const f = await d.openApp(t.app, { wait: t.wait });
          await sleep(1500);
          if (c.inject) await f.addStyleTag({ content: `:root{color-scheme:${c.inject} !important}` });
          await sleep(300);
          const el = await f.$(t.sel);
          if (!el) { results.push({ engine, ...c, app: t.app, sel: t.sel, missing: true }); continue; }
          const info = await el.evaluate(e => { const cs = getComputedStyle(e), rs = getComputedStyle(document.documentElement);
            return { color: cs.color, bg: cs.backgroundColor, appearance: cs.appearance || cs.webkitAppearance, colorScheme: cs.colorScheme, rootColorScheme: rs.colorScheme, dataTheme: document.documentElement.dataset.theme || null, dataScheme: document.documentElement.dataset.scheme, surface: rs.getPropertyValue('--surface').trim(), text: rs.getPropertyValue('--text').trim(), prefersDark: matchMedia('(prefers-color-scheme: dark)').matches, w: e.offsetWidth, h: e.offsetHeight }; });
          await el.scrollIntoViewIfNeeded().catch(() => {});
          const shotWith = (await el.screenshot()).toString('base64');
          await el.evaluate(e => { e.dataset.oc = e.style.color; e.style.color = 'transparent'; });
          await sleep(100);
          const shotBare = (await el.screenshot()).toString('base64');
          await el.evaluate(e => { e.style.color = e.dataset.oc || ''; });
          const fill = await medianOf(d.page, shotBare, t.noText ? 2 : 4, t.noText ? 0 : 28);
          const color = parse(info.color);
          const rec = { engine, ...c, app: t.app, sel: t.sel, ...info, renderedFill: hex(fill), fillMatchesDeclared: hex(parse(info.bg)) === hex(fill), textVsRenderedFill: t.noText ? null : CR(color, fill), textVsDeclaredBg: t.noText ? null : CR(color, parse(info.bg)) };
          results.push(rec);
          const tag = `${engine}-${t.app}-${t.sel.replace(/[^a-z]/gi, '')}-${c.theme}-${c.mode}${c.inject ? '-cs' + c.inject : ''}`;
          if (!t.noText && ['midnight', 'parchment'].includes(c.theme)) fs.writeFileSync(path.join(OUTD, `native-${tag}.png`), Buffer.from(shotWith, 'base64'));
          console.log([engine, c.theme, c.mode, c.inject || '', t.app, t.sel, 'scheme=' + info.rootColorScheme, 'declBg=' + hex(parse(info.bg)), 'rendered=' + rec.renderedFill, 'text=' + hex(color), 'ratio=' + rec.textVsRenderedFill].join(' '));
        }
      } finally { await d.close(); }
    }
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(OUTD, 'native-controls.json'), JSON.stringify({ note: 'See header of audits/tools/phase4/DARK/native-controls.mjs. renderedFill = median pixel inside the control with its text transparent (4 px inset, the 28 px arrow column skipped); textVsRenderedFill = WCAG ratio of the computed text colour on that fill.', results }, null, 1));
