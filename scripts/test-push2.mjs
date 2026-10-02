#!/usr/bin/env node
// Roadmap 15 checks: push round 2. Three reminder kinds — "behind" (F260 weekly catch-up), "prayer" (new family-list
// prayer → adults except the author) and "park" (a kid's map marker went quiet; its full rules: scripts/test-park.mjs) — each forced through
// POST /api/admin/cron/run as the admin, delivered to the stand-in receiver (scripts/push-receiver.mjs) and asserted
// on the decrypted payload; opt-outs (push_prefs.<kind> = false) and the per-kind memory are checked too (behind: once a
// day; prayer: each adult is told each new family prayer once — batch 2b, P2-PWA-04 — and a title edit is not new,
// P3-PRAYER-25; park: each quiet spell once per adult, P2-PWA-02; guests never get these, PWA-UX-2). Then, headless,
// the three switches in Me → Notifications exist for an adult and persist in app_data(person, hub, push_prefs), and the
// prayer app's own add form (family list active, no activity line) writes by:<id> on the row so the author is left out.
// Batch 5 (IMP-VERSES-I2) adds the evening verse review: off until push_pref:verses is on, the due count from the F260 rows,
// due > 0 only, once a day, never a kid; and its switch in Me.
// Batch 6 (PWA-GAP-1) adds "Timer done": a timer:<id> row that ended in the last 10 minutes → its owner, once per start, the
// label only, on unless push_pref:timer is off, never a kid; the 10-minute rule clears older rows; and its switch in Me.
// (The minute trigger itself, the retry and the pruning: audits/tools/phase6/6/cron-check-6.mjs.)
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
    { const r = await api('POST', '/api/login', { profile_id: 'kiara' }); tokens.kiara = r.body.profile_token; ok(r.status === 200, 'Kiara (kid) signed in'); }
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
    // editing the wording is not a new request (P3-PRAYER-25)
    await put('christian', 'prayer', 'family', 'prayer:s001', { ...prayer, title: "Grandma's hip surgery", prayedBy: { eli: nyDate(new Date()) }, updatedAt: new Date().toISOString() });
    r = await run('prayer');
    ok(r.body.new.length === 0 && r.body.notified.length === 0, 'editing the title of a family request does not announce it again', r.body);
    // a kid's private prayer (person scope) never counts
    await put('ezra', 'prayer', 'person', 'prayer:p001', { ...prayer, id: 'p001', title: 'My hamster' });
    r = await run('prayer');
    ok(r.body.new.length === 0, 'person-scope prayers are ignored', r.body);
    // Key re-use: an older prayer app handed out 'p' + (count + 1), so deleting the newest family prayer and adding another
    // landed on the SAME prayer:<id> row (a tombstone that putOne updates in place, same app_data.id). A different request
    // (its own id) under that key must still be announced. Eli adds p003 → Mae hears; Eli deletes it and a different
    // request lands under prayer:p003 → announced again, to Mae too (no once-a-day gate since batch 2b, P2-PWA-04) and to
    // mom, who turns the pref back on.
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
    await put('eli', 'prayer', 'family', 'prayer:p003', { ...p003, id: 'p003b', title: 'Totally different new prayer', updatedAt: new Date().toISOString() });
    await put('mom', 'hub', 'person', 'push_prefs', { behind: false, prayer: true, park: false });   // mom turns prayer back on
    r = await run('prayer');
    ok(r.body.new.length === 1 && r.body.new[0].title === 'Totally different new prayer' && r.body.new[0].by === 'eli', 'a different prayer re-using the key prayer:p003 is announced as new', r.body.new);
    ok(r.body.notified.map(n => n.profile).sort().join(',') === 'christian,mom' && r.body.skipped.some(s => s.profile === 'eli' && s.why === 'author'), 'Mae and mom notified (a second new prayer the same day still reaches Mae); Eli author', r.body);
    await waitFor(() => pushesFor('mom', 'prayer').length, { label: 'mom prayer push' });
    ok(pushesFor('mom', 'prayer')[0].payload.body === 'New on the family list: Totally different new prayer.', 'mom\'s decrypted payload names the re-created prayer', pushesFor('mom', 'prayer')[0]);
    r = await run('prayer');
    ok(r.body.new.length === 0 && r.body.notified.length === 0, 'next run: the re-created prayer is not announced twice', r.body);
    // a deleted prayer that stays deleted is not "new" either
    await api('DELETE', '/api/data/prayer/prayer:p003?scope=family', { updated_at: Date.now() }, 'eli');
    r = await run('prayer');
    ok(r.body.new.length === 0, 'a plain delete announces nothing', r.body);

    console.log('\n## park: judged by the house\'s clock (the full rules are in scripts/test-park.mjs, in process)');
    const now = Date.now();
    const loc = (name, emoji, minAgo) => ({ x: 1200, y: 800, acc: 12, hdg: null, t: now - minAgo * 60000, name, emoji, color: '#137F77' });
    await put('eli', 'dollywood-live', 'family', 'loc:eli', loc('Eli', '🧭', 1));
    // since batch 0d a kid's own device publishes the kid's dot, and only while a household adult has the beacon on
    { const r = await put('eli', 'dollywood-live', 'family', 'kidshare:ezra', true); ok(r.status === 200, "Eli switches Ezra's beacon on", r.body); }
    { const r = await put('ezra', 'dollywood-live', 'family', 'loc:ezra', loc('Ezra', '🦖', 35)); ok(r.status === 200, "Ezra's phone publishes his dot, its clock 35 min slow", r.body); }
    r = await run('park');
    ok(r.status === 200 && r.body.parkDay === true && r.body.stale.length === 0 && r.body.notified.length === 0, "a dot the house has just heard from is not quiet, whatever the phone's clock says (review of batch 2b)", r.body);

    console.log('\n## pref flips');
    // Eli turns behind off, mom stays off; a brand-new person (dad) with the default prefs and no subscription is not in notified
    await put('eli', 'hub', 'person', 'push_prefs', { behind: false });
    await put('eli', 'f260', 'person', 'f260.weekStart', { 3: daysAgo(6) });
    r = await run('behind');
    ok(r.body.notified.length === 0 && r.body.skipped.some(s => s.profile === 'eli' && s.why === 'pref_off'), 'behind pref off: Eli skipped as pref_off (not just already_today)', r.body.skipped);
    const usage = await api('GET', '/api/admin/usage', undefined, 'eli');
    const sends = (usage.body.push || []).map(p => `${p.profile_id}:${p.kind}`).sort();
    ok(sends.join(' ') === 'christian:prayer eli:behind eli:prayer mom:prayer', 'push_log matches: eli behind/prayer, christian prayer, mom prayer', sends);
    const perKind = pushes.filter(p => p.payload).map(p => p.url + ' ' + p.payload.tag).sort();
    ok(perKind.length === 5 && !pushes.some(p => p.error), 'receiver saw exactly 5 pushes, all decrypted + VAPID valid', perKind);

    console.log('\n## the reading nudge at each person\'s own time (batch 4, IMP-F260-F4; the clock rules: audits/tools/phase6/4/cron-check-4.mjs)');
    { const r = await put('christian', 'hub', 'person', 'push_pref:readAt', '06:30'); ok(r.status === 200, 'Mae picks 6:30 am for her reading nudge (push_pref:readAt)', r.body); }
    r = await run('evening');
    const at = Object.fromEntries((r.body.checked || []).map(c => [c.profile, c.at]));
    ok(r.status === 200 && at.christian === '06:30' && at.eli === '20:00', 'the evening job reads each person\'s time: Mae 06:30, Eli unset = 20:00', r.body.checked);
    ok(['eli', 'christian'].every(p => r.body.notified.some(n => n.profile === p)), 'forced from Admin it ignores the times: Eli and Mae (nothing read today) are nudged now', r.body.notified.map(n => n.profile));
    await sleep(400);
    ok(['eli', 'christian'].every(p => pushesFor(p, 'f260').length === 1), 'receiver: one reading nudge each (tag f260)', ['eli', 'christian'].map(p => pushesFor(p, 'f260').length));
    r = await run('evening');
    ok(!r.body.notified.length && r.body.skipped.some(s => s.profile === 'christian' && s.why === 'already_today'), 'a second run the same day: already_today, nobody nudged twice', r.body.skipped);

    console.log('\n## the evening verse review (batch 5, IMP-VERSES-I2; its 7 pm hour: audits/tools/phase6/5/cron-check-5.mjs)');
    // Eli: three memorised verses, two due (one overdue since yesterday, one never reviewed), one due in 3 days. Mae: one,
    // due in 2 days. Mom: two never reviewed, but the switch starts off. Ezra (a kid): a due recall row and the switch on.
    for (const [pid, key, value] of [
      ['eli', 'mem:1-0', true], ['eli', 'mem:1-1', true], ['eli', 'mem:2-0', true],
      ['eli', 'recall:1-0', { s: 'got', t: Date.now(), box: 2, due: daysAgo(1), last: daysAgo(3), streak: 1 }],
      ['eli', 'recall:1-1', { s: 'got', t: Date.now(), box: 3, due: daysAgo(-3), last: daysAgo(1), streak: 2 }],
      ['christian', 'mem:3-0', true], ['christian', 'recall:3-0', { s: 'got', t: Date.now(), box: 2, due: daysAgo(-2), last: daysAgo(0), streak: 1 }],
      ['mom', 'mem:4-0', true], ['mom', 'mem:4-1', true],
    ]) { const w = await put(pid, 'f260', 'person', key, value); if (w.status !== 200) ok(false, `seed ${pid} ${key}`, w.body); }
    { const w = await put('ezra', 'f260', 'person', 'recall:5-0', { s: 'not', t: Date.now(), box: 1, due: daysAgo(1), last: daysAgo(2), streak: 0 }); ok(w.status === 200, 'Ezra (kid) has a recall row due (Verses writes it in his F260 scope)', w.body); }
    { const w = await put('ezra', 'hub', 'person', 'push_pref:verses', true); ok(w.status === 200, 'Ezra\'s own push_pref:verses row is on', w.body); }
    r = await run('verses');
    const offFor = new Set((r.body.skipped || []).filter(s => s.why === 'pref_off').map(s => s.profile));
    ok(r.status === 200 && r.body.job === 'verses' && !r.body.notified.length && ['eli', 'christian', 'mom'].every(p => offFor.has(p)), 'the switch starts off: nobody is told until they turn it on (eli, Mae, mom: pref_off)', r.body);
    const noKid = b => !JSON.stringify([b.checked, b.notified, b.skipped]).includes('"ezra"') && !JSON.stringify([b.checked, b.notified, b.skipped]).includes('"kiara"');
    ok(noKid(r.body), 'kids are never considered (Ezra\'s switch row is on, and he has a verse due)', r.body);
    await put('eli', 'hub', 'person', 'push_pref:verses', true);
    await put('christian', 'hub', 'person', 'push_pref:verses', true);
    r = await run('verses');
    const vChk = Object.fromEntries((r.body.checked || []).map(c => [c.profile, c.due]));
    ok(vChk.eli === 2 && vChk.christian === 0 && !('mom' in vChk), 'the due count is the house\'s own, from the F260 rows: Eli 2, Mae 0 (mom not counted: switch off)', r.body.checked);
    ok(r.body.notified.map(n => n.profile).join() === 'eli' && r.body.skipped.some(s => s.profile === 'christian' && s.why === 'nothing_due') && r.body.skipped.some(s => s.profile === 'mom' && s.why === 'pref_off') && noKid(r.body), 'only Eli is told (due > 0); Mae has nothing due; mom has the switch off; no kid', r.body);
    await waitFor(() => pushesFor('eli', 'verses').length, { label: 'verses push' });
    { const vp = pushesFor('eli', 'verses')[0]; ok(vp.payload.title === 'Verses' && vp.payload.body === '2 verses to review today.' && vp.payload.url === '#verses' && vp.vapid === 'valid', 'decrypted payload: "2 verses to review today." opening Verses', vp); }
    r = await run('verses');
    ok(!r.body.notified.length && r.body.skipped.some(s => s.profile === 'eli' && s.why === 'already_today'), 'a second run the same day: already_today, once a day', r.body.skipped);
    await sleep(300);
    ok(pushesFor('eli', 'verses').length === 1 && !pushesFor('christian', 'verses').length && !pushesFor('mom', 'verses').length && !pushes.some(p => p.url === '/push/ezra'), 'receiver: exactly one verse review push, to Eli; none to a kid', pushes.filter(p => p.payload && p.payload.tag === 'verses').map(p => p.url));

    console.log('\n## Timer done (batch 6, PWA-GAP-1): the timer job, forced');
    {
      const now = Date.now(), row = (id, o) => ({ id, label: '', total: 60000, startedAt: now - 120000, endAt: now - 60000, pausedAt: null, remaining: null, by: null, ackAt: null, ...o });
      await put('eli', 'timer', 'person', 'timer:p6', row('p6', { label: 'Pasta', total: 720000, startedAt: now - 780000, by: 'eli' }));
      await put('eli', 'timer', 'person', 'timer:o6', row('o6', { label: 'Oven', endAt: now + 600000, by: 'eli' }));                         // still running
      await put('eli', 'timer', 'person', 'timer:old6', row('old6', { label: 'Old', startedAt: now - 15 * 60000, endAt: now - 12 * 60000, by: 'eli' }));   // ended 12 min ago
      await put('christian', 'timer', 'person', 'timer:t6', row('t6', { label: 'Tea', by: 'christian' }));
      await put('christian', 'hub', 'person', 'push_pref:timer', false);                                                               // Mae turned it off
      await put('ezra', 'timer', 'person', 'timer:e6', row('e6', { label: 'Egg', by: 'ezra' }));
      r = await run('timer');
      ok(r.status === 200 && r.body.job === 'timer', 'POST /api/admin/cron/run {job: "timer"}', r.body);
      const dueKeys = (r.body.due || []).map(d => d.profile + ' ' + d.key).sort().join(', ');
      ok(dueKeys === 'christian timer:t6, eli timer:p6, ezra timer:e6', 'due: the three timers that ended in the last 10 minutes (not the running oven, not the one 12 minutes old)', r.body.due);
      ok(r.body.notified.map(n => n.profile).join() === 'eli' && r.body.skipped.some(x => x.profile === 'christian' && x.why === 'pref_off') && r.body.skipped.some(x => x.profile === 'ezra' && x.why === 'no_push_for_kind'), 'told: Eli; Mae has the switch off; Ezra is a kid', r.body);
      ok((r.body.cleared || []).some(c => c.profile === 'eli' && c.key === 'timer:old6'), 'the 10-minute rule cleared the old one', r.body.cleared);
      await waitFor(() => pushes.filter(x => x.url === '/push/eli' && x.payload && /^timer-p6-\d+$/.test(x.payload.tag || '')).length, { label: 'timer push' });
      { const tp = pushes.filter(x => x.url === '/push/eli' && x.payload && /^timer-p6-\d+$/.test(x.payload.tag || ''))[0]; ok(tp.payload.title === 'Timer done: Pasta' && tp.payload.body === 'Pasta is up.' && tp.payload.url === '#timer' && tp.payload.to === 'eli' && tp.vapid === 'valid' && tp.urgency === 'high', 'decrypted payload: "Timer done: Pasta", "Pasta is up.", opening the Timer, urgency high', tp); }
      r = await run('timer');
      ok(!r.body.notified.length && !(r.body.due || []).length, 'a second run: nobody twice (each timer start once)', r.body);
      await sleep(300);
      ok(pushes.filter(p => p.payload && /^timer-/.test(p.payload.tag || '')).length === 1 && !pushes.some(p => p.url === '/push/ezra'), 'receiver: exactly one Timer done push, none to a kid', pushes.filter(p => p.payload && /^timer-/.test(p.payload.tag || '')).map(p => p.url));
      for (const [pid, k] of [['eli', 'timer:p6'], ['eli', 'timer:o6'], ['christian', 'timer:t6'], ['ezra', 'timer:e6']]) await put(pid, 'timer', 'person', k, null);
    }

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
      // since the review of batch 2b one row per switch (push_pref:<kind>) over the old push_prefs row
      const rows = (await api('GET', '/api/data/hub?scope=person&prefix=push_pref:', undefined, 'eli')).body.items || [];
      const v = Object.fromEntries(rows.filter(r => r.value !== null).map(r => [r.key.slice('push_pref:'.length), r.value]));
      ok(v.prayer === false && v.behind === true && !('park' in v), 'switch rows on the server: push_pref:prayer off, push_pref:behind back on, park untouched', rows);
      // IMP-F260-F4: the reading nudge has a time under its switch; unset it reads 8:00 pm, and a choice is one row
      const rd = await page.$eval('#notif-read', e => ({ v: e.value, n: e.options.length, label: e.closest('.kv').querySelector('b').textContent, h: e.getBoundingClientRect().height }));
      ok(rd.v === '20:00' && rd.n === 36 && /Reading nudge time/.test(rd.label) && rd.h >= 44, 'Me: "Reading nudge time" reads 8:00 pm for Eli (unset), 36 half hours, a 44 px control', rd);
      await page.selectOption('#notif-read', '07:00');
      await waitFor(() => page.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'flush readAt' });
      { const r = (await api('GET', '/api/data/hub?scope=person&prefix=push_pref:readAt', undefined, 'eli')).body.items || []; ok(r.length === 1 && r[0].value === '07:00', 'the choice is the row push_pref:readAt = "07:00"', r); }
      await page.click('#notif-prefs [data-pref=f260]');
      ok(await page.$eval('#notif-read', e => e.disabled), 'the time is greyed while the reading nudge is off');
      await page.click('#notif-prefs [data-pref=f260]');
      ok(!(await page.$eval('#notif-read', e => e.disabled)), 'and back when it is on again');
      // IMP-VERSES-I2: the evening verse review has its own switch, which shows the row (on for Eli since the API turned it on)
      { const vs = await page.$eval('#notif-prefs [data-pref=verses]', e => ({ on: e.getAttribute('aria-checked'), label: e.closest('.kv').querySelector('b').textContent }));
        ok(vs.on === 'true' && /Verses to review, 7 pm/.test(vs.label), 'Me: "Verses to review, 7 pm" switch reflects push_pref:verses (on)', vs); }
      await page.click('#notif-prefs [data-pref=verses]');
      await waitFor(() => page.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'flush verses' });
      { const r = (await api('GET', '/api/data/hub?scope=person&prefix=push_pref:verses', undefined, 'eli')).body.items || []; ok(r.length === 1 && r[0].value === false, 'tapping it off writes push_pref:verses = false', r); }
      // batch 6 (PWA-GAP-1): "Timer done" is on with no row; tapping it writes push_pref:timer = false
      { const tm = await page.$eval('#notif-prefs [data-pref=timer]', e => ({ on: e.getAttribute('aria-checked'), label: e.closest('.kv').querySelector('b').textContent })).catch(() => null);
        ok(tm && tm.on === 'true' && /Timer done/.test(tm.label), 'Me: a "Timer done" switch, on by default', tm); }
      await page.click('#notif-prefs [data-pref=timer]');
      await waitFor(() => page.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'flush timer' });
      { const r = (await api('GET', '/api/data/hub?scope=person&prefix=push_pref:timer', undefined, 'eli')).body.items || []; ok(r.length === 1 && r[0].value === false, 'tapping it off writes push_pref:timer = false', r); }
      await page.click('#notif-prefs [data-pref=timer]');
      await waitFor(() => page.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'flush timer on' });
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
      // Mae is told although she had prayer pushes earlier today (batch 2b, P2-PWA-04); mom has the switch off by now
      ok(pr.body.notified.some(x => x.profile === 'christian'), 'Mae is told about the typed prayer (no once-a-day gate)', pr.body);
      await page.screenshot({ path: path.join(ROOT, 'docs/screens/rm15-prayer-family-add-390.png') });
      await page.goto(SITE + '/index.html'); await page.waitForSelector('#shell:not([hidden])', { timeout: 15000 });
      await page.click('.tab[data-tab=me]'); await page.waitForSelector('#notif-prefs', { state: 'attached' });
      // a kid never sees the adult switches
      await page.setViewportSize({ width: 390, height: 844 });
      await page.click('#switch'); await page.waitForSelector('.pcard[data-id]'); await page.click('.pcard[data-id=ezra]');
      await page.waitForSelector('#shell:not([hidden])', { timeout: 15000 });
      await page.click('.tab[data-tab=me]'); await page.waitForSelector('#switch', { state: 'attached' });
      // since batch 2b (P2-PROF-16) a kid has no Notifications card at all, and the house refuses a kid's subscription
      const kidPrefs = await page.$$eval('#notif-prefs [data-pref]', els => els.map(e => e.dataset.pref));
      ok(!kidPrefs.length && !(await page.$('#notif')), 'Ezra (kid) has no Notifications card (none of the adult switches)', kidPrefs);
      { const r = await api('POST', '/api/push/subscribe', { subscription: subFor('ezra') }, 'ezra'); ok(r.status === 403 && r.body.error === 'no_push', 'the house refuses a kid\'s subscription (403 no_push)', r.body); }
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
