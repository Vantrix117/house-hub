// Skeptic s1, VIS-DOLLYWOOD-2: count tap targets under 44 px in the build guide, opened inside the hub (iframe),
// iPhone PWA and iPad portrait, WebKit, as Eli, typical seed. Own selector (not lib-vis): every visible interactive element.
// Also opens a listing card to measure the card link buttons (Web / Photos / ...).
//   node "audits/tools/phase5/ux-verify/VIS-DOLLYWOOD-2/s1-targets.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = path.resolve('audits/evidence/p5/ux-verify/VIS-DOLLYWOOD-2/s1');
fs.mkdirSync(OUT, { recursive: true });
const out = {};
const measure = f => f.evaluate(() => {
  const sel = 'button, a[href], [role=button], [role=tab], input:not([type=hidden]), select, textarea, summary, [tabindex="0"]';
  const seen = new Set(), res = [];
  for (const e of document.querySelectorAll(sel)) {
    if (seen.has(e)) continue; seen.add(e);
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden' || cs.display === 'none' || e.disabled) continue;
    let p = e, hidden = false; while (p) { const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden') { hidden = true; break; } p = p.parentElement; }
    if (hidden) continue;
    const label = (e.getAttribute('aria-label') || e.title || e.textContent || e.id || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
    res.push({ label, tag: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''), w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.top + scrollY) });
  }
  return res;
});
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const dev of ['iphone-pwa', 'ipad-portrait']) {
    const d = await L.device({ device: dev, profile: 'eli', fixedTime: false });
    const f = await d.openApp('dollywood');
    await f.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: 30000 });
    await sleep(1200);
    const frameBox = await (await f.frameElement()).boundingBox();
    const states = {};
    states.default = await measure(f);
    if (dev === 'iphone-pwa') { await f.evaluate(() => { document.getElementById('build').dataset.state = 'half'; }); await sleep(600); states.sheetHalf = await measure(f); }
    // open a listing card
    const opened = await f.evaluate(() => { try { const o = OFF.find(x => x.pos); showOfficial(o); return o.name; } catch (e) { return 'ERR ' + e.message; } });
    await sleep(600);
    const links = await f.evaluate(() => [...document.querySelectorAll('.pop a.btn, .pop button, .info a.btn')].filter(e => e.getBoundingClientRect().width > 0).map(e => { const r = e.getBoundingClientRect(); return { label: e.textContent.trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; }));
    await d.page.screenshot({ path: path.join(OUT, `${dev}-card.png`), animations: 'disabled' });
    const under = s => s.filter(t => t.w < 44 || t.h < 44);
    out[dev] = { frameBox, cardOpened: opened, cardLinks: links };
    for (const k in states) out[dev][k] = { total: states[k].length, under44: under(states[k]).length, list: under(states[k]).map(t => `${t.label} [${t.tag}] ${t.w}x${t.h}`) };
    await d.close();
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'targets.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1).slice(0, 9000));
