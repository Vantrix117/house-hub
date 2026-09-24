// Skeptic #1 for "double-post-activity": does a second hub.activity() while the first POST /api/activity is still in
// flight re-post the first line (apps/hub.js:373-386, no in-flight guard)?
//   A0 control  Larder: one "used up" tap, POST /api/activity delayed 400 ms          → expect 1 line
//   A1 control  Larder: two taps 150 ms apart, no delay                                → expect 1 + 1
//   A2 claim    Larder: two taps 150 ms apart, 400 ms delay                            → claim: first line x2
//   A3 growth   Larder: three taps 150 ms apart, 400 ms delay                          → first x3, second x2, third x1?
//   B  shell+frame: shell hub.activity('X') then, 100 ms later, the Larder frame's hub.activity('Y'), 400 ms delay
//   C  Kid Verse (variant empty, no delay at all): Ezra taps Done ★ once; the star earns the "First star" badge, so
//      award() (apps/kidverse.html:332) and reconcile() (:481) call hub.activity in the same click → verse line x2?
// Counts come from two places: POST /api/activity requests the browser sent (request bodies) and GET /api/activity.
// Run: node "audits/tools/phase2/PWA/verify-double-post-activity-1.mjs"
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

function tracker(d, api) {
  const posts = [];
  d.ctx.on('request', r => { if (r.method() === 'POST' && r.url().startsWith(api + '/api/activity')) { try { posts.push(JSON.parse(r.postData() || '{}').text); } catch { posts.push('?'); } } });
  return posts;
}
const tally = (arr, texts) => Object.fromEntries(texts.map(t => [t, arr.filter(x => x === t).length]));

// ── Part A + B: Larder on the typical household ────────────────────────────────────────────────────────────────
{
  const L = await local({ variant: 'typical', clock: 'demo' });
  try {
    const serverTexts = async () => (await L.apiAs('eli', '/api/activity?limit=100')).body.activity.map(a => a.text);
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const posts = tracker(ipad, L.api);
    // one matcher reference, so unroute really removes the delay (unroute matches the url argument by identity)
    const isActivity = u => u.href.startsWith(L.api + '/api/activity');
    const delay = ms => ipad.ctx.route(isActivity, async r => { if (r.request().method() === 'POST') await sleep(ms); r.continue().catch(() => {}); });
    const undelay = () => ipad.ctx.unroute(isActivity);
    let f = await ipad.openApp('leftovers', { wait: '.item button.done' });
    await sleep(1500);
    // enough items for every run: add eight via the SDK (hub.set posts no feed line), then reopen the app to render them
    await f.evaluate(() => { const today = new Date().toISOString().slice(0, 10); for (let i = 1; i <= 8; i++) { const id = hub.uid(); hub.set('item:' + id, { id, name: 'Audit dish ' + i, size: 'Medium', dateLogged: today, by: 'eli', byName: 'Eli' }); } });
    await sleep(2500);
    f = await ipad.openApp('leftovers', { wait: '.item button.done' });
    await sleep(2000);
    // natural round trip of POST /api/activity on the rig (no added delay)
    const rtt = await f.evaluate(async () => { const t = performance.now(); await hub.request('/api/activity', { method: 'POST', body: { app_id: 'leftovers', text: 'Audit rtt probe' } }); return Math.round(performance.now() - t); });
    say('rig round trip of one POST /api/activity, no added delay (ms)', rtt);
    const names = () => f.$$eval('.item', els => els.map(e => e.querySelector('.nm').textContent));
    const tap = (n, gap) => f.evaluate(([n, gap]) => { for (let i = 0; i < n; i++) setTimeout(() => document.querySelector('.item button.done').click(), i * gap); }, [n, gap]);
    const run = async (label, n, gap, ms) => {
      const before = await names(); const tapped = before.slice(0, n).map(x => 'Finished the ' + x);
      posts.length = 0; if (ms) await delay(ms);
      await tap(n, gap); await sleep(3000 + n * 500);
      if (ms) await undelay();
      const sv = await serverTexts();
      say(label, { itemsBefore: before.length, tapped, browserPOSTs: tally(posts, tapped), serverLines: tally(sv, tapped), queueLeft: await f.evaluate(() => localStorage.getItem('hub.activityQueue')) });
    };
    await run('A0 one tap, 400 ms network (control)', 1, 0, 400);
    await run('A1 two taps 150 ms apart, no added delay (control)', 2, 150, 0);
    await run('A2 two taps 150 ms apart, 400 ms network (the claim)', 2, 150, 400);
    await run('A3 three taps 150 ms apart, 400 ms network', 3, 150, 400);

    // B: the shell and the app frame share hub.activityQueue
    posts.length = 0; await delay(400);
    await ipad.page.evaluate(() => { hub.activity('Audit shell line X', 'hub'); });
    await sleep(100);
    await f.evaluate(() => { hub.activity('Audit frame line Y'); });
    await sleep(3000); await undelay();
    say('B shell then frame 100 ms later, 400 ms network', { browserPOSTs: tally(posts, ['Audit shell line X', 'Audit frame line Y']), serverLines: tally(await serverTexts(), ['Audit shell line X', 'Audit frame line Y']) });
    await ipad.page.locator('#feed').first().screenshot({ path: path.join(OUT, 'verify-double-post-activity-1-larder-feed-ipad-portrait-light.png'), scale: 'css', animations: 'disabled' }).catch(async () => {
      await ipad.goto('#home'); await ipad.page.waitForSelector('#feed .ftxt', { timeout: 15000 }); await sleep(1500);
      await ipad.page.locator('#feed').first().screenshot({ path: path.join(OUT, 'verify-double-post-activity-1-larder-feed-ipad-portrait-light.png'), scale: 'css', animations: 'disabled' });
    });
    const errs = ipad.logs.filter(l => /error/i.test(l));
    if (errs.length) say('A/B page errors', errs.slice(0, 10));
  } finally { await L.close(); }
}

// ── Part C: Kid Verse, no added delay, first-ever star earns the First star badge ────────────────────────────────
{
  const L = await local({ variant: 'empty', clock: 'real' });
  try {
    const serverTexts = async () => (await L.apiAs('eli', '/api/activity?limit=100')).body.activity.map(a => ({ who: a.profile_id, text: a.text }));
    const kid = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false });
    const posts = tracker(kid, L.api);
    const f = await kid.openApp('kidverse', { wait: '#done:not([hidden])' });
    await sleep(3000);   // let both kidverse scopes pull (reconcile() waits for that)
    const before = await f.evaluate(() => { const s = (window.hub && hub.get('stars', { scope: 'person' })) || null; return { earned: s && s.earned, badges: s && Object.keys(s.badges || {}), doneLabel: document.querySelector('#done span').textContent }; });
    posts.length = 0;
    await f.click('#done');
    await sleep(3000);
    const after = await f.evaluate(() => { const s = hub.get('stars', { scope: 'person' }); return { earned: s && s.earned, badges: s && Object.keys(s.badges || {}) }; });
    const sv = await serverTexts();
    const texts = ['Ezra read the verse ★', 'Ezra earned the First star badge'];
    say('C Kid Verse: one Done ★ tap, no added delay', { before, after, browserPOSTs: posts, serverLines: tally(sv.map(a => a.text), texts), serverRows: sv.filter(a => /Ezra/.test(a.text)) });
    // what a parent sees: Eli's Home feed on the same household (kids' Home has no feed)
    const adult = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await adult.goto('#home'); await adult.page.waitForSelector('#feed .ftxt', { timeout: 15000 }); await sleep(1500);
    const feedShot = path.join(OUT, 'verify-double-post-activity-1-kidverse-feed-ipad-portrait-light.png');
    await adult.page.locator('#feed').first().screenshot({ path: feedShot, scale: 'css', animations: 'disabled' });
    say('C Eli Home feed after Ezra\'s one tap', { lines: await adult.page.$$eval('#feed .ftxt', els => els.map(e => e.textContent)), shot: path.relative(ROOT, feedShot).replace(/\\/g, '/') });
    const errs = kid.logs.filter(l => /error/i.test(l));
    if (errs.length) say('C page errors', errs.slice(0, 10));
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(OUT, 'verify-double-post-activity-1.json'), JSON.stringify(log, null, 1));
console.log('\nwrote audits/evidence/p2/PWA/verify-double-post-activity-1.json');
