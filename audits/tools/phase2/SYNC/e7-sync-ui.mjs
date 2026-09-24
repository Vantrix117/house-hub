// SYNC e7 — what the household is told about sync. The only indicators are the tab bar's #syncdot (index.html:769) and the
// Me → Sync card (index.html:1273-1277).
//   node "audits/tools/phase2/SYNC/e7-sync-ui.mjs"
// 1. Me opened directly (#me). Pick a theme (a person-scope write): what does the Sync card say at once, and 5 s later?
// 2. Reopen the PWA offline: what does the Sync card say about the last check? (lastPull is memory-only: apps/hub.js:51, 311)
// 3. F260 open, offline, a tick waiting to send: is any sync indicator on screen? Is the tab-bar dot reachable at all?
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, shot, writeEvidence } from './_util.mjs';

const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const card = () => phone.page.evaluate(() => { const c = [...document.querySelectorAll('#view-me .card')].find(c => /^Sync/.test(c.querySelector('h2') && c.querySelector('h2').textContent)); return c ? [...c.querySelectorAll('.kv')].map(k => k.textContent.replace(/\s+/g, ' ').trim()).slice(0, 3).join(' | ') : null; });
  // 1
  await phone.goto('#me');
  await waitFor(() => phone.page.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(1500);
  out.meOnOpenAfterPull = await card();
  await phone.page.click('#theme [data-theme="parchment"]');
  out.meRightAfterThemePick = await card();
  await sleep(5000);
  out.meFiveSecondsLater = await card();
  out.actualSync = (await phone.hub()).sync;
  out.shotMe = await shot(phone.page, 'e7-phone-me-sync-card-5s-after-theme.png');
  log(`1: Me opened directly, after the first pull: ${out.meOnOpenAfterPull}`);
  log(`1: right after a theme pick: ${out.meRightAfterThemePick}; 5 s later: ${out.meFiveSecondsLater}; hub.sync is actually ${JSON.stringify(out.actualSync)}`);
  // 2
  await phone.setOffline(true);
  await phone.page.reload({ waitUntil: 'load' }); await phone.setOffline(true); await sleep(2000);
  await phone.page.evaluate(() => { location.hash = '#home'; }); await sleep(300); await phone.page.evaluate(() => { location.hash = '#me'; }); await sleep(800);
  out.meAfterOfflineReopen = await card();
  out.shotOffline = await shot(phone.page, 'e7-phone-me-offline-reopen.png');
  log(`2: reopened offline minutes after a successful sync: ${out.meAfterOfflineReopen}`);
  // 3
  const f = await phone.openApp('f260', { wait: '#todayDone' }); await sleep(1500);
  await f.click('#todayDone'); await sleep(800);
  out.inApp = await phone.page.evaluate(() => { const d = document.getElementById('syncdot'); const r = d.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { dotClass: d.className, dotRect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], elementOnTopOfDot: top ? (top.id || top.tagName) + (top.closest('#viewer') ? ' (inside #viewer)' : '') : null }; });
  out.inAppPending = await f.evaluate(() => hub.sync);
  out.inAppIndicator = await f.evaluate(() => { const t = document.body.innerText; return /offline|not sent|waiting to send|sync/i.test(t) ? (t.match(/.{0,40}(offline|not sent|waiting to send|sync).{0,40}/i) || [])[0] : null; });
  out.shotApp = await shot(phone.page, 'e7-phone-f260-offline-pending.png');
  log(`3: F260 open, offline, ${out.inAppPending.pending} write(s) waiting: tab-bar dot is "${out.inApp.dotClass}" but the element on top of it is ${out.inApp.elementOnTopOfDot}; any sync wording in F260: ${JSON.stringify(out.inAppIndicator)}`);
  log('evidence', writeEvidence('e7-sync-ui.json', out));
} finally { await L.close(); }
