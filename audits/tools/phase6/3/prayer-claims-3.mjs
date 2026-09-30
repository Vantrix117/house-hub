// Batch 3 (Worker A): the Prayer claims no other filed output proves, one PASS/FAIL line each, with its numbers.
//   1 P3-PRAYER-19  an open Kitchen view repaints at the house's midnight (rig, controlled clock)
//   2 P3-PRAYER-08  an old family weekly copy with days [] is on Today every day of the week, and a My-list one counts
//                   on Home's "N to pray" every day (rig)
//   3 P3-PRAYER-22  a Sunday with only no-news items says "Some requests have had no news in a while."; nothing when
//                   nothing is quiet; "gone quiet" when something is (rig)
//   4 UX-PRAYER-4   Paste → Keep on the Family list goes through the family confirm: Cancel writes nothing, Change it
//                   writes (rig)
//   5 VIS-PRAYER-6  iPad landscape 1180×820, overflow seed (long plan name): requests above the nav on Today (before the
//                   batch: 1) and no horizontal scroll (rig)
//   6 IMP-PRAYER-I1 Around the table on the Kitchen device: each tapped household member credited, a kid's star
//                   follows, no guest / TV / kitchen on the face row, nothing credited twice, a personal device credits
//                   only its person (a local Worker, like the repo's suites: HUB_API, default http://127.0.0.1:8792)
// Run: node "audits/tools/phase6/3/prayer-claims-3.mjs" <pairing-code-of-the-local-Worker>
//   -> audits/evidence/p6/3/claims/prayer-claims-3.json + PNGs. Exit 1 on any FAIL.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { local, sleep, playwright, ROOT } from '../../lib/local.mjs';

const OUT = 'audits/evidence/p6/3/claims';
fs.mkdirSync(OUT, { recursive: true });
const CODE = process.argv[2];
const API = process.env.HUB_API || 'http://127.0.0.1:8792';
const res = {}; let fails = 0;
const claim = (n, ok, text, data) => { res[n] = { ok: !!ok, text, data }; if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${text}`); };
const readyApp = f => f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0 && typeof D !== 'undefined' && D, null, { timeout: 20000 });

// ── 1: the Kitchen view at the house's midnight ───────────────────────────────────────────────────────────────────
async function claim1() {
  const T0 = Date.parse('2026-09-22T23:59:35-04:00');
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
  try {
    await L.clock('2026-09-22T23:59:35-04:00');
    const d = await L.device({ device: 'ipad-landscape', profile: 'eli', installClock: T0 });
    const f = await d.openApp('prayer', { wait: '#todayLine' });
    await readyApp(f); await sleep(600);
    await f.click('#moreBtn'); await sleep(400); await f.click('[data-more="kitchen"]'); await sleep(600);
    const read = () => f.evaluate(() => ({ today: TODAY, on: el('kitchen').classList.contains('on'), date: (document.querySelector('#kitchenBody .date') || {}).textContent,
      marked: !!document.querySelector('#kitchenBody [data-claim-mark]'), items: document.querySelectorAll('#kitchenBody .k-item').length,
      active: L().prayers.filter(p => p.status === 'active').length, todayDate: el('todayDate').textContent, todaySet: todaySet().map(p => p.id) }));
    await f.evaluate(() => { const x = document.querySelector('#kitchenBody > *'); if (x) x.setAttribute('data-claim-mark', '1'); });
    const before = await read();
    await d.shot(`${OUT}/1-kitchen-before-midnight.png`);
    await d.ctx.clock.runFor(Date.parse('2026-09-23T00:00:45-04:00') - T0);   // past midnight and past hub.onDay's 20 s check
    await sleep(500);
    const after = await read();
    await d.shot(`${OUT}/1-kitchen-after-midnight.png`);
    const ok = before.on && after.on && before.today === '2026-09-22' && after.today === '2026-09-23' && /Tuesday/.test(before.date) && /Wednesday/.test(after.date)
      && !after.marked && after.items === after.active && /Wednesday/.test(after.todayDate);
    claim('1 P3-PRAYER-19', ok, `Kitchen view stays open and repaints at midnight: "${before.date}" -> "${after.date}", body rebuilt ${!after.marked}, ${after.items} requests shown of ${after.active} active; Today behind: ${before.todaySet.length} -> ${after.todaySet.length} for the new day`, { before, after });
  } finally { await L.close(); }
}

// ── 2, 3, 4: typical seed ─────────────────────────────────────────────────────────────────────────────────────────
const stub = (id, title, extra) => Object.assign({ id, title, for: '', phone: '', detail: '', category: 'Personal', cadence: 'weekly', days: [], status: 'active',
  createdAt: '2026-09-01', lastPrayedAt: null, answeredAt: null, answerNote: null, updates: [], sharedFrom: null, prayedBy: {}, by: 'eli', updatedAt: '2026-09-01T12:00:00.000Z' }, extra || {});
async function claims234() {
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
  try {
    // 2: the old share wrote cadence weekly with days [] — seeded the same way, on the family list and on Eli's own list
    const w1 = await L.apiAs('eli', '/api/data/prayer/prayer:sold1?scope=family', { method: 'PUT', body: { value: stub('sold1', 'Old weekly family copy', { sharedFrom: 'p006' }) } });
    const days = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26'];
    const d = await L.device({ device: 'desktop', profile: 'eli' });
    const f = await d.openApp('prayer', { wait: '#todayLine' });
    await readyApp(f); await sleep(600);
    const onToday = await f.evaluate(ds => { const keep = TODAY, list = D.activeList, out = {};
      D.activeList = 'shared';
      for (const x of ds) { TODAY = x; out[x] = todaySet().some(p => p.id === 'sold1'); }
      TODAY = keep; D.activeList = list; save(); renderAllScreens(); return out; }, days);   // todaySet may save; the list choice goes back as it was
    await d.close();
    // Home's "N to pray" (Eli's own list): each weekday with the row and after it is removed must differ by exactly one
    const homeDue = async () => { const out = {};
      for (const x of days) {
        const h = await L.device({ device: 'desktop', profile: 'eli', fixedTime: Date.parse(x + 'T09:00:00-04:00') });
        await h.goto('#home'); await h.page.waitForSelector('.prayer-card .gbig', { timeout: 15000 });
        await h.page.waitForFunction(() => !document.querySelector('.prayer-card .gbig .sk') && document.querySelector('.prayer-card .gbig').textContent.trim().length > 0, null, { timeout: 15000 }).catch(() => {});
        await sleep(700);
        const t = (await h.page.textContent('.prayer-card .gbig')).trim(); const m = /^(\d+) to pray/.exec(t); out[x] = m ? +m[1] : 0;
        await h.close();
      }
      return out; };
    const w2 = await L.apiAs('eli', '/api/data/prayer/prayer:pold1?scope=person', { method: 'PUT', body: { value: stub('pold1', 'Old weekly on my own list') } });
    const withRow = await homeDue();
    await L.apiAs('eli', '/api/data/prayer/prayer:pold1?scope=person', { method: 'DELETE' });
    const without = await homeDue();
    const diff = Object.fromEntries(days.map(x => [x, withRow[x] - without[x]]));
    claim('2 P3-PRAYER-08', w1.status === 200 && w2.status === 200 && days.every(x => onToday[x]) && days.every(x => diff[x] === 1),
      `a weekly row with days [] is on the family Today ${days.filter(x => onToday[x]).length}/7 days; Home's "N to pray" counts the My-list one on ${days.filter(x => diff[x] === 1).length}/7 days (with ${JSON.stringify(withRow)} vs without ${JSON.stringify(without)})`,
      { onToday, withRow, without, writes: [w1.status, w2.status] });

    // 3: Sunday
    const SUN = Date.parse('2026-09-27T08:40:00-04:00'), SAT = Date.parse('2026-09-26T08:40:00-04:00');
    const prompt = async (profile, t, shot) => {
      const s = await L.device({ device: 'iphone-pwa', profile, fixedTime: t });
      const g = await s.openApp('prayer', { wait: '#todayLine' }); await readyApp(g); await sleep(600);
      await g.evaluate(() => { if (D.activeList !== 'personal') { D.activeList = 'personal'; renderAllScreens(); } });   // each person's own list
      const r = await g.evaluate(() => { const q = reviewItems(); return { prompt: el('reviewPrompt').innerText.replace(/\s+/g, ' ').trim(), cold: q.cold.length, silent: q.silent.length, dow: dowToday() }; });
      if (shot) await s.shot(`${OUT}/${shot}.png`); await s.close(); return r; };
    const maeNone = await prompt('christian', SUN, '3-sunday-nothing-quiet');
    const ws = await L.apiAs('christian', '/api/data/prayer/prayer:msilent1?scope=person', { method: 'PUT', body: { value: stub('msilent1', 'No news since spring', { cadence: 'daily', createdAt: '2026-05-01', lastPrayedAt: '2026-09-26', by: 'christian' }) } });
    const maeSilent = await prompt('christian', SUN, '3-sunday-no-news-only');
    const maeSat = await prompt('christian', SAT);
    const eliSun = await prompt('eli', SUN);
    const NO_NEWS = 'Some requests have had no news in a while.';
    claim('3 P3-PRAYER-22', ws.status === 200 && maeNone.prompt === '' && maeNone.cold + maeNone.silent === 0
        && maeSilent.dow === 'Sun' && maeSilent.cold === 0 && maeSilent.silent >= 1 && maeSilent.prompt.startsWith(NO_NEWS)
        && maeSat.prompt === '' && eliSun.cold > 0 && eliSun.prompt.startsWith('Some of the list has gone quiet.'),
      `Sunday, nothing quiet: "${maeNone.prompt}" (cold ${maeNone.cold}, no news ${maeNone.silent}); Sunday, no-news only: "${maeSilent.prompt}" (cold ${maeSilent.cold}, no news ${maeSilent.silent}); the same list on Saturday: "${maeSat.prompt}"; Eli's Sunday with ${eliSun.cold} gone quiet: "${eliSun.prompt}"`,
      { maeNone, maeSilent, maeSat, eliSun });

    // 4: Paste → Keep on the Family list
    const p = await L.device({ device: 'desktop', profile: 'eli' });
    const g = await p.openApp('prayer', { wait: '#todayLine' }); await readyApp(g); await sleep(600);
    await g.click('#listSwitch [data-list="shared"]'); await sleep(500);
    await g.click('nav [data-go="more"]'); await sleep(400);
    const title = 'Claim four pasted request';
    await g.fill('#f-paste', 'Neighbors:\nThe Lees - ' + title.toLowerCase()); await g.click('#f-parse'); await sleep(400);
    const count = () => g.evaluate(() => D.lists.shared.prayers.length);
    const onServer = async () => ((await L.apiAs('mom', '/api/data/prayer?scope=family')).body.items || []).filter(x => x.value && x.value.title === title).length;
    const n0 = await count();
    await g.click('#parsed [data-keep="0"]'); await sleep(500);
    const asked1 = await g.evaluate(() => { const s = document.querySelector('.hub-ask'); return s ? s.innerText.replace(/\s+/g, ' ') : null; });
    await p.shot(`${OUT}/4-paste-keep-family-confirm.png`);
    await g.click('.hub-ask .sheet-actions .btn:not(.btn-primary)'); await sleep(2500);
    const afterCancel = { local: await count(), server: await onServer(), button: await g.textContent('#parsed [data-keep="0"]') };
    await g.click('#parsed [data-keep="0"]'); await sleep(500);
    const asked2 = !!(await g.$('.hub-ask'));
    await g.click('.hub-ask .btn-primary'); await sleep(3000);
    const afterYes = { local: await count(), server: await onServer(), button: await g.textContent('#parsed [data-keep="0"]') };
    claim('4 UX-PRAYER-4', !!asked1 && /Change the Family list/.test(asked1) && afterCancel.local === n0 && afterCancel.server === 0 && asked2 && afterYes.local === n0 + 1 && afterYes.server === 1,
      `Keep on the Family list asks "${(asked1 || '').slice(0, 60)}…"; after Cancel family requests ${n0} -> ${afterCancel.local}, house copies ${afterCancel.server}; after Change it ${afterYes.local}, house copies ${afterYes.server} ("${afterYes.button}")`,
      { n0, asked1, afterCancel, asked2, afterYes });
  } finally { await L.close(); }
}

// ── 5: iPad landscape, overflow seed ──────────────────────────────────────────────────────────────────────────────
async function claim5() {
  const L = await local({ variant: 'overflow', clock: 'demo', engine: 'webkit' });
  try {
    const out = {};
    for (const mode of ['light', 'dark']) {
      const d = await L.device({ device: 'ipad-landscape', mode, profile: 'eli' });
      const f = await d.openApp('prayer', { wait: '#todayLine' }); await readyApp(f); await sleep(900);
      out[mode] = await f.evaluate(() => {
        const nav = document.querySelector('nav').getBoundingClientRect().top;
        const rows = [...document.querySelectorAll('#todayList li.row')].map(r => r.getBoundingClientRect());
        return { vw: innerWidth, vh: innerHeight, plan: PL().name, list: D.activeList, navTop: Math.round(nav), rows: rows.length,
          fullyAbove: rows.filter(r => r.top >= 0 && r.bottom <= nav).length, startAbove: rows.filter(r => r.top < nav).length,
          hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth, shellH: null };
      });
      out[mode].shellHScroll = await d.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      await d.shot(`${OUT}/5-today-overflow-ipad-landscape-${mode}.png`); await d.close();
    }
    const l = out.light;
    claim('5 VIS-PRAYER-6', l.fullyAbove > 1 && !l.hScroll && !l.shellHScroll && out.dark.fullyAbove === l.fullyAbove && !out.dark.hScroll,
      `iPad landscape (frame ${l.vw}×${l.vh}), overflow seed, plan "${l.plan.slice(0, 40)}${l.plan.length > 40 ? '…' : ''}": ${l.fullyAbove} requests fully above the nav (${l.startAbove} start above it; before the batch: 1), horizontal scroll ${l.hScroll || l.shellHScroll}`, out);
  } finally { await L.close(); }
}

// ── 6: Around the table, against a local Worker ───────────────────────────────────────────────────────────────────
async function claim6() {
  if (!CODE) { claim('6 IMP-PRAYER-I1', false, 'no pairing code given (argv)'); return; }
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
  const PORT = 9141, SITE = 'http://localhost:' + PORT;
  const server = http.createServer(async (req, res2) => {
    if (req.url.startsWith('/api/')) {
      const chunks = []; for await (const c of req) chunks.push(c);
      const h = {}; for (const k of ['content-type', 'x-device-token', 'x-profile-token']) if (req.headers[k]) h[k] = req.headers[k];
      try { const r = await fetch(API + req.url, { method: req.method, headers: h, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
        res2.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'application/json' }); return res2.end(Buffer.from(await r.arrayBuffer())); }
      catch (e) { res2.writeHead(502); return res2.end(String(e)); }
    }
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
    fs.readFile(p, (err, data) => { if (err) { res2.writeHead(404); return res2.end(); } res2.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res2.end(data); });
  }).listen(PORT);
  const api = async (p, { method = 'GET', body, dt, pt } = {}) => {
    const h = { 'Content-Type': 'application/json' }; if (dt) h['X-Device-Token'] = dt; if (pt) h['X-Profile-Token'] = pt;
    const r = await fetch(API + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    let j = null; try { j = await r.json(); } catch {} return { status: r.status, body: j };
  };
  const waitFor = async (fn, t = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { try { const v = await fn(); if (v) return v; } catch {} await sleep(200); } return null; };
  const PIN = '1357';
  const pairAs = async (id, pin, name) => {
    const pair = (await api('/api/pair', { method: 'POST', body: { code: CODE, name, fp: 'claims3-' + name } })).body;
    let l = await api('/api/login', { method: 'POST', dt: pair.device_token, body: { profile_id: id, ...(pin ? { pin } : {}) } });
    if (l.body && l.body.error === 'needs_pin_setup') l = await api(`/api/profiles/${id}/pin`, { method: 'POST', dt: pair.device_token, body: { pin } });
    return { device: { id: pair.device_id, token: pair.device_token, name }, dt: pair.device_token, pt: l.body && l.body.profile_token, profile: l.body && l.body.profile };
  };
  const pw = playwright();
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
  const browser = await pw.chromium.launch({ headless: true, executablePath: exe });
  const errors = [];
  const open = async (auth, name, viewport, file = 'apps/prayer.html') => {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true });
    await ctx.addInitScript(a => { try { localStorage.setItem('hub.api', JSON.stringify(a.api)); localStorage.setItem('hub.device', JSON.stringify(a.device)); localStorage.setItem('hub.session', JSON.stringify({ token: a.pt, profile: a.profile })); } catch {} }, { api: SITE, device: auth.device, pt: auth.pt, profile: auth.profile });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    await page.goto(SITE + '/' + file, { waitUntil: 'networkidle' });
    return { ctx, page };
  };
  const data = {};
  try {
    const A = await pairAs('eli', PIN, 'admin');
    const guest = await api('/api/profiles', { method: 'POST', dt: A.dt, pt: A.pt, body: { name: 'Claim Guest', emoji: '🙂' } });
    const K0 = (await api('/api/pair', { method: 'POST', body: { code: CODE, name: 'claims3-kitchen', fp: 'claims3-kitchen' } })).body;
    const role = await api(`/api/admin/devices/${K0.device_id}/role`, { method: 'PUT', dt: A.dt, pt: A.pt, body: { role: 'kitchen', admin_pin: PIN } });
    const kl = await api('/api/login', { method: 'POST', dt: K0.device_token, body: { profile_id: 'kitchen' } });
    const K = { device: { id: K0.device_id, token: K0.device_token, name: 'claims3-kitchen' }, dt: K0.device_token, pt: kl.body && kl.body.profile_token, profile: kl.body && kl.body.profile };
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    const mk = (id, title) => ({ id, title, for: '', phone: '', detail: '', category: 'Family', cadence: 'daily', days: [], status: 'active', createdAt: day, lastPrayedAt: null, answeredAt: null, answerNote: null, updates: [], sharedFrom: null, prayedBy: {}, by: 'eli', updatedAt: new Date().toISOString() });
    const fam = (await api('/api/data/prayer?scope=family', { dt: A.dt, pt: A.pt })).body;
    for (const r of ((fam && fam.items) || []).filter(r => /^prayer:/.test(r.key) && r.value)) await api(`/api/data/prayer/${r.key}?scope=family`, { method: 'DELETE', dt: A.dt, pt: A.pt });
    const tag = Date.now().toString(36), ids = ['c' + tag + 'a', 'c' + tag + 'b'];
    for (const [i, t] of [[ids[0], "Grandma Jo's visit"], [ids[1], 'Safe travel for the Carters']]) await api(`/api/data/prayer/prayer:${i}?scope=family`, { method: 'PUT', dt: A.dt, pt: A.pt, body: { value: mk(i, t) } });
    const rowsNow = async () => { const out = []; for (const i of ids) { const r = await api(`/api/data/prayer?scope=family&key=prayer:${i}`, { dt: A.dt, pt: A.pt }); out.push((r.body.item && r.body.item.value && r.body.item.value.prayedBy && r.body.item.value.prayedBy[day]) || []); } return out; };
    const feedSince = async id0 => ((await api('/api/activity?limit=40', { dt: A.dt, pt: A.pt })).body.activity || []).filter(l => l.id > id0 && l.app_id === 'prayer');
    const lastId = async () => (((await api('/api/activity?limit=1', { dt: A.dt, pt: A.pt })).body.activity || [])[0] || { id: 0 }).id;

    // the kitchen: Eli starts, Ezra sits down with one tap, two cards prayed
    const { page: kp } = await open(K, 'kitchen', { width: 820, height: 1180 });
    await kp.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0 && typeof D !== 'undefined' && D, null, { timeout: 20000 }); await sleep(800);
    await kp.evaluate(() => hub.profiles && hub.profiles()).catch(() => {}); await sleep(500);
    const f0 = await lastId();
    await kp.click('#startPray'); await kp.waitForSelector('.hub-who .hub-face', { timeout: 8000 });
    const sheetFaces = await kp.$$eval('.hub-who .hub-face', bs => bs.map(b => b.dataset.id));
    await kp.click('.hub-who .hub-face[data-id="eli"]'); await kp.waitForSelector('#pray.on'); await sleep(400);
    const rowFaces = await kp.$$eval('#prayTable [data-table]', bs => bs.map(b => b.dataset.table + ':' + b.getAttribute('aria-pressed')));
    const everyone = ((await api('/api/profiles', { dt: A.dt })).body.profiles || []);
    const guestId = guest.body && guest.body.profile && guest.body.profile.id;
    const kitchenKnowsGuest = await kp.evaluate(g => hub.people().some(p => p.id === g), guestId);
    await kp.click('#prayTable [data-table="ezra"]'); await sleep(300);
    await kp.screenshot({ path: `${OUT}/6-kitchen-table.png` });
    await kp.click('#prayNext'); await sleep(300); await kp.click('#prayNext'); await sleep(500);
    await kp.evaluate(() => hub.flush()); await sleep(1500); await kp.evaluate(() => hub.flush());
    const run1 = await waitFor(async () => { const r = await rowsNow(); return r.every(l => l.includes('eli') && l.includes('ezra')) ? r : null; });
    const feed1 = await waitFor(async () => { const f = await feedSince(f0); return f.filter(l => /Prayed through 2 family requests/.test(l.text)).length >= 2 ? f : null; });
    // the same two at the table again: nothing is credited twice, and no feed line
    const f1 = await lastId();
    await kp.click('#startPray'); await kp.waitForSelector('.hub-who .hub-face', { timeout: 8000 });
    await kp.click('.hub-who .hub-face[data-id="eli"]'); await kp.waitForSelector('#pray.on'); await sleep(300);
    await kp.click('#prayTable [data-table="ezra"]'); await sleep(200);
    const n2 = await kp.evaluate(() => prayList.length);
    for (let i = 0; i < n2; i++) { await kp.click('#prayNext'); await sleep(250); }
    await kp.evaluate(() => hub.flush()); await sleep(2000);
    const run2 = await rowsNow(), feed2 = await feedSince(f1);
    // Ezra's prayer star, once his Kid Verse opens on his own tablet
    const E = await pairAs('ezra', null, 'ezra-tablet');
    const { page: ep } = await open(E, 'ezra', { width: 390, height: 844 }, 'apps/kidverse.html');
    const star = await waitFor(async () => { const r = await api('/api/data/kidverse?scope=family&key=stars:ezra', { dt: A.dt, pt: A.pt }); const v = r.body.item && r.body.item.value; return v && v.credited && v.credited.prayed && v.credited.prayed[day] === true ? v : null; }, 30000);
    await ep.close();
    // a personal device: Mae's phone on the family list credits only Mae
    const M = await pairAs('christian', PIN, 'mae-phone');
    const { page: mp } = await open(M, 'mae', { width: 390, height: 844 });
    await mp.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0 && typeof D !== 'undefined' && D, null, { timeout: 20000 }); await sleep(600);
    await mp.evaluate(() => { D.activeList = 'shared'; save(); go('today'); }); await sleep(400);
    const f2 = await lastId();
    await mp.click('#startPray'); await mp.waitForSelector('#pray.on'); await sleep(300);
    const phoneTable = await mp.evaluate(() => ({ faces: document.querySelectorAll('#prayTable [data-table]').length, text: el('prayTable').textContent.trim() }));
    await mp.screenshot({ path: `${OUT}/6-personal-phone.png` });
    const n3 = await mp.evaluate(() => prayList.length);
    for (let i = 0; i < n3; i++) { await mp.click('#prayNext'); await sleep(250); }
    await mp.evaluate(() => hub.flush()); await sleep(2000);
    const run3 = await rowsNow(), feed3 = await feedSince(f2);
    Object.assign(data, { role: role.status, guest: guestId, kitchenKnowsGuest, sheetFaces, rowFaces, run1, feed1: feed1 && feed1.map(l => l.profile_id + ': ' + l.text), run2, feed2: feed2.map(l => l.profile_id + ': ' + l.text),
      star: star && { count: star.count, prayed: star.credited.prayed[day] }, phoneTable, run3, feed3: feed3.map(l => l.profile_id + ': ' + l.text), errors });
    const household = everyone.filter(p => !p.is_guest && (p.kind === 'adult' || p.kind === 'kid')).map(p => p.id);
    const onRow = rowFaces.map(x => x.split(':')[0]);
    const noOutsiders = !onRow.includes(guestId) && !onRow.includes('tv') && !onRow.includes('kitchen');
    const credited = !!run1 && run1.every(l => l.length === 2 && l.includes('eli') && l.includes('ezra'));
    const once = run2.every(l => l.length === 2 && new Set(l).size === l.length) && feed2.length === 0;
    const personal = run3.every(l => l.length === 3 && l.includes('christian')) && feed3.length === 1 && feed3[0].profile_id === 'christian' && phoneTable.faces === 0 && /Prayed marks you/.test(phoneTable.text);
    claim('6 IMP-PRAYER-I1', role.status === 200 && !!guestId && noOutsiders && household.every(id => onRow.includes(id)) && credited && !!feed1 && once && !!star && personal && !errors.length,
      `kitchen face row ${onRow.length} = household ${household.length} (guest/TV/kitchen on it: ${!noOutsiders}; the guest is in the kitchen's people list: ${kitchenKnowsGuest}); both requests credit [${run1 && run1[0]}] and [${run1 && run1[1]}], ${feed1 ? feed1.filter(l => /Prayed through 2/.test(l.text)).length : 0} run lines (eli, ezra); the same table again: ${JSON.stringify(run2)} and ${feed2.length} new lines; Ezra's star today ${!!star}${star ? ' (count ' + star.count + ')' : ''}; Mae's phone: ${phoneTable.faces} table faces, "${phoneTable.text}", rows then ${JSON.stringify(run3)}, ${feed3.length} line (${feed3.map(l => l.profile_id).join(',')}); page errors ${errors.length}`, data);
  } catch (e) { claim('6 IMP-PRAYER-I1', false, 'threw ' + String(e.stack || e).slice(0, 300), data); }
  finally { await browser.close(); server.close(); }
}

for (const [n, fn] of [['1', claim1], ['2-4', claims234], ['5', claim5], ['6', claim6]]) {
  try { await fn(); } catch (e) { claim(n, false, 'threw ' + String(e.stack || e).slice(0, 400)); }
}
fs.writeFileSync(`${OUT}/prayer-claims-3.json`, JSON.stringify(res, null, 1));
console.log(`\n${Object.values(res).filter(r => r.ok).length} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
