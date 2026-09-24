// Skeptic #2 for SYNC finding "kiosk-drops-family-queue".
//   node "audits/tools/phase2/SYNC/verify-kiosk-drops-family-queue-2.mjs"
// Independent re-run on a fresh local instance (real clock, WebKit):
//   A. Kitchen iPad as Eli (its own paired device record), Wi-Fi down, add a reminder from Home (#remtext), Me -> Switch,
//      Wi-Fi back while the picker shows, tap "Downstairs TV". Record: the batch response, server copy, queue, sync state,
//      and whether the iPad itself still shows the reminder (local family cache) on the TV board.
//      Then wait > 30 s (one poll + flush cycle) and re-check; then Eli signs back in on the iPad (session injected, since
//      the demo PINs are random) and we check whether the reminder is ever sent.
//   B. Control: identical flow, next sign-in Ezra (a kid, a writer).
//   C. Control: identical flow, but Wi-Fi comes back BEFORE Switch (queue flushes under Eli) then TV: nothing lost.
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
fs.mkdirSync(EVID, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's', ...a);
async function waitFor(fn, { timeout = 10000, every = 250 } = {}) {
  const until = Date.now() + timeout;
  while (Date.now() < until) { try { const v = await fn(); if (v) return v; } catch {} await sleep(every); }
  return null;
}
const QK = 'hub.queue.reminders.family', CK = 'hub.cache.reminders.family';

const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const reader = await L.newDevice({ name: 'Skeptic reader', profiles: ['dad'] });
  const serverHas = async text => {
    const r = await L.apiAs(null, '/api/data/reminders?scope=family', { deviceToken: reader.device.token, profileToken: reader.sessions.dad });
    return r.body.items.some(i => i.value && i.value.text === text);
  };

  for (const scenario of ['A-tv', 'B-ezra', 'C-online-first-then-tv']) {
    const next = scenario === 'B-ezra' ? 'ezra' : 'tv';
    const o = out[scenario] = {};
    const rec = await L.newDevice({ name: 'Kitchen iPad ' + scenario, profiles: ['eli'] });
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false, as: rec });
    const batches = [];
    ipad.page.on('response', async r => {
      if (/\/api\/data\/reminders\/batch/.test(r.url())) {
        const req = r.request();
        batches.push({ status: r.status(), profileToken: (req.headers()['x-profile-token'] || '').slice(0, 20), body: (await r.text().catch(() => '')).slice(0, 90) });
      }
    });
    await ipad.goto('#home');
    await waitFor(() => ipad.page.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 });
    await ipad.setOffline(true);
    const text = `Skeptic2 ${scenario} reminder ${Date.now()}`;
    await ipad.page.fill('#remtext', text); await ipad.page.press('#remtext', 'Enter');
    await sleep(500);
    o.queuedAfterAdd = await ipad.page.evaluate(k => Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length, QK);
    if (scenario === 'C-online-first-then-tv') { await ipad.setOffline(false); await sleep(2500); o.queuedAfterOnlineAsEli = await ipad.page.evaluate(k => Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length, QK); }
    await ipad.page.evaluate(() => { location.hash = '#me'; }); await sleep(500);
    await ipad.page.click('#switch');
    await ipad.page.waitForSelector(`.pcard[data-id="${next}"]`, { timeout: 10000 });
    if (scenario !== 'C-online-first-then-tv') { await ipad.setOffline(false); await sleep(2000); }
    o.queuedOnPicker = await ipad.page.evaluate(k => Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length, QK);
    o.batchesBeforeNextSignIn = batches.length;
    await ipad.page.click(`.pcard[data-id="${next}"]`);
    await waitFor(() => ipad.page.evaluate(n => hub.profile && hub.profile.id === n && hub.sync.lastPull > 0, next), { timeout: 15000 });
    await sleep(2500);
    const state = async () => ipad.page.evaluate(({ QK, CK, text }) => {
      const q = JSON.parse(localStorage.getItem(QK) || '{}'), c = JSON.parse(localStorage.getItem(CK) || '{"items":{}}');
      const inCache = Object.values(c.items).some(it => it.v && it.v.text === text);
      const shown = [...document.querySelectorAll('#remlist .rem-text')].map(e => e.textContent).includes(text);
      const card = document.querySelector('#tv-rem-card');
      return { profile: hub.profile && hub.profile.id, sync: { state: hub.sync.state, pending: hub.sync.pending, lastError: hub.sync.lastError }, queueLeft: Object.keys(q).length, inLocalCache: inCache, shownOnThisScreen: shown, tvRemCardHidden: card ? card.hidden : null };
    }, { QK, CK, text });
    o.afterNextSignIn = { ...(await state()), onServer: await serverHas(text), batches: batches.slice() };
    log(`${scenario}: queued ${o.queuedAfterAdd}${o.queuedAfterOnlineAsEli != null ? ', after Wi-Fi back as Eli ' + o.queuedAfterOnlineAsEli : ''}, on picker ${o.queuedOnPicker}, batches before next sign-in ${o.batchesBeforeNextSignIn}; next=${next} →`, JSON.stringify(o.afterNextSignIn));
    if (scenario === 'A-tv') {
      await ipad.page.screenshot({ path: path.join(EVID, 'v2-kiosk-queue-ipad-tv-board.png'), animations: 'disabled', caret: 'hide', fullPage: false, scale: 'css' });
      const card = await ipad.page.$('#tv-rem-card');
      if (card && await card.isVisible()) await card.screenshot({ path: path.join(EVID, 'v2-kiosk-queue-tv-reminders-pane.png'), animations: 'disabled', scale: 'css' });
      await sleep(33000);                                  // one 30 s poll + any flush retry
      o.after33s = { ...(await state()), onServer: await serverHas(text), batches: batches.length };
      log(`A-tv after 33 s more:`, JSON.stringify(o.after33s));
      // Eli signs back in on the iPad (PINs are random in the seed, so the offline-surviving Eli session is put back)
      await ipad.page.evaluate(s => { localStorage.setItem('hub.session', JSON.stringify(s)); }, { token: rec.sessions.eli, profile: (await L.apiAs(null, '/api/me', { deviceToken: rec.device.token, profileToken: rec.sessions.eli })).body.profile });
      await ipad.page.evaluate(() => { location.hash = '#home'; }); await ipad.page.reload({ waitUntil: 'load' });
      await waitFor(() => ipad.page.evaluate(() => hub.profile && hub.profile.id === 'eli' && hub.sync.lastPull > 0), { timeout: 15000 });
      await sleep(3000);
      o.afterEliBack = { ...(await state()), onServer: await serverHas(text), batches: batches.length };
      log(`A-tv after Eli signs back in:`, JSON.stringify(o.afterEliBack));
      await ipad.page.screenshot({ path: path.join(EVID, 'v2-kiosk-queue-ipad-eli-back.png'), animations: 'disabled', caret: 'hide', scale: 'css' });
    }
    await ipad.close();
  }
  fs.writeFileSync(path.join(EVID, 'verify-kiosk-drops-family-queue-2.json'), JSON.stringify(out, null, 2));
  log('evidence audits/evidence/p2/SYNC/verify-kiosk-drops-family-queue-2.json');
} finally { await L.close(); }
