#!/usr/bin/env node
// Roadmap 21 checks: the TV glue board (kiosk Home).
//   (a) backdrop = the family album, full-bleed, blurred 24px under the theme's --scrim; two <img>s that swap src and
//       crossfade; the ambient art (art/ambient/<dawn|day|dusk|night>.svg) stands in when the album is empty
//   (b) over it: clock + date, the adult verse of the week (family kidverse 'week' row → the two F260 memory-verse refs,
//       plus the kid line when the row carries one), who prayed today (family prayer rows' prayedBy[today] → faces),
//       reading today (adults with a "Read week…" feed line dated today), the latest five feed lines with faces, the kids'
//       stars (family stars:<kid> rows), and reminders last + small + one line each — only when there is at least one
//   (c) nothing to touch: no input/textarea/contenteditable renders; clicking anything but #kiosk-switch changes nothing;
//       Switch opens the picker; the kiosk still cannot write
//   (d) no horizontal scroll at 1024×1366 and 1920×1080
//   AC: 24 h unattended without memory growth — with /api blocked, 200 crossfade cycles + 200 clock ticks driven through
//       window.__tv with fake time leave document.querySelectorAll('*').length and window.__tvStats unchanged.
//   Screenshots → docs/screens/rm21-tv-{1024,1920}-{hearth,midnight}.png
//   cd worker && npx wrangler dev --port 8787     (seeded local D1)
//   node scripts/test-tv.mjs <pairing-code>
// Serves the repo on :8981 and proxies /api to the Worker, so it never needs :8765.
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
const PORT = 8981;
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
async function waitFor(fn, { timeout = 15000, every = 150, label = 'condition' } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { try { const v = await fn(); if (v) return v; } catch {} await sleep(every); }
  throw new Error('timeout waiting for ' + label);
}

// ── seed through the API ─────────────────────────────────────────
let DEVICE = null;
async function api(p, { method = 'GET', body, profile, retried } = {}) {
  const h = { 'Content-Type': 'application/json' };
  if (DEVICE) h['X-Device-Token'] = DEVICE;
  if (profile) h['X-Profile-Token'] = profile === 'eli' ? ELI : profile;
  const r = await fetch(API + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    // another suite reset the shared local D1 under us: pair + sign Eli in again and retry once
    if (!retried && (j.error === 'device_not_paired' || j.error === 'profile_session_invalid') && p !== '/api/pair') { await pairEli(); return api(p, { method, body, profile: profile ? 'eli' : undefined, retried: true }); }
    const e = new Error(j.message || r.statusText); e.status = r.status; e.error = j.error; throw e;
  }
  return j;
}
async function pairEli() { DEVICE = (await api('/api/pair', { method: 'POST', body: { code: CODE, name: 'test-tv seeder' } })).device_token; ELI = await login('eli', ELI_PIN); }
async function login(id, pin) {
  try { return (await api('/api/login', { method: 'POST', body: pin ? { profile_id: id, pin } : { profile_id: id } })).profile_token; }
  catch (e) { if (e.error === 'needs_pin_setup') return (await api(`/api/profiles/${id}/pin`, { method: 'POST', body: { pin } })).profile_token; throw e; }
}
const pad = n => String(n).padStart(2, '0');
const dayKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const isoWeek = d => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); return y + '-W' + pad(Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7)); };
const TODAY = dayKey(new Date()), YESTERDAY = dayKey(new Date(Date.now() - 86400000)), WEEK = isoWeek(new Date()), LAST_WEEK = isoWeek(new Date(Date.now() - 7 * 86400000));
const SEED = { prayerKey: 'prayer:tv21', remKey: 'item:tv21' };
let ELI = null;
async function seed() {
  await pairEli();
  const now = Date.now() + 1000;
  const rows = items => items.map(([key, value], i) => ({ key, value, updated_at: now + i }));
  // (b) week 3 for the verse of the week, with a kid line; Eli + Mae prayed on a family request today; stars; one reminder
  await api('/api/data/kidverse/batch?scope=family', { method: 'POST', profile: 'eli', body: { items: rows([
    ['week', { week: 3, line: 'God keeps his promises, even when they take a long time.' }],
    ['stars:ezra', { week: WEEK, count: 3 }], ['stars:kiara', { week: LAST_WEEK, count: 7 }],
  ]) } });
  await api('/api/data/prayer/batch?scope=family', { method: 'POST', profile: 'eli', body: { items: rows([
    [SEED.prayerKey, { id: 'tv21', title: 'Grandma\'s knee', category: 'Family', detail: '', for: '', phone: '', cadence: 'daily', days: [], status: 'active', createdAt: YESTERDAY, lastPrayedAt: TODAY, answeredAt: null, answerNote: null, updates: [], sharedFrom: null, prayedBy: { [YESTERDAY]: ['David'], [TODAY]: ['Eli', 'Mae'] }, by: 'eli', updatedAt: new Date().toISOString() }],
  ]) } });
  await api('/api/data/reminders/batch?scope=family', { method: 'POST', profile: 'eli', body: { items: rows([
    [SEED.remKey, { id: 'tv21', text: 'Bins go out tonight — a reminder long enough to prove the TV keeps it to one line', by: 'eli', byName: 'Eli', createdAt: now }],
  ]) } });
  // (b) feed: Eli read today (→ "Reading today" ✓), then enough lines that the TV's five are all fresh
  await api('/api/activity', { method: 'POST', profile: 'eli', body: { app_id: 'f260', text: 'Read week 3 day 1 — Genesis 18-19' } });
  for (let i = 0; i < 5; i++) await api('/api/activity', { method: 'POST', profile: 'eli', body: { app_id: ['leftovers', 'prayer', 'reminders', 'timer', 'hub'][i], text: `TV seed line ${i + 1}` } });
}
async function cleanup() {
  if (!ELI) return;
  try { await api('/api/data/prayer/' + encodeURIComponent(SEED.prayerKey) + '?scope=family', { method: 'DELETE', profile: 'eli' }); } catch {}
  try { await api('/api/data/reminders/' + encodeURIComponent(SEED.remKey) + '?scope=family', { method: 'DELETE', profile: 'eli' }); } catch {}
  try { for (const p of await myPhotos()) await api('/api/album/' + encodeURIComponent(p.id), { method: 'DELETE', profile: 'eli' }).catch(() => {}); } catch {}
}

// What the board should show right now, from the API (other suites share this D1 and write the same family rows).
const MEMORY = (() => { const f = fs.readFileSync(path.join(ROOT, 'apps', 'f260.html'), 'utf8'); const b = f.slice(f.indexOf('const PLAN = ['), f.indexOf('];', f.indexOf('const PLAN = ['))); return [...b.matchAll(/\{\s*w:\s*(\d+),[^}]*m:\s*\[([^\]]*)\]/g)].map(m => m[2].match(/"([^"]*)"/g).map(s => JSON.parse(s))); })();
async function expected() {
  const profiles = (await api('/api/profiles', { profile: 'eli' })).profiles;
  const kv = Object.fromEntries((await api('/api/data/kidverse?scope=family', { profile: 'eli' })).items.filter(i => i.value != null).map(i => [i.key, i.value]));
  const wk = kv.week; const n = Math.min(52, Math.max(1, Math.floor(Number(wk && typeof wk === 'object' ? (wk.week || wk.w || wk.n) : wk) || 1)));
  const kidline = wk && typeof wk === 'object' ? String(wk.line || wk.kid || wk.text || '').trim() : '';
  const starsOf = v => v && typeof v === 'object' && v.week === WEEK ? Math.max(0, Math.floor(Number(v.count) || 0)) : 0;
  const stars = profiles.filter(p => p.kind === 'kid').map(p => p.name + ' ★' + starsOf(kv['stars:' + p.id]));
  const prayed = new Set();
  for (const r of (await api('/api/data/prayer?scope=family&prefix=prayer:', { profile: 'eli' })).items) { const l = r.value && r.value.prayedBy && r.value.prayedBy[TODAY]; if (Array.isArray(l)) for (const x of l) prayed.add(String(x)); }
  const feed = (await api('/api/activity?limit=100', { profile: 'eli' })).activity;
  const readers = new Set(feed.filter(a => /^Read week/.test(a.text || '') && dayKey(new Date(a.created_at)) === TODAY).map(a => a.profile_id));
  const adults = profiles.filter(p => p.kind === 'adult').map(p => ({ id: p.id, name: p.name, read: readers.has(p.id) }));
  return { n, refs: MEMORY[n - 1] || [], kidline, stars, prayed: [...prayed].sort(), adults, feed: feed.slice(0, 5) };
}

// ── browser ──────────────────────────────────────────────────────
const errors = [];
async function newContext(browser, name, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: true, colorScheme: 'light' });
  await ctx.addInitScript(api => { try { localStorage.setItem('hub.api', JSON.stringify(api)); } catch {} }, SITE);
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR_FAILED/.test(m.text())) errors.push(name + ': ' + m.text()); });
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
// two square JPEGs (1024 + 256) drawn in a page: a big coloured picture with a circle, the shape the album wants
const makePics = (page, hue) => page.evaluate(hue => {
  const draw = size => { const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d');
    const grad = g.createLinearGradient(0, 0, size, size); grad.addColorStop(0, `hsl(${hue} 60% 70%)`); grad.addColorStop(1, `hsl(${hue + 60} 50% 40%)`);
    g.fillStyle = grad; g.fillRect(0, 0, size, size); g.fillStyle = `hsl(${hue + 30} 70% 35%)`; g.beginPath(); g.arc(size / 2, size / 2, size / 3, 0, 7); g.fill();
    return cv.toDataURL('image/jpeg', .8); };
  return { lg: draw(1024), sm: draw(256) };
}, hue);
let PICS = [];
const isMine = v => v && /^test-tv /.test(v.caption || '');
async function myPhotos() { return (await api('/api/data/hub?scope=family&prefix=album:', { profile: 'eli' })).items.map(i => i.value).filter(isMine); }
// the album holds this suite's two pictures (put back if another suite reset the shared D1 meanwhile); returns the rows
async function ensurePhotos() {
  let mine = await myPhotos();
  for (let i = mine.length; i < PICS.length; i++) mine.push((await api('/api/album', { method: 'POST', profile: 'eli', body: { ...PICS[i], caption: 'test-tv ' + Date.now() } })).photo);
  return mine;
}
const text = (page, sel) => page.$eval(sel, e => e.textContent.trim().replace(/\s+/g, ' ')).catch(() => null);
const noHScroll = page => page.evaluate(() => { const v = document.getElementById('views'); return v.scrollWidth <= v.clientWidth + 1 && document.documentElement.scrollWidth <= window.innerWidth + 1 && document.getElementById('tv').getBoundingClientRect().right <= window.innerWidth + 1; });
const boardState = page => page.evaluate(() => {
  const tv = document.getElementById('tv'), bg = tv.querySelector('.tv-bg'), on = [...tv.querySelectorAll('.tv-bg-img.on')].sort((a, b) => (+b.style.zIndex || 0) - (+a.style.zIndex || 0))[0];
  return {
    imgs: tv.querySelectorAll('.tv-bg-img').length, onSrc: on ? on.getAttribute('src') : null, loaded: !!on && on.complete && on.naturalWidth > 0,
    blur: on ? getComputedStyle(on).filter : null, fixed: getComputedStyle(bg).position, bgRect: bg.getBoundingClientRect().toJSON(),
    scrim: getComputedStyle(tv.querySelector('.tv-scrim')).backgroundColor, token: getComputedStyle(document.documentElement).getPropertyValue('--scrim').trim(),
    clock: document.getElementById('clock').textContent.trim(), date: document.getElementById('tv-date').textContent.trim(),
    verseHd: document.getElementById('tv-verse-hd').textContent.trim(), refs: [...document.querySelectorAll('#tv-refs span')].map(s => s.textContent.trim()), kidline: document.getElementById('tv-kidline').textContent.trim(),
    prayed: [...document.querySelectorAll('#tv-prayed .tv-face')].map(f => ({ name: f.lastElementChild.textContent.trim(), face: (f.querySelector('.avatar') || {}).textContent })),
    read: [...document.querySelectorAll('#tv-read .tv-face')].map(f => ({ name: f.lastElementChild.textContent.trim(), off: f.classList.contains('off') })),
    stars: [...document.querySelectorAll('#tv-stars .tv-face')].map(f => f.lastElementChild.textContent.trim().replace(/\s+/g, ' ')),
    feed: [...document.querySelectorAll('#tv-feed li')].map(li => ({ who: (li.querySelector('.who') || {}).textContent, txt: (li.querySelector('.txt') || {}).textContent, when: (li.querySelector('.when') || {}).textContent, face: !!li.querySelector('.avatar') })),
    remHidden: document.getElementById('tv-rem-card').hidden, remLast: tv.lastElementChild.id === 'tv-rem-card',
    remRows: [...document.querySelectorAll('#remlist .rem-row')].map(li => { const t = li.querySelector('.rem-text'); const cs = getComputedStyle(t); const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4; return { h: li.getBoundingClientRect().height, oneLine: t.scrollHeight <= lh * 1.5 + 1, fs: parseFloat(cs.fontSize), buttons: li.querySelectorAll('button').length }; }),
    remFs: parseFloat(getComputedStyle(document.querySelector('#tv-rem-card h2')).fontSize), paneFs: parseFloat(getComputedStyle(document.querySelector('.tv-feed h2')).fontSize),
    inputsInHome: document.querySelectorAll('#view-home input, #view-home textarea, #view-home [contenteditable]').length,
    inputsRendered: [...document.querySelectorAll('input, textarea, [contenteditable]:not([contenteditable="false"])')].filter(e => e.getClientRects().length > 0).length,
    buttons: [...document.querySelectorAll('#tv button, #tv a, #tv [role=button]')].map(b => b.id || b.outerHTML.slice(0, 60)),
    nodes: document.querySelectorAll('*').length, stats: { ...window.__tvStats },
  };
});
async function themeShot(page, theme, name) {
  await page.evaluate(t => hub.setTheme(t), theme);
  await page.evaluate(() => window.__tv.paint());
  await waitFor(() => page.evaluate(() => { const t = document.getElementById('hub-toast'); return !t || t.hidden; }), { label: 'toast gone' }).catch(() => {});
  await sleep(600); await page.screenshot({ path: path.join(SHOTS, name) });
}

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    console.log('\n## seed'); await seed(); ok(true, 'seeded the week, a family prayer prayed by Eli + Mae, stars, a reminder and feed lines');
    // two album photos, added by Eli from a browser (the device makes the JPEGs)
    const E = await newContext(browser, 'E', { width: 900, height: 900 });
    for (const hue of [30, 200]) PICS.push(await makePics(E.page, hue));
    await E.ctx.close();
    const photos = await ensurePhotos();
    ok(photos.length === 2 && photos.every(p => p && p.lg), 'two album photos in the family album', JSON.stringify(photos.map(p => p && p.lg)));
    const albumAll = (await api('/api/data/hub?scope=family&prefix=album:', { profile: 'eli' })).items.filter(i => i.value).length;

    console.log('\n## the board (Downstairs TV, 1024×1366)');
    const T = await newContext(browser, 'T', { width: 1024, height: 1366 });
    await signIn(T.page, 'tv');
    await T.page.waitForSelector('#tv');
    ok(await T.page.evaluate(() => hub.profile.kind === 'kiosk' && !hub.canWrite && document.documentElement.dataset.kind === 'kiosk'), 'signed in as the display: kiosk, cannot write');
    await waitFor(() => T.page.evaluate(() => document.querySelectorAll('#tv-prayed .tv-face').length >= 2 && document.querySelectorAll('#tv-feed li .avatar').length >= 5 && !!document.querySelector('.tv-bg-img.on') && document.querySelector('.tv-bg-img.on').complete), { label: 'board painted from the first pulls' });
    await T.page.evaluate(() => window.__tv.paint());
    let s = await boardState(T.page);
    // (a) backdrop
    ok(s.imgs === 2, '(a) the backdrop is two <img> elements');
    ok(/\/api\/media\/album\/.*-1024\.jpg$/.test(s.onSrc || '') && s.loaded, '(a) the showing image is a full-size album photo, loaded', s.onSrc);
    ok(s.blur === 'blur(24px)', '(a) blurred 24px', s.blur);
    ok(s.fixed === 'fixed' && Math.round(s.bgRect.width) === 1024 && Math.round(s.bgRect.height) === 1366, '(a) full-bleed behind the board', JSON.stringify(s.bgRect));
    ok(s.scrim && s.scrim !== 'rgba(0, 0, 0, 0)' && s.token.length > 0, '(a) a scrim from the theme token sits over it', s.scrim + ' / ' + s.token);
    const first = s.onSrc;
    const faded = await T.page.evaluate(() => window.__tv.crossfade());
    await sleep(200); const s2 = await boardState(T.page);
    await sleep(3000); const settled = await T.page.evaluate(() => ({ on: document.querySelectorAll('.tv-bg-img.on').length, fading: window.__tv.state().fading }));
    ok(settled.on === 1 && !settled.fading, '(a) after the fade only the new picture stays on and the board is ready for the next one', JSON.stringify(settled));
    ok(faded === true && s2.onSrc !== first && /-1024\.jpg$/.test(s2.onSrc || '') && s2.imgs === 2, '(a) a crossfade moves to the next photo on the other <img> (no new elements)', JSON.stringify([first, s2.onSrc]));
    // (b) type over it
    ok(/^\d{1,2}:\d{2}/.test(s.clock) && /\w+, \w+ \d+/.test(s.date), '(b) clock + date', s.clock + ' · ' + s.date);
    const x = await expected();
    const seededWeek = x.n === 3 && x.kidline.startsWith('God keeps');
    ok(s.verseHd === 'Verse of the week · Week ' + x.n && s.refs.join('|') === x.refs.join('|') && x.refs.length === 2, `(b) verse of the week: the family week row (week ${x.n}${seededWeek ? ', as seeded' : ', written by another suite'}) → its two F260 memory-verse refs`, JSON.stringify([s.verseHd, s.refs, x.refs]));
    ok(s.kidline === x.kidline && (seededWeek ? s.kidline.length > 0 : true), seededWeek ? '(b) the kid line from the week row' : '(b) kid line follows the week row (none there right now)', JSON.stringify([s.kidline, x.kidline]));
    ok(s.prayed.map(p => p.name).sort().join(',') === x.prayed.join(',') && x.prayed.includes('Eli') && x.prayed.includes('Mae') && s.prayed.every(p => p.face && p.face !== '·'), '(b) who prayed today: the family rows\' prayedBy[today] names as faces — Eli + Mae, never David (yesterday)', JSON.stringify([s.prayed, x.prayed]));
    const eli = s.read.find(r => r.name.replace(' ✓', '') === (x.adults.find(a => a.id === 'eli') || {}).name);
    ok(s.read.map(r => r.name.replace(' ✓', '')).join(',') === x.adults.map(a => a.name).join(',') && s.read.every((r, i) => r.off === !x.adults[i].read && /✓/.test(r.name) === x.adults[i].read), '(b) reading today: every adult, ticked when a "Read week…" feed line of theirs is dated today, dimmed otherwise', JSON.stringify([s.read, x.adults]));
    ok(eli && !eli.off && /✓/.test(eli.name), '(b) Eli is ticked from his seeded "Read week 3 day 1" line', JSON.stringify(eli));
    ok(s.read.every(r => !/Ezra|Kiara|Downstairs/.test(r.name)) && s.read.length === x.adults.length, '(b) reading today lists adults only');
    ok(s.stars.join(',') === x.stars.join(','), '(b) kids\' stars from the family stars:<kid> rows (a stale week counts as 0)', JSON.stringify([s.stars, x.stars]));
    ok(s.feed.length === 5 && s.feed.every(l => l.face && l.who && l.txt && /^(just now|\d+[mhd] ago|[A-Z][a-z]{2} \d+)$/.test(l.when)) && s.feed.map(l => l.txt).join('|') === x.feed.map(a => a.text).join('|'), '(b) the latest five feed lines, each with a face, a name and a time', JSON.stringify([s.feed.map(l => l.txt), x.feed.map(a => a.text)]));
    ok(!s.remHidden && s.remLast && s.remRows.length >= 1, '(b) reminders card shows (there is one) and comes last', JSON.stringify({ hidden: s.remHidden, last: s.remLast, rows: s.remRows.length }));
    ok(s.remRows.every(r => r.oneLine && r.h < 60 && r.buttons === 0) && s.remFs < s.paneFs, '(b) reminders are small, one line each, nothing to tap', JSON.stringify({ rows: s.remRows, remFs: s.remFs, paneFs: s.paneFs }));
    // (c) nothing to touch
    ok(s.inputsInHome === 0 && s.inputsRendered === 0, '(c) no input, textarea or contenteditable is rendered', JSON.stringify([s.inputsInHome, s.inputsRendered]));
    ok(s.buttons.length === 1 && s.buttons[0] === 'kiosk-switch', '(c) the Switch button is the only control on the board', JSON.stringify(s.buttons));
    const before = await T.page.evaluate(() => ({ html: document.getElementById('tv').innerHTML.replace(/<div class="clock" id="clock">[^<]*/, ''), pending: hub.sync.pending, gate: document.getElementById('gate').hidden }));
    const clicked = await T.page.evaluate(() => {
      const els = [...document.querySelectorAll('#tv *')].filter(e => e.id !== 'kiosk-switch' && !e.closest('#kiosk-switch') && e.getClientRects().length);
      for (const e of els) e.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return els.length;
    });
    await sleep(500);
    const after = await T.page.evaluate(() => ({ html: document.getElementById('tv').innerHTML.replace(/<div class="clock" id="clock">[^<]*/, ''), pending: hub.sync.pending, gate: document.getElementById('gate').hidden, toast: (t => !!t && !t.hidden)(document.getElementById('hub-toast')) }));
    ok(clicked > 30 && before.html === after.html && after.pending === 0 && after.gate === true && !after.toast, `(c) clicking every one of ${clicked} board elements changes nothing (no writes, no toast, no picker)`);
    const thrown = await T.page.evaluate(() => { try { hub.set('x', 1, { app: 'reminders', scope: 'family' }); return null; } catch (e) { return e.error || e.message; } });
    ok(thrown === 'read_only' && await T.page.evaluate(() => hub.sync.pending === 0), '(c) hub.set still throws read_only on the display', String(thrown));
    // (d) layout
    ok(await noHScroll(T.page), '(d) no horizontal scroll at 1024×1366');
    ok(await T.page.evaluate(() => document.getElementById('views').scrollHeight <= window.innerHeight + 1), '(d) the board fits 1024×1366 without scrolling');
    await themeShot(T.page, 'hearth', 'rm21-tv-1024-hearth.png');
    await themeShot(T.page, 'midnight', 'rm21-tv-1024-midnight.png');
    ok(await T.page.evaluate(() => document.documentElement.dataset.theme === 'midnight' && document.documentElement.dataset.scheme === 'dark'), '(d) Midnight applies on the display (device-local theme)');
    const sm = await boardState(T.page);
    ok(sm.scrim !== s.scrim && sm.token !== s.token, '(d) the scrim follows the theme token (Hearth ≠ Midnight)', sm.scrim + ' vs ' + s.scrim);
    await themeShot(T.page, 'hearth', 'rm21-tv-1024-hearth.png');

    console.log('\n## 24 h unattended (fake time, /api blocked)');
    await T.page.route(/\/api\/(data|activity|profiles)/, r => r.abort());
    // warm-up: one tick 2.5 h on (a feed refresh that fails, a paint, a fade) so anything lazily created exists before the baseline
    await T.page.evaluate(async () => { const t0 = Date.now() + 9e6; window.__tv.tick(new Date(t0)); await new Promise(r => setTimeout(r, 300)); });
    await sleep(3200);
    const base = await boardState(T.page);
    const run = await T.page.evaluate(async () => {
      const t0 = Date.now() + 9e6 + 60e3; const srcs = new Set(); let fades = 0;
      for (let i = 0; i < 200; i++) { if (await window.__tv.crossfade(new Date(t0 + i * 45e3))) fades++; srcs.add(window.__tv.state().url[window.__tv.state().front]); }
      const t1 = t0 + 200 * 45e3;
      for (let i = 0; i < 200; i++) window.__tv.tick(new Date(t1 + i * 1000));
      await new Promise(r => setTimeout(r, 3200));           // let the last fade's 2.7 s hand-off timers run out
      return { fades, srcs: [...srcs], imgs: document.querySelectorAll('.tv-bg-img').length, on: document.querySelectorAll('.tv-bg-img.on').length, clock: document.getElementById('clock').textContent };
    });
    const afterRun = await boardState(T.page);
    ok(run.fades >= 199 && run.srcs.length === albumAll && run.imgs === 2 && run.on === 1, `(AC) 200 crossfade cycles round-robin the album on the same two <img>s (${run.fades} fades over ${run.srcs.length} photos, one showing)`, JSON.stringify(run));
    ok(afterRun.nodes === base.nodes, `(AC) document node count unchanged after 200 fades + 200 ticks (${base.nodes})`, JSON.stringify([base.nodes, afterRun.nodes]));
    ok(JSON.stringify(afterRun.stats) === JSON.stringify(base.stats) && base.stats.intervals === 1 && base.stats.listeners === 1 && base.stats.nodes > 50, '(AC) __tvStats unchanged: one interval, one listener, same node count', JSON.stringify([base.stats, afterRun.stats]));
    ok(/^\d{1,2}:\d{2}/.test(run.clock), '(AC) the clock kept ticking on fake time', run.clock);
    const timers = await T.page.evaluate(() => { const a = setTimeout(() => {}, 0); const b = setTimeout(() => {}, 0); clearTimeout(a); clearTimeout(b); return b - a; });
    ok(timers === 1, '(AC) no timer storm: consecutive timeout ids are adjacent after the run', String(timers));
    await T.page.unroute(/\/api\/(data|activity|profiles)/);

    console.log('\n## 1920×1080 + the empty album + Switch');
    await ensurePhotos();                                   // another suite may have reset the D1 since the 1024 pass
    const W = await newContext(browser, 'W', { width: 1920, height: 1080 });
    await signIn(W.page, 'tv'); await W.page.waitForSelector('#tv');
    await waitFor(() => W.page.evaluate(() => !!document.querySelector('.tv-bg-img.on') && document.querySelector('.tv-bg-img.on').complete && document.querySelectorAll('#tv-read .tv-face').length > 0), { label: '1920 board' });
    await W.page.evaluate(() => window.__tv.paint());
    const frontIsPhoto = () => W.page.evaluate(() => { const st = window.__tv.state(); return /-1024\.jpg$/.test(st.url[st.front]); });
    await waitFor(frontIsPhoto, { label: 'photo backdrop on the 1920 board' }).catch(() => {});
    ok(await frontIsPhoto(), '(a) a fresh device swaps the stand-in art for an album photo as soon as the album has synced');
    ok(await noHScroll(W.page), '(d) no horizontal scroll at 1920×1080');
    const cols = await W.page.evaluate(() => getComputedStyle(document.getElementById('tv')).gridTemplateColumns.split(' ').length);
    ok(cols === 3, '(d) three columns on a TV', String(cols));
    const fits = await W.page.evaluate(() => document.getElementById('tv').getBoundingClientRect().bottom <= window.innerHeight + 1 || document.getElementById('views').scrollHeight <= window.innerHeight + 1);
    ok(fits, '(d) the board fits a 1080p screen without scrolling');
    await W.page.setViewportSize({ width: 1366, height: 1024 }); await sleep(300);
    const ipad = await W.page.evaluate(() => ({ sh: document.getElementById('views').scrollHeight, ih: window.innerHeight, sw: document.getElementById('views').scrollWidth, panes: [...document.querySelectorAll('.tv-pane')].map(p => [p.className.split(' ').pop(), Math.round(p.getBoundingClientRect().height), p.hidden]) }));
    await W.page.screenshot({ path: path.join(SHOTS, 'rm21-tv-1366-hearth.png') });
    ok(await noHScroll(W.page) && ipad.sh <= ipad.ih + 1, '(d) iPad landscape (1366×1024): no horizontal scroll, board fits', JSON.stringify(ipad));
    await W.page.setViewportSize({ width: 1920, height: 1080 }); await sleep(300);
    await themeShot(W.page, 'hearth', 'rm21-tv-1920-hearth.png');
    await themeShot(W.page, 'midnight', 'rm21-tv-1920-midnight.png');
    await themeShot(W.page, 'hearth', 'rm21-tv-1920-hearth.png');
    // the album empties → the ambient art for this hour takes over at the next fade, and the two <img>s are still all there is
    for (const p of await myPhotos()) await api('/api/album/' + encodeURIComponent(p.id), { method: 'DELETE', profile: 'eli' }).catch(() => {});
    const others = (await api('/api/data/hub?scope=family&prefix=album:', { profile: 'eli' })).items.filter(i => i.value).length;
    await W.page.evaluate(() => hub.pull());
    await waitFor(() => W.page.evaluate(() => hub.list('album:', { app: 'hub', scope: 'family' }).length === 0), { label: 'album empty on the TV' }).catch(() => {});
    const amb = await W.page.evaluate(async () => { const ok = await window.__tv.crossfade(); const st = window.__tv.state(); return { ok, src: st.url[st.front], imgs: document.querySelectorAll('.tv-bg-img').length }; });
    const hour = new Date().getHours(), want = hour < 5 || hour >= 20 ? 'night' : hour < 9 ? 'dawn' : hour < 17 ? 'day' : 'dusk';
    if (others === 0) ok(amb.src === 'art/ambient/' + want + '.svg' && amb.imgs === 2, `(a) empty album → art/ambient/${want}.svg by the hour, same two <img>s`, JSON.stringify(amb));
    else ok(true, `(a) empty-album check skipped: ${others} album photo(s) from another suite are still in the shared local DB`);
    // reminders vanish → the card hides at the next paint
    await api('/api/data/reminders/' + encodeURIComponent(SEED.remKey) + '?scope=family', { method: 'DELETE', profile: 'eli' });
    await W.page.evaluate(() => hub.pull());
    await waitFor(() => W.page.evaluate(() => !hub.list('item:', { app: 'reminders', scope: 'family' }).some(r => r.key === 'item:tv21')), { label: 'reminder gone on the TV' });
    await W.page.evaluate(() => window.__tv.paint());
    const remState = await W.page.evaluate(() => ({ hidden: document.getElementById('tv-rem-card').hidden, left: hub.list('item:', { app: 'reminders', scope: 'family' }).length }));
    ok(remState.hidden === (remState.left === 0), remState.left === 0 ? '(b) no reminders → the reminders card hides' : `(b) ${remState.left} reminder(s) from other suites remain, so the card stays`, JSON.stringify(remState));
    // Switch is the one thing that does something
    await W.page.click('#kiosk-switch');
    await W.page.waitForSelector('#gate:not([hidden]) .pcard[data-id]', { timeout: 10000 });
    ok(true, '(c) Switch opens the profile picker');

    console.log('\n## console');
    ok(errors.length === 0, 'no console errors', JSON.stringify(errors));
    await T.ctx.close(); await W.ctx.close();
  } catch (e) { fail++; console.log('  ✗ crashed:', e.stack || e); }
  finally { await cleanup(); await browser.close(); server.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
