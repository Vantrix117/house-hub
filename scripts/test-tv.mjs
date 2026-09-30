#!/usr/bin/env node
// Roadmap 21 checks: the TV glue board (kiosk Home).
//   (a) backdrop = the family album, full-bleed, blurred 24px under the theme's --scrim; two <img>s that swap src and
//       crossfade; the ambient art (art/ambient/<dawn|day|dusk|night>.svg) stands in when the album is empty
//   (b) over it: clock + date, the adult verse of the week (family kidverse 'week' row → the two F260 memory-verse refs,
//       plus the row's own kid line, else Kid Verse's paraphrase for the week, labelled), who prayed today (family prayer
//       rows' prayedBy[today] → faces), reading today (the household adults, no guests; ✓ from GET /api/f260/readers, the
//       F260 logs, or today's "Read week…" feed lines when the Worker has no such route), the latest five feed lines with
//       faces, the kids' stars (family stars:<kid> rows), and reminders last, newest first, smaller, one line each — only
//       when there is at least one
//   (c) nothing to touch: no input/textarea/contenteditable renders; clicking anything but #kiosk-switch changes nothing;
//       a hash change to #me / #chat / #apps / an app stays on the board and Me holds no controls; Switch stops the board
//       and opens the picker; the kiosk still cannot write; the board asks for the screen wake lock by itself
//   (d) no horizontal scroll at 1024×1366 and 1920×1080; the board fits 1024×1366, 1366×1024, 1024×768 and a portrait
//       iPad (the feed full width there)
//   (f) IMP-PRAYER-I2 (batch 3): "A year ago today · Answered: <title>" for a family request answered on this day in an
//       earlier year (New York dates) — in the verse pane or first in the feed, whichever fits, always whole; never a
//       person-scope (private) title, never one answered today or on another day; nothing when there is none; every fit
//       gate below still holds with it on the board at all five sizes
//   (e) the 1920×1080 fit gate (decision D16, the 10-foot scale): data-tv-scale="10ft", every pane inside the title-safe
//       screen, no scroll, every reminder shown or counted in "+N more" (with 14 of them), faces in one row with a "+N",
//       no information text under 28 px, the feed and reminders at least body size (32 px); offline reopen keeps the ✓
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
const dayKey = d => { const p = {}; for (const x of new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)) p[x.type] = x.value; return p.year + '-' + p.month + '-' + p.day; };   // the household's date (hub.today), whatever zone this machine is in
const isoWeek = d => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); return y + '-W' + pad(Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7)); };
const TODAY = dayKey(new Date()), YESTERDAY = dayKey(new Date(Date.now() - 86400000)), WEEK = isoWeek(new Date()), LAST_WEEK = isoWeek(new Date(Date.now() - 7 * 86400000));
const SEED = { prayerKey: 'prayer:tv21', remKey: 'item:tv21' };
// IMP-PRAYER-I2: the same month and day in an earlier year (a 29 February four years back)
const YEAR_AGO = (+TODAY.slice(0, 4) - (TODAY.slice(5) === '02-29' ? 4 : 1)) + TODAY.slice(4);
const OTHER_DAY = (+TODAY.slice(0, 4) - 1) + '-' + (TODAY.slice(5, 7) === '01' ? '02' : '01') + '-15';
const ANNIV_KEYS = ['prayer:tv21-anniv', 'prayer:tv21-today', 'prayer:tv21-other', 'prayer:tv21-long'];
const ANNIV_TITLE = 'Grandpa came home from the hospital';
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
  // (b) Eli read today: his F260 log row for today (→ "Reading today" ✓ through GET /api/f260/readers) and its feed line
  //     (the fallback for a Worker without that route), then enough lines that the TV's five are all fresh
  await api('/api/data/f260/batch?scope=person', { method: 'POST', profile: 'eli', body: { items: rows([['log:' + TODAY, true]]) } });
  await api('/api/activity', { method: 'POST', profile: 'eli', body: { app_id: 'f260', text: 'Read week 3 day 1 — Genesis 18-19' } });
  for (let i = 0; i < 5; i++) await api('/api/activity', { method: 'POST', profile: 'eli', body: { app_id: ['leftovers', 'prayer', 'reminders', 'timer', 'hub'][i], text: `TV seed line ${i + 1}` } });
}
async function cleanup() {
  if (!ELI) return;
  try { await api('/api/data/prayer/' + encodeURIComponent(SEED.prayerKey) + '?scope=family', { method: 'DELETE', profile: 'eli' }); } catch {}
  try { await api('/api/data/reminders/' + encodeURIComponent(SEED.remKey) + '?scope=family', { method: 'DELETE', profile: 'eli' }); } catch {}
  try { for (let i = 0; i < 14; i++) await api('/api/data/reminders/' + encodeURIComponent('item:tv21-' + i) + '?scope=family', { method: 'DELETE', profile: 'eli' }); } catch {}
  try { await api('/api/data/prayer/' + encodeURIComponent('prayer:tv21-all') + '?scope=family', { method: 'DELETE', profile: 'eli' }); } catch {}
  try { for (const k of ANNIV_KEYS) await api('/api/data/prayer/' + encodeURIComponent(k) + '?scope=family', { method: 'DELETE', profile: 'eli' }); } catch {}
  try { await api('/api/data/prayer/' + encodeURIComponent('prayer:tv21-private') + '?scope=person', { method: 'DELETE', profile: 'eli' }); } catch {}
  try { for (const p of await myPhotos()) await api('/api/album/' + encodeURIComponent(p.id), { method: 'DELETE', profile: 'eli' }).catch(() => {}); } catch {}
}

// What the board should show right now, from the API (other suites share this D1 and write the same family rows).
// Kid Verse's week table ([which ref, words]) from apps/kidverse.html, and the TV's copy of it in index.html
const KIDWORDS = (() => { const f = fs.readFileSync(path.join(ROOT, 'apps', 'kidverse.html'), 'utf8'); const s = f.indexOf('{ w: 1,  refs:'); return [...f.slice(s, f.indexOf('];', s)).matchAll(/\{ w: (\d+),\s+refs: \[[^\]]*\], p: (\d), words: '((?:[^'\\]|\\.)*)' \}/g)].map(m => [+m[2], m[3].replace(/\\'/g, "'")]); })();
const TV_KIDWORDS = (() => { const f = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'); const s = f.indexOf('tv.KIDWORDS = ['); return JSON.parse(f.slice(s + 'tv.KIDWORDS = '.length, f.indexOf(']);', s) + 1).replace(/,\s*\]$/, ']')); })();
const MEMORY = (() => { const f = fs.readFileSync(path.join(ROOT, 'apps', 'f260.html'), 'utf8'); const b = f.slice(f.indexOf('const PLAN = ['), f.indexOf('];', f.indexOf('const PLAN = ['))); return [...b.matchAll(/\{\s*w:\s*(\d+),[^}]*m:\s*\[([^\]]*)\]/g)].map(m => m[2].match(/"([^"]*)"/g).map(s => JSON.parse(s))); })();
async function expected() {
  const profiles = (await api('/api/profiles', { profile: 'eli' })).profiles;
  const kv = Object.fromEntries((await api('/api/data/kidverse?scope=family', { profile: 'eli' })).items.filter(i => i.value != null).map(i => [i.key, i.value]));
  const wk = kv.week; const n = Math.min(52, Math.max(1, Math.floor(Number(wk && typeof wk === 'object' ? (wk.week || wk.w || wk.n) : wk) || 1)));
  const own = wk && typeof wk === 'object' && typeof wk.line === 'string' ? wk.line.trim() : '';
  const kidline = own || (KIDWORDS[n - 1] || [0, ''])[1];
  const starsOf = v => v && typeof v === 'object' && v.week === WEEK ? Math.max(0, Math.floor(Number(v.count) || 0)) : 0;
  const stars = profiles.filter(p => p.kind === 'kid').map(p => p.name + ' ★' + starsOf(kv['stars:' + p.id]));
  const prayed = new Set();
  for (const r of (await api('/api/data/prayer?scope=family&prefix=prayer:', { profile: 'eli' })).items) { const l = r.value && r.value.prayedBy && r.value.prayedBy[TODAY]; if (Array.isArray(l)) for (const x of l) prayed.add(String(x)); }
  const feed = (await api('/api/activity?limit=100', { profile: 'eli' })).activity;
  const r = await api('/api/f260/readers', { profile: 'eli' });
  const readers = new Set(r.readers), feedReaders = new Set(feed.filter(a => /^Read week/.test(a.text || '') && dayKey(new Date(a.created_at)) === TODAY).map(a => a.profile_id));
  const adults = profiles.filter(p => p.kind === 'adult' && !p.is_guest).map(p => ({ id: p.id, name: p.name, read: readers.has(p.id), fromFeed: feedReaders.has(p.id) }));
  return { n, refs: MEMORY[n - 1] || [], kidline, own, stars, prayed: [...prayed].sort(), adults, feed: feed.slice(0, 5), readersDate: r.date };
}

// ── browser ──────────────────────────────────────────────────────
const errors = [];
async function newContext(browser, name, viewport, wakeStub) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: true, colorScheme: 'light' });
  // the leak probe: live intervals and window resize listeners, counted from the page's own calls
  await ctx.addInitScript(() => { const live = window.__live = new Set(), si = window.setInterval, ci = window.clearInterval; window.setInterval = function (...a) { const id = si.apply(this, a); live.add(id); return id; }; window.clearInterval = function (id) { live.delete(id); return ci.call(this, id); };
    const ael = window.addEventListener, rel = window.removeEventListener; window.__resizeL = 0; window.addEventListener = function (tp, ...a) { if (tp === 'resize') window.__resizeL++; return ael.call(this, tp, ...a); }; window.removeEventListener = function (tp, ...a) { if (tp === 'resize') window.__resizeL--; return rel.call(this, tp, ...a); }; });
  await ctx.addInitScript(api => { try { localStorage.setItem('hub.api', JSON.stringify(api)); } catch {} }, SITE);
  await ctx.addInitScript(annivFn);
  // a stand-in wake lock that grants and records each request (a headless browser has no screen to keep on)
  if (wakeStub) await ctx.addInitScript(() => { const rec = window.__wl = []; class S extends EventTarget { constructor() { super(); this.released = false; this.type = 'screen'; } async release() { this.released = true; rec.push('released'); this.dispatchEvent(new Event('release')); } }
    Object.defineProperty(Navigator.prototype, 'wakeLock', { configurable: true, get() { return { request: async () => { rec.push('granted'); return new S(); } }; } }); });
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
// IMP-PRAYER-I2: where the anniversary line shows (verse pane, feed or nowhere), its text, and whether it is whole: inside its
// pane (and, in the feed, above the list's clip), nothing scrolled away inside it; at most one copy on screen
const annivFn = `window.annivState = () => {
  const vis = e => !!e && e.getClientRects().length > 0 && !e.hidden;
  const v = document.getElementById('tv-anniv'), li = document.querySelector('#tv-feed > li.tv-anniv');
  const where = vis(v) ? 'verse' : vis(li) ? 'feed' : 'none', el = where === 'verse' ? v : where === 'feed' ? li : null;
  if (!el) return { where, copies: 0 };
  const r = el.getBoundingClientRect(), p = el.closest('.tv-pane').getBoundingClientRect(), clip = where === 'feed' ? document.getElementById('tv-feed').getBoundingClientRect() : p;
  const txt = where === 'feed' ? el.querySelector('.tv-anniv-txt') : el;
  return { where, copies: [v, li].filter(vis).length, text: txt.textContent.replace(/\\s+/g, ' ').trim(), fs: parseFloat(getComputedStyle(txt).fontSize),
    whole: r.top >= p.top - 0.5 && r.bottom <= Math.min(p.bottom, clip.bottom) + 0.5 && r.left >= p.left - 0.5 && r.right <= p.right + 0.5 && (getComputedStyle(txt).overflow === 'visible' || (txt.scrollHeight <= txt.clientHeight + 1 && txt.scrollWidth <= txt.clientWidth + 1)) && getComputedStyle(txt).textOverflow !== 'ellipsis' };
};`;
const boardState = page => page.evaluate(() => {
  const tv = document.getElementById('tv'), bg = tv.querySelector('.tv-bg'), on = [...tv.querySelectorAll('.tv-bg-img.on')].sort((a, b) => (+b.style.zIndex || 0) - (+a.style.zIndex || 0))[0];
  return {
    imgs: tv.querySelectorAll('.tv-bg-img').length, onSrc: on ? on.getAttribute('src') : null, loaded: !!on && on.complete && on.naturalWidth > 0,
    blur: on ? getComputedStyle(on).filter : null, fixed: getComputedStyle(bg).position, bgRect: bg.getBoundingClientRect().toJSON(),
    scrim: getComputedStyle(tv.querySelector('.tv-scrim')).backgroundColor, token: getComputedStyle(document.documentElement).getPropertyValue('--scrim').trim(),
    clock: document.getElementById('clock').textContent.trim(), date: document.getElementById('tv-date').textContent.trim(),
    verseHd: document.getElementById('tv-verse-hd').textContent.trim(), refs: [...document.querySelectorAll('#tv-refs span')].map(s => s.textContent.trim()), kidline: document.getElementById('tv-kidline').textContent.trim(), kidlabel: document.getElementById('tv-kidlabel').textContent.trim(),
    prayed: [...document.querySelectorAll('#tv-prayed .tv-face:not(.tv-more)')].map(f => ({ name: f.lastElementChild.textContent.trim(), face: (f.querySelector('.avatar') || {}).textContent })),
    read: [...document.querySelectorAll('#tv-read .tv-face:not(.tv-more)')].map(f => ({ name: f.lastElementChild.textContent.trim(), off: f.classList.contains('off') })),
    stars: [...document.querySelectorAll('#tv-stars .tv-face:not(.tv-more)')].map(f => f.lastElementChild.textContent.trim().replace(/\s+/g, ' ')),
    feed: [...document.querySelectorAll('#tv-feed li:not(.tv-anniv)')].map(li => ({ who: (li.querySelector('.who') || {}).textContent, txt: (li.querySelector('.txt') || {}).textContent, when: (li.querySelector('.when') || {}).textContent, face: !!li.querySelector('.avatar') })),
    remHidden: document.getElementById('tv-rem-card').hidden, remLast: tv.lastElementChild.id === 'tv-rem-card',
    remRows: [...document.querySelectorAll('#remlist .rem-row')].map(li => { const t = li.querySelector('.rem-text'); const cs = getComputedStyle(li); const lh = parseFloat(cs.lineHeight) || parseFloat(getComputedStyle(t).fontSize) * 1.25; const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom); return { h: li.getBoundingClientRect().height, lines: Math.round((li.clientHeight - pad) / lh), whole: li.scrollHeight <= li.clientHeight + 1, fs: parseFloat(getComputedStyle(t).fontSize), buttons: li.querySelectorAll('button').length }; }),
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
    ok(s.kidline === x.kidline && s.kidline.length > 0 && /paraphrase/.test(s.kidlabel), seededWeek ? '(b) the kid line from the week row, labelled a paraphrase' : '(b) the kid line: Kid Verse\'s paraphrase for the week (no line on the row), labelled', JSON.stringify([s.kidline, x.kidline, s.kidlabel]));
    ok(KIDWORDS.length === 52 && JSON.stringify(TV_KIDWORDS) === JSON.stringify(KIDWORDS), '(b) the TV\'s kid-line table is an exact copy of Kid Verse\'s 52 weeks', JSON.stringify([KIDWORDS.length, TV_KIDWORDS.length]));
    ok(s.prayed.map(p => p.name).sort().join(',') === x.prayed.join(',') && x.prayed.includes('Eli') && x.prayed.includes('Mae') && s.prayed.every(p => p.face && p.face !== '·'), '(b) who prayed today: the family rows\' prayedBy[today] names as faces — Eli + Mae, never David (yesterday)', JSON.stringify([s.prayed, x.prayed]));
    const eli = s.read.find(r => r.name.replace(' ✓', '') === (x.adults.find(a => a.id === 'eli') || {}).name);
    ok(s.read.map(r => r.name.replace(' ✓', '')).join(',') === x.adults.map(a => a.name).join(',') && s.read.every((r, i) => r.off === !x.adults[i].read && /✓/.test(r.name) === x.adults[i].read), '(b) reading today: every household adult, ticked when their F260 log has today (GET /api/f260/readers), dimmed otherwise', JSON.stringify([s.read, x.adults]));
    ok(eli && !eli.off && /✓/.test(eli.name), '(b) Eli is ticked from his F260 log row for today', JSON.stringify(eli));
    ok(s.read.every(r => !/Ezra|Kiara|Downstairs/.test(r.name)) && s.read.length === x.adults.length, '(b) reading today lists household adults only (no kids, no display, no guests)');
    const rs = await T.page.evaluate(() => { const st = window.__tv.state(); return { api: st.readersApi, src: st.readers && st.readers.src, date: st.readers && st.readers.date, cached: JSON.parse(localStorage.getItem('hub.tv.readers') || 'null') }; });
    ok(rs.api === true && rs.src === 'f260' && rs.date === x.readersDate && rs.cached && rs.cached.ids.includes('eli'), '(b) the readers come from the Worker and are kept on the device for an offline reopen (P2-SYNC-12)', JSON.stringify(rs));
    ok(s.stars.join(',') === x.stars.join(','), '(b) kids\' stars from the family stars:<kid> rows (a stale week counts as 0)', JSON.stringify([s.stars, x.stars]));
    ok(s.feed.length === 5 && s.feed.every(l => l.face && l.who && l.txt && /^(just now|\d+[mhd] ago|[A-Z][a-z]{2} \d+)$/.test(l.when)) && s.feed.map(l => l.txt).join('|') === x.feed.map(a => a.text).join('|'), '(b) the latest five feed lines, each with a face, a name and a time', JSON.stringify([s.feed.map(l => l.txt), x.feed.map(a => a.text)]));
    const an0 = await T.page.evaluate(() => window.annivState());
    const famAnniv = (await api('/api/data/prayer?scope=family&prefix=prayer:', { profile: 'eli' })).items.some(r => r.value && r.value.status === 'answered' && typeof r.value.answeredAt === 'string' && r.value.answeredAt.slice(5) === TODAY.slice(5) && r.value.answeredAt < TODAY.slice(0, 4));
    if (!famAnniv) ok(an0.where === 'none' && await T.page.evaluate(() => !document.querySelector('#tv-feed > li.tv-anniv') && document.getElementById('tv-anniv').hidden), '(f) no family request answered on this day in an earlier year → no anniversary line', JSON.stringify(an0));
    else ok(true, '(f) (the no-anniversary check skipped: the shared local DB already holds one)');
    ok(!s.remHidden && s.remLast && s.remRows.length >= 1, '(b) reminders card shows (there is one) and comes last', JSON.stringify({ hidden: s.remHidden, last: s.remLast, rows: s.remRows.length }));
    const order = await T.page.evaluate(() => { const at = new Map(hub.list('item:', { app: 'reminders', scope: 'family' }).map(r => [r.value.text, r.value.createdAt || 0])); return [...document.querySelectorAll('#remlist .rem-row .rem-text')].map(e => at.get(e.textContent)); });
    ok(order.every((v, i) => i === 0 || order[i - 1] >= v), '(b) reminders run newest first (P2-VIS-02)', JSON.stringify(order));
    ok(s.remRows.every(r => r.h === 0 || (r.lines <= 2 && r.whole)) && s.remRows.every(r => r.buttons === 0) && s.remFs < s.paneFs, '(b) reminders are smaller than the pane titles, whole on at most two lines each, nothing to tap', JSON.stringify({ rows: s.remRows, remFs: s.remFs, paneFs: s.paneFs }));
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
    for (const h of ['#me', '#chat', '#apps', '#leftovers']) {
      await T.page.evaluate(h => { location.hash = h; }, h); await sleep(400);
      const hs = await T.page.evaluate(() => ({ hash: location.hash, tab: document.documentElement.dataset.tab, home: document.getElementById('view-home').classList.contains('on'), me: document.getElementById('view-me').classList.contains('on'), meControls: document.querySelectorAll('#view-me button, #view-me input, #view-me [data-theme]').length, chatForm: document.getElementById('chat-form').hidden, viewer: !!(document.getElementById('viewer') && document.getElementById('viewer').classList.contains('open')) }));
      ok(hs.hash === '#home' && hs.tab === 'home' && hs.home && !hs.me && hs.meControls === 0 && hs.chatForm && !hs.viewer, `(c) a hash change to ${h} leaves the display on its board, with no Me controls anywhere (P2-PROF-10, P2-CHAT-14)`, JSON.stringify(hs));
    }
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
    const live0 = await T.page.evaluate(() => ({ live: window.__live.size, resize: window.__resizeL }));
    for (const [w, h] of [[1920, 1080], [820, 1180], [1180, 820], [1024, 1366]]) { await T.page.setViewportSize({ width: w, height: h }); await sleep(250); }
    const run = await T.page.evaluate(async () => {
      const t0 = Date.now() + 9e6 + 60e3; const srcs = new Set(); let fades = 0;
      for (let i = 0; i < 200; i++) { if (await window.__tv.crossfade(new Date(t0 + i * 45e3))) fades++; srcs.add(window.__tv.state().url[window.__tv.state().front]); }
      const t1 = t0 + 200 * 45e3;
      for (let i = 0; i < 200; i++) window.__tv.tick(new Date(t1 + i * 1000));
      await new Promise(r => setTimeout(r, 3200));           // let the last fade's 2.7 s hand-off timers run out
      return { fades, srcs: [...srcs], imgs: document.querySelectorAll('.tv-bg-img').length, on: document.querySelectorAll('.tv-bg-img.on').length, clock: document.getElementById('clock').textContent };
    });
    const afterRun = await boardState(T.page);
    const live1 = await T.page.evaluate(() => ({ live: window.__live.size, resize: window.__resizeL }));
    ok(live1.live === live0.live && live1.resize === live0.resize, `(AC) counted from the page's own calls: ${live0.live} live intervals and ${live0.resize} window resize listeners, the same after 4 resizes, 200 fades and 200 ticks`, JSON.stringify([live0, live1]));
    ok(run.fades >= 199 && run.srcs.length === albumAll && run.imgs === 2 && run.on === 1, `(AC) 200 crossfade cycles round-robin the album on the same two <img>s (${run.fades} fades over ${run.srcs.length} photos, one showing)`, JSON.stringify(run));
    ok(afterRun.nodes === base.nodes, `(AC) document node count unchanged after 200 fades + 200 ticks (${base.nodes})`, JSON.stringify([base.nodes, afterRun.nodes]));
    ok(JSON.stringify(afterRun.stats) === JSON.stringify(base.stats) && base.stats.intervals === 1 && base.stats.listeners === 2 && base.stats.nodes > 50, '(AC) __tvStats unchanged: one interval, two listeners (Switch, resize), same node count', JSON.stringify([base.stats, afterRun.stats]));
    ok(/^\d{1,2}:\d{2}/.test(run.clock), '(AC) the clock kept ticking on fake time', run.clock);
    const timers = await T.page.evaluate(() => { const a = setTimeout(() => {}, 0); const b = setTimeout(() => {}, 0); clearTimeout(a); clearTimeout(b); return b - a; });
    ok(timers === 1, '(AC) no timer storm: consecutive timeout ids are adjacent after the run', String(timers));
    await T.page.unroute(/\/api\/(data|activity|profiles)/);

    console.log('\n## 1920×1080 + the empty album + Switch');
    await ensurePhotos();                                   // another suite may have reset the D1 since the 1024 pass
    const W = await newContext(browser, 'W', { width: 1920, height: 1080 }, true);
    await signIn(W.page, 'tv'); await W.page.waitForSelector('#tv');
    await waitFor(() => W.page.evaluate(() => !!document.querySelector('.tv-bg-img.on') && document.querySelector('.tv-bg-img.on').complete && document.querySelectorAll('#tv-read .tv-face').length > 0), { label: '1920 board' });
    await W.page.evaluate(() => window.__tv.paint());
    const frontIsPhoto = () => W.page.evaluate(() => { const st = window.__tv.state(); return /-1024\.jpg$/.test(st.url[st.front]); });
    await waitFor(frontIsPhoto, { label: 'photo backdrop on the 1920 board' }).catch(() => {});
    ok(await frontIsPhoto(), '(a) a fresh device swaps the stand-in art for an album photo as soon as the album has synced');
    ok(await noHScroll(W.page), '(d) no horizontal scroll at 1920×1080');
    const grid = await W.page.evaluate(() => { const cs = getComputedStyle(document.getElementById('tv')); return { cols: cs.gridTemplateColumns.split(' ').length, rows: cs.gridTemplateRows.split(' ').length }; });
    ok(grid.cols === 12 && grid.rows === 3, '(d) the TV grid: 12 columns, three rows (clock + verse · today · feed + reminders)', JSON.stringify(grid));
    const wl = await W.page.evaluate(() => ({ calls: (window.__wl || []).slice(), hint: !document.getElementById('tv-wake').hidden }));
    ok(wl.calls.length >= 1 && wl.calls[0] === 'granted' && !wl.hint, '(c) the board asked for the screen wake lock by itself, with no tap (P2-STAB-12)', JSON.stringify(wl));
    // (e) the fit gate on a busy day: 14 more reminders, everyone prayed
    const busy = Date.now();   // not in the future: the deletes below must win under last-write-wins
    await api('/api/data/reminders/batch?scope=family', { method: 'POST', profile: 'eli', body: { items: Array.from({ length: 14 }, (_, i) => ({ key: 'item:tv21-' + i, value: { id: 'tv21-' + i, text: `Busy-day reminder ${i + 1}: something the family must not miss this week`, by: 'eli', byName: 'Eli', createdAt: busy + i }, updated_at: busy + i })) } });
    const everyone = (await api('/api/profiles', { profile: 'eli' })).profiles.filter(p => p.kind === 'adult' || p.kind === 'kid').map(p => p.id);
    await api('/api/data/prayer/batch?scope=family', { method: 'POST', profile: 'eli', body: { items: [{ key: 'prayer:tv21-all', value: { id: 'tv21-all', title: 'Family prayer time', category: 'Family', status: 'active', createdAt: TODAY, prayedBy: { [TODAY]: everyone }, by: 'eli' }, updated_at: busy + 20 }] } });
    // (f) the anniversary: one family request answered a year ago today, one answered today, one a year ago on another day,
    //     and Eli's own (person-scope, private) request answered a year ago today — only the first may reach the TV
    const ans = (id, title, answeredAt) => ({ key: 'prayer:' + id, value: { id, title, category: 'Family', status: 'answered', createdAt: '2020-01-01', answeredAt, answerNote: 'Thank you, Lord', prayedBy: {}, by: 'eli' }, updated_at: busy + 30 });
    await api('/api/data/prayer/batch?scope=family', { method: 'POST', profile: 'eli', body: { items: [ans('tv21-anniv', ANNIV_TITLE, YEAR_AGO), ans('tv21-today', 'Answered this very day tv21', TODAY), ans('tv21-other', 'Answered another day tv21', OTHER_DAY)] } });
    await api('/api/data/prayer/batch?scope=person', { method: 'POST', profile: 'eli', body: { items: [ans('tv21-private', 'PRIVATE tv21 request', YEAR_AGO)] } });
    await W.page.evaluate(() => hub.pull());
    await waitFor(() => W.page.evaluate(() => hub.list('item:', { app: 'reminders', scope: 'family' }).length >= 15), { label: 'busy reminders on the TV' });
    await waitFor(() => W.page.evaluate(() => hub.list('prayer:', { app: 'prayer', scope: 'family' }).some(r => r.key === 'prayer:tv21-anniv')), { label: 'the anniversary row on the TV' });
    await W.page.evaluate(() => window.__tv.paint()); await sleep(300);
    const fitState = () => W.page.evaluate(() => {
      const v = document.getElementById('views'), H = innerHeight, vis = e => e.getClientRects().length > 0;
      const panes = [...document.querySelectorAll('#tv .tv-pane')].filter(vis).map(p => { const r = p.getBoundingClientRect(); return { c: p.className.split(' ').pop(), top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }; });
      const rows = [...document.querySelectorAll('#remlist .rem-row')], shown = rows.filter(vis), more = document.getElementById('tv-rem-more');
      const moreN = more && vis(more) ? +(more.textContent.match(/\+(\d+) more/) || [0, 0])[1] : 0;
      const lastRem = shown.length ? shown[shown.length - 1].getBoundingClientRect().bottom : 0, remBox = document.getElementById('remlist').getBoundingClientRect().bottom;
      const faces = id => { const box = document.getElementById(id), all = [...box.querySelectorAll('.tv-face:not(.tv-more)')], m = box.querySelector('.tv-more'); const tops = new Set(all.filter(vis).map(e => Math.round(e.getBoundingClientRect().top))); return { all: all.length, shown: all.filter(vis).length, more: m && vis(m) ? +m.textContent.replace(/\D/g, '') : 0, rows: tops.size, right: Math.max(0, ...[...box.children].filter(vis).map(e => e.getBoundingClientRect().right)), edge: box.getBoundingClientRect().right }; };
      const sizes = []; const w = document.createTreeWalker(document.getElementById('tv'), NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { const el = n.parentElement; if (!n.textContent.trim() || !vis(el) || el.closest('.avatar')) continue; sizes.push({ t: n.textContent.trim().slice(0, 30), fs: parseFloat(getComputedStyle(el).fontSize) }); }
      const fsOf = sel => parseFloat(getComputedStyle(document.querySelector(sel)).fontSize);
      return { scale: document.documentElement.dataset.tvScale, H, W: innerWidth, scroll: v.scrollHeight - v.clientHeight, hscroll: v.scrollWidth - v.clientWidth, panes, rem: { total: rows.length, shown: shown.length, more: moreN, lastRem, remBox }, prayed: faces('tv-prayed'), read: faces('tv-read'), stars: faces('tv-stars'),
        minFs: Math.min(...sizes.map(s => s.fs)), small: sizes.filter(s => s.fs < 28).slice(0, 5), feedFs: fsOf('#tv-feed li .txt'), remFs: fsOf('#remlist .rem-text'), nameFs: fsOf('#tv-read .tv-name'), feedLines: [...document.querySelectorAll('#tv-feed li:not(.tv-anniv)')].filter(vis).length, anniv: annivState() };
    });
    let fs1 = await fitState();
    ok(fs1.scale === '10ft', '(e) the display runs on the 10-foot scale (data-tv-scale="10ft", decision D16)', String(fs1.scale));
    ok(fs1.scroll <= 1 && fs1.hscroll <= 1 && fs1.panes.every(p => p.top >= 54 - 1 && p.bottom <= 1080 - 54 + 1 && p.left >= 96 - 1 && p.right <= 1920 - 96 + 1), '(e) 1920×1080: no scroll, every pane inside the title-safe area (54 / 96 px)', JSON.stringify({ scroll: fs1.scroll, panes: fs1.panes }));
    ok(fs1.rem.total >= 15 && fs1.rem.shown >= 3 && fs1.rem.shown + fs1.rem.more === fs1.rem.total && fs1.rem.lastRem <= fs1.rem.remBox + 1, `(e) ${fs1.rem.total} reminders: ${fs1.rem.shown} shown whole, the other ${fs1.rem.more} counted in the heading ("Reminders · +N more"), none cut off (P2-VIS-02)`, JSON.stringify(fs1.rem));
    ok(['prayed', 'read', 'stars'].every(k => fs1[k].rows <= 1 && fs1[k].shown + fs1[k].more === fs1[k].all && fs1[k].right <= fs1[k].edge + 1) && fs1.prayed.all >= 7, `(e) faces stay in one row, the rest counted: prayed ${fs1.prayed.shown}+${fs1.prayed.more} of ${fs1.prayed.all}, read ${fs1.read.shown} of ${fs1.read.all}, stars ${fs1.stars.shown} of ${fs1.stars.all}`, JSON.stringify([fs1.prayed, fs1.read, fs1.stars]));
    ok(fs1.read.more === 0 && fs1.stars.more === 0, '(e) every household reader and every kid has a face at 1920×1080', JSON.stringify([fs1.read, fs1.stars]));
    const oneFace = st => ['prayed', 'read', 'stars'].every(k => !st[k].all || st[k].shown >= 1);
    ok(oneFace(fs1), '(e) every faces pane shows at least one face at 1920×1080', JSON.stringify([fs1.prayed.shown, fs1.read.shown, fs1.stars.shown]));
    const whole = await W.page.evaluate(() => [...document.querySelectorAll('#remlist .rem-row')].filter(li => li.getClientRects().length).map(li => li.scrollHeight <= li.clientHeight + 1));
    ok(whole.length >= 3 && whole.every(Boolean), `(e) every reminder shown is whole, on at most two lines (${whole.length} shown)`, JSON.stringify(whole));
    ok(fs1.minFs >= 28 && fs1.feedFs >= 32 && fs1.remFs >= 32 && fs1.nameFs >= 28 && fs1.feedLines === 5, `(e) 10-foot type: nothing under 28 px (smallest ${fs1.minFs}), feed ${fs1.feedFs} and reminders ${fs1.remFs} px, names ${fs1.nameFs} px, all five feed lines (VIS-TYPE-1, UX-HOME-2)`, JSON.stringify({ small: fs1.small, feedLines: fs1.feedLines }));
    const annText = 'A year ago today · Answered: ' + ANNIV_TITLE;
    ok(fs1.anniv.where !== 'none' && fs1.anniv.copies === 1 && fs1.anniv.text === annText && fs1.anniv.whole && fs1.anniv.fs >= 28, `(f) 1920×1080: "${annText}" shows once, whole, in the ${fs1.anniv.where === 'verse' ? 'verse pane' : 'feed'} (${fs1.anniv.fs} px)`, JSON.stringify(fs1.anniv));
    const tvText = await W.page.evaluate(() => document.getElementById('tv').textContent);
    ok(!/PRIVATE tv21|Answered this very day tv21|Answered another day tv21/.test(tvText), '(f) never a private (person-scope) title, one answered today, or one answered a year ago on another day', tvText.match(/[^.]*tv21[^.]*/g));
    await W.page.screenshot({ path: path.join(SHOTS, 'rm21-tv-1920-busy.png') });
    // the same board at 1024×768 and on a portrait iPad (820×1180): no scroll, reminders counted, the feed full width in portrait
    const annWhere = ['1920×1080: ' + fs1.anniv.where];
    for (const [w, h] of [[1280, 720], [1024, 768], [820, 1180], [960, 540]]) {
      await W.page.setViewportSize({ width: w, height: h }); await sleep(450);
      const st = await fitState();
      const feedW = await W.page.evaluate(() => [document.querySelector('.tv-feed').getBoundingClientRect().width, document.getElementById('tv').getBoundingClientRect().width]);
      const heads = await W.page.evaluate(() => ['#tv-feed-count', '#tv-rem-more'].map(s => { const e = document.querySelector(s); return e && !e.hidden ? e.textContent : ''; }));
      const counted = st.rem.shown + st.rem.more === st.rem.total && oneFace(st);
      ok(st.anniv.where === 'none' ? st.anniv.copies === 0 : st.anniv.copies === 1 && st.anniv.text === annText && st.anniv.whole, `(f) ${w}×${h}: the anniversary ${st.anniv.where === 'none' ? 'is left out whole (no room in the verse pane or the feed)' : 'shows once, whole, in the ' + (st.anniv.where === 'verse' ? 'verse pane' : 'feed')}`, JSON.stringify(st.anniv));
      annWhere.push(w + '×' + h + ': ' + st.anniv.where);
      ok(st.scroll <= 1 && st.hscroll <= 1 && st.panes.every(p => p.bottom <= h + 1) && counted && st.feedLines >= 1 && st.minFs >= 18 && st.scale === '10ft' && (h < w || Math.abs(feedW[0] - feedW[1]) < 1),
        `(d) ${w}×${h}: fits with no scroll, ${st.feedLines} feed lines, ${st.rem.shown} reminders shown, "${heads[1].trim()}" in the heading, every faces pane with a face ${st.prayed.shown}/${st.read.shown}/${st.stars.shown}, nothing under 18 px (the kiosk's own sizes below 1600 px)${h > w ? ', the feed full width (PWA-VIS-4)' : ''}`, JSON.stringify({ scroll: st.scroll, rem: st.rem, heads, minFs: st.minFs, feedW, panes: st.panes }));
      await W.page.screenshot({ path: path.join(SHOTS, `rm21-tv-${w}-busy.png`) });
    }
    // an iPad turned from portrait to landscape: every kid and reader keeps a face, nothing runs past its pane (review of batch 2c)
    await W.page.setViewportSize({ width: 820, height: 1180 }); await sleep(450); await W.page.setViewportSize({ width: 1180, height: 820 }); await sleep(450);
    await W.page.evaluate(() => window.__tv.paint()); await sleep(100);
    const rot = await fitState();
    ok(rot.stars.more === 0 && rot.stars.shown === rot.stars.all && ['prayed', 'read', 'stars'].every(k => rot[k].right <= rot[k].edge + 1 && rot[k].shown + rot[k].more === rot[k].all), `(d) 820×1180 → 1180×820: every kid has a face, every "+N" inside its pane (read ${rot.read.shown}+${rot.read.more})`, JSON.stringify([rot.prayed, rot.read, rot.stars]));
    await W.page.setViewportSize({ width: 1920, height: 1080 }); await sleep(450);
    fs1 = await fitState();
    ok(fs1.scroll <= 1 && fs1.rem.shown + fs1.rem.more === fs1.rem.total && fs1.minFs >= 28, '(e) back at 1920×1080 after a resize the board fits again', JSON.stringify(fs1.rem));
    console.log('    anniversary placed: ' + annWhere.join(' · '));
    const LONG = 'After two years the whole family prayed that the Millers would find a home near the church, and after many months of waiting the house on Maple Street came through';
    await api('/api/data/prayer/batch?scope=family', { method: 'POST', profile: 'eli', body: { items: [{ key: 'prayer:tv21-long', value: { id: 'tv21-long', title: LONG, category: 'Family', status: 'answered', createdAt: '2020-01-01', answeredAt: YEAR_AGO, prayedBy: {}, by: 'eli' }, updated_at: busy + 40 }] } });
    await W.page.evaluate(() => hub.pull());
    await waitFor(() => W.page.evaluate(() => hub.list('prayer:', { app: 'prayer', scope: 'family' }).some(r => r.key === 'prayer:tv21-long')), { label: 'the long anniversary on the TV' });
    await W.page.evaluate(() => window.__tv.paint()); await sleep(200);
    const fsL = await fitState();
    const longOk = fsL.anniv.where === 'none' ? fsL.anniv.copies === 0 : fsL.anniv.copies === 1 && fsL.anniv.whole && /^A year ago today · Answered: /.test(fsL.anniv.text);
    ok(longOk && fsL.feedLines >= 1 && fsL.scroll <= 1 && fsL.rem.shown + fsL.rem.more === fsL.rem.total && fsL.minFs >= 28 && fsL.panes.every(p => p.top >= 54 - 1 && p.bottom <= 1080 - 54 + 1), `(f) two anniversaries on one day: one line (the first title in order, a long one), whole even when it wraps (${fsL.anniv.where}), and the 1920 gate still holds`, JSON.stringify({ anniv: fsL.anniv, feedLines: fsL.feedLines, scroll: fsL.scroll, rem: fsL.rem }));
    for (const k of ANNIV_KEYS) await api('/api/data/prayer/' + encodeURIComponent(k) + '?scope=family', { method: 'DELETE', profile: 'eli' });
    await api('/api/data/prayer/' + encodeURIComponent('prayer:tv21-private') + '?scope=person', { method: 'DELETE', profile: 'eli' });
    for (let i = 0; i < 14; i++) await api('/api/data/reminders/' + encodeURIComponent('item:tv21-' + i) + '?scope=family', { method: 'DELETE', profile: 'eli' });
    await api('/api/data/prayer/' + encodeURIComponent('prayer:tv21-all') + '?scope=family', { method: 'DELETE', profile: 'eli' });
    await W.page.evaluate(() => hub.pull()); await sleep(600);
    await W.page.evaluate(() => window.__tv.paint());
    ok(await W.page.evaluate(() => window.annivState().where === 'none' && !document.querySelector('#tv-feed > li.tv-anniv')), '(f) the answered rows gone → the anniversary line goes at the next paint');
    // P2-SYNC-12: an offline reopen still knows who read today (the readers are kept on the device, not the last 30 feed lines)
    await W.page.route(/\/api\//, r => r.abort());
    await W.page.reload(); await W.page.waitForSelector('#tv #tv-read .tv-face');
    await sleep(600);
    const off = await W.page.evaluate(() => [...document.querySelectorAll('#tv-read .tv-face:not(.tv-more)')].map(f => ({ n: f.querySelector('.tv-name').textContent, on: !f.classList.contains('off') })));
    const eliName = x.adults.find(a => a.id === 'eli').name;
    ok(off.some(r => r.n === eliName && r.on), '(b) after an offline reopen Eli keeps his ✓ (P2-SYNC-12)', JSON.stringify(off));
    await W.page.unroute(/\/api\//);
    // a Worker without the readers route (not deployed yet): the board falls back to today's "Read week…" feed lines
    await W.page.route(/\/api\/f260\/readers/, r => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found', message: 'Not found' }) }));
    await W.page.evaluate(() => { localStorage.removeItem('hub.tv.readers'); });
    await W.page.reload(); await W.page.waitForSelector('#tv #tv-read .tv-face');
    await waitFor(() => W.page.evaluate(() => window.__tv.state().readersApi === false), { label: 'readers route 404' });
    await W.page.evaluate(() => window.__tv.refreshFeed());
    const fb = await W.page.evaluate(() => ({ st: window.__tv.state().readers, faces: [...document.querySelectorAll('#tv-read .tv-face:not(.tv-more)')].map(f => ({ n: f.querySelector('.tv-name').textContent, on: !f.classList.contains('off') })) }));
    ok(fb.st && fb.st.src === 'feed' && fb.faces.every(r => r.on === x.adults.find(a => a.name === r.n).fromFeed), '(b) a Worker without GET /api/f260/readers: the ✓ come from today\'s "Read week…" feed lines', JSON.stringify(fb));
    await W.page.unroute(/\/api\/f260\/readers/);
    // a day-old answer kept on the device and the route failing with a 5xx: today's feed lines, not yesterday's ✓ (review of batch 2c)
    await W.page.route(/\/api\/f260\/readers/, r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }));
    await W.page.evaluate(() => localStorage.setItem('hub.tv.readers', JSON.stringify({ date: '2000-01-01', ids: ['eli', 'christian', 'mom', 'dad', 'niece'], src: 'f260' })));
    await W.page.reload(); await W.page.waitForSelector('#tv #tv-read .tv-face'); await W.page.evaluate(() => window.__tv.refreshFeed());
    const st5 = await W.page.evaluate(() => [...document.querySelectorAll('#tv-read .tv-face:not(.tv-more)')].map(f => ({ n: f.querySelector('.tv-name').textContent, on: !f.classList.contains('off') })));
    ok(st5.every(r => r.on === x.adults.find(a => a.name === r.n).fromFeed), '(b) a stale kept day and a failing route (503): the ✓ come from today\'s feed lines', JSON.stringify(st5));
    await W.page.unroute(/\/api\/f260\/readers/);
    await W.page.reload(); await W.page.waitForSelector('#tv #tv-read .tv-face');
    await waitFor(() => W.page.evaluate(() => window.__tv.state().readersApi === true), { label: 'readers route back' });
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
    // Switch is the one thing that does something: it stops the board (P2-STAB-11), ends the display's session and opens the picker
    ok(await W.page.evaluate(() => !document.querySelector('#tv-theme, #ap-contrast, #ap-motion, #ap-solid, #view-me button')), '(c) no look controls anywhere while the Switch sheet is closed');
    // a remote: Enter on the Switch, the arrows, Enter again (review of batch 2c, round 2)
    await W.page.focus('#kiosk-switch'); await W.page.keyboard.press('Enter'); await W.page.waitForSelector('.sheet [data-act="look"]');
    const k1 = await W.page.evaluate(() => { document.getElementById('kiosk-switch').click(); return { focus: document.activeElement.dataset.act || ('close' in document.activeElement.dataset ? 'cancel' : document.activeElement.id), sheets: document.querySelectorAll('.sheet-backdrop').length }; });
    await W.page.keyboard.press('ArrowUp');   // the menu opens on Cancel (the safe choice); Up reaches Screen look
    const k2 = await W.page.evaluate(() => document.activeElement.dataset.act);
    await W.page.keyboard.press('Enter'); await W.page.waitForSelector('.sheet #tv-theme [data-theme]');
    const k3 = await W.page.evaluate(() => { const s = document.querySelector('.sheet'); return { focus: document.activeElement.dataset.theme || document.activeElement.id, inSheet: !!document.activeElement.closest('.sheet'), fits: s.scrollHeight <= s.clientHeight + 1, doneOn: document.querySelector('.sheet [data-close]').getBoundingClientRect().bottom <= innerHeight, sheets: document.querySelectorAll('.sheet-backdrop').length }; });
    await W.page.keyboard.press('ArrowRight'); await W.page.keyboard.press('ArrowRight'); await W.page.keyboard.press('Enter'); await sleep(200);
    const k4 = await W.page.evaluate(() => ({ focus: document.activeElement.dataset.theme, theme: document.documentElement.dataset.theme }));
    await W.page.keyboard.press('Escape'); await sleep(150); await W.page.evaluate(() => hub.setTheme('hearth'));
    ok(k1.focus === 'cancel' && k1.sheets === 1 && k2 === 'look' && k3.inSheet && k3.focus === 'system' && k3.sheets === 1 && k4.focus === 'parchment' && k4.theme === 'parchment',
      '(c) by remote: the menu takes focus on Cancel (a double OK never signs the TV out), the Switch waits while it is open, the arrows move, Screen look takes focus, a choice keeps focus on its card', JSON.stringify([k1, k2, k3, k4]));
    ok(k3.fits && k3.doneOn, '(c) Screen look fits a 1920×1080 TV without scrolling (Done on screen)', JSON.stringify(k3));
    await W.page.click('#kiosk-switch');
    await W.page.waitForSelector('.sheet [data-act="look"]');
    const acts = await W.page.evaluate(() => [...document.querySelectorAll('.sheet [data-act]')].map(b => b.textContent.trim()));
    ok(acts.join('|') === 'Switch profile|Screen look', '(c) Switch opens a two-choice sheet: Switch profile, Screen look', JSON.stringify(acts));
    await W.page.click('.sheet [data-act="look"]'); await W.page.waitForSelector('.sheet #tv-theme [data-theme="forest"]');
    const look0 = await W.page.evaluate(() => ({ themes: document.querySelectorAll('.sheet #tv-theme [data-theme]').length, contrast: !!document.querySelector('.sheet #ap-contrast'), motion: !!document.querySelector('.sheet #ap-motion'), solid: !!document.querySelector('.sheet #ap-solid'), size: !!document.querySelector('.sheet #ap-size') }));
    await W.page.click('.sheet #tv-theme [data-theme="forest"]'); await sleep(200);
    await W.page.click('.sheet #ap-contrast'); await sleep(200);
    const look1 = await W.page.evaluate(() => ({ theme: document.documentElement.dataset.theme, stored: localStorage.getItem('hub.theme'), contrast: document.documentElement.dataset.contrast, pending: hub.sync.pending, toast: (t => !!t && !t.hidden)(document.getElementById('hub-toast')), rows: ['theme', 'contrast'].filter(k => hub.get(k, { app: 'hub', scope: 'person' }) !== undefined) }));
    ok(look0.themes >= 6 && look0.contrast && look0.motion && look0.solid && !look0.size && look1.theme === 'forest' && look1.contrast === 'more' && !look1.pending && !look1.toast && !look1.rows.length, '(c) Screen look: the theme cards, contrast, motion and solid glass (no text size); a choice applies at once and stays on the device (no row, no toast)', JSON.stringify([look0, look1]));
    await W.page.click('.sheet [data-close]'); await sleep(200);
    ok(await W.page.evaluate(() => !document.querySelector('.sheet-backdrop, #tv-theme, #ap-contrast')), '(c) closing the sheet removes its controls');
    await W.page.evaluate(() => { hub.setTheme('hearth'); hub.setContrast(null); });
    await W.page.click('#kiosk-switch'); await W.page.waitForSelector('.sheet [data-act="switch"]'); await W.page.click('.sheet [data-act="switch"]');
    await W.page.waitForSelector('#gate:not([hidden]) .pcard[data-id]', { timeout: 10000 });
    ok(true, '(c) Switch → Switch profile opens the profile picker');
    const gone = await W.page.evaluate(() => ({ ls: localStorage.getItem('hub.tv.readers'), mem: window.__tv.state().readers, wl: (window.__wl || []).slice(-1)[0] }));
    ok(gone.ls === null && gone.mem === null && gone.wl === 'released', '(c) Switch forgets who read today and lets the screen sleep (the wake lock released)', JSON.stringify(gone));
    const sw0 = await W.page.evaluate(() => ({ stopped: window.__tv.state().stopped, lastPaint: window.__tv.state().lastPaint, lastFade: window.__tv.state().lastFade, clock: document.getElementById('clock').textContent }));
    await W.page.evaluate(() => { window.__tv.tick(new Date(Date.now() + 3600e3)); window.__tv.paint(new Date(Date.now() + 3600e3)); window.__tv.crossfade(new Date(Date.now() + 3600e3)); });
    await sleep(1500);
    const sw1 = await W.page.evaluate(() => ({ stopped: window.__tv.state().stopped, lastPaint: window.__tv.state().lastPaint, clock: document.getElementById('clock').textContent }));
    ok(sw0.stopped && sw1.lastPaint === sw0.lastPaint && sw1.clock === sw0.clock, '(c) behind the picker the board is stopped: no tick, paint or fade', JSON.stringify([sw0, sw1]));

    console.log('\n## console');
    ok(errors.length === 0, 'no console errors', JSON.stringify(errors));
    await T.ctx.close(); await W.ctx.close();
  } catch (e) { fail++; console.log('  ✗ crashed:', e.stack || e); }
  finally { await cleanup(); await browser.close(); server.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
