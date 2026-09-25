// Phase 4 DARK, skeptic #3 (tie-break): "native controls follow the OS colour scheme, not the theme".
// Question 1: does the rig's WebKit honour ANY author background on a default-appearance <select>? (probes: author
//   background red with and without an author border, and a plain unstyled select) -> if not, its select numbers are a port artefact.
// Question 2: in Chromium (a real desktop engine), which controls actually fail when theme scheme != OS scheme?
//   Larder select#size (author bg), Dollywood build-guide select#bmap (author bg), and the F260 week-note Copy button
//   (class-only rules, so probed by injecting the exact markup of apps/f260.html:1297 inside a .wnbody).
// Question 3: counterfactual in Chromium: the same Copy probe with color-scheme forced to the theme's scheme.
//   node audits/tools/phase4/DARK/verify-native-controls-follow-os-not-theme-3.mjs [webkit|chromium|both]
import fs from 'node:fs'; import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';
const OUTD = path.join(ROOT, 'audits/evidence/p4/DARK'); const TAG = 'verify-native-controls-follow-os-not-theme-3';
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const Lm = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const CR = (a, b) => { const x = Lm(a), y = Lm(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
const P = s => String(s).match(/[\d.]+/g).slice(0, 3).map(Number);
const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
async function median(page, buf, rightSkip) {
  return page.evaluate(async ({ b64, rightSkip }) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(4, 4, Math.max(1, img.width - 8 - rightSkip), Math.max(1, img.height - 8)).data; const ch = [[], [], []];
    for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) ch[k].push(d[i + k]);
    return ch.map(a => a.sort((p, q) => p - q)[a.length >> 1]); }, { b64: buf.toString('base64'), rightSkip });
}
async function measure(page, el, rightSkip = 0) {
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const shot = await el.screenshot();
  await el.evaluate(e => { e.dataset.oc = e.style.color; e.style.setProperty('color', 'transparent', 'important'); }); await sleep(80);
  const bare = await el.screenshot(); await el.evaluate(e => { e.style.color = e.dataset.oc || ''; });
  const cs = await el.evaluate(e => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return { color: s.color, bg: s.backgroundColor, scheme: s.colorScheme, w: Math.round(r.width), h: Math.round(r.height) }; });
  const fill = await median(page, bare, rightSkip);
  return { ...cs, rendered: hex(fill), ratioDeclared: CR(P(cs.color), P(cs.bg)), ratioRendered: CR(P(cs.color), fill), shot };
}
const arg = process.argv[2] || 'both'; const ENGINES = arg === 'both' ? ['webkit', 'chromium'] : [arg];
const CASES = [['system', 'light'], ['midnight', 'light'], ['forest', 'light'], ['parchment', 'dark'], ['frost', 'dark'], ['midnight', 'dark']];
const out = { engines: {}, rows: [] };
const rec = (o) => { const { shot, ...r } = o; out.rows.push(r); console.log(JSON.stringify(r)); return shot; };
const PROBES = [
  ['redBgWithBorder', 'border:1px solid gray;background:rgb(255,0,0);color:rgb(255,255,255)'],
  ['redBgNoBorder', 'background-color:rgb(255,0,0);color:rgb(255,255,255)'],
  ['unstyled', ''],
];
for (const engine of ENGINES) {
  const L = await local({ variant: 'typical', engine });
  try {
    for (const [theme, mode] of CASES) {
      await L.reset('typical');
      if (theme !== 'system') { const r = await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } }); if (r.status >= 300) throw new Error('theme ' + r.status); }
      const d = await L.device({ device: 'ipad-portrait', mode, profile: 'eli', localStorage: theme === 'system' ? null : { 'hub.theme': JSON.stringify(theme) } });
      try {
        out.engines[engine] ||= await d.page.evaluate(() => navigator.userAgent);
        const base = { engine, theme, mode };
        // Larder
        const f = await d.openApp('leftovers', { wait: '#size' }); await sleep(1500);
        const html = await f.evaluate(() => ({ dataTheme: document.documentElement.dataset.theme || null, dataScheme: document.documentElement.dataset.scheme, osDark: matchMedia('(prefers-color-scheme: dark)').matches }));
        let s = rec({ ...base, ...html, control: 'larder#size', ...(await measure(d.page, await f.$('#size'), 28)) });
        if ((theme === 'midnight' && mode === 'light') || (theme === 'parchment' && mode === 'dark')) fs.writeFileSync(path.join(OUTD, `${TAG}-${engine}-larder-size-${theme}-${mode}os.png`), s);
        if (theme === 'midnight' && mode === 'light') {
          for (const [name, css] of PROBES) {
            await f.evaluate(({ name, css }) => { const x = document.createElement('select'); x.id = 'pr-' + name; x.style.cssText = css + ';position:fixed;left:20px;top:20px;z-index:99999;width:200px;min-height:44px;font-size:15px'; x.innerHTML = '<option>Medium tub</option>'; document.body.append(x); }, { name, css });
            const pe = await f.$('#pr-' + name); rec({ ...base, control: 'probe-select-' + name, ...(await measure(d.page, pe, 28)) }); await pe.evaluate(e => e.remove());
          }
        }
        // F260 week-note Copy (markup of apps/f260.html:1297)
        const g = await d.openApp('f260', { wait: 'body' }); await sleep(2000);
        await g.evaluate(() => { const w = document.createElement('div'); w.className = 'wn on'; w.id = 'pw'; w.style.cssText = 'position:fixed;left:10px;top:10px;z-index:99999;width:320px';
          w.innerHTML = '<div class="wnbody" style="display:block"><div class="jft"><span class="jsaved">Saved</span><button type="button" data-wncopy="1" id="pc">Copy</button></div></div>'; document.body.append(w); });
        s = rec({ ...base, control: 'f260-weeknote-copy', ...(await measure(d.page, await g.$('#pc'), 0)) });
        if ((theme === 'midnight' && mode === 'light') || (theme === 'parchment' && mode === 'dark')) fs.writeFileSync(path.join(OUTD, `${TAG}-${engine}-f260copy-${theme}-${mode}os.png`), s);
        if (theme !== 'system' && ((theme === 'midnight' || theme === 'forest') !== (mode === 'dark'))) {
          const want = (theme === 'midnight' || theme === 'forest') ? 'dark' : 'light';
          await g.evaluate(w => { document.getElementById('pc').style.colorScheme = w; }, want);
          rec({ ...base, control: 'f260-weeknote-copy-cs-' + want, ...(await measure(d.page, await g.$('#pc'), 0)) });
        }
        // Dollywood build guide select#bmap: only the two mismatch cases
        if ((theme === 'midnight' && mode === 'light') || (theme === 'parchment' && mode === 'dark')) {
          const h = await d.openApp('dollywood', { wait: '#bmap' }).catch(e => null);
          if (h) { await sleep(2000); const el = await h.$('#bmap');
            if (el && await el.isVisible()) rec({ ...base, control: 'dollywood#bmap', ...(await measure(d.page, el, 22)) });
            else out.rows.push({ ...base, control: 'dollywood#bmap', note: 'not visible' }); }
        }
      } finally { await d.close(); }
    }
  } finally { await L.close(); }
}
const file = path.join(OUTD, TAG + (arg === 'both' ? '' : '-' + arg) + '.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1)); console.log('wrote', file, JSON.stringify(out.engines));
