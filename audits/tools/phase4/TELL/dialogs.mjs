// TELL / dialogs: "alert() / confirm() / prompt()" — which of the call sites static.mjs found can a household member
// actually raise, triggered for real where it is cheap. EVERY dialog is DISMISSED (Cancel), so nothing is written, and
// the pairing-code rotation (index.html:1643) is never clicked.
//   node audits/tools/phase4/TELL/dialogs.mjs   → audits/evidence/p4/TELL/dialogs.json
// WebKit, iPad portrait, light. Areas without a call site (static.json dialog count 0) are not driven.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p4/TELL/dialogs.json');
const out = { note: 'See the header of audits/tools/phase4/TELL/dialogs.mjs.', runs: {} };
async function run(L, name, { profile = 'eli', device = 'ipad-portrait', variant } = {}, steps) {
  if (variant) await L.reset(variant);
  const d = await L.device({ device, profile });
  const got = [];
  d.page.on('dialog', async dg => { got.push({ type: dg.type(), message: dg.message().slice(0, 140) }); await dg.dismiss().catch(() => {}); });
  const log = [];
  try { await steps(d, log); } catch (e) { log.push('error: ' + e.message.split('\n')[0].slice(0, 120)); }
  await sleep(400);
  out.runs[name] = { profile, device, variant: variant || 'typical', raised: got, steps: log };
  console.log(name, JSON.stringify(got.map(g => g.type + ': ' + g.message.slice(0, 60))), log.filter(l => /error|missing/.test(l)).join(' | '));
  await d.close();
}
const click = async (fr, sel, log, opts = {}) => { const el = await fr.$(sel); if (!el) { log.push('missing ' + sel); return false; } await el.click({ timeout: 3000, ...opts }).catch(e => log.push('click fail ' + sel + ' ' + e.message.slice(0, 60))); log.push('clicked ' + sel); await sleep(500); return true; };
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  // shell, adult Me: Forget this device, remove an album photo, Cash in, Reset week
  await run(L, 'shell-adult-me', {}, async (d, log) => {
    await d.goto('#me'); await sleep(2500);
    await click(d.page, '#forget', log);
    await click(d.page, '#album-grid [data-del]', log);
    const btns = await d.page.$$('#rewards-body button:not([disabled])'); log.push('rewards buttons ' + btns.length);
    for (const b of btns.slice(0, 2)) { await b.click().catch(() => {}); await sleep(500); }
  });
  // shell, admin panel (Eli): Reset PIN, Remove/Purge guest, Unpair — dismissed; the pairing-code rotation is not touched
  await run(L, 'shell-admin', {}, async (d, log) => {
    await d.goto('#me'); await sleep(3000);
    for (const s of ['#admin-body [data-resetpin]', '#admin-body [data-remove]', '#admin-body [data-purge]', '#admin-body [data-unpair]']) await click(d.page, s, log);
  });
  // a non-admin adult (Mom): which confirms remain reachable
  await run(L, 'shell-mom-me', { profile: 'mom' }, async (d, log) => {
    await d.goto('#me'); await sleep(2500);
    log.push('admin panel present: ' + !!(await d.page.$('#admin')));
    await click(d.page, '#forget', log);
  });
  // the TV (kiosk): can it reach Forget this device?
  await run(L, 'tv-me', { profile: 'tv', device: 'tv' }, async (d, log) => {
    await d.goto('#me'); await sleep(2500);
    await click(d.page, '#forget', log);
  });
  // build guide: Progress menu → Reset
  await run(L, 'dollywood-reset', {}, async (d, log) => {
    const f = await d.openApp('dollywood'); await sleep(3500);
    await click(f, '#b-menu', log);
    await click(f, '#b-reset', log);
  });
  // park map: a long press on the map (set the family meeting point) and Clear the meeting point
  await run(L, 'dollywood-live-park', { variant: 'park' }, async (d, log) => {
    const f = await d.openApp('dollywood-live'); await sleep(4500);
    const box = await (await f.$('svg#map')).boundingBox(); const off = await (await d.page.$('#frame')).boundingBox();
    const x = box.x + box.width * 0.5, y = box.y + box.height * 0.45;
    log.push('map box ' + JSON.stringify([Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)]) + ' frame ' + JSON.stringify([Math.round(off.x), Math.round(off.y)]));
    await d.page.mouse.move(x, y); await d.page.mouse.down(); await sleep(900); await d.page.mouse.up(); await sleep(600);
    log.push('meet-done visible: ' + await f.$eval('#meet-done', e => !!(e.offsetParent || e.getClientRects().length)).catch(() => 'missing'));
    await click(f, '#meet-done', log, { force: true });
  });
} finally { await L.close(); }
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('wrote', path.relative(ROOT, OUT));
