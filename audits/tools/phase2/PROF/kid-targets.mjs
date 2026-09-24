// PROF (audit Phase 2), brief item 6: kid-mode tap targets and text-only controls in the shell, measured as Ezra (kid)
// on the iPhone and the iPad. Every visible button / link / input / [role=button] on Home, Apps, Chat, Me, the app
// viewer's top bar and the Switch-app sheet: size, whether it has an icon or face, and its text.
//
//   node "audits/tools/phase2/PROF/kid-targets.mjs"
//
// Writes audits/evidence/p2/PROF/kid-targets.json and prints the controls under 44 px and under the kid token --tap (64 px).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'real' });
const all = {};
const measure = (page, where) => page.evaluate(where => {
  const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight * 3; };
  const out = [];
  for (const e of document.querySelectorAll('button, a[href], input, select, [role=button], .tile, .pcard')) {
    if (!vis(e) || e.closest('[hidden]')) continue;
    const r = e.getBoundingClientRect();
    out.push({ where, id: e.id || null, cls: (e.className && e.className.baseVal === undefined ? e.className : '').toString().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height),
      icon: !!e.querySelector('svg, img, .avatar, .app-icon'), text: (e.innerText || e.value || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40) });
  }
  return { tap: getComputedStyle(document.documentElement).getPropertyValue('--tap').trim(), items: out };
}, where);

try {
  for (const dev of ['iphone-pwa', 'ipad-portrait']) {
    const d = await L.device({ device: dev, profile: 'ezra', fixedTime: false }); const { page } = d;
    const rows = []; let tap = null;
    const grab = async where => { const m = await measure(page, where); tap = m.tap; rows.push(...m.items); };
    await d.goto('#home'); await page.waitForSelector('#kid-apps'); await sleep(1500); await grab('home');
    await page.click('.tab[data-tab="apps"]'); await sleep(800); await grab('apps');
    await page.click('.tab[data-tab="chat"]'); await sleep(1500); await grab('chat');
    await page.click('.tab[data-tab="me"]'); await sleep(800); await grab('me');
    await page.click('.tab[data-tab="apps"]'); await sleep(500); await page.click('#grid .tile[data-id="tally"]'); await sleep(2000); await grab('viewer');
    await page.click('#pill-name'); await sleep(800); await grab('switch-app sheet');
    all[dev] = { tapToken: tap, rows };
    const small = rows.filter(r => r.h < 44 || r.w < 44), underKid = rows.filter(r => (r.h < 64 || r.w < 64) && !(r.h < 44 || r.w < 44));
    console.log(`\n${dev}: kid --tap = ${tap}; ${rows.length} controls; ${small.length} under 44 px; ${underKid.length} more under 64 px`);
    for (const r of small) console.log(`  <44  ${r.where.padEnd(16)} ${String(r.w + '×' + r.h).padEnd(9)} icon=${r.icon ? 'y' : 'n'}  "${r.text}"`);
    for (const r of underKid) console.log(`  <64  ${r.where.padEnd(16)} ${String(r.w + '×' + r.h).padEnd(9)} icon=${r.icon ? 'y' : 'n'}  "${r.text}"`);
    const textOnly = rows.filter(r => !r.icon && r.text && !/^\d$/.test(r.text));
    console.log(`  text-only controls a pre-reader must read: ${[...new Set(textOnly.map(r => r.where + ': ' + r.text))].join(' | ')}`);
    if (dev === 'ipad-portrait') await page.screenshot({ path: path.join(OUT, 'kid-switch-app-sheet-ipad.png'), scale: 'css' });
    await d.close();
  }
  fs.writeFileSync(path.join(OUT, 'kid-targets.json'), JSON.stringify(all, null, 1));
} finally { await L.close(); }
