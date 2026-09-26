// Skeptic s2, VIS-DOLLYWOOD-2: tap targets under 44 px in the build guide, measured inside the hub viewer (the real path),
// with my own target enumeration (not the Phase 2 __vis helper). iPhone (sheet peek, half) and iPad portrait, then with a
// coaster card open (the link buttons the original count skipped). WebKit, as Eli, typical seed.
//   node audits/tools/phase5/ux-verify/VIS-DOLLYWOOD-2/s2-targets.mjs
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = path.resolve('audits/evidence/p5/ux-verify/VIS-DOLLYWOOD-2/s2');
fs.mkdirSync(OUT, { recursive: true });
const res = {};
const measure = f => f.evaluate(() => {
  const sel = 'button,a[href],input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=switch],[tabindex="0"],label[for]';
  const vis = e => { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false; for (let n = e; n; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === 'none' || c.visibility === 'hidden') return false; if (n.hidden) return false; } const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const seen = new Set(), out = [];
  for (const e of document.querySelectorAll(sel)) {
    if (!vis(e) || e.disabled) continue;
    if (e.closest('label') && e.matches('input[type=checkbox],input[type=radio]')) continue; // the label is the target
    let t = e; if (seen.has(t)) continue; seen.add(t);
    const r = e.getBoundingClientRect();
    const label = (e.getAttribute('aria-label') || e.title || e.textContent || e.id || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
    out.push({ label, id: e.id || '', cls: (e.className && e.className.baseVal === undefined ? e.className : '').toString().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height), onscreen: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth });
  }
  const small = out.filter(t => t.w < 44 || t.h < 44);
  return { total: out.length, nSmall: small.length, nSmallOnscreen: small.filter(t => t.onscreen).length, small };
});
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const dev of ['iphone-pwa', 'ipad-portrait']) {
    const d = await L.device({ device: dev, profile: 'eli', fixedTime: false });
    const f = await d.openApp('dollywood');
    await f.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: 30000 });
    await sleep(1200);
    res[dev + '.default'] = await measure(f);
    await d.page.screenshot({ path: path.join(OUT, dev + '-default.png'), animations: 'disabled' });
    if (dev === 'iphone-pwa') { await f.evaluate(() => { document.getElementById('build').dataset.state = 'half'; }); await sleep(700); res[dev + '.half'] = await measure(f); }
    // open a coaster card from the legend, then measure again (card link buttons)
    const opened = await f.evaluate(() => { const c = document.querySelector('#clegend .cle'); if (!c) return false; c.click(); return c.textContent; });
    await sleep(1500);
    res[dev + '.coasterCard'] = { opened, ...(await measure(f)) };
    res[dev + '.cardLinks'] = await f.evaluate(() => [...document.querySelectorAll('.pop a.btn,.info a.btn,a.btn')].filter(a => a.getBoundingClientRect().width > 0).map(a => { const r = a.getBoundingClientRect(); return `${a.textContent.trim()} ${Math.round(r.width)}x${Math.round(r.height)}`; }));
    await d.page.screenshot({ path: path.join(OUT, dev + '-coaster-card.png'), animations: 'disabled' });
    console.log(dev, JSON.stringify({ def: res[dev + '.default'].nSmall, half: res[dev + '.half'] && res[dev + '.half'].nSmall, card: res[dev + '.coasterCard'].nSmall, links: res[dev + '.cardLinks'] }));
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(OUT, 'targets.json'), JSON.stringify(res, null, 1));
  await L.close();
}
