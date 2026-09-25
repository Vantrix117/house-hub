// Phase 4 DARK: F260's week-note "Copy" button (apps/f260.html:1297) has no author background: F260 styles every
// <button> with color:inherit only (apps/f260.html:45) and gives .jr .jft buttons background:none (:333), but the
// week-note footer is .wnbody .jft, so the browser paints ButtonFace, a system colour that follows the used
// color-scheme (design.css:15 `light dark` = the OS), under the theme's ink. Probed with a synthetic element carrying the
// same classes inside the real F260 document (the rules are class-only), in WebKit and Chromium.
//   node audits/tools/phase4/DARK/native-button.mjs  -> audits/evidence/p4/DARK/native-button.json
import fs from 'node:fs'; import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const Lm = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const CR = (a, b) => { const x = Lm(a), y = Lm(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
const P = s => String(s).match(/[\d.]+/g).slice(0, 3).map(Number);
const out = [];
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', engine });
  try {
    for (const [theme, mode] of [['system', 'light'], ['midnight', 'light'], ['midnight', 'dark'], ['parchment', 'dark']]) {
      await L.reset('typical');
      if (theme !== 'system') await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } });
      const d = await L.device({ device: 'ipad-portrait', mode, profile: 'eli', localStorage: theme === 'system' ? null : { 'hub.theme': JSON.stringify(theme) } });
      try {
        const f = await d.openApp('f260', { wait: 'body' }); await sleep(2000);
        const r = await f.evaluate(() => {
          const w = document.createElement('div'); w.className = 'wnbody'; w.style.cssText = 'display:block;position:fixed;left:10px;top:10px;z-index:99999;width:300px';
          w.innerHTML = '<div class="jft"><span class="jsaved">Saved</span><button type="button" id="probeCopy">Copy</button></div>'; document.body.append(w);
          const b = document.getElementById('probeCopy'); const cs = getComputedStyle(b);
          return { color: cs.color, bg: cs.backgroundColor, cardBg: getComputedStyle(w).backgroundColor, scheme: document.documentElement.dataset.scheme, theme: document.documentElement.dataset.theme || null };
        });
        const ratio = CR(P(r.color), P(r.bg));
        out.push({ engine, theme, mode, ...r, textVsButtonFace: ratio });
        console.log(engine, theme, mode, 'color', r.color, 'bg', r.bg, 'card', r.cardBg, 'ratio', ratio);
      } finally { await d.close(); }
    }
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(ROOT, 'audits/evidence/p4/DARK/native-button.json'), JSON.stringify({ note: 'See header of audits/tools/phase4/DARK/native-button.mjs. ratio = computed text colour on the computed ButtonFace background.', out }, null, 1));
