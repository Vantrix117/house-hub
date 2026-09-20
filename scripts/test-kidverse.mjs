#!/usr/bin/env node
// Roadmap 16 checks: Kid Verse (apps/kidverse.html) — the F260 memory verse of the week for a child who cannot read.
//   (a) kid flow end to end: Ezra opens it from the Stars card on his Home, sees the week's story art + reference + paraphrase,
//       every control is a big button (no text input anywhere), "Read it to me" speaks the reference + paraphrase at rate 0.85,
//       "Done ★" awards one star and a dozen calm confetti dots fall
//   (b) one star per day: a second tap keeps the count at 1 and says so
//   (c) the star is stored in person scope as { week: 'YYYY-Www', count, days: { 'YYYY-MM-DD': true } } and mirrored
//       into family scope stars:<kidId> with the same value; the feed gets "Ezra read the verse ★"
//   (d) stars survive a device switch: a second context signs in as Ezra and sees ★1 and "Done today"
//   (e) adults: Home says "Ezra ★1"; in the app they get the week stepper (writes family 'week') and each kid's stars, read-only;
//       the kid's open copy follows the new week
//   (f) the kiosk cannot award: no Done button, no stepper, award()/setWeek() nudge instead of writing
//   cd worker && npx wrangler dev --port 8787     (seeded local D1; Eli PIN 1357)
//   node scripts/test-kidverse.mjs <pairing-code>
// Serves the repo on :8976 and proxies /api to the Worker, so it never needs :8765.
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
const PORT = 8976;
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
const isoWeek = d => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); return y + '-W' + pad(Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7)); };
const TODAY = dayKey(new Date()), WEEK = isoWeek(new Date());
const row = async (tok, scope, key) => (await api(`/api/data/kidverse?scope=${scope}`, { profile: tok })).items.find(r => r.key === key);
let T = {};
async function seed() {
  DEVICE = (await api('/api/pair', { method: 'POST', body: { code: CODE, name: 'test-kidverse seeder' } })).device_token;
  T = { eli: await login('eli', ELI_PIN), ezra: await login('ezra'), kiara: await login('kiara'), tv: await login('tv') };
  // a clean slate for Ezra (the local DB is shared with other suites): tombstone his stars, both scopes; the family week → 3
  const now = Date.now();
  await api('/api/data/kidverse/stars?scope=person', { method: 'DELETE', profile: T.ezra }).catch(() => {});
  await api('/api/data/kidverse/stars:ezra?scope=family', { method: 'DELETE', profile: T.eli }).catch(() => {});
  await api('/api/data/kidverse/week?scope=family', { method: 'PUT', profile: T.eli, body: { value: { week: 3, by: 'test' }, updated_at: now } });
}

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
      speak(u) { window.__spoken.push({ text: u.text, rate: u.rate, lang: u.lang, voice: u.voice ? u.voice.name : null }); setTimeout(() => { try { u.onend && u.onend({}); } catch {} }, 40); },
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
// The local Worker is shared with other suites, which reset the DB (sessions, devices, PINs) whenever they start: if a sign-in
// does not land, make sure the PIN is set again through the API, reload, re-pair if the device was wiped, and try once more.
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
    try { DEVICE = (await api('/api/pair', { method: 'POST', body: { code: CODE, name: 'test-kidverse seeder' } })).device_token; if (pin) await login(id, pin); } catch {}
    await page.goto(SITE + '/index.html');
    if (await page.$('#paircode')) { await page.fill('#paircode', CODE); await page.click('#pairform button[type=submit]'); }
    await page.waitForSelector('.pcard[data-id]');
    await signIn(page, id, pin, false);
  }
}
const text = (page, sel) => page.$eval(sel, e => e.textContent.trim().replace(/\s+/g, ' ')).catch(() => null);
// the app's iframe, once it is showing the verse
async function appFrame(page) {
  const fr = await waitFor(() => page.frames().find(f => /apps\/kidverse\.html/.test(f.url())), { label: 'kidverse frame' });
  await fr.waitForFunction(() => window.kidverse && document.getElementById('ref').textContent !== '…', null, { timeout: 15000 });
  await fr.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 });
  return fr;
}
const synced = fr => fr.waitForFunction(() => hub.sync.state === 'synced', null, { timeout: 15000 });
const box = (fr, sel) => fr.$eval(sel, e => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), hidden: e.hidden || r.width === 0 }; }).catch(() => null);
const sameStars = (a, b) => !!a && !!b && a.week === b.week && a.count === b.count && JSON.stringify(a.days) === JSON.stringify(b.days);

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    console.log('\n## seed'); await seed(); ok(true, 'paired, signed in Eli/Ezra/Kiara/TV, cleared Ezra\'s stars, family week → 3');
    const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps.find(a => a.id === 'kidverse');
    ok(reg && reg.scope === 'both' && reg.tile === 'small' && /^#/.test(reg.color) && reg.icon === 'icons/kidverse.svg' && reg.visibleTo && reg.visibleTo.slice(0, 2).join() === 'ezra,kiara' && ['eli', 'christian', 'mom', 'dad', 'niece'].every(id => reg.visibleTo.includes(id)), 'apps.json: kidverse registered (both, small, gold, kids first then the adults)', JSON.stringify(reg));
    ok(fs.existsSync(path.join(ROOT, 'icons/kidverse.svg')) && /class="duo"/.test(fs.readFileSync(path.join(ROOT, 'icons/kidverse.svg'), 'utf8')) && fs.existsSync(path.join(ROOT, 'art/app/kidverse.svg')), 'icon (duotone) + spot art exist');
    const src = fs.readFileSync(path.join(ROOT, 'apps/kidverse.html'), 'utf8');
    ok(!/#[0-9a-f]{3,8}\b/i.test(src.slice(src.indexOf('<style>'), src.indexOf('</style>'))) && !/prefers-color-scheme/.test(src), 'no hex and no prefers-color-scheme in the app\'s CSS');
    ok(!/<input|<textarea|<select|contenteditable/.test(src), 'no text input anywhere in the app');

    console.log('\n## (a) kid flow — Ezra, 390');
    const K = await newContext(browser, 'K');
    await signIn(K.page, 'ezra');
    await K.page.waitForSelector('.stars-card [data-open="kidverse"]');
    ok(await text(K.page, '.stars-card .gbig') === 'No stars yet', 'kid Home starts with "No stars yet"', await text(K.page, '.stars-card .gbig'));
    await K.page.click('.stars-card [data-open="kidverse"]');
    const F = await appFrame(K.page);
    ok(await F.evaluate(() => document.documentElement.dataset.kind) === 'kid', 'the app runs in kid mode (data-kind="kid")');
    ok(await text(F, '#ref') === 'Romans 4:20-22', 'week 3 from the family row → Romans 4:20-22 in big type', await text(F, '#ref'));
    ok(await F.$eval('#art', i => i.dataset.scene + ':' + (i.naturalWidth > 0)) === '03-promise:true', 'week 3 → art/story/03-promise.svg, loaded', await F.$eval('#art', i => i.dataset.scene));
    ok(/Also this week: Hebrews 11:17-19/.test(await text(F, '#also') || ''), 'the second memory verse is named too');
    ok(/Abraham/.test(await text(F, '#words') || '') && /paraphrase/i.test(await text(F, '.words small') || ''), 'a one-sentence paraphrase, labelled as a paraphrase');
    const refPx = await F.$eval('#ref', e => parseFloat(getComputedStyle(e).fontSize));
    ok(refPx >= 40, 'the reference is big type for a kid (≥ 40 px)', refPx);
    ok(await F.$$eval('input, textarea, select, [contenteditable]', l => l.length) === 0, 'no text input in the running page');
    const bSay = await box(F, '#say'), bDone = await box(F, '#done');
    ok(bSay && bSay.h >= 64 && bDone && !bDone.hidden && bDone.h >= 64, 'Read it to me and Done ★ are both ≥ 64 px tall', JSON.stringify({ bSay, bDone }));
    ok(await F.$$eval('button', bs => bs.filter(b => !b.hidden && b.offsetParent !== null).every(b => b.getBoundingClientRect().height >= 64 && b.getBoundingClientRect().width >= 64)), 'every visible control on the kid screen is a ≥ 64 px button');
    ok(await F.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll at 390');
    await F.click('#say');
    const spoken = await waitFor(() => F.evaluate(() => window.__spoken.length ? window.__spoken : null), { label: 'speech' });
    ok(spoken.length === 1 && Math.abs(spoken[0].rate - 0.85) < 1e-6 && /Romans, chapter 4, verses 20 to 22/.test(spoken[0].text) && /Abraham/.test(spoken[0].text), '"Read it to me" speaks the reference and the paraphrase at rate 0.85', JSON.stringify(spoken));
    await sleep(120);
    ok(await text(F, '#say span') === 'Read it to me', 'the button returns to "Read it to me" when the voice finishes');
    await F.click('#done');
    const dots = await F.$$eval('.confetti i', l => l.length);
    ok(dots === 12, 'a dozen confetti dots fall on ★', dots);
    ok(await F.$$eval('.confetti i', l => l.every(i => /^var\(--/.test(i.style.getPropertyValue('--c').trim()))), 'confetti colours are design tokens');
    ok(await text(F, '#star-count') === '1', 'the star count reads 1', await text(F, '#star-count'));
    ok(await text(F, '#done span') === 'Done today ★' && await F.$eval('#done', b => b.classList.contains('today')), 'Done ★ becomes "Done today ★"');
    ok(await F.$$eval('#mine .days span.on', l => l.length) === 1, 'one day dot lit');
    await sleep(1700);
    ok(await F.$$eval('.confetti', l => l.length) === 0, 'confetti is gone after ~1.5 s');
    ok(await F.$$eval('#mine .days span', l => new Set(l.map(e => Math.round(e.getBoundingClientRect().top))).size === 1), 'the seven day dots sit on one row at 390');
    await F.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
    await K.page.screenshot({ path: path.join(SHOTS, 'rm16-kid-390.png') });

    console.log('\n## (b) one star per day');
    await F.click('#done');
    await sleep(150);
    ok(await text(F, '#star-count') === '1', 'a second tap keeps the count at 1');
    ok(/already/.test(await text(F, '#hub-toast') || ''), 'and says so in a toast', await text(F, '#hub-toast'));
    ok(await F.$$eval('.confetti', l => l.length) === 0, 'no second confetti');

    console.log('\n## (c) storage: person row + family mirror + feed line');
    await synced(F);
    const mine = await row(T.ezra, 'person', 'stars'), mirror = await row(T.eli, 'family', 'stars:ezra');
    ok(mine && mine.value && mine.value.week === WEEK && mine.value.count === 1 && mine.value.days && mine.value.days[TODAY] === true && Object.keys(mine.value.days).length === 1, 'app_data(kidverse, person, stars) = { week: this ISO week, count: 1, days: { today: true } }', JSON.stringify(mine && mine.value));
    ok(mirror && sameStars(mirror.value, mine.value), 'app_data(kidverse, family, stars:ezra) mirrors the same value', JSON.stringify(mirror && mirror.value));
    const feed = (await api('/api/activity?limit=40', { profile: T.eli })).activity || [];
    ok(feed.some(a => a.profile_id === 'ezra' && a.app_id === 'kidverse' && /Ezra read the verse ★/.test(a.text)), 'the feed has "Ezra read the verse ★"', JSON.stringify(feed.slice(0, 3).map(a => a.text)));
    await K.page.evaluate(() => document.querySelector('#pill-home').click()); await K.page.click('.tab[data-tab=home]');
    await waitFor(() => K.page.$eval('.stars-card .gbig', e => /1 star this week/.test(e.textContent)), { label: 'kid Home star' });
    ok(true, 'kid Home Stars card: "1 star this week"');

    console.log('\n## (d) a second device as Ezra');
    const K2 = await newContext(browser, 'K2');
    await signIn(K2.page, 'ezra');
    ok(await text(K2.page, '.stars-card .gbig') === '1 star this week', 'Home on the other device: "1 star this week"', await text(K2.page, '.stars-card .gbig'));
    await K2.page.click('.stars-card [data-open="kidverse"]');
    const F2 = await appFrame(K2.page);
    ok(await text(F2, '#star-count') === '1' && await text(F2, '#done span') === 'Done today ★', 'the app on the other device: ★1 and "Done today ★"', await text(F2, '#done span'));
    await F2.click('#done'); await sleep(150);
    ok(await text(F2, '#star-count') === '1', 'still one star per day across devices');

    console.log('\n## (e) adults — Eli, 1024');
    const A = await newContext(browser, 'A', 1024);
    await signIn(A.page, 'eli', ELI_PIN);
    await A.page.waitForSelector('.kids-card .kids-line');
    ok(/Ezra ★1/.test(await text(A.page, '.kids-card .kids-line') || ''), 'adult Home: "Ezra ★1" from the family mirror', await text(A.page, '.kids-card .kids-line'));
    await A.page.click('.tab[data-tab=apps]'); await A.page.waitForSelector('.tile[data-id=kidverse]');
    await A.page.click('.tile[data-id=kidverse]');
    const FA = await appFrame(A.page);
    ok(await FA.$eval('#done', b => b.hidden) && await FA.$eval('#mine', b => b.hidden), 'no Done ★ for an adult (stars are the kids\')');
    ok(/^Week 3(?!\d)/.test(await text(FA, '#week-now') || ''), 'the stepper shows "Week 3"', await text(FA, '#week-now'));
    const kidLine = await text(FA, '.kids li[data-kid=ezra] .kn');
    ok(/Ezra\s*★1/.test(kidLine || '') && await FA.$$eval('.kids li[data-kid=ezra] .days span.on', l => l.length) === 1, 'Ezra ★1 with one lit day, read-only', kidLine);
    ok(!!(await FA.$('.kids li[data-kid=kiara]')), 'Kiara is listed too (★0)');
    const stepBox = await box(FA, '#week-up');
    ok(stepBox && stepBox.h >= 44 && stepBox.w >= 44, 'stepper buttons are ≥ 44 px', JSON.stringify(stepBox));
    await FA.click('#week-up');
    ok(/^Week 4(?!\d)/.test(await text(FA, '#week-now') || '') && await text(FA, '#ref') === '1 John 3:18' && await FA.$eval('#art', i => i.dataset.scene) === '03-promise', '+ steps to week 4: 1 John 3:18, still the promise scene', await text(FA, '#ref'));
    await synced(FA);
    const wk = await row(T.eli, 'family', 'week');
    ok(wk && wk.value && wk.value.week === 4 && wk.value.by === 'eli', 'app_data(kidverse, family, week) = { week: 4, by: eli }', JSON.stringify(wk && wk.value));
    await A.page.screenshot({ path: path.join(SHOTS, 'rm16-adult-1024.png') });
    // the kid's open copy follows on its next pull
    await F2.evaluate(() => hub.pull());
    await waitFor(() => F2.$eval('#ref', e => e.textContent === '1 John 3:18'), { label: 'kid copy follows the week' });
    ok(true, 'the kid\'s open copy follows the new week (hub.onChange)');

    console.log('\n## (f) the kiosk cannot award — Downstairs TV, 1440');
    const TV = await newContext(browser, 'TV', 1440);
    await signIn(TV.page, 'tv');
    await TV.page.goto(SITE + '/apps/kidverse.html');       // standalone, the way the TV would show it
    await TV.page.waitForFunction(() => window.kidverse && window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 });
    ok(await text(TV.page, '#ref') === '1 John 3:18', 'standalone open works and shows week 4');
    ok(await TV.page.$eval('#done', b => b.hidden) && !(await TV.page.$('#week-up')), 'no Done ★ and no stepper for the kiosk');
    ok(/Ezra\s*★1/.test(await text(TV.page, '.kids li[data-kid=ezra] .kn') || ''), 'the TV still sees Ezra ★1');
    const tried = await TV.page.evaluate(() => [window.kidverse.award(), (window.kidverse.setWeek(9), true)]);
    ok(tried[0] === false, 'award() refuses for the kiosk');
    ok(/only looks/.test(await text(TV.page, '#hub-toast') || ''), 'and nudges with the kiosk toast', await text(TV.page, '#hub-toast'));
    await sleep(600);
    const mine2 = await row(T.ezra, 'person', 'stars'), wk2 = await row(T.eli, 'family', 'week');
    ok(sameStars(mine2 && mine2.value, mine.value) && !(await row(T.eli, 'family', 'stars:tv')) && wk2.value.week === 4, 'nothing changed on the server: Ezra still ★1, no stars:tv, week still 4');
    await TV.page.screenshot({ path: path.join(SHOTS, 'rm16-kiosk-1440.png') });

    ok(errors.length === 0, 'no console errors in any context', errors.join(' | '));
    for (const c of [K, K2, A, TV]) await c.ctx.close();
  } catch (e) {
    fail++; console.log('  ✗ crashed:', e && e.stack || e);
  } finally {
    await browser.close(); server.close();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
