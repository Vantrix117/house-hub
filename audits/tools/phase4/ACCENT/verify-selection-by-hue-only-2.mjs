// Phase 4 ACCENT — skeptic #2 for "selection-by-hue-only". Independent re-measure on the local rig (WebKit, iPad portrait).
// For each profile × theme, open the component and compare its SELECTED item with its UNSELECTED siblings:
//   - computed ink colour, font weight, icon (use href / svg fill), border colour of each state;
//   - painted fill: hide the component's text and icons, screenshot, median pixel inside each item (inset 6 px), so the
//     glass bar / chip is measured as the rig paints it (no backdrop blur in WebKit on Windows — the bar is sampled
//     over whatever the page draws behind it, which is why several unselected tabs are sampled);
//   - border ring (timer chips): median pixel on the chip's top edge vs the page pixel 3 px above it.
//   node audits/tools/phase4/ACCENT/verify-selection-by-hue-only-2.mjs shell|timer|prayer [themes] [profiles]
// → audits/evidence/p4/ACCENT/verify-selection-by-hue-only-2-<mode>.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
import { decodePng } from './png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p4', 'ACCENT');
const [MODE = 'shell', TH = '', PR = '', SHOT = ''] = process.argv.slice(2);
const KEYS = { 'system-light': ['system', 'light'], 'system-dark': ['system', 'dark'], midnight: ['midnight', 'dark'], parchment: ['parchment', 'light'], forest: ['forest', 'dark'], frost: ['frost', 'light'] };
const themes = (TH || 'system-light,system-dark,parchment,frost,midnight,forest').split(',');
const profiles = (PR || (MODE === 'prayer' ? 'eli,christian,mom,dad,niece' : 'eli,christian,mom,dad,niece,ezra,kiara')).split(',');
const JOB = {
  shell: { app: null, open: d => d.goto('#home'), container: '#tabbar', sel: '#tabbar .tab.on', uns: '#tabbar .tab:not(.on)' },
  timer: { app: 'timer', wait: '#presets .btn.on', container: '#presets', sel: '#presets .btn.on', uns: '#presets .btn:not(.on)' },
  prayer: { app: 'prayer', wait: 'nav button[aria-current="true"]', container: 'nav', sel: 'nav .inner > button[aria-current="true"]', uns: 'nav .inner > button:not([aria-current="true"])' },
}[MODE];

const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
// color-mix() computes to "color(srgb r g b)" with 0-1 channels in WebKit; rgb()/rgba() are 0-255
const rgb = s => { const n = (String(s).match(/[\d.]+/g) || []).slice(0, 3).map(Number); return /^color\(srgb/.test(String(s)) ? n.map(v => v * 255) : n; };
const med = a => { const s = [...a].sort((p, q) => lum(p) - lum(q)); return s[s.length >> 1] || [0, 0, 0]; };

async function measure(d, f) {
  const off = JOB.app ? await d.page.evaluate(() => { const e = document.querySelector('#frame'); const r = e.getBoundingClientRect(); return { x: r.left + e.clientLeft, y: r.top + e.clientTop }; }) : { x: 0, y: 0 };
  const info = await f.evaluate(([S, U]) => {
    const one = e => { const cs = getComputedStyle(e), r = e.getBoundingClientRect(); const svg = e.querySelector('svg'); const use = svg && svg.querySelector('use');
      return { text: e.textContent.trim().slice(0, 20), color: cs.color, fw: cs.fontWeight, fs: parseFloat(cs.fontSize), bg: cs.backgroundColor, border: cs.borderTopColor, bw: cs.borderTopWidth,
        icon: use ? use.getAttribute('href') : (svg ? svg.innerHTML.length : null), iconFill: svg ? getComputedStyle(svg).fill : null, iconStroke: svg ? getComputedStyle(svg).stroke : null,
        r: { x: r.left, y: r.top, w: r.width, h: r.height } }; };
    const sel = document.querySelector(S);
    return { accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), scheme: document.documentElement.dataset.scheme, dataTheme: document.documentElement.dataset.theme || null,
      sel: sel && one(sel), uns: [...document.querySelectorAll(U)].filter(e => e.getBoundingClientRect().width > 4).map(one) };
  }, [JOB.sel, JOB.uns]);
  if (!info.sel) return info;
  await f.evaluate(c => { const s = document.createElement('style'); s.id = '__v2'; s.textContent = `${c} *{color:transparent!important;text-shadow:none!important} ${c} svg,${c} .dot{visibility:hidden!important}`; document.head.appendChild(s); }, JOB.container);
  await sleep(250);
  const img = decodePng(await d.page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' }));
  await f.evaluate(() => document.getElementById('__v2').remove());
  const pix = (x, y) => { const i = (Math.round(y) * img.w + Math.round(x)) * 4; return [img.px[i], img.px[i + 1], img.px[i + 2]]; };
  const fill = r => { const o = []; for (let y = r.y + off.y + 6; y < r.y + off.y + r.h - 6; y += 1) for (let x = r.x + off.x + 6; x < r.x + off.x + r.w - 6; x += 1) o.push(pix(x, y)); return med(o); };
  const edge = r => { const o = []; for (let x = r.x + off.x + r.w * .3; x < r.x + off.x + r.w * .7; x++) o.push(pix(x, r.y + off.y + 0.5)); return { ring: med(o), outside: pix(r.x + off.x + r.w / 2, r.y + off.y - 3) }; };
  const s = info.sel; s.fillPainted = fill(s.r); const se = edge(s.r); s.ring = se.ring; s.outside = se.outside;
  for (const u of info.uns) { u.fillPainted = fill(u.r); const ue = edge(u.r); u.ring = ue.ring; u.outside = ue.outside; }
  // per unselected neighbour: fill contrast (selected fill vs that neighbour's painted fill), ink contrast (selected ink vs unselected ink)
  info.pairs = info.uns.map(u => ({ uns: u.text, fillCr: cr(s.fillPainted, u.fillPainted), inkCr: cr(rgb(s.color), rgb(u.color)) }));
  info.fillCrMin = Math.min(...info.pairs.map(p => p.fillCr)); info.fillCrMax = Math.max(...info.pairs.map(p => p.fillCr));
  info.inkCr = info.pairs[0] && info.pairs[0].inkCr;
  info.selRingVsOutside = cr(s.ring, s.outside);
  info.selInkOnFill = cr(rgb(s.color), s.fillPainted); info.unsInkOnFill = cr(rgb(info.uns[0].color), info.uns[0].fillPainted);
  info.nonColourCue = { weight: info.uns.some(u => u.fw !== s.fw), size: info.uns.some(u => u.fs !== s.fs), icon: info.uns.every(u => typeof u.icon === 'string') ? false : null, iconFill: info.uns.some(u => u.iconFill !== s.iconFill) };
  return info;
}

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const rows = [];
try {
  for (const theme of themes) {
    const [th, mode] = KEYS[theme];
    for (const p of profiles) await L.apiAs(p, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: th } }).catch(e => console.log('theme put', p, e.message));
    for (const p of profiles) {
      const d = await L.device({ device: 'ipad-portrait', mode, profile: p, localStorage: { 'hub.theme': JSON.stringify(th) } });
      const row = { theme, profile: p };
      try {
        let f = d.page;
        if (JOB.app) f = await d.openApp(JOB.app, { wait: JOB.wait }); else { await JOB.open(d); await d.page.waitForSelector(JOB.sel, { timeout: 10000 }).catch(() => {}); }
        await sleep(1500);
        Object.assign(row, await measure(d, f));
        if (SHOT && SHOT.split(',').includes(`${p}:${theme}`)) await d.page.screenshot({ path: path.join(EVID, `verify-selection-by-hue-only-2-${MODE}-${p}-${theme}.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
      } catch (e) { row.error = String(e.message).split('\n')[0]; }
      await d.close();
      rows.push(row);
      console.log(theme, p, row.accent, row.scheme, row.sel ? `sel "${row.sel.text}" fill ${row.fillCrMin}-${row.fillCrMax} ink ${row.inkCr} selInk/fill ${row.selInkOnFill} unsInk/fill ${row.unsInkOnFill} ring ${row.selRingVsOutside} cue ${JSON.stringify(row.nonColourCue)}` : (row.error || 'no selected item'));
    }
  }
} finally { await L.close(); }
const ok = rows.filter(r => r.sel);
const summary = { mode: MODE, cases: rows.length, measured: ok.length,
  fillCr: { min: Math.min(...ok.map(r => r.fillCrMin)), max: Math.max(...ok.map(r => r.fillCrMax)), below3: ok.filter(r => r.fillCrMax < 3).length },
  inkCr: { min: Math.min(...ok.map(r => r.inkCr)), max: Math.max(...ok.map(r => r.inkCr)), below3: ok.filter(r => r.inkCr < 3).length },
  ringVsOutside: { min: Math.min(...ok.map(r => r.selRingVsOutside)), max: Math.max(...ok.map(r => r.selRingVsOutside)) },
  anyNonColourCue: ok.filter(r => r.nonColourCue.weight || r.nonColourCue.size || r.nonColourCue.iconFill).length,
  lowestInk: ok.sort((a, b) => a.inkCr - b.inkCr).slice(0, 6).map(r => `${r.profile}/${r.theme} ${r.inkCr}`) };
const out = path.join(EVID, `verify-selection-by-hue-only-2-${MODE}.json`);
fs.writeFileSync(out, JSON.stringify({ script: 'audits/tools/phase4/ACCENT/verify-selection-by-hue-only-2.mjs', engine: 'webkit', device: 'ipad-portrait', summary, rows }, null, 1));
console.log(JSON.stringify(summary, null, 1));
console.log('wrote', path.relative(ROOT, out));
