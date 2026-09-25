// Phase 4 SHAPE — card / button / row treatments, column max-widths and grids, measured per area on the local rig.
// For each area's main screen (typical household, System theme, light OS) on iPad portrait and iPhone PWA, plus kid
// profiles where the app is kid-visible, every painted box >= 100x40 in the area's own document is recorded with its
// radius, padding, border, box-shadow (split into --e*/--glow tokens and literal layers), fill (matched to a colour
// token), backdrop-filter, max-width and grid tracks.
//   node audits/tools/phase4/SHAPE/cards.mjs   → audits/evidence/p4/SHAPE/cards.json (+ a few PNG crops on request)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p4/SHAPE/cards.json');
const SHOTS = path.join(ROOT, 'audits/evidence/p4/SHAPE');

const JOBS = [];
const APPS = ['f260', 'leftovers', 'prayer', 'tally', 'timer', 'dollywood', 'dollywood-live', 'kidverse', 'verses'];
const KIDAPPS = ['leftovers', 'prayer', 'tally', 'timer', 'dollywood-live', 'kidverse', 'verses'];
for (const device of ['ipad-portrait', 'iphone-pwa']) {
  for (const h of ['#home', '#apps', '#me']) JOBS.push({ area: 'shell', device, profile: 'eli', hash: h });
  for (const a of APPS) JOBS.push({ area: a, device, profile: a === 'dollywood' ? 'eli' : 'eli', app: a });
}
JOBS.push({ area: 'shell', device: 'ipad-portrait', profile: 'ezra', hash: '#home' });
for (const a of KIDAPPS) JOBS.push({ area: a, device: 'ipad-portrait', profile: 'ezra', app: a });
JOBS.push({ area: 'tv', device: 'tv', profile: 'tv', hash: '#home' });
const only = process.argv.includes('--area') ? process.argv[process.argv.indexOf('--area') + 1].split(',') : null;

function inPage() {
  const px = v => parseFloat(v) || 0;
  const rgba = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) { const m2 = String(c).match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/); if (m2) return [m2[1] * 255, m2[2] * 255, m2[3] * 255, m2[4] == null ? 1 : +m2[4]].map((v, i) => i < 3 ? Math.round(v) : +(+v).toFixed(3)); return null; } const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] == null ? 1 : p[3]]; };
  const short = el => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; const c = [...el.classList].slice(0, 3); if (c.length) s += '.' + c.join('.'); const p = el.parentElement; if (p && p !== document.body) { let q = p.tagName.toLowerCase(); if (p.id) q += '#' + p.id; const pc = [...p.classList].slice(0, 2); if (pc.length) q += '.' + pc.join('.'); s = q + ' > ' + s; } return s; };
  // colour tokens: every custom property declared in same-origin sheets, probed through color
  const names = new Set();
  const walk = rules => { for (const r of rules) { if (r.style) for (let i = 0; i < r.style.length; i++) { const n = r.style[i]; if (n.startsWith('--')) names.add(n); } if (r.cssRules) walk(r.cssRules); } };
  for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch (e) {} }
  const probe = document.createElement('i'); document.body.appendChild(probe);
  const colors = {}, shadowsTok = {};
  const root = getComputedStyle(document.documentElement);
  for (const n of names) {
    const raw = root.getPropertyValue(n).trim(); if (!raw) continue;
    if (/^(--e[1-4]|--glow-accent|--lift|--lift-lg|--shadow|--shadow-lg|--shadow-sm|--lv-glass-shadow)$/.test(n)) { probe.style.boxShadow = 'var(' + n + ')'; shadowsTok[n] = getComputedStyle(probe).boxShadow; probe.style.boxShadow = ''; continue; }
    probe.style.color = ''; probe.style.color = 'var(' + n + ')'; const c = getComputedStyle(probe).color; const v = rgba(c);
    if (v && /#|rgb|hsl|color|mix|white|black|transparent/.test(raw)) colors[n] = v;
  }
  probe.remove();
  const vars = { maxTok: { '--max': root.getPropertyValue('--max').trim(), '--max-read': root.getPropertyValue('--max-read').trim() } };
  const fixedAnc = el => { for (let e = el; e && e !== document.body; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return p; } return null; };
  const out = [], widths = [], grids = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg') || el.tagName === 'IMG' || el.tagName === 'CANVAS' || el.tagName === 'IFRAME') continue;
    const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden') continue;
    const b = el.getBoundingClientRect(); if (b.width < 1 || b.height < 1) continue;
    if (s.maxWidth !== 'none' && b.width >= 200 && !/%/.test(s.maxWidth)) widths.push({ sel: short(el), maxWidth: s.maxWidth, w: Math.round(b.width), left: Math.round(b.left) });
    if (s.display.includes('grid') && s.gridTemplateColumns && s.gridTemplateColumns !== 'none') { const tracks = s.gridTemplateColumns.split(' ').filter(Boolean); if (tracks.length > 1 && el.children.length > 1) grids.push({ sel: short(el), tracks: tracks.length, cols: s.gridTemplateColumns.slice(0, 80), gap: s.columnGap + '/' + s.rowGap, w: Math.round(b.width), child: el.children[0] && Math.round(el.children[0].getBoundingClientRect().width) }); }
    const bg = rgba(s.backgroundColor); const bw = px(s.borderTopWidth) || px(s.borderLeftWidth) || px(s.borderBottomWidth);
    const painted = (bg && bg[3] > 0.05) || s.backgroundImage !== 'none' || bw > 0 || s.boxShadow !== 'none';
    if (!painted || b.width < 100 || b.height < 40) continue;
    const tag = el.tagName.toLowerCase(); const role = el.getAttribute('role');
    const kind = /^(input|select|textarea)$/.test(tag) ? 'field' : (/^(button|a|summary)$/.test(tag) || role === 'button' || role === 'tab' || role === 'switch' || el.hasAttribute('data-open')) ? 'button' : (fixedAnc(el) ? 'chrome' : (tag === 'li' || el.classList.contains('row') ? 'row' : 'container'));
    const bc = bw ? rgba(s.borderTopColor || s.borderLeftColor) : null;
    out.push({ sel: short(el), kind, tag, fixed: fixedAnc(el), w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.left), y: Math.round(b.top + scrollY),
      r: [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius].map(px), pad: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(px),
      border: bw ? { w: bw, c: bc, sides: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth].map(px) } : null, shadow: s.boxShadow, bg, bgImage: s.backgroundImage === 'none' ? null : s.backgroundImage.slice(0, 60), bf: (s.backdropFilter || s.webkitBackdropFilter || 'none'), fs: px(s.fontSize), maxWidth: s.maxWidth, text: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 30) });
  }
  return { vw: innerWidth, vh: innerHeight, docH: document.documentElement.scrollHeight, kind: document.documentElement.getAttribute('data-kind') || 'adult', theme: document.documentElement.getAttribute('data-theme'), ds: document.body.classList.contains('ds'), colors, shadowsTok, vars, boxes: out, widths, grids };
}

const L = await local({ variant: 'typical', engine: 'webkit' });
const res = [];
try {
  for (const job of JOBS) {
    if (only && !only.includes(job.area)) continue;
    const d = await L.device({ device: job.device, mode: 'light', profile: job.profile });
    try {
      let frame;
      if (job.app) { frame = await d.openApp(job.app); await sleep(job.app.startsWith('dollywood') ? 6000 : 2500); }
      else { await d.goto(job.hash); await sleep(2500); frame = d.page.mainFrame(); }
      const data = await frame.evaluate(inPage);
      res.push({ ...job, ...data });
      console.log(job.area, job.device, job.profile, job.hash || '', 'boxes', data.boxes.length, 'widths', data.widths.length, 'grids', data.grids.length);
      if (process.argv.includes('--shots')) await d.shot(path.join(SHOTS, `cards-${job.area}-${job.device}-${job.profile}${job.hash ? '-' + job.hash.slice(1) : ''}.png`));
    } catch (e) { console.log('ERR', job, e.message); res.push({ ...job, error: e.message }); }
    await d.close();
  }
} finally { await L.close(); }
fs.writeFileSync(OUT, JSON.stringify({ note: 'Raw box inventory per area/device/profile (see cards.mjs header). Summarised by cards-summary.mjs.', jobs: res }, null, 0));
console.log('wrote', OUT);
