// Completeness critic, Verses: a quick double tap on a rating button on the iPhone (stacked buttons).
// After a rating, render() swaps #act-rate (3 stacked buttons) for #act-show (Read aloud / Show) in the same card
// (apps/verses.html:108-116, 303-304, 328-329). The investigator tested a double tap on "Got it" on the iPad only
// (layout.mjs, double-tap-ipad.png). Here: iPhone PWA and iPad portrait, each rating button, two real mouse clicks 90 ms apart
// at the same point; batch writes are aborted so the server stays at the seed and every run starts the same.
// Run: node "audits/tools/phase3/verses/critic-doubletap.mjs"
import fs from 'node:fs';
import { local, sleep, DEMO } from '../../lib/local.mjs';
import { openVerses, state } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = { runs: [] };
try {
  for (const device of ['iphone-pwa', 'ipad-portrait']) for (const kind of ['not', 'almost', 'got']) {
    const d = await L.device({ device, profile: 'eli', installClock: DEMO });
    await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
    const f = await openVerses(d);
    await f.evaluate(() => { window.__spoke = []; try { speechSynthesis.speak = u => { window.__spoke.push(u.text); }; } catch {} });
    await f.click('#show'); await sleep(200);
    const before = await state(f);
    const box = await f.evaluate(k => { const r = document.querySelector(`[data-rate="${k}"]`).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, kind);
    const off = await d.page.evaluate(() => { const r = document.querySelector('iframe').getBoundingClientRect(); return { x: r.x, y: r.y }; });
    await d.page.mouse.click(off.x + box.x, off.y + box.y);
    await sleep(90);
    const hit = await f.evaluate(p => { const e = document.elementFromPoint(p.x, p.y); const b = e && e.closest('button'); return b ? (b.id || b.dataset.rate) : (e && e.tagName); }, box);
    await d.page.mouse.click(off.x + box.x, off.y + box.y);
    await sleep(300);
    const after = await state(f);
    const run = { device, kind, firstCard: before.ref, tapAt: box, secondTapLandedOn: hit, nowOnCard: after.ref,
      nextCardRevealed: await f.evaluate(() => !document.getElementById('act-rate').hidden), spoke: await f.evaluate(() => window.__spoke),
      localLog: await f.evaluate(() => { const c = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('hub.cache.verses.person'))) || '{}'); return c.items && c.items.log && c.items.log.v['2026-09-22']; }) };
    if (device === 'iphone-pwa' && run.nextCardRevealed) await sleep(900), run.textVeiledAfter900ms = await f.evaluate(() => document.getElementById('text').classList.contains('veiled')), run.shot = 'audits/evidence/p3/verses/critic-doubletap-' + kind + '-iphone.png', await d.page.screenshot({ path: run.shot, scale: 'css' });
    out.runs.push(run);
    await d.close();
  }
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync('audits/evidence/p3/verses/critic-doubletap.json', JSON.stringify(out, null, 1));
} finally { await L.close(); }
