#!/usr/bin/env node
// Roadmap 19 checks: Verses (apps/verses.html) — a Leitner memory-verse trainer over the person's F260 memory verses.
// Batch 5 (audits/06, Verses) rewrote the expectations: Not yet → box 1, intervals instead of box numbers, Read aloud after
// Show, the 400 ms guard after a rating, Undo, the household verse text, the streak rule, the kid paraphrase, F6 rows.
//   (a) registration: apps.json entry (person scope, small tile, visible to all seven people and not the TV), duotone icon,
//       spot art, no hex / prefers-color-scheme in the app's CSS; the kid paraphrase table is an exact copy of Kid Verse's
//   (b) adult flow (Eli, 390): six memorised verses seeded in f260.mem — four never reviewed (one with verse text on file
//       in f260.verses, one with a pre-Leitner F260 recall row), one overdue, one not due until tomorrow. The due queue
//       holds five, never-reviewed first; rating buttons stay hidden until Show, each shows its next review; Got it /
//       Almost / Not yet move the box up / hold / back to 1 and set due = today + [1,2,4,7,14][box-1]; a double tap on Got
//       it rates once and never reveals the next card; Read aloud stays after Show and reads the text; Enter on a focused
//       button presses it; the veiled text is hidden from screen readers; the toast states the real next review; no "box"
//       on screen; the day streak keeps a past day that had nothing due (P3-VERSES-11)
//   (c) the summary row app_data(verses, person, summary) and the feed line "Eli reviewed 5 memory verses"
//   (d) a second device as Eli (1024): Practise one anyway and a tapped Coming up row are practice, not due (P3-VERSES-08,
//       IMP-VERSES-F6); Undo puts the row back by value and the card back revealed; Undo never clobbers a newer review
//   (e) the household verse text (GAP-VERSES-1): Mom adds the text of a verse, it is veiled until Show, Eli (who trains it
//       too) sees it, it wins over Eli's F260 paste, Remove falls back to the paste; a kid cannot write it
//   (f) the Leitner rule and the streak rule on Mom's rows: Not yet from the fourth box → box 1, due tomorrow; a past day
//       with a never-reviewed verse due breaks a streak, a day with nothing due does not
//   (g) kid flow (Ezra, 390): this family week's two verses only, no stats, the paraphrase (labelled) on the verse Kid Verse
//       paraphrases, read aloud; picture buttons (check, dashed circle, try-again) ≥ 64 px; no text editor; Practise again
//   (h) the kiosk opens the page standalone without crashing and cannot write
//   (i) nothing due (Dad): "Nothing due today", no star, the pill says "nothing due", the streak is kept
//   (j) nothing to train (Mea): the empty card, "straight away", and Open F260 opens F260 in the hub
//   (k) review round 1: the trainer opens with Verses' family channel unreachable; the text rows load on their own.
//       Also from round 1, in (b) and (d): a rating keeps the schedule it replaced (prev) so a missed day stays missed;
//       a private F260 paste is shared only after a confirm; Undo pulls first and keeps an unpulled newer review
//   cd worker && npx wrangler dev --port 8787     (seeded local D1; Eli PIN 1357)
//   node scripts/test-verses.mjs <pairing-code>
// Serves the repo on :9019 and proxies /api to the Worker, so it never needs :8765. Every verse text here is an obvious
// placeholder, never Scripture.
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
// Since batch 0e the apps keep one row per entry over the old whole-map row (hub.js hub.rowMap): recall:<id> and mem:<id> in
// the F260 scope, rev:<date>:<id> counts in the verses scope. These read what the app would see.
const merged = async (tok, app, prefix, legacy) => {
  const items = (await api(`/api/data/${app}?scope=person`, { profile: tok })).items;
  const base = items.find(r => r.key === legacy); const out = base && base.value && typeof base.value === 'object' ? { ...base.value } : {};
  for (const r of items) if (r.key.startsWith(prefix) && r.value != null) { const id = r.key.slice(prefix.length); if (r.value === false) delete out[id]; else out[id] = r.value; }
  return out;
};
const reviewLog = async tok => {
  const items = (await api('/api/data/verses?scope=person', { profile: tok })).items;
  const old = items.find(r => r.key === 'log'); const out = old && old.value ? { ...old.value } : {};
  for (const r of items) if (r.key.startsWith('rev:') && r.value != null) { const d = r.key.slice(4, 14); out[d] = (out[d] || 0) + r.value; }
  return out;
};
const put = (tok, app, key, value) => api(`/api/data/${app}/${encodeURIComponent(key)}?scope=person`, { method: 'PUT', profile: tok, body: { value, updated_at: Date.now() } });
const del = (tok, app, key, scope = 'person') => api(`/api/data/${app}/${encodeURIComponent(key)}?scope=${scope}`, { method: 'DELETE', profile: tok }).catch(() => {});
// a row with a chosen write time (the mem:<id> rows' write time is the day a verse was memorised, for the streak rule)
const putAt = (tok, app, key, value, at, scope = 'person') => api(`/api/data/${app}/${encodeURIComponent(key)}?scope=${scope}`, { method: 'PUT', profile: tok, body: { value, updated_at: at } });
const familyItems = async (tok, app) => (await api(`/api/data/${app}?scope=family`, { profile: tok })).items;
let T = {};
const PIN = { mom: '2468', dad: '3579', niece: '1470' };
const MEM = { '1-0': true, '3-1': true, '12-0': true, '20-1': true, '30-0': true, '40-0': true };
const TEXT_12 = 'This is the verse text Eli pasted into F260 once, for practice — not a quotation.';
const PLACE_1 = 'Placeholder words for the first card, typed in Verses by Mom - test text, not Scripture.';
const PLACE_12 = 'Placeholder words for the Joshua card, shared by the household - test text, not Scripture.';
async function seed() {
  DEVICE = (await api('/api/pair', { method: 'POST', body: { code: CODE, name: 'test-verses seeder' } })).device_token;
  T = { eli: await login('eli', ELI_PIN), ezra: await login('ezra'), tv: await login('tv'), mom: await login('mom', PIN.mom), dad: await login('dad', PIN.dad), niece: await login('niece', PIN.niece) };
  // Eli: six memorised verses, one with text on file, one pre-Leitner F260 rating, one overdue, one due tomorrow; reviews
  // yesterday and three days ago — the day between had nothing due, so the streak is 2 (P3-VERSES-11)
  await put(T.eli, 'f260', 'f260.mem', MEM);
  await put(T.eli, 'f260', 'f260.verses', { '12-0': TEXT_12 });
  await put(T.eli, 'f260', 'f260.recall', {
    '20-1': { s: 'not', t: Date.now() - 86400000 * 3 },
    '30-0': { s: 'got', t: Date.now() - 86400000 * 5, box: 3, due: YESTERDAY, last: shift(-5), streak: 2 },
    '40-0': { s: 'got', t: Date.now() - 86400000 * 6, box: 4, due: TOMORROW, last: shift(-6), streak: 3 },
  });
  await put(T.eli, 'verses', 'log', { [YESTERDAY]: 2, [shift(-3)]: 1 });
  await del(T.eli, 'verses', 'summary');
  // the household text rows start empty
  for (const id of ['1-0', '12-0']) await del(T.eli, 'verses', 'text:' + id, 'family');
  // Mom: four verses memorised ten days ago (one mem:<id> row each, written then), none reviewed in Verses except the
  // fourth, which sits in the fourth box and was due yesterday
  const tenDays = Date.now() - 10 * 86400000;
  for (const id of ['1-0', '12-0', '20-1', '30-0']) await putAt(T.mom, 'f260', 'mem:' + id, true, tenDays);
  await put(T.mom, 'f260', 'recall:30-0', { s: 'got', t: Date.now() - 8 * 86400000, box: 4, due: YESTERDAY, last: shift(-8), streak: 3 });
  // Dad: one verse, reviewed yesterday, due tomorrow: nothing due today, no review yet today
  await put(T.dad, 'f260', 'f260.mem', { '2-0': true });
  await put(T.dad, 'f260', 'recall:2-0', { s: 'got', t: Date.now() - 86400000, box: 2, due: TOMORROW, last: YESTERDAY, streak: 1 });
  await put(T.dad, 'verses', 'log', { [YESTERDAY]: 1 });
  // Mea (niece): nothing memorised
  await del(T.niece, 'f260', 'f260.mem');
  // Ezra: a clean slate (the family week is set right before his section — other suites on the shared Worker move it)
  await del(T.ezra, 'f260', 'f260.recall'); await del(T.ezra, 'verses', 'log'); await del(T.ezra, 'verses', 'summary');
}
const REFS = (() => { const src = fs.readFileSync(path.join(ROOT, 'apps/verses.html'), 'utf8'); const m = src.match(/const REFS = \[([\s\S]*?)\n  \];/); return new Function('return [' + m[1] + ']')(); })();
// the paraphrase table: Kid Verse's own ([which ref, words] per week) and Verses' copy of it (UX-VERSES-1)
const KIDWORDS = (() => { const f = fs.readFileSync(path.join(ROOT, 'apps', 'kidverse.html'), 'utf8'); const s = f.indexOf('{ w: 1,  refs:'); return [...f.slice(s, f.indexOf('];', s)).matchAll(/\{ w: (\d+),\s+refs: \[[^\]]*\], p: (\d), words: '((?:[^'\\]|\\.)*)' \}/g)].map(m => [+m[2], m[3].replace(/\\'/g, "'")]); })();
const V_KIDWORDS = (() => { const f = fs.readFileSync(path.join(ROOT, 'apps', 'verses.html'), 'utf8'); const s = f.indexOf('const KIDWORDS = ['); return new Function('return ' + f.slice(s + 'const KIDWORDS = '.length, f.indexOf('\n  ];', s) + 4))(); })();
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
  await fr.click(`#act-rate [data-rate="${kind}"]`); await sleep(520);   // the next card comes after the 400 ms guard (P3-VERSES-12)
  return ref;
}

const focused = fr => fr.evaluate(() => { const a = document.activeElement; return a ? (a.id || (a.dataset && a.dataset.rate) || a.tagName) : null; });
const toastText = fr => fr.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent.replace(/\s+/g, ' ').trim() : null; });
// the rating's result line (rescore 5: it replaced the shared toast for ratings): its text while it shows, and its Undo
const ratedText = fr => fr.evaluate(() => { const l = document.getElementById('rated'); return l && l.classList.contains('armed') && !l.classList.contains('faded') ? document.getElementById('rated-text').textContent.trim() : null; });
const clickUndo = fr => fr.evaluate(() => { const b = document.querySelector('#rated.armed:not(.faded) #rated-undo:not([hidden])'); if (!b) return false; b.click(); return true; });
const pull = fr => fr.evaluate(() => hub.pull());
const nx = fr => fr.$$eval('#act-rate [data-rate]', bs => Object.fromEntries(bs.map(b => [b.dataset.rate, (b.querySelector('.nx') || {}).textContent || ''])));
const veil = fr => fr.$eval('#text', e => ({ hidden: e.hidden, veiled: e.classList.contains('veiled'), aria: e.getAttribute('aria-hidden'), inert: e.hasAttribute('inert') }));
const recallRow = async (tok, id) => ((await row(tok, 'f260', 'person', 'recall:' + id)) || {}).value;
const revToday = async (tok, id) => (await api('/api/data/verses?scope=person', { profile: tok })).items.filter(r => r.key.startsWith('rev:' + TODAY + ':' + id + ':') && r.value != null).reduce((n, r) => n + r.value, 0);

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    console.log('\n## seed'); await seed(); ok(true, 'paired, signed in Eli/Ezra/TV/Mom/Dad/Mea; Eli has 6 memorised verses (4 new, 1 overdue, 1 due tomorrow) and reviews yesterday and three days ago');

    console.log('\n## (a) registration');
    const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps.find(a => a.id === 'verses');
    ok(reg && reg.file === 'apps/verses.html' && reg.scope === 'both' && reg.tile === 'small' && /^#/.test(reg.color) && reg.icon === 'icons/verses.svg', 'apps.json: verses registered (both scopes: its own rows person, the household text family; small, icon)', JSON.stringify(reg));
    ok(reg && Array.isArray(reg.visibleTo) && reg.visibleTo.length === 7 && ['eli', 'christian', 'mom', 'dad', 'niece', 'ezra', 'kiara'].every(id => reg.visibleTo.includes(id)) && !reg.visibleTo.includes('tv'), 'visible to all seven people and not the TV');
    ok(fs.existsSync(path.join(ROOT, 'icons/verses.svg')) && /class="duo"/.test(fs.readFileSync(path.join(ROOT, 'icons/verses.svg'), 'utf8')) && fs.existsSync(path.join(ROOT, 'art/app/verses.svg')), 'icon (duotone) + spot art exist');
    ok(/app\.verses = svg\(200, 160/.test(fs.readFileSync(path.join(ROOT, 'scripts/make-art.mjs'), 'utf8')), 'the spot art comes from scripts/make-art.mjs');
    const src = fs.readFileSync(path.join(ROOT, 'apps/verses.html'), 'utf8');
    ok(!/#[0-9a-f]{3,8}\b/i.test(src.slice(src.indexOf('<style>'), src.indexOf('</style>'))) && !/prefers-color-scheme/.test(src.slice(src.indexOf('<style>'), src.indexOf('</style>'))), 'no hex and no prefers-color-scheme in the app\'s CSS');
    ok(/data-app="verses" data-scope="both"/.test(src) && /hub\.use\('f260', 'person'\)/.test(src), 'hub.js with app id verses, scope both (matches apps.json); reads F260 through hub.use');
    ok(/recall:<id>\s+\{/.test(src) && /box: 1\.\.5/.test(src) && /due: 'YYYY-MM-DD'/.test(src) && /text:<week>-<i>\s+\{ text, by, at \}/.test(src), 'the recall shape and the household text row are documented in the file');
    ok(KIDWORDS.length === 52 && JSON.stringify(V_KIDWORDS) === JSON.stringify(KIDWORDS), 'Verses\' kid paraphrase table is an exact copy of Kid Verse\'s 52 weeks', JSON.stringify([KIDWORDS.length, V_KIDWORDS && V_KIDWORDS.length]));

    console.log('\n## (b) adult flow — Eli, 390');
    const A = await newContext(browser, 'A');
    await signIn(A.page, 'eli', ELI_PIN);
    const F = await openApp(A.page);
    ok(await F.evaluate(() => document.documentElement.dataset.kind) !== 'kid', 'runs in adult mode');
    let due = await F.evaluate(() => window.verses.dueIds());
    ok(due.join() === '1-0,3-1,12-0,20-1,30-0', 'the due queue: the four never-reviewed first (plan order), then the overdue one; not the one due tomorrow', due.join());
    ok(/5 to go/.test(await text(F, '#who') || ''), 'the pill says "5 to go"', await text(F, '#who'));
    ok(await F.$$eval('#queue-list li', l => l.length) === 5 && /never reviewed/.test(await text(F, '#queue-list li:first-child') || '') && /1 day overdue/.test(await text(F, '#queue-list li:last-child') || ''), 'the queue list names all five, "never reviewed" … "1 day overdue"');
    // UX-VERSES-8: the due count is said once (the pill), not again in a stat or the list header
    ok(!(await visible(F, '#st-due')) && /^5 due\b/.test(await text(F, '#queue-sub') || '') && await text(F, '#st-today') === '0', 'the due count: no "due today" stat; the list header carries it as "5 due" (final rescore E: the pill scrolls away when the list is in view); the first stat is "reviewed today" (0)', [await text(F, '#queue-sub'), await text(F, '#st-today')]);
    ok(await F.$$eval('#later-list li', l => l.length) === 1 && /Acts 17:11/.test(await text(F, '#later-list') || '') && /tomorrow/.test(await text(F, '#later-list') || ''), '"Coming up" holds the one due tomorrow (Acts 17:11)');
    ok(await text(F, '#st-total') === '6' && await text(F, '#st-streak') === '2', 'stats: 6 memorised, streak 2 — yesterday and three days ago; the day between had nothing due, so it kept the streak (P3-VERSES-11)', [await text(F, '#st-total'), await text(F, '#st-streak')].join('/'));
    ok(await F.$$eval('#boxes .bx .n', l => l.map(e => e.textContent).join()) === '4,0,1,1,0', 'histogram before: 4 daily (three new + the pre-Leitner row), 1 every 4 days, 1 weekly', await F.$$eval('#boxes .bx .n', l => l.map(e => e.textContent).join()));
    // IMP-VERSES-F6: each row is a button, 44 px or more, named "Practise <ref>"
    const qrows = await F.$$eval('#queue-list li .qrow, #later-list li .qrow', bs => bs.map(b => ({ tag: b.tagName, label: b.getAttribute('aria-label'), h: Math.round(b.getBoundingClientRect().height) })));
    ok(qrows.length === 6 && qrows.every(b => b.tag === 'BUTTON' && /^Practise /.test(b.label || '') && b.h >= 44), 'every row is a button ≥ 44 px labelled "Practise <ref>"', JSON.stringify(qrows.slice(0, 2)));
    ok(await text(F, '#ref') === 'Genesis 1:27', 'the first card: Genesis 1:27 in big type', await text(F, '#ref'));
    ok(await text(F, '#boxchip') === 'New', 'its chip says "New", never a box number', await text(F, '#boxchip'));
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
    ok(await visible(F, '#act-rate') && !(await visible(F, '#show')) && await visible(F, '#say'), 'Show reveals the three ratings; Read aloud stays (P3-VERSES-06)');
    ok(await focused(F) === 'not', 'after Show, focus is on the first rating, never on <body> (review round 1)', await focused(F));
    ok(Math.abs((await box(F, '#trainer')).h - hBefore) <= 2, 'the card does not grow on Show (no layout jump)', hBefore + ' → ' + (await box(F, '#trainer')).h);
    ok(JSON.stringify(await nx(F)) === JSON.stringify({ not: 'tomorrow', almost: 'tomorrow', got: 'in 2 days' }), 'each rating shows its next review: Not yet tomorrow, Almost tomorrow, Got it in 2 days (GAP-VERSES-2)', JSON.stringify(await nx(F)));
    const bGot = await box(F, '#act-rate [data-rate=got]');
    ok(bGot && bGot.h >= 60, 'Got it is ≥ 60 px tall', JSON.stringify(bGot));
    await A.page.screenshot({ path: path.join(SHOTS, 'rm19-adult-rate-390.png') });
    // P3-VERSES-12: a double tap on Got it rates once; the second tap lands on the rated card, never the next card's Show
    await F.click('#act-rate [data-rate=got]');
    const coolingNow = await F.evaluate(() => window.verses.isCooling() && document.getElementById('trainer').classList.contains('rated'));
    await sleep(70); await F.click('#act-rate [data-rate=got]', { force: true }).catch(() => {});
    ok(coolingNow, 'right after the rating the card is cooling down (#trainer.rated)');
    ok(/^Got it — Genesis 1:27\. Next review in 2 days\.$/.test(await ratedText(F) || '') && await visible(F, '#rated-undo'), 'the result line states the real next review and offers Undo', await ratedText(F));
    const line = await F.evaluate(() => { const l = document.getElementById('rated'), u = document.getElementById('rated-undo').getBoundingClientRect(), t = document.getElementById('hub-toast'); return { host: l.parentElement.id, role: l.getAttribute('role'), live: l.getAttribute('aria-live'), undoH: Math.round(u.height), undoW: Math.round(u.width), toast: !!(t && !t.hidden) }; });
    ok(await F.$eval('#rated-text .cv', e => e.textContent === '1:27' && getComputedStyle(e).whiteSpace === 'nowrap').catch(() => false), 'the line keeps the reference whole: its chapter:verse is one nowrap span');
    ok(line.host === 'trainer' && line.role === 'status' && line.live === 'polite' && line.undoH >= 44 && line.undoW >= 44 && !line.toast, 'it is a polite status line at the top of the card, Undo ≥ 44 px, and no toast covers the pill (rescore 5)', JSON.stringify(line));
    await sleep(520);
    ok(await text(F, '#ref') === 'Hebrews 11:17-19' && await visible(F, '#show') && !(await visible(F, '#act-rate')), 'after 400 ms the next card, Hebrews 11:17-19, comes in unrevealed (the second tap did nothing)', await text(F, '#ref'));
    ok(await focused(F) === 'show', "after the cool-down, focus is on the next card's Show", await focused(F));
    ok(await F.evaluate(() => { let n = 0; for (const r of hub.list('rev:')) if (r.key.includes(':1-0:')) n += r.value; return n; }) === 1, 'the double tap counted one review of Genesis 1:27');
    ok(await text(F, '#st-streak') === '3', 'the day streak is now 3 (today, yesterday, three days ago)', await text(F, '#st-streak'));
    let r2 = await rateCard(F, 'almost');
    ok(r2 === 'Hebrews 11:17-19' && await text(F, '#ref') === 'Joshua 1:8-9', 'Almost → Joshua 1:8-9 (the one with text on file)');
    ok(/^Almost — Hebrews 11:17-19\. Next review tomorrow\./.test(await ratedText(F) || ''), 'the next rating replaces the line: Almost says tomorrow (the first box)', await ratedText(F));
    let vt = await veil(F);
    ok(!vt.hidden && vt.veiled && vt.aria === 'true' && vt.inert, 'the verse text is on the card, blurred, aria-hidden and inert until Show (P3-VERSES-13)', JSON.stringify(vt));
    // P3-VERSES-10: Enter on the focused Read aloud reads; it does not reveal
    const spoke0 = await F.evaluate(() => window.__spoken.length);
    await F.focus('#say'); await F.press('#say', 'Enter'); await sleep(150);
    ok(await F.evaluate(() => window.__spoken.length) === spoke0 + 1 && await visible(F, '#show') && !(await visible(F, '#act-rate')), 'Enter on the focused Read aloud reads aloud and leaves the card hidden (P3-VERSES-10)');
    ok(!/Placeholder|pasted into F260/.test((await F.evaluate(() => window.__spoken.slice(-1)[0].text))), 'before Show, Read aloud says only the reference');
    await F.click('#show'); await sleep(60);
    vt = await veil(F);
    ok(!vt.veiled && vt.aria === null && !vt.inert && (await text(F, '#text')) === TEXT_12, 'Show unveils the text F260 has on file and exposes it to screen readers');
    await F.click('#say'); await sleep(150);
    ok((await F.evaluate(() => window.__spoken.slice(-1)[0].text)).endsWith('. ' + TEXT_12), 'after Show, Read aloud reads the reference and the verse text (P3-VERSES-06)', await F.evaluate(() => window.__spoken.slice(-1)[0].text));
    // review round 1: this text is only Eli's own F260 paste. The button says what a save would do, and an unchanged
    // prefill saved with Enter asks before it reaches the household — Cancel publishes nothing
    ok(await text(F, '#edittext') === 'Share this text with the house', 'a private F260 paste: the button reads "Share this text with the house"', await text(F, '#edittext'));
    await F.click('#edittext'); await sleep(100);
    ok((await F.$eval('#text-input', e => e.value)) === TEXT_12 && /Your own text/.test(await text(F, '#text-label') || ''), 'the editor is prefilled with the paste and says it is your own', await text(F, '#text-label'));
    await F.press('#text-input', 'Enter'); await sleep(250);
    ok(await F.evaluate(() => !!document.querySelector('.hub-ask')) && /Everyone in the house/.test(await F.evaluate(() => document.querySelector('.hub-ask').textContent)), 'Enter on the unchanged prefill asks first ("Everyone in the house will see this text…")');
    await F.click('.hub-ask .btn:not(.btn-primary)'); await sleep(200);
    await F.click('#text-cancel'); await sleep(150);
    await synced(F);
    ok(!(await familyItems(T.eli, 'verses')).some(r => r.key === 'text:12-0' && r.value != null) && !(await F.evaluate(() => hub.has('text:12-0', { app: 'verses', scope: 'family' }))), 'Cancel publishes nothing: no household row text:12-0');
    await F.click('#act-rate [data-rate=not]'); await sleep(520);
    ok(/^Not yet — Joshua 1:8-9\. Next review tomorrow\./.test(await ratedText(F) || ''), 'the Not yet line states the real next review (P3-VERSES-05)', await ratedText(F));
    ok(await text(F, '#ref') === 'Proverbs 3:5-6', 'Not yet → Proverbs 3:5-6 (the pre-Leitner F260 row)', await text(F, '#ref'));
    ok(await text(F, '#boxchip') === 'New', 'a pre-Leitner row counts as new', await text(F, '#boxchip'));
    // keyboard: Enter with focus on nothing shows, 3 = Got it
    await F.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
    await F.press('body', 'Enter'); await sleep(60);
    ok(await visible(F, '#act-rate'), 'Enter (focus on no button) reveals the ratings');
    await F.press('body', '3'); await sleep(520);
    ok(await text(F, '#ref') === 'Psalm 51:17', '3 rates Got it → Psalm 51:17 (the overdue one)', await text(F, '#ref'));
    ok(await text(F, '#boxchip') === 'Reviewed 5 days ago', 'its chip says "Reviewed 5 days ago" (UX-VERSES-9)', await text(F, '#boxchip'));
    await F.click('#show'); await sleep(60);
    ok(JSON.stringify(await nx(F)) === JSON.stringify({ not: 'tomorrow', almost: 'in 4 days', got: 'in 7 days' }), 'its ratings: Not yet tomorrow, Almost in 4 days, Got it in 7 days', JSON.stringify(await nx(F)));
    ok(!/\bbox(es)? ?\d/i.test(await F.evaluate(() => document.body.innerText)) && !/Box/.test(await F.evaluate(() => document.body.innerText)), 'no "box" anywhere on the screen');
    await F.click('#act-rate [data-rate=got]'); await sleep(520);
    ok(await F.$eval('#trainer', e => e.hidden) && await visible(F, '#done') && await text(F, '#done-big') === 'All done for today' && await F.$eval('#done .icon.star', e => !e.hasAttribute('hidden') && getComputedStyle(e).display !== 'none'), 'the queue is empty: "All done for today", with the star', await text(F, '#done-big'));
    ok(/all done/.test(await text(F, '#who') || ''), 'the pill says "all done" after reviews today', await text(F, '#who'));
    ok(await focused(F) === 'again', 'on the done card, focus is on "Practise one anyway"', await focused(F));
    ok(await F.$eval('#rated', e => e.parentElement.id) === 'done' && /^Got it — Psalm 51:17\. Next review in 7 days\.$/.test(await ratedText(F) || ''), 'the queue emptied: the result line is at the top of the done card', await ratedText(F));
    ok(/5 reviews today/.test(await text(F, '#done-sub') || '') && /Next up /.test(await text(F, '#done-sub') || ''), 'the done card counts 5 reviews and names the next verse', await text(F, '#done-sub'));
    due = await F.evaluate(() => window.verses.dueIds());
    ok(due.length === 0, 'dueIds() is empty', due.join());
    ok(!(await visible(F, '#queue-list')) && !(await visible(F, '#queue-h')) && await F.$$eval('#later-list li', l => l.length) === 6, 'nothing is said twice: the Due today list is gone (the done card says it), all six are in "Coming up" (UX-VERSES-8)');
    ok(await F.$$eval('#boxes .bx .n', l => l.map(e => e.textContent).join()) === '2,2,0,2,0', 'histogram after: [2,2,0,2,0]', await F.$$eval('#boxes .bx .n', l => l.map(e => e.textContent).join()));
    ok(await text(F, '#st-today') === '5' && await text(F, '#st-streak') === '3', 'stats: 5 reviewed today, streak 3');
    // review round 1: Psalm 51:17 was due yesterday and is reviewed only today. Its row now keeps the schedule it replaced
    // (prev), so a yesterday WITHOUT a review would still break the streak — reviewing an overdue verse never hides the
    // day it was missed — while the day before (nothing due) still keeps it
    const p30 = await F.evaluate(() => (hub.get('recall:30-0', { app: 'f260', scope: 'person' }) || {}).hist);
    ok(JSON.stringify(p30) === JSON.stringify([{ due: YESTERDAY, last: shift(-5) }]), 'the rated row keeps the schedule it replaced in its history: hist = [{ due: yesterday, last: 5 days ago }]', JSON.stringify(p30));
    ok(await F.evaluate(l => window.verses.streakOf(l), { [TODAY]: 1, [shift(-2)]: 1 }) === 1, 'a missed day stays missed after the overdue verse is reviewed (streak 1, not 2)', await F.evaluate(l => window.verses.streakOf(l), { [TODAY]: 1, [shift(-2)]: 1 }));
    await synced(F);
    const rc = await merged(T.eli, 'f260', 'recall:', 'f260.recall');
    const chk = (id, box, due, s, streak) => rc[id] && rc[id].box === box && rc[id].due === due && rc[id].last === TODAY && rc[id].s === s && rc[id].streak === streak && typeof rc[id].t === 'number' && rc[id].t > Date.now() - 120000;
    ok(chk('1-0', 2, shift(2), 'got', 1), 'recall 1-0: Got it on a new verse → box 2, due +2, s got, streak 1', JSON.stringify(rc['1-0']));
    ok(chk('3-1', 1, shift(1), 'not', 0), 'recall 3-1: Almost on a new verse → box 1, due +1, s not', JSON.stringify(rc['3-1']));
    ok(chk('12-0', 1, shift(1), 'not', 0), 'recall 12-0: Not yet → box 1, due +1, s not', JSON.stringify(rc['12-0']));
    ok(chk('20-1', 2, shift(2), 'got', 1), 'recall 20-1: pre-Leitner row → Got it → box 2, due +2', JSON.stringify(rc['20-1']));
    ok(chk('30-0', 4, shift(7), 'got', 3), 'recall 30-0: third box overdue → Got it → fourth box, due +7, streak 3', JSON.stringify(rc['30-0']));
    ok(rc['40-0'] && rc['40-0'].box === 4 && rc['40-0'].due === TOMORROW && rc['40-0'].last === shift(-6), 'recall 40-0 untouched (not due)', JSON.stringify(rc['40-0']));
    ok(Object.keys(rc).length === 6, 'no other rows in f260.recall');
    const memAfter = await merged(T.eli, 'f260', 'mem:', 'f260.mem');
    ok(JSON.stringify(memAfter) === JSON.stringify(MEM), 'f260.mem untouched');

    console.log('\n## (c) summary row + feed line');
    const lg = await reviewLog(T.eli);
    ok(lg && lg[YESTERDAY] === 2 && lg[TODAY] === 5, 'the review log: { yesterday: 2, today: 5 }', JSON.stringify(lg));
    const sm = (await row(T.eli, 'verses', 'person', 'summary') || {}).value;
    ok(sm && sm.due === 0 && sm.streak === 3 && JSON.stringify(sm.boxes) === '[2,2,0,2,0]' && sm.total === 6 && sm.reviewedToday === 5 && sm.week === null && sm.at === TODAY, 'app_data(verses, person, summary) = { due: 0, streak: 3, boxes: [2,2,0,2,0], total: 6, reviewedToday: 5, week: null, at: today }', JSON.stringify(sm));
    const feed = (await api('/api/activity?limit=40', { profile: T.eli })).activity || [];
    ok(feed.some(a => a.profile_id === 'eli' && a.app_id === 'verses' && /Eli reviewed 5 memory verses/.test(a.text)), 'the feed has "Eli reviewed 5 memory verses"', JSON.stringify(feed.slice(0, 3).map(a => a.text)));

    console.log('\n## (d) a second device as Eli, 1024: practice, rows, Undo');
    const A2 = await newContext(browser, 'A2', 1024);
    await signIn(A2.page, 'eli', ELI_PIN);
    const F2 = await openApp(A2.page);
    ok(await visible(F2, '#done') && await F2.$$eval('#boxes .bx .n', l => l.map(e => e.textContent).join()) === '2,2,0,2,0' && await text(F2, '#st-streak') === '3', 'the other device: all done, the same boxes, streak 3');
    ok(await F2.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll at 1024');
    await A2.page.screenshot({ path: path.join(SHOTS, 'rm19-adult-done-1024.png') });
    // "Practise one anyway" pulls the next scheduled verse in as practice: the due count stays 0 (P3-VERSES-08)
    await F2.click('#again'); await sleep(150);
    ok(await visible(F2, '#trainer') && await text(F2, '#ref') === 'Hebrews 11:17-19', '"Practise one anyway" opens the next scheduled verse (due tomorrow)', await text(F2, '#ref'));
    ok(/extra practice/.test(await text(F2, '#kick') || '') && /practice/.test(await text(F2, '#who') || '') && !/to go/.test(await text(F2, '#who') || '') && await text(F2, '#st-due') === '0' && !(await visible(F2, '#queue-list')) && (await F2.evaluate(() => window.verses.dueIds())).length === 0, 'it is practice: "extra practice" on the card, the pill says practice, nothing due, no Due today list', [await text(F2, '#kick'), await text(F2, '#who')]);
    // IMP-VERSES-F6: a tap on a Coming up row practises that verse now
    await F2.click('#later-list .qrow[data-id="30-0"]'); await sleep(200);
    ok(await text(F2, '#ref') === 'Psalm 51:17' && await visible(F2, '#show') && /extra practice/.test(await text(F2, '#kick') || ''), 'a tap on Psalm 51:17 in Coming up puts it on the card, unrevealed, as practice', await text(F2, '#ref'));
    ok(await F2.evaluate(() => document.activeElement && document.activeElement.id === 'show'), 'focus lands on Show');
    const sm2 = (await F2.evaluate(() => window.verses.summary())) || {};
    ok(sm2.due === 0, 'the summary still counts 0 due', JSON.stringify(sm2));
    // UX-VERSES-2: Not yet by mistake → Undo puts the row back by value and the card back, revealed
    const before30 = await F2.evaluate(() => hub.get('recall:30-0', { app: 'f260', scope: 'person' }));
    await F2.click('#show'); await sleep(60);
    await F2.click('#act-rate [data-rate=not]'); await sleep(150);
    ok(/^Not yet — Psalm 51:17\. Next review tomorrow\./.test(await ratedText(F2) || ''), 'Not yet from the fourth box: "Next review tomorrow"', await ratedText(F2));
    const after30 = await F2.evaluate(() => hub.get('recall:30-0', { app: 'f260', scope: 'person' }));
    ok(after30 && after30.box === 1 && after30.due === TOMORROW && after30.streak === 0, 'Not yet sends it back to box 1, due tomorrow (GAP-VERSES-2)', JSON.stringify(after30));
    ok(after30 && JSON.stringify(after30.hist) === JSON.stringify([{ due: YESTERDAY, last: shift(-5) }]), 'a second rating the same day keeps the history as it was: hist = [{ due: yesterday, last: 5 days ago }] (P3-VERSES-11)', JSON.stringify(after30 && after30.hist));
    ok(await clickUndo(F2), 'the result line has an Undo button');
    await waitFor(() => F2.evaluate(() => JSON.stringify(hub.get('recall:30-0', { app: 'f260', scope: 'person' }))).then(v => v === JSON.stringify(before30)), { label: 'the undo (it pulls first)' }).catch(() => {});
    await sleep(150);
    ok(await text(F2, '#ref') === 'Psalm 51:17' && await visible(F2, '#act-rate') && !(await visible(F2, '#show')), 'Undo: the card returns to Psalm 51:17, revealed');
    ok(await focused(F2) === 'got', "after Undo, focus is on that card's Got it", await focused(F2));
    ok(JSON.stringify(await F2.evaluate(() => hub.get('recall:30-0', { app: 'f260', scope: 'person' }))) === JSON.stringify(before30), 'Undo: the row is the one from before, by value', JSON.stringify(await F2.evaluate(() => hub.get('recall:30-0', { app: 'f260', scope: 'person' }))));
    await synced(F2);
    ok(JSON.stringify(await recallRow(T.eli, '30-0')) === JSON.stringify(before30) && await revToday(T.eli, '30-0') === 1, 'on the server too: the row is back and the review count of Psalm 51:17 is back to 1', [await revToday(T.eli, '30-0')]);
    // a newer review from another device meanwhile is kept
    // (review round 1: this device has NOT pulled the other review when Undo is pressed — Undo pulls first itself)
    await F2.click('#act-rate [data-rate=almost]'); await sleep(150);
    await synced(F2);
    const revAlmost = await revToday(T.eli, '30-0');
    // the keyboard: U undoes while the toast offers it (review round 1)
    const rowAlmost = await F2.evaluate(() => hub.get('recall:30-0', { app: 'f260', scope: 'person' }));
    ok(await F2.$eval('#rated-undo', b => b.getAttribute('aria-keyshortcuts')) === 'U Control+Z Meta+Z', "the line's Undo names its keyboard shortcut");
    await F2.evaluate(() => { if (document.activeElement) document.activeElement.blur(); }); await F2.press('body', 'u');
    await waitFor(() => F2.evaluate(w => JSON.stringify(hub.get('recall:30-0', { app: 'f260', scope: 'person' })) !== JSON.stringify(w), rowAlmost), { label: 'U undoes' });
    ok(JSON.stringify(await F2.evaluate(() => hub.get('recall:30-0', { app: 'f260', scope: 'person' }))) === JSON.stringify(before30) && await visible(F2, '#act-rate'), 'U undoes the Almost: the row is back, the card revealed');
    // review round 2: the shortcut closes with its toast — U does nothing once another toast has replaced it, nor while a
    // confirm sheet is open
    const R30 = () => F2.evaluate(() => JSON.stringify(hub.get('recall:30-0', { app: 'f260', scope: 'person' })));
    const pressU = async () => { await F2.evaluate(() => { if (document.activeElement) document.activeElement.blur(); }); await F2.press('body', 'u'); await sleep(500); };
    await F2.click('#act-rate [data-rate=got]'); await sleep(550);
    let rowNow = await R30();
    // rescore 5: the line's 10 s end — it fades and keeps its row (nothing moves), and U no longer undoes
    const hLine = await F2.$eval('#rated', e => Math.round(e.getBoundingClientRect().height)), hCard = await F2.$eval('#rated', e => Math.round(e.parentElement.getBoundingClientRect().height));
    await F2.evaluate(() => window.verses.endUndo()); await sleep(400);
    const faded = await F2.$eval('#rated', e => ({ faded: e.classList.contains('faded'), vis: getComputedStyle(e).visibility, h: Math.round(e.getBoundingClientRect().height), card: Math.round(e.parentElement.getBoundingClientRect().height) }));
    ok(faded.faded && faded.vis === 'hidden' && faded.h === hLine && faded.card === hCard, 'after its 10 s the line fades and keeps its row: the card does not move', JSON.stringify({ hLine, hCard, faded }));
    await pressU();
    ok(await R30() === rowNow, 'U does nothing once the line is gone');
    await F2.evaluate(() => window.verses.undo()); await waitFor(async () => (await R30()) === JSON.stringify(before30), { label: 'undo by hand' });
    await sleep(200);
    await F2.click('#act-rate [data-rate=got]'); await sleep(550);
    rowNow = await R30();
    await F2.evaluate(() => { window.__ask = hub.confirm('A test sheet', { title: 'Test' }); }); await sleep(150); await pressU();
    ok(await R30() === rowNow && await F2.evaluate(() => !!document.querySelector('.hub-ask')), 'U does nothing while a confirm sheet is open');
    await F2.click('.hub-ask .btn:not(.btn-primary)'); await sleep(150);
    await F2.evaluate(() => window.verses.undo()); await waitFor(async () => (await R30()) === JSON.stringify(before30), { label: 'undo by hand' });
    await sleep(200);
    await F2.click('#act-rate [data-rate=almost]'); await sleep(150);
    await synced(F2);
    const other ={ s: 'got', t: Date.now() + 5000, box: 5, due: shift(14), last: TODAY, streak: 9 };
    await put(T.eli, 'f260', 'recall:30-0', other);
    ok((await F2.evaluate(() => (hub.get('recall:30-0', { app: 'f260', scope: 'person' }) || {}).streak)) !== 9, 'the other device\'s review has not reached this device yet (no pull)');
    ok(await clickUndo(F2), 'Undo is still offered');
    await waitFor(() => toastText(F2).then(t => /another device/.test(t || '')), { label: 'the kept-newer toast' });
    ok(/another device/.test(await toastText(F2) || ''), 'Undo pulls first, finds the newer review from another device and keeps it', await toastText(F2));
    await synced(F2);
    ok((await recallRow(T.eli, '30-0') || {}).streak === 9, 'the other device\'s review is not clobbered on the server', JSON.stringify(await recallRow(T.eli, '30-0')));
    ok(await revToday(T.eli, '30-0') === revAlmost && revAlmost === 2, 'and this device\'s review count is not taken back (the rating stands as a review)', [revAlmost, await revToday(T.eli, '30-0')]);
    await put(T.eli, 'f260', 'recall:30-0', before30);

    console.log('\n## (e) the household verse text — Mom, 390, then Eli');
    const M = await newContext(browser, 'M');
    await signIn(M.page, 'mom', PIN.mom);
    const FM = await openApp(M.page);
    ok(await text(FM, '#ref') === 'Genesis 1:27' && /4 to go/.test(await text(FM, '#who') || ''), 'Mom: Genesis 1:27 first, 4 to go', [await text(FM, '#ref'), await text(FM, '#who')]);
    ok(await visible(FM, '#addtext') && !(await visible(FM, '#text')), 'no text yet: "Add the verse text" is offered');
    await FM.click('#addtext'); await sleep(100);
    ok(await visible(FM, '#textedit') && await FM.evaluate(() => document.activeElement && document.activeElement.id === 'text-input'), 'the editor opens with the field focused');
    ok(/Everyone in the house/.test(await text(FM, '#text-note') || ''), 'it says once that the household shares the text', await text(FM, '#text-note'));
    ok(!(await visible(FM, '#act-show')) && !(await visible(FM, '#act-rate')), 'no Show or ratings while the editor is open');
    await FM.fill('#text-input', PLACE_1); await FM.press('#text-input', 'Enter'); await sleep(200);
    ok(!(await visible(FM, '#textedit')) && /Saved/.test(await toastText(FM) || ''), 'Enter saves it', await toastText(FM));
    ok(['edittext', 'show'].includes(await focused(FM)), 'after Save, focus goes back to the card (Show), not <body>', await focused(FM));
    ok(await FM.$eval('#text-input', e => e.getAttribute('aria-describedby')) === 'text-note', 'the field is described by the household note');
    vt = await veil(FM);
    ok(!vt.hidden && vt.veiled && vt.aria === 'true' && vt.inert && (await text(FM, '#text')) === PLACE_1, 'the card now has the text, veiled and hidden from screen readers until Show', JSON.stringify(vt));
    await synced(FM);
    const tRow = (await familyItems(T.mom, 'verses')).find(r => r.key === 'text:1-0');
    ok(tRow && tRow.value && tRow.value.text === PLACE_1 && tRow.value.by === 'mom' && typeof tRow.value.at === 'number', 'the family row text:1-0 = { text, by: mom, at }', JSON.stringify(tRow && tRow.value));
    await FM.click('#show'); await sleep(60);
    ok(await visible(FM, '#edittext'), 'after Show: "Edit the text"');
    await FM.click('#edittext'); await sleep(80);
    await FM.fill('#text-input', 'something else'); await FM.press('#text-input', 'Escape'); await sleep(120);
    ok(!(await visible(FM, '#textedit')) && (await text(FM, '#text')) === PLACE_1, 'Escape closes the editor and changes nothing');
    await FM.click('#act-rate [data-rate=got]'); await sleep(520);
    ok(await text(FM, '#ref') === 'Joshua 1:8-9' && await visible(FM, '#addtext'), 'next, Joshua 1:8-9: Mom has no paste for it, so "Add the verse text"');
    await FM.click('#addtext'); await sleep(80); await FM.fill('#text-input', PLACE_12); await FM.click('#text-save'); await sleep(200);
    ok((await text(FM, '#text')) === PLACE_12, 'Save adds it');
    await synced(FM);
    // Eli trains both verses: the household text shows for him, and wins over his own F260 paste of Joshua 1:8-9
    await pull(F); await waitFor(() => F.evaluate(p => window.verses.textOf('12-0') === p, PLACE_12), { label: 'the household text on Eli\'s phone' });
    ok(await F.evaluate(() => window.verses.textOf('1-0')) !== '' && await F.evaluate(p => window.verses.textOf('1-0') === p, PLACE_1), 'Eli sees the text Mom added for Genesis 1:27');
    ok(true, 'the household text of Joshua 1:8-9 wins over Eli\'s own F260 paste');
    // a kid cannot write the household text
    let kidErr = null; try { await api('/api/data/verses/' + encodeURIComponent('text:5-0') + '?scope=family', { method: 'PUT', profile: T.ezra, body: { value: { text: 'x', by: 'ezra', at: Date.now() }, updated_at: Date.now() } }); } catch (e) { kidErr = e; }
    ok(kidErr && kidErr.status === 403, 'a kid\'s write of a text row is refused (403)', kidErr && kidErr.error);
    // Remove: Eli takes the household text of Joshua 1:8-9 away → his F260 paste shows again
    await pull(F2); await waitFor(() => F2.evaluate(p => window.verses.textOf('12-0') === p, PLACE_12), { label: 'the household text on Eli\'s other device' });
    await F2.click('#later-list .qrow[data-id="12-0"]');
    await sleep(200); await F2.click('#show'); await sleep(60);
    ok((await text(F2, '#text')) === PLACE_12, 'on Eli\'s other device: the household text', await text(F2, '#text'));
    await F2.click('#edittext'); await sleep(80);
    ok(await visible(F2, '#text-clear'), 'the editor offers "Remove the text" for a household row');
    await F2.click('#text-clear'); await sleep(200);
    ok(await F2.evaluate(() => !!document.querySelector('.hub-ask')), 'Remove asks first, in the shared confirm sheet');
    await F2.click('.hub-ask .btn-danger'); await sleep(250);
    ok((await text(F2, '#text')) === TEXT_12 && /Removed/.test(await toastText(F2) || ''), 'after Remove, Eli\'s own F260 paste shows again', await text(F2, '#text'));
    await synced(F2);
    ok(!(await familyItems(T.eli, 'verses')).some(r => r.key === 'text:12-0' && r.value != null), 'the family row text:12-0 is gone');

    console.log('\n## (f) the Leitner rule and the streak rule — Mom');
    ok(await text(FM, '#ref') === 'Joshua 1:8-9', 'Mom still on Joshua 1:8-9');
    // the streak rule over Mom's rows: Proverbs 3:5-6 (20-1) was memorised ten days ago and never reviewed, so it was due
    // two days ago: a gap there breaks the streak. Over Eli's rows the same gap had nothing due and keeps it.
    const L3 = { [YESTERDAY]: 1, [shift(-3)]: 1 };
    ok(await FM.evaluate(l => window.verses.streakOf(l), L3) === 1 && await F.evaluate(l => window.verses.streakOf(l), L3) === 2, 'a past day with a verse due and no review breaks the streak (Mom: 1); a day with nothing due keeps it (Eli: 2)', [await FM.evaluate(l => window.verses.streakOf(l), L3), await F.evaluate(l => window.verses.streakOf(l), L3)]);
    ok(await FM.evaluate(l => window.verses.streakOf(l), { [YESTERDAY]: 1 }) === 1 && await FM.evaluate(l => window.verses.streakOf(l), { [TODAY]: 1, [YESTERDAY]: 1 }) === 2 && await FM.evaluate(() => window.verses.streakOf({})) === 0, 'today is pending: yesterday alone is a streak of 1, today + yesterday 2, nothing 0');
    await rateCard(FM, 'almost');
    ok(await text(FM, '#ref') === 'Proverbs 3:5-6', 'then Proverbs 3:5-6', await text(FM, '#ref'));
    await rateCard(FM, 'got');
    ok(await text(FM, '#ref') === 'Psalm 51:17' && await text(FM, '#boxchip') === 'Reviewed 8 days ago', 'then Psalm 51:17, "Reviewed 8 days ago"', await text(FM, '#boxchip'));
    await FM.click('#show'); await sleep(60);
    ok(JSON.stringify(await nx(FM)) === JSON.stringify({ not: 'tomorrow', almost: 'in 7 days', got: 'in 14 days' }), 'from the fourth box: Not yet tomorrow, Almost in 7 days, Got it in 14 days', JSON.stringify(await nx(FM)));
    await FM.click('#act-rate [data-rate=not]'); await sleep(520);
    await synced(FM);
    const m30 = await recallRow(T.mom, '30-0');
    ok(m30 && m30.box === 1 && m30.due === TOMORROW && m30.streak === 0 && m30.last === TODAY, 'Not yet → box 1, due tomorrow, streak 0 (classic Leitner)', JSON.stringify(m30));
    ok(await visible(FM, '#done') && /all done/.test(await text(FM, '#who') || ''), 'Mom: all done');

    console.log('\n## (g) kid flow — Ezra, 390');
    ok(REFS.length === 52 && REFS.every(r => r.length === 2), 'the app carries the 52-week, two-per-week reference table');
    await setWeek(5);
    // an older recall row of another verse (a week Ezra practised before): kept in his scope, never shown or counted
    const OLDROW = { s: 'got', t: Date.now() - 30 * 86400000, box: 3, due: shift(-20), last: shift(-24), streak: 2 };
    await put(T.ezra, 'f260', 'recall:3-1', OLDROW);
    const K = await newContext(browser, 'K');
    await signIn(K.page, 'ezra');
    const FK = await openApp(K.page);
    ok(await FK.evaluate(() => document.documentElement.dataset.kind) === 'kid', 'the app runs in kid mode (data-kind="kid")');
    // another suite on the shared Worker may move the family week under us: check against the week the app sees
    const W = await FK.evaluate(() => { const v = hub.get('week', { app: 'kidverse', scope: 'family' }); return v && typeof v === 'object' ? v.week : v; });
    if (W !== 5) console.log('  … the family week is ' + W + ' (another suite moved it); checking against that week');
    // UX-VERSES-1 (orchestrator's decision): a kid practises only the verse Kid Verse teaches that week
    const [PI, WORDS] = KIDWORDS[W - 1], K0 = REFS[W - 1][PI], KID = W + '-' + PI;
    ok(await text(FK, '#ref') === K0, 'family week ' + W + ' → ' + K0 + ' (the verse Kid Verse teaches)', await text(FK, '#ref'));
    ok(JSON.stringify(await FK.evaluate(() => window.verses.trained())) === JSON.stringify([KID]) && JSON.stringify(await FK.evaluate(() => window.verses.dueIds())) === JSON.stringify([KID]), 'only that verse is trained and due (an older row of another verse is not shown)', JSON.stringify(await FK.evaluate(() => window.verses.trained())));
    const said = ref => { const m = ref.match(/^(\d\s)?([A-Za-z ]+?)\s+(\d+):(\d+)(?:-(\d+))?[a-z]?$/); const ord = { 1: 'First', 2: 'Second', 3: 'Third' }; const book = (m[1] ? ord[m[1].trim()] + ' ' : '') + m[2].trim(); const vs = m[5] ? `verses ${m[4]} to ${m[5]}` : `verse ${m[4]}`; return /^Psalms?$/i.test(m[2].trim()) ? `Psalm ${m[3]}, ${vs}` : `${book}, chapter ${m[3]}, ${vs}`; };
    ok(/1 to go/.test(await text(FK, '#who') || ''), 'the pill says "1 to go"', await text(FK, '#who'));
    ok(await FK.$eval('#stats', e => e.hidden) && await FK.$eval('#queue', e => e.hidden) && await FK.$eval('#boxchip', e => e.hidden), 'no stats, no queue, no chip for a kid');
    // UX-VERSES-1: the paraphrase of the verse Kid Verse teaches this week, labelled a paraphrase
    const paraOn0 = true;   // the card is always the verse Kid Verse paraphrases
    ok(await visible(FK, '#para') === paraOn0 && (!paraOn0 || ((await text(FK, '#para-text')) === WORDS && /paraphrase/i.test(await text(FK, '#para') || ''))), paraOn0 ? 'the card shows Kid Verse\'s paraphrase for the week, labelled a paraphrase' : 'this card has no paraphrase (Kid Verse paraphrases the other verse this week)', await text(FK, '#para'));
    ok(await FK.$$eval('input, textarea, select, [contenteditable]', l => l.filter(e => !e.closest('[hidden]') && e.offsetParent !== null).length) === 0 && !(await visible(FK, '#addtext')) && !(await visible(FK, '#text')), 'no text input, no "Add the verse text", no verse text for a kid');
    const kRef = await FK.$eval('#ref', e => parseFloat(getComputedStyle(e).fontSize));
    ok(kRef >= 40, 'the reference is ≥ 40 px for a kid', kRef);
    ok(await FK.$$eval('button', bs => bs.filter(b => !b.hidden && b.offsetParent !== null).every(b => b.getBoundingClientRect().height >= 64 && b.getBoundingClientRect().width >= 64)), 'every visible control is a ≥ 64 px button');
    ok(await FK.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll at 390');
    await FK.click('#say');
    const spokenK = await waitFor(() => FK.evaluate(() => window.__spoken.length ? window.__spoken : null), { label: 'kid speech' });
    const wantK = said(K0) + (paraOn0 ? '. ' + WORDS : '');
    ok(spokenK.length === 1 && Math.abs(spokenK[0].rate - 0.85) < 1e-6 && spokenK[0].text === wantK, '"Read aloud" speaks the reference' + (paraOn0 ? ' and the paraphrase' : '') + ' at rate 0.85', JSON.stringify(spokenK));
    await sleep(120);
    ok(await text(FK, '#say span') === 'Read aloud', 'the button returns to "Read aloud" when the voice finishes');
    const hkBefore = (await box(FK, '#trainer')).h;
    await FK.click('#show'); await sleep(60);
    ok(Math.abs((await box(FK, '#trainer')).h - hkBefore) <= 2, 'the kid card does not grow on Show', hkBefore + ' → ' + (await box(FK, '#trainer')).h);
    ok(await FK.$$eval('#act-rate button', bs => bs.filter(b => b.offsetParent !== null).every(b => b.getBoundingClientRect().height >= 64)), 'the three rating buttons are ≥ 64 px for a kid');
    const pics = await FK.evaluate(() => ({ on: document.getElementById('act-rate').classList.contains('pics'), got: (document.querySelector('[data-rate=got] .pic use') || {}).getAttribute?.('href'), almost: (document.querySelector('[data-rate=almost] .pic use') || {}).getAttribute?.('href'), not: (document.querySelector('[data-rate=not] .pic use') || {}).getAttribute?.('href'), nx: [...document.querySelectorAll('#act-rate .nx')].every(e => e.hidden || !e.textContent) }));
    ok(pics.on && /#i-check$/.test(pics.got) && /#i-circle-dashed$/.test(pics.almost) && /#i-rotate-ccw$/.test(pics.not) && pics.nx, 'picture buttons (Worker B, rescore 5: a big check for Got it, so it never looks like the reward star), the adults’ dashed circle for Almost (final rescore C), a try-again arrow for Not yet; no interval words', JSON.stringify(pics));
    const picShown = await FK.$$eval('#act-rate .pic', ps => ps.every(p => getComputedStyle(p).display !== 'none' && p.getBoundingClientRect().width >= 24));
    ok(picShown, 'the pictures are drawn and big (≥ 24 px)');
    await K.page.screenshot({ path: path.join(SHOTS, 'rm19-kid-390.png') });
    await FK.click('#act-rate [data-rate=got]'); await sleep(520);
    ok(await visible(FK, '#done') && await text(FK, '#done-big') === 'All done for today' && await visible(FK, '#again'), 'one rating → "All done for today" with Practise again');
    ok(/this week’s verse\./.test(await text(FK, '#done-sub') || ''), 'the done card says "this week’s verse"', await text(FK, '#done-sub'));
    const kLine = { text: await ratedText(FK), undo: await FK.$eval('#rated-undo', b => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }) };
    ok(kLine.text === 'Got it! See you tomorrow.' && kLine.undo[0] >= 64 && kLine.undo[1] >= 64, "a kid's result line is in plain words, and its Undo is ≥ 64 px", JSON.stringify(kLine));
    ok(await FK.$eval('#stats', e => e.hidden), 'still no stats');
    await K.page.screenshot({ path: path.join(SHOTS, 'rm19-kid-done-390.png') });
    await FK.click('#again'); await sleep(150);
    ok(await visible(FK, '#trainer') && await text(FK, '#ref') === K0 && JSON.stringify(await FK.evaluate(() => window.verses.dueIds())) === JSON.stringify([]), "Practise again reopens the week's one verse (practice: nothing due)", await text(FK, '#ref'));
    await rateCard(FK, 'almost');
    ok(await visible(FK, '#done'), 'and one more rating brings the done card back');
    await synced(FK);
    const rk = await merged(T.ezra, 'f260', 'recall:', 'f260.recall');
    ok(rk && rk[KID] && rk[KID].box === 2 && rk[KID].due === shift(2) && rk[KID].last === TODAY && rk[KID].s === 'not' && JSON.stringify(rk['3-1']) === JSON.stringify(OLDROW) && Object.keys(rk).length === 2, "Ezra's own recall rows: " + KID + ' (Got it, then Almost: box 2, +2), and the older row 3-1 kept as it was', JSON.stringify(rk));
    const smk = (await row(T.ezra, 'verses', 'person', 'summary') || {}).value;
    ok(smk && smk.due === 0 && smk.streak === 1 && smk.reviewedToday === 2 && smk.week === W && smk.total === 1 && JSON.stringify(smk.boxes) === '[0,1,0,0,0]', "Ezra's summary counts the one verse: { due: 0, streak: 1, reviewedToday: 2, week: " + W + ', total: 1, boxes: [0,1,0,0,0] }', JSON.stringify(smk));
    const feedK = (await api('/api/activity?limit=40', { profile: T.eli })).activity || [];
    ok(feedK.some(a => a.profile_id === 'ezra' && a.app_id === 'verses' && /Ezra reviewed 1 memory verse$/.test(a.text)), 'the feed has "Ezra reviewed 1 memory verse"', JSON.stringify(feedK.filter(a => a.profile_id === 'ezra').slice(0, 3).map(a => a.text)));
    // the family week moves on → the kid's verse follows on the next pull
    // (core round 6) while "Practise again" holds last week's verse on the card: the card moves to the new week's verse
    await FK.click('#again'); await sleep(150);
    ok(await text(FK, '#ref') === K0, 'Practise again holds this week\'s verse on the card', await text(FK, '#ref'));
    const W2 = (W % 52) + 1, KID2 = W2 + '-' + KIDWORDS[W2 - 1][0]; await setWeek(W2);
    await FK.evaluate(() => hub.pull());
    await waitFor(() => FK.evaluate(k => window.verses.dueIds().join() === k, KID2), { label: 'kid queue follows the week' });
    ok(true, "the kid's verse follows the family week (hub.onChange): " + KID2);
    const K2 = REFS[W2 - 1][KIDWORDS[W2 - 1][0]];
    await waitFor(() => text(FK, '#ref').then(r => r === K2), { label: 'the card on the new week\'s verse' }).catch(() => {});
    ok(await text(FK, '#ref') === K2 && await FK.evaluate(() => window.verses.currentId()) === KID2, 'a Practise again card from last week moves to the new week\'s verse (' + K2 + '), never rating a verse no longer shown', await text(FK, '#ref'));

    console.log('\n## (h) the kiosk — Downstairs TV, standalone');
    const TV = await newContext(browser, 'TV', 1440);
    await signIn(TV.page, 'tv');
    await TV.page.goto(SITE + '/apps/verses.html');
    await TV.page.waitForFunction(() => window.verses && window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 });
    await sleep(300);
    ok(await visible(TV.page, '#empty') && !(await visible(TV.page, '#act-rate')) && !(await visible(TV.page, '#open-f260')), 'standalone open works: nothing to train, no rating buttons, no Open F260 on the TV');
    ok(!/·/.test(await text(TV.page, '#who') || ''), 'the TV\'s pill says nothing about "all done"', await text(TV.page, '#who'));
    ok(!(await row(T.tv, 'verses', 'person', 'summary').catch(() => null)), 'the kiosk wrote no summary');
    ok(await TV.page.evaluate(() => { try { window.verses.rate('got'); return true; } catch { return false; } }), 'rate() on the kiosk does not throw');

    console.log('\n## (i) nothing due — Dad');
    const D = await newContext(browser, 'D');
    await signIn(D.page, 'dad', PIN.dad);
    const FD = await openApp(D.page);
    ok(await visible(FD, '#done') && await text(FD, '#done-big') === 'Nothing due today' && await FD.$eval('#done .icon.star', e => e.hasAttribute('hidden') && getComputedStyle(e).display === 'none'), '"Nothing due today", without the celebration star (UX-VERSES-4)');
    ok(/nothing due/.test(await text(FD, '#who') || '') && !/all done/.test(await text(FD, '#who') || ''), 'the pill says "nothing due", not "all done"', await text(FD, '#who'));
    ok(await text(FD, '#st-streak') === '1' && /streak safe/.test(await text(FD, '#stats-sub') || '') && /keeps your streak/.test(await text(FD, '#done-sub') || ''), 'the streak (1) is kept, and the screen says so', [await text(FD, '#st-streak'), await text(FD, '#stats-sub'), await text(FD, '#done-sub')]);
    ok(!(await visible(FD, '#queue-list')) && ((await FD.evaluate(() => document.body.innerText)).match(/Nothing due/g) || []).length === 1, 'the empty message is said once', (await FD.evaluate(() => document.body.innerText)).match(/Nothing due/gi));

    console.log('\n## (j) nothing to train — Mea');
    const N = await newContext(browser, 'N');
    await signIn(N.page, 'niece', PIN.niece);
    const FN = await openApp(N.page);
    ok(await visible(FN, '#empty') && /you can review it here straight away/.test(await text(FN, '#empty p') || ''), 'the empty card: "…you can review it here straight away" (P3-VERSES-14)', await text(FN, '#empty p'));
    ok(!/all done|nothing due/.test(await text(FN, '#who') || ''), 'the pill says neither "all done" nor "nothing due"', await text(FN, '#who'));
    ok(await visible(FN, '#open-f260'), 'an "Open F260" button (GAP-VERSES-3)');
    await FN.click('#open-f260');
    await waitFor(() => N.page.frames().find(f => /apps\/f260\.html/.test(f.url())), { label: 'F260 in the viewer' });
    ok(true, 'Open F260 opens F260 in the hub');

    console.log('\n## (k) the household text never holds up the trainer (review round 1)');
    // a device that cannot pull Verses' family channel (never pulled it, offline for it) still opens on its card
    const D2 = await newContext(browser, 'D2', 820);
    const famRoute = u => u.pathname === '/api/data/verses' && u.searchParams.get('scope') === 'family';
    await D2.ctx.route(famRoute, r => r.abort('internetdisconnected'));
    await signIn(D2.page, 'dad', PIN.dad);
    // (not openApp(): its wait for a finished pull never ends while one channel cannot be reached — which is the point)
    await D2.page.click('.tab[data-tab=apps]'); await D2.page.waitForSelector('.tile[data-id=verses]'); await D2.page.click('.tile[data-id=verses]');
    const FD2 = await waitFor(() => D2.page.frames().find(f => /apps\/verses\.html/.test(f.url())), { label: 'verses frame' });
    await waitFor(() => visible(FD2, '#done'), { label: 'Dad\'s card without the family channel', timeout: 20000 });
    ok(await FD2.evaluate(() => !hub.isLoaded('verses', 'family') && hub.isLoaded('verses', 'person')) && await text(FD2, '#done-big') === 'Nothing due today', 'without the family channel the trainer still shows Dad\'s card (not "loading")');
    await D2.ctx.unroute(famRoute);
    await FD2.evaluate(() => hub.pull());
    await waitFor(() => FD2.evaluate(() => hub.isLoaded('verses', 'family')), { label: 'the family channel after the route opens' });
    ok(true, 'the household text channel loads when it can, on its own');
    errors.splice(0, errors.length, ...errors.filter(e => !/^D2: /.test(e)));   // the blocked pull logs a failed request

    console.log('\n## (l) a missed day stays missed after two reviews (review round 2, E2b)');
    // Dad: rated three days ago (due two days ago), MISSED two days ago, rated yesterday (a round-1 row: one prev), and
    // Got it today. The row's history keeps both replaced schedules, so the streak still breaks two days ago: 2, not 3
    await put(T.dad, 'f260', 'recall:2-0', { s: 'not', t: Date.now() - 86400000, box: 1, due: TODAY, last: YESTERDAY, streak: 0, prev: { due: shift(-2), last: shift(-3) } });
    await put(T.dad, 'verses', 'log', { [YESTERDAY]: 1, [shift(-3)]: 1 });
    await pull(FD);
    await waitFor(() => FD.evaluate(() => window.verses.currentId() === '2-0'), { label: 'Dad\'s card on 2-0' });
    ok(await FD.evaluate(() => window.verses.dayStreak()) === 1, 'before today\'s review: 1 (a round-1 row\'s prev still counts the missed day)', await FD.evaluate(() => window.verses.dayStreak()));
    await FD.click('#show'); await sleep(60); await FD.click('#act-rate [data-rate=got]'); await sleep(520);
    const r20 = await FD.evaluate(() => hub.get('recall:2-0', { app: 'f260', scope: 'person' }));
    ok(r20 && JSON.stringify(r20.hist) === JSON.stringify([{ due: shift(-2), last: shift(-3) }, { due: TODAY, last: YESTERDAY }]) && !('prev' in r20), 'the row keeps a history of both replaced schedules (hist), oldest first', JSON.stringify(r20 && r20.hist));
    ok(await FD.evaluate(() => window.verses.dayStreak()) === 2 && await text(FD, '#st-streak') === '2', 'after today\'s review: 2 (today, yesterday) — the day missed two reviews back still breaks it', [await FD.evaluate(() => window.verses.dayStreak()), await text(FD, '#st-streak')]);
    // a second rating the same day adds nothing to the history; entries older than 30 days are dropped (with the
    // never-reviewed entry), and a day older than the history is read generously
    await FD.click('#again'); await sleep(150); await FD.click('#show'); await sleep(60); await FD.click('#act-rate [data-rate=almost]'); await sleep(520);
    ok((await FD.evaluate(() => (hub.get('recall:2-0', { app: 'f260', scope: 'person' }) || {}).hist || [])).length === 2, 'a second rating today adds nothing to the history');
    await put(T.dad, 'f260', 'recall:2-0', { s: 'not', t: Date.now() - 86400000, box: 1, due: TODAY, last: YESTERDAY, streak: 0, hist: [{ due: null, last: null }, { due: shift(-40), last: shift(-41) }, { due: shift(-2), last: shift(-31) }] });
    await pull(FD); await waitFor(() => FD.evaluate(() => ((hub.get('recall:2-0', { app: 'f260', scope: 'person' }) || {}).hist || []).length === 3), { label: 'the long history' });
    await FD.evaluate(() => window.verses.practise('2-0')); await sleep(150); await FD.click('#show'); await sleep(60); await FD.click('#act-rate [data-rate=got]'); await sleep(520);
    const h30 = await FD.evaluate(() => (hub.get('recall:2-0', { app: 'f260', scope: 'person' }) || {}).hist);
    ok(JSON.stringify(h30) === JSON.stringify([{ due: TODAY, last: YESTERDAY }]), 'entries older than 30 days are dropped, the never-reviewed entry with them', JSON.stringify(h30));
    // review round 3 (H1): a rating the row lost. Another device rated 2-0 three days ago, but a device offline since before
    // then rated today from its stale copy, so the row's history knows only the schedule before (due three days ago). The
    // rev: rows still show the lost review: the days after it are read generously — 3 (today, 3 and 10 days ago), never 1
    await put(T.dad, 'verses', 'log', {});
    for (const k of (await api('/api/data/verses?scope=person', { profile: T.dad })).items.filter(r => r.key.startsWith('rev:') && r.value != null).map(r => r.key)) await del(T.dad, 'verses', k);
    await put(T.dad, 'f260', 'recall:2-0', { s: 'got', t: Date.now(), box: 5, due: shift(14), last: TODAY, streak: 2, hist: [{ due: shift(-3), last: shift(-10) }] });
    for (const [d, dev] of [[shift(-10), 'h1-a'], [shift(-3), 'h1-a'], [TODAY, 'h1-b']]) await put(T.dad, 'verses', `rev:${d}:2-0:${dev}`, 1);
    await pull(FD);
    await waitFor(() => FD.evaluate(d => hub.has('rev:' + d + ':2-0:h1-a') && !hub.get('log').hasOwnProperty?.(d) && ((hub.get('recall:2-0', { app: 'f260', scope: 'person' }) || {}).due || '') > hub.today(), shift(-3)), { label: 'the lost-rating rows' });
    const h1 = await FD.evaluate(() => window.verses.dayStreak());
    ok(h1 === 3, 'a rating another device overwrote never counts against the streak: 3, not 1 (H1)', h1);

    console.log('\n## console');
    ok(errors.length === 0, 'no console errors or page errors', errors.join(' | '));
  } catch (e) { fail++; console.log('  ✗ crashed:', e.stack || e); }
  finally { await browser.close(); server.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
