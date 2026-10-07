#!/usr/bin/env node
// Roadmap 13 checks: Home widgets round 2.
//   (a) the Prayer card says "N to pray · M done" for today, derived from the prayer app's person-scope rows
//   (b) an "At the park" card lists who has a fresh (< 4 h) dollywood-live loc:<id> row — one row per person with a face and
//       that person's last-seen time, nothing clipped at 390 even with four people — and hides otherwise
//   (c) kids get a Stars card from app_data(kidverse, person, 'stars'); adults get "Ezra ★3 · Kiara ★0" from
//       the family mirror stars:<kidId> — both { week: 'YYYY-Www', count: n }, a stale week counts as 0
//   (d) the feed groups consecutive lines by person, shows an app icon per line, relative times, and "Show more"
//   (e) IMP-PRAYER-I3 (batch 3): the asker's own Home has a quiet line for each of their family-list requests someone else
//       prayed today ("Ezra and Elizabeth prayed today for Grandma Jo's visit"), not their own tick, not yesterday's, not a
//       request someone else asked; patched in place (the other parts keep their nodes); never on another adult's Home or a
//       kid's; it opens Prayer
//   (g) UX-TIMER-7 (batch 6): the adult's Home has a Timer card — "Start a timer" with the last three lengths (3, 5, 10 minutes
//       before there are any) as one-tap buttons and Open Timer in the footer; one tap starts a timer:<id> row (server ms) and
//       its family mirror; the card then shows it counting in place with Pause / Stop, the pill stays; Pause is stored; Stop
//       removes the row; the length joins the recents. The kid Home has no Timer card (its picture tile, and the pill)
//   AC: every card renders from the localStorage cache before the first pull (second load with /api blocked:
//       populated cards, no skeleton, lastPull still 0) and each card's secondary text is one line at 390 and not ellipsised.
//       The Stars/Kids play.svg art is checked by pixel: visible on Hearth, a faint ghost on Midnight.
//   cd worker && npx wrangler dev --port 8787     (seeded local D1; the adult is David — 'dad', PIN 4680 or unset — because other suites keep Eli's prayer list busy)
//   node scripts/test-home.mjs <pairing-code>
// Serves the repo on :8913 and proxies /api to the Worker, so it never needs :8765.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CODE = process.argv[2] || 'local-test-code';
const DAD_PIN = '4680';
const MAE_PIN = process.env.MAE_PIN || '2580';
const API = process.env.HUB_API || 'http://127.0.0.1:8787';
const PORT = 8913;
const SITE = 'http://localhost:' + PORT;
const SHOTS = path.join(ROOT, 'docs', 'screens');
fs.mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {                       // same-origin proxy: the Worker's CORS list only knows :8765
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

// ── seed through the API ─────────────────────────────────────────
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
// Since batch 0d the Worker lets only the person write their own park dot and Kid Verse stars (worker/src/policy.js), and a
// kid's dot only while a parent has their beacon on: so each seed row is written by its owner, on the seeder device.
const tokens = {};
const asOwner = async id => (tokens[id] ||= await login(id, id === 'dad' ? DAD_PIN : id === 'christian' ? MAE_PIN : undefined));
const ownRow = async (app, key, id, value, updated_at) => api(`/api/data/${app}/${encodeURIComponent(key)}?scope=family`, { method: 'PUT', profile: await asOwner(id), body: { value, updated_at } });
const pad = n => String(n).padStart(2, '0');
const dayKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const isoWeek = d => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); return y + '-W' + pad(Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7)); };
const TODAY = dayKey(new Date()), YESTERDAY = dayKey(new Date(Date.now() - 86400000)), WEEK = isoWeek(new Date()), LAST_WEEK = isoWeek(new Date(Date.now() - 7 * 86400000));
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
const prayer = (id, title, extra) => ({ id, title, category: 'Family', detail: '', for: '', phone: '', cadence: 'daily', days: [], status: 'active', createdAt: YESTERDAY, lastPrayedAt: null, answeredAt: null, answerNote: null, updates: [], sharedFrom: null, prayedBy: {}, updatedAt: new Date().toISOString(), ...extra });
async function seed() {
  DEVICE = (await api('/api/pair', { method: 'POST', body: { code: CODE, name: 'test-home seeder' } })).device_token;
  const dad = await asOwner('dad'), ezra = await asOwner('ezra'), kiara = await asOwner('kiara');
  // a clean slate for David's own prayer list (the local DB is shared with other suites): tombstone whatever is there,
  // then stamp the seed rows later than those tombstones so last-write-wins keeps them
  for (const it of (await api('/api/data/prayer?scope=person&prefix=prayer:', { profile: dad })).items) if (it.value != null) await api('/api/data/prayer/' + encodeURIComponent(it.key) + '?scope=person', { method: 'DELETE', profile: dad });
  const now = Date.now() + 1000;
  const rows = items => items.map(([key, value], i) => ({ key, value, updated_at: now + i }));
  // (a) David's own prayer list: 3 daily (one prayed today), 1 weekly on today's weekday, 1 rotation, 1 answered (not counted)
  //     → 5 on today's list, 1 done, 4 to pray; prayerDays yesterday + today → 2-day streak
  await api('/api/data/prayer/batch?scope=person', { method: 'POST', profile: dad, body: { items: rows([
    ['label', 'My list'], ['categories', ['Family', 'Friends', 'Church', 'World']],
    ['plans', [{ id: 'plA', name: 'Everything', mode: 'everything', focusCategory: '', includeDaily: true, rotationSize: 3, groupByCategory: false, dayMap: { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] }, show: { meter: true, streak: true, answered: true, anniversaries: true, review: true } }]],
    ['activePlan', 'plA'], ['rotationFor', null], ['prayerDays', [YESTERDAY, TODAY]], ['activeList', 'personal'],
    ['prayer:p001', prayer('p001', 'Mae')], ['prayer:p002', prayer('p002', 'Mom and Dad', { lastPrayedAt: TODAY })], ['prayer:p003', prayer('p003', 'The kids')],
    ['prayer:p004', prayer('p004', 'Small group', { cadence: 'weekly', days: [DOW] })],
    ['prayer:p005', prayer('p005', 'The Millers', { cadence: 'rotation', lastPrayedAt: '2026-01-05' })],
    ['prayer:p006', prayer('p006', 'A new job', { status: 'answered', answeredAt: YESTERDAY })],
  ]) } });
  // (b) both kids are at the park (Ezra 5 min ago, Kiara 3 min ago); Mae's pin is 5 h old, so she is not
  await api('/api/data/dollywood-live/batch?scope=family', { method: 'POST', profile: dad, body: { items: rows([['kidshare:ezra', true], ['kidshare:kiara', true]]) } });   // David switches the kids' beacons on
  await ownRow('dollywood-live', 'loc:ezra', 'ezra', { x: 1200, y: 800, acc: 12, hdg: null, t: now - 5 * 60e3, name: 'Ezra', emoji: '🦖', color: '#137F77' }, now);
  await ownRow('dollywood-live', 'loc:kiara', 'kiara', { x: 900, y: 700, acc: 20, hdg: null, t: now - 3 * 60e3, name: 'Kiara', emoji: '🦄', color: '#B4861B' }, now + 1);
  await ownRow('dollywood-live', 'loc:christian', 'christian', { x: 600, y: 500, acc: 9, hdg: null, t: now - 5 * 3600e3, name: 'Mae' }, now + 2);
  // (c) stars: Ezra 3 this week (person + family mirror), Kiara 7 last week (stale → 0)
  await ownRow('kidverse', 'stars:ezra', 'ezra', { week: WEEK, count: 3 }, now);
  await ownRow('kidverse', 'stars:kiara', 'kiara', { week: LAST_WEEK, count: 7 }, now);
  await api('/api/data/kidverse/stars?scope=person', { method: 'PUT', profile: ezra, body: { value: { week: WEEK, count: 3 }, updated_at: now } });
  await api('/api/data/kidverse/stars?scope=person', { method: 'DELETE', profile: kiara }).catch(() => {});
  // (f) a clean slate for David's memory verses (F260's mem:/recall: rows and maps, Verses' own rows): no Verses card until (f)
  for (const [app, prefix] of [['f260', 'mem:'], ['f260', 'recall:'], ['f260', 'f260.mem'], ['f260', 'f260.recall'], ['verses', '']]) {
    for (const it of (await api(`/api/data/${app}?scope=person&prefix=${encodeURIComponent(prefix)}`, { profile: dad })).items) {
      if (it.value != null && (app === 'verses' || it.key.startsWith(prefix))) await api(`/api/data/${app}/${encodeURIComponent(it.key)}?scope=person`, { method: 'DELETE', profile: dad });
    }
  }
  // (d) 40 activity entries: runs of three by David then two by Ezra, across four apps
  const apps = ['f260', 'leftovers', 'prayer', 'reminders'];
  for (let i = 0; i < 40; i++) {
    const who = i % 5 < 3 ? dad : ezra;
    await api('/api/activity', { method: 'POST', profile: who, body: { app_id: apps[i % 4], text: `Seeded feed line ${i + 1}` } });
  }
  return dad;
}

// What the park card should show right now: every family loc:<id> row fresher than 4 h, most recent first, with the shell's
// wording (ago() → "3m ago"). Data-driven because the local D1 is shared with other suites, which may leave their own fresh pins.
let PEOPLE = null;
const agoText = t => { const s = Math.max(0, (Date.now() - t) / 1000); const a = s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + 'm' : s < 86400 ? Math.floor(s / 3600) + 'h' : Math.floor(s / 86400) + 'd'; return a === 'just now' ? a : a + ' ago'; };
async function expectedPark(profile) {
  if (!PEOPLE) PEOPLE = Object.fromEntries((await api('/api/profiles', { profile })).profiles.map(p => [p.id, p]));
  const now = Date.now();
  const who = (await api('/api/data/dollywood-live?scope=family&prefix=loc:', { profile })).items
    .filter(r => r.value && typeof r.value === 'object' && now - (Number(r.value.t) || 0) < 4 * 3600e3)
    .map(r => { const id = r.key.slice(4), q = PEOPLE[id] || {}; return { id, t: Number(r.value.t), name: q.name || r.value.name || id, emoji: q.emoji || r.value.emoji || '' }; })
    .sort((a, b) => b.t - a.t);
  const headline = who.length === 1 ? who[0].name : who.length === 2 ? who[0].name + ' and ' + who[1].name : who.length + ' of the family';
  return { who, headline, names: who.map(w => w.name).join(','), whens: who.map(w => agoText(w.t)).join(','), faces: who.map(w => w.emoji).join('') };
}

// ── browser ──────────────────────────────────────────────────────
const errors = [];
async function newContext(browser, name, width = 390) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, deviceScaleFactor: 2, hasTouch: width < 700, isMobile: width < 700, colorScheme: 'light' });
  await ctx.addInitScript(api => { try { localStorage.setItem('hub.api', JSON.stringify(api)); } catch {} }, SITE);
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(name + ': ' + m.text()); });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  await page.goto(SITE + '/index.html'); await page.waitForSelector('#paircode');
  await page.fill('#paircode', CODE); await page.click('#pairform button[type=submit]'); await page.waitForSelector('.pcard[data-id]');
  return { ctx, page };
}
async function signIn(page, id, pin) {
  await page.click(`.pcard[data-id=${id}]`);
  if (pin) {
    await page.waitForSelector('#pad'); await sleep(450);
    for (const d of pin) await page.click(`#pad [data-d="${d}"]`); await page.click('#pingo');
  }
  await page.waitForSelector('#shell:not([hidden])', { timeout: 15000 });
  await page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 });
}
const text = (page, sel) => page.$eval(sel, e => e.textContent.trim().replace(/\s+/g, ' ')).catch(() => null);
// every card's secondary line is one line (scrollHeight within 1.5 line-heights) AND not clipped: at 390 the shell
// sets nowrap + ellipsis on these, so the height check alone would pass on truncated text — scrollWidth catches that
const oneLiners = page => page.$$eval('#view-home .gcard .gsub, #view-home .gcard .gbig.one', els => els.map(e => {
  const cs = getComputedStyle(e); const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
  const clipped = e.scrollWidth > e.clientWidth + 1;
  return { text: e.textContent.trim(), h: e.scrollHeight, lh, w: e.clientWidth, sw: e.scrollWidth, clipped, one: e.scrollHeight <= lh * 1.5 + 1 && !clipped };
}));
const noHScroll = page => page.evaluate(() => { const v = document.getElementById('views') || document.documentElement; return v.scrollWidth <= v.clientWidth + 1 && document.documentElement.scrollWidth <= window.innerWidth + 1; });
// the park rows: each person's name + last-seen time, fully visible (nothing ellipsised, nothing off the card)
const parkRows = page => page.$$eval('.park-card .park-list li', lis => lis.map(li => {
  const card = li.closest('.park-card').getBoundingClientRect(), r = li.getBoundingClientRect(), pn = li.querySelector('.pn'), pt = li.querySelector('.pt');
  return { name: pn.textContent.trim(), when: pt.textContent.trim(), face: (li.querySelector('.avatar') || {}).textContent, inside: r.right <= card.right + 0.5 && r.left >= card.left - 0.5,
    clipped: pn.scrollWidth > pn.clientWidth + 1 || pt.scrollWidth > pt.clientWidth + 1 || li.scrollWidth > li.clientWidth + 1 };
}));
// Is the paper-white play.svg actually visible on a Stars/Kids card? Screenshot the card with its words hidden (this measures
// art against the card's wash, the opacity checks cover the words) and compare a pixel at the centre of the art's big circle
// (viewBox 230,60 r30) with one in a blank part of the art box (230,130).
async function artSample(page, sel) {
  await page.$eval(sel, card => card.scrollIntoView({ block: 'center' }));   // batch 2a: the kid Home's picture tiles push the Stars card to the fold, under the tab bar
  const geo = await page.$eval(sel, card => {
    const c = card.getBoundingClientRect(), s = card.querySelector('.spot').getBoundingClientRect();
    const pt = (vx, vy) => ({ x: s.left + s.width * vx / 300 - c.left, y: s.top + s.height * vy / 200 - c.top });
    for (const e of card.querySelectorAll('h2, .gbody, .btn')) e.style.visibility = 'hidden';
    return { art: pt(230, 60), blank: pt(230, 130), w: c.width, h: c.height, bg: getComputedStyle(card).backgroundImage, op: parseFloat(getComputedStyle(card.querySelector('.spot')).opacity), loaded: card.querySelector('.spot').naturalWidth > 0 };
  });
  const png = (await page.$(sel).then(h => h.screenshot({ type: 'png' }))).toString('base64');
  await page.$eval(sel, card => { for (const e of card.querySelectorAll('h2, .gbody, .btn')) e.style.visibility = ''; });
  const diff = await page.evaluate(async ({ png, art, blank, w, h }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
    const px = p => cx.getImageData(Math.round(p.x * img.width / w), Math.round(p.y * img.height / h), 1, 1).data;
    const a = px(art), b = px(blank);
    return { a: [...a].slice(0, 3), b: [...b].slice(0, 3), diff: Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) };
  }, { png, art: geo.art, blank: geo.blank, w: geo.w, h: geo.h });
  return { ...geo, ...diff };
}

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    console.log('\n## seed'); const dadTok = await seed(); ok(true, 'seeded prayers, two park pins (+ a stale one), stars and 40 feed entries');

    console.log('\n## adult Home (David, 390)');
    const A = await newContext(browser, 'A');
    await signIn(A.page, 'dad', DAD_PIN);
    await A.page.waitForSelector('#view-home .prayer-card');
    ok(await text(A.page, '.prayer-card .gbig') === '4 to pray · 1 done', '(a) Prayer card: "4 to pray · 1 done" from the person rows (3 daily, 1 weekly today, 1 rotation; 1 prayed)', await text(A.page, '.prayer-card .gbig'));
    ok(/^2-day streak · keep it going$/.test(await text(A.page, '.prayer-card .gsub') || ''), '(a) Prayer secondary: "2-day streak · keep it going"', await text(A.page, '.prayer-card .gsub'));
    ok(/4 to pray/.test(await text(A.page, '.home-hero .hero-sub') || ''), '(a) hero line mentions 4 to pray');
    ok(!(await A.page.$('#view-home .verses-card')), '(f) GAP-HOME-2: nothing memorised → no Verses card');
    ok(!!(await A.page.$('.park-card')), '(b) "At the park" card shows on a park day');
    const exp1 = await expectedPark(dadTok), parkBig = await text(A.page, '.park-card .gbig'), parkSub = await text(A.page, '.park-card .gsub');
    ok(exp1.who.length >= 2 && exp1.who.some(w => w.id === 'ezra') && exp1.who.some(w => w.id === 'kiara') && !exp1.who.some(w => w.id === 'christian'), '(b) the API agrees: Ezra + Kiara fresh, Mae (5 h) not' + (exp1.who.length > 2 ? ' (extra fresh pins already in the shared local DB: ' + exp1.names + ')' : ''), exp1.names);
    ok(parkBig === exp1.headline, '(b) headline names the fresh pins (most recent first), never Mae; counts past two people', JSON.stringify([parkBig, exp1.headline]));
    ok(parkSub === 'At Dollywood · last seen ' + exp1.whens.split(',')[0], '(b) secondary line: where, and the most recent sighting', parkSub);
    const rows1 = await parkRows(A.page);
    ok(rows1.map(r => r.name).join(',') === exp1.names, '(b) one row per person at the park, most recent first, Mae not listed', JSON.stringify([rows1.map(r => r.name), exp1.names]));
    ok(rows1.map(r => r.when).join(',') === exp1.whens && rows1.find(r => r.name === 'Kiara').when === '3m ago' && rows1.find(r => r.name === 'Ezra').when === '5m ago', '(b) every row carries that person\'s own last-seen time (Kiara 3m, Ezra 5m)', JSON.stringify(rows1.map(r => r.when)));
    ok(rows1.every(r => !r.clipped && r.inside), '(b) at 390 no name or time is ellipsised or pushed off the card', JSON.stringify(rows1));
    ok(rows1.find(r => r.name === 'Kiara').face === '🦄' && rows1.find(r => r.name === 'Ezra').face === '🦖', '(b) faces from hub.people() via hub.avatarHtml, one per row', JSON.stringify(rows1.map(r => r.face)));
    await A.page.click('.park-card [data-open="dollywood-live"]');
    ok(await waitFor(() => A.page.$eval('#frame', f => /dollywood-live/.test(f.src))), '(b) the card opens the park map');
    await A.page.evaluate(() => document.querySelector('#pill-home').click()); await A.page.click('.tab[data-tab=home]'); await sleep(400);
    const kidsLine = await text(A.page, '.kids-card .kids-line');
    ok(/Ezra ★3.*Kiara ★0/.test(kidsLine || ''), '(c) adults: "Ezra ★3 · Kiara ★0" from the family stars:<kid> rows (last week counts as 0)', kidsLine);
    ok(await text(A.page, '.kids-card .gsub') === '3 stars this week', '(c) kids card secondary line');
    const kArt = await artSample(A.page, '.kids-card');
    ok(/linear-gradient/.test(kArt.bg) && kArt.loaded && kArt.op >= .5, '(c) Kids card: the gold wash is applied (beats .ds .card) and play.svg is loaded', JSON.stringify({ bg: kArt.bg.slice(0, 40), loaded: kArt.loaded, op: kArt.op }));
    ok(kArt.diff != null && kArt.diff >= 20, '(c) Kids card: the paper-white art is actually visible on the light palette', JSON.stringify(kArt));
    // (d) feed
    await A.page.waitForFunction(() => document.querySelectorAll('#feed .fline').length >= 30, null, { timeout: 15000 });
    const feed1 = await A.page.$$eval('#feed li:not(.feed-more)', lis => lis.map(li => ({ who: li.querySelector('.fwho').textContent.trim(), lines: li.querySelectorAll('.fline').length, icons: li.querySelectorAll('.fline .ficon svg').length, whens: [...li.querySelectorAll('.fline .fwhen')].map(w => w.textContent.trim()) })));
    ok(feed1.reduce((s, g) => s + g.lines, 0) === 30, '(d) first page shows 30 lines', JSON.stringify(feed1.map(g => g.lines)));
    ok(feed1.some(g => g.lines >= 2), '(d) consecutive lines by one person are grouped under one face', JSON.stringify(feed1.slice(0, 4)));
    ok(feed1.every(g => g.icons === g.lines), '(d) an app icon on every line');
    ok(feed1.every(g => g.whens.every(w => /^(just now|\d+[mhd] ago|[A-Z][a-z]{2} \d+)$/.test(w))), '(d) relative time on every line', JSON.stringify(feed1[0] && feed1[0].whens));
    ok(feed1.every(g => g.who !== 'Someone'), '(d) every group names its person');
    ok(!!(await A.page.$('#feed-more')), '(d) "Show more" offered after a full page');
    // robustness: a page that fails (network gone mid-tap) must not lose the button for good
    const abortActivity = r => r.abort();
    await A.page.route('**/api/activity**', abortActivity);
    await A.page.click('#feed-more');
    const back = await waitFor(() => A.page.$('#feed-more:not([disabled])'), { timeout: 8000, label: 'Show more after a failed page' }).then(() => true, () => false);
    const stillLines = await A.page.$$eval('#feed .fline', l => l.length);
    ok(back && stillLines === 30, '(d) a failed "Show more" keeps the 30 lines and re-offers the button', JSON.stringify({ back, stillLines }));
    await A.page.unroute('**/api/activity**', abortActivity);
    for (let tries = 0; tries < 3; tries++) {           // wrangler dev reloads while other suites edit the Worker; a failed page rolls feedLimit back and re-offers the button, so try again
      if (await A.page.$('#feed-more:not([disabled])')) await A.page.click('#feed-more');
      try { await A.page.waitForFunction(() => document.querySelectorAll('#feed .fline').length >= 40, null, { timeout: 8000 }); break; } catch (e) { if (tries === 2) throw e; }
    }
    ok(true, '(d) Show more loads the next 30 (now ≥ 40 lines)');
    const total = await A.page.$$eval('#feed .fline', l => l.length);
    ok(total < 60 ? !(await A.page.$('#feed-more')) : !!(await A.page.$('#feed-more')), '(d) "Show more" hides once the last page is short', 'lines=' + total);
    // one line at 390 + no horizontal scroll
    const ol = await oneLiners(A.page);
    ok(ol.length >= 5 && ol.every(o => o.one), 'AC: every card\'s secondary text is one line at 390', JSON.stringify(ol.filter(o => !o.one)));
    ok(await noHScroll(A.page), 'no horizontal scroll at 390');
    await A.page.evaluate(() => document.getElementById('views').scrollTo(0, 0)); await sleep(150);
    await A.page.screenshot({ path: path.join(SHOTS, 'rm13-home-390.png'), fullPage: false });
    await A.page.evaluate(() => document.querySelector('.prayer-card').scrollIntoView()); await sleep(150);
    await A.page.screenshot({ path: path.join(SHOTS, 'rm13-home-390-cards.png'), fullPage: false });
    await A.page.evaluate(() => document.querySelector('#feed').scrollIntoView()); await sleep(150);
    await A.page.screenshot({ path: path.join(SHOTS, 'rm13-home-390-feed.png'), fullPage: false });

    console.log('\n## cache-first: second load with /api blocked');
    const A2 = await A.ctx.newPage();
    await A2.route('**/api/**', r => r.abort());
    A2.on('pageerror', e => errors.push('A2: ' + e.message));
    await A2.goto(SITE + '/index.html');
    await A2.waitForSelector('#view-home .prayer-card', { timeout: 15000 });
    const snap = await A2.evaluate(() => ({
      lastPull: hub.sync.lastPull, skeletons: document.querySelectorAll('#view-home .skeleton').length,
      prayer: document.querySelector('.prayer-card .gbig').textContent.trim(), park: !!document.querySelector('.park-card'),
      kids: (document.querySelector('.kids-card .kids-line') || {}).textContent, f260: document.querySelector('#view-home .gcard .gbig').textContent.trim(),
      fridge: document.querySelector('#view-home .gcard:has([data-open="leftovers"]) .gbig').textContent.trim(),   // by its button: batch 5's Verses card may sit second
      feedLines: document.querySelectorAll('#feed .fline').length, hero: document.querySelector('.home-hero .hero-sub').textContent.trim(),
    }));
    ok(snap.lastPull === 0, 'AC: no pull has happened (API blocked)', JSON.stringify(snap));
    ok(snap.skeletons === 0, 'AC: no skeleton anywhere on Home', 'skeletons=' + snap.skeletons);
    ok(snap.prayer === '4 to pray · 1 done' && snap.park && /Ezra ★3/.test(snap.kids || ''), 'AC: prayer, park and kids cards populated from the cache', JSON.stringify(snap));
    ok(snap.f260.length > 0 && !/loading/.test(snap.f260) && snap.fridge.length > 0 && !/loading/.test(snap.fridge), 'AC: F260 + fridge cards populated from the cache (not "loading")', JSON.stringify([snap.f260, snap.fridge]));
    ok(snap.feedLines >= 30, 'AC: the feed paints from its cache too', 'lines=' + snap.feedLines);
    ok(/4 to pray/.test(snap.hero), 'AC: hero line from the cache');
    await A2.close();

    console.log('\n## adult Home at 1024');
    const W = await newContext(browser, 'W', 1024);
    await signIn(W.page, 'dad', DAD_PIN);
    await W.page.waitForSelector('#view-home .kids-card');
    ok(await noHScroll(W.page), 'no horizontal scroll at 1024');
    await W.page.waitForFunction(() => document.querySelectorAll('#feed .fline').length >= 30, null, { timeout: 15000 });
    await W.page.screenshot({ path: path.join(SHOTS, 'rm13-home-1024.png'), fullPage: false });
    await W.ctx.close();

    console.log('\n## P3-LEFTOVERS-02 (batch 8): the Home fridge card and the Apps badge in the Larder one rule and words');
    {
      const RUN = Date.now().toString(36), day = n => dayKey(new Date(Date.now() + n * 86400000));
      const fr = (id, name, daysOld, extra = {}) => ({ key: `item:fr-${RUN}-${id}`, value: { id: `fr-${RUN}-${id}`, name: name + ' ' + RUN, size: 'Medium', dateLogged: day(-daysOld), by: 'dad', byName: 'David', ...extra }, updated_at: Date.now() + 1000 });
      const rows = [fr('a', 'Chili', 8), fr('b', 'Soup', 4), fr('c', 'Pie', 1, { useBy: day(1) }), fr('d', 'Beans', 9, { useBy: day(5) }), fr('e', 'Salad', 2)];
      const before = await A.page.evaluate(() => hub.list('item:', { app: 'leftovers', scope: 'family' }).filter(r => r.value).length);
      await api('/api/data/leftovers/batch?scope=family', { method: 'POST', profile: dadTok, body: { items: rows } });
      await A.page.click('.tab[data-tab=home]'); await A.page.evaluate(() => hub.pull());
      const card = () => A.page.evaluate(run => { const c = document.querySelector('#view-home .gcard:has([data-open="leftovers"])'); return c && { big: c.querySelector('.gbig').textContent.trim(), rows: [...c.querySelectorAll('.fresh > div')].filter(r => r.textContent.includes(run)).map(r => ({ t: r.querySelector('.fl span').textContent.replace(' ' + run, ''), right: r.querySelector('.fl span:last-child').textContent.trim(), stale: r.classList.contains('stale') })) }; }, RUN);
      await waitFor(async () => { const c = await card(); return c && c.rows.length >= 1; }, { label: 'the fridge card with the new items' });
      const c = await card();
      ok(/\d+ use it up/.test(c.big) && /eat soon/.test(c.big) && !/this week/.test(c.big), '(h) the fridge card says it in the Larder words: "N use it up · N eat soon" (no "to eat this week")', JSON.stringify(c));
      ok(JSON.stringify(c.rows.map(r => r.t)) === JSON.stringify(['Chili', 'Pie', 'Soup']) && JSON.stringify(c.rows.map(r => r.right)) === JSON.stringify(['8d', '1d left', '4d']) && JSON.stringify(c.rows.map(r => r.stale)) === JSON.stringify([true, false, false]), '(h) most urgent first by the shared rule: Chili 8d (use it up), Pie 1d left (use-by tomorrow), Soup 4d; Beans (9 days, use-by in 5) and Salad are fresh and not listed', JSON.stringify(c.rows));
      await A.page.click('.tab[data-tab=apps]');
      const badge = await waitFor(() => A.page.$eval('.tile[data-id=leftovers] .badge', b => ({ n: +b.textContent, aria: b.getAttribute('aria-label') })).catch(() => null), { label: 'the badge' });
      ok(badge.n >= 3 && /eat soon or use up/.test(badge.aria), '(h) the Apps badge counts what needs eating (Chili, Pie, Soup and anything else due) and says "eat soon or use up"', JSON.stringify(badge));
      for (const r of rows) await api('/api/data/leftovers/' + encodeURIComponent(r.key) + '?scope=family', { method: 'DELETE', profile: dadTok });
      await A.page.click('.tab[data-tab=home]'); await A.page.evaluate(() => hub.pull());
    }

    console.log('\n## IMP-PRAYER-I3: the asker hears who prayed (David, 390)');
    {
      const RUN = Date.now().toString(36), PF = { fam: '/api/data/prayer/batch?scope=family' };
      if (!PEOPLE) PEOPLE = Object.fromEntries((await api('/api/profiles', { profile: dadTok })).profiles.map(p => [p.id, p]));
      const T = { a: `Grandma Jo's visit ${RUN}`, b: `David's own tick ${RUN}`, c: `Mae asked this ${RUN}`, d: `Prayed yesterday ${RUN}`, e: `The Millers' move ${RUN}` };
      const fam = (id, title, by, prayedBy) => ({ key: `prayer:pf-${RUN}-${id}`, value: prayer(`pf-${RUN}-${id}`, title, { by, prayedBy }), updated_at: Date.now() + 1000 });
      PF.keys = ['a', 'b', 'c', 'd', 'e'].map(id => `prayer:pf-${RUN}-${id}`);
      await api(PF.fam, { method: 'POST', profile: dadTok, body: { items: [
        fam('a', T.a, 'dad', { [TODAY]: ['ezra', 'dad', 'mom'] }),            // David asked; Ezra and Elizabeth prayed (and David, who is left out)
        fam('b', T.b, 'dad', { [TODAY]: ['dad'] }),                            // only David himself
        fam('c', T.c, 'christian', { [TODAY]: ['ezra'] }),                     // Mae asked: hers, never David's
        fam('d', T.d, 'dad', { [YESTERDAY]: ['kiara'] }),                     // yesterday
      ] } });
      await A.page.click('.tab[data-tab=home]'); await A.page.evaluate(() => hub.pull());
      const pfLines = page => page.$$eval('#view-home .pf-line', (els, run) => els.filter(e => e.textContent.includes(run)).map(e => { const r = e.getBoundingClientRect(), t = e.querySelector('.pf-t'); return { text: t.textContent.replace(/\s+/g, ' ').trim(), open: e.dataset.open, faces: e.querySelectorAll('.avatar').length, h: Math.round(r.height), clipped: t.scrollWidth > t.clientWidth + 1 || r.right > innerWidth + 1 }; }), RUN);
      await waitFor(async () => (await pfLines(A.page)).length >= 1, { label: 'the asker\'s line' });
      let L = await pfLines(A.page);
      const mom = PEOPLE.mom.name;
      ok(L.length === 1 && L[0].text === `Ezra and ${mom} prayed today for ${T.a}`, `(e) David's Home: "Ezra and ${mom} prayed today for Grandma Jo's visit" — his own tick, yesterday's and Mae's request left out`, JSON.stringify(L));
      ok(L[0].faces === 2 && L[0].open === 'prayer' && L[0].h >= 44 && !L[0].clipped, '(e) the line shows the two faces, opens Prayer, is a 44 px target and is whole at 390', JSON.stringify(L[0]));
      ok(await A.page.evaluate(() => !document.querySelector('.home-hero .hero-sub').textContent.includes('prayed for')), '(e) quiet: nothing added to the hero line');
      // patched in place: another request prayed → a second line; the hero, the cards and the first line keep their nodes
      await A.page.evaluate(() => { for (const e of document.querySelectorAll('#view-home [data-part="hero"] > *, #view-home [data-part="glance"] > *, #view-home .pf-line')) e.__keep = 1; });
      await api(PF.fam, { method: 'POST', profile: dadTok, body: { items: [fam('e', T.e, 'dad', { [TODAY]: ['kiara', 'ezra', 'christian'] })] } });
      await A.page.evaluate(() => hub.pull());
      await waitFor(async () => (await pfLines(A.page)).length >= 2, { label: 'the second line' });
      L = await pfLines(A.page);
      const kept = await A.page.evaluate(run => ({ hero: [...document.querySelectorAll('#view-home [data-part="hero"] > *')].every(e => e.__keep), cards: [...document.querySelectorAll('#view-home [data-part="glance"] > *')].filter(e => !e.__keep).map(e => e.className), first: [...document.querySelectorAll('#view-home .pf-line')].filter(e => e.textContent.includes("Grandma Jo's visit " + run)).every(e => e.__keep) }), RUN);
      const mae = PEOPLE.christian.name;
      ok(L.length === 2 && L[0].text === `Kiara, Ezra and ${mae} prayed today for ${T.e}` && L[0].faces === 3 && L[1].text === `Ezra and ${mom} prayed today for ${T.a}`, '(e) a second request prayed → a second line (most people first), names joined "A, B and C"', JSON.stringify(L.map(l => l.text)));
      ok(kept.hero && kept.first, '(e) patched in place: the hero and the first line keep their nodes (batch 2a)', JSON.stringify(kept));
      await A.page.evaluate(t => [...document.querySelectorAll('#view-home .pf-line')].find(e => e.textContent.includes(t)).click(), T.a);
      ok(await waitFor(() => A.page.$eval('#frame', f => /prayer\.html/.test(f.src))).catch(() => false), '(e) tapping the line opens Prayer');
      await A.page.evaluate(() => document.querySelector('#pill-home').click()); await sleep(400);
      // never on another adult's Home: Mae sees her own request's line and none of David's
      await asOwner('christian');
      const M = await newContext(browser, 'M');
      await signIn(M.page, 'christian', MAE_PIN);
      await waitFor(async () => (await pfLines(M.page)).length >= 1, { label: 'Mae\'s line' });
      const LM = await pfLines(M.page);
      ok(LM.length === 1 && LM[0].text === `Ezra prayed today for ${T.c}`, '(e) Mae\'s Home: only her own request ("Ezra prayed today for …"), never David\'s', JSON.stringify(LM));
      await M.ctx.close();
      PF.cleanup = async () => { for (const k of PF.keys) await api('/api/data/prayer/' + encodeURIComponent(k) + '?scope=family', { method: 'DELETE', profile: dadTok }).catch(() => {}); };
      globalThis.__pfCleanup = PF.cleanup;
    }

    console.log('\n## (f) GAP-HOME-2 / UX-VERSES-3: the Verses card (David, 390)');
    {
      // household (New York) days, as the shell and Verses count them
      const nyDay = (n = 0) => { const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); const g = t => p.find(x => x.type === t).value; return new Date(Date.UTC(+g('year'), +g('month') - 1, +g('day')) + n * 86400000).toISOString().slice(0, 10); };
      const D = nyDay, t0 = Date.now() + 1000;
      // four memorised verses: 1-0 overdue since yesterday, 2-0 never reviewed, 2-1 due today → 3 due; 1-1 due in 3 days.
      // Reviews yesterday and the day before. Verses' summary row is yesterday's and stale (0 due, a 9-day streak): the
      // card must count from the rows, as Verses would today, before Verses has been opened.
      await api('/api/data/f260/batch?scope=person', { method: 'POST', profile: dadTok, body: { items: [
        ['mem:1-0', true], ['mem:1-1', true], ['mem:2-0', true], ['mem:2-1', true],
        ['recall:1-0', { s: 'got', t: t0, box: 2, due: D(-1), last: D(-3), streak: 1 }],
        ['recall:1-1', { s: 'got', t: t0, box: 3, due: D(3), last: D(-1), streak: 2 }],
        ['recall:2-1', { s: 'not', t: t0, box: 1, due: D(0), last: D(-1), streak: 0 }],
      ].map(([key, value], i) => ({ key, value, updated_at: t0 + i })) } });
      await api('/api/data/verses/batch?scope=person', { method: 'POST', profile: dadTok, body: { items: [
        // reviews yesterday, the day before and four days ago; three days ago nothing was rated and the rows show nothing
        // due that day, so it keeps the streak (P3-VERSES-11): 3 days, where the pre-batch rule said 2
        [`rev:${D(-1)}:1-1:dev-a`, 1], [`rev:${D(-1)}:2-1:dev-a`, 1], [`rev:${D(-2)}:1-0:dev-b`, 2], [`rev:${D(-4)}:1-1:dev-b`, 1],
        ['summary', { due: 0, streak: 9, boxes: [1, 1, 1, 0, 0], total: 4, reviewedToday: 0, week: null, at: D(-1) }],
      ].map(([key, value], i) => ({ key, value, updated_at: t0 + i })) } });
      await A.page.click('.tab[data-tab=home]'); await A.page.evaluate(() => hub.pull());
      await waitFor(() => A.page.$('#view-home .verses-card'), { label: 'the Verses card' });
      const card = () => A.page.$eval('#view-home .verses-card', c => ({ big: c.querySelector('.gbig').textContent.trim(), sub: c.querySelector('.gsub').textContent.trim(), btn: c.querySelector('[data-open]').textContent.trim(), open: c.querySelector('[data-open]').dataset.open, accent: c.dataset.accent,
        art: (c.querySelector('.spot') || {}).getAttribute && c.querySelector('.spot').getAttribute('src'), h: Math.round(c.getBoundingClientRect().height), btnH: Math.round(c.querySelector('[data-open]').getBoundingClientRect().height),
        after: (c.previousElementSibling && c.previousElementSibling.querySelector('[data-open]') || {}).dataset?.open || null }));
      let C = await card();
      ok(C.big === '3 verses to review' && C.btn === 'Review now' && C.open === 'verses', '(f) the card counts from the rows: "3 verses to review" (overdue, never reviewed, due today), "Review now" opens Verses — not the stale summary\'s 0', JSON.stringify(C));
      ok(!/9-day/.test(C.sub), '(f) the stale summary\'s 9-day streak is not shown', C.sub);
      ok(C.accent === 'pistachio' && C.art === 'art/app/verses.svg' && C.after === 'prayer' && C.btnH >= 44, '(f) pistachio, the Verses spot art, after Prayer (batch 4\'s pairs kept), a 44 px button', JSON.stringify(C));
      const vol = (await oneLiners(A.page)).filter(o => o.text === C.big || o.text === C.sub);
      ok(vol.length >= 1 && vol.every(o => o.one), '(f) its lines are one line and unclipped at 390', JSON.stringify(vol));
      // the shell and Verses agree on the same rows: open Verses as David in a second tab and ask it
      const VP = await A.ctx.newPage();
      await VP.goto(SITE + '/apps/verses.html');
      await VP.waitForFunction(() => window.verses && window.hub && hub.isLoaded() && hub.isLoaded('f260', 'person'), null, { timeout: 15000 });
      const fromApp = await VP.evaluate(() => ({ due: window.verses.dueIds().length, streak: window.verses.dayStreak() }));
      await VP.close();
      ok(fromApp.due === 3, '(f) Verses itself counts 3 due on these rows', JSON.stringify(fromApp));
      ok(fromApp.streak === 3 && C.sub.startsWith('3-day streak'), `(f) the card's streak is Verses' own day streak: 3 (a day with nothing due keeps it; today is pending) — Verses says ${fromApp.streak}`, JSON.stringify({ sub: C.sub, fromApp }));
      // patched in place (batch 2a): a review today changes the Verses card only; the hero and the other cards keep their nodes
      await A.page.evaluate(() => { for (const e of document.querySelectorAll('#view-home [data-part="hero"] > *, #view-home [data-part="glance"] > *')) e.__keep = 1; });
      const t1 = Date.now() + 2000;
      await api('/api/data/f260/batch?scope=person', { method: 'POST', profile: dadTok, body: { items: [{ key: 'recall:2-1', value: { s: 'got', t: t1, box: 2, due: D(2), last: D(0), streak: 1 }, updated_at: t1 }] } });
      await api('/api/data/verses/batch?scope=person', { method: 'POST', profile: dadTok, body: { items: [{ key: `rev:${D(0)}:2-1:dev-a`, value: 1, updated_at: t1 }] } });
      await A.page.evaluate(() => hub.pull());
      await waitFor(async () => (await card()).big === '2 verses to review', { label: 'the Verses card after a review' });
      const kept = await A.page.evaluate(() => ({ hero: [...document.querySelectorAll('#view-home [data-part="hero"] > *')].every(e => e.__keep), changed: [...document.querySelectorAll('#view-home [data-part="glance"] > *')].filter(e => !e.__keep).map(e => e.dataset.key) }));
      // (the park card's "5m ago" may have ticked over meanwhile; nothing else may change)
      ok(kept.hero && kept.changed.includes('verses') && kept.changed.every(k => k === 'verses' || k === 'park'), '(f) patched in place: only the Verses card was replaced', JSON.stringify(kept));
      const C2 = await card();
      ok(Math.abs(C2.h - C.h) <= 1, '(f) no layout shift: the card keeps its height', JSON.stringify([C.h, C2.h]));
      // nothing due: a calm line, and the button opens Verses rather than asking for a review
      const t2 = Date.now() + 3000;
      await api('/api/data/f260/batch?scope=person', { method: 'POST', profile: dadTok, body: { items: [
        { key: 'recall:1-0', value: { s: 'got', t: t2, box: 3, due: D(1), last: D(0), streak: 2 }, updated_at: t2 },
        { key: 'recall:2-0', value: { s: 'got', t: t2, box: 2, due: D(2), last: D(0), streak: 1 }, updated_at: t2 + 1 },
      ] } });
      await A.page.evaluate(() => hub.pull());
      await waitFor(async () => (await card()).big === 'Nothing due today', { label: 'nothing due' });
      C = await card();
      ok(C.btn === 'Open Verses' && /reviewed today$/.test(C.sub), '(f) nothing due: "Nothing due today", "reviewed today", "Open Verses"', JSON.stringify(C));
      const vol2 = (await oneLiners(A.page)).filter(o => o.text === C.big || o.text === C.sub);
      ok(vol2.length === 2 && vol2.every(o => o.one), '(f) and still one line each, unclipped, at 390', JSON.stringify(vol2));
      await A.page.evaluate(() => document.querySelector('.verses-card').scrollIntoView({ block: 'center' })); await sleep(150);
      await A.page.screenshot({ path: path.join(SHOTS, 'rm13-home-verses-390.png'), fullPage: false });
      await A.page.click('.verses-card [data-open="verses"]');
      ok(await waitFor(() => A.page.$eval('#frame', f => /verses\.html/.test(f.src))).catch(() => false), '(f) one tap opens the trainer');
      await A.page.evaluate(() => document.querySelector('#pill-home').click()); await sleep(400);
      // batch 5 review round 2 (E2b): a verse missed three days ago, then reviewed yesterday and again today, keeps the
      // missed day in its row's history (hist), so the streak still breaks there — on the card and in Verses alike: 3
      // (today, yesterday, the day before), where reading only the last replaced schedule said 4
      const t3 = Date.now() + 4000;
      await api('/api/data/f260/batch?scope=person', { method: 'POST', profile: dadTok, body: { items: [
        { key: 'recall:2-0', value: { s: 'got', t: t3, box: 2, due: D(2), last: D(0), streak: 1, hist: [{ due: D(-3), last: D(-5) }, { due: D(0), last: D(-1) }] }, updated_at: t3 },
      ] } });
      await A.page.evaluate(() => hub.pull());
      const streakOfCard = async () => { const m = /^(\d+)-day streak/.exec((await card()).sub); return m ? +m[1] : null; };
      await waitFor(async () => (await streakOfCard()) === 3, { label: 'the card after the history row' }).catch(() => {});
      const VP2 = await A.ctx.newPage();
      await VP2.goto(SITE + '/apps/verses.html');
      await VP2.waitForFunction(() => window.verses && window.hub && hub.isLoaded('verses', 'person') && hub.isLoaded('f260', 'person') && (hub.get('recall:2-0', { app: 'f260', scope: 'person' }) || {}).hist, null, { timeout: 15000 });
      const appStreak2 = await VP2.evaluate(() => window.verses.dayStreak());
      await VP2.close();
      const cardStreak2 = await streakOfCard();
      ok(appStreak2 === 3 && cardStreak2 === 3, '(f) a day missed two reviews back still breaks the streak: Verses 3, the card 3 (E2b)', JSON.stringify({ appStreak2, cardStreak2, sub: (await card()).sub }));
      // batch 5 review round 3 (H1): a rating the row lost — a device offline for days rated 2-0 from its stale copy and
      // overwrote the review made three days ago, so the row's history knows only the schedule before it (due three days
      // ago). The rev: rows still show that lost review, so the days after it are read generously: 3 (today, three days
      // ago, ten days ago), on the card and in Verses alike — never 1
      const t4 = Date.now() + 5000;
      for (const k of [`rev:${D(-1)}:1-1:dev-a`, `rev:${D(-1)}:2-1:dev-a`, `rev:${D(-2)}:1-0:dev-b`, `rev:${D(-4)}:1-1:dev-b`, `rev:${D(0)}:2-1:dev-a`]) await api('/api/data/verses/' + encodeURIComponent(k) + '?scope=person', { method: 'DELETE', profile: dadTok }).catch(() => {});
      await api('/api/data/f260/batch?scope=person', { method: 'POST', profile: dadTok, body: { items: [
        ['recall:1-0', { s: 'got', t: t4, box: 3, due: D(1), last: D(0), streak: 2 }], ['recall:1-1', { s: 'got', t: t4, box: 3, due: D(3), last: D(0), streak: 3 }],
        ['recall:2-1', { s: 'got', t: t4, box: 2, due: D(2), last: D(0), streak: 1 }],
        ['recall:2-0', { s: 'got', t: t4, box: 5, due: D(14), last: D(0), streak: 2, hist: [{ due: D(-3), last: D(-10) }] }],
      ].map(([key, value], i) => ({ key, value, updated_at: t4 + i })) } });
      await api('/api/data/verses/batch?scope=person', { method: 'POST', profile: dadTok, body: { items: [[`rev:${D(-10)}:2-0:h1-a`, 1], [`rev:${D(-3)}:2-0:h1-a`, 1], [`rev:${D(0)}:2-0:h1-b`, 1]].map(([key, value], i) => ({ key, value, updated_at: t4 + i })) } });
      await A.page.evaluate(() => hub.pull());
      await waitFor(async () => (await streakOfCard()) === 3, { label: 'the card with the lost rating' }).catch(() => {});
      const VP3 = await A.ctx.newPage();
      await VP3.goto(SITE + '/apps/verses.html');
      await VP3.waitForFunction(() => window.verses && window.hub && hub.isLoaded('verses', 'person') && hub.isLoaded('f260', 'person') && ((hub.get('recall:2-0', { app: 'f260', scope: 'person' }) || {}).due || '') > hub.today() && !hub.has('rev:' + hub.addDays(hub.today(), -1) + ':1-1:dev-a'), null, { timeout: 15000 });
      const appStreak3 = await VP3.evaluate(() => window.verses.dayStreak());
      await VP3.close();
      const cardStreak3 = await streakOfCard();
      ok(appStreak3 === 3 && cardStreak3 === 3, '(f) a rating the row lost never counts against the streak: Verses 3, the card 3 (H1)', JSON.stringify({ appStreak3, cardStreak3, sub: (await card()).sub }));
      globalThis.__versesCleanup = async () => { for (const k of ['mem:1-0', 'mem:1-1', 'mem:2-0', 'mem:2-1', 'recall:1-0', 'recall:1-1', 'recall:2-0', 'recall:2-1']) await api('/api/data/f260/' + encodeURIComponent(k) + '?scope=person', { method: 'DELETE', profile: dadTok }).catch(() => {}); };
    }

    console.log('\n## (g) the Home timer card (UX-TIMER-7, batch 6; David, 390)');
    {
      const live = async () => ((await api('/api/data/timer?scope=person', { profile: dadTok })).items || []).filter(i => i.value != null && (/^timer:/.test(i.key) || i.key === 'timer.active'));
      for (const r of ((await api('/api/data/timer?scope=person', { profile: dadTok })).items || [])) if (r.value != null) await api('/api/data/timer/' + encodeURIComponent(r.key) + '?scope=person', { method: 'DELETE', profile: dadTok });
      const TM = await newContext(browser, 'TM'); await signIn(TM.page, 'dad', DAD_PIN);
      await TM.page.waitForSelector('#home-timer [data-timer-recent]', { timeout: 15000 });
      const rec = await TM.page.$$eval('#home-timer [data-timer-recent]', bs => bs.map(b => +b.dataset.timerRecent));
      ok(rec.join() === '180000,300000,600000' && /Start a timer/.test(await text(TM.page, '#home-timer .gbig') || ''), '(g) no recents yet: "Start a timer" with 3, 5 and 10 minutes', JSON.stringify(rec));
      ok(await TM.page.$eval('#home-timer .gfoot > #home-timer-open', b => b.textContent.trim() === 'Open Timer'), '(g) Open Timer in the card\'s footer');
      await TM.page.click('#home-timer [data-timer-recent="300000"]');   // one tap
      await waitFor(() => TM.page.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'flush the start' });
      const rows1 = await live();
      ok(rows1.length === 1 && rows1[0].value.total === 300000 && rows1[0].value.endAt - rows1[0].value.startedAt === 300000 && rows1[0].value.by === 'dad' && !rows1[0].value.pausedAt, '(g) one tap starts a 5-minute timer: one timer:<id> row on the house', JSON.stringify(rows1));
      const id1 = rows1[0] && rows1[0].value.id;
      const fam = ((await api('/api/data/timer?scope=family', { profile: dadTok })).items || []).filter(i => i.key === 'run:dad:' + id1 && i.value);
      ok(fam.length === 1 && fam[0].value.endAt === rows1[0].value.endAt, '(g) …and its family mirror run:dad:<id> (the kitchen and the TV read it)', JSON.stringify(fam));
      await TM.page.waitForSelector('#home-timer .tm-row [data-timer-act=pause]');
      const t1 = await text(TM.page, '#home-timer .tm-left'); await sleep(1400); const t2 = await text(TM.page, '#home-timer .tm-left');
      ok(/^[45]:\d\d$/.test(t1 || '') && t1 !== t2, '(g) the card shows it counting, in place', t1 + ' → ' + t2);
      // rescore round: an unlabelled timer shows its time alone (no second "Timer" under the card's title); one action, one name:
      // a running timer's clear is Reset (rotate-ccw) with an accessible name, a square Stop only for a ringing one
      const row1 = await TM.page.$eval('#home-timer .tm-row', e => ({ what: !!e.querySelector('.tm-what'), text: e.textContent.replace(/\s+/g, ' ').trim(), reset: (e.querySelector('[data-timer-act=reset]') || {}).ariaLabel || null, icon: (e.querySelector('[data-timer-act=reset] use') || { getAttribute: () => '' }).getAttribute('href'), stop: !!e.querySelector('[data-timer-act=stop]') }));
      ok(!row1.what && !/Timer/.test(row1.text) && row1.reset === 'Reset timer' && /#i-rotate-ccw$/.test(row1.icon) && !row1.stop, '(g) the unlabelled row reads its time only, and its clear is "Reset timer" (rotate-ccw), no Stop', JSON.stringify(row1));
      ok(await TM.page.$eval('#timer-pill', p => !p.hidden), '(g) the pill stays while it runs');
      ok(await noHScroll(TM.page), '(g) no horizontal scroll with a timer running at 390');
      await TM.page.click('#home-timer [data-timer-act=pause]');
      await TM.page.waitForSelector('#home-timer [data-timer-act=resume]');
      await waitFor(() => TM.page.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'flush the pause' });
      const p1 = (await live()).find(i => i.key === 'timer:' + id1);
      ok(p1 && p1.value.pausedAt > 0 && p1.value.endAt == null && p1.value.remaining > 200000 && p1.value.remaining <= 300000, '(g) Pause is stored on the house (pausedAt, remaining, no endAt)', JSON.stringify(p1));
      ok(/Paused/.test(await text(TM.page, '#home-timer .tm-what') || ''), '(g) the card says Paused');
      await TM.page.click('#home-timer [data-timer-act=reset]');
      await waitFor(async () => !(await live()).length, { label: 'the row removed' }).catch(() => {});
      ok(!(await live()).length, '(g) Reset removes the row from the house');
      const tst = await TM.page.$eval('#hub-toast', t => ({ shown: !t.hidden, text: t.textContent, act: (t.querySelector('.toast-act') || {}).textContent }));
      ok(tst.shown && /Timer reset/.test(tst.text) && tst.act === 'Undo', '(g) …with a "Timer reset" toast and Undo', JSON.stringify(tst));
      await TM.page.click('#hub-toast .toast-act');
      await waitFor(() => TM.page.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'flush the undo' });
      const u1 = (await live()).find(i => i.key === 'timer:' + id1);
      ok(u1 && u1.value.startedAt === p1.value.startedAt && u1.value.pausedAt === p1.value.pausedAt && u1.value.remaining === p1.value.remaining, '(g) Undo puts the timer back on the house as it was (same start, still paused, same time left)', JSON.stringify(u1));
      await TM.page.waitForSelector('#home-timer [data-timer-act=resume]', { timeout: 5000 }).catch(() => {});
      ok(!!(await TM.page.$('#home-timer [data-timer-act=resume]')), '(g) …and the card shows it again');
      await TM.page.click('#home-timer [data-timer-act=reset]');
      await waitFor(async () => !(await live()).length, { label: 'the row removed again' }).catch(() => {});
      ok(!(await live()).length, '(g) Reset again (no Undo) and it is gone');
      // core review round 1: Pause on a legacy timer.active (an older app's single row) from the card writes its migrated row
      {
        const t0 = Date.now();
        await api('/api/data/timer/timer.active?scope=person', { method: 'PUT', profile: dadTok, body: { value: { endAt: t0 + 240000, total: 300, startedAt: t0 - 60000 }, updated_at: t0 } });
        await TM.page.evaluate(() => hub.pull());
        await TM.page.waitForSelector('#home-timer [data-timer-act=pause]', { timeout: 8000 }).catch(() => {});
        await TM.page.click('#home-timer [data-timer-act=pause]');
        await TM.page.waitForSelector('#home-timer [data-timer-act=resume]', { timeout: 8000 }).catch(() => {});
        await waitFor(() => TM.page.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'flush the legacy pause' });
        const all = ((await api('/api/data/timer?scope=person', { profile: dadTok })).items || []);
        const mig = all.find(i => i.key === 'timer:m' + (t0 - 60000)), leg = all.find(i => i.key === 'timer.active');
        ok(mig && mig.value && mig.value.pausedAt > 0 && mig.value.total === 300000 && (!leg || leg.value === null) && !(await TM.page.$eval('#hub-toast', t => !t.hidden && t.textContent.includes('Not a timer')).catch(() => false)), '(g) Pause on a legacy timer.active writes its migrated row timer:m<startedAt>, paused, and removes timer.active', JSON.stringify({ mig, leg }));
        await TM.page.click('#home-timer [data-timer-act=reset]');
        await waitFor(async () => !(await live()).length, { label: 'the legacy copy stopped' }).catch(() => {});
      }
      await TM.page.waitForSelector('#home-timer [data-timer-recent]');
      const rec2 = await TM.page.$$eval('#home-timer [data-timer-recent]', bs => bs.map(b => +b.dataset.timerRecent));
      ok(rec2[0] === 300000 && rec2.length >= 1, '(g) 5 minutes is now the first recent length', JSON.stringify(rec2));
      // visual review round 6: with a ringing pill on a phone, a Reset's Undo toast sits above the pill, never over its Stop
      {
        const pasta = await TM.page.evaluate(() => { hub.timers.start({ total: 1000, label: 'Tea' }); return hub.timers.start({ total: 600000, label: 'Pasta' }); });
        await TM.page.waitForSelector('#timer-pill.ringing:not([hidden])', { timeout: 8000 }).catch(() => {});
        await TM.page.waitForSelector(`#home-timer [data-timer-act=reset][data-id="${pasta.id}"]`, { timeout: 8000 });
        await TM.page.click(`#home-timer [data-timer-act=reset][data-id="${pasta.id}"]`);
        await sleep(400);
        const g = await TM.page.evaluate(() => { const R = id => { const e = document.getElementById(id); if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right) }; }; return { toast: R('hub-toast'), pill: R('timer-pill'), ringing: document.getElementById('timer-pill').classList.contains('ringing') }; });
        const apart = g.toast && g.pill && (g.toast.b <= g.pill.t || g.toast.t >= g.pill.b || g.toast.r <= g.pill.l || g.toast.l >= g.pill.r);
        ok(g.ringing && apart, '(g) at 390 the Reset toast and the ringing pill (its Stop) do not overlap', JSON.stringify(g));
        await TM.page.evaluate(() => { document.getElementById('hub-toast').hidden = true; for (const r of hub.timers.list({ stale: true })) hub.timers.clear(r.id, r.startedAt); });
        await sleep(600);
      }
      // core review round 4 (E10): Reset, then a Switch to Ezra within the 6 s: the Undo toast is gone at the picker, and an Undo
      // (the toast's, or hub.timers.restore with Dad's row) writes nothing into Ezra's rows
      {
        const r = await TM.page.evaluate(() => hub.timers.start({ total: 600000, label: 'Roast' }));
        await TM.page.waitForSelector(`#home-timer [data-timer-act=reset][data-id="${r.id}"]`, { timeout: 8000 });
        const was = await TM.page.evaluate(id => hub.timers.list().find(x => x.id === id), r.id);
        await TM.page.click(`#home-timer [data-timer-act=reset][data-id="${r.id}"]`);
        const shown = await TM.page.$eval('#hub-toast', t => !t.hidden && /Roast timer reset/.test(t.textContent));
        await TM.page.click('.tab[data-tab=me]'); await TM.page.click('#switch');
        await TM.page.waitForSelector('.pcard[data-id=ezra]');
        const atPicker = await TM.page.$eval('#hub-toast', t => t.hidden);
        await TM.page.click('.pcard[data-id=ezra]');
        await TM.page.waitForFunction(() => window.hub && hub.profile && hub.profile.id === 'ezra', null, { timeout: 15000 });
        const afterIn = await TM.page.$eval('#hub-toast', t => t.hidden || !/reset/.test(t.textContent));
        const restored = await TM.page.evaluate(w => hub.timers.restore(w), was);
        await TM.page.evaluate(() => hub.flush()).catch(() => {}); await sleep(800);
        const ezraRows = ((await api('/api/data/timer?scope=person', { profile: await asOwner('ezra') })).items || []).filter(i => i.value && /^timer:/.test(i.key));
        ok(shown && atPicker && afterIn, '(g) Reset then Switch within 6 s: the "Roast timer reset · Undo" toast is gone at the picker and after Ezra signs in', JSON.stringify({ shown, atPicker, afterIn }));
        ok(restored === null && !ezraRows.length, "(g) …and an Undo then (hub.timers.restore with Dad's row) writes nothing into Ezra's rows", JSON.stringify({ restored, ezraRows }));
      }
      await TM.ctx.close();
      // visual review round 4: inside another app with a timer running, at XXL on a 375 phone, the viewer bar keeps Back, the
      // timer chip and Reload on screen (the title gives way first), for an adult and a kid
      for (const [who, pin] of [['dad', DAD_PIN], ['ezra', null]]) {
        const V = await newContext(browser, 'V-' + who, 375);
        await signIn(V.page, who, pin);
        await V.page.evaluate(() => { hub.setTextSize('xxl'); for (const r of hub.timers.list({ stale: true })) hub.timers.clear(r.id, r.startedAt); });
        await sleep(400);
        await V.page.evaluate(() => hub.timers.start({ total: 600000 }));
        await V.page.evaluate(() => { location.hash = '#tally'; });
        await V.page.waitForFunction(() => { const f = document.getElementById('frame'); return f && f.dataset.id === 'tally'; }, null, { timeout: 15000 });
        await V.page.waitForSelector('#pill-timer:not([hidden])', { timeout: 8000 }).catch(() => {});
        await V.page.waitForFunction(() => /^9:/.test(document.getElementById('pill-timer-time').textContent), null, { timeout: 5000 }).catch(() => {});   // measured at 9:59, as the review measured it
        await sleep(300);
        const bar = await V.page.evaluate(() => { const r = id => { const e = document.getElementById(id); if (!e || e.hidden || getComputedStyle(e).display === 'none') return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width) }; }; return { vw: innerWidth, back: r('pill-home'), chip: r('pill-timer'), reload: r('pill-reload'), name: r('pill-name'), title: r('pill-label') }; });
        ok(bar.reload && bar.reload.r <= bar.vw && bar.chip && bar.chip.l >= 0 && bar.chip.r <= bar.vw && bar.back && bar.back.l >= 0, `(g) ${who} at XXL on 375, in Tally with a timer running: Back, the chip (${bar.chip && bar.chip.w} px) and Reload (right edge ${bar.reload && bar.reload.r}) are on screen`, JSON.stringify(bar));
        // visual review round 5: the title keeps its room (an adult as at HEAD; a kid: Back is its arrow, the chevron goes beside the chip)
        ok(bar.title && bar.title.w >= (who === 'ezra' ? 70 : 120), `(g) ${who}: the title keeps ${bar.title && bar.title.w} px (at least ${who === 'ezra' ? 70 : 120})`, JSON.stringify(bar));
        await V.page.evaluate(() => { hub.setTextSize('m'); for (const r of hub.timers.list({ stale: true })) hub.timers.clear(r.id, r.startedAt); });
        await sleep(800); await V.page.evaluate(() => hub.flush()).catch(() => {});
        await V.ctx.close();
      }
    }

    console.log('\n## kid Home (Ezra, 390)');
    const K = await newContext(browser, 'K');
    await signIn(K.page, 'ezra');
    await K.page.waitForSelector('#view-home .stars-card');
    ok(await text(K.page, '.stars-card .gbig') === '3 stars this week', '(c) Stars card: 3 stars this week from app_data(kidverse, person, stars)', await text(K.page, '.stars-card .gbig'));
    ok(/3 stars this week/.test(await text(K.page, '.home-hero .hero-sub') || ''), '(c) kid hero mentions the stars');
    ok(await K.page.$eval('.stars-card .spot', i => /art\/hero\/play\.svg$/.test(i.src)), '(c) play.svg art on the Stars card');
    const sArt = await artSample(K.page, '.stars-card');
    ok(/linear-gradient/.test(sArt.bg) && sArt.loaded && sArt.op >= .5, '(c) Stars card: gold wash applied under the art on Hearth', JSON.stringify({ bg: sArt.bg.slice(0, 40), loaded: sArt.loaded, op: sArt.op }));
    ok(sArt.diff != null && sArt.diff >= 20, '(c) Stars card: the art is visible on Hearth (circle pixel differs from the wash)', JSON.stringify(sArt));
    // the same card on a dark palette: the white art must fade to a faint ghost so it never glares under the words
    await K.page.evaluate(() => { document.documentElement.dataset.theme = 'midnight'; document.documentElement.dataset.scheme = 'dark'; }); await sleep(250);
    const dArt = await artSample(K.page, '.stars-card');
    ok(dArt.op <= .2 && dArt.diff != null && dArt.diff >= 10 && dArt.diff <= 90, '(c) Stars card on Midnight: art at ≤ .2 opacity, a faint ghost (pixel diff 10–90 of 765)', JSON.stringify(dArt));
    await K.page.evaluate(() => document.querySelector('.stars-card').scrollIntoView()); await sleep(150);
    await K.page.screenshot({ path: path.join(SHOTS, 'rm13-kid-390-midnight.png'), fullPage: false });
    await K.page.evaluate(() => { document.documentElement.dataset.theme = 'hearth'; document.documentElement.dataset.scheme = 'light'; document.getElementById('views').scrollTo(0, 0); }); await sleep(250);
    ok(!!(await K.page.$('.park-card')), '(b) kids see the park card too');
    const krows = await parkRows(K.page), kexp = await expectedPark(dadTok);
    ok(krows.map(r => r.name).join(',') === kexp.names && krows.map(r => r.when).join(',') === kexp.whens && krows.every(r => !r.clipped && r.inside), '(b) kid scale: every row with its time, nothing clipped', JSON.stringify([krows, kexp.names, kexp.whens]));
    ok(!(await K.page.$('#feed')) && !(await K.page.$('.prayer-card')), 'kid Home stays simple: no feed, no adult cards');
    ok(!(await K.page.$('.pf-line')), '(e) the kid Home never has the asker\'s line (Ezra prayed on two of them)');
    ok(!(await K.page.$('.verses-card')), '(f) the kid Home keeps its picture tiles: no Verses card');
    ok(!(await K.page.$('#home-timer')) && !!(await K.page.$('.kid-tile[data-open=timer]')), '(g) the kid Home has no Timer card; its Timer picture tile stays');
    const kol = await oneLiners(K.page);
    ok(kol.length >= 2 && kol.every(o => o.one), 'kid cards: secondary text is one line at 390 (kid type scale)', JSON.stringify(kol.filter(o => !o.one)));
    ok(await noHScroll(K.page), 'no horizontal scroll (kid)');
    await K.page.screenshot({ path: path.join(SHOTS, 'rm13-kid-390.png'), fullPage: false });
    const K2 = await K.ctx.newPage(); await K2.route('**/api/**', r => r.abort());
    await K2.goto(SITE + '/index.html'); await K2.waitForSelector('#view-home .stars-card', { timeout: 15000 });
    ok(await K2.evaluate(() => hub.sync.lastPull === 0 && document.querySelector('.stars-card .gbig').textContent.trim() === '3 stars this week' && !document.querySelector('#view-home .skeleton')), 'AC: kid Stars card from the cache before any pull');
    await K2.close();
    // Kiara has no stars row this week
    await K.page.click('.tab[data-tab=me]'); await K.page.click('#switch'); await K.page.waitForSelector('.pcard[data-id]');
    await signIn(K.page, 'kiara'); await K.page.click('.tab[data-tab=home]');
    await K.page.waitForSelector('#view-home .stars-card');
    // Audit batch 0b (P2-HOME-04): until Kiara's stars row has been pulled on this device the card is a skeleton, never ★0
    await K.page.waitForFunction(() => hub.isLoaded('kidverse', 'person') && !document.querySelector('.stars-card .skeleton'), null, { timeout: 15000 });
    ok(await text(K.page, '.stars-card .gbig') === 'No stars yet', '(c) no stars row → 0 with an inviting line', await text(K.page, '.stars-card .gbig'));
    ok(await text(K.page, '.stars-card .gsub') === 'Learn a verse to earn your first!', '(c) the inviting empty line');
    await sleep(600);
    await K.page.screenshot({ path: path.join(SHOTS, 'rm13-kid-empty-390.png'), fullPage: false });
    await K.ctx.close();

    console.log('\n## park card with four people, then the pins go stale');
    const dad = await asOwner('dad');
    const put = (id, t, name) => ownRow('dollywood-live', 'loc:' + id, id, { x: 1000, y: 700, t, name }, Date.now());   // each dot by its owner (batch 0d)
    await put('christian', Date.now() - 12 * 60e3, 'Mae'); await put('dad', Date.now() - 65 * 60e3, 'David');   // (the shell shows hub.people() names, whatever the local DB calls them)
    await A.page.evaluate(() => hub.pull());
    await waitFor(() => A.page.evaluate(() => document.querySelectorAll('.park-card .park-list li').length >= 4 && [...document.querySelectorAll('.park-card .pt')].some(e => e.textContent.trim() === '1h ago')), { label: 'four people on the park card' });
    const rows4 = await parkRows(A.page), exp4 = await expectedPark(dad);
    ok(await text(A.page, '.park-card .gbig') === exp4.headline && /^\d+ of the family$/.test(exp4.headline), '(b) four+ people: the headline counts instead of clipping names', await text(A.page, '.park-card .gbig'));
    ok(rows4.length >= 4 && rows4.map(r => r.name).join(',') === exp4.names && rows4.map(r => r.when).join(',') === exp4.whens && rows4.find(r => r.name === PEOPLE.dad.name).when === '1h ago', '(b) four+ rows, most recent first, each with its own time', JSON.stringify([rows4, exp4.names, exp4.whens]));
    ok(rows4.every(r => !r.clipped && r.inside), '(b) four people at 390: every time still fully visible', JSON.stringify(rows4));
    ok((await oneLiners(A.page)).every(o => o.one), '(b) four people: secondary text still one line and unclipped');
    await A.page.evaluate(() => document.querySelector('.park-card').scrollIntoView()); await sleep(150);
    await A.page.screenshot({ path: path.join(SHOTS, 'rm13-park-four-390.png'), fullPage: false });
    await put('ezra', Date.now() - 5 * 3600e3, 'Ezra'); await put('christian', Date.now() - 5 * 3600e3, 'Mae'); await put('dad', Date.now() - 5 * 3600e3, 'David');
    await A.page.evaluate(() => hub.pull());
    await waitFor(() => A.page.evaluate(() => { const c = document.querySelector('.park-card'); return !c || !/Ezra/.test(c.textContent); }), { label: 'Ezra off the park card' });
    ok(true, '(b) Ezra drops off the card once his pin is older than 4 h');
    const others = await A.page.evaluate(() => hub.list('loc:', { app: 'dollywood-live', scope: 'family' }).filter(r => r.value && Date.now() - r.value.t < 4 * 3600e3).length);
    ok(others ? !!(await A.page.$('.park-card')) : !(await A.page.$('.park-card')), others ? '(b) card stays for the other fresh pins (Kiara)' : '(b) card hidden once every pin is older than 4 h');
    await put('kiara', Date.now() - 5 * 3600e3, 'Kiara');
    await A.page.evaluate(() => hub.pull());
    const left = (await expectedPark(dad)).who;
    if (left.length) ok(true, '(b) (skipped: another suite holds fresh pins for ' + left.map(w => w.name).join(', ') + ')');
    else { await waitFor(() => A.page.evaluate(() => !document.querySelector('.park-card')), { label: 'park card gone' }); ok(true, '(b) card hidden once every pin is older than 4 h'); }

    console.log('\n## batch 10 (P3-DOLLYWOOD-LIVE-06): a fix from outside the property is not "at the park"');
    {
      const off = (id, x, y) => ownRow('dollywood-live', 'loc:' + id, id, { x, y, acc: 10, t: Date.now(), name: id }, Date.now());
      const mae = PEOPLE.christian.name, names = () => A.page.evaluate(() => [...document.querySelectorAll('.park-card .park-list .pn')].map(e => e.textContent.trim()));
      await off('christian', 2500 + 400, 700);                           // 400 m east of the property box (the frame plus 300 m, widened to hold the parking lots): the road, or home
      await A.page.evaluate(() => hub.pull()); await sleep(900);
      ok(!(await names()).includes(mae), '(b) a dot 400 m past the property edge is not on the park card', JSON.stringify(await names()));
      await off('christian', -250, 900);                                 // 250 m west of the frame: still the property
      await A.page.evaluate(() => hub.pull());
      await waitFor(async () => (await names()).includes(mae), { label: 'Mae on the park card (on the property)' });
      ok(true, '(b) a dot 250 m outside the frame is still the property: Mae is on the card');
      await off('christian', 1500, 3000);                               // the far parking lot (R-park 1): inside the map's property polygon, so on the card
      await A.page.evaluate(() => hub.pull());
      await waitFor(async () => (await names()).includes(mae), { label: 'Mae on the park card (in the parking lot)' });
      ok(true, '(b) a dot in the far parking lot (1500, 3000) is on the card');
      await off('christian', 1000, 3510 + 40);                           // 40 m past the north border
      await A.page.evaluate(() => hub.pull());
      await waitFor(async () => !(await names()).includes(mae), { label: 'Mae off the park card (past the border)' });
      ok(true, '(b) a dot 40 m past the north border is off the card');
      await off('christian', 1000, 700); await off('christian', 5000, 5000);   // an old fix on the property, then a newer one far away: the newest row wins
      await A.page.evaluate(() => hub.pull()); await sleep(600);
      ok(!(await names()).includes(mae), '(b) the newest row decides: a far dot replaced the park dot', JSON.stringify(await names()));
      await ownRow('dollywood-live', 'loc:christian', 'christian', { x: 1000, y: 700, acc: 10, t: Date.now() - 5 * 3600e3, name: 'christian' }, Date.now());
    }

    console.log('\n## batch 9 (UX-DOLLYWOOD-1): the build guide card on Home (David, 390)');
    {
      const t0 = Date.now() + 2000, sum = (o = {}) => ({ next: { id: 'entrance-8', title: 'Blueprint the section', sec: 'entrance', secName: 'Entrance & Plaza', i: 8, n: 9 }, secDone: 7, secTotal: 9, done: 30, total: 242, at: new Date().toISOString(), ...o });
      const card = () => A.page.$eval('#view-home .guide-card', c => ({ head: c.querySelector('h2').textContent.trim(), big: c.querySelector('.gbig').textContent.trim(), sub: c.querySelector('.gsub').textContent.trim(), btn: c.querySelector('[data-open]').textContent.trim(), open: c.querySelector('[data-open]').dataset.open, accent: c.dataset.accent, art: c.querySelector('.spot').getAttribute('src'), inFoot: !!c.querySelector('.gfoot > .spot'), btnH: Math.round(c.querySelector('[data-open]').getBoundingClientRect().height) })).catch(() => null);
      await A.page.click('.tab[data-tab=home]');
      ok(!(await A.page.$('#view-home .guide-card')), '(h) no summary row, no guide card');
      await api('/api/data/dollywood/summary?scope=person', { method: 'PUT', profile: dadTok, body: { value: sum(), updated_at: t0 } });
      await A.page.evaluate(() => hub.pull());
      await waitFor(() => A.page.$('#view-home .guide-card'), { label: 'the guide card' });
      let c = await card();
      ok(c && c.head === 'Build guide' && c.big === 'Next: Blueprint the section' && c.sub === 'Entrance & Plaza \u00b7 7 of 9 done' && c.btn === 'Continue' && c.open === 'dollywood', '(h) "Build guide", "Next: Blueprint the section", "Entrance & Plaza \u00b7 7 of 9 done", Continue', JSON.stringify(c));
      ok(c.accent === 'orchid' && c.art === 'art/app/dollywood.svg' && c.inFoot && c.btnH >= 44, '(h) orchid, its spot art in the footer, a 44 px button', JSON.stringify(c));
      const keep = await A.page.evaluate(() => { window.__heroKeep = document.querySelector('#view-home [data-part="hero"] > *'); window.__verseKeep = document.querySelector('#view-home .verses-card'); return true; });
      await api('/api/data/dollywood/summary?scope=person', { method: 'PUT', profile: dadTok, body: { value: sum({ next: { id: 'entrance-9', title: 'Finish the plaza', sec: 'entrance', secName: 'Entrance & Plaza', i: 9, n: 9 }, secDone: 8, done: 31 }), updated_at: t0 + 1 } });
      await A.page.evaluate(() => hub.pull());
      await waitFor(async () => (await card() || {}).big === 'Next: Finish the plaza', { label: 'the card follows the summary' });
      ok(await A.page.evaluate(() => window.__heroKeep === document.querySelector('#view-home [data-part="hero"] > *') && (!window.__verseKeep || window.__verseKeep === document.querySelector('#view-home .verses-card'))), '(h) patched in place: the hero and the Verses card were not replaced');
      await api('/api/data/dollywood/summary?scope=person', { method: 'PUT', profile: dadTok, body: { value: sum({ next: null, done: 242, secDone: 0, secTotal: 0 }), updated_at: t0 + 2 } });
      await A.page.evaluate(() => hub.pull());
      await waitFor(async () => (await card() || {}).big === 'All 242 steps built', { label: 'all built' });
      c = await card();
      ok(c.btn === 'Open the guide' && !/undefined|NaN/.test(c.sub), '(h) everything ticked: "All 242 steps built" and "Open the guide"', JSON.stringify(c));
      await A.page.click('#view-home .guide-card [data-open="dollywood"]');
      ok(await waitFor(() => A.page.$eval('#frame', f => /apps\/dollywood\.html/.test(f.src))), '(h) the card opens the build guide');
      await A.page.keyboard.press('Escape'); await sleep(300);
      // review R-guide 1 and round 2: while Home's first pull is on its way the card keeps its place as a skeleton, but only for
      // someone this device saw with a summary row (the hint hub.guideHint.<id>), and it is the settled card's own text in skeleton
      // paint, so its height is the settled card's at every width; someone with no row takes no place at all
      const cardH = () => A.page.evaluate(() => { const c = document.querySelector('#view-home .guide-card'); return c ? { h: Math.round(c.getBoundingClientRect().height), loading: c.classList.contains('is-loading'), skel: !!c.querySelector('.gbig .skeleton'), lastPull: hub.sync.lastPull } : null; });
      const clearCache = () => A.page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/^hub\.cache\.dollywood\./.test(k)) localStorage.removeItem(k); });
      const hold = async r => { await sleep(3500); r.continue().catch(() => {}); };
      for (const [w, hgt] of [[390, 844], [820, 1180], [1180, 820]]) {
        await A.page.setViewportSize({ width: w, height: hgt }); await sleep(400);
        await waitFor(async () => (await cardH() || {}).loading === false, { label: 'the settled guide card at ' + w });
        const settled = await cardH();
        await clearCache(); await A.page.route('**/api/data/**', hold);
        await A.page.reload(); await A.page.waitForSelector('#view-home .gcard', { timeout: 15000 });
        const ld = await cardH();
        ok(ld && ld.loading && ld.skel && ld.lastPull === 0 && ld.h === settled.h, '(h) at ' + w + ' the loading skeleton is the settled card height (' + (ld && ld.h) + ' vs ' + settled.h + ')', JSON.stringify({ ld, settled }));
        await A.page.unroute('**/api/data/**', hold);
        await waitFor(async () => (await cardH() || {}).loading === false, { label: 'the real guide card after the pull', timeout: 20000 });
        ok((await cardH()).h === settled.h, '(h) the real card keeps that height when the summary arrives (' + w + ')');
      }
      await A.page.setViewportSize({ width: 390, height: 844 });
      // no row: no skeleton, no card, no place taken (the hint is cleared by a pull that shows none)
      await api('/api/data/dollywood/summary?scope=person', { method: 'DELETE', profile: dadTok }).catch(() => {});
      await A.page.evaluate(() => hub.pull()); await sleep(800);
      await waitFor(async () => !(await cardH()), { label: 'the card gone with its row' });
      ok(await A.page.evaluate(() => localStorage.getItem('hub.guideHint.' + hub.profile.id) === null), '(h) the hint is cleared once a pull shows no row');
      await clearCache(); await A.page.route('**/api/data/**', hold);
      await A.page.reload(); await A.page.waitForSelector('#view-home .gcard', { timeout: 15000 }); await sleep(600);
      ok(!(await cardH()), '(h) a person with no row never shows a skeleton while Home loads (nothing to jump)');
      await A.page.unroute('**/api/data/**', hold);
      const KD = await newContext(browser, 'guide-kid'); await signIn(KD.page, 'ezra');
      ok(!(await KD.page.$('#view-home .guide-card')), '(h) never on a kid\'s Home');
      await KD.ctx.close();
      await api('/api/data/dollywood/summary?scope=person', { method: 'DELETE', profile: dadTok }).catch(() => {});
    }
    await A.ctx.close();

    console.log('\n## batch 7 (UX-KIDVERSE-5): no family week has ever been set');
    // a new household has no kidverse 'week' row. Home must still paint every card (nothing on Home reads the week), and Kid
    // Verse itself says so: a grown-up is asked to pick one, a kid sees a picture and one sentence; never a made-up week 1.
    const wasWeek = (await api('/api/data/kidverse?scope=family&key=week', { profile: dadTok })).item;
    await api('/api/data/kidverse/week?scope=family', { method: 'DELETE', profile: dadTok });
    const NA = await newContext(browser, 'no-week-adult');
    await signIn(NA.page, 'dad', DAD_PIN);
    await waitFor(() => NA.page.evaluate(() => hub.get('week', { app: 'kidverse', scope: 'family' }) == null && hub.isLoaded('kidverse', 'family')), { label: 'no week on the adult device' });
    const homeNo = await NA.page.evaluate(() => ({ cards: document.querySelectorAll('#view-home .gcard').length, kids: !!document.querySelector('#view-home .kids-card'), text: document.getElementById('view-home').innerText }));
    ok(homeNo.cards > 0 && homeNo.kids && !/undefined|NaN/.test(homeNo.text), '(b) no family week: the adult Home still paints its cards (the Kids card included), no "undefined" or "NaN"', JSON.stringify({ cards: homeNo.cards, kids: homeNo.kids }));
    await NA.page.click('.tab[data-tab=apps]'); await NA.page.waitForSelector('.tile[data-id=kidverse]'); await NA.page.click('.tile[data-id=kidverse]');
    const fa = await waitFor(() => NA.page.frames().find(f => /apps\/kidverse\.html/.test(f.url())), { label: 'kidverse frame (adult)' });
    await fa.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0 && document.querySelector('.wrap') && hub.isLoaded('kidverse', 'family'), null, { timeout: 15000 });
    await sleep(700);
    const adultNo = await fa.evaluate(() => ({ text: document.body.innerText, ref: (document.getElementById('ref') || {}).textContent || '', scene: (document.getElementById('art') || { dataset: {} }).dataset.scene || '' }));
    ok(/pick this week/i.test(adultNo.text) && !/Genesis 1:27/.test(adultNo.text) && !adultNo.scene, '(b) Kid Verse for a grown-up with no week: "Pick this week’s verse", never Genesis 1:27 or the creation art', JSON.stringify({ ref: adultNo.ref, scene: adultNo.scene }));
    await NA.ctx.close();
    const NK = await newContext(browser, 'no-week-kid');
    await signIn(NK.page, 'ezra');
    ok(await NK.page.$('.stars-card') !== null, '(b) no family week: the kid Home still paints its Stars card');
    await NK.page.click('.stars-card [data-open="kidverse"]');
    const fk = await waitFor(() => NK.page.frames().find(f => /apps\/kidverse\.html/.test(f.url())), { label: 'kidverse frame (kid)' });
    await fk.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0 && document.querySelector('.wrap') && hub.isLoaded('kidverse', 'family'), null, { timeout: 15000 });
    await sleep(700);
    const kidNo = await fk.evaluate(() => { const v = id => { const e = document.getElementById(id); return !!e && !e.hidden && e.getClientRects().length > 0; }; return { placeholder: v('no-week-kid'), text: (document.getElementById('no-week-text') || {}).textContent || '', done: v('done'), body: document.body.innerText }; });
    ok(kidNo.placeholder && /grown-up will pick/i.test(kidNo.text) && !kidNo.done && !/Genesis 1:27/.test(kidNo.body), '(b) Kid Verse for a kid with no week: a picture and "A grown-up will pick this week’s verse", no Done button (no verse star while no week is set)', JSON.stringify(kidNo).slice(0, 300));
    await NK.ctx.close();
    if (wasWeek && wasWeek.value) await api('/api/data/kidverse/week?scope=family', { method: 'PUT', profile: dadTok, body: { value: wasWeek.value, updated_at: Date.now() } });   // the household's week back

    ok(errors.length === 0, 'no page errors', errors.slice(0, 5).join(' | '));
  } catch (e) { fail++; console.log('  ✗ crashed:', e.stack || e.message); }
  finally { if (globalThis.__pfCleanup) await globalThis.__pfCleanup(); if (globalThis.__versesCleanup) await globalThis.__versesCleanup(); await browser.close(); server.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
