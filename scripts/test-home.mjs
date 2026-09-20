#!/usr/bin/env node
// Roadmap 13 checks: Home widgets round 2.
//   (a) the Prayer card says "N to pray · M done" for today, derived from the prayer app's person-scope rows
//   (b) an "At the park" card lists who has a fresh (< 4 h) dollywood-live loc:<id> row — one row per person with a face and
//       that person's last-seen time, nothing clipped at 390 even with four people — and hides otherwise
//   (c) kids get a Stars card from app_data(kidverse, person, 'stars'); adults get "Ezra ★3 · Kiara ★0" from
//       the family mirror stars:<kidId> — both { week: 'YYYY-Www', count: n }, a stale week counts as 0
//   (d) the feed groups consecutive lines by person, shows an app icon per line, relative times, and "Show more"
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
const pad = n => String(n).padStart(2, '0');
const dayKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const isoWeek = d => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); return y + '-W' + pad(Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7)); };
const TODAY = dayKey(new Date()), YESTERDAY = dayKey(new Date(Date.now() - 86400000)), WEEK = isoWeek(new Date()), LAST_WEEK = isoWeek(new Date(Date.now() - 7 * 86400000));
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
const prayer = (id, title, extra) => ({ id, title, category: 'Family', detail: '', for: '', phone: '', cadence: 'daily', days: [], status: 'active', createdAt: YESTERDAY, lastPrayedAt: null, answeredAt: null, answerNote: null, updates: [], sharedFrom: null, prayedBy: {}, updatedAt: new Date().toISOString(), ...extra });
async function seed() {
  DEVICE = (await api('/api/pair', { method: 'POST', body: { code: CODE, name: 'test-home seeder' } })).device_token;
  const dad = await login('dad', DAD_PIN), ezra = await login('ezra'), kiara = await login('kiara');
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
  await api('/api/data/dollywood-live/batch?scope=family', { method: 'POST', profile: dad, body: { items: rows([
    ['loc:ezra', { x: 1200, y: 800, acc: 12, hdg: null, t: now - 5 * 60e3, name: 'Ezra', emoji: '🦖', color: '#137F77' }],
    ['loc:kiara', { x: 900, y: 700, acc: 20, hdg: null, t: now - 3 * 60e3, name: 'Kiara', emoji: '🦄', color: '#B4861B' }],
    ['loc:christian', { x: 600, y: 500, acc: 9, hdg: null, t: now - 5 * 3600e3, name: 'Mae' }],
  ]) } });
  // (c) stars: Ezra 3 this week (person + family mirror), Kiara 7 last week (stale → 0)
  await api('/api/data/kidverse/batch?scope=family', { method: 'POST', profile: dad, body: { items: rows([
    ['stars:ezra', { week: WEEK, count: 3 }], ['stars:kiara', { week: LAST_WEEK, count: 7 }],
  ]) } });
  await api('/api/data/kidverse/stars?scope=person', { method: 'PUT', profile: ezra, body: { value: { week: WEEK, count: 3 }, updated_at: now } });
  await api('/api/data/kidverse/stars?scope=person', { method: 'DELETE', profile: kiara }).catch(() => {});
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
      fridge: [...document.querySelectorAll('#view-home .gcard .gbig')][1].textContent.trim(),
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
    await K.page.evaluate(() => { delete document.documentElement.dataset.theme; document.documentElement.dataset.scheme = 'light'; document.getElementById('views').scrollTo(0, 0); }); await sleep(250);
    ok(!!(await K.page.$('.park-card')), '(b) kids see the park card too');
    const krows = await parkRows(K.page), kexp = await expectedPark(dadTok);
    ok(krows.map(r => r.name).join(',') === kexp.names && krows.map(r => r.when).join(',') === kexp.whens && krows.every(r => !r.clipped && r.inside), '(b) kid scale: every row with its time, nothing clipped', JSON.stringify([krows, kexp.names, kexp.whens]));
    ok(!(await K.page.$('#feed')) && !(await K.page.$('.prayer-card')), 'kid Home stays simple: no feed, no adult cards');
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
    ok(await text(K.page, '.stars-card .gbig') === 'No stars yet', '(c) no stars row → 0 with an inviting line', await text(K.page, '.stars-card .gbig'));
    ok(await text(K.page, '.stars-card .gsub') === 'Learn a verse to earn your first!', '(c) the inviting empty line');
    await sleep(600);
    await K.page.screenshot({ path: path.join(SHOTS, 'rm13-kid-empty-390.png'), fullPage: false });
    await K.ctx.close();

    console.log('\n## park card with four people, then the pins go stale');
    const dad = await login('dad', DAD_PIN);
    const put = (id, t, name) => api('/api/data/dollywood-live/loc:' + id + '?scope=family', { method: 'PUT', profile: dad, body: { value: { x: 1000, y: 700, t, name }, updated_at: Date.now() } });
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
    await A.ctx.close();

    ok(errors.length === 0, 'no page errors', errors.slice(0, 5).join(' | '));
  } catch (e) { fail++; console.log('  ✗ crashed:', e.stack || e.message); }
  finally { await browser.close(); server.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
