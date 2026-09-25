// Phase 4 ICON, skeptic 2: re-measure "--gold used as an icon ink on its own tint fails 3:1 in Hearth".
// Independent of measure.mjs. For each named target: the computed ink colour, the computed ink token values, and the
// median background pixel under the icon box with the icon hidden (screenshot at CSS scale). WCAG ratio of ink vs bg.
// Also checks whether the Home Stars/Kids heads pick up index.html:199 (--gold-ink) instead of --gold.
//   node audits/tools/phase4/ICON/verify-gold-icon-ink-hearth-2.mjs [theme]
// → audits/evidence/p4/ICON/verify-gold-icon-ink-hearth-2[-<theme>].json (+ one PNG crop per surface in hearth)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const THEME = process.argv[2] || 'hearth';
const MODE = ['midnight', 'forest'].includes(THEME) ? 'dark' : 'light';
const OUT = path.resolve('audits/evidence/p4/ICON');
const base = 'verify-gold-icon-ink-hearth-2' + (THEME === 'hearth' ? '' : '-' + THEME);

const waitFn = (d, fn, t = 10000) => d.page.waitForFunction(fn, null, { timeout: t }).then(() => true, () => false);
async function home(d) {
  await d.goto('#home');
  await d.page.waitForSelector('#view-home .home-hero, #view-home #tv', { timeout: 15000 });
  await waitFn(d, () => !!(window.hub && hub.sync && hub.sync.lastPull));
  await sleep(1500);
}
const SURF = [
  { name: 'home-adult', device: 'ipad-portrait', profile: 'eli', open: home,
    targets: { 'reminders-bell': '#remlist', 'kids-card-head': '.kids-card h2 .app-icon svg' } },
  { name: 'home-kid', device: 'ipad-portrait', profile: 'ezra', open: home,
    targets: { 'reminders-bell': '#remlist', 'stars-card-head': '.stars-card h2 .app-icon svg', 'star-big': '.star-big .icon' } },
  { name: 'me-adult', device: 'ipad-portrait', profile: 'eli', open: async d => { await home(d); await d.page.click('#tabbar .tab[data-tab="me"]'); await sleep(2000); },
    targets: { 'rewards-head': '#rewards h2 .app-icon svg' } },
  { name: 'tv', device: 'tv', profile: 'tv', open: async d => { await d.goto('#home'); await d.page.waitForSelector('#tv', { timeout: 15000 }); await sleep(3000); },
    targets: { 'tv-stars-head': '.tv-stars h2 .app-icon svg', 'reminders-bell': '.tv-rem h2 .app-icon svg' } },
  { name: 'kidverse-kid', device: 'iphone-pwa', profile: 'ezra', app: 'kidverse',
    targets: { 'days-on-star': '.days span.on .icon', 'count-star': '.stars .count .icon' } },
  { name: 'f260', device: 'ipad-portrait', profile: 'eli', app: 'f260',
    targets: { 'mile-on-glyph': '.mile.on .mi' } },
];

const PAGE = String.raw`(sels) => {
  const out = [];
  for (const [key, s0] of Object.entries(sels)) {
    // '#remlist' means: the bell in the card that holds #remlist
    let els = s0 === '#remlist' ? [...document.querySelectorAll('#remlist')].map(l => l.closest('.card, .tv-pane') && l.closest('.card, .tv-pane').querySelector('h2 .app-icon svg')).filter(Boolean) : [...document.querySelectorAll(s0)];
    els.forEach((el, i) => {
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect(); if (r.width < 4) return;
      const cs = getComputedStyle(el); const host = el.closest('.app-icon, .mi, .days span, .count') || el.parentElement; const hs = getComputedStyle(host);
      const rs = getComputedStyle(document.documentElement);
      el.dataset.vg = key + '-' + i;
      out.push({ key, i, id: el.dataset.vg, text: el.tagName === 'svg' || el.tagName === 'SVG' ? null : el.textContent.trim().slice(0, 4), color: cs.color, stroke: cs.stroke,
        hostBg: hs.backgroundImage !== 'none' ? hs.backgroundImage.slice(0, 200) : hs.backgroundColor, tint: hs.getPropertyValue('--tint').trim(),
        tokens: { gold: rs.getPropertyValue('--gold').trim(), goldInk: rs.getPropertyValue('--gold-ink').trim(), goldSoft: rs.getPropertyValue('--gold-soft').trim(), surface: rs.getPropertyValue('--surface').trim() } });
    });
  }
  return out;
}`;

const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = p => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
const parse = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (m) return m[1].split(/[ ,/]+/).filter(Boolean).slice(0, 3).map(Number); const c = String(s).match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/); if (c) return [c[1], c[2], c[3]].map(v => Math.round(v * 255)); return null; };

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = { theme: THEME, mode: MODE, engine: 'webkit', surfaces: {} };
try {
  for (const p of ['eli', 'ezra', 'tv']) { try { await L.apiAs(p, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: THEME, updated_at: Date.now() } }); } catch (e) { res['themeErr_' + p] = String(e.message || e).slice(0, 120); } }
  for (const s of SURF) {
    const d = await L.device({ device: s.device, mode: MODE, profile: s.profile, localStorage: { 'hub.theme': JSON.stringify(THEME) } });
    try {
      let fr = d.page, off = { x: 0, y: 0 };
      if (s.app) { fr = await d.openApp(s.app); await sleep(3000); } else await s.open(d);
      const applied = await fr.evaluate(() => ({ theme: document.documentElement.dataset.theme, scheme: document.documentElement.dataset.scheme }));
      const items = await fr.evaluate(eval(PAGE), s.targets);
      await sleep(400);
      if (s.app) { const bb = await (await fr.frameElement()).boundingBox(); off = { x: bb.x, y: bb.y }; }
      const got = [];
      for (const it of items) {
        await fr.evaluate(id => document.querySelector(`[data-vg="${id}"]`).scrollIntoView({ block: 'center' }), it.id); await sleep(300);
        const r = await fr.evaluate(id => { const q = document.querySelector(`[data-vg="${id}"]`).getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; }, it.id);
        const clip = { x: off.x + r.x, y: off.y + r.y, width: r.w, height: r.h };
        const vis = await d.page.screenshot({ clip, scale: 'css', animations: 'disabled' });
        await fr.evaluate(id => { const e = document.querySelector(`[data-vg="${id}"]`); if (e.tagName.toLowerCase() === 'svg') e.style.setProperty('visibility', 'hidden', 'important'); else e.style.setProperty('color', 'transparent', 'important'); }, it.id);
        await sleep(80);
        const hid = await d.page.screenshot({ clip, scale: 'css', animations: 'disabled' });
        await fr.evaluate(id => document.querySelector(`[data-vg="${id}"]`).removeAttribute('style'), it.id);
        const px = await d.page.evaluate(async ([a, b]) => {
          const ld = async b64 => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height).data; };
          const H = await ld(a), V = await ld(b); const h = [], v = [];
          for (let i = 0; i < H.length; i += 4) { h.push([H[i], H[i + 1], H[i + 2]]); v.push([V[i], V[i + 1], V[i + 2]]); }
          return { h, v };
        }, [hid.toString('base64'), vis.toString('base64')]);
        const L2 = px.h.map(lum); const idx = L2.map((_, i) => i).sort((a, b) => L2[a] - L2[b]); const bg = px.h[idx[idx.length >> 1]];
        const ink = parse(it.color); const peak = Math.max(...px.v.map(p => ratio(p, bg)));
        const row = { ...it, rect: r, bg, ink, ratio: ink ? ratio(ink, bg) : null, peakPixel: +peak.toFixed(2),
          goldVsBg: ratio(parse(`rgb(${[1, 3, 5].map(k => parseInt(it.tokens.gold.slice(k, k + 2), 16)).join(',')})`), bg),
          goldInkVsBg: ratio(parse(`rgb(${[1, 3, 5].map(k => parseInt(it.tokens.goldInk.slice(k, k + 2), 16)).join(',')})`), bg) };
        got.push(row);
        if (THEME === 'hearth' && it.i === 0) { const pad = 12; await d.page.screenshot({ path: path.join(OUT, `${base}-${s.name}-${it.key}.png`), clip: { x: Math.max(0, clip.x - pad), y: Math.max(0, clip.y - pad), width: clip.width + 2 * pad, height: clip.height + 2 * pad }, scale: 'css', animations: 'disabled' }); }
      }
      res.surfaces[s.name] = { device: s.device, profile: s.profile, applied, items: got };
      console.log(s.name, JSON.stringify(applied), got.map(g => `${g.key}#${g.i}${g.text ? '(' + g.text + ')' : ''} ink=${g.color} bg=${g.bg} r=${g.ratio} peak=${g.peakPixel} gold=${g.goldVsBg} goldInk=${g.goldInkVsBg}`).join('\n  '));
    } catch (e) { res.surfaces[s.name] = { error: String(e.message || e).slice(0, 300) }; console.log(s.name, 'ERROR', String(e.message || e).slice(0, 300)); }
    await d.close();
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, base + '.json'), JSON.stringify(res, null, 1));
console.log('wrote', base + '.json');
