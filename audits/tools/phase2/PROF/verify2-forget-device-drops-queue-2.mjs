// PROF (audit Phase 2), skeptic #2 for candidate "forget-device-drops-queue": does Me → "Forget this device" throw away
// writes that are still queued (offline / not yet flushed), and can every profile (kids included) reach the button?
// Local rig only (WebKit, real clock). The pairing code is a throwaway rig code set with /__rig/pairing-code.
//
//   node "audits/tools/phase2/PROF/verify2-forget-device-drops-queue-2.mjs"
//
//   A  control: Eli offline makes a family + a person write, comes back online WITHOUT forgetting → both rows reach the server.
//   B  defect:  same writes offline, Me shows "Waiting to send", tap Forget (accept) → hub.queue.* gone; back online,
//               re-pair through the UI, Eli signs in again (fresh PIN via the admin reset) → neither row ever reaches the server.
//   C  online:  how long a write stays queued when the API is reachable (the window in which Forget could drop it online).
//   D  who sees the button: Ezra (kid) and the kiosk profile.
//
// Evidence: audits/evidence/p2/PROF/verify2-forget-device-drops-queue-2*.{png,json}
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const NAME = 'verify2-forget-device-drops-queue-2';
const shot = async (d, tag) => { const f = path.join(OUT, `${NAME}-${tag}.png`); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f).replace(/\\/g, '/'); };
const log = (k, v) => console.log(k.padEnd(60), typeof v === 'string' ? v : JSON.stringify(v));
const R = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const CODE = 'rig-throwaway-5519';
const shellReady = (page, pid) => page.waitForFunction(p => !document.getElementById('shell').hidden && window.hub && hub.profile && hub.profile.id === p, pid, { timeout: 20000 });
const queued = page => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('hub.queue.') && localStorage.getItem(k) !== '{}').map(k => [k, JSON.parse(localStorage.getItem(k))])));
const serverRow = async (who, app, scope, key, tokens) => {
  const p = `/api/data/${app}?scope=${scope}&key=${encodeURIComponent(key)}`;
  const r = tokens ? await L.apiAs(null, p, { deviceToken: tokens.device, profileToken: tokens.session }) : await L.apiAs(who, p);
  return { status: r.status, value: r.body && r.body.item ? r.body.item.value : null };
};
const writeBoth = (page, tag) => page.evaluate(t => {
  hub.set('verify2.' + t, { note: 'family write made offline', t: Date.now() }, { app: 'leftovers', scope: 'family' });
  hub.set('verify2.' + t, { note: 'person write made offline', t: Date.now() }, { app: 'hub', scope: 'person' });
  return { ...hub.sync };
}, tag);

try {
  await L.setPairingCode(CODE);

  // ── A: control — the rig's offline queue does deliver when nobody forgets the device ──
  {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await d.goto(''); await shellReady(d.page, 'eli');
    await d.setOffline(true);
    const s = await writeBoth(d.page, 'control'); await sleep(1500);
    const q = await queued(d.page);
    await d.setOffline(false); await sleep(1500); await d.page.evaluate(() => hub.flush());
    R.A = { syncAfterWrite: s.state, queuedWhileOffline: Object.keys(q), queueAfterOnline: Object.keys(await queued(d.page)),
      serverFamily: await serverRow('mom', 'leftovers', 'family', 'verify2.control'), serverPerson: await serverRow('eli', 'hub', 'person', 'verify2.control') };
    log('A control: queued offline', R.A.queuedWhileOffline);
    log('A control: after online, server family / person', [R.A.serverFamily, R.A.serverPerson]);
    await d.close();
  }

  // ── B: forget with writes queued ──
  {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false }); const { page } = d;
    await d.goto(''); await shellReady(page, 'eli');
    await d.setOffline(true);
    const s = await writeBoth(page, 'forget'); await sleep(1500);
    const before = await queued(page);
    await page.click('.tab[data-tab="me"]'); await page.waitForSelector('#forget');
    const syncCard = await page.evaluate(() => { const b = document.getElementById('forget').closest('.card'); return b.innerText.replace(/\s+/g, ' ').trim(); });
    await page.locator('#forget').scrollIntoViewIfNeeded();
    const s1 = await shot(d, '1-me-before-forget');
    let dialog = null; page.once('dialog', dl => { dialog = dl.message(); dl.accept(); });
    await page.click('#forget'); await page.waitForSelector('#pairform', { timeout: 15000 });
    const afterKeys = await page.evaluate(() => Object.keys(localStorage).sort());
    const afterQueue = await queued(page);
    const s2 = await shot(d, '2-pairing-after-forget');
    await d.setOffline(false);
    await sleep(6000);   // longer than hub.js's 5 s offline retry: anything still alive would have flushed by now
    const midFamily = await serverRow('mom', 'leftovers', 'family', 'verify2.forget');
    const midPerson = await serverRow('dad', 'hub', 'person', 'verify2.forget');   // dad cannot read Eli's person scope — read Eli's below
    // Re-pair through the UI and sign Eli in again. His rig PIN is random, so the admin reset clears it and he creates a new one.
    const reset = await L.apiAs('eli', '/api/admin/profiles/eli/reset-pin', { method: 'POST' });
    // Rig artefact: Forget also removed hub.api (the rig's API override), so hub.js now points at DEFAULT_API (production,
    // which the rig blocks). In production hub.api is unset anyway, so put the rig override back and reload — nothing else.
    await page.evaluate(api => localStorage.setItem('hub.api', JSON.stringify(api)), L.api);
    await page.reload(); await page.waitForSelector('#pairform', { timeout: 15000 });
    await page.fill('#paircode', CODE); await page.fill('#pairname', 'Kitchen iPad (re-paired)'); await page.click('#pairform button[type=submit]');
    await page.waitForSelector('#profiles .pcard[data-id="eli"]', { timeout: 15000 });
    await page.click('#profiles .pcard[data-id="eli"]'); await page.waitForSelector('#pad');
    await page.keyboard.type('2468'); await page.keyboard.press('Enter'); await sleep(300);
    await page.keyboard.type('2468'); await page.keyboard.press('Enter');
    await shellReady(page, 'eli');
    await sleep(3000); await page.evaluate(async () => { await hub.pull(); await hub.flush(); });
    const tokens = await page.evaluate(() => ({ device: hub.device.token, session: hub.session.token }));
    const endQueue = await queued(page);
    const endFamily = await serverRow(null, 'leftovers', 'family', 'verify2.forget', tokens);
    const endPerson = await serverRow(null, 'hub', 'person', 'verify2.forget', tokens);
    const endPersonControl = await serverRow(null, 'hub', 'person', 'verify2.control', tokens);   // sanity: the same read sees A's row
    const localAfter = await page.evaluate(() => ({ fam: hub.get('verify2.forget', { app: 'leftovers', scope: 'family' }) || null, person: hub.get('verify2.forget', { app: 'hub', scope: 'person' }) || null, sync: { ...hub.sync } }));
    await page.click('.tab[data-tab="me"]'); await page.waitForSelector('#forget'); await page.locator('#forget').scrollIntoViewIfNeeded();
    const s3 = await shot(d, '3-me-after-resignin');
    R.B = { syncAfterWrite: s.state, queuedBefore: before, syncCardBefore: syncCard, dialog, hubKeysAfterForget: afterKeys.filter(k => k.startsWith('hub.')), allKeysAfterForget: afterKeys, queueAfterForget: afterQueue,
      serverAfter6sOnline: { family: midFamily, personReadAsDad: midPerson.status }, resetPin: reset.status, reSignedIn: true,
      end: { queue: endQueue, serverFamily: endFamily, serverPerson: endPerson, serverPersonControlRow: endPersonControl, localAfter }, shots: [s1, s2, s3] };
    log('B queued before Forget', Object.keys(before));
    log('B Sync card before Forget', syncCard);
    log('B confirm() text', dialog);
    log('B hub.* keys after Forget', R.B.hubKeysAfterForget);
    log('B server after 6 s online (family)', midFamily);
    log('B after re-pair + Eli signs in: server family / person', [endFamily, endPerson]);
    log('B sanity: same tokens read control person row', endPersonControl);
    log('B local copy on the device after sign-in', localAfter);
    await d.close();
  }

  // ── C: online — how long does a write sit in the queue? ──
  {
    const d = await L.device({ device: 'ipad-portrait', profile: 'mom', fixedTime: false }); const { page } = d;
    await d.goto(''); await shellReady(page, 'mom');
    const t = await page.evaluate(async () => {
      hub.set('verify2.online', { t: Date.now() }, { app: 'leftovers', scope: 'family' });
      const t0 = performance.now();
      while (performance.now() - t0 < 5000) { if (!Object.keys(localStorage).some(k => k.startsWith('hub.queue.') && localStorage.getItem(k) !== '{}')) return Math.round(performance.now() - t0); await new Promise(r => setTimeout(r, 20)); }
      return 'still queued after 5 s';
    });
    R.C = { msUntilQueueEmptyOnline: t };
    log('C online: ms until the queue is empty', String(t));
    await d.close();
  }

  // ── D: who can reach Forget ──
  {
    const d = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false }); const { page } = d;
    await d.goto(''); await shellReady(page, 'ezra');
    await page.click('.tab[data-tab="me"]'); await page.waitForSelector('#forget');
    await page.locator('#forget').scrollIntoViewIfNeeded();
    R.D = { ezraForgetVisible: await page.isVisible('#forget'), ezraShot: await shot(d, '4-ezra-me') };
    await d.close();
    const k = await L.device({ device: 'tv', profile: 'tv', fixedTime: false }).catch(() => null);
    if (k) {
      await k.goto(''); await shellReady(k.page, 'tv').catch(() => {});
      R.D.kiosk = await k.page.evaluate(() => ({ profile: hub.profile && hub.profile.id, tabbarVisible: !!document.getElementById('tabbar') && getComputedStyle(document.getElementById('tabbar')).display !== 'none' && !document.getElementById('tabbar').hidden, forgetInDom: !!document.getElementById('forget') }));
      await k.close();
    }
    log('D Ezra (kid) sees Forget this device', String(R.D.ezraForgetVisible));
    log('D kiosk', R.D.kiosk || 'no tv device/profile');
  }
} catch (e) { R.error = String(e && e.stack || e); console.error(e); }
finally {
  fs.writeFileSync(path.join(OUT, `${NAME}.json`), JSON.stringify(R, null, 2));
  await L.close();
}
