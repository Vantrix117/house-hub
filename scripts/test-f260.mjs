#!/usr/bin/env node
// Roadmap 10 checks: F260 opens on Today.
//   - a cold open at 390×844 shows the Today hero with its Done button inside the viewport (standalone and in the hub's iframe)
//   - Done ticks the next reading through the plan's own path: f260.done, f260.log, the summary (weekDone, readToday, next)
//     and the hub's Home card / Apps tile follow within 5 s
//   - the plan/journal view is page state only: switch to Journal, reload, land on Plan + Today again, nothing persisted
//   - a change from another device merges in place: hub.pull() updates the DOM with no reload (a window marker survives),
//     and a deferred merge waits while the settings sheet is open, then lands
//   - the display profile gets a nudge, not a tick
//   - ticking weeks ahead of the current one never claims a finish: the hero and the summary keep offering the next gap
//   - reading mode (a persisted preference) still shows the Today hero: a cold open in it has Done above the fold
//   cd worker && npx wrangler dev --port 8787     (seeded local D1; reset it first for stable expectations)
//   node scripts/test-f260.mjs <pairing-code>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CODE = process.argv[2] || 'local-test-code';
const API = process.env.HUB_API || 'http://127.0.0.1:8787';
const SITE = 'http://localhost:8765';
const SHOTS = path.join(ROOT, 'docs', 'screens'); fs.mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const serve = (req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
};
let server;
for (let tries = 0; ; tries++) {                    // another suite may hold 8765 for a moment: wait for it (fresh server per attempt)
  try {
    server = await new Promise((resolve, reject) => { const s = http.createServer(serve); s.once('error', reject); s.listen(8765, () => resolve(s)); });
    break;
  } catch (e) { if (e.code !== 'EADDRINUSE' || tries >= 40) throw e; console.log('  … 8765 busy, waiting'); await new Promise(r => setTimeout(r, 1500)); }
}

let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, { timeout = 12000, every = 150, label = 'condition' } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { try { const v = await fn(); if (v) return v; } catch {} await sleep(every); }
  throw new Error('timeout waiting for ' + label);
}
const errors = [];
const watch = (page, name) => {
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource.*(401|403|404|409|429)/.test(m.text())) errors.push(name + ': ' + m.text()); });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
};
async function newContext(browser, name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: 'light' });
  await ctx.addInitScript(api => { try { localStorage.setItem('hub.api', JSON.stringify(api)); } catch {} }, API);
  const page = await ctx.newPage(); watch(page, name);
  await page.goto(SITE + '/index.html'); await page.waitForSelector('#paircode');
  await page.fill('#paircode', CODE); await page.click('#pairform button[type=submit]'); await page.waitForSelector('.pcard[data-id]');
  return { ctx, page };
}
async function signIn(page, id, pin) {
  const create = pin && /Create/.test(await page.$eval(`.pcard[data-id=${id}] .psub`, e => e.textContent));
  await page.click(`.pcard[data-id=${id}]`);
  if (pin) {
    await page.waitForSelector('#pad'); await sleep(450);
    const tap = async () => { for (const d of pin) await page.click(`#pad [data-d="${d}"]`); await page.click('#pingo'); };
    await tap();
    if (create) {
      await page.waitForFunction(() => /again/.test((document.getElementById('pinhint') || {}).textContent || ''), null, { timeout: 15000 }); await sleep(200); await tap();
      await page.waitForFunction(() => document.getElementById('gate').hidden || /Enter your PIN/.test((document.getElementById('pinhint') || {}).textContent || ''), null, { timeout: 15000 });
      if (await page.$('#gate:not([hidden]) #pad')) { await sleep(200); await tap(); }
    }
  }
  await page.waitForSelector('#shell:not([hidden])', { timeout: 15000 });
  await page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 });
}
const flushed = page => waitFor(() => page.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'flush' });
// the app's own view of things: what the Today hero shows and what it published
const todayState = f => f.evaluate(() => ({
  title: document.getElementById('todayTitle').textContent, kind: document.getElementById('todayKind').textContent,
  meta: document.getElementById('todayMeta').textContent, ring: document.getElementById('todayRingN').textContent,
  plan: document.getElementById('planView').style.display !== 'none', journal: document.getElementById('journalView').classList.contains('on'),
  summary: hub.get('f260.summary'), done: hub.get('f260.done') || {}, log: hub.get('f260.log') || {}, view: hub.get('f260.view'),
  today: (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })()
}));
async function openF260(page) {
  await page.click('.tab[data-tab=apps]'); await page.waitForSelector('.tile[data-id=f260]'); await page.click('.tile[data-id=f260]');
  const f = await waitFor(() => page.frame({ url: /apps\/f260/ }), { label: 'f260 frame' });
  await f.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.getElementById('todayTitle').textContent !== '', null, { timeout: 20000 });
  return f;
}
async function doneBox(page, f) {                    // the Done button's box in the page's own viewport (Playwright reports iframe elements that way)
  const h = await f.$('#todayDone'); const box = await h.boundingBox(); const vp = page.viewportSize();
  return { box, inside: !!box && box.y >= 0 && box.x >= 0 && box.y + box.height <= vp.height && box.x + box.width <= vp.width, scrollY: await f.evaluate(() => window.scrollY) };
}

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    console.log('\n## cold open lands on Today (390×844)');
    const A = await newContext(browser, 'A');
    await signIn(A.page, 'eli', '1357');
    // standalone: the app page on its own, fresh navigation, no scrolling
    await A.page.goto(SITE + '/apps/f260.html');
    await A.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.getElementById('todayTitle').textContent !== '', null, { timeout: 20000 });
    await sleep(300);
    let d = await doneBox(A.page, A.page.mainFrame());
    ok(d.inside && d.scrollY === 0, `standalone: Done button inside the viewport without scrolling (y ${d.box && Math.round(d.box.y)}–${d.box && Math.round(d.box.y + d.box.height)} of 844)`, JSON.stringify(d));
    ok(d.box && d.box.height >= 60, `Done button is ${d.box && Math.round(d.box.height)} px tall (≥ 60)`);
    let s = await todayState(A.page.mainFrame());
    const first = s.summary && s.summary.next ? s.summary.next.ref : null;
    ok(s.plan && !s.journal, 'plan view is showing');
    ok(first && s.title === first, `hero shows the same next reading as the summary (${s.title})`, JSON.stringify(s.summary));
    ok(/Week \d+ · Day \d+ · \d+ chapters? · ~\d+ min/.test(s.meta), `meta has week/day/chapters/minutes (${s.meta})`);
    ok(s.ring === s.summary.weekDone + '/5', `ring shows this week ${s.ring}`);
    ok(await A.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll at 390');
    ok(await A.page.evaluate(() => { const t = document.getElementById('today'), side = document.querySelector('.side'); return t.getBoundingClientRect().bottom <= side.getBoundingClientRect().top + 1; }), 'the dashboards sit below the hero');
    await A.page.screenshot({ path: path.join(SHOTS, 'rm10-today-390.png') });
    // inside the hub's iframe, the way the family opens it
    await A.page.goto(SITE + '/index.html'); await A.page.waitForSelector('#shell:not([hidden])');
    await A.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 });
    let fa = await openF260(A.page); await sleep(400);
    d = await doneBox(A.page, fa);
    ok(d.inside && d.scrollY === 0, `in the hub iframe: Done button inside the 390×844 viewport (y ${d.box && Math.round(d.box.y)}–${d.box && Math.round(d.box.y + d.box.height)})`, JSON.stringify(d));
    await A.page.screenshot({ path: path.join(SHOTS, 'rm10-today-shell-390.png') });

    console.log('\n## Done ticks the reading and the hub follows');
    const before = await todayState(fa);
    const [w0, d0] = [before.summary.next.week, before.summary.next.day];
    await fa.click('#todayDone'); await sleep(300);
    s = await todayState(fa);
    ok(s.done[w0 + '-' + (d0 - 1)] === true, `f260.done has ${w0}-${d0 - 1}`);
    ok(s.log[s.today] === true, 'f260.log has today');
    ok(s.summary.weekDone === before.summary.weekDone + 1 && s.summary.readToday === true, `summary weekDone ${before.summary.weekDone} → ${s.summary.weekDone}, readToday`, JSON.stringify(s.summary));
    ok(s.summary.next && s.summary.next.ref !== before.summary.next.ref && s.title === s.summary.next.ref, `hero moved on to ${s.title}`);
    ok(s.kind === 'Read today ✓' && s.ring === s.summary.weekDone + '/5', `kicker "${s.kind}", ring ${s.ring}`);
    ok(await fa.evaluate(id => document.querySelector('[data-day="' + id + '"]').classList.contains('done') && document.querySelector('[data-day="' + id + '"] .mark').getAttribute('aria-pressed') === 'true', w0 + '-' + (d0 - 1)), 'the plan row is ticked too (same path as its .mark)');
    ok(!(await fa.$eval('#todayUndo', b => b.hidden)), 'Undo is offered');
    const t0 = Date.now();
    await A.page.click('#pill-home'); await A.page.click('.tab[data-tab=home]');
    await waitFor(() => A.page.evaluate(ref => { const g = document.querySelector('#view-home .gcard .gbig'), sub = document.querySelector('#view-home .gcard .gsub'); return g && g.textContent === ref && sub && /read today/.test(sub.textContent); }, s.summary.next.ref), { timeout: 5000, label: 'home card' });
    ok(true, `Home card shows "${s.summary.next.ref}" and "read today" within ${Date.now() - t0} ms`);
    await A.page.click('.tab[data-tab=apps]');
    await waitFor(() => A.page.evaluate(n => { const t = document.querySelector('.tile[data-id=f260] .ring-lbl'); return t && t.textContent === n; }, s.summary.weekDone + '/5'), { timeout: 5000, label: 'tile ring' });
    ok(true, `Apps tile ring shows ${s.summary.weekDone}/5`);
    ok(await A.page.evaluate(() => hub.list('', { app: 'f260', scope: 'person' }).length > 0), 'shell sees the f260 rows');
    await A.page.screenshot({ path: path.join(SHOTS, 'rm10-tile-390.png') });
    await A.page.click('.tab[data-tab=home]'); await sleep(600); await A.page.screenshot({ path: path.join(SHOTS, 'rm10-home-390.png') });

    console.log('\n## the view is not persisted');
    fa = await openF260(A.page);
    await fa.click('#tabJournal'); await sleep(300);
    s = await todayState(fa);
    ok(s.journal && !s.plan, 'Journal tab shows the journal view');
    if (await fa.$('#pass.on')) await fa.click('#passCancel');
    ok(s.view === undefined, 'f260.view is not written to the hub', JSON.stringify(s.view));
    await flushed(fa);
    await fa.evaluate(() => { window.__old = 1; });
    await A.page.click('#pill-reload');
    fa = await waitFor(() => A.page.frame({ url: /apps\/f260/ }), { label: 'reloaded frame' });
    await waitFor(() => fa.evaluate(() => window.__old === undefined && !!window.hub), { label: 'fresh document' });
    await fa.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.getElementById('todayTitle').textContent !== '', null, { timeout: 20000 });
    s = await todayState(fa);
    ok(s.plan && !s.journal && s.title === s.summary.next.ref, 'after a reload the app is back on Plan with Today at the top');
    ok(await fa.evaluate(() => document.getElementById('todayUndo').hidden), 'Undo is gone after a reload (page state only)');
    ok(await A.page.evaluate(() => hub.get('f260.view', { app: 'f260', scope: 'person' }) === undefined), 'no f260.view row after the reload either');

    console.log('\n## a change from another device merges in place');
    const B = await newContext(browser, 'B');
    await signIn(B.page, 'eli', '1357');
    await B.page.goto(SITE + '/apps/f260.html');
    await B.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.getElementById('todayTitle').textContent !== '', null, { timeout: 20000 });
    const sb = await todayState(B.page.mainFrame());
    ok(sb.title === s.title && sb.ring === s.ring, `B opens on the same Today (${sb.title}, ${sb.ring})`);
    const nb = sb.summary.next; const idB = nb.week + '-' + (nb.day - 1);
    await B.page.click('[data-day="' + idB + '"] .mark'); await sleep(200);
    await flushed(B.page);
    // A: plant a marker, pull, and expect the DOM to follow without the page going away
    await fa.evaluate(() => { window.__rm10 = 'still here'; });
    await fa.evaluate(() => hub.pull());
    await waitFor(() => fa.evaluate(id => document.querySelector('[data-day="' + id + '"]').classList.contains('done'), idB), { timeout: 6000, label: 'A merges B tick' });
    s = await todayState(fa);
    ok(await fa.evaluate(() => window.__rm10 === 'still here'), 'no reload: the window marker survived the merge');
    ok(s.done[idB] === true && s.title === s.summary.next.ref && s.title !== nb.ref, `A's hero moved on to ${s.title} after the merge`);
    ok(s.ring === s.summary.weekDone + '/5' && s.summary.weekDone === sb.summary.weekDone + 1, `A's ring now ${s.ring}`);
    ok(await fa.evaluate(() => document.getElementById('doneCount').textContent === String(Object.keys(hub.get('f260.done') || {}).length)), 'A: readings count re-rendered from the merged data');
    // deferred while busy: with the settings sheet open the merge waits, then lands once it closes
    await fa.click('#settingsBtn'); await sleep(100);
    const n2 = s.summary.next; const idB2 = n2.week + '-' + (n2.day - 1);
    await B.page.evaluate(() => hub.pull()); await sleep(300);
    await B.page.click('[data-day="' + idB2 + '"] .mark'); await sleep(200); await flushed(B.page);
    await fa.evaluate(() => hub.pull()); await sleep(1500);
    const sheetOpen = await fa.evaluate(id => document.getElementById('sheet').classList.contains('on') && !document.querySelector('[data-day="' + id + '"]').classList.contains('done') && hub.get('f260.done')[id] === true, idB2);
    ok(sheetOpen, 'with the settings sheet open the merge is deferred (data is in, DOM untouched)');
    await fa.click('#settingsBtn');
    await waitFor(() => fa.evaluate(id => document.querySelector('[data-day="' + id + '"]').classList.contains('done'), idB2), { timeout: 8000, label: 'deferred merge lands' });
    ok(await fa.evaluate(() => window.__rm10 === 'still here'), 'deferred merge landed after the sheet closed, still no reload');
    s = await todayState(fa);
    ok(s.title === s.summary.next.ref && s.ring === s.summary.weekDone + '/5', `hero and ring follow (${s.title}, ${s.ring})`);
    await B.ctx.close();

    console.log('\n## the display profile only looks');
    const C = await newContext(browser, 'C');
    await signIn(C.page, 'tv');
    await C.page.goto(SITE + '/apps/f260.html');
    await C.page.waitForFunction(() => window.hub && hub.profile && hub.sync && (hub.sync.lastPull > 0 || hub.sync.state === 'offline') && document.getElementById('todayTitle').textContent !== '', null, { timeout: 15000 });
    const kb = await todayState(C.page.mainFrame());
    await C.page.click('#todayDone', { force: true }); await sleep(300);   // aria-disabled: Playwright would wait for it to enable
    const kk = await todayState(C.page.mainFrame());
    ok(kk.title === kb.title && JSON.stringify(kk.done) === JSON.stringify(kb.done), 'Done does nothing for the display profile');
    ok(await C.page.evaluate(() => /only looks/.test((document.getElementById('hub-toast') || {}).textContent || '') && document.getElementById('todayDone').getAttribute('aria-disabled') === 'true'), 'it gets the "only looks" toast; the button reads as disabled');
    await C.ctx.close();

    console.log('\n## desktop (1440) still lays out: hero spans both panes, dashboards + weeks below');
    const D = await newContext(browser, 'D'); await D.page.setViewportSize({ width: 1440, height: 900 });
    await signIn(D.page, 'eli', '1357');
    await D.page.goto(SITE + '/apps/f260.html');
    await D.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.getElementById('todayTitle').textContent !== '', null, { timeout: 20000 });
    await sleep(800);
    const dl = await D.page.evaluate(() => { const t = document.getElementById('today').getBoundingClientRect(), side = document.querySelector('.side').getBoundingClientRect(), wk = document.getElementById('weeks').getBoundingClientRect(), b = document.getElementById('todayDone').getBoundingClientRect(); return { spans: t.width > side.width + wk.width - 4, below: side.top >= t.bottom - 1 && wk.top >= t.bottom - 1, btn: Math.round(b.height), inside: b.bottom <= 900, hs: document.documentElement.scrollWidth <= window.innerWidth + 1 }; });
    ok(dl.spans && dl.below, 'hero spans the two panes and both sit below it', JSON.stringify(dl));
    ok(dl.btn >= 60 && dl.inside && dl.hs, `Done ${dl.btn} px tall, in view, no horizontal scroll`);
    await D.page.screenshot({ path: path.join(SHOTS, 'rm10-today-1440.png') });
    await D.ctx.close();

    console.log('\n## ticking ahead never claims a finish');
    const E = await newContext(browser, 'E');
    await signIn(E.page, 'eli', '1357');
    await E.page.goto(SITE + '/apps/f260.html');
    await E.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.getElementById('todayTitle').textContent !== '', null, { timeout: 20000 });
    const e0 = await todayState(E.page.mainFrame()); const cw = e0.summary.week;
    // tick every reading of the current week and the two after it straight from the plan (curWeek stays put)
    await E.page.evaluate(cw => { for (let w = cw; w <= cw + 2; w++) for (let i = 0; i < 5; i++) { const day = document.querySelector('[data-day="' + w + '-' + i + '"]'); if (day && !day.classList.contains('done')) day.querySelector('.mark').click(); } }, cw);
    await sleep(500);
    s = await todayState(E.page.mainFrame());
    const ahead = await E.page.evaluate(() => ({ week: hub.get('f260.week', { default: 1 }), hidden: document.getElementById('todayDone').hidden, total: document.getElementById('doneCount').textContent }));
    ok(ahead.week === cw && s.summary.total < 260, `weeks ${cw}–${cw + 2} ticked from the plan, current week still ${ahead.week}, ${ahead.total} of 260`);
    ok(s.summary.next && s.summary.next.week === cw + 3 && s.summary.next.day === 1, `summary.next is week ${cw + 3} day 1, not null`, JSON.stringify(s.summary.next));
    ok(s.title === s.summary.next.ref && !/complete/i.test(s.title) && !ahead.hidden, `hero offers ${s.title} with Done showing (no false finish)`, s.title);
    ok(new RegExp('starts week ' + (cw + 3)).test(s.meta), `meta says it starts week ${cw + 3} (${s.meta})`);
    ok(s.summary.finished === false, 'summary.finished stays false');
    await E.page.click('#todayDone'); await sleep(300);
    s = await todayState(E.page.mainFrame());
    ok(s.done[(cw + 3) + '-0'] === true && (await E.page.evaluate(() => hub.get('f260.week'))) === cw + 3, `Done ticks ${cw + 3}-0 and starts week ${cw + 3}`);
    ok(s.summary.next && s.summary.next.week === cw + 3 && s.summary.next.day === 2 && s.title === s.summary.next.ref, `hero moves to week ${cw + 3} day 2`);
    // a gap left behind in an earlier week is offered as a catch-up once everything ahead is ticked
    await E.page.evaluate(cw => { document.querySelector('[data-day="' + cw + '-2"] .mark').click(); }, cw); await sleep(300);
    s = await todayState(E.page.mainFrame());
    ok(s.summary.next.week === cw + 3 && s.summary.next.day === 2, 'a gap behind does not jump the queue while there is a reading ahead');
    await E.page.screenshot({ path: path.join(SHOTS, 'rm10-ahead-390.png') });
    await flushed(E.page.mainFrame());

    console.log('\n## reading mode still opens on Today');
    await E.page.click('#readBtn'); await sleep(300); await flushed(E.page.mainFrame());
    ok(await E.page.evaluate(() => hub.get('f260.read') === true && document.getElementById('planView').classList.contains('readmode')), 'reading mode is on and persisted');
    await E.page.goto(SITE + '/apps/f260.html');
    await E.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.getElementById('todayTitle').textContent !== '', null, { timeout: 20000 });
    await sleep(300);
    d = await doneBox(E.page, E.page.mainFrame());
    const rm = await E.page.evaluate(() => ({ readmode: document.getElementById('planView').classList.contains('readmode'), display: getComputedStyle(document.getElementById('today')).display, readbar: getComputedStyle(document.getElementById('readbar')).display }));
    ok(rm.readmode && rm.readbar === 'flex', 'cold open comes up in reading mode (readbar showing)', JSON.stringify(rm));
    ok(rm.display !== 'none' && d.inside && d.scrollY === 0, `reading mode: Done button inside the 390×844 viewport without scrolling (y ${d.box && Math.round(d.box.y)}–${d.box && Math.round(d.box.y + d.box.height)})`, JSON.stringify({ rm, d }));
    ok(await E.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'reading mode: no horizontal scroll at 390');
    const rb = await todayState(E.page.mainFrame());
    await E.page.click('#todayDone'); await sleep(300);
    s = await todayState(E.page.mainFrame());
    ok(s.summary.weekDone === rb.summary.weekDone + 1 && s.title !== rb.title, `Done works in reading mode (${rb.title} → ${s.title})`);
    await E.page.screenshot({ path: path.join(SHOTS, 'rm10-readmode-390.png') });
    await E.page.click('#readExit'); await sleep(300); await flushed(E.page.mainFrame());
    ok(await E.page.evaluate(() => hub.get('f260.read') === false), 'reading mode off again');
    await E.ctx.close();

    await A.ctx.close();
    ok(errors.length === 0, 'no console/page errors', errors.slice(0, 5).join(' | '));
  } finally { await browser.close(); server.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
