// Phase 4 ICON skeptic #1 — independent re-measure of "icon inks from apps.json / profile hex are never lifted for dark".
// For each theme it signs in (theme set as the person pref via PUT /api/data/hub/theme + localStorage 'hub.theme'),
// visits a surface, and for each target icon records: the computed ink (svg stroke, else color), where that ink comes
// from (inline --tint / --accent on an ancestor), and the background = median pixel of the icon box with the icon
// hidden (visibility:hidden), plus min/max contrast over all background pixels in the box. Contrast = WCAG 2.x.
// Pixels are decoded in a helper page's <canvas>. WebKit, local rig only. Read-only.
//   node audits/tools/phase4/ICON/verify-icon-ink-hex-not-lifted-dark-1.mjs [theme,theme…]
// → audits/evidence/p4/ICON/verify-icon-ink-hex-not-lifted-dark-1-<theme>.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const THEMES = (process.argv[2] || 'midnight,forest,parchment').split(',');
const OUT = path.resolve('audits/evidence/p4/ICON');

const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
const parse = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (m) return m[1].split(/[ ,/]+/).filter(Boolean).slice(0, 3).map(Number); const c = String(s).match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/); if (c) return [c[1], c[2], c[3]].map(v => Math.round(v * 255)); const h = String(s).match(/#([0-9a-f]{6})/i); if (h) return [0, 2, 4].map(i => parseInt(h[1].slice(i, i + 2), 16)); return null; };

const SURF = [
  { name: 'adult-apps', device: 'iphone-pwa', profile: 'eli', hash: '#apps', sel: '.tile .ticon svg' },
  { name: 'adult-home', device: 'ipad-portrait', profile: 'eli', hash: '#home', sel: '.card h2 > .app-icon > svg' },
  { name: 'adult-chat', device: 'ipad-portrait', profile: 'eli', hash: '#chat', sel: '.mrow.bot > .app-icon > svg', first: 1 },
  { name: 'kid-apps', device: 'iphone-pwa', profile: 'ezra', hash: '#apps', sel: '.tile .ticon svg' },
  { name: 'kid-home', device: 'ipad-portrait', profile: 'ezra', hash: '#home', sel: '#kid-apps .app-icon svg, .card h2 > .app-icon > svg' },
  { name: 'tv', device: 'tv', profile: 'tv', hash: '#home', sel: '.tv-pane h2 > .app-icon > svg' },
  { name: 'park-map', device: 'iphone-pwa', profile: 'eli', app: 'dollywood-live', sel: '.lv-tabs button[aria-pressed=true] svg' },
];

async function measure(d, frame, sel, first) {
  const page = d.page;
  const handles = await frame.$$(sel);
  const off = frame === page.mainFrame() ? { x: 0, y: 0 } : await (await frame.frameElement()).boundingBox();
  const helper = await d.ctx.newPage();
  const res = [];
  for (const h of handles.slice(0, first || 99)) {
    const info = await h.evaluate(el => {
      el.scrollIntoView({ block: 'center' });
      const cs = getComputedStyle(el);
      const ink = cs.stroke && cs.stroke !== 'none' ? cs.stroke : cs.color;
      let src = null;
      for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const st = e.getAttribute('style') || ''; if (/--tint|--accent/.test(st)) { src = (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + '.' + [...e.classList].join('.')) + ' style="' + st.slice(0, 80) + '"'; break; } }
      const ctl = el.closest('button, .card, .tv-pane, .mrow'); const lab = ctl ? (ctl.getAttribute('aria-label') || (ctl.querySelector('h2') || ctl).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40) : '';
      const r = el.getBoundingClientRect(); const ai = el.closest('.app-icon'); const ar = ai ? ai.getBoundingClientRect() : null;
      return { ink, src, label: lab, rect: { x: r.x, y: r.y, w: r.width, h: r.height }, box: ar ? { w: Math.round(ar.width), h: Math.round(ar.height) } : null, sw: parseFloat(cs.strokeWidth), theme: document.documentElement.dataset.theme || '(none)', scheme: document.documentElement.dataset.scheme, accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() };
    });
    if (!(info.rect.w > 0 && info.rect.h > 0)) continue;   // not rendered (a hidden card)
    await sleep(150);
    await h.evaluate(el => { el.style.visibility = 'hidden'; });
    await sleep(80);
    const clip = { x: off.x + info.rect.x, y: off.y + info.rect.y, width: info.rect.w, height: info.rect.h };
    const buf = await page.screenshot({ clip, scale: 'css', animations: 'disabled' });
    await h.evaluate(el => { el.style.visibility = ''; });
    const px = await helper.evaluate(async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; const out = []; for (let i = 0; i < d.length; i += 4) out.push([d[i], d[i + 1], d[i + 2]]); return out; }, buf.toString('base64'));
    const fg = parse(info.ink);
    const byL = px.map(p => [lum(p), p]).sort((a, b) => a[0] - b[0]);
    const bg = byL[Math.floor(byL.length / 2)][1];
    const all = px.map(p => cr(fg, p));
    res.push({ label: info.label, ink: info.ink, fg, inkFrom: info.src, bg, contrast: cr(fg, bg), min: Math.min(...all), max: Math.max(...all), iconPx: `${Math.round(info.rect.w)}x${Math.round(info.rect.h)}`, tintBox: info.box, strokeWidth: info.sw, applied: { theme: info.theme, scheme: info.scheme }, accent: info.accent });
  }
  await helper.close();
  return res;
}

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const theme of THEMES) {
    const mode = ['midnight', 'forest'].includes(theme) ? 'dark' : 'light';
    for (const p of ['eli', 'ezra']) { const r = await L.apiAs(p, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme, updated_at: Date.now() } }); if (r.status >= 300) console.log('PUT', p, r.status, JSON.stringify(r.body)); }
    const out = { theme, mode, engine: 'webkit', surfaces: {} };
    for (const s of SURF) {
      const d = await L.device({ device: s.device, mode, profile: s.profile, localStorage: { 'hub.theme': JSON.stringify(theme) } });
      try {
        let frame;
        if (s.app) { await d.goto('#home'); await sleep(2500); frame = await d.openApp(s.app, { wait: s.sel }); await sleep(3000); }
        else { await d.goto(s.hash); await sleep(3500); frame = d.page.mainFrame(); }
        out.surfaces[s.name] = { device: s.device, profile: s.profile, items: await measure(d, frame, s.sel, s.first) };
        if (s.name === 'kid-apps' || (s.name === 'adult-home' && theme === 'midnight')) { await d.page.evaluate(() => scrollTo(0, 0)); await d.page.screenshot({ path: path.join(OUT, `verify-icon-ink-hex-not-lifted-dark-1-${s.name}-${theme}.png`), scale: 'css', animations: 'disabled' }); }
      } catch (e) { out.surfaces[s.name] = { error: String(e).slice(0, 300) }; }
      await d.close();
      const it = out.surfaces[s.name].items || [];
      console.log(theme, s.name, it.map(i => `${i.label}|${i.fg}|${i.bg}|${i.contrast}|${i.applied.theme}/${i.applied.scheme}`).join(' ; ') || out.surfaces[s.name].error);
    }
    fs.writeFileSync(path.join(OUT, `verify-icon-ink-hex-not-lifted-dark-1-${theme}.json`), JSON.stringify(out, null, 1));
  }
} finally { await L.close(); }
