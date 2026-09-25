// Phase 4 COLOR, skeptic #2 for "muted-on-wells-and-derived-surfaces". Independent of palette.mjs / components.mjs.
// Part A: parse apps/design.css token blocks; WCAG ratio of --muted on bg / surface / surface-2 per light theme, and on
//         F260's body.nt color-mix surfaces (apps/f260.html:30-33), computed in float (no hex rounding).
// Part B: on the local instance (WebKit), for each light theme, walk every visible text node whose computed colour is the
//         page's computed --muted, composite its ancestor background chain (alpha-aware) and compute the ratio.
//         Grouped by app / background; records whether F260 has body.nt at the demo clock.
// Usage: node audits/tools/phase4/COLOR/verify-muted-on-wells-and-derived-surfaces-2.mjs
import fs from 'node:fs'; import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p4/COLOR'); fs.mkdirSync(EV, { recursive: true });
const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + .05) / (y + .05)).toFixed(3); };
const hx = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, p) => a.map((v, i) => v * p + b[i] * (1 - p));

// ── Part A ──
const css = fs.readFileSync('apps/design.css', 'utf8');
function block(re) { const i = css.search(re); const s = css.indexOf('{', i); let d = 0, j = s; for (; j < css.length; j++) { if (css[j] === '{') d++; else if (css[j] === '}' && --d === 0) break; } return css.slice(s + 1, j); }
const vars = b => Object.fromEntries([...b.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)].map(m => [m[1], m[2]]));
const hearth = vars(block(/^:root \{/m));
const T = { hearth, parchment: { ...hearth, ...vars(block(/:root\[data-theme="parchment"\]/)) }, frost: { ...hearth, ...vars(block(/:root\[data-theme="frost"\]/)) } };
const A = {};
for (const [t, v] of Object.entries(T)) {
  const m = hx(v.muted), tl = hx(v.teal);
  A[t] = { muted: v.muted, bg: ratio(m, hx(v.bg)), surface: ratio(m, hx(v.surface)), surface2: ratio(m, hx(v['surface-2'])),
    ntPaper: ratio(m, mix(hx(v.bg), tl, .93)), ntRaised: ratio(m, mix(hx(v.surface), tl, .94)), ntSunk: ratio(m, mix(hx(v['surface-2']), tl, .93)) };
  console.log('A', t, JSON.stringify(A[t]));
}
console.log('A comment', (css.match(/--muted:[^\n]*/) || [''])[0]);

// ── Part B ──
const PROBE = () => {
  const parse = s => { if (!s || s === 'transparent') return null; const srgb = /^color\(srgb/.test(s); const n = s.replace(/^color\(srgb/, '').match(/[\d.]+/g); if (!n) return null; const m = n.map(Number);
    return { c: m.slice(0, 3).map(v => srgb ? v * 255 : v), a: m.length > 3 ? m[3] : 1 }; };
  const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  const lum = ([r, g, b]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
  const probe = document.createElement('span'); probe.style.color = 'var(--muted)'; document.body.append(probe);
  const muted = getComputedStyle(probe).color; probe.remove();
  const bgOf = el => { const layers = []; let grad = false, glass = false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.backgroundImage !== 'none') grad = true; if (cs.backdropFilter && cs.backdropFilter !== 'none' || cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none') glass = true;
      const p = parse(cs.backgroundColor); if (p && p.a > 0) { layers.push(p); if (p.a >= 1) break; } }
    let c = [255, 255, 255]; for (const l of layers.reverse()) c = c.map((v, i) => l.c[i] * l.a + v * (1 - l.a));
    return { c, grad, glass }; };
  const out = []; const seen = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t; (t = w.nextNode());) { const e = t.parentElement; if (!e || seen.has(e) || !t.textContent.trim()) continue; seen.add(e);
    const cs = getComputedStyle(e); if (cs.color !== muted || !e.getClientRects().length || cs.visibility === 'hidden') continue;
    let op = 1; for (let n = e; n; n = n.parentElement) op *= +getComputedStyle(n).opacity; if (op < .99) continue;   // opacity-dimmed text is a different finding
    const b = bgOf(e); const fg = parse(cs.color).c;
    const cls = (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '') ;
    out.push({ el: e.tagName.toLowerCase() + cls, parentCls: e.parentElement?.className?.toString?.().slice(0, 40), text: t.textContent.trim().slice(0, 32), fs: cs.fontSize,
      bg: '#' + b.c.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''), grad: b.grad, glass: b.glass, ratio: +ratio(fg, b.c).toFixed(2) }); }
  return { muted, theme: document.documentElement.dataset.theme || 'system', scheme: document.documentElement.dataset.scheme, nt: document.body.classList.contains('nt'), items: out };
};
async function themed(L, profile, theme) {
  await L.reset('typical');
  if (theme !== 'system') await L.apiAs(profile, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } });
  return L.device({ device: 'ipad-portrait', mode: 'light', profile, localStorage: theme !== 'system' ? { 'hub.theme': JSON.stringify(theme) } : {} });
}
const CASES = [['shell', 'eli'], ['f260', 'eli'], ['kidverse', 'eli'], ['kidverse', 'ezra'], ['prayer', 'eli'], ['dollywood', 'eli']];
const B = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const theme of ['system', 'parchment', 'frost']) {
    for (const [app, prof] of CASES) {
      const d = await themed(L, prof, theme);
      try {
        let f;
        if (app === 'shell') { await d.goto('#me'); await sleep(2500); f = d.page.mainFrame(); }
        else { f = await d.openApp(app); await sleep(3000); }
        if (app === 'dollywood') await f.evaluate(() => { /* expand nothing: measure the default view */ });
        const r = await f.evaluate(PROBE);
        const fails = r.items.filter(i => i.ratio < 4.5);
        const byBg = {}; for (const i of r.items) { const k = i.bg + (i.grad ? ' +grad' : '') + (i.glass ? ' +glass' : ''); (byBg[k] ||= { n: 0, min: 99, max: 0, ex: [] }); const g = byBg[k]; g.n++; g.min = Math.min(g.min, i.ratio); g.max = Math.max(g.max, i.ratio); if (g.ex.length < 4) g.ex.push(i.el + ' "' + i.text + '"'); }
        const key = `${app}/${prof}/${theme}`;
        B[key] = { muted: r.muted, theme: r.theme, nt: r.nt, total: r.items.length, failing: fails.length, byBg, failingSamples: fails.slice(0, 12) };
        console.log('B', key, 'nt=' + r.nt, 'muted=' + r.muted, 'total', r.items.length, 'fail', fails.length, JSON.stringify(Object.fromEntries(Object.entries(byBg).map(([k, g]) => [k, [g.n, g.min, g.max, g.ex[0]]]))));
        if (theme === 'system' && app === 'f260') await d.page.screenshot({ path: path.join(EV, 'verify-muted-on-wells-and-derived-surfaces-2-f260-hearth.png'), scale: 'css' });
      } catch (e) { B[`${app}/${prof}/${theme}`] = { error: String(e).slice(0, 200) }; console.log('ERR', app, prof, theme, String(e).slice(0, 200)); }
      finally { await d.close(); }
    }
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, 'verify-muted-on-wells-and-derived-surfaces-2.json'), JSON.stringify({ tokenMath: A, rendered: B }, null, 1));
