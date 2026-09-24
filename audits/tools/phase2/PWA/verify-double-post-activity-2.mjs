// Skeptic #2 for finding "double-post-activity" (Phase 2, PWA topic): two quick actions post the first feed line twice.
// Independent re-run on a fresh local instance (REAL clock, so server + browser agree), with a control and variants:
//   S1 control    no added latency, taps 150 ms apart                 → one line each expected (race window ~ local RTT)
//   S2 the claim  POST /api/activity delayed 400 ms, taps 150 ms apart
//   S3 moderate   delayed 200 ms, taps 150 ms apart                   (a typical phone round trip)
//   S4 outside    delayed 200 ms, taps 400 ms apart                   (second tap after the first POST returned)
//   S5 backlog    one "used up" tapped OFFLINE (line queued), back online, then two taps 300 ms apart at 200 ms latency:
//                 does the backlog get posted twice too (window = backlog × RTT)?
// Items are this script's own ("Verify dish N"), seeded through the API; lines are counted on the server by exact text,
// and every POST /api/activity the page (shell + Larder frame) sent is logged with its body.
// Run: node "audits/tools/phase2/PWA/verify-double-post-activity-2.mjs"
// Evidence: audits/evidence/p2/PWA/verify-double-post-activity-2.json + verify-double-post-activity-2-feed-ipad-portrait-light.png
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
fs.mkdirSync(OUT, { recursive: true });
const log = {};
const say = (k, v) => { log[k] = v; console.log('\n== ' + k + '\n' + JSON.stringify(v, null, 1)); };

const L = await local({ variant: 'typical', clock: 'real' });
try {
  // 12 items of our own, family scope, logged today
  const today = new Date().toISOString().slice(0, 10);
  const names = Array.from({ length: 12 }, (_, i) => 'Verify dish ' + (i + 1));
  for (const [i, name] of names.entries()) {
    const id = 'vdp' + (i + 1);
    const r = await L.apiAs('eli', `/api/data/leftovers/item:${id}?scope=family`, { method: 'PUT', body: { value: { id, name, size: 'Medium', dateLogged: today, by: 'eli', byName: 'Eli' }, updated_at: Date.now() } });
    if (r.status !== 200) throw new Error('seed failed ' + r.status + ' ' + JSON.stringify(r.body));
  }
  const serverCount = async text => (await L.apiAs('eli', '/api/activity?limit=100')).body.activity.filter(a => a.text === text).length;

  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const P = ipad.page;
  const posts = [];
  P.on('request', rq => { if (rq.method() === 'POST' && rq.url().includes('/api/activity')) { let t = null; try { t = JSON.parse(rq.postData()).text; } catch {} posts.push({ t: Date.now(), text: t }); } });

  const f = await ipad.openApp('leftovers', { wait: '.item button.done' });
  await sleep(2000);
  const present = await f.$$eval('.item .nm', els => els.map(e => e.textContent));
  say('setup', { larderShowsOurItems: names.every(n => present.includes(n)), itemsOnScreen: present.length, activityQueueAtStart: await f.evaluate(() => JSON.parse(localStorage.getItem('hub.activityQueue') || '[]')) });

  let delay = 0;
  const handler = async r => { if (r.request().method() === 'POST' && delay) await sleep(delay); r.continue(); };
  await ipad.ctx.route(u => u.href.startsWith(L.api + '/api/activity'), handler);

  // tap the "used up" button of item a, then of item b `gap` ms later (dispatched in the page, like two finger taps)
  const tapTwo = (a, b, gap) => f.evaluate(([a, b, gap]) => {
    const btn = n => [...document.querySelectorAll('.item')].find(el => el.querySelector('.nm').textContent === n).querySelector('button.done');
    btn(a).click(); setTimeout(() => btn(b).click(), gap);
  }, [a, b, gap]);

  async function scenario(label, a, b, gap, ms) {
    delay = ms; const p0 = posts.length;
    await tapTwo(a, b, gap);
    await sleep(3000 + ms * 4);
    const res = {
      latencyMs: ms, gapMs: gap,
      serverLines: { ['Finished the ' + a]: await serverCount('Finished the ' + a), ['Finished the ' + b]: await serverCount('Finished the ' + b) },
      postsSent: posts.slice(p0).map(p => p.text),
      queueAfter: await f.evaluate(() => JSON.parse(localStorage.getItem('hub.activityQueue') || '[]').map(q => q.text)),
    };
    say(label, res); return res;
  }

  await scenario('S1 control: 0 ms added latency, taps 150 ms apart', names[0], names[1], 150, 0);
  await scenario('S2 claim: 400 ms latency, taps 150 ms apart', names[2], names[3], 150, 400);
  await scenario('S3 moderate: 200 ms latency, taps 150 ms apart', names[4], names[5], 150, 200);
  await scenario('S4 outside window: 200 ms latency, taps 400 ms apart', names[6], names[7], 400, 200);

  // S5 backlog: one tap offline, back online (does anything drain the activity queue on reconnect?), then two taps
  await ipad.setOffline(true);
  await f.evaluate(n => [...document.querySelectorAll('.item')].find(el => el.querySelector('.nm').textContent === n).querySelector('button.done').click(), names[8]);
  await sleep(800);
  const qOffline = await f.evaluate(() => JSON.parse(localStorage.getItem('hub.activityQueue') || '[]').map(q => q.text));
  await ipad.setOffline(false);
  await sleep(3000);
  const qOnline = await f.evaluate(() => JSON.parse(localStorage.getItem('hub.activityQueue') || '[]').map(q => q.text));
  say('S5 setup: queued offline, 3 s after reconnect', { queuedOffline: qOffline, stillQueuedAfterReconnect: qOnline, backlogOnServer: await serverCount('Finished the ' + names[8]) });
  const s5 = await scenario('S5 backlog: 200 ms latency, taps 300 ms apart (outside a single RTT)', names[9], names[10], 300, 200);
  s5.backlogLineOnServer = await serverCount('Finished the ' + names[8]);
  say('S5 backlog line count on server', { ['Finished the ' + names[8]]: s5.backlogLineOnServer });

  await ipad.ctx.unroute(u => u.href.startsWith(L.api + '/api/activity'), handler);

  // what the family sees: Home feed on the same iPad
  await ipad.goto('#home');
  await P.waitForSelector('#feed .ftxt', { timeout: 15000 });
  await P.click('#feed-refresh').catch(() => {});
  await sleep(2000);
  const feedTexts = await P.$$eval('#feed .ftxt', els => els.map(e => e.textContent).filter(t => t.startsWith('Finished the Verify dish')));
  const shot = path.join(OUT, 'verify-double-post-activity-2-feed-ipad-portrait-light.png');
  await P.locator('#feed').first().screenshot({ path: shot, scale: 'css', animations: 'disabled' });
  say('Home feed on the iPad (our lines, newest first)', { lines: feedTexts, shot: path.relative(ROOT, shot).replace(/\\/g, '/') });
  say('page errors', ipad.logs.filter(l => /error/i.test(l)).slice(0, 10));
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-double-post-activity-2.json'), JSON.stringify(log, null, 1));
  await L.close();
}
