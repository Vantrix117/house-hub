#!/usr/bin/env node
// Roadmap 15 checks: push round 2. Three reminder kinds — "behind" (F260 weekly catch-up), "prayer" (new family-list
// prayer → adults except the author) and "park" (a kid's map marker went quiet on a park day) — each forced through
// POST /api/admin/cron/run as the admin, delivered to the stand-in receiver (scripts/push-receiver.mjs) and asserted
// on the decrypted payload; opt-outs (push_prefs.<kind> = false) and the once-a-day gate are checked too. Then, headless,
// the three switches in Me → Notifications exist for an adult and persist in app_data(person, hub, push_prefs), and the
// prayer app's own add form (family list active, no activity line) writes by:<id> on the row so the author is left out.
//   cd worker && npx wrangler dev --port 8787     (a freshly reset, seeded local D1 — push_log must be empty for today)
//   node scripts/test-push2.mjs <pairing-code>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CODE = process.argv[2] || 'local-test-code';
const API = process.env.HUB_API || 'http://127.0.0.1:8787';
const RECEIVER_PORT = 8790;
const SITE_PORT = 8765;
const SITE = `http://localhost:${SITE_PORT}`;
const PINS = { eli: '1357', christian: '2468', mom: '3579' };

let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, typeof extra === 'string' ? extra : JSON.stringify(extra)); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, { timeout = 12000, every = 150, label = 'condition' } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { try { const v = await fn(); if (v) return v; } catch {} await sleep(every); }
  throw new Error('timeout waiting for ' + label);
}

// ── stand-in push service ─────────────────────────────────────
const pushes = [];          // { url, payload, ttl, urgency }
let subscription = null;
const receiver = spawn(process.execPath, [path.join(ROOT, 'scripts/push-receiver.mjs'), String(RECEIVER_PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
receiver.stdout.setEncoding('utf8');
let buf = '';
receiver.stdout.on('data', d => {
  buf += d; const lines = buf.split('\n'); buf = lines.pop();
  for (const line of lines) {
    if (line.startsWith('SUBSCRIPTION ')) subscription = JSON.parse(line.slice(13));
    const m = /^PUSH #\d+ url=(\S+) vapid=(\S+) ttl=(\S+) urgency=(\S+) enc=(\S+) payload=(.*)$/.exec(line);
    if (m) { let payload = null; try { payload = JSON.parse(m[6]); } catch { payload = m[6]; } pushes.push({ url: m[1], vapid: m[2], ttl: m[3], urgency: m[4], payload }); }
    else if (line.startsWith('PUSH')) pushes.push({ url: null, error: line });
  }
});
receiver.on('exit', c => { if (c) console.log('receiver exited', c); });
const pushesFor = (pid, kind) => pushes.filter(p => p.url === '/push/' + pid && p.payload && p.payload.tag === kind);

// ── API helpers ───────────────────────────────────────────────
let deviceToken = null; const tokens = {};
async function api(method, url, body, profile) {
  const headers = { 'Content-Type': 'application/json' };
  if (deviceToken) headers['X-Device-Token'] = deviceToken;
  if (profile && tokens[profile]) headers['X-Profile-Token'] = tokens[profile];
  const r = await fetch(API + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: r.status, body: json };
}
async function signIn(id) {
  const pin = PINS[id];
  let r = await api('POST', '/api/login', { profile_id: id, pin });
  if (r.status === 403 && r.body.error === 'needs_pin_setup') r = await api('POST', `/api/profiles/${id}/pin`, { pin });
  if (r.status !== 200 || !r.body.profile_token) throw new Error(`sign in ${id}: ${r.status} ${JSON.stringify(r.body)}`);
  tokens[id] = r.body.profile_token;
}
const put = (profile, app, scope, key, value) => api('PUT', `/api/data/${app}/${key}?scope=${scope}`, { value, updated_at: Date.now() }, profile);
const run = job => api('POST', '/api/admin/cron/run', { job }, 'eli');
const nyDate = d => { const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d); const g = t => p.find(x => x.type === t).value; return `${g('year')}-${g('month')}-${g('day')}`; };
const daysAgo = n => nyDate(new Date(Date.now() - n * 86400000));

// ── static site for the headless part ─────────────────────────
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
async function serveSite() {
  for (let attempt = 0; attempt < 6; attempt++) {
    const server = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
      fs.readFile(p, (err, data) => {
        if (err) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
      });
    });
    const got = await new Promise(resolve => { server.once('error', () => resolve(false)); server.listen(SITE_PORT, () => resolve(true)); });
    if (got) return server;
    console.log(`  … port ${SITE_PORT} busy, retrying (${attempt + 1}/6)`); await sleep(5000);
  }
  return null;
}

(async () => {
  let browser = null, site = null;
  try {
    await waitFor(() => subscription, { label: 'receiver subscription' });
    const subFor = pid => ({ ...subscription, endpoint: `http://127.0.0.1:${RECEIVER_PORT}/push/${pid}` });

    console.log('\n## setup: pair, sign in three adults + a kid, subscribe the receiver');
    const pair = await api('POST', '/api/pair', { code: CODE, name: 'test-push2' });
    ok(pair.status === 200 && pair.body.device_token, 'paired', pair.body); deviceToken = pair.body.device_token;
    for (const id of ['eli', 'christian', 'mom']) await signIn(id);
    { const r = await api('POST', '/api/login', { profile_id: 'ezra' }); tokens.ezra = r.body.profile_token; ok(r.status === 200, 'Ezra (kid) signed in'); }
    for (const id of ['eli', 'christian', 'mom']) { const r = await api('POST', '/api/push/subscribe', { subscription: subFor(id) }, id); ok(r.status === 200, `${id}: receiver subscribed`, r.body); }
    ok((await api('GET', '/api/push/config')).body.enabled === true, 'VAPID configured locally (push enabled)');
    // Elizabeth (mom) opts out of all three new kinds up front; she proves the pref gate on every job.
    { const r = await put('mom', 'hub', 'person', 'push_prefs', { behind: false, prayer: false, park: false }); ok(r.status === 200, 'mom: push_prefs behind/prayer/park = off'); }
    { const r = await run('nonsense'); ok(r.status === 400 && r.body.error === 'bad_job', 'cron/run rejects an unknown job', r.body); }
    { const r = await api('POST', '/api/admin/cron/run', { job: 'park' }, 'christian'); ok(r.status === 403, 'cron/run is admin only', r.body); }

    console.log('\n## behind: F260 weekly catch-up');
    // Eli: week 3 started 6 days ago, 2 of 5 done -> 3 behind. Mae: 4 of 5 done -> 1 behind (normal on a Sunday). Mom: 3 behind but opted out.
    const next = { week: 3, day: 3, ref: 'Genesis 27' };
    await put('eli', 'f260', 'person', 'f260.summary', { week: 3, weekDone: 2, total: 12, streak: 0, readToday: false, next, finished: false });
    await put('eli', 'f260', 'person', 'f260.weekStart', { 1: daysAgo(20), 2: daysAgo(13), 3: daysAgo(6) });
    await put('christian', 'f260', 'person', 'f260.summary', { week: 3, weekDone: 4, total: 14, streak: 4, readToday: true, next: { week: 3, day: 5, ref: 'Genesis 32-33' }, finished: false });
    await put('christian', 'f260', 'person', 'f260.weekStart', { 3: daysAgo(6) });
    await put('mom', 'f260', 'person', 'f260.summary', { week: 3, weekDone: 2, total: 12, streak: 0, readToday: false, next, finished: false });
    await put('mom', 'f260', 'person', 'f260.weekStart', { 3: daysAgo(6) });
    let r = await run('behind');
    ok(r.status === 200 && r.body.job === 'behind', 'behind job ran', r.body);
    const chk = Object.fromEntries((r.body.checked || []).map(c => [c.profile, c]));
    ok(chk.eli && chk.eli.behind === 3, 'Eli is 3 behind (5 - 2, week started 6 days ago)', chk);
    ok(chk.christian && chk.christian.behind === 1, 'Mae is 1 behind (not pushed)', chk);
    ok(r.body.notified.length === 1 && r.body.notified[0].profile === 'eli' && r.body.notified[0].ok === 1, 'only Eli notified', r.body);
    ok(r.body.skipped.some(s => s.profile === 'mom' && s.why === 'pref_off'), 'mom skipped: pref off', r.body.skipped);
    await waitFor(() => pushesFor('eli', 'behind').length, { label: 'behind push' });
    const bp = pushesFor('eli', 'behind')[0];
    ok(bp.payload.body === 'You are 3 readings behind — Genesis 27 is next.' && bp.payload.url === '#f260' && bp.vapid === 'valid', 'decrypted payload: "You are 3 readings behind — Genesis 27 is next."', bp);
    ok(pushesFor('christian', 'behind').length === 0 && pushesFor('mom', 'behind').length === 0, 'Mae and mom got nothing');
    r = await run('behind');
    ok(r.body.notified.length === 0 && r.body.skipped.some(s => s.profile === 'eli' && s.why === 'already_today'), 'second run the same day: Eli not pushed again', r.body);
    // a week that started only 2 days ago is not judged
    await put('eli', 'f260', 'person', 'f260.weekStart', { 3: daysAgo(2) });
    r = await run('behind');
    ok((r.body.checked.find(c => c.profile === 'eli') || {}).why === 'week_too_young', 'week started 2 days ago: not judged (week_too_young)', r.body.checked);

    console.log('\n## prayer: new family-list prayer -> adults except the author');
    r = await run('prayer');
    ok(r.status === 200 && r.body.new.length === 0 && r.body.notified.length === 0, r.body.seeded ? 'first run only seeds the watermark (no pushes)' : 'nothing new since the last run (watermark kept in settings)', r.body);
    // Mae shares a prayer to the family list (the app writes the row and an activity line)
    const prayer = { id: 's001', title: "Grandma's surgery", for: 'Grandma', phone: '', detail: '', category: 'Family', cadence: 'daily', days: [], status: 'active', createdAt: nyDate(new Date()), lastPrayedAt: null, answeredAt: null, answerNote: null, updates: [], sharedFrom: 'p003', prayedBy: {}, updatedAt: new Date().toISOString() };
    await put('christian', 'prayer', 'family', 'prayer:s001', prayer);
    await api('POST', '/api/activity', { app_id: 'prayer', text: "Sent a request to the family list: Grandma's surgery" }, 'christian');
    r = await run('prayer');
    ok(r.body.new.length === 1 && r.body.new[0].by === 'christian', 'one new prayer, author resolved to Mae from the activity line', r.body.new);
    ok(r.body.notified.length === 1 && r.body.notified[0].profile === 'eli', 'only Eli notified', r.body.notified);
    ok(r.body.skipped.some(s => s.profile === 'christian' && s.why === 'author'), 'Mae skipped: she added it', r.body.skipped);
    ok(r.body.skipped.some(s => s.profile === 'mom' && s.why === 'pref_off'), 'mom skipped: pref off', r.body.skipped);
    await waitFor(() => pushesFor('eli', 'prayer').length, { label: 'prayer push' });
    const pp = pushesFor('eli', 'prayer')[0];
    ok(pp.payload.body === "New on the family list: Grandma's surgery (for Grandma)." && pp.payload.url === '#prayer', 'decrypted payload names the prayer', pp);
    ok(pushesFor('christian', 'prayer').length === 0 && pushesFor('mom', 'prayer').length === 0, 'Mae and mom got nothing');
    // praying for it (an update to the same row) is not "new"
    await put('eli', 'prayer', 'family', 'prayer:s001', { ...prayer, prayedBy: { eli: nyDate(new Date()) }, updatedAt: new Date().toISOString() });
    r = await run('prayer');
    ok(r.body.new.length === 0 && r.body.notified.length === 0, 'editing an existing prayer does not re-announce it', r.body);
    // a kid's private prayer (person scope) never counts
    await put('ezra', 'prayer', 'person', 'prayer:p001', { ...prayer, id: 'p001', title: 'My hamster' });
    r = await run('prayer');
    ok(r.body.new.length === 0, 'person-scope prayers are ignored', r.body);
    // Key re-use: the app's nextId() hands out 'p' + (count + 1), so deleting the newest family prayer and adding another
    // lands on the SAME prayer:<id> row (a tombstone that putOne updates in place, same app_data.id). It must still be
    // announced as new. Eli adds p003 → Mae hears; Eli deletes it and adds a different p003 → announced again (Mae is
    // on her once-a-day gate by then, so mom — who turns the pref back on — is the one who proves the payload).
    // This is the prayer app's primary add flow: typed straight into the family list, the app writes by:<profile id> on the
    // row and NO activity line (only "share to the family list" and the chat tool write one). The author must still be
    // left out.
    const p003 = { ...prayer, id: 'p003', title: 'First prayer', for: '', sharedFrom: null, createdAt: nyDate(new Date()), by: 'eli' };
    await put('eli', 'prayer', 'family', 'prayer:p003', p003);
    const eliPrayerPushes = pushesFor('eli', 'prayer').length;
    r = await run('prayer');
    ok(r.body.new.length === 1 && r.body.new[0].title === 'First prayer' && r.body.new[0].by === 'eli', 'Eli adds prayer:p003 "First prayer" with by:eli and no activity line — new, author Eli', r.body.new);
    ok(r.body.skipped.some(x => x.profile === 'eli' && x.why === 'author') && !r.body.notified.some(n => n.profile === 'eli'), 'Eli is skipped as the author (not pushed about his own prayer)', r.body);
    ok(r.body.notified.length === 1 && r.body.notified[0].profile === 'christian' && r.body.skipped.some(s => s.profile === 'eli' && s.why === 'author'), 'Mae notified, Eli skipped as author', r.body);
    await waitFor(() => pushesFor('christian', 'prayer').length, { label: 'Mae prayer push' });
    ok(pushesFor('christian', 'prayer')[0].payload.body === 'New on the family list: First prayer.', 'Mae\'s decrypted payload names "First prayer"', pushesFor('christian', 'prayer')[0]);
    await sleep(400);
    ok(pushesFor('eli', 'prayer').length === eliPrayerPushes, 'the receiver saw no prayer push to Eli for his own prayer', pushesFor('eli', 'prayer'));
    await sleep(20);
    { const d = await api('DELETE', '/api/data/prayer/prayer:p003?scope=family', { updated_at: Date.now() }, 'eli'); ok(d.status === 200 && d.body.value === null, 'Eli deletes prayer:p003 (tombstone, row kept)', d.body); }
    await sleep(20);
    await put('eli', 'prayer', 'family', 'prayer:p003', { ...p003, title: 'Totally different new prayer', updatedAt: new Date().toISOString() });
    await put('mom', 'hub', 'person', 'push_prefs', { behind: false, prayer: true, park: false });   // mom turns prayer back on
    r = await run('prayer');
    ok(r.body.new.length === 1 && r.body.new[0].title === 'Totally different new prayer' && r.body.new[0].by === 'eli', 'a different prayer re-using the key prayer:p003 is announced as new', r.body.new);
    ok(r.body.notified.length === 1 && r.body.notified[0].profile === 'mom' && r.body.skipped.some(s => s.profile === 'christian' && s.why === 'already_today') && r.body.skipped.some(s => s.profile === 'eli' && s.why === 'author'), 'mom notified (pref back on); Mae once-a-day; Eli author', r.body);
    await waitFor(() => pushesFor('mom', 'prayer').length, { label: 'mom prayer push' });
    ok(pushesFor('mom', 'prayer')[0].payload.body === 'New on the family list: Totally different new prayer.', 'mom\'s decrypted payload names the re-created prayer', pushesFor('mom', 'prayer')[0]);
    r = await run('prayer');
    ok(r.body.new.length === 0 && r.body.notified.length === 0, 'next run: the re-created prayer is not announced twice', r.body);
    // a deleted prayer that stays deleted is not "new" either
    await api('DELETE', '/api/data/prayer/prayer:p003?scope=family', { updated_at: Date.now() }, 'eli');
    r = await run('prayer');
    ok(r.body.new.length === 0, 'a plain delete announces nothing', r.body);

    console.log('\n## park: a kid\'s marker went quiet on a park day');
    const now = Date.now();
    const loc = (id, name, emoji, minAgo) => ({ x: 1200, y: 800, acc: 12, hdg: null, t: now - minAgo * 60000, name, emoji, color: '#137F77' });
    await put('eli', 'dollywood-live', 'family', 'loc:eli', loc('eli', 'Eli', '🧭', 4));
    await put('eli', 'dollywood-live', 'family', 'loc:ezra', loc('ezra', 'Ezra', '🦖', 35));
    await put('eli', 'dollywood-live', 'family', 'loc:kiara', loc('kiara', 'Kiara', '🦄', 6 * 60));   // yesterday's marker: not at the park today
    r = await run('park');
    ok(r.status === 200 && r.body.parkDay === true, 'park day detected (a marker fresher than 4 h)', r.body);
    ok(r.body.stale.length === 1 && r.body.stale[0].id === 'ezra', 'Ezra flagged, Kiara (6 h old) not', r.body.stale);
    const who = r.body.notified.map(n => n.profile).sort();
    ok(who.join(',') === 'christian,eli', 'Eli and Mae notified', r.body.notified);
    ok(r.body.skipped.some(s => s.profile === 'mom' && s.why === 'pref_off'), 'mom skipped: pref off', r.body.skipped);
    await waitFor(() => pushesFor('eli', 'park').length && pushesFor('christian', 'park').length, { label: 'park pushes' });
    const kp = pushesFor('eli', 'park')[0];
    ok(/^Ezra's spot has not updated for 3[5-6] min\.$/.test(kp.payload.body) && kp.payload.url === '#dollywood-live' && kp.urgency === 'high', 'decrypted payload: "Ezra\'s spot has not updated for 35 min."', kp);
    ok(pushesFor('mom', 'park').length === 0, 'mom got nothing');
    r = await run('park');
    ok(r.body.notified.length === 0 && r.body.skipped.filter(s => s.why === 'already_today').length === 2, 'second run: once a day per person', r.body);
    // no fresh adult -> no alert (they may all be on a ride with no signal)
    await put('eli', 'dollywood-live', 'family', 'loc:eli', loc('eli', 'Eli', '🧭', 45));
    r = await run('park');
    ok(r.body.stale.length === 1 && r.body.notified.length === 0 && !r.body.skipped.length, 'no fresh adult marker: nothing sent', r.body);

    console.log('\n## pref flips');
    // mom turns park back on: the same conditions now reach her (proves the pref was the only gate)
    await put('eli', 'dollywood-live', 'family', 'loc:eli', loc('eli', 'Eli', '🧭', 2));
    await put('mom', 'hub', 'person', 'push_prefs', { behind: false, prayer: false, park: true });
    r = await run('park');
    ok(r.body.notified.length === 1 && r.body.notified[0].profile === 'mom', 'park pref back on: mom gets the alert', r.body);
    await waitFor(() => pushesFor('mom', 'park').length, { label: 'mom park push' });
    // Eli turns behind off, mom stays off; a brand-new person (dad) with the default prefs and no subscription is not in notified
    await put('eli', 'hub', 'person', 'push_prefs', { behind: false });
    await put('eli', 'f260', 'person', 'f260.weekStart', { 3: daysAgo(6) });
    r = await run('behind');
    ok(r.body.notified.length === 0 && r.body.skipped.some(s => s.profile === 'eli' && s.why === 'pref_off'), 'behind pref off: Eli skipped as pref_off (not just already_today)', r.body.skipped);
    const usage = await api('GET', '/api/admin/usage', undefined, 'eli');
    const sends = (usage.body.push || []).map(p => `${p.profile_id}:${p.kind}`).sort();
    ok(sends.join(' ') === 'christian:park christian:prayer eli:behind eli:park eli:prayer mom:park mom:prayer', 'push_log matches: eli behind/prayer/park, christian prayer/park, mom prayer/park', sends);
    const perKind = pushes.filter(p => p.payload).map(p => p.url + ' ' + p.payload.tag).sort();
    ok(perKind.length === 7 && !pushes.some(p => p.error), 'receiver saw exactly 7 pushes, all decrypted + VAPID valid', perKind);

    console.log('\n## Me → Notifications: the three switches (headless)');
    site = await serveSite();
    if (!site) { ok(false, `port ${SITE_PORT} stayed busy — headless Me check skipped`); }
    else {
      const require = createRequire(import.meta.url);
      const { chromium } = require('playwright-core');
      const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
      browser = await chromium.launch({ headless: true, executablePath: exe });
      const errors = [];
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: 'light' });
      await ctx.addInitScript(api => { try { localStorage.setItem('hub.api', JSON.stringify(api)); } catch {} }, API);
      const page = await ctx.newPage();
      page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource.*(401|403|404|409|429)/.test(m.text())) errors.push(m.text()); });
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(SITE + '/index.html'); await page.waitForSelector('#paircode');
      await page.fill('#paircode', CODE); await page.click('#pairform button[type=submit]'); await page.waitForSelector('.pcard[data-id]');
      await page.click('.pcard[data-id=eli]'); await page.waitForSelector('#pad'); await sleep(450);
      for (const d of PINS.eli) await page.click(`#pad [data-d="${d}"]`); await page.click('#pingo');
      await page.waitForSelector('#shell:not([hidden])', { timeout: 15000 });
      await page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 });
      await page.click('.tab[data-tab=me]'); await page.waitForSelector('#notif-prefs', { state: 'attached' });
      const prefs = await page.$$eval('#notif-prefs [data-pref]', els => els.map(e => ({ pref: e.dataset.pref, on: e.getAttribute('aria-checked'), label: e.closest('.kv').querySelector('b').textContent, role: e.getAttribute('role') })));
      const byPref = Object.fromEntries(prefs.map(p => [p.pref, p]));
      ok(byPref.behind && byPref.prayer && byPref.park, 'switches for behind, prayer and park are in the card', prefs);
      ok(byPref.behind && /Weekly catch-up, Sunday 8 pm/.test(byPref.behind.label) && byPref.prayer && /New family prayers/.test(byPref.prayer.label) && byPref.park && /Park day/.test(byPref.park.label), 'plain labels', prefs);
      ok(byPref.behind.on === 'false' && byPref.prayer.on === 'true' && byPref.park.on === 'true', 'switches reflect push_prefs (behind off from the API, the others default on)', prefs);
      // the prefs panel only unhides once this device holds a push subscription (https + service worker); reveal it so the
      // switches can be tapped and photographed on plain http
      await page.evaluate(() => { document.getElementById('notif-prefs').hidden = false; });
      const sizes = await page.$$eval('#notif-prefs [data-pref]', els => els.map(e => e.getBoundingClientRect()).map(r => [r.width, r.height]));
      ok(sizes.every(([w, h]) => w >= 44 && h >= 28), 'switches are touch-sized (≥ 44 px wide)', sizes);
      await page.click('#notif-prefs [data-pref=prayer]'); await page.click('#notif-prefs [data-pref=behind]');
      ok(await page.$eval('#notif-prefs [data-pref=prayer]', e => e.getAttribute('aria-checked')) === 'false', 'tapping "New family prayers" flips it off');
      await waitFor(() => page.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'flush' });
      const row = await api('GET', '/api/data/hub?scope=person&key=push_prefs', undefined, 'eli');
      const v = row.body.item && row.body.item.value;
      ok(v && v.prayer === false && v.behind === true && v.park !== false, 'push_prefs on the server: prayer off, behind back on, park untouched', row.body);
      await page.evaluate(() => document.getElementById('notif').scrollIntoView());
      fs.mkdirSync(path.join(ROOT, 'docs/screens'), { recursive: true });
      await page.screenshot({ path: path.join(ROOT, 'docs/screens/rm15-me-notifications.png') });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.evaluate(() => document.getElementById('notif').scrollIntoView());
      await page.screenshot({ path: path.join(ROOT, 'docs/screens/rm15-me-notifications-desktop.png') });

      console.log('\n## prayer app: a prayer typed straight into the family list names its author (headless)');
      // Eli opens the prayer app, switches to the Family list, types a request into the add form and taps "Add to the list".
      // That path writes no activity line, so the row itself must say who added it.
      await page.setViewportSize({ width: 390, height: 844 });
      const typed = 'Typed straight into the family list ' + Date.now().toString(36);
      await page.goto(SITE + '/apps/prayer.html');
      await page.waitForFunction(() => window.hub && hub.profile && hub.profile.id === 'eli' && document.querySelector('#s-today.on'), null, { timeout: 15000 });
      await page.click('[data-list=shared]');
      await page.waitForFunction(() => document.querySelector('[data-list=shared]').getAttribute('aria-pressed') === 'true');
      await page.click('nav [data-go=add]'); await page.waitForSelector('#s-add.on');
      await page.fill('#f-title', typed); await page.click('#f-save');
      await page.waitForSelector('#s-today.on');
      await waitFor(() => page.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'prayer flush' });
      const fam = await api('GET', '/api/data/prayer?scope=family&prefix=prayer:', undefined, 'eli');
      const typedRow = (fam.body.items || []).find(i => i.value && i.value.title === typed);
      ok(typedRow && typedRow.value.by === 'eli', 'the family row the app wrote carries by:eli', typedRow);
      const acts = await api('GET', '/api/activity?limit=50', undefined, 'eli');
      const actLines = (acts.body.items || acts.body.activity || []).map(a => a.text || '');
      ok(!actLines.some(t => t.includes(typed)), 'no activity line was written for it (the row is the only trace of the author)', actLines.slice(0, 5));
      const before = pushesFor('eli', 'prayer').length;
      const pr = await run('prayer');
      ok(pr.body.new.length === 1 && pr.body.new[0].title === typed && pr.body.new[0].by === 'eli', 'prayer job: the typed prayer is new and its author is Eli', pr.body.new);
      ok(pr.body.skipped.some(x => x.profile === 'eli' && x.why === 'author') && !pr.body.notified.some(n => n.profile === 'eli'), 'Eli is left out as the author', pr.body);
      await sleep(400);
      ok(pushesFor('eli', 'prayer').length === before, 'receiver: no push to Eli about his own typed prayer', pushesFor('eli', 'prayer'));
      // (Mae and mom are not pushed here only because of the once-a-day gate / pref: proved above with fresh recipients.)
      ok(pr.body.skipped.some(x => x.profile === 'christian' && x.why === 'already_today'), 'Mae would have been told (skipped only by the once-a-day gate)', pr.body.skipped);
      await page.screenshot({ path: path.join(ROOT, 'docs/screens/rm15-prayer-family-add-390.png') });
      await page.goto(SITE + '/index.html'); await page.waitForSelector('#shell:not([hidden])', { timeout: 15000 });
      await page.click('.tab[data-tab=me]'); await page.waitForSelector('#notif-prefs', { state: 'attached' });
      // a kid never sees the adult switches
      await page.setViewportSize({ width: 390, height: 844 });
      await page.click('#switch'); await page.waitForSelector('.pcard[data-id]'); await page.click('.pcard[data-id=ezra]');
      await page.waitForSelector('#shell:not([hidden])', { timeout: 15000 });
      await page.click('.tab[data-tab=me]'); await page.waitForSelector('#notif-prefs', { state: 'attached' });
      const kidPrefs = await page.$$eval('#notif-prefs [data-pref]', els => els.map(e => e.dataset.pref));
      ok(!kidPrefs.some(p => ['behind', 'prayer', 'park'].includes(p)), 'Ezra (kid) has none of the three adult switches', kidPrefs);
      ok(errors.length === 0, 'no console errors', errors);
    }
  } catch (e) { fail++; console.log('  ✗ crashed:', e.stack || e); }
  finally {
    if (browser) await browser.close().catch(() => {});
    if (site) site.close();
    receiver.kill();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
