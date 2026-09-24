// Skeptic #2 for SYNC finding "last-checked-not-persisted".
//   node "audits/tools/phase2/SYNC/verify-last-checked-not-persisted-2.mjs"
// Claim: after a cold reopen while offline, Me → Sync says "Last checked: not yet" although the device synced minutes
// earlier, because hub.sync.lastPull is memory-only (apps/hub.js:51, 311; index.html:1276).
// Independent check, avoiding the separate "Me card is stale" effect: Me is always (re)rendered by switching tabs AFTER
// the state we want to read is settled, and hub.sync is read directly next to the card text.
//   A. online: open #home, wait for a successful pull, then switch to Me → card text + hub.sync + persisted since
//   B. wait, go offline, reload (cold reopen; the SW would serve the shell on a real phone — here the site host stays up),
//      switch tabs to Me → card text + hub.sync + what localStorage still holds about the last pull
//   C. control: back online → does the next pull bring the time back?
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const EV = path.join(ROOT, 'audits/evidence/p2/SYNC');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const p = phone.page;
  const until = async (fn, ms = 15000) => { const t = Date.now() + ms; while (Date.now() < t) { if (await fn()) return true; await sleep(200); } return false; };
  const toMe = async () => { await p.evaluate(() => { location.hash = '#home'; }); await sleep(400); await p.evaluate(() => { location.hash = '#me'; }); await sleep(800); };
  const card = () => p.evaluate(() => {
    const c = [...document.querySelectorAll('#view-me .card')].find(c => c.querySelector('h2') && /^Sync/.test(c.querySelector('h2').textContent));
    return c ? [...c.querySelectorAll('.kv')].slice(0, 3).map(k => k.textContent.replace(/\s+/g, ' ').trim()).join(' | ') : null;
  });
  const persisted = () => p.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('hub.cache.'))
    .map(k => { let s = 0; try { s = JSON.parse(localStorage.getItem(k)).since || 0; } catch {} return [k, s ? new Date(s).toISOString() : 0]; })));
  // the Sync card itself, at 1x css scale (the full page is taller than the viewport and 3x on the iPhone)
  const cardShot = async file => {
    const h = await p.evaluateHandle(() => [...document.querySelectorAll('#view-me .card')].find(c => c.querySelector('h2') && /^Sync/.test(c.querySelector('h2').textContent)));
    const el = h.asElement(); await el.scrollIntoViewIfNeeded(); await sleep(300);
    await el.screenshot({ path: file, scale: 'css', animations: 'disabled' });
    return path.relative(ROOT, file).split(path.sep).join('/');
  };
  const anyTimeKey = () => p.evaluate(() => Object.keys(localStorage).filter(k => /last|pull|sync/i.test(k)));

  // A
  await phone.goto('#home');
  out.A_pulled = await until(() => p.evaluate(() => window.hub && hub.sync.lastPull > 0));
  await toMe();
  out.A_card = await card();
  out.A_sync = (await phone.hub()).sync;
  out.A_lastPullIso = out.A_sync.lastPull ? new Date(out.A_sync.lastPull).toISOString() : 0;
  out.A_persistedSince = await persisted();
  out.A_shot = await cardShot(path.join(EV, 'verify-lcnp-2-A-online-sync-card.png'));
  console.log('A online, after a pull, Me re-rendered:', out.A_card, '| hub.sync.lastPull =', out.A_lastPullIso);

  // B
  await sleep(4000);
  await phone.setOffline(true);
  await p.reload({ waitUntil: 'load' });
  await phone.setOffline(true);
  await sleep(2500);
  await toMe();
  out.B_navigatorOnLine = await p.evaluate(() => navigator.onLine);
  out.B_card = await card();
  out.B_sync = (await phone.hub()).sync;
  out.B_persistedSince = await persisted();
  out.B_keysMentioningLastPullSync = await anyTimeKey();
  out.B_readerDataStillShown = await p.evaluate(() => document.querySelector('#view-me') ? document.querySelector('#view-me').innerText.slice(0, 60).replace(/\s+/g, ' ') : null);
  out.B_shot = await cardShot(path.join(EV, 'verify-lcnp-2-B-offline-reopen-sync-card.png'));
  console.log('B offline cold reopen, Me re-rendered:', out.B_card, '| hub.sync =', JSON.stringify(out.B_sync));
  console.log('B localStorage still holds per-scope server time of the last pull (since):', JSON.stringify(out.B_persistedSince));
  console.log('B localStorage keys mentioning last/pull/sync:', JSON.stringify(out.B_keysMentioningLastPullSync));

  // C
  await phone.setOffline(false);
  out.C_pulled = await until(() => p.evaluate(() => hub.sync.lastPull > 0));
  await toMe();
  out.C_card = await card();
  console.log('C back online, after the next pull:', out.C_card);

  fs.writeFileSync(path.join(EV, 'verify-last-checked-not-persisted-2.json'), JSON.stringify(out, null, 1));
  console.log('evidence audits/evidence/p2/SYNC/verify-last-checked-not-persisted-2.json');
} finally { await L.close(); }
