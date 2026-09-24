// Skeptic #1 for "no-idle-signout": after Eli (admin) signs in on the Kitchen iPad and nobody touches it for 12 h,
// is the iPad still Eli with the admin panel reachable? Moves BOTH the browser clock and the Worker's demo clock,
// then also reloads the page (as a PWA relaunch would) and calls an admin-only API with the stored session token.
// Local rig only.
//
//   node "audits/tools/phase2/PROF/verify-no-idle-signout-1.mjs"
import { local, DEMO } from '../../lib/local.mjs';

const log = (k, v) => console.log(k.padEnd(52), typeof v === 'string' ? v : JSON.stringify(v));
const OUT = 'audits/evidence/p2/PROF/';
const L = await local({ variant: 'typical', clock: 'demo' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO });
  const { page } = d;
  await d.goto('#home'); await d.ctx.clock.runFor(3000);
  await page.waitForSelector('#view-home.on .hero', { timeout: 15000 });
  const state = () => page.evaluate(() => ({ profile: hub.profile && hub.profile.id, isAdmin: !!(hub.profile && hub.profile.isAdmin), gateShown: !document.getElementById('gate').hidden, browserNow: new Date().toISOString() }));
  log('t0 signed in', await state());

  // 12 h with nothing touched: browser clock and Worker clock both advance
  await L.clock(new Date(DEMO + 12 * 3600e3).toISOString());
  await d.ctx.clock.fastForward('12:00:00'); await d.ctx.clock.runFor(2000);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await d.ctx.clock.runFor(35000);   // a 30 s poll cycle so any 401 from the Worker would surface
  log('t0+12h, untouched', await state());
  log('server /api/me with the iPad\'s stored token', await page.evaluate(async () => { const r = await hub.request('/api/me'); return { id: r.profile && r.profile.id, isAdmin: r.profile && r.profile.isAdmin }; }).catch(e => 'error ' + e.message));

  // relaunch (PWA reopened / page reloaded) 12 h later
  await page.reload({ waitUntil: 'load' }); await d.ctx.clock.runFor(3000);
  log('after reload at t0+12h', await state());

  // one tap on Me
  await page.click('.tab[data-tab="me"]'); await d.ctx.clock.runFor(3000);
  const adminCard = await page.locator('#admin').count();
  log('one tap on Me: #admin card count', adminCard);
  const usage = await page.evaluate(async () => { try { const r = await hub.request('/api/admin/usage'); return 'ok keys=' + Object.keys(r).join(','); } catch (e) { return 'error ' + (e.status || '') + ' ' + e.message; } });
  log('admin-only GET /api/admin/usage from the iPad', usage);
  await d.ctx.clock.runFor(3000); await page.locator('#admin').scrollIntoViewIfNeeded(); await d.ctx.clock.runFor(500);
  await page.screenshot({ path: OUT + 'verify-no-idle-signout-me-12h.png', scale: 'css', animations: 'disabled', caret: 'hide' });
  log('screenshot', OUT + 'verify-no-idle-signout-me-12h.png');
  await d.close();
} finally { await L.close(); }
