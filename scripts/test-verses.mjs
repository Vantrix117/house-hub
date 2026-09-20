#!/usr/bin/env node
// Roadmap 19 checks: Verses (apps/verses.html) — a Leitner memory-verse trainer over the person's F260 memory verses.
//   (a) registration: apps.json entry (person scope, small tile, visible to all seven people and not the TV), duotone icon,
//       spot art, no hex / prefers-color-scheme in the app's CSS
//   (b) adult flow (Eli, 390): six memorised verses seeded in f260.mem — four never reviewed (one with verse text on file
//       in f260.verses, one with a pre-Leitner F260 recall row), one overdue, one not due until tomorrow. The due queue
//       holds five, never-reviewed first; rating buttons stay hidden until Show; Got it / Almost / Not yet move the box
//       up / hold / down and set due = today + [1,2,4,7,14][box-1]; every rating lands in f260.recall (person scope,
//       app f260) with { s, t, box, due, last, streak }; the queue empties; the day streak counts yesterday (seeded) + today
//   (c) the summary row app_data(verses, person, summary) = { due, streak, boxes, total, reviewedToday, week, at }
//       and the feed line "Eli reviewed 5 memory verses"
//   (d) a second device as Eli sees the same boxes and an empty queue
//   (e) kid flow (Ezra, 390): this family week's two verses only, no stats, no paraphrase, every control ≥ 64 px,
//       Read aloud speaks the reference at rate 0.85, two ratings → "All done for today" + Practise again; ratings in
//       Ezra's own f260.recall; the summary carries the week
//   (f) the kiosk opens the page standalone without crashing and cannot write
//   cd worker && npx wrangler dev --port 8787     (seeded local D1; Eli PIN 1357)
//   node scripts/test-verses.mjs <pairing-code>
// Serves the repo on :9019 and proxies /api to the Worker, so it never needs :8765.
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
const PORT = 9019;
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
const shift = (n, from = new Date()) => { const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + n); return dayKey(d); };
const TODAY = dayKey(new Date()), YESTERDAY = shift(-1), TOMORROW = shift(1);
const row = async (tok, app, scope, key) => (await api(`/api/data/${app}?scope=${scope}`, { profile: tok })).items.find(r => r.key === key);
const put = (tok, app, key, value) => api(`/api/data/${app}/${encodeURIComponent(key)}?scope=person`, { method: 'PUT', profile: tok, body: { value, updated_at: Date.now() } });
const del = (tok, app, key, scope = 'person') => api(`/api/data/${app}/${encodeURIComponent(key)}?scope=${scope}`, { method: 'DELETE', profile: tok }).catch(() => {});
let T = {};
const MEM = { '1-0': true, '3-1': true, '12-0': true, '20-1': true, '30-0': true, '40-0': true };
const TEXT_12 = 'This is the verse text Eli pasted into F260 once, for practice — not a quotation.';
async function seed() {
  DEVICE = (await api('/api/pair', { method: 'POST', body: { code: CODE, name: 'test-verses seeder' } })).device_token;
  T = { eli: await login('eli', ELI_PIN), ezra: await login('ezra'), tv: await login('tv') };
  // Eli: six memorised verses, one with text on file, one pre-Leitner F260 rating, one overdue, one due tomorrow, a review yesterday
  await put(T.eli, 'f260', 'f260.mem', MEM);
  await put(T.eli, 'f260', 'f260.verses', { '12-0': TEXT_12 });
  await put(T.eli, 'f260', 'f260.recall', {
    '20-1': { s: 'not', t: Date.now() - 86400000 * 3 },
    '30-0': { s: 'got', t: Date.now() - 86400000 * 5, box: 3, due: YESTERDAY, last: shift(-5), streak: 2 },
    '40-0': { s: 'got', t: Date.now() - 86400000 * 6, box: 4, due: TOMORROW, last: shift(-6), streak: 3 },
  });
  await put(T.eli, 'verses', 'log', { [YESTERDAY]: 2 });
  await del(T.eli, 'verses', 'summary');
  // Ezra: a clean slate (the family week is set right before his section — other suites on the shared Worker move it)
  await del(T.ezra, 'f260', 'f260.recall'); await del(T.ezra, 'verses', 'log'); await del(T.ezra, 'verses', 'summary');
}
const REFS = (() => { const src = fs.readFileSync(path.join(ROOT, 'apps/verses.html'), 'utf8'); const m = src.match(/const REFS = \[([\s\S]*?)\n  \];/); return new Function('return [' + m[1] + ']')(); })();
const setWeek = w => api('/api/data/kidverse/week?scope=family', { method: 'PUT', profile: T.eli, body: { value: { week: w, by: 'test' }, updated_at: Date.now() } });

// ── browser ──────────────────────────────────────────────────────
const errors = [];
async function newContext(browser, name, width = 390) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, deviceScaleFactor: 2, hasTouch: width < 700, isMobile: width < 700, colorScheme: 'light' });
  await ctx.addInitScript(api => { try { localStorage.setItem('hub.api', JSON.stringify(api)); } catch {} }, SITE);
  // headless Chrome has no audio: record what the app asks speechSynthesis to say and finish each utterance at once
  await ctx.addInitScript(() => {
    const real = window.speechSynthesis;
    window.__spoken = [];
    const fake = {
      speak(u) { window.__spoken.push({ text: u.text, rate: u.rate, lang: u.lang }); setTimeout(() => { try { u.onend && u.onend({}); } catch {} }, 40); },
      cancel() {}, pause() {}, resume() {}, get speaking() { return false; }, get pending() { return false; },
      getVoices() { try { return real ? real.getVoices() : []; } catch { return []; } },
      addEventListener() {}, removeEventListener() {},
    };
    try { Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true }); } catch {}
  });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(name + ': ' + m.text()); });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  await page.goto(SITE + '/index.html'); await page.waitForSelector('#paircode');
  await page.fill('#paircode', CODE); await page.click('#pairform button[type=submit]'); await page.waitForSelector('.pcard[data-id]');
  return { ctx, page };
}
// The local Worker is shared with other suites, which reset the DB whenever they start: if a sign-in does not land,
// set the PIN again through the API, reload, re-pair if the device was wiped, and try once more.
async function signIn(page, id, pin, retry = true) {
  try {
    await page.click(`.pcard[data-id=${id}]`);
    if (pin) {
      await page.waitForSelector('#pad'); await sleep(450);
      for (const d of pin) await page.click(`#pad [data-d="${d}"]`); await page.click('#pingo');
    }
    await page.waitForSelector('#shell:not([hidden])', { timeout: 15000 });
    await page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 });
  } catch (e) {
    if (!retry) throw e;
    console.log('  … sign-in as ' + id + ' did not land (' + (await text(page, '#hub-toast') || e.message.split('\n')[0]) + '); the shared DB may have been reset — retrying once');
    try { DEVICE = (await api('/api/pair', { method: 'POST', body: { code: CODE, name: 'test-verses seeder' } })).device_token; if (pin) await login(id, pin); } catch {}
    await page.goto(SITE + '/index.html');
    if (await page.$('#paircode')) { await page.fill('#paircode', CODE); await page.click('#pairform button[type=submit]'); }
    await page.waitForSelector('.pcard[data-id]');
    await signIn(page, id, pin, false);
  }
}
const text = (page, sel) => page.$eval(sel, e => e.textContent.trim().replace(/\s+/g, ' ')).catch(() => null);
const visible = (page, sel) => page.$eval(sel, e => !e.hidden && e.offsetParent !== null).catch(() => false);
async function openApp(page) {
  await page.click('.tab[data-tab=apps]'); await page.waitForSelector('.tile[data-id=verses]');
  await page.click('.tile[data-id=verses]');
  const fr = await waitFor(() => page.frames().find(f => /apps\/verses\.html/.test(f.url())), { label: 'verses frame' });
  await fr.waitForFunction(() => window.verses && window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 });
  await sleep(150);
  return fr;
}
const synced = fr => fr.waitForFunction(() => hub.sync.state === 'synced', null, { timeout: 15000 });
const box = (fr, sel) => fr.$eval(sel, e => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; }).catch(() => null);
// Show, then rate the card on screen; returns the reference that was rated
async function rateCard(fr, kind) {
  const ref = await text(fr, '#ref');
  await fr.click('#show'); await sleep(60);
  await fr.click(`#act-rate [data-rate="${kind}"]`); await sleep(120);
  return ref;
}

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    console.log('\n## seed'); await seed(); ok(true, 'paired, signed in Eli/Ezra/TV; Eli has 6 memorised verses (4 new, 1 overdue, 1 due tomorrow) and a review yesterday; family week → 5');

    console.log('\n## (a) registration');
    const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps.find(a => a.id === 'verses');
    ok(reg && reg.file === 'apps/verses.html' && reg.scope === 'person' && reg.tile === 'small' && /^#/.test(reg.color) && reg.icon === 'icons/verses.svg', 'apps.json: verses registered (person, small, icon)', JSON.stringify(reg));
    ok(reg && Array.isArray(reg.visibleTo) && reg.visibleTo.length === 7 && ['eli', 'christian', 'mom', 'dad', 'niece', 'ezra', 'kiara'].every(id => reg.visibleTo.includes(id)) && !reg.visibleTo.includes('tv'), 'visible to all seven people and not the TV');
    ok(fs.existsSync(path.join(ROOT, 'icons/verses.svg')) && /class="duo"/.test(fs.readFileSync(path.join(ROOT, 'icons/verses.svg'), 'utf8')) && fs.existsSync(path.join(ROOT, 'art/app/verses.svg')), 'icon (duotone) + spot art exist');
    ok(/app\.verses = svg\(200, 160/.test(fs.readFileSync(path.join(ROOT, 'scripts/make-art.mjs'), 'utf8')), 'the spot art comes from scripts/make-art.mjs');
    const src = fs.readFileSync(path.join(ROOT, 'apps/verses.html'), 'utf8');
    ok(!/#[0-9a-f]{3,8}\b/i.test(src.slice(src.indexOf('<style>'), src.indexOf('</style>'))) && !/prefers-color-scheme/.test(src), 'no hex and no prefers-color-scheme in the app\'s CSS');
    ok(/data-app="verses" data-scope="person"/.test(src) && /hub\.use\('f260', 'person'\)/.test(src), 'hub.js with app id verses, person scope; reads F260 through hub.use');
    ok(/f260\.recall\s+\{ "<week>-<i>"/.test(src) && /box: 1\.\.5/.test(src) && /due: 'YYYY-MM-DD'/.test(src), 'the recall shape is documented in the file');

    console.log('\n## (b) adult flow — Eli, 390');
    const A = await newContext(browser, 'A');
    await signIn(A.page, 'eli', ELI_PIN);
    const F = await openApp(A.page);
    ok(await F.evaluate(() => document.documentElement.dataset.kind) !== 'kid', 'runs in adult mode');
    let due = await F.evaluate(() => window.verses.dueIds());
    ok(due.join() === '1-0,3-1,12-0,20-1,30-0', 'the due queue: the four never-reviewed first (plan order), then the overdue one; not the one due tomorrow', due.join());
    ok(/5 to go/.test(await text(F, '#who') || ''), 'the pill says "5 to go"', await text(F, '#who'));
    ok(await F.$$eval('#queue-list li', l => l.length) === 5 && /never reviewed/.test(await text(F, '#queue-list li:first-child') || '') && /1 day overdue/.test(await text(F, '#queue-list li:last-child') || ''), 'the queue list names all five, "never reviewed" … "1 day overdue"');
    ok(await F.$$eval('#later-list li', l => l.length) === 1 && /Acts 17:11/.test(await text(F, '#later-list') || '') && /tomorrow/.test(await text(F, '#later-list') || ''), '"Coming up" holds the one due tomorrow (Acts 17:11)');
    ok(await text(F, '#st-due') === '5' && await text(F, '#st-total') === '6' && await text(F, '#st-streak') === '1', 'stats: 5 due, 6 memorised, streak 1 (yesterday, today still to come)', [await text(F, '#st-due'), await text(F, '#st-total'), await text(F, '#st-streak')].join('/'));
    ok(await F.$$eval('#boxes .bx .n', l => l.map(e => e.textContent).join()) === '4,0,1,1,0', 'boxes histogram before: 4 in box 1 (three new + the pre-Leitner row), 1 in box 3, 1 in box 4', await F.$$eval('#boxes .bx .n', l => l.map(e => e.textContent).join()));
    ok(await text(F, '#ref') === 'Genesis 1:27', 'the first card: Genesis 1:27 in big type', await text(F, '#ref'));
    const refPx = await F.$eval('#ref', e => parseFloat(getComputedStyle(e).fontSize));
    ok(refPx >= 34, 'the reference is ≥ 34 px', refPx);
    ok(!(await visible(F, '#act-rate')) && await visible(F, '#act-show'), 'rating buttons hidden until Show');
    const bShow = await box(F, '#show'), bSay = await box(F, '#say');
    ok(bShow && bShow.h >= 60 && bSay && bSay.h >= 60, 'Show and Read aloud are ≥ 60 px tall', JSON.stringify({ bShow, bSay }));
    ok(await F.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll at 390');
    await A.page.screenshot({ path: path.join(SHOTS, 'rm19-adult-390.png') });
    await F.click('#say');
    const spokenA = await waitFor(() => F.evaluate(() => window.__spoken.length ? window.__spoken : null), { label: 'speech' });
    ok(spokenA.length === 1 && /Genesis, chapter 1, verse 27/.test(spokenA[0].text), '"Read aloud" speaks the reference', JSON.stringify(spokenA));
    const hBefore = (await box(F, '#trainer')).h;
    await F.click('#show'); await sleep(60);
    ok(await visible(F, '#act-rate') && !(await visible(F, '#act-show')), 'Show reveals the three ratings');
    ok(Math.abs((await box(F, '#trainer')).h - hBefore) <= 2, 'the card does not grow on Show (no layout jump)', hBefore + ' → ' + (await box(F, '#trainer')).h);
    const bGot = await box(F, '#act-rate [data-rate=got]');
    ok(bGot && bGot.h >= 60, 'Got it is ≥ 60 px tall', JSON.stringify(bGot));
    await A.page.screenshot({ path: path.join(SHOTS, 'rm19-adult-rate-390.png') });
    await F.click('#act-rate [data-rate=got]'); await sleep(120);
    ok(await text(F, '#ref') === 'Hebrews 11:17-19', 'Got it → the next card, Hebrews 11:17-19', await text(F, '#ref'));
    ok(await text(F, '#st-streak') === '2', 'the day streak is now 2 (yesterday + today)', await text(F, '#st-streak'));
    let r2 = await rateCard(F, 'almost');
    ok(r2 === 'Hebrews 11:17-19' && await text(F, '#ref') === 'Joshua 1:8-9', 'Almost → Joshua 1:8-9 (the one with text on file)');
    ok(await visible(F, '#text') && await F.$eval('#text', e => e.classList.contains('veiled')), 'the verse text is on the card, blurred until Show');
    await F.click('#show'); await sleep(60);
    ok(await F.$eval('#text', e => !e.classList.contains('veiled')) && (await text(F, '#text')) === TEXT_12, 'Show unveils the text F260 has on file');
    await F.click('#act-rate [data-rate=not]'); await sleep(120);
    ok(await text(F, '#ref') === 'Proverbs 3:5-6', 'Not yet → Proverbs 3:5-6 (the pre-Leitner F260 row)', await text(F, '#ref'));
    ok(/Box 1/.test(await text(F, '#boxchip') || ''), 'a pre-Leitner row counts as box 1', await text(F, '#boxchip'));
    // keyboard: Enter shows, 3 = Got it
    await F.focus('body'); await F.press('body', 'Enter'); await sleep(60);
    ok(await visible(F, '#act-rate'), 'Enter reveals the ratings');
    await F.press('body', '3'); await sleep(120);
    ok(await text(F, '#ref') === 'Psalm 51:17', '3 rates Got it → Psalm 51:17 (the overdue one, box 3)', await text(F, '#ref'));
    ok(/Box 3/.test(await text(F, '#boxchip') || ''), 'its chip says Box 3', await text(F, '#boxchip'));
    await rateCard(F, 'got');
    ok(await F.$eval('#trainer', e => e.hidden) && await visible(F, '#done') && await text(F, '#done-big') === 'All done for today', 'the queue is empty: "All done for today"', await text(F, '#done-big'));
    ok(/5 reviews today/.test(await text(F, '#done-sub') || '') && /Next up /.test(await text(F, '#done-sub') || ''), 'the done card counts 5 reviews and names the next verse', await text(F, '#done-sub'));
    due = await F.evaluate(() => window.verses.dueIds());
    ok(due.length === 0, 'dueIds() is empty', due.join());
    ok(await F.$$eval('#queue-list li', l => l.length) === 1 && /Nothing due/.test(await text(F, '#queue-list') || '') && await F.$$eval('#later-list li', l => l.length) === 6, 'the queue list says nothing is due; all six are in "Coming up"');
    ok(await F.$$eval('#boxes .bx .n', l => l.map(e => e.textContent).join()) === '2,2,0,2,0', 'boxes after: [2,2,0,2,0]', await F.$$eval('#boxes .bx .n', l => l.map(e => e.textContent).join()));
    ok(await text(F, '#st-due') === '0' && await text(F, '#st-streak') === '2', 'stats: 0 due, streak 2');
    await synced(F);
    const rc = (await row(T.eli, 'f260', 'person', 'f260.recall')).value;
    const chk = (id, box, due, s, streak) => rc[id] && rc[id].box === box && rc[id].due === due && rc[id].last === TODAY && rc[id].s === s && rc[id].streak === streak && typeof rc[id].t === 'number' && rc[id].t > Date.now() - 60000;
    ok(chk('1-0', 2, shift(2), 'got', 1), 'recall 1-0: Got it on a new verse → box 2, due +2, s got, streak 1', JSON.stringify(rc['1-0']));
    ok(chk('3-1', 1, shift(1), 'not', 0), 'recall 3-1: Almost on a new verse → box 1, due +1, s not', JSON.stringify(rc['3-1']));
    ok(chk('12-0', 1, shift(1), 'not', 0), 'recall 12-0: Not yet → box 1, due +1, s not', JSON.stringify(rc['12-0']));
    ok(chk('20-1', 2, shift(2), 'got', 1), 'recall 20-1: pre-Leitner row → Got it → box 2, due +2', JSON.stringify(rc['20-1']));
    ok(chk('30-0', 4, shift(7), 'got', 3), 'recall 30-0: box 3 overdue → Got it → box 4, due +7, streak 3', JSON.stringify(rc['30-0']));
    ok(rc['40-0'] && rc['40-0'].box === 4 && rc['40-0'].due === TOMORROW && rc['40-0'].last === shift(-6), 'recall 40-0 untouched (not due)', JSON.stringify(rc['40-0']));
    ok(Object.keys(rc).length === 6, 'no other rows in f260.recall');
    const memAfter = (await row(T.eli, 'f260', 'person', 'f260.mem')).value;
    ok(JSON.stringify(memAfter) === JSON.stringify(MEM), 'f260.mem untouched');

    console.log('\n## (c) summary row + feed line');
    const lg = (await row(T.eli, 'verses', 'person', 'log')).value;
    ok(lg && lg[YESTERDAY] === 2 && lg[TODAY] === 5, 'app_data(verses, person, log) = { yesterday: 2, today: 5 }', JSON.stringify(lg));
    const sm = (await row(T.eli, 'verses', 'person', 'summary') || {}).value;
    ok(sm && sm.due === 0 && sm.streak === 2 && JSON.stringify(sm.boxes) === '[2,2,0,2,0]' && sm.total === 6 && sm.reviewedToday === 5 && sm.week === null && sm.at === TODAY, 'app_data(verses, person, summary) = { due: 0, streak: 2, boxes: [2,2,0,2,0], total: 6, reviewedToday: 5, week: null, at: today }', JSON.stringify(sm));
    const feed = (await api('/api/activity?limit=40', { profile: T.eli })).activity || [];
    ok(feed.some(a => a.profile_id === 'eli' && a.app_id === 'verses' && /Eli reviewed 5 memory verses/.test(a.text)), 'the feed has "Eli reviewed 5 memory verses"', JSON.stringify(feed.slice(0, 3).map(a => a.text)));

    console.log('\n## (d) a second device as Eli, 1024');
    const A2 = await newContext(browser, 'A2', 1024);
    await signIn(A2.page, 'eli', ELI_PIN);
    const F2 = await openApp(A2.page);
    ok(await visible(F2, '#done') && await F2.$$eval('#boxes .bx .n', l => l.map(e => e.textContent).join()) === '2,2,0,2,0' && await text(F2, '#st-streak') === '2', 'the other device: all done, the same boxes, streak 2');
    ok(await F2.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll at 1024');
    await A2.page.screenshot({ path: path.join(SHOTS, 'rm19-adult-done-1024.png') });
    // "Practise one anyway" pulls the next scheduled verse in without changing anyone else's due date
    await F2.click('#again'); await sleep(120);
    ok(await visible(F2, '#trainer') && await text(F2, '#ref') === 'Hebrews 11:17-19', '"Practise one anyway" opens the next scheduled verse (due tomorrow)', await text(F2, '#ref'));

    console.log('\n## (e) kid flow — Ezra, 390');
    ok(REFS.length === 52 && REFS.every(r => r.length === 2), 'the app carries the 52-week, two-per-week reference table');
    await setWeek(5);
    const K = await newContext(browser, 'K');
    await signIn(K.page, 'ezra');
    const FK = await openApp(K.page);
    ok(await FK.evaluate(() => document.documentElement.dataset.kind) === 'kid', 'the app runs in kid mode (data-kind="kid")');
    // another suite on the shared Worker may move the family week under us: check against the week the app sees
    const W = await FK.evaluate(() => { const v = hub.get('week', { app: 'kidverse', scope: 'family' }); return v && typeof v === 'object' ? v.week : v; });
    if (W !== 5) console.log('  … the family week is ' + W + ' (another suite moved it); checking against that week');
    const [K0, K1] = REFS[W - 1];
    ok(await text(FK, '#ref') === K0, 'family week ' + W + ' → ' + K0 + ' (its first verse)', await text(FK, '#ref'));
    const said = ref => { const m = ref.match(/^(\d\s)?([A-Za-z ]+?)\s+(\d+):(\d+)(?:-(\d+))?[a-z]?$/); const ord = { 1: 'First', 2: 'Second', 3: 'Third' }; const book = (m[1] ? ord[m[1].trim()] + ' ' : '') + m[2].trim(); const vs = m[5] ? `verses ${m[4]} to ${m[5]}` : `verse ${m[4]}`; return /^Psalms?$/i.test(m[2].trim()) ? `Psalm ${m[3]}, ${vs}` : `${book}, chapter ${m[3]}, ${vs}`; };
    ok(/2 to go/.test(await text(FK, '#who') || ''), 'the pill says "2 to go"', await text(FK, '#who'));
    ok(await FK.$eval('#stats', e => e.hidden) && await FK.$eval('#queue', e => e.hidden) && await FK.$eval('#boxchip', e => e.hidden), 'no stats, no queue, no box chip for a kid');
    ok(!/In our own words|paraphrase/i.test(await FK.evaluate(() => document.body.innerText)), 'no paraphrase anywhere');
    ok(await FK.$$eval('input, textarea, select, [contenteditable]', l => l.length) === 0, 'no text input');
    const kRef = await FK.$eval('#ref', e => parseFloat(getComputedStyle(e).fontSize));
    ok(kRef >= 40, 'the reference is ≥ 40 px for a kid', kRef);
    ok(await FK.$$eval('button', bs => bs.filter(b => !b.hidden && b.offsetParent !== null).every(b => b.getBoundingClientRect().height >= 64 && b.getBoundingClientRect().width >= 64)), 'every visible control is a ≥ 64 px button');
    ok(await FK.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll at 390');
    await FK.click('#say');
    const spokenK = await waitFor(() => FK.evaluate(() => window.__spoken.length ? window.__spoken : null), { label: 'kid speech' });
    ok(spokenK.length === 1 && Math.abs(spokenK[0].rate - 0.85) < 1e-6 && spokenK[0].text === said(K0), '"Read aloud" speaks the reference ("' + said(K0) + '") at rate 0.85', JSON.stringify(spokenK));
    await sleep(120);
    ok(await text(FK, '#say span') === 'Read aloud', 'the button returns to "Read aloud" when the voice finishes');
    const hkBefore = (await box(FK, '#trainer')).h;
    await FK.click('#show'); await sleep(60);
    ok(Math.abs((await box(FK, '#trainer')).h - hkBefore) <= 2, 'the kid card does not grow on Show', hkBefore + ' → ' + (await box(FK, '#trainer')).h);
    ok(await FK.$$eval('#act-rate button', bs => bs.filter(b => b.offsetParent !== null).every(b => b.getBoundingClientRect().height >= 64)), 'the three rating buttons are ≥ 64 px for a kid');
    await K.page.screenshot({ path: path.join(SHOTS, 'rm19-kid-390.png') });
    await FK.click('#act-rate [data-rate=got]'); await sleep(120);
    ok(await text(FK, '#ref') === K1, 'Got it → the week\'s second verse, ' + K1, await text(FK, '#ref'));
    await rateCard(FK, 'almost');
    ok(await visible(FK, '#done') && await text(FK, '#done-big') === 'All done for today' && await visible(FK, '#again'), 'two ratings → "All done for today" with Practise again');
    ok(await FK.$eval('#stats', e => e.hidden), 'still no stats');
    await K.page.screenshot({ path: path.join(SHOTS, 'rm19-kid-done-390.png') });
    await synced(FK);
    const rk = (await row(T.ezra, 'f260', 'person', 'f260.recall')).value;
    const k0 = W + '-0', k1 = W + '-1';
    ok(rk && rk[k0] && rk[k0].box === 2 && rk[k0].due === shift(2) && rk[k0].last === TODAY && rk[k0].s === 'got' && rk[k0].streak === 1 && rk[k1] && rk[k1].box === 1 && rk[k1].due === shift(1) && rk[k1].s === 'not' && Object.keys(rk).length === 2, 'Ezra\'s own f260.recall: ' + k0 + ' box 2 (+2), ' + k1 + ' box 1 (+1), nothing else', JSON.stringify(rk));
    const smk = (await row(T.ezra, 'verses', 'person', 'summary') || {}).value;
    ok(smk && smk.due === 0 && smk.streak === 1 && smk.reviewedToday === 2 && smk.week === W && smk.total === 2 && JSON.stringify(smk.boxes) === '[1,1,0,0,0]', 'Ezra\'s summary: { due: 0, streak: 1, reviewedToday: 2, week: ' + W + ', boxes: [1,1,0,0,0] }', JSON.stringify(smk));
    const feedK = (await api('/api/activity?limit=40', { profile: T.eli })).activity || [];
    ok(feedK.some(a => a.profile_id === 'ezra' && a.app_id === 'verses' && /Ezra reviewed 2 memory verses/.test(a.text)), 'the feed has "Ezra reviewed 2 memory verses"');
    await FK.click('#again'); await sleep(120);
    ok(await visible(FK, '#trainer') && await text(FK, '#ref') === K0, 'Practise again reopens the week\'s verses', await text(FK, '#ref'));
    // the family week moves on → the kid's queue follows on the next pull
    const W2 = (W % 52) + 1; await setWeek(W2);
    await FK.evaluate(() => hub.pull());
    await waitFor(() => FK.evaluate(w => window.verses.dueIds().join() === w + '-0,' + w + '-1', W2), { label: 'kid queue follows the week' });
    ok(true, 'the kid\'s due list follows the family week (hub.onChange)');

    console.log('\n## (f) the kiosk — Downstairs TV, standalone');
    const TV = await newContext(browser, 'TV', 1440);
    await signIn(TV.page, 'tv');
    await TV.page.goto(SITE + '/apps/verses.html');
    await TV.page.waitForFunction(() => window.verses && window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 });
    await sleep(150);
    ok(await visible(TV.page, '#empty') && !(await visible(TV.page, '#act-rate')), 'standalone open works: nothing to train, no rating buttons');
    ok(!(await row(T.tv, 'verses', 'person', 'summary').catch(() => null)), 'the kiosk wrote no summary');
    ok(await TV.page.evaluate(() => { try { window.verses.rate('got'); return true; } catch { return false; } }), 'rate() on the kiosk does not throw');

    console.log('\n## console');
    ok(errors.length === 0, 'no console errors or page errors', errors.join(' | '));
  } catch (e) { fail++; console.log('  ✗ crashed:', e.stack || e); }
  finally { await browser.close(); server.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
