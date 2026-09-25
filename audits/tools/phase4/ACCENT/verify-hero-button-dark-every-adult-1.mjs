// Phase 4 ACCENT — skeptic #1 for "hero-button-dark-every-adult". Independent re-measure on the local rig (WebKit).
// For each profile × theme: sign in, open #me, read button#switch's computed colour/size, hide its label, screenshot,
// take the median painted background inside the button, and compute WCAG contrast (computed ink and painted ink).
//   node audits/tools/phase4/ACCENT/verify-hero-button-dark-every-adult-1.mjs [themes] [profiles] [shot]
// themes: midnight, forest, system-dark, hearth-dark (Hearth picked, OS dark), system-light, parchment, frost, hearth-light
// → audits/evidence/p4/ACCENT/verify-hero-button-dark-every-adult-1.json (+ one PNG with shot=1)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
import { decodePng } from './png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p4', 'ACCENT');
const [TH = '', PR = '', SHOT = ''] = process.argv.slice(2);
const KEYS = { 'system-light': ['system', 'light'], 'system-dark': ['system', 'dark'], midnight: ['midnight', 'dark'], forest: ['forest', 'dark'],
  'hearth-dark': ['hearth', 'dark'], 'hearth-light': ['hearth', 'light'], parchment: ['parchment', 'light'], frost: ['frost', 'light'] };
const themes = (TH || 'midnight,forest,system-dark,hearth-dark,system-light,parchment').split(',');
const profiles = (PR || 'eli,christian,mom,dad,niece,tv').split(',');

const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
const rgb = s => { const n = (s.match(/[\d.]+/g) || []).map(Number); return /^color\(srgb/.test(s) ? n.slice(0, 3).map(v => Math.round(v * 255)) : n.slice(0, 3); };

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const rows = [];
try {
  for (const theme of themes) {
    const [th, mode] = KEYS[theme];
    for (const p of profiles) {
      if (p !== 'tv') await L.apiAs(p, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: th } }).catch(e => console.log('theme put', p, e.message));
      const device = p === 'tv' ? 'tv' : 'ipad-portrait';
      const d = await L.device({ device, mode, profile: p, localStorage: { 'hub.theme': JSON.stringify(th) } });
      const row = { theme, profile: p, device, mode };
      try {
        if (p === 'tv') { await d.goto(''); await sleep(2500); await d.page.evaluate(() => { location.hash = '#me'; }); await d.page.waitForSelector('#view-me.on #switch', { timeout: 10000 }); }
        else { await d.goto('#me'); await d.page.waitForSelector('#switch', { timeout: 10000 }); }
        await d.page.evaluate(() => document.querySelector('#switch').scrollIntoView({ block: 'center' }));
        await sleep(1500);
        const info = await d.page.evaluate(() => {
          const e = document.querySelector('#switch'); const cs = getComputedStyle(e), r = e.getBoundingClientRect(); const h = document.documentElement;
          return { text: e.textContent.trim(), cls: e.className, inHero: !!e.closest('.hero'), color: cs.color, bgColor: cs.backgroundColor, fs: parseFloat(cs.fontSize), fw: cs.fontWeight,
            accent: getComputedStyle(h).getPropertyValue('--accent').trim(), accentDeep: cs.getPropertyValue('--accent-deep').trim(), dataTheme: h.dataset.theme || '(none)', dataScheme: h.dataset.scheme, kind: h.dataset.kind || '',
            r: { x: r.left, y: r.top, w: r.width, h: r.height } };
        });
        Object.assign(row, info);
        const shown = decodePng(await d.page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' }));
        await d.page.evaluate(() => { const s = document.createElement('style'); s.id = '__v'; s.textContent = '#switch{color:transparent!important;text-shadow:none!important}'; document.head.appendChild(s); });
        await sleep(200);
        const hidden = decodePng(await d.page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' }));
        await d.page.evaluate(() => document.getElementById('__v').remove());
        const px = img => { const out = []; for (let y = Math.ceil(info.r.y + 3); y < info.r.y + info.r.h - 3; y++) for (let x = Math.ceil(info.r.x + 6); x < info.r.x + info.r.w - 6; x++) { const i = (y * img.w + x) * 4; out.push([img.px[i], img.px[i + 1], img.px[i + 2]]); } return out; };
        const bgs = px(hidden), ink = px(shown);
        const s = [...bgs].sort((a, b) => lum(a) - lum(b)); const bg = s[s.length >> 1];
        const far = ink.reduce((b, q) => Math.abs(lum(q) - lum(bg)) > Math.abs(lum(b) - lum(bg)) ? q : b, bg);
        row.bgPainted = bg; row.inkPainted = far; row.ink = rgb(info.color);
        row.crComputed = cr(row.ink, bg); row.crPainted = cr(far, bg);
        row.large = info.fs >= 24 || (info.fs >= 18.66 && +info.fw >= 700);
        row.pass = row.crComputed >= (row.large ? 3 : 4.5);
        if (SHOT && SHOT.split(',').includes(`${p}:${theme}`)) {
          await d.page.screenshot({ path: path.join(EVID, `verify-hero-button-dark-every-adult-1-${p}-${theme}.png`), scale: 'css', animations: 'disabled', caret: 'hide',
            clip: { x: 0, y: Math.max(0, info.r.y - 140), width: Math.min(900, d.page.viewportSize().width), height: 280 } });
        }
      } catch (e) { row.error = String(e.message).split('\n')[0]; }
      await d.close();
      rows.push(row);
      console.log(theme, p, row.dataTheme, row.dataScheme, 'ink', row.color, 'bg', JSON.stringify(row.bgPainted), 'fs', row.fs, row.fw, 'cr', row.crComputed, '/', row.crPainted, row.error || '');
    }
  }
} finally { await L.close(); }
const out = path.join(EVID, 'verify-hero-button-dark-every-adult-1.json');
let prev = []; try { prev = JSON.parse(fs.readFileSync(out, 'utf8')).rows || []; } catch {}
const merged = [...prev.filter(r => !rows.some(q => q.theme === r.theme && q.profile === r.profile)), ...rows];
fs.writeFileSync(out, JSON.stringify({ script: 'audits/tools/phase4/ACCENT/verify-hero-button-dark-every-adult-1.mjs', engine: 'webkit', rows: merged }, null, 1));
console.log('wrote', path.relative(ROOT, out));
