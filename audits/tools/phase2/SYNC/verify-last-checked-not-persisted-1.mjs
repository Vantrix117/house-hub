// Skeptic #1 for SYNC finding "last-checked-not-persisted": after the PWA is reopened offline, does Me → Sync say
// "Last checked: not yet" although this device pulled successfully moments earlier?
//   node "audits/tools/phase2/SYNC/verify-last-checked-not-persisted-1.mjs"            (WebKit, default)
//   node "audits/tools/phase2/SYNC/verify-last-checked-not-persisted-1.mjs" chromium   (engine check)
// Steps: fresh local instance → phone (Eli) opens Me online, waits for a successful pull, re-renders Me (via #home → #me,
// so the card is fresh) and reads the card → records the per-channel `since` stamps hub.js persisted in localStorage →
// goes offline → reloads (the PWA reopening) → waits → re-renders Me → reads the card and hub.sync again.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, shot, EVID } from './_util.mjs';

const engine = process.argv[2] === 'chromium' ? 'chromium' : 'webkit';
const out = { engine };
const L = await local({ variant: 'typical', clock: 'real', engine });
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const card = () => phone.page.evaluate(() => {
    const c = [...document.querySelectorAll('#view-me .card')].find(c => c.querySelector('h2') && /^Sync/.test(c.querySelector('h2').textContent));
    return c ? [...c.querySelectorAll('.kv')].slice(0, 3).map(k => k.textContent.replace(/\s+/g, ' ').trim()).join(' | ') : null;
  });
  const sinceStamps = () => phone.page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('hub.cache.'))
    .map(k => { try { const s = JSON.parse(localStorage.getItem(k)).since || 0; return [k, s ? new Date(s).toISOString() : 0]; } catch { return [k, 'unreadable']; } })));
  const showCard = () => phone.page.evaluate(() => { const c = [...document.querySelectorAll('#view-me .card')].find(c => c.querySelector('h2') && /^Sync/.test(c.querySelector('h2').textContent)); if (c) c.scrollIntoView({ block: 'center' }); });
  const rerenderMe = async () => { await phone.page.evaluate(() => { location.hash = '#home'; }); await sleep(400); await phone.page.evaluate(() => { location.hash = '#me'; }); await sleep(800); };

  // A. online: a successful pull, then a freshly rendered Me
  await phone.goto('#me');
  const okPull = await waitFor(() => phone.page.evaluate(() => hub.sync.lastPull > 0 && hub.sync.lastPull), { timeout: 15000 });
  await sleep(1200); await rerenderMe();
  out.online = { lastPull: okPull ? new Date(okPull).toISOString() : null, sync: (await phone.hub()).sync, card: await card(), persistedSince: await sinceStamps() };
  await showCard(); await sleep(300);
  out.shotOnline = await shot(phone.page, `verify-last-checked-1-online-${engine}.png`);
  log(`A online after a successful pull: hub.sync.lastPull=${out.online.lastPull}; card: ${out.online.card}`);
  log(`A persisted since stamps: ${JSON.stringify(out.online.persistedSince)}`);

  // B. offline, the app reopens (reload), then Me
  await phone.setOffline(true);
  await phone.page.reload({ waitUntil: 'load' }); await phone.setOffline(true);
  await sleep(4000); await rerenderMe();
  out.offlineReopen = { sync: (await phone.hub()).sync, card: await card(), persistedSince: await sinceStamps(),
    navigatorOnLine: await phone.page.evaluate(() => navigator.onLine) };
  await showCard(); await sleep(300);
  out.shotOffline = await shot(phone.page, `verify-last-checked-1-offline-reopen-${engine}.png`);
  log(`B offline reopen: navigator.onLine=${out.offlineReopen.navigatorOnLine}; hub.sync=${JSON.stringify(out.offlineReopen.sync)}`);
  log(`B card: ${out.offlineReopen.card}`);
  log(`B persisted since stamps still on the device: ${JSON.stringify(out.offlineReopen.persistedSince)}`);

  // C. back online: does the card recover after the next pull?
  await phone.setOffline(false);
  await waitFor(() => phone.page.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 });
  await rerenderMe();
  out.backOnline = { sync: (await phone.hub()).sync, card: await card() };
  log(`C back online: card: ${out.backOnline.card}`);

  const f = path.join(EVID, `verify-last-checked-not-persisted-1-${engine}.json`);
  fs.writeFileSync(f, JSON.stringify(out, null, 1));
  log('evidence', path.relative(path.resolve(EVID, '..', '..', '..', '..'), f));
} finally { await L.close(); }
