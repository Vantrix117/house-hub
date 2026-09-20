#!/usr/bin/env node
// Roadmap 17 checks: the Kid F260 companion — "This week's story" in Kid Verse (apps/kidverse.html) and the "Kids:" line
// in the parents' F260 Today hero (apps/f260.html).
//   (a) 52 retellings, keyed by week, each exactly two sentences, labelled as a retelling; weeks 1, 2, 26 and 52 name the right
//       book/people (creation + Noah, Job + Abram, Daniel + lions, John + everything new); the art is the week's story scene
//   (b) kid flow: Ezra opens Kid Verse on the family week, sees the story below the verse, "Read it to me" speaks it,
//       "I heard it" (≥ 64 px) marks today: person 'story' = { week, days: { today: true } } mirrored to family story:ezra,
//       no star is awarded by this item, the feed gets "Ezra heard this week's story"; a second tap keeps one day and says so
//   (c) parents: Eli's F260 Today hero has no Kids line while no kid has a row, then "Kids: Ezra 1/5" after one pull,
//       then "Kids: Ezra 1/5 · Kiara 1/5" after Kiara hears it on another device — within one pull
//   (d) adults and the kiosk see the story but cannot mark it: no button; heard() refuses and nudges
//   cd worker && npx wrangler dev --port 8787     (seeded local D1; Eli PIN 1357)
//   node scripts/test-kidstory.mjs <pairing-code>
// Serves the repo on :9017 and proxies /api to the Worker, so it never needs :8765.
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
const PORT = 9017;
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
  DEVICE = (await api('/api/pair', { method: 'POST', body: { code: CODE, name: 'test-kidstory seeder' } })).device_token;
  T = { eli: await login('eli', ELI_PIN), ezra: await login('ezra'), kiara: await login('kiara'), tv: await login('tv') };
  // a clean slate (the local DB is shared with other suites): tombstone both kids' story rows, both scopes, and their stars; family week → 26
  for (const [id, tok] of [['ezra', T.ezra], ['kiara', T.kiara]]) {
    await api('/api/data/kidverse/story?scope=person', { method: 'DELETE', profile: tok }).catch(() => {});
    await api('/api/data/kidverse/stars?scope=person', { method: 'DELETE', profile: tok }).catch(() => {});
    await api(`/api/data/kidverse/story:${id}?scope=family`, { method: 'DELETE', profile: T.eli }).catch(() => {});
    await api(`/api/data/kidverse/stars:${id}?scope=family`, { method: 'DELETE', profile: T.eli }).catch(() => {});
  }
  await api('/api/data/kidverse/week?scope=family', { method: 'PUT', profile: T.eli, body: { value: { week: 26, by: 'test' }, updated_at: Date.now() } });
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
// The local Worker is shared with other suites, which reset the DB whenever they start: if a sign-in does not land, set the PIN
// again through the API, reload, re-pair if the device was wiped, and try once more.
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
    try { DEVICE = (await api('/api/pair', { method: 'POST', body: { code: CODE, name: 'test-kidstory seeder' } })).device_token; if (pin) await login(id, pin); } catch {}
    await page.goto(SITE + '/index.html');
    if (await page.$('#paircode')) { await page.fill('#paircode', CODE); await page.click('#pairform button[type=submit]'); }
    await page.waitForSelector('.pcard[data-id]');
    await signIn(page, id, pin, false);
  }
}
const text = (page, sel) => page.$eval(sel, e => e.textContent.trim().replace(/\s+/g, ' ')).catch(() => null);
async function kidverseFrame(page) {
  const fr = await waitFor(() => page.frames().find(f => /apps\/kidverse\.html/.test(f.url())), { label: 'kidverse frame' });
  await fr.waitForFunction(() => window.kidverse && window.kidverse.STORIES && document.getElementById('story-title').textContent !== '…', null, { timeout: 15000 });
  await fr.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 });
  return fr;
}
async function f260Frame(page) {
  const fr = await waitFor(() => page.frames().find(f => /apps\/f260\.html/.test(f.url())), { label: 'f260 frame' });
  await fr.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0 && document.getElementById('todayTitle').textContent !== '', null, { timeout: 20000 });
  return fr;
}
const synced = fr => fr.waitForFunction(() => hub.sync.state === 'synced', null, { timeout: 15000 });
const box = (fr, sel) => fr.$eval(sel, e => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), hidden: e.hidden || r.width === 0 }; }).catch(() => null);
const rowSoon = (tok, scope, key) => waitFor(async () => { const r = await row(tok, scope, key); return r && r.value != null ? r : null; }, { timeout: 20000, label: 'row ' + key });   // a live row, not the seed's tombstone   // the app's flush, seen from the API
const sameStory = (a, b) => !!a && !!b && a.week === b.week && JSON.stringify(a.days) === JSON.stringify(b.days);

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    console.log('\n## seed'); await seed(); ok(true, 'paired, signed in Eli/Ezra/Kiara/TV, cleared both kids\' story + stars rows, family week → 26');

    console.log('\n## (a) the 52 retellings, statically');
    const src = fs.readFileSync(path.join(ROOT, 'apps/kidverse.html'), 'utf8');
    const block = src.slice(src.indexOf('// ── item 17: this week'), src.lastIndexOf('</script>'));
    const stories = [...block.matchAll(/\{ w: (\d+),\s+t: '([^']*)', r: '([^']*)', s: '([^']*)' \}/g)].map(m => ({ w: +m[1], t: m[2], r: m[3], s: m[4] }));
    const sentences = s => s.split(/(?<=[.!?”])\s+(?=[A-Z“])/).length;
    ok(stories.length === 52 && stories.every((s, i) => s.w === i + 1), '52 stories, keyed 1…52 in order', stories.length);
    ok(stories.every(s => sentences(s.s) === 2), 'every retelling is exactly two sentences', stories.filter(s => sentences(s.s) !== 2).map(s => s.w).join(','));
    ok(stories.every(s => s.t && s.r && s.s.length >= 80 && s.s.length <= 420), 'every story has a title, the readings and 80–420 characters', stories.filter(s => !(s.s.length >= 80 && s.s.length <= 420)).map(s => s.w + ':' + s.s.length).join(','));
    const by = w => stories[w - 1];
    ok(/Noah/.test(by(1).s) && /flood/.test(by(1).s) && /made the whole world/.test(by(1).s) && /Genesis 1–9/.test(by(1).r), 'week 1 → creation and the flood (Noah), Genesis 1–9 + Job', by(1).s);
    ok(/Job/.test(by(2).s) && /Abram/.test(by(2).s) && /Job 38–42/.test(by(2).r) && /Genesis 11–17/.test(by(2).r), 'week 2 → Job hears God, Abram is called (Job 38–42, Genesis 11–17)', by(2).s);
    ok(/Daniel/.test(by(26).s) && /lions/.test(by(26).s) && /temple/.test(by(26).s) && /Daniel 5–6/.test(by(26).r) && /Ezra 1–6/.test(by(26).r), 'week 26 → Daniel and the lions, then home to rebuild the temple (Daniel 5–6, Ezra 1–6)', by(26).s);
    ok(/John/.test(by(52).s) && /new/.test(by(52).s) && /tear/.test(by(52).s) && /Revelation/.test(by(52).r), 'week 52 → John sees everything made new (Revelation)', by(52).s);
    ok(/retelling in our own words/.test(src) && /not the Bible's own words/.test(src), 'the story card is labelled a retelling in our own words, not the Bible\'s');
    ok(!/#[0-9a-f]{3,8}\b/i.test(src.slice(src.indexOf('<style>'), src.indexOf('</style>'))) && !/prefers-color-scheme/.test(src), 'no hex and no prefers-color-scheme in the app\'s CSS');
    ok(!/hub\.set\('stars/.test(block), 'the story block never writes a stars row (rewards belong to item 20)');
    const f260src = fs.readFileSync(path.join(ROOT, 'apps/f260.html'), 'utf8');
    ok(/hub\.use\('kidverse', 'family'\)/.test(f260src) && /id="todayKids"/.test(f260src), 'f260.html declares the family kidverse scope and has the Kids line');

    console.log('\n## (c₀) parents first: Eli\'s F260 Today hero has no Kids line while no kid has a row');
    const A = await newContext(browser, 'A', 1024);
    await signIn(A.page, 'eli', ELI_PIN);
    await A.page.click('.tab[data-tab=apps]'); await A.page.waitForSelector('.tile[data-id=f260]'); await A.page.click('.tile[data-id=f260]');
    const FA = await f260Frame(A.page);
    ok(await FA.$eval('#todayKids', e => e.hidden && e.textContent === ''), 'no "Kids:" line when there are no story rows');

    console.log('\n## (b) kid flow — Ezra, 390');
    const K = await newContext(browser, 'K');
    await signIn(K.page, 'ezra');
    await K.page.waitForSelector('.stars-card [data-open="kidverse"]');
    await K.page.click('.stars-card [data-open="kidverse"]');
    const F = await kidverseFrame(K.page);
    ok(await F.evaluate(() => document.documentElement.dataset.kind) === 'kid', 'the app runs in kid mode');
    // the family week row is shared with every other suite on this Worker, so read the week the app is actually on (seeded 26)
    const W = await F.evaluate(() => { const v = hub.get('week', { scope: 'family' }); return Math.min(52, Math.max(1, Math.floor(Number(v && typeof v === 'object' ? v.week : v) || 1))); });
    const exp = await F.evaluate(w => ({ verse: window.kidverse.VERSES[w - 1].refs[window.kidverse.VERSES[w - 1].p], story: window.kidverse.STORIES[w - 1], scene: window.kidverse.sceneFor(w) }), W);
    console.log('  … the family week is ' + W + (W === 26 ? ' (as seeded)' : ' (another suite moved it meanwhile; the checks follow the live week)'));
    ok(await text(F, '#ref') === exp.verse, 'the verse is week ' + W + ' (' + exp.verse + ') — the family week row', await text(F, '#ref'));
    ok(await text(F, '#story-title') === exp.story.t, 'the story below it is week ' + W + ': "' + exp.story.t + '"', await text(F, '#story-title'));
    ok(await text(F, '#story-text') === exp.story.s.replace(/\s+/g, ' '), 'the retelling is the week ' + W + ' text');
    ok(W !== 26 || (/Daniel kept praying/.test(await text(F, '#story-text') || '') && /lions/.test(await text(F, '#story-text') || '')), 'week 26 names Daniel and the lions');
    ok((await text(F, '#story-span') || '').startsWith('Week ' + W + ' · the grown-ups are reading ' + exp.story.r), 'the label says which readings the grown-ups have this week', await text(F, '#story-span'));
    ok(/retelling in our own words/.test(await text(F, '#story small') || ''), 'labelled as a retelling on screen');
    ok(await text(F, '#story-kick') === "Ezra's story this week", 'the kicker is the kid\'s own', await text(F, '#story-kick'));
    const scenes = await F.evaluate(() => [document.getElementById('art').dataset.scene, document.getElementById('story-art').dataset.scene, document.getElementById('story-art').naturalWidth > 0]);
    ok(scenes[0] === exp.scene && scenes[1] === exp.scene && scenes[2], 'the story reuses the week\'s scene (' + exp.scene + '), the same as the verse art, loaded', JSON.stringify(scenes));
    const order = await F.evaluate(() => { const y = id => document.getElementById(id).getBoundingClientRect().top; return y('story') > y('words') && y('story') > y('done'); });
    ok(order, 'the story card sits below the verse and its buttons');
    const bSay = await box(F, '#story-say'), bHeard = await box(F, '#story-heard');
    ok(bSay && bSay.h >= 64 && bSay.w >= 64 && bHeard && !bHeard.hidden && bHeard.h >= 64 && bHeard.w >= 64, '"Read it to me" and "I heard it" are both ≥ 64 px', JSON.stringify({ bSay, bHeard }));
    ok(await F.$$eval('button', bs => bs.filter(b => !b.hidden && b.offsetParent !== null).every(b => b.getBoundingClientRect().height >= 64 && b.getBoundingClientRect().width >= 64)), 'every visible control on the kid screen is still a ≥ 64 px button');
    ok(await F.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll at 390');
    await F.click('#story-say');
    const spoken = await waitFor(() => F.evaluate(() => window.__spoken.length ? window.__spoken : null), { label: 'speech' });
    ok(spoken.length === 1 && Math.abs(spoken[0].rate - 0.85) < 1e-6 && spoken[0].text === "This week's story: " + exp.story.t + '. ' + exp.story.s, '"Read it to me" speaks the title and the retelling at rate 0.85', JSON.stringify(spoken));
    await sleep(120);
    ok(await text(F, '#story-say span') === 'Read it to me', 'the button returns to "Read it to me" when the voice finishes');
    const starsBefore = await text(F, '#star-count');
    await F.evaluate(() => document.getElementById('story').scrollIntoView({ block: 'center' }));
    await F.click('#story-heard');
    ok(await text(F, '#story-heard span') === 'Heard it today ✓' && await F.$eval('#story-heard', b => b.classList.contains('today') && b.getAttribute('aria-pressed') === 'true'), '"I heard it" becomes "Heard it today ✓"', await text(F, '#story-heard span'));
    ok(await text(F, '#story-sub') === 'Heard 1 day this week', 'the sub-line says "Heard 1 day this week"', await text(F, '#story-sub'));
    ok(/Great listening|New badge/.test(await text(F, '#hub-toast') || ''), 'a toast says great listening (or item 20 announces a badge for the story star)', await text(F, '#hub-toast'));
    ok(await F.$$eval('#mine .days span.on', l => l.length) === 0, 'the verse ★ day dots are untouched (no verse star awarded by the story)');
    await F.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
    await K.page.screenshot({ path: path.join(SHOTS, 'rm17-kid-390.png'), fullPage: false });
    await F.evaluate(() => document.getElementById('story').scrollIntoView({ block: 'center' })); await sleep(200);
    await K.page.screenshot({ path: path.join(SHOTS, 'rm17-kid-story-390.png') });
    // one per day
    await F.click('#story-heard'); await sleep(150);
    ok(await text(F, '#story-sub') === 'Heard 1 day this week' && /already heard/.test(await text(F, '#hub-toast') || ''), 'a second tap keeps one day and says so', await text(F, '#hub-toast'));
    // storage + feed
    await synced(F).catch(() => {});
    const mine = await rowSoon(T.ezra, 'person', 'story'), mirror = await rowSoon(T.eli, 'family', 'story:ezra');
    ok(mine && mine.value && mine.value.week === WEEK && mine.value.days && mine.value.days[TODAY] === true && Object.keys(mine.value.days).length === 1, 'app_data(kidverse, person, story) = { week: this ISO week, days: { today: true } }', JSON.stringify(mine && mine.value));
    ok(mirror && sameStory(mirror.value, mine.value), 'app_data(kidverse, family, story:ezra) mirrors the same value', JSON.stringify(mirror && mirror.value));
    const feed = (await api('/api/activity?limit=40', { profile: T.eli })).activity || [];
    ok(feed.some(a => a.profile_id === 'ezra' && a.app_id === 'kidverse' && /Ezra heard this week's story/.test(a.text)), 'the feed has "Ezra heard this week\'s story"', JSON.stringify(feed.slice(0, 4).map(a => a.text)));
    const starRow = await row(T.ezra, 'person', 'stars');
    ok(!starRow || !starRow.value || !(starRow.value.days && starRow.value.days[TODAY]), 'no verse-★ day was written by hearing the story (stars stay item 20\'s)', JSON.stringify(starRow && starRow.value && starRow.value.days));

    console.log('\n## (c) parents\' F260: "Kids: Ezra 1/5" within a pull, then Kiara joins');
    await FA.evaluate(() => hub.pull());
    await waitFor(() => FA.$eval('#todayKids', e => !e.hidden && /Kids: Ezra 1\/5/.test(e.textContent)), { label: 'Kids line' });
    ok(true, 'Eli\'s Today hero: "Kids: Ezra 1/5" after one pull');
    ok(!/Kiara/.test(await text(FA, '#todayKids') || ''), 'Kiara is not listed until she has a row', await text(FA, '#todayKids'));
    const K2 = await newContext(browser, 'K2');
    await signIn(K2.page, 'kiara');
    await K2.page.waitForSelector('.stars-card [data-open="kidverse"]'); await K2.page.click('.stars-card [data-open="kidverse"]');
    const F2 = await kidverseFrame(K2.page);
    await F2.evaluate(() => document.getElementById('story').scrollIntoView({ block: 'center' }));
    await F2.click('#story-heard'); await rowSoon(T.eli, 'family', 'story:kiara');
    await FA.evaluate(() => hub.pull()).catch(e => console.log('  … pull:', e.message.split('\n')[0]));
    await waitFor(() => FA.$eval('#todayKids', e => /Kids: Ezra 1\/5 · Kiara 1\/5/.test(e.textContent)), { label: 'Kids line with Kiara' }).catch(async e => {
      console.log('  … Kids line now:', JSON.stringify(await text(FA, '#todayKids')), 'frame:', FA.url(), 'rows:', JSON.stringify(await FA.evaluate(() => hub.list('story:', { app: 'kidverse', scope: 'family' })).catch(x => x.message)));
      throw e;
    });
    ok(true, '"Kids: Ezra 1/5 · Kiara 1/5" after Kiara hears it on another device');
    ok(await FA.$eval('#todayKids', e => { const cs = getComputedStyle(e); return e.closest('#today') && parseFloat(cs.fontSize) <= 14 && cs.color !== ''; }), 'one small muted line inside the Today hero');
    ok(await FA.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll in F260 at 1024');
    await A.page.screenshot({ path: path.join(SHOTS, 'rm17-f260-1024.png') });
    const feed2 = (await api('/api/activity?limit=40', { profile: T.eli })).activity || [];
    ok(feed2.some(a => a.profile_id === 'kiara' && /Kiara heard this week's story/.test(a.text)), 'the feed has "Kiara heard this week\'s story"');

    console.log('\n## (d) adults and the kiosk see the story but cannot mark it');
    await A.page.evaluate(() => document.querySelector('#pill-home').click()); await A.page.waitForFunction(() => !document.getElementById('viewer').classList.contains('on'), null, { timeout: 15000 });
    await A.page.click('.tab[data-tab=apps]'); await A.page.waitForSelector('.tile[data-id=kidverse]'); await A.page.click('.tile[data-id=kidverse]');
    const FK = await kidverseFrame(A.page);
    ok(await text(FK, '#story-title') === exp.story.t && await FK.$eval('#story-heard', b => b.hidden), 'an adult sees the story, no "I heard it"');
    ok(await text(FK, '#story-kick') === 'This week’s story', 'adult kicker: "This week’s story"', await text(FK, '#story-kick'));
    ok(await FK.evaluate(() => window.kidverse.heard()) === false && /for the kids/.test(await text(FK, '#hub-toast') || ''), 'heard() refuses for an adult and says the story is for the kids');
    const TV = await newContext(browser, 'TV', 1440);
    await signIn(TV.page, 'tv');
    await TV.page.goto(SITE + '/apps/kidverse.html');
    await TV.page.waitForFunction(() => window.kidverse && window.kidverse.STORIES && window.hub && hub.sync && hub.sync.lastPull > 0 && document.getElementById('story-title').textContent !== '…', null, { timeout: 15000 });
    ok(await text(TV.page, '#story-title') === exp.story.t && await TV.page.$eval('#story-heard', b => b.hidden), 'the TV sees the story, no button');
    ok(await TV.page.evaluate(() => window.kidverse.heard()) === false && /only looks/.test(await text(TV.page, '#hub-toast') || ''), 'heard() refuses for the kiosk and nudges');
    await sleep(500);
    ok(!(await row(T.eli, 'family', 'story:tv')) && sameStory((await row(T.ezra, 'person', 'story')).value, mine.value), 'nothing changed on the server: no story:tv, Ezra still one day');
    await TV.page.screenshot({ path: path.join(SHOTS, 'rm17-kiosk-1440.png') });

    ok(errors.length === 0, 'no console errors in any context', errors.join(' | '));
    for (const c of [A, K, K2, TV]) await c.ctx.close();
  } catch (e) {
    fail++; console.log('  ✗ crashed:', e && e.stack || e);
  } finally {
    await browser.close(); server.close();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
