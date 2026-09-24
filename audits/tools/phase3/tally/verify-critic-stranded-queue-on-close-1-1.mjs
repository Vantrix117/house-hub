// Skeptic #1 for "critic-stranded-queue-on-close-1": are Tally taps queued offline (or in flight on a slow link) stranded
// when the person leaves Tally (viewer Hub button -> closeViewer) before Tally's own hub.js flushes them?
// Independent re-run, fresh local instance (typical seed, real clock, WebKit).
//   A  phone offline -> Tally +4 -> Hub button -> online -> wait 35 s -> read server / shell hub.sync / LS queue;
//      Kitchen iPad (Eli) opens Tally, +2; phone reopens Tally from the Apps grid -> server end. Expected start+6.
//   B  same as A up to the 35 s read, but the phone reopens Tally BEFORE the iPad counts (is it only delayed?).
//   C  online, each POST /api/data/tally/batch held 1.5 s (slow uplink); +3 then Hub 0.4 s after -> server 35 s later.
// Run: node "audits/tools/phase3/tally/verify-critic-stranded-queue-on-close-1-1.mjs"
//   -> audits/evidence/p3/tally/verify-critic-stranded-queue-on-close-1-1.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally';
const NAME = 'verify-critic-stranded-queue-on-close-1-1';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = {};
const server = async () => { const r = await L.apiAs('eli', '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? it.value : null; };
const shown = f => f.evaluate(() => document.getElementById('n').textContent);
const ready = f => f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 10000 });
const tap = async (f, n) => { for (let i = 0; i < n; i++) { await f.locator('#plus').click(); await sleep(80); } };
const lsQ = p => p.evaluate(() => localStorage.getItem('hub.queue.tally.person.eli'));
const shellChannels = p => p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.queue.')));
async function reopen(phone) {
  await phone.page.click('.tab[data-tab=apps]'); await sleep(400);
  await phone.page.click('.tile[data-id=tally]');
  const until = Date.now() + 10000; let f;
  while (Date.now() < until && !(f = phone.frame('tally'))) await sleep(100);
  await ready(f); return f;
}
async function strandOffline(tag) {
  const dev = await L.newDevice({ name: 'Skeptic phone ' + tag, profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: dev });
  const f = await phone.openApp('tally'); await ready(f); await sleep(1500);
  const start = await server();
  await phone.setOffline(true);
  await tap(f, 4); await sleep(400);
  const offlineShown = await shown(f);
  const queuedWhileOffline = await lsQ(phone.page);
  await phone.page.click('#pill-home'); await sleep(800);
  const frameGone = !phone.frame('tally');
  await phone.setOffline(false);
  await sleep(35000);
  return { phone, r: { start, offlineShown, queuedWhileOffline, frameGoneAfterHub: frameGone,
    server35sAfterOnline: await server(), shellSync: await phone.page.evaluate(() => ({ state: hub.sync.state, pending: hub.sync.pending })),
    queueLeft: await lsQ(phone.page), queueKeysInLS: await shellChannels(phone.page) } };
}
try {
  // A: loss
  {
    const { phone, r } = await strandOffline('A');
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const fi = await ipad.openApp('tally'); await ready(fi); await sleep(1500);
    r.ipadShowsAtOpen = await shown(fi);
    await tap(fi, 2); await sleep(2500);
    r.serverAfterIpad = await server();
    const fp = await reopen(phone); await sleep(5000);
    r.serverEnd = await server(); r.phoneShowsEnd = await shown(fp); r.ipadShowsEnd = await shown(fi);
    r.queueAfterReopen = await lsQ(phone.page); r.expected = r.start + 6;
    res.A = r; console.log('A', JSON.stringify(r));
    await ipad.close(); await phone.close(); await L.reset('typical');
  }
  // B: reopened on the same device before anyone else counts
  {
    const { phone, r } = await strandOffline('B');
    const fp = await reopen(phone); await sleep(5000);
    r.serverAfterReopen = await server(); r.phoneShows = await shown(fp); r.expected = r.start + 4;
    res.B = r; console.log('B', JSON.stringify(r));
    await phone.close(); await L.reset('typical');
  }
  // C: slow uplink, online
  {
    const dev = await L.newDevice({ name: 'Skeptic phone C', profiles: ['eli'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: dev });
    const f = await d.openApp('tally'); await ready(f); await sleep(1500);
    const log = [];
    await d.ctx.route(u => u.href.includes('/api/data/tally/batch'), async rt => {
      const body = rt.request().postData(); log.push({ t: Date.now(), body: body && body.slice(0, 120) });
      await sleep(1500); try { await rt.continue(); log.push({ t: Date.now(), continued: true }); } catch (e) { log.push({ t: Date.now(), err: String(e.message).slice(0, 80) }); }
    });
    const start = await server();
    await tap(f, 3); const shownBefore = await shown(f);
    await sleep(400); await d.page.click('#pill-home');
    await sleep(35000);
    res.C = { start, shownBefore, postsSeen: log, server35sAfterClose: await server(), expected: start + 3,
      shellSync: await d.page.evaluate(() => ({ state: hub.sync.state, pending: hub.sync.pending })), queueLeft: await lsQ(d.page) };
    console.log('C', JSON.stringify(res.C));
    await d.close();
  }
} finally {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/${NAME}.json`, JSON.stringify(res, null, 2));
  await L.close();
}
