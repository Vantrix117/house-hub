// PROF skeptic #1 (audit Phase 2): does "Forget this device" throw away writes still waiting in hub.js's queue?
// Candidate: forget-device-drops-queue. Local rig only (production is blocked by the harness); throwaway pairing code.
//
//   node "audits/tools/phase2/PROF/verify2-forget-device-drops-queue-1.mjs"
//
// Steps (WebKit, rig iPad, real clock):
//   A. control — Eli offline: one family + one person write, back online, no Forget → both reach the server?
//   B. Eli offline: one family + one person write (+ an activity line) → queued in hub.queue.* → Me → Forget (accept)
//      → online → re-pair through the UI with the code → tap Ezra (kid) → Me still offers Forget to the kid?
//      → put Eli's rig session back (as if he signed in with his PIN) → wait for flush/pull → server rows.
// Evidence: audits/evidence/p2/PROF/verify2-forget-drops-queue-*.png + .json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const shot = async (d, name) => { const f = path.join(OUT, name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f).replace(/\\/g, '/'); };
const R = {};
const log = (k, v) => { R[k] = v; console.log(k.padEnd(58), typeof v === 'string' ? v : JSON.stringify(v)); };
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const CODE = 'rig-verify-forget-5518';
const serverHas = async (app, scope, key) => {
  const r = await L.apiAs('eli', `/api/data/${app}?scope=${scope}`);
  const it = (r.body.items || []).find(i => i.key === key);
  return it ? { value: it.value, updated_at: it.updated_at } : null;
};
const queued = page => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('hub.queue.') && localStorage.getItem(k) !== '{}').map(k => [k, Object.keys(JSON.parse(localStorage.getItem(k)))])));
const signedIn = (page, id) => page.waitForFunction(i => !document.getElementById('shell').hidden && window.hub && hub.profile && hub.profile.id === i, id, { timeout: 15000 });

try {
  await L.setPairingCode(CODE);
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const { page } = d;
  await d.goto(''); await signedIn(page, 'eli');

  // ── A. control: the queue normally survives offline and flushes when the network comes back ──
  await d.setOffline(true);
  await page.evaluate(() => { hub.set('item:verify-ctrl-fam', { name: 'control family write', at: Date.now() }, { app: 'leftovers', scope: 'family' }); hub.set('verify.ctrl.person', { note: 'control person write' }, { app: 'f260', scope: 'person' }); });
  log('A control: queued while offline', await queued(page));
  await d.setOffline(false);
  await page.waitForFunction(() => hub.sync.pending === 0, null, { timeout: 15000 }).catch(() => {});
  await sleep(1000);
  log('A control: server family row after reconnect', await serverHas('leftovers', 'family', 'item:verify-ctrl-fam'));
  log('A control: server person row after reconnect', await serverHas('f260', 'person', 'verify.ctrl.person'));

  // ── B. the same writes, then Forget this device before the network comes back ──
  await d.setOffline(true);
  await page.evaluate(() => {
    hub.set('item:verify-forget-fam', { name: 'Chili (offline, then Forget)', at: Date.now() }, { app: 'leftovers', scope: 'family' });
    hub.set('verify.forget.person', { note: 'offline person write, then Forget' }, { app: 'f260', scope: 'person' });
    hub.activity('Offline activity line before Forget');
  });
  log('B: queued before Forget (hub.queue.* keys → item keys)', await queued(page));
  log('B: activityQueue before Forget', await page.evaluate(() => JSON.parse(localStorage.getItem('hub.activityQueue') || '[]').map(a => a.text)));
  log('B: hub.sync before Forget', await page.evaluate(() => ({ ...hub.sync })));
  await page.click('.tab[data-tab="me"]'); await page.waitForSelector('#forget');
  await page.evaluate(() => document.getElementById('forget').scrollIntoView({ block: 'center' }));
  log('B: Me → Sync card text (Eli)', await page.evaluate(() => document.getElementById('forget').closest('.card').innerText.replace(/\s+/g, ' ').trim()));
  log('B: shot Eli Me sync card before Forget', await shot(d, 'verify2-forget-drops-queue-1-eli-me-before.png'));
  let dialog = null; page.once('dialog', dl => { dialog = dl.message(); dl.accept(); });
  await page.click('#forget');
  await page.waitForSelector('#pairform', { timeout: 20000 });
  log('B: confirm() text', dialog);
  log('B: hub.* keys left after Forget + reload', await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.'))));
  log('B: queue keys left after Forget', await queued(page));
  log('B: shot pairing screen after Forget', await shot(d, 'verify2-forget-drops-queue-2-pairing.png'));

  // back online. Rig artefact: Forget also removed hub.api (the rig's local API override), so the page now points at
  // the blocked production URL. Put the local API back before pairing — in production the default IS the right API.
  await d.setOffline(false);
  await page.evaluate(api => localStorage.setItem('hub.api', JSON.stringify(api)), L.api);
  await d.goto(''); await page.waitForSelector('#pairform', { timeout: 15000 });
  await page.fill('#paircode', CODE); await page.fill('#pairname', 'Kitchen iPad (re-paired)');
  await page.click('#pairform button[type=submit]');
  await page.waitForSelector('#profiles .pcard[data-id]', { timeout: 15000 });
  log('B: re-paired through the UI → picker', await page.evaluate(() => [...document.querySelectorAll('#profiles .pcard[data-id]')].map(e => e.dataset.id)));

  // a kid on the re-paired device: is Forget offered to her/him too?
  await page.click('#profiles .pcard[data-id="ezra"]'); await signedIn(page, 'ezra');
  await page.click('.tab[data-tab="me"]'); await page.waitForSelector('#forget');
  await page.evaluate(() => document.getElementById('forget').scrollIntoView({ block: 'center' }));
  log('B: Me as Ezra (kid): Forget visible / enabled', { visible: await page.isVisible('#forget'), enabled: await page.isEnabled('#forget') });
  log('B: shot Ezra Me with Forget', await shot(d, 'verify2-forget-drops-queue-3-ezra-me.png'));
  await sleep(3000);

  // Eli signs back in on this device (PIN unknown to the rig: put his rig device + session back, as a PIN sign-in would)
  await page.evaluate(({ dev, sess }) => { localStorage.setItem('hub.device', JSON.stringify(dev)); localStorage.setItem('hub.session', JSON.stringify(sess)); localStorage.setItem('hub.lastProfile', JSON.stringify('eli')); }, { dev: L.S.info.device, sess: L.S.sessions.eli });
  await d.goto(''); await signedIn(page, 'eli');
  await page.evaluate(() => hub.pull()); await page.evaluate(() => hub.flush()); await sleep(6000);
  log('B: Eli back, online: hub.sync', await page.evaluate(() => ({ ...hub.sync })));
  log('B: Eli back, online: queue keys on the device', await queued(page));
  log('B: server family row item:verify-forget-fam', await serverHas('leftovers', 'family', 'item:verify-forget-fam'));
  log('B: server person row f260 verify.forget.person', await serverHas('f260', 'person', 'verify.forget.person'));
  const feed = await L.apiAs('eli', '/api/activity?limit=50');
  log('B: server feed has the offline activity line?', JSON.stringify(feed.body).includes('Offline activity line before Forget'));
  log('B: server feed has the offline activity line? (status)', feed.status);
  log('B: device-side hub.get of the family write after re-sign-in', await page.evaluate(() => hub.get('item:verify-forget-fam', { app: 'leftovers', scope: 'family' }) ?? null));
  log('logs (errors)', d.logs.filter(l => /error/i.test(l)).slice(0, 10));
} finally {
  fs.writeFileSync(path.join(OUT, 'verify2-forget-drops-queue.json'), JSON.stringify(R, null, 2));
  await L.close();
}
