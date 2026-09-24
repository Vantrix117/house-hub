// PROF (audit Phase 2), brief item 4 (shared iPad): does the shell ever sign an adult out, or lock, when the kitchen
// iPad is left alone? Eli (the admin) signs in, the browser clock jumps 12 hours, and the script checks who is signed in
// and whether the admin panel is still one tap away. Local rig only.
//
//   node "audits/tools/phase2/PROF/idle.mjs"
import { local, sleep } from '../../lib/local.mjs';

const log = (k, v) => console.log(k.padEnd(48), typeof v === 'string' ? v : JSON.stringify(v));
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: Date.now() }); const { page } = d;
  await d.goto('#home'); await d.ctx.clock.runFor(3000); await page.waitForSelector('#view-home.on .hero');
  log('signed in', await page.evaluate(() => hub.profile.id));
  await d.ctx.clock.fastForward('12:00:00'); await d.ctx.clock.runFor(2000);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await d.ctx.clock.runFor(2000);
  const s = await page.evaluate(() => ({ profile: hub.profile && hub.profile.id, isAdmin: hub.profile && hub.profile.isAdmin, gateShown: !document.getElementById('gate').hidden }));
  log('12 h later, untouched', s);
  await page.click('.tab[data-tab="me"]'); await d.ctx.clock.runFor(3000);
  log('one tap on Me: admin card present?', String(await page.locator('#admin').count() === 1));
  await d.close();
} finally { await L.close(); }
