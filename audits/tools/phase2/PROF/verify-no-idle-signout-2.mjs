// PROF skeptic #2 for "no-idle-signout": does the shared Kitchen iPad ever leave an adult (the admin) session on its
// own — after 12 h untouched, after an iPadOS-style relaunch of the PWA, or when the server session ages? Local rig only.
// Demo clock so the Worker's clock can be moved together with the browser's.
//
//   node "audits/tools/phase2/PROF/verify-no-idle-signout-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, DEMO, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const log = (k, v) => console.log(k.padEnd(58), typeof v === 'string' ? v : JSON.stringify(v));
const H = 3600000, D = 86400000;
const L = await local({ variant: 'typical', clock: 'demo' });
const state = page => page.evaluate(() => ({
  now: new Date().toISOString(),
  profile: window.hub && hub.profile && hub.profile.id,
  isAdmin: !!(window.hub && hub.profile && hub.profile.isAdmin),
  gateShown: !document.getElementById('gate').hidden,
  shellShown: !document.getElementById('shell').hidden,
}));
// an admin request made the way the shell makes it (hub.request uses the page's own stored tokens)
const adminCall = page => page.evaluate(async () => { try { const r = await hub.request('/api/admin/usage'); return { ok: true, devices: (r.devices || []).length }; } catch (e) { return { ok: false, err: String(e.message || e) }; } });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO });
  const { page } = d;
  await d.goto('#home'); await d.ctx.clock.runFor(3000); await page.waitForSelector('#view-home.on .hero');
  log('t0 signed in', await state(page));

  // 1) 12 h with nothing touched (browser + Worker clocks both moved), then the tab becomes visible again
  await L.clock(new Date(DEMO + 12 * H).toISOString());
  await d.ctx.clock.fastForward('12:00:00'); await d.ctx.clock.runFor(20000);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await d.ctx.clock.runFor(5000);
  log('A: +12 h untouched', await state(page));
  log('A: admin API from the page (+12 h)', await adminCall(page));

  // 2) iPadOS evicts the PWA overnight and it is relaunched: a fresh page load on the same device storage
  await page.reload({ waitUntil: 'load' }); await d.ctx.clock.runFor(3000);
  log('B: after relaunch (reload) at +12 h', await state(page));
  await page.click('.tab[data-tab="me"]'); await d.ctx.clock.runFor(3000);
  await page.waitForSelector('#admin-body .admin-people', { timeout: 10000 }).catch(() => {});
  const adm = await page.evaluate(() => ({
    adminCard: !!document.getElementById('admin'),
    resetPinButtons: document.querySelectorAll('#admin [data-resetpin]').length,
    unpairButtons: document.querySelectorAll('#admin [data-unpair]').length,
    rotateButtons: document.querySelectorAll('#admin #rotate-gen, #admin #rotate-choose').length,
  }));
  log('B: one tap on Me — admin panel', adm);
  await page.screenshot({ path: path.join(OUT, 'verify-no-idle-signout-2-me-12h.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  await page.locator('#admin').screenshot({ path: path.join(OUT, 'verify-no-idle-signout-2-admin-12h.png'), scale: 'css', animations: 'disabled' }).catch(e => log('admin shot failed', String(e.message)));

  // 3) three days away, iPad left on the counter
  await L.clock(new Date(DEMO + 3 * D).toISOString());
  await d.ctx.clock.fastForward(60 * H - 30000); await d.ctx.clock.runFor(20000);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await d.ctx.clock.runFor(5000);
  log('C: +3 days untouched', await state(page));
  log('C: admin API from the page (+3 days)', await adminCall(page));
  await d.close();

  // 4) the server lifetime of a session made by the real code path (createSession): Mea has no PIN in the seed, so a
  //    first-tap PIN creation on the Kitchen iPad mints a real session; then age the Worker clock.
  await L.clock(new Date(DEMO).toISOString());
  const made = await L.apiAs(null, '/api/profiles/niece/pin', { method: 'POST', body: { pin: '482615' }, profileToken: null });
  log('D: first-tap PIN for Mea', { status: made.status, gotToken: !!(made.body && made.body.profile_token) });
  const tok = made.body && made.body.profile_token;
  for (const days of [1, 30, 200, 364, 366]) {
    await L.clock(new Date(DEMO + days * D).toISOString());
    const me = await L.apiAs(null, '/api/me', { profileToken: tok });
    log(`D: /api/me with that session at +${days} d`, { status: me.status, who: me.body && me.body.profile ? me.body.profile.id : me.body && me.body.error });
  }
} finally { await L.close(); }
