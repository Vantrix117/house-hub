// Phase 4 GLASS skeptic #2 for "opaque-fill-under-blur": do Prayer's #fab, the Dollywood pair's #lv-north and the build
// guide's #build sheet carry a live backdrop-filter under an (almost) opaque fill? Independent of opaque-blur.mjs (which
// reads the measure/raw files): this opens each app fresh in WebKit and, per element, records the computed
// background-color / background-image / backdrop-filter, the rect, visibility, and every stylesheet rule that matches the
// element and sets background — to explain WHY the fill resolves as it does (e.g. lv-north's source says var(--glass)).
//   node audits/tools/phase4/GLASS/verify-opaque-fill-under-blur-2.mjs
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p4/GLASS/verify-opaque-fill-under-blur-2.json');
const out = { method: 'see script header', runs: [] };

const probe = sels => sels.map(sel => {
  const el = document.querySelector(sel);
  if (!el) return { sel, found: false };
  const s = getComputedStyle(el); const r = el.getBoundingClientRect();
  const bf = (s.backdropFilter && s.backdropFilter !== 'none') ? s.backdropFilter : (s.webkitBackdropFilter || 'none');
  const vis = s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0 && !el.closest('[hidden]');
  let hidAnc = null; for (let a = el; a; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.display === 'none' || +cs.opacity === 0) { hidAnc = (a.id ? '#' + a.id : a.tagName.toLowerCase()) + '.' + [...a.classList].join('.') + ' display=' + cs.display + ' opacity=' + cs.opacity; break; } }
  const rules = [];
  const walk = (list, src) => { for (const ru of list) { if (ru.cssRules && !ru.selectorText) { try { walk(ru.cssRules, src + (ru.conditionText ? ' @' + ru.conditionText.slice(0, 60) : '')); } catch {} continue; } if (!ru.selectorText) continue; let m = false; try { m = el.matches(ru.selectorText); } catch {} if (!m) continue; const st = ru.style; const bg = st.getPropertyValue('background') || st.getPropertyValue('background-color'); const g = st.getPropertyValue('--g'); const bdf = st.getPropertyValue('backdrop-filter') || st.getPropertyValue('-webkit-backdrop-filter'); if (bg || g || bdf) rules.push({ src, sel: ru.selectorText.slice(0, 160), bg: bg ? (bg.slice(0, 220) + (st.getPropertyPriority('background') || st.getPropertyPriority('background-color') ? ' !important' : '')) : undefined, g: g || undefined, bdf: bdf || undefined }); } };
  for (const sh of document.styleSheets) { try { walk(sh.cssRules, sh.href ? sh.href.split('/').pop() : 'inline'); } catch {} }
  const root = getComputedStyle(document.documentElement);
  return { sel, found: true, visible: vis, hiddenAncestor: hidAnc, rect: [r.x, r.y, r.width, r.height].map(Math.round), area: Math.round(r.width * r.height), bgColor: s.backgroundColor, bgImage: s.backgroundImage.slice(0, 160), backdrop: bf, cls: el.className, g: s.getPropertyValue('--g').trim(), tokens: { glass: root.getPropertyValue('--glass').trim(), glassStrong: root.getPropertyValue('--glass-strong').trim(), accentDeep: root.getPropertyValue('--accent-deep').trim(), surface: root.getPropertyValue('--surface').trim() }, flavor: document.documentElement.dataset.flavor || document.body.dataset.flavor || null, rules };
});

const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const [dev, mode] of [['iphone-pwa', 'dark'], ['iphone-pwa', 'light'], ['ipad-portrait', 'light']]) {
    const d = await L.device({ device: dev, mode, profile: 'eli' });
    await d.goto('#home'); await sleep(900);
    // Prayer
    let f = await d.openApp('prayer'); await sleep(2500);
    out.runs.push({ dev, mode, app: 'prayer', state: 'open', res: await f.evaluate(probe, ['#fab', 'nav', '#sheet']) });
    await d.goto('#home'); await sleep(700);
    // Build guide
    f = await d.openApp('dollywood'); await sleep(4000);
    out.runs.push({ dev, mode, app: 'dollywood', state: 'open', res: await f.evaluate(probe, ['#build', '#lv-north', '.lv-northwrap']) });
    if (dev.startsWith('iphone')) {
      for (let i = 0; i < 2; i++) { await f.locator('#bh-handle').click().catch(e => console.log('handle', e.message)); await sleep(600); }
      out.runs.push({ dev, mode, app: 'dollywood', state: 'sheet x2 taps', buildState: await f.evaluate(() => document.getElementById('build')?.dataset.state), res: await f.evaluate(probe, ['#build']) });
    }
    await d.goto('#home'); await sleep(700);
    // Park map
    f = await d.openApp('dollywood-live'); await sleep(4000);
    out.runs.push({ dev, mode, app: 'dollywood-live', state: 'open', res: await f.evaluate(probe, ['#lv-north', '.lv-northwrap', '#loc-btn']) });
    await d.close();
  }
} finally {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  await L.close();
}
for (const r of out.runs) for (const e of r.res) console.log(r.dev, r.mode, r.app, r.state, r.buildState || '', e.sel, e.found ? [e.visible, e.hiddenAncestor, e.rect.join('x'), e.bgColor, e.backdrop, 'rules:' + e.rules.length].join(' | ') : 'NOT FOUND');
console.log('wrote', OUT);
