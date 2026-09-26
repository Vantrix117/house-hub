// Batch 0b check for the build guide (UX-DOLLYWOOD-5, P3-DOLLYWOOD-01). data-checks.mjs arm M2 (pull aborted) now times
// out in its waitCount — the guide stays on "Loading your progress…" while the pull fails, which is the fix — so this
// replaces that arm and adds the migration-lands path. WebKit iPad portrait, typical seed (Eli: 24 ticks, "7 of 9").
//   fail  legacy key {"entrance-01":true} on the device; dollywood person GETs abort for 10 s. At ~3 s: forced tap on
//         Mark done + the D shortcut. Then the pull recovers. Expect: loading line, Mark done disabled, server 24 ticks
//         throughout, "7 of 9 done" after, nothing migrated over it.
//   empty the server row is cleared first (progress = null); legacy key present; normal pulls. Expect the migration to
//         land after a fresh pull and the guide to repaint without a reload ("1 of 9 done") via onChange(key null).
// clock 'real': the page runs on real time, so the server must too (on the demo clock both writes clamp to the same stamp).
// Run: node "audits/tools/phase6/0b/dollywood-first-load.mjs" -> audits/evidence/p6/0b/dollywood-first-load.json (+ PNGs)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p6/0b'; fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const PULL = /\/api\/data\/dollywood\?scope=person/;
const server = async () => { const r = await L.apiAs('eli', '/api/data/dollywood?scope=person&since=0'); const it = (r.body.items || []).find(i => i.key === 'progress'); const v = it && it.value; return v ? Object.keys(v).filter(k => v[k] === true).length : 0; };
const ui = f => f.evaluate(() => { const b = document.getElementById('b-done'); return { count: document.getElementById('b-count').textContent, busy: document.getElementById('build').getAttribute('aria-busy'),
  chip: document.querySelector('#chips [data-sec="entrance"] .cl').textContent.replace(/\s+/g, ' '), markDone: b && { disabled: b.disabled, aria: b.getAttribute('aria-disabled') }, sync: hub.sync.state }; });
const shot = (d, n) => d.page.screenshot({ path: `${OUT}/${n}`, scale: 'css', animations: 'disabled', caret: 'hide' });
const out = {};
try {
  // fail: the first pulls abort for 10 s
  await L.reset('typical');
  let o = out.fail = { serverBefore: await server() };
  let d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false, localStorage: { 'dollywood-build-progress-v2': JSON.stringify({ 'entrance-01': true }) } });
  const t0 = Date.now(); let aborted = 0;
  await d.ctx.route(PULL, r => { if (Date.now() - t0 < 10000) { aborted++; return r.abort('failed'); } r.continue().catch(() => {}); });
  let f = await d.openApp('dollywood', { wait: '#b-count' });
  await sleep(Math.max(0, 3000 - (Date.now() - t0)));
  o.loading = await ui(f); await shot(d, 'dollywood-first-load-fail.png');
  await f.locator('#b-done').click({ force: true, timeout: 2000 }).catch(() => {});
  await f.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true })));
  await sleep(800); o.afterTaps = await ui(f); o.serverAfterTaps = await server();
  await sleep(Math.max(0, 10500 - (Date.now() - t0))); await f.evaluate(() => hub.pull());
  await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 40000 });
  o.loadedAtMs = Date.now() - t0; o.loaded = await ui(f);
  await sleep(3000); await f.evaluate(() => hub.pull()); await sleep(2000);   // let hub.migrate's fresh pull run and decide
  o.final = await ui(f); o.serverFinal = await server(); o.aborted = aborted;
  o.migratedMark = await f.evaluate(() => JSON.parse(localStorage.getItem('hub.migrated') || '{}'));
  await shot(d, 'dollywood-first-load-fail-loaded.png');
  console.log('fail', JSON.stringify(o)); await d.close();

  // empty: nothing on the server, so the legacy tick migrates and the open guide repaints
  await L.reset('typical');
  await L.apiAs('eli', '/api/data/dollywood/batch?scope=person', { method: 'POST', body: { items: [{ key: 'progress', value: null, updated_at: Date.now() }] } });
  o = out.empty = { serverBefore: await server() };
  d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false, localStorage: { 'dollywood-build-progress-v2': JSON.stringify({ 'entrance-01': true }) } });
  f = await d.openApp('dollywood', { wait: '#b-count' });
  await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
  o.loaded = await ui(f);
  await f.waitForFunction(() => /^1 of/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 }).catch(() => {});
  await sleep(1500); o.afterMigrate = await ui(f); o.serverAfter = await server();
  console.log('empty', JSON.stringify(o)); await d.close();
} finally { fs.writeFileSync(`${OUT}/dollywood-first-load.json`, JSON.stringify(out, null, 1)); await L.close(); }
