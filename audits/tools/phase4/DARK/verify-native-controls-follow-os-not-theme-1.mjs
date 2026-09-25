// Phase 4 skeptic #1 for DARK "native-controls-follow-os-not-theme". Independent re-measure.
// Per engine x case: Larder select#size (computed + rendered median fill with text hidden), a red-background probe on
// the same select (does this engine paint author backgrounds on appearance:auto selects at all?), a counterfactual
// color-scheme matching the resolved data-scheme, and a synthetic F260 week-note footer Copy button
// (.wn.on .wnbody .jft button, the classes apps/f260.html:1297-1300 emit) with computed + rendered fill.
//   node audits/tools/phase4/DARK/verify-native-controls-follow-os-not-theme-1.mjs
import fs from 'node:fs'; import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p4/DARK');
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const Lm = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const CR = (a, b) => { const x = Lm(a), y = Lm(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
const P = s => { const m = String(s).match(/[\d.]+/g); if (!m) return null; let v = m.slice(0, 3).map(Number); if (String(s).startsWith('color(')) v = v.map(x => x * 255); return v; };
const H = c => c ? '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase() : null;
async function fill(page, buf, inset = 4, right = 28) {
  return page.evaluate(async ({ b64, inset, right }) => {
    const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode();
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0);
    const d = g.getImageData(inset, inset, Math.max(1, i.width - 2 * inset - right), Math.max(1, i.height - 2 * inset)).data;
    const ch = [[], [], []]; for (let k = 0; k < d.length; k += 4) { ch[0].push(d[k]); ch[1].push(d[k + 1]); ch[2].push(d[k + 2]); }
    return ch.map(a => a.sort((p, q) => p - q)[a.length >> 1]);
  }, { b64: buf.toString('base64'), inset, right });
}
async function bare(page, el, inset, right) {
  await el.evaluate(e => { e.dataset.oc = e.style.color; e.style.setProperty('color', 'transparent', 'important'); }); await sleep(120);
  const f = await fill(page, await el.screenshot(), inset, right);
  await el.evaluate(e => { e.style.removeProperty('color'); if (e.dataset.oc) e.style.color = e.dataset.oc; }); await sleep(60); return f;
}
const CASES = [['system', 'light'], ['midnight', 'light'], ['midnight', 'dark'], ['parchment', 'dark'], ['parchment', 'light']];
const SAVE = (t, m) => (t === 'midnight' && m === 'light') || (t === 'parchment' && m === 'dark');
const res = [];
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', engine });
  try {
    for (const [theme, mode] of CASES) {
      await L.reset('typical');
      if (theme !== 'system') await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } });
      const d = await L.device({ device: 'ipad-portrait', mode, profile: 'eli', localStorage: theme === 'system' ? null : { 'hub.theme': JSON.stringify(theme) } });
      try {
        const ua = await d.page.evaluate(() => navigator.userAgent);
        const f = await d.openApp('leftovers', { wait: '#size' }); await sleep(1500);
        const el = await f.$('#size'); await el.scrollIntoViewIfNeeded().catch(() => {});
        const info = await el.evaluate(e => { const cs = getComputedStyle(e), r = document.documentElement;
          return { color: cs.color, bg: cs.backgroundColor, appearance: cs.appearance || cs.webkitAppearance, usedScheme: cs.colorScheme, theme: r.dataset.theme || null, scheme: r.dataset.scheme, prefersDark: matchMedia('(prefers-color-scheme: dark)').matches }; });
        const rendered = await bare(d.page, el, 4, 28);
        const shot = await el.screenshot();
        await el.evaluate(e => e.style.setProperty('background-color', 'rgb(255,0,0)', 'important'));
        await sleep(120); const red = await bare(d.page, el, 4, 28);
        await el.evaluate(e => e.style.removeProperty('background-color'));
        const want = info.scheme === 'dark' ? 'dark' : 'light';
        await f.addStyleTag({ content: `:root{color-scheme:${want} !important}` }); await sleep(250);
        const cf = await bare(d.page, el, 4, 28);
        const txt = P(info.color);
        const rec = { engine, theme, mode, ua, sel: 'leftovers #size', ...info, declaredBg: H(P(info.bg)), renderedFill: H(rendered), ratioRendered: CR(txt, rendered), ratioDeclared: CR(txt, P(info.bg)), redProbeFill: H(red), honoursAuthorBg: H(red) === '#FF0000', counterfactualScheme: want, counterfactualFill: H(cf), ratioCounterfactual: CR(txt, cf) };
        if (SAVE(theme, mode)) fs.writeFileSync(path.join(OUT, `verify-native-controls-follow-os-not-theme-1-${engine}-size-${theme}-${mode}.png`), shot);
        res.push(rec);
        console.log(engine, theme, mode, 'scheme', info.scheme, 'decl', rec.declaredBg, 'rend', rec.renderedFill, 'text', H(txt), 'ratio', rec.ratioRendered, 'red->', rec.redProbeFill, 'cf', rec.counterfactualFill, rec.ratioCounterfactual);

        const g = await d.openApp('f260', { wait: 'body' }); await sleep(2000);
        const bh = await g.evaluateHandle(() => { const w = document.createElement('div'); w.className = 'wn on'; w.style.cssText = 'position:fixed;left:10px;top:80px;z-index:99999;width:320px';
          w.innerHTML = '<div class="wnbody" style="display:block;animation:none"><div class="jft"><span class="jsaved">Saved</span><button type="button" id="vProbe">Copy</button></div></div>'; document.body.append(w); return document.getElementById('vProbe'); });
        await sleep(200);
        const bi = await bh.evaluate(b => { const cs = getComputedStyle(b); return { color: cs.color, bg: cs.backgroundColor, appearance: cs.appearance || cs.webkitAppearance, w: b.offsetWidth, h: b.offsetHeight, panel: getComputedStyle(b.closest('.wnbody')).backgroundColor }; });
        const bf = await bare(d.page, bh, 3, 0);
        const bshot = await bh.screenshot();
        if (SAVE(theme, mode)) fs.writeFileSync(path.join(OUT, `verify-native-controls-follow-os-not-theme-1-${engine}-f260copy-${theme}-${mode}.png`), bshot);
        const bt = P(bi.color);
        const brec = { engine, theme, mode, sel: 'f260 .wnbody .jft button (synthetic)', ...bi, declaredBg: H(P(bi.bg)), renderedFill: H(bf), ratioComputed: CR(bt, P(bi.bg)), ratioRendered: CR(bt, bf) };
        res.push(brec);
        console.log(engine, theme, mode, 'F260 copy', 'bg', bi.bg, 'rend', brec.renderedFill, 'text', H(bt), 'ratio', brec.ratioComputed, '/', brec.ratioRendered, bi.w + 'x' + bi.h);
      } finally { await d.close(); }
    }
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(OUT, 'verify-native-controls-follow-os-not-theme-1.json'), JSON.stringify({ note: 'Skeptic #1 re-measure. renderedFill = median pixel inside the control with its text transparent. redProbeFill = same select with background-color:rgb(255,0,0)!important; if not #FF0000 the engine ignores author backgrounds on appearance:auto selects.', res }, null, 1));
