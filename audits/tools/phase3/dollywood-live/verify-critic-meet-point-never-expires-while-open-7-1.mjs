// Skeptic #1 for critic-meet-point-never-expires-while-open-7: does the meeting-point bar/pin keep a frozen age and outlive
// the 2 h rule (loadMeet, apps/dollywood-live.html:1579) while the map stays open and no family row changes?
// Independent of critic-meet-expiry.mjs: steps the clock in two stages (+20 min, then to +2 h 10 min), waits past the 30 s
// family redraw (:1484) and a hub pull each time, reads the bar + pin, then (control) has Mom's device write a loc: row via
// the API so hub.onChange -> loadFam -> loadMeet (:1482, :1256) runs, and reads again without reopening.
// Park seed (Mae set "The Wildwood Tree" 12 min before start), WebKit, Eli on iPhone PWA with a Playwright clock.
// Run: node "audits/tools/phase3/dollywood-live/verify-critic-meet-point-never-expires-while-open-7-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EV = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'dollywood-live');
const TAG = 'verify-critic-meet-point-never-expires-while-open-7-1';
fs.mkdirSync(EV, { recursive: true });
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: Date.now(), as: ph });
  await d.goto('#home'); await sleep(1500);
  const f = await d.openApp('dollywood-live');
  await f.waitForSelector('#lv-pill[data-state]', { timeout: 15000 });
  await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 10000 });
  await sleep(2500);
  const read = () => f.evaluate(() => {
    const v = hub.get('meet', { scope: 'family' });
    return { barHidden: document.getElementById('lv-meet').hidden, meta: document.getElementById('meet-meta').textContent,
      pinDrawn: !!document.querySelector('.lv-meetpin'), inMemMEET: !!MEET,
      cachedRowAgeMin: v && v.at ? Math.round((Date.now() - v.at) / 60000) : null,
      wouldLoadMeetShow: !!(v && v.x != null && Date.now() - (v.at || 0) < 2 * 3600e3) };
  });
  out.A_open = await read();
  await d.ctx.clock.fastForward('00:20:00'); await sleep(35000);
  out.B_plus20min = await read();
  await d.ctx.clock.fastForward('01:50:00'); await sleep(35000);
  out.C_plus2h10 = await read();
  await d.page.screenshot({ path: path.join(EV, TAG + '-C-plus2h10.png'), scale: 'css' });
  // control: another device changes a family row -> hub.onChange -> loadFam -> loadMeet
  const pageNow = await f.evaluate(() => Date.now());
  const w = await L.apiAs('mom', '/api/data/dollywood-live/batch?scope=family', { method: 'POST', body: { items: [{ key: 'loc:mom', value: { x: 700, y: 900, acc: 10, hdg: null, t: pageNow, name: 'Elizabeth', emoji: '', color: '#888888' }, updated_at: Date.now() + 1000 }] } });
  out.D_momWrite = { status: w.status };
  await sleep(40000);
  out.D_afterFamilyChange = await read();
  await d.page.screenshot({ path: path.join(EV, TAG + '-D-after-family-change.png'), scale: 'css' });
} catch (e) { out.error = String(e && e.stack || e); }
finally {
  fs.writeFileSync(path.join(EV, TAG + '.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2)); await L.close();
}
