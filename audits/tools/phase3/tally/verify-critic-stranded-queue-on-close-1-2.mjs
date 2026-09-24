// Skeptic #2 for critic-stranded-queue-on-close-1: do Tally taps still queued when Tally is closed ever reach the server
// without reopening Tally? The shell's hub.js declares no tally channel (index.html:457-458), so its flush on
// closeViewer / 'online' / visibilitychange cannot send hub.queue.tally.person.<pid>.
//   A  offline: +3, viewer Hub button, online, 35 s, then a visibilitychange cycle on the shell -> server? shell sync?
//      then the phone reopens Tally (no other device)                                      -> delayed only? (start+3)
//   B  offline: +3, Hub button, online, 5 s; the Kitchen iPad (Eli) opens Tally, +1; phone reopens Tally  (expect start+4)
//   C  online, each tally batch POST delayed 1.5 s: +3 taps, Hub 0.4 s later, wait 12 s     (expect start+3)
// Run: node "audits/tools/phase3/tally/verify-critic-stranded-queue-on-close-1-2.mjs"
//   -> audits/evidence/p3/tally/verify-critic-stranded-queue-on-close-1-2.json (+ one PNG of the shell's Sync card)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally';
const NAME = 'verify-critic-stranded-queue-on-close-1-2';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = {};
const server = async () => { const r = await L.apiAs('eli', '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? it.value : null; };
const shown = f => f.evaluate(() => document.getElementById('n').textContent.trim());
const ready = f => f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 9000 });
const tap = async (f, n, gap = 0) => { for (let i = 0; i < n; i++) { await f.locator('#plus').click(); if (gap) await sleep(gap); } };
const q = p => p.evaluate(() => localStorage.getItem('hub.queue.tally.person.eli'));
const sync = p => p.evaluate(() => ({ state: hub.sync.state, pending: hub.sync.pending }));
async function reopen(phone) {
  await phone.page.click('.tab[data-tab=apps]'); await sleep(300);
  await phone.page.click('.tile[data-id=tally]'); await sleep(300);
  const f = phone.frame('tally'); await ready(f); return f;
}
try {
  // ── A ──
  {
    const dev = await L.newDevice({ name: 'Eli phone A', profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: dev });
    let f = await phone.openApp('tally'); await ready(f); await sleep(1000);
    const start = await server();
    await phone.setOffline(true); await tap(f, 3); await sleep(400);
    const offlineShown = await shown(f);
    await phone.page.click('#pill-home'); await sleep(600);
    await phone.setOffline(false); await sleep(35000);
    const after35 = await server();
    const shellSync = await sync(phone.page); const queued = await q(phone.page);
    // app switcher round trip: hidden -> visible fires the shell's visibilitychange flush
    await phone.page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(300);
    await phone.page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(3000);
    const afterVisibility = await server();
    await phone.page.click('.tab[data-tab=me]'); await sleep(800);
    const syncCard = await phone.page.evaluate(() => { const el = [...document.querySelectorAll('#view-me .card, #view-me section')].find(e => /Sync|Waiting|synced/i.test(e.textContent)); return el ? el.textContent.replace(/\s+/g, ' ').trim().slice(0, 200) : null; });
    await phone.page.screenshot({ path: `${OUT}/${NAME}-A-me-sync.png`, scale: 'css' });
    f = await reopen(phone); await sleep(4000);
    res.A = { start, offlineShown, after35sOnline: after35, shellSync, queuedAfter35s: queued, afterVisibilityCycle: afterVisibility, meSyncCard: syncCard,
      afterReopen: await server(), queueAfterReopen: await q(phone.page), expected: start + 3 };
    console.log('A', JSON.stringify(res.A));
    await phone.close(); await L.reset('typical');
  }
  // ── B ──
  {
    const dev = await L.newDevice({ name: 'Eli phone B', profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: dev });
    let f = await phone.openApp('tally'); await ready(f); await sleep(1000);
    const start = await server();
    await phone.setOffline(true); await tap(f, 3); await sleep(400);
    await phone.page.click('#pill-home'); await sleep(600);
    await phone.setOffline(false); await sleep(5000);
    const afterOnline = await server();
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const fi = await ipad.openApp('tally'); await ready(fi); await sleep(1500);
    const ipadShows = await shown(fi);
    await tap(fi, 1); await sleep(2000);
    const afterIpad = await server();
    f = await reopen(phone); await sleep(4000);
    res.B = { start, afterOnline5s: afterOnline, ipadShowsAtOpen: ipadShows, afterIpad, serverEnd: await server(), phoneShowsEnd: await shown(f), queueEnd: await q(phone.page), expected: start + 4 };
    console.log('B', JSON.stringify(res.B));
    await ipad.close(); await phone.close(); await L.reset('typical');
  }
  // ── C ──
  {
    const dev = await L.newDevice({ name: 'Eli phone C', profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: dev });
    const f = await phone.openApp('tally'); await ready(f); await sleep(1000);
    const start = await server();
    const posts = [];
    await phone.ctx.route(/\/api\/data\/tally\/batch/, async route => { posts.push(JSON.parse(route.request().postData() || '{}').items?.map(i => i.value)); await sleep(1500); try { await route.continue(); } catch (e) { posts.push('continue failed: ' + e.message.slice(0, 80)); } });
    await tap(f, 3, 120); await sleep(400);
    await phone.page.click('#pill-home');
    await sleep(12000);
    res.C = { start, batchValuesSent: posts, server12s: await server(), shellSync: await sync(phone.page), queued: await q(phone.page), expected: start + 3 };
    console.log('C', JSON.stringify(res.C));
    await phone.close();
  }
} finally {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/${NAME}.json`, JSON.stringify(res, null, 2));
  await L.close();
}
