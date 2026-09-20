#!/usr/bin/env node
// Roadmap 20 checks: stars & badges (apps/kidverse.html "item 20" blocks, the Me tab's "Kids' rewards" card, CLAUDE.md rules).
//   (a) seed story days (family kidverse story:ezra) and a prayed day (family prayer row, prayedBy[today] has "Ezra"); Ezra opens
//       Kid Verse → each story/prayed day is credited exactly once (credited.story / credited.prayed), total = the sum, badges
//       appear once (badges[id] = today) with the calm confetti + a toast, and a second reconcile changes nothing
//   (b) Done ★ adds one more star; count = every source this week; person row and family mirror agree
//   (c) Eli: Home Kids card says "Ezra ★N · K badges · T to cash in"; Me → Kids' rewards → Cash in (confirm) → an append-only
//       family row ledger:ezra:<id> = {kind: cashin, date, amount: total, by: eli} — Eli never writes the stars rows — and Me shows ★0 at once
//   (d) Ezra reopens on another device → the app applies the ledger row once: total 0, payouts [{date, amount, by}], applied[key],
//       badges and credited intact, nothing re-credited
//   (e) Reset week as Eli → a ledger:ezra:<id> {kind: reset, days: [this week up to today]} row; Ezra's copy: count 0, days
//       cleared, this week's credited days marked 'reset', total reduced, the story days not credited again
//   (f) the TV board's stars pane reads the same rows
//   (g) the race the review found: with Kid Verse open, a parent's cash-in lands, the kid taps Done ★ 1.5 s later (before the
//       next pull) → the payout survives and the balance is 1 (6 − 5), on the mirror and on the kid's row after the next pull
//   (g2) the same race for Reset week: the parent resets, the kid taps Done ★ 1.5 s later → the reset takes only the stars earned
//       before it (earnedAt ≤ the row's at) and today's new ★ stays: balance 1, today lit, on the mirror and on the kid's row
//   (h) a guest (adult kind, is_guest) never sees the Kids' rewards card
//   cd worker && npx wrangler dev --port 8787     (seeded local D1; Eli PIN 1357)
//   node scripts/test-rewards.mjs <pairing-code>
// Serves the repo on :9020 and proxies /api to the Worker, so it never needs :8765.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CODE = process.argv[2] || 'local-test-code';
const ELI_PIN = '1357';
const API = process.env.HUB_API || 'http://127.0.0.1:8787';
const PORT = 9020;
const SITE = 'http://localhost:' + PORT;
const SHOTS = path.join(ROOT, 'docs', 'screens');
fs.mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    const chunks = [];
    req.on('data', c => chunks.push(c)).on('end', () => {
      const headers = { ...req.headers }; delete headers.host; delete headers.origin; delete headers.referer;
      const up = http.request(API + req.url, { method: req.method, headers }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
      up.on('error', () => { res.writeHead(502); res.end('proxy error'); });
      up.end(Buffer.concat(chunks));
    });
    return;
  }
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT);

let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, { timeout = 12000, every = 150, label = 'condition' } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { try { const v = await fn(); if (v) return v; } catch {} await sleep(every); }
  throw new Error('timeout waiting for ' + label);
}

// ── the API, for seeding and for checking what the app wrote ─────
let DEVICE = null;
async function api(p, { method = 'GET', body, profile } = {}) {
  const h = { 'Content-Type': 'application/json' };
  if (DEVICE) h['X-Device-Token'] = DEVICE;
  if (profile) h['X-Profile-Token'] = profile;
  const r = await fetch(API + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.message || r.statusText); e.status = r.status; e.error = j.error; throw e; }
  return j;
}
async function login(id, pin) {
  try { return (await api('/api/login', { method: 'POST', body: pin ? { profile_id: id, pin } : { profile_id: id } })).profile_token; }
  catch (e) { if (e.error === 'needs_pin_setup') return (await api(`/api/profiles/${id}/pin`, { method: 'POST', body: { pin } })).profile_token; throw e; }
}
const pad = n => String(n).padStart(2, '0');
const dayKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return dayKey(d); };
const isoWeek = d => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); return y + '-W' + pad(Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7)); };
const weekDays = () => { const d = new Date(), m = new Date(d.getFullYear(), d.getMonth(), d.getDate()); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return Array.from({ length: 7 }, (_, i) => { const x = new Date(m); x.setDate(m.getDate() + i); return dayKey(x); }); };
const TODAY = dayKey(new Date()), WEEK = isoWeek(new Date()), WK = new Set(weekDays()), RECENT = new Set(Array.from({ length: 14 }, (_, i) => daysAgo(i)));
const STORY_DAYS = Array.from({ length: 9 }, (_, i) => daysAgo(i));           // nine story days → "Ten stars" + "Story lover" on the first open
const row = async (tok, scope, key, app = 'kidverse') => (await api(`/api/data/${app}?scope=${scope}`, { profile: tok })).items.find(r => r.key === key);
let T = {}, PRAYED = new Set();
async function seed() {
  DEVICE = (await api('/api/pair', { method: 'POST', body: { code: CODE, name: 'test-rewards seeder' } })).device_token;
  T = { eli: await login('eli', ELI_PIN), ezra: await login('ezra'), kiara: await login('kiara'), tv: await login('tv') };
  const now = Date.now();
  // a clean slate for both kids (the local DB is shared with other suites)
  for (const k of ['ezra', 'kiara']) { await api('/api/data/kidverse/stars?scope=person', { method: 'DELETE', profile: T[k] }).catch(() => {}); await api('/api/data/kidverse/stars:' + k + '?scope=family', { method: 'DELETE', profile: T.eli }).catch(() => {}); }
  await clearLedger();
  await api('/api/data/kidverse/week?scope=family', { method: 'PUT', profile: T.eli, body: { value: { week: 3, by: 'test' }, updated_at: now } });
  const days = {}; for (const d of STORY_DAYS) days[d] = true;
  await api('/api/data/kidverse/story:ezra?scope=family', { method: 'PUT', profile: T.eli, body: { value: { days, week: 3 }, updated_at: now } });
  await api('/api/data/prayer/prayer:rm20-test?scope=family', { method: 'PUT', profile: T.eli, body: { value: { id: 'rm20-test', title: 'Grandma', text: 'Grandma', updates: [], prayedBy: { [TODAY]: ['Eli', 'Ezra'] }, by: 'eli', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, updated_at: now } });
  // every family prayer row that names Ezra in the last 14 days counts (other suites may have left some)
  for (const r of (await api('/api/data/prayer?scope=family', { profile: T.eli })).items) {
    const pb = r.value && r.value.prayedBy; if (!pb || typeof pb !== 'object') continue;
    for (const d of Object.keys(pb)) if (RECENT.has(d) && Array.isArray(pb[d]) && pb[d].includes('Ezra')) PRAYED.add(d);
  }
}
// leave no story / prayed / stars rows behind: other suites (test-kidverse) expect Ezra's ★ to be his only star of the day
async function cleanup() {
  try {
    await api('/api/data/kidverse/story:ezra?scope=family', { method: 'DELETE', profile: T.eli });
    await api('/api/data/prayer/prayer:rm20-test?scope=family', { method: 'DELETE', profile: T.eli });
    for (const k of ['ezra', 'kiara']) { await api('/api/data/kidverse/stars?scope=person', { method: 'DELETE', profile: T[k] }); await api('/api/data/kidverse/stars:' + k + '?scope=family', { method: 'DELETE', profile: T.eli }); }
    await clearLedger();
    console.log('  (cleaned up the seeded story, prayer, stars and ledger rows)');
  } catch (e) { console.log('  … cleanup skipped: ' + e.message); }
}
const ledger = async id => (await api('/api/data/kidverse?scope=family', { profile: T.eli })).items.filter(r => r.key.startsWith('ledger:' + id + ':') && r.value).sort((a, b) => (a.value.at || 0) - (b.value.at || 0));
async function clearLedger() { for (const k of ['ezra', 'kiara']) for (const r of await ledger(k)) await api('/api/data/kidverse/' + encodeURIComponent(r.key) + '?scope=family', { method: 'DELETE', profile: T.eli }).catch(() => {}); }
// the rules, as CLAUDE.md states them, computed independently of the app
function expected({ verse = 0, story = STORY_DAYS, prayed = [...PRAYED] } = {}) {
  const earned = story.length + prayed.length + verse;
  const count = story.filter(d => WK.has(d)).length + prayed.filter(d => WK.has(d)).length + verse;
  const badges = { first: earned >= 1, week: count >= 7, ten: earned >= 10, story: story.length >= 5, prayer: prayed.length >= 5, fifty: earned >= 50 };
  return { earned, count, badges: Object.keys(badges).filter(k => badges[k]).sort() };
}

// ── browser ──────────────────────────────────────────────────────
const errors = [];
async function newContext(browser, name, width = 390) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, deviceScaleFactor: 2, hasTouch: width < 700, isMobile: width < 700, colorScheme: 'light' });
  await ctx.addInitScript(api => { try { localStorage.setItem('hub.api', JSON.stringify(api)); } catch {} }, SITE);
  await ctx.addInitScript(() => { const fake = { speak(u) { setTimeout(() => { try { u.onend && u.onend({}); } catch {} }, 40); }, cancel() {}, pause() {}, resume() {}, get speaking() { return false; }, get pending() { return false; }, getVoices() { return []; }, addEventListener() {}, removeEventListener() {} }; try { Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true }); } catch {} });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(name + ': ' + m.text()); });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  await page.goto(SITE + '/index.html'); await page.waitForSelector('#paircode');
  await page.fill('#paircode', CODE); await page.click('#pairform button[type=submit]'); await page.waitForSelector('.pcard[data-id]');
  return { ctx, page };
}
const dialogs = [];
async function signIn(page, id, pin, retry = true) {
  try {
    await page.click(`.pcard[data-id=${id}]`);
    if (pin) { await page.waitForSelector('#pad'); await sleep(450); for (const d of pin) await page.click(`#pad [data-d="${d}"]`); await page.click('#pingo'); }
    await page.waitForSelector('#shell:not([hidden])', { timeout: 15000 });
    await page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 });
  } catch (e) {
    if (!retry) throw e;
    console.log('  … sign-in as ' + id + ' did not land (' + (await text(page, '#hub-toast') || e.message.split('\n')[0]) + '); the shared DB may have been reset — retrying once');
    try { DEVICE = (await api('/api/pair', { method: 'POST', body: { code: CODE, name: 'test-rewards seeder' } })).device_token; if (pin) await login(id, pin); } catch {}
    await page.goto(SITE + '/index.html');
    if (await page.$('#paircode')) { await page.fill('#paircode', CODE); await page.click('#pairform button[type=submit]'); }
    await page.waitForSelector('.pcard[data-id]');
    await signIn(page, id, pin, false);
  }
}
const text = (page, sel) => page.$eval(sel, e => e.textContent.trim().replace(/\s+/g, ' ')).catch(() => null);
async function appFrame(page) {
  const fr = await waitFor(() => page.frames().find(f => /apps\/kidverse\.html/.test(f.url())), { label: 'kidverse frame' });
  await fr.waitForFunction(() => window.kidverse && window.kidverse.rewards && document.getElementById('ref').textContent !== '…', null, { timeout: 15000 });
  await fr.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 });
  return fr;
}
const synced = fr => fr.waitForFunction(() => hub.sync.state === 'synced', null, { timeout: 15000 });
async function openKidverse(page) { await page.waitForSelector('.stars-card [data-open="kidverse"]'); await page.click('.stars-card [data-open="kidverse"]'); return appFrame(page); }
const credited = (v, kind) => Object.keys((v && v.credited && v.credited[kind]) || {}).filter(d => v.credited[kind][d] === true).sort();
const badgeIds = v => Object.keys((v && v.badges) || {}).filter(b => v.badges[b]).sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    console.log('\n## seed'); await seed();
    ok(PRAYED.has(TODAY), `seeded ${STORY_DAYS.length} story days and a prayed day for Ezra (prayed days in the window: ${[...PRAYED].sort().join(', ')})`);
    const md = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');
    ok(/\*\*Stars & badges\*\*/.test(md) && /First star/.test(md) && /Full week/.test(md) && /Ten stars/.test(md) && /Story lover/.test(md) && /Prayer warrior/.test(md) && /Fifty stars/.test(md) && /Cash in/.test(md) && /Reset week/.test(md) && /ledger:<kid>:<id>/.test(md) && /only writer/.test(md), 'CLAUDE.md states the rules: the three sources, the six badges, cash-in / reset, the ledger rows');
    const src = fs.readFileSync(path.join(ROOT, 'apps/kidverse.html'), 'utf8');
    ok(!/#[0-9a-f]{3,8}\b/i.test(src.slice(src.indexOf('<style>'), src.indexOf('</style>'))) && !/prefers-color-scheme/.test(src), 'no hex and no prefers-color-scheme in the app\'s CSS');

    console.log('\n## (a) Ezra opens Kid Verse: story + prayed days credited once, badges celebrated');
    const K = await newContext(browser, 'K');
    await signIn(K.page, 'ezra');
    const F = await openKidverse(K.page);
    await F.waitForFunction(() => !document.getElementById('rewards').hidden && document.getElementById('rw-total'), null, { timeout: 15000 });
    let toasted = false; try { await waitFor(() => F.$eval('#hub-toast', e => /New badge/.test(e.textContent)), { timeout: 3500, every: 60, label: 'badge toast' }); toasted = true; } catch {}
    await synced(F);
    const e0 = expected();
    let mine = await row(T.ezra, 'person', 'stars'), mirror = await row(T.eli, 'family', 'stars:ezra');
    ok(mine && same(credited(mine.value, 'story'), [...STORY_DAYS].sort()), 'credited.story has each seeded story day exactly once', JSON.stringify(mine && mine.value && mine.value.credited));
    ok(mine && same(credited(mine.value, 'prayed'), [...PRAYED].sort()), 'credited.prayed has each prayed day exactly once');
    ok(mine && mine.value.total === e0.earned && mine.value.earned === e0.earned, `total = earned = ${e0.earned} (story + prayed)`, JSON.stringify(mine && [mine.value.total, mine.value.earned]));
    ok(mine && mine.value.week === WEEK && mine.value.count === e0.count, `count = ${e0.count} for this week (${WEEK}); no verse day yet`, JSON.stringify(mine && [mine.value.week, mine.value.count, mine.value.days]));
    ok(mine && same(badgeIds(mine.value), e0.badges) && e0.badges.includes('first') && e0.badges.includes('ten') && e0.badges.includes('story') && Object.values(mine.value.badges).every(d => d === TODAY), `badges stored once, dated today: ${e0.badges.join(', ')}`, JSON.stringify(mine && mine.value.badges));
    ok(mirror && same(mirror.value, mine.value), 'the family mirror stars:ezra equals the person row');
    ok(await text(F, '#rw-total') === String(e0.earned) && (await text(F, '#rw-week') || '').startsWith(e0.count + ' this week'), 'the rewards card shows the balance and this week', await text(F, '#rw-bank'));
    const lit = await F.$$eval('#rw-badges li.on', l => l.map(e => e.dataset.badge).sort());
    ok(same(lit, e0.badges) && await F.$$eval('#rw-badges li', l => l.length) === 6, 'six badge tiles, the earned ones lit', JSON.stringify(lit));
    ok(await F.$$eval('#rw-badges li', l => l.every(e => e.getBoundingClientRect().height >= 64)), 'badge tiles are ≥ 64 px tall');
    ok(toasted, 'a "New badge" toast celebrated them');
    const feed = (await api('/api/activity?limit=40', { profile: T.eli })).activity || [];
    ok(feed.some(a => a.profile_id === 'ezra' && /earned the (First star|Ten stars|Story lover) badge/.test(a.text)), 'the feed has "Ezra earned the … badge"', JSON.stringify(feed.slice(0, 4).map(a => a.text)));
    const again = await F.evaluate(() => window.kidverse.rewards.reconcile());
    await F.evaluate(() => hub.pull()); await sleep(600); await synced(F);
    const mine1 = await row(T.ezra, 'person', 'stars');
    ok(again === false && mine1.value.total === e0.earned && same(badgeIds(mine1.value), e0.badges), 'a second reconcile (and another pull) credits nothing twice');
    ok(await F.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll at 390');
    await F.evaluate(() => document.getElementById('rewards').scrollIntoView({ block: 'center' })); await sleep(250);
    await K.page.screenshot({ path: path.join(SHOTS, 'rm20-kid-390.png') });

    console.log('\n## (b) Done ★ adds one more; count spans every source');
    await F.click('#done'); await sleep(200); await synced(F);
    const e1 = expected({ verse: 1 });
    mine = await row(T.ezra, 'person', 'stars'); mirror = await row(T.eli, 'family', 'stars:ezra');
    ok(mine.value.total === e1.earned && mine.value.earned === e1.earned && mine.value.days[TODAY] === true, `after ★: total ${e1.earned}, today lit`, JSON.stringify([mine.value.total, mine.value.days]));
    ok(mine.value.count === e1.count, `count = ${e1.count} = verse + story + prayed days this week`, mine.value.count);
    ok(same(badgeIds(mine.value), e1.badges), 'badges after ★: ' + e1.badges.join(', '), JSON.stringify(badgeIds(mine.value)));
    ok(same(mirror.value, mine.value), 'mirror still equals the person row');
    ok(await text(F, '#rw-total') === String(e1.earned) && await text(F, '#star-count') === String(e1.count), 'rewards card and the star count updated in place');
    await F.click('#done'); await sleep(150);
    ok((await row(T.ezra, 'person', 'stars')).value.total === e1.earned, 'a second ★ tap adds nothing');

    console.log('\n## (c) Eli: Home Kids card, then Me → Kids\' rewards → Cash in');
    const A = await newContext(browser, 'A', 1024);
    await signIn(A.page, 'eli', ELI_PIN);
    await A.page.waitForSelector('.kids-card .kids-line');
    const line = await text(A.page, '.kids-card .kids-line') || '';
    const bl = e1.badges.length + (e1.badges.length === 1 ? ' badge' : ' badges');
    ok(line.includes(`Ezra ★${e1.count} · ${bl}`), `adult Home: "Ezra ★${e1.count} · ${bl}"`, line);
    ok(new RegExp(`${e1.earned} to cash in`).test(await text(A.page, '.kids-card .gsub') || ''), 'and the balance to cash in on the card (Kiara starts at 0)', await text(A.page, '.kids-card .gsub'));
    await A.page.click('.tab[data-tab=me]');
    await A.page.waitForSelector('#rewards-body .reward-kid[data-kid=ezra]');
    const meLine = await text(A.page, '#rewards-body .reward-kid[data-kid=ezra]') || '';
    ok(new RegExp(`Ezra ★${e1.earned} to cash in · ${e1.count} this week`).test(meLine) && /badges:/.test(meLine), 'Me: Ezra\'s balance, week and badge names', meLine);
    ok(!!(await A.page.$('#rewards-body .reward-kid[data-kid=kiara] [data-cashin][disabled]')), 'Kiara (no stars): Cash in is disabled');
    const btn = await A.page.$eval('#rewards-body [data-cashin=ezra]', b => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, disabled: b.disabled }; });
    ok(btn.h >= 44 && btn.w >= 44 && !btn.disabled, 'Cash in is a ≥ 44 px enabled button', JSON.stringify(btn));
    await A.page.evaluate(() => document.getElementById('rewards').scrollIntoView({ block: 'center' })); await sleep(300);
    await A.page.screenshot({ path: path.join(SHOTS, 'rm20-me-1024.png') });
    await A.page.$eval('#rewards', e => e.scrollIntoView({ block: 'start' }));
    dialogs.length = 0;
    await A.page.click('#rewards-body [data-cashin=ezra]');
    ok(dialogs.length === 1 && /Cash in Ezra/.test(dialogs[0]), 'a confirm() asked first', JSON.stringify(dialogs));
    await A.page.waitForFunction(() => hub.sync.state === 'synced', null, { timeout: 15000 });
    const led1 = await ledger('ezra');
    ok(led1.length === 1 && led1[0].value.kind === 'cashin' && led1[0].value.date === TODAY && led1[0].value.amount === e1.earned && led1[0].value.by === 'eli' && led1[0].value.at > 0, `a ledger row ledger:ezra:<id> = {cashin, ${TODAY}, amount ${e1.earned}, by eli}`, JSON.stringify(led1.map(r => [r.key, r.value])));
    const mirrorC = await row(T.eli, 'family', 'stars:ezra');
    ok(mirrorC.updated_at === mirror.updated_at || (mirrorC.value.applied && mirrorC.value.applied[led1[0].key]), 'Eli never wrote the stars mirror (it is the kid\'s last write, or the kid\'s own device has already applied the ledger row)', JSON.stringify([mirrorC.updated_at, mirror.updated_at, mirrorC.value.applied]));
    ok(/★0 to cash in/.test(await text(A.page, '#rewards-body .reward-kid[data-kid=ezra]') || '') && !!(await A.page.$('#rewards-body [data-cashin=ezra][disabled]')), 'Me re-rendered at once: ★0, Cash in disabled (the mirror + the unapplied ledger row)');
    ok(/last cash-in \d+ on/.test(await text(A.page, '#rewards-body .reward-kid[data-kid=ezra]') || ''), 'and says when it was last cashed in');
    await A.page.click('.tab[data-tab=home]');
    await waitFor(() => A.page.$eval('.kids-card .gsub', e => !/to cash in/.test(e.textContent)), { label: 'Home card balance follows' });
    ok(true, 'Home Kids card no longer offers a balance to cash in');
    await A.page.click('.tab[data-tab=me]');
    const feed2 = (await api('/api/activity?limit=10', { profile: T.eli })).activity || [];
    ok(feed2.some(a => a.profile_id === 'eli' && /Cashed in Ezra's \d+ stars/.test(a.text)), 'the feed says Eli cashed in', JSON.stringify(feed2.slice(0, 3).map(a => a.text)));

    console.log('\n## (d) Ezra reopens on another device: the app applies the ledger row once');
    const K2 = await newContext(browser, 'K2');
    await signIn(K2.page, 'ezra');
    const F2 = await openKidverse(K2.page);
    await F2.waitForFunction(() => document.getElementById('rw-total') && document.getElementById('rw-total').textContent === '0', null, { timeout: 15000 });
    await synced(F2);
    mine = await row(T.ezra, 'person', 'stars');
    ok(mine.value.total === 0 && mine.value.payouts.length === 1 && mine.value.payouts[0].amount === e1.earned && mine.value.payouts[0].by === 'eli' && mine.value.applied && mine.value.applied[led1[0].key] === true && mine.value.rev === undefined, 'person row: total 0, the payout recorded once, applied[ledger key] = true, no rev', JSON.stringify([mine.value.total, mine.value.applied, mine.value.payouts]));
    ok(same((await row(T.eli, 'family', 'stars:ezra')).value, mine.value), 'the mirror equals the person row again');
    const twice = await F2.evaluate(() => window.kidverse.rewards.reconcile());
    ok(twice === false && (await row(T.ezra, 'person', 'stars')).value.payouts.length === 1, 'reconciling again applies nothing twice');
    ok(same(badgeIds(mine.value), e1.badges) && mine.value.earned === e1.earned && same(credited(mine.value, 'story'), [...STORY_DAYS].sort()) && same(credited(mine.value, 'prayed'), [...PRAYED].sort()), 'badges, earned and credited days intact — nothing re-credited');
    ok(mine.value.count === e1.count && mine.value.days[TODAY] === true, 'this week\'s stars still stand after a cash-in');
    ok(/Last cashed in: \d+ stars/.test(await text(F2, '#rw-paid') || '') && await F2.$$eval('#rw-badges li.on', l => l.length) === e1.badges.length, 'the card says when it was cashed in and keeps the badges lit', await text(F2, '#rw-paid'));
    // the first device's open copy follows too
    await F.evaluate(() => hub.pull());
    await waitFor(() => F.$eval('#rw-total', e => e.textContent === '0'), { label: 'first device follows the cash-in' });
    ok(true, 'the first device\'s open copy follows on its next pull');

    console.log('\n## (e) Reset week as Eli; Ezra follows without re-crediting');
    await A.page.click('.tab[data-tab=home]'); await A.page.click('.tab[data-tab=me]');
    await A.page.waitForSelector('#rewards-body [data-resetweek=ezra]:not([disabled])');
    dialogs.length = 0;
    await A.page.click('#rewards-body [data-resetweek=ezra]');
    ok(dialogs.length === 1 && /Reset Ezra/.test(dialogs[0]), 'a confirm() asked first');
    await A.page.waitForFunction(() => hub.sync.state === 'synced', null, { timeout: 15000 });
    const led2 = await ledger('ezra');
    const wkStory = STORY_DAYS.filter(d => WK.has(d));
    const soFar = weekDays().filter(d => d <= TODAY);
    ok(led2.length === 2 && led2[1].value.kind === 'reset' && led2[1].value.date === TODAY && same(led2[1].value.days, soFar) && led2[1].value.by === 'eli' && led2[1].value.at > 0, `a second ledger row {reset, date today, days: this week's ${soFar.length} dates up to today (never the days to come), by eli}`, JSON.stringify(led2.map(r => r.value)));
    ok(/★0 to cash in · 0 this week/.test(await text(A.page, '#rewards-body .reward-kid[data-kid=ezra]') || '') && !!(await A.page.$('#rewards-body [data-resetweek=ezra][disabled]')), 'Me shows 0 this week at once, Reset week disabled');
    await F2.evaluate(() => hub.pull());
    await waitFor(() => F2.$eval('#star-count', e => e.textContent === '0'), { label: 'kid copy follows the reset' });
    await sleep(500); await synced(F2);
    mine = await row(T.ezra, 'person', 'stars'); mirror = await row(T.eli, 'family', 'stars:ezra');
    ok(mine.value.count === 0 && Object.values(mine.value.days).every(v => v === 'reset') && mine.value.total === 0 && mine.value.applied[led2[1].key] === true, 'Ezra\'s row applied the reset: count 0, days marked reset (still spent), total 0, applied[key]', JSON.stringify([mine.value.count, mine.value.days, mine.value.total, mine.value.applied]));
    ok(mine.value.earnedAt && !mine.value.earnedAt['verse:' + TODAY] && Object.keys(mine.value.earnedAt).every(k => /^(verse|story|prayed):\d{4}-\d{2}-\d{2}$/.test(k) && mine.value.earnedAt[k] > 0), 'earnedAt stamps every credited star (source:date → ms) and the reset verse day\'s stamp is gone', JSON.stringify(mine.value.earnedAt));
    ok(wkStory.every(d => mine.value.credited.story[d] === 'reset') && STORY_DAYS.filter(d => !WK.has(d)).every(d => mine.value.credited.story[d] === true), 'this week\'s credited story days are marked reset; older ones keep their credit', JSON.stringify(mine.value.credited.story));
    ok(same(badgeIds(mine.value), e1.badges) && mine.value.earned === e1.earned && same(mirror.value, mine.value), 'badges and earned survive a reset; the mirror equals the person row');
    ok(await text(F2, '#done span') !== 'Done ★', 'Done ★ stays spent after the reset (one ★ a day)');
    await A.page.click('.tab[data-tab=home]');
    await waitFor(() => A.page.$eval('.kids-card .kids-line', e => /Ezra ★0/.test(e.textContent)), { label: 'Home Kids card follows' });
    ok(true, 'adult Home now says "Ezra ★0"');

    console.log('\n## (f) the TV board reads the same row');
    const TV = await newContext(browser, 'TV', 1440);
    await signIn(TV.page, 'tv');
    await TV.page.waitForSelector('#tv-stars');
    const tvStars = await text(TV.page, '#tv-stars') || '';
    ok(/Ezra\s*★0/.test(tvStars), 'TV stars pane: "Ezra ★0" from stars:ezra + the ledger', tvStars);
    for (const c of [K, K2]) await c.ctx.close();

    console.log('\n## (g) the race: a parent cashes in while Kid Verse is open, the kid taps ★ before the next pull');
    // a clean slate: Ezra banked 5 stars on earlier days (no verse today, no ledger rows)
    await api('/api/data/kidverse/story:ezra?scope=family', { method: 'DELETE', profile: T.eli });
    await api('/api/data/prayer/prayer:rm20-test?scope=family', { method: 'DELETE', profile: T.eli });
    await api('/api/data/kidverse/stars?scope=person', { method: 'DELETE', profile: T.ezra }); await api('/api/data/kidverse/stars:ezra?scope=family', { method: 'DELETE', profile: T.eli });
    await clearLedger();
    const seedRow = { week: WEEK, count: 0, days: {}, total: 5, earned: 5, credited: { story: {}, prayed: {} }, badges: { first: daysAgo(10) }, payouts: [], applied: {} };
    await api('/api/data/kidverse/stars?scope=person', { method: 'PUT', profile: T.ezra, body: { value: seedRow, updated_at: Date.now() } });
    await api('/api/data/kidverse/stars:ezra?scope=family', { method: 'PUT', profile: T.ezra, body: { value: seedRow, updated_at: Date.now() } });
    const K3 = await newContext(browser, 'K3');
    await signIn(K3.page, 'ezra');
    const F3 = await openKidverse(K3.page);
    await F3.waitForFunction(() => document.getElementById('rw-total') && Number(document.getElementById('rw-total').textContent) >= 5, null, { timeout: 15000 });
    await sleep(600); await synced(F3);
    const base = (await row(T.ezra, 'person', 'stars')).value; const baseTotal = base.total;
    ok(baseTotal >= 5 && (await text(F3, '#rw-total')) === String(baseTotal), `Kid Verse open as Ezra with ${baseTotal} stars banked`, JSON.stringify([baseTotal, base.count]));
    // the parent cashes in now — through Me on another device
    await A.page.evaluate(() => hub.pull()); await sleep(800);   // the parent's device catches up with the re-seeded rows and the cleared ledger
    await A.page.click('.tab[data-tab=home]'); await A.page.click('.tab[data-tab=me]');
    await waitFor(() => A.page.$eval('#rewards-body .reward-kid[data-kid=ezra] .reward-total', (e, t) => e.textContent === '★' + t, baseTotal), { label: 'Me sees the banked stars' });
    dialogs.length = 0;
    await A.page.click('#rewards-body [data-cashin=ezra]');
    await A.page.waitForFunction(() => hub.sync.state === 'synced', null, { timeout: 15000 });
    const led3 = await ledger('ezra');
    ok(dialogs.length === 1 && led3.length === 1 && led3[0].value.kind === 'cashin' && led3[0].value.amount === baseTotal, `Eli cashed in ${baseTotal} (a ledger row, not a mirror write)`, JSON.stringify(led3.map(r => r.value)));
    // the kid taps Done ★ 1.5 s later, before Kid Verse has pulled
    await sleep(1500);
    await F3.click('#done'); await sleep(300); await synced(F3); await sleep(400);
    const m3 = (await row(T.eli, 'family', 'stars:ezra')).value;
    const applied3 = !!(m3.applied && m3.applied[led3[0].key]);
    ok(applied3 ? m3.total === 1 && m3.payouts.length === 1 : m3.total === baseTotal + 1 && m3.days[TODAY] === true, 'the kid\'s star landed on the mirror' + (applied3 ? ' (the ledger row already applied there: total 1)' : ` (total ${baseTotal + 1}, the ledger row not applied yet)`), JSON.stringify([m3.total, m3.applied, m3.payouts]));
    ok((await ledger('ezra')).length === 1, 'the parent\'s cash-in row is still there — nothing overwrote it');
    await A.page.evaluate(() => hub.pull()); await sleep(600); await A.page.click('.tab[data-tab=home]');   // the parent's device sees the kid's stale mirror write + the ledger row
    const cnt3 = base.count + 1;   // whatever the app credited this week on open (other suites' prayer rows may name Ezra) + today's ★
    await waitFor(() => A.page.$eval('.kids-card .gsub', e => /1 to cash in/.test(e.textContent)), { label: 'Home shows 1 to cash in' });
    ok(new RegExp(cnt3 + ' star' + (cnt3 === 1 ? '' : 's') + ' this week · 1 to cash in').test(await text(A.page, '.kids-card .gsub') || '') && new RegExp('Ezra ★' + cnt3 + '\\b').test(await text(A.page, '.kids-card .kids-line') || ''), `adult Home: Ezra ★${cnt3} · ${cnt3} this week · 1 to cash in (${baseTotal + 1} − ${baseTotal}, computed from the mirror + the ledger)`, await text(A.page, '.kids-card .gsub'));
    // the kid's next pull applies the ledger row: balance 1, payout recorded, nothing lost
    await F3.evaluate(() => hub.pull());
    await waitFor(() => F3.$eval('#rw-total', e => e.textContent === '1'), { label: 'kid row applies the cash-in' });
    await sleep(400); await synced(F3);
    const p3 = (await row(T.ezra, 'person', 'stars')).value, m3b = (await row(T.eli, 'family', 'stars:ezra')).value;
    ok(p3.total === 1 && p3.earned === baseTotal + 1 && p3.days[TODAY] === true && p3.payouts.length === 1 && p3.payouts[0].amount === baseTotal && p3.applied[led3[0].key] === true, `Ezra's row after the pull: total 1, earned ${baseTotal + 1}, today's ★ kept, the payout recorded once`, JSON.stringify([p3.total, p3.earned, p3.payouts, p3.applied]));
    ok(same(m3b, p3), 'and the mirror equals it');
    ok(new RegExp('Last cashed in: ' + baseTotal + ' stars').test(await text(F3, '#rw-paid') || ''), 'the kid\'s card says it was cashed in', await text(F3, '#rw-paid'));
    await K3.ctx.close();

    console.log('\n## (g2) the race, for Reset week: the parent resets while Kid Verse is open, the kid taps ★ before the next pull');
    // a clean slate: Ezra has 2 banked, both earned this week (a story and a prayed day credited today, stamped an hour ago), no verse today
    await api('/api/data/kidverse/stars?scope=person', { method: 'DELETE', profile: T.ezra }); await api('/api/data/kidverse/stars:ezra?scope=family', { method: 'DELETE', profile: T.eli });
    await clearLedger();
    const ago = Date.now() - 3600e3;
    const seedR = { week: WEEK, count: 2, days: {}, total: 2, earned: 2, credited: { story: { [TODAY]: true }, prayed: { [TODAY]: true } }, badges: { first: daysAgo(10) }, payouts: [], applied: {}, earnedAt: { ['story:' + TODAY]: ago, ['prayed:' + TODAY]: ago } };
    await api('/api/data/kidverse/stars?scope=person', { method: 'PUT', profile: T.ezra, body: { value: seedR, updated_at: Date.now() } });
    await api('/api/data/kidverse/stars:ezra?scope=family', { method: 'PUT', profile: T.ezra, body: { value: seedR, updated_at: Date.now() } });
    const K4 = await newContext(browser, 'K4');
    await signIn(K4.page, 'ezra');
    const F4 = await openKidverse(K4.page);
    await F4.waitForFunction(() => document.getElementById('rw-total') && Number(document.getElementById('rw-total').textContent) >= 2, null, { timeout: 15000 });
    await sleep(600); await synced(F4);
    const base4 = (await row(T.ezra, 'person', 'stars')).value;   // other suites' prayer rows may have credited more prayed days on open
    const want4 = base4.total - base4.count + 1;                   // what stays after the reset: anything banked outside this week + today's new ★
    ok(base4.total >= 2 && base4.count >= 2 && !base4.days[TODAY] && (await text(F4, '#done span')) === 'Done ★', `Kid Verse open as Ezra: ${base4.total} banked, ${base4.count} this week, no verse ★ today`, JSON.stringify([base4.total, base4.count, base4.days]));
    await A.page.evaluate(() => hub.pull()); await sleep(800);
    await A.page.click('.tab[data-tab=home]'); await A.page.click('.tab[data-tab=me]');
    await waitFor(() => A.page.$eval('#rewards-body .reward-kid[data-kid=ezra] .reward-total', (e, t) => e.textContent === '★' + t, base4.total), { label: 'Me sees the banked stars' });
    dialogs.length = 0;
    await A.page.click('#rewards-body [data-resetweek=ezra]');
    await A.page.waitForFunction(() => hub.sync.state === 'synced', null, { timeout: 15000 });
    const led4 = await ledger('ezra');
    ok(dialogs.length === 1 && led4.length === 1 && led4[0].value.kind === 'reset' && led4[0].value.date === TODAY && same(led4[0].value.days, weekDays().filter(d => d <= TODAY)) && led4[0].value.at > 0, 'Eli reset the week (a ledger row listing only the days up to today)', JSON.stringify(led4.map(r => r.value)));
    // the kid taps Done ★ 1.5 s later, before Kid Verse has pulled
    await sleep(1500);
    await F4.click('#done'); await sleep(300); await synced(F4); await sleep(400);
    const m4 = (await row(T.eli, 'family', 'stars:ezra')).value;
    const applied4 = !!(m4.applied && m4.applied[led4[0].key]);
    ok(m4.days[TODAY] === true && m4.earnedAt['verse:' + TODAY] > led4[0].value.at && (applied4 ? m4.total === want4 : m4.total === base4.total + 1), 'the kid\'s star landed on the mirror, stamped after the reset' + (applied4 ? ` (the reset already applied there: total ${want4})` : ` (total ${base4.total + 1}, the reset not applied yet)`), JSON.stringify([m4.total, m4.days, m4.earnedAt, m4.applied]));
    ok((await ledger('ezra')).length === 1, 'the parent\'s reset row is still there — nothing overwrote it');
    await A.page.evaluate(() => hub.pull()); await sleep(600); await A.page.click('.tab[data-tab=home]');
    await waitFor(() => A.page.$eval('.kids-card .gsub', (e, w) => new RegExp(w + ' to cash in').test(e.textContent), want4), { label: 'Home shows ' + want4 + ' to cash in' });
    ok(/Ezra ★1\b/.test(await text(A.page, '.kids-card .kids-line') || '') && new RegExp('1 star this week · ' + want4 + ' to cash in').test(await text(A.page, '.kids-card .gsub') || ''), `adult Home: Ezra ★1 · 1 star this week · ${want4} to cash in (today's new ★ on top of the reset, from the mirror + the ledger)`, (await text(A.page, '.kids-card .kids-line')) + ' | ' + (await text(A.page, '.kids-card .gsub')));
    // the kid's next pull applies the reset: only the stars earned before it come off; today's ★ stays
    await F4.evaluate(() => hub.pull());
    await waitFor(() => F4.evaluate(k => { const v = hub.get('stars', { scope: 'person' }); return !!(v && v.applied && v.applied[k]); }, led4[0].key), { label: 'kid row applies the reset' });
    await sleep(400); await synced(F4);
    const p4 = (await row(T.ezra, 'person', 'stars')).value, m4b = (await row(T.eli, 'family', 'stars:ezra')).value;
    ok(p4.total === want4 && p4.count === 1 && p4.days[TODAY] === true && p4.earned === base4.earned + 1 && p4.applied[led4[0].key] === true, `Ezra's row after the pull: total ${want4}, count 1, today's ★ kept, earned ${base4.earned + 1}, the reset applied once`, JSON.stringify([p4.total, p4.count, p4.days, p4.earned, p4.applied]));
    ok(p4.credited.story[TODAY] === 'reset' && p4.credited.prayed[TODAY] === 'reset' && Object.keys(p4.credited.prayed).every(d => p4.credited.prayed[d] === 'reset' || !WK.has(d)), 'the story and prayed days credited before the reset are marked reset', JSON.stringify(p4.credited));
    ok(p4.earnedAt['verse:' + TODAY] > led4[0].value.at && p4.earnedAt['story:' + TODAY] > 0 && p4.earnedAt['story:' + TODAY] <= led4[0].value.at, 'today\'s ★ keeps its stamp; the reset story day\'s stamp is older than the reset', JSON.stringify([p4.earnedAt, led4[0].value.at]));
    ok(same(m4b, p4), 'and the mirror equals it');
    ok((await text(F4, '#done span')) === 'Done today ★' && (await text(F4, '#rw-total')) === String(want4) && (await text(F4, '#star-count')) === '1', `Kid Verse still says Done today ★, ${want4} to cash in, 1 this week`, [await text(F4, '#done span'), await text(F4, '#rw-total'), await text(F4, '#star-count')].join(' | '));
    ok((await F4.evaluate(() => window.kidverse.rewards.reconcile())) === false && (await row(T.ezra, 'person', 'stars')).value.total === want4, 'reconciling again changes nothing');
    await K4.ctx.close();

    console.log('\n## (h) a guest never sees the Kids\' rewards card');
    let guest = null;
    try { guest = (await api('/api/profiles', { method: 'POST', profile: T.eli, body: { name: 'Rm20 Guest', emoji: '🙂', color: '#5B6FA8', expires_at: null } })).profile; } catch (e) { console.log('  … guest profiles unavailable here (' + e.message + '); skipping'); }
    if (guest) {
      const G = await newContext(browser, 'G', 1024);
      await signIn(G.page, guest.id);
      await G.page.click('.tab[data-tab=me]'); await G.page.waitForSelector('#theme');
      ok(!(await G.page.$('#rewards')) && !(await G.page.$('#rewards-body')) && !(await G.page.$('#guests')), 'the guest\'s Me tab has no Kids\' rewards card (and no Guests card)');
      ok(!!(await G.page.$('#theme')), 'the rest of Me renders for the guest');
      await G.ctx.close();
      await api('/api/admin/profiles/' + guest.id, { method: 'DELETE', profile: T.eli }).catch(() => {});
    }

    ok(errors.length === 0, 'no console errors in any context', errors.join(' | '));
    for (const c of [A, TV]) await c.ctx.close();
    await cleanup();
  } catch (e) {
    fail++; console.log('  ✗ crashed:', e && e.stack || e);
  } finally {
    await browser.close(); server.close();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
