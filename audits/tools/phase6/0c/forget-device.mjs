// Phase 6, batch 0c — "Forget this device" (P2-PROF-19, P2-PROF-13). The Phase 2 script
// (phase2/PROF/verify2-forget-device-drops-queue-2.mjs) writes with hub.set the moment the shell shows, which batch 0b
// now refuses until the data has loaded, so it stops before reaching the button. This check waits for the load, then:
//
//   A  Eli writes a family row and a person row offline and taps Forget: the device must refuse ("not yet saved"),
//      keep both queued writes and stay paired.
//   B  back online, Forget again: both rows reach the server first; then the device, its sessions and its push
//      subscription are gone on the server (the old tokens get 401 device_not_paired) and the pairing form shows.
//   C  who sees the button: Ezra (kid), the display, a guest — none; Mom (adult) — yes.
//
//   node "audits/tools/phase6/0c/forget-device.mjs"      exit 0 = every expectation held
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p6/0c'); fs.mkdirSync(OUT, { recursive: true });
const NAME = 'forget-device';
const R = { checks: [] };
const check = (name, ok, got) => { R.checks.push({ name, ok: !!ok, got }); console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(70), JSON.stringify(got)); };
const shot = async (d, tag) => { const f = path.join(OUT, `${NAME}-${tag}.png`); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f).replace(/\\/g, '/'); };
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const shellReady = (page, pid) => page.waitForFunction(p => !document.getElementById('shell').hidden && window.hub && hub.profile && hub.profile.id === p, pid, { timeout: 20000 });
const loaded = page => page.waitForFunction(() => hub.isLoaded('leftovers', 'family') && hub.isLoaded('hub', 'person'), null, { timeout: 20000 });
const queued = page => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.queue.')).map(k => [k, Object.keys(JSON.parse(localStorage.getItem(k)))]));
const toastText = page => page.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; });

try {
  // its own paired device: forgetting the rig's shared Kitchen iPad would sign every later device out
  const nd = await L.newDevice({ name: 'Forget-check iPad', profiles: ['eli'] });
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false, as: nd }); const { page } = d;
  await d.goto(''); await shellReady(page, 'eli'); await loaded(page);
  const tokens = await page.evaluate(() => ({ device: hub.device.token, session: hub.session.token, deviceId: hub.device.id }));
  // a push subscription row for this device, as the Me switch would make (the rig's WebKit cannot subscribe for real)
  const sub = await L.apiAs(null, '/api/push/subscribe', { method: 'POST', body: { subscription: { endpoint: 'http://127.0.0.1:9/push/forget-check', keys: { p256dh: 'x', auth: 'y' } } }, deviceToken: tokens.device, profileToken: tokens.session });
  check('setup: push subscription for this device', sub.status === 200, sub.status);

  // ── A: offline, two writes, Forget refuses ──
  await d.setOffline(true);
  await page.evaluate(() => { hub.set('forget0c', { note: 'family write made offline' }, { app: 'leftovers', scope: 'family' }); hub.set('forget0c', { note: 'person write made offline' }, { app: 'hub', scope: 'person' }); });
  await page.click('.tab[data-tab="me"]'); await page.waitForSelector('#forget');
  // since batch 1 the question is the hub's own sheet (hub.confirm), answered by its confirm button (the last one)
  const answerSheet = async () => { const b = page.locator('.hub-ask .sheet-actions .btn:last-child'); await b.waitFor({ timeout: 10000 }); const m = await page.locator('.hub-ask .sheet').innerText(); await b.click(); return m; };
  await page.locator('#forget').scrollIntoViewIfNeeded(); await page.click('#forget');
  const dialog = await answerSheet();
  await page.waitForFunction(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden && /Not forgotten/.test(t.textContent); }, null, { timeout: 15000 });
  const refusal = await toastText(page);
  R.shots = [await shot(d, 'A-offline-refused')];
  const qA = await queued(page);
  check('A offline Forget: refused with a "not yet saved" message', /Not forgotten: 2 changes not yet saved/.test(refusal || ''), refusal);
  check('A offline Forget: both queued writes still on the device', JSON.stringify(qA).includes('forget0c') && qA.length === 2, qA);
  check('A offline Forget: still paired and signed in', await page.evaluate(() => !!hub.device && !!hub.session && document.getElementById('pairform') === null), true);

  // ── B: online, Forget again ──
  await d.setOffline(false); await sleep(500);
  await page.click('#forget'); await answerSheet();
  await page.waitForSelector('#pairform', { timeout: 20000 });
  R.shots.push(await shot(d, 'B-online-forgotten'));
  const fam = await L.apiAs('mom', '/api/data/leftovers?scope=family&key=forget0c');
  check('B the family write reached the server before forgetting', fam.body && fam.body.item && fam.body.item.value && fam.body.item.value.note === 'family write made offline', fam.body && fam.body.item);
  const eliCheck = await L.apiAs('eli', '/api/data/hub?scope=person&key=forget0c');
  check('B the person write reached the server before forgetting', eliCheck.body && eliCheck.body.item && eliCheck.body.item.value && eliCheck.body.item.value.note === 'person write made offline', eliCheck.body && eliCheck.body.item);
  const old = await L.apiAs(null, '/api/profiles', { deviceToken: tokens.device });
  check('B the forgotten device token is refused (device deleted)', old.status === 401 && old.body.error === 'device_not_paired', `${old.status} ${old.body && old.body.error}`);
  const oldSession = await L.apiAs(null, '/api/data/hub?scope=person', { deviceToken: tokens.device, profileToken: tokens.session });
  check('B the forgotten session is refused', oldSession.status === 401, oldSession.status);
  const usage = await L.apiAs('eli', '/api/admin/usage');
  const devices = (usage.body && usage.body.devices || []).map(x => x.id);
  check('B the admin device list no longer has it', !devices.includes(tokens.deviceId), devices.length);
  const subs = (usage.body && usage.body.push_subscriptions || []).find(x => x.profile_id === 'eli');
  check('B Eli has no push subscription left (it was on this device only)', !subs || subs.n === 0, subs || null);
  // what the reloaded pairing screen holds: hub.api is the rig's own override, hub.registry the app list the boot fetches again
  const leftKeys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.') && k !== 'hub.api' && k !== 'hub.registry'));
  check('B local hub.* storage cleared (no device, session, queue or cache)', leftKeys.length === 0, leftKeys);
  R.dialog = dialog;
  await d.close();

  // ── C: who sees the button ──
  const who = {};
  for (const [pid, device] of [['ezra', 'ipad-portrait'], ['mom', 'iphone-pwa'], ['tv', 'tv']]) {
    const k = await L.device({ device, profile: pid, fixedTime: false });
    await k.goto(''); await shellReady(k.page, pid);
    if (pid !== 'tv') { await k.page.click('.tab[data-tab="me"]'); await k.page.waitForSelector('#switch'); }
    who[pid] = await k.page.evaluate(() => !!document.getElementById('forget'));
    await k.close();
  }
  check('C Ezra (kid) has no Forget button', who.ezra === false, who.ezra);
  check('C the display has no Forget button', who.tv === false, who.tv);
  check('C Mom (adult) has the Forget button', who.mom === true, who.mom);
} catch (e) { R.error = String(e && e.stack || e); console.error(e); check('script ran to the end', false, R.error.split('\n')[0]); }
finally {
  fs.writeFileSync(path.join(OUT, `${NAME}.json`), JSON.stringify(R, null, 2));
  await L.close();
  const failed = R.checks.filter(c => !c.ok).length;
  console.log(`\n${R.checks.length - failed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
}
