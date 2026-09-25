// Phase 4 COLOR skeptic #1: re-measure "native controls ignore the chosen theme" on REAL app controls only (no injected
// probes): Larder select#size, the F260 week-note Copy button ([data-wnpanel] .jft button), and every visible select in
// the build guide. Per engine x (theme, OS mode): computed color / color-scheme, and the rendered background sampled
// from an element screenshot with the text hidden. Then a causal check: set documentElement.style.colorScheme to the
// resolved data-scheme inside the frame and re-measure (does following the theme fix it?).
// Throwaway F260 passcode on the local demo DB only.
// Usage: node audits/tools/phase4/COLOR/verify-native-controls-ignore-theme-1.mjs [webkit|chromium|both]
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const EV = path.resolve('audits/evidence/p4/COLOR'); fs.mkdirSync(EV, { recursive: true });
const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + .05) / (y + .05)).toFixed(2); };
const rgb = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const hex = a => '#' + a.map(v => v.toString(16).padStart(2, '0')).join('');
function png(buf) { let o = 8, w, h, ct, idat = []; while (o < buf.length) { const len = buf.readUInt32BE(o), t = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len); if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } if (t === 'IDAT') idat.push(d); o += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * bpp), st = w * bpp;
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)], line = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)); for (let x = 0; x < st; x++) { const a = x >= bpp ? px[y * st + x - bpp] : 0, b = y ? px[(y - 1) * st + x] : 0, c = x >= bpp && y ? px[(y - 1) * st + x - bpp] : 0; let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; } px[y * st + x] = v & 255; } }
  return { w, h, at: (x, y) => { const i = (y * w + x) * bpp; return [px[i], px[i + 1], px[i + 2]]; } }; }
async function measure(f, sel, page) {
  const h = await f.$(sel); if (!h) return { sel, missing: true };
  const info = await h.evaluate(e => { e.scrollIntoView({ block: 'center' }); const c = getComputedStyle(e), b = e.getBoundingClientRect(); return { color: c.color, bgDecl: c.backgroundColor, appearance: c.appearance || c.webkitAppearance, colorScheme: c.colorScheme, w: Math.round(b.width), h: Math.round(b.height), text: (e.innerText || e.value || '').slice(0, 20) }; });
  if (!info.w || !info.h) return { sel, ...info, hidden: true };
  await h.evaluate(e => { e.dataset.vhide = '1'; });
  await f.evaluate(() => { const s = document.createElement('style'); s.id = 'vhide'; s.textContent = '[data-vhide]{color:transparent!important;-webkit-text-fill-color:transparent!important}'; document.head.append(s); });
  await sleep(120);
  let img; if (page) { const fe = await f.frameElement(); const fb = await fe.boundingBox(); const b = await h.boundingBox(); const buf = await page.screenshot({ scale: 'css', clip: { x: b.x, y: b.y, width: b.width, height: b.height }, timeout: 15000 }); if (process.env.VDBG) { fs.mkdirSync(process.env.VDBG, { recursive: true }); fs.writeFileSync(path.join(process.env.VDBG, 'clip-' + Date.now() + '.png'), buf); fs.writeFileSync(path.join(process.env.VDBG, 'box-' + Date.now() + '.json'), JSON.stringify({ b, fb })); } img = png(buf); } else img = png(await h.screenshot({ scale: 'css', animations: 'disabled' }));
  await f.evaluate(() => { document.getElementById('vhide').remove(); document.querySelectorAll('[data-vhide]').forEach(e => delete e.dataset.vhide); });
  const px = []; for (let y = Math.floor(img.h * .3); y < img.h * .7; y++) for (let x = Math.floor(img.w * .15); x < img.w * .6; x++) px.push(img.at(x, y));
  px.sort((a, b) => lum(a) - lum(b)); const med = px[px.length >> 1] || [0, 0, 0];
  return { sel, ...info, renderedBg: hex(med), contrast: cr(rgb(info.color), med) };
}
async function withFix(f, fn) { await f.evaluate(() => { document.documentElement.style.colorScheme = document.documentElement.dataset.scheme; }); await sleep(200); const r = await fn(); await f.evaluate(() => { document.documentElement.style.colorScheme = ''; }); return r; }
const engines = (process.argv[2] || 'both') === 'both' ? ['webkit', 'chromium'] : [process.argv[2]];
const CASES = process.env.VDBG ? [['midnight', 'light']] : [['hearth', 'light'], ['midnight', 'light'], ['forest', 'light'], ['parchment', 'dark'], ['frost', 'dark'], ['midnight', 'dark']];
const out = { note: 'Real app controls only. contrast = computed text colour vs median rendered background (text hidden). fixed = same after documentElement.style.colorScheme = data-scheme in the frame.', runs: {} };
for (const engine of engines) {
  const L = await local({ variant: 'typical', clock: 'demo', engine });
  let passSet = false;
  try {
    for (const [theme, mode] of CASES) {
      await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } });
      const key = `${engine}/${theme}-${mode}os`; const run = out.runs[key] = {};
      // Larder
      { const d = await L.device({ device: 'ipad-portrait', mode, profile: 'eli', localStorage: { 'hub.theme': JSON.stringify(theme) } });
        await d.goto('#home'); const f = await d.openApp('leftovers');
        await f.waitForFunction(() => document.querySelectorAll('select#size option').length > 0, null, { timeout: 20000 }); await sleep(1200);
        run.root = await f.evaluate(() => ({ theme: document.documentElement.dataset.theme || 'hearth', scheme: document.documentElement.dataset.scheme, colorScheme: getComputedStyle(document.documentElement).colorScheme, inlineColorScheme: document.documentElement.style.colorScheme }));
        run.larderSize = await measure(f, 'select#size'); run.larderSizeFixed = await withFix(f, () => measure(f, 'select#size'));
        if (theme === 'midnight' && mode === 'light') await d.page.screenshot({ path: path.join(EV, `verify-native-controls-ignore-theme-1-${engine}-larder-midnight-lightos.png`), scale: 'css' });
        await d.close(); }
      // F260 week-note Copy
      { const d = await L.device({ device: 'ipad-portrait', mode, profile: 'eli', localStorage: { 'hub.theme': JSON.stringify(theme) } });
        await d.goto('#home'); const f = await d.openApp('f260');
        await f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim().length > 0; }, null, { timeout: 20000 }); await sleep(800);
        try {
          const w = await f.evaluate(() => { const b = document.querySelector('[data-wntoggle="38"]'); b.scrollIntoView({ block: 'center' }); b.click(); return b.dataset.wntoggle; }); await sleep(500);
          await f.evaluate(w => { const u = document.querySelector('[data-wnpanel="' + w + '"] [data-unlock]'); if (u) u.click(); }, w); await sleep(500);
          if (await f.$('#pass.on')) { await f.fill('#pass1', '2468'); if (!passSet && await f.$('#pass2')) await f.fill('#pass2', '2468').catch(() => {}); await f.evaluate(() => document.getElementById('passOk').click()); passSet = true; await sleep(1200); if (!(await f.$('[data-wnpanel="' + w + '"] .jft button'))) { const o = await f.evaluate(w => document.querySelector('[data-wn="' + w + '"]').classList.contains('on'), w); if (!o) await f.evaluate(w => document.querySelector('[data-wntoggle="' + w + '"]').click(), w); await sleep(500); } }
          if (!(await f.$(`[data-wnpanel="${w}"] .jft button`))) { await f.evaluate(w => document.querySelector('[data-wntoggle="' + w + '"]').click(), w); await sleep(500); }
          const sel = `[data-wnpanel="${w}"] .jft button`;
          run.f260WeekNoteCopy = await measure(f, sel, d.page); run.f260WeekNoteCopyFixed = await withFix(f, () => measure(f, sel, d.page));
          run.f260HearCopyCss = await f.evaluate(() => { const e = document.querySelector('.jr .jft button'); return e ? getComputedStyle(e).backgroundColor : null; });
          if (theme === 'midnight' && mode === 'light') { await f.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), sel); await d.page.screenshot({ path: path.join(EV, `verify-native-controls-ignore-theme-1-${engine}-f260-midnight-lightos.png`), scale: 'css' }); }
        } catch (e) { run.f260Error = String(e.message).slice(0, 200); }
        await d.close(); }
      // Build guide: visible selects
      { const d = await L.device({ device: 'ipad-portrait', mode, profile: 'eli', localStorage: { 'hub.theme': JSON.stringify(theme) } });
        await d.goto('#home');
        try { const f = await d.openApp('dollywood'); await sleep(3000);
          const ids = await f.evaluate(() => [...document.querySelectorAll('select')].filter(s => s.id && s.getBoundingClientRect().width > 0).map(s => '#' + s.id));
          run.dollywood = []; for (const s of ids.slice(0, 4)) run.dollywood.push(await measure(f, 'select' + s));
          run.dollywoodFixed = []; for (const s of ids.slice(0, 2)) run.dollywoodFixed.push(await withFix(f, () => measure(f, 'select' + s)));
        } catch (e) { run.dollywoodError = String(e.message).slice(0, 200); }
        await d.close(); }
      const fmt = m => m ? (m.missing ? `${m.sel} missing` : m.hidden ? `${m.sel} hidden` : `${m.sel} ${m.color}/${m.bgDecl}→${m.renderedBg} ${m.contrast}`) : '-';
      console.log(key, JSON.stringify(run.root), '\n  larder', fmt(run.larderSize), '| fixed', fmt(run.larderSizeFixed), '\n  f260', fmt(run.f260WeekNoteCopy), '| fixed', fmt(run.f260WeekNoteCopyFixed), run.f260Error || '', '\n  dolly', (run.dollywood || []).map(fmt).join(' ; '), '| fixed', (run.dollywoodFixed || []).map(fmt).join(' ; '), run.dollywoodError || '');
    }
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(EV, 'verify-native-controls-ignore-theme-1' + (engines.length === 1 ? '-' + engines[0] : '') + '.json'), JSON.stringify(out, null, 1));
console.log('saved audits/evidence/p4/COLOR/verify-native-controls-ignore-theme-1.json');
