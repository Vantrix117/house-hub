// Phase 4 DARK, skeptic #2: re-measure "native controls follow the OS colour scheme, not the theme".
// For each engine: Eli on ipad-portrait, Midnight on a light OS and Parchment on a dark OS (+ System controls).
// Larder select#size: computed style + rendered median fill (text hidden). Rig-artefact probes injected into the
// same frame: a select with an author border but background:red (does the engine honour an author background
// on a default-appearance select at all?), and a select with appearance:none. F260: a .wnbody .jft Copy button
// probed by class (the rules are class-only), plus the CSSOM rules that mention .jft.
//   node audits/tools/phase4/DARK/verify-native-controls-follow-os-not-theme-2.mjs
import fs from 'node:fs'; import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';
const OUTD = path.join(ROOT, 'audits/evidence/p4/DARK'); const TAG = 'verify-native-controls-follow-os-not-theme-2';
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const Lm = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const CR = (a, b) => { const x = Lm(a), y = Lm(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
const P = s => String(s).match(/[\d.]+/g).slice(0, 3).map(Number);
const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
async function median(page, buf, rightSkip = 28) {
  return page.evaluate(async ({ b64, rightSkip }) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(4, 4, Math.max(1, img.width - 8 - rightSkip), Math.max(1, img.height - 8)).data; const ch = [[], [], []];
    for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) ch[k].push(d[i + k]);
    return ch.map(a => a.sort((p, q) => p - q)[a.length >> 1]); }, { b64: buf.toString('base64'), rightSkip });
}
async function fillOf(page, el, rightSkip) {
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const withText = await el.screenshot();
  await el.evaluate(e => { e.dataset.oc = e.style.color; e.style.color = 'transparent'; }); await sleep(80);
  const bare = await el.screenshot(); await el.evaluate(e => { e.style.color = e.dataset.oc || ''; });
  return { fill: await median(page, bare, rightSkip), withText };
}
const CASES = [['system', 'light'], ['system', 'dark'], ['midnight', 'light'], ['parchment', 'dark'], ['midnight', 'dark']];
const out = { engines: {}, larder: [], probes: [], f260: [] };
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', engine });
  try {
    for (const [theme, mode] of CASES) {
      await L.reset('typical');
      if (theme !== 'system') { const r = await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } }); if (r.status >= 300) throw new Error('theme ' + r.status); }
      const d = await L.device({ device: 'ipad-portrait', mode, profile: 'eli', localStorage: theme === 'system' ? null : { 'hub.theme': JSON.stringify(theme) } });
      try {
        out.engines[engine] ||= await d.page.evaluate(() => navigator.userAgent);
        const f = await d.openApp('leftovers', { wait: '#size' }); await sleep(1500);
        const el = await f.$('#size');
        const info = await el.evaluate(e => { const cs = getComputedStyle(e);
          return { color: cs.color, bg: cs.backgroundColor, appearance: cs.appearance || cs.webkitAppearance, usedScheme: cs.colorScheme, dataTheme: document.documentElement.dataset.theme || null, dataScheme: document.documentElement.dataset.scheme, osDark: matchMedia('(prefers-color-scheme: dark)').matches }; });
        const { fill, withText } = await fillOf(d.page, el, 28);
        const rec = { engine, theme, mode, ...info, rendered: hex(fill), ratioRendered: CR(P(info.color), fill), ratioDeclared: CR(P(info.color), P(info.bg)) };
        out.larder.push(rec); console.log('LARDER', engine, theme, mode, 'scheme', info.dataScheme, 'decl', info.bg, 'rendered', rec.rendered, 'text', info.color, 'ratio', rec.ratioRendered);
        if (theme === 'midnight' && mode === 'light') {
          fs.writeFileSync(path.join(OUTD, `${TAG}-${engine}-larder-size-midnight-lightos.png`), withText);
          for (const [name, css] of [['authorRedBg', 'border:1px solid gray;border-radius:6px;background:rgb(255,0,0);color:rgb(255,255,255);min-height:44px;width:200px;font-size:15px'],
                                     ['appearanceNone', '-webkit-appearance:none;appearance:none;border:1px solid gray;background:var(--surface);color:var(--text);min-height:44px;width:200px;font-size:15px;padding:0 12px']]) {
            await f.evaluate(({ name, css }) => { const s = document.createElement('select'); s.id = 'probe-' + name; s.style.cssText = css + ';position:fixed;left:20px;top:20px;z-index:99999'; s.innerHTML = '<option>Medium tub</option>'; document.body.append(s); }, { name, css });
            const pe = await f.$('#probe-' + name); const pi = await pe.evaluate(e => ({ color: getComputedStyle(e).color, bg: getComputedStyle(e).backgroundColor }));
            const r = await fillOf(d.page, pe, 28); const p = { engine, probe: name, ...pi, rendered: hex(r.fill), ratioRendered: CR(P(pi.color), r.fill) };
            out.probes.push(p); console.log('PROBE', engine, name, 'decl', pi.bg, 'rendered', p.rendered, 'ratio', p.ratioRendered);
            await pe.evaluate(e => e.remove());
          }
        }
        const g = await d.openApp('f260', { wait: 'body' }); await sleep(2000);
        const fr = await g.evaluate(() => {
          const rules = []; for (const ss of document.styleSheets) { let rs; try { rs = ss.cssRules; } catch { continue; } for (const r of rs) if (r.selectorText && /jft|^button/.test(r.selectorText)) rules.push(r.cssText.slice(0, 160)); }
          const w = document.createElement('div'); w.className = 'wnbody'; w.style.cssText = 'display:block !important;position:fixed;left:10px;top:10px;z-index:99999;width:300px';
          w.innerHTML = '<div class="jft"><span class="jsaved">Saved</span><button type="button" data-wncopy="1" id="pc">Copy</button></div>'; document.body.append(w);
          const cs = getComputedStyle(document.getElementById('pc')); return { rules, color: cs.color, bg: cs.backgroundColor, usedScheme: cs.colorScheme, dataScheme: document.documentElement.dataset.scheme };
        });
        const be = await g.$('#pc'); const bfill = (await fillOf(d.page, be, 0)).fill;
        const brec = { engine, theme, mode, ...fr, rendered: hex(bfill), ratioDeclared: CR(P(fr.color), P(fr.bg)), ratioRendered: CR(P(fr.color), bfill) };
        out.f260.push(brec); console.log('F260COPY', engine, theme, mode, 'decl', fr.bg, 'rendered', brec.rendered, 'text', fr.color, 'ratio', brec.ratioDeclared, brec.ratioRendered);
        if (theme === 'midnight' && mode === 'light') fs.writeFileSync(path.join(OUTD, `${TAG}-${engine}-f260-copy-midnight-lightos.png`), await be.screenshot());
      } finally { await d.close(); }
    }
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(OUTD, TAG + '.json'), JSON.stringify(out, null, 1));
console.log('engines', JSON.stringify(out.engines));
