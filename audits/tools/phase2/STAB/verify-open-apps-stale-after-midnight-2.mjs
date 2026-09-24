// Skeptic #2 for finding "open-apps-stale-after-midnight": F260 and Kid Verse left open across midnight keep yesterday's
// "today" on screen. Independent of midnight.mjs (own clock driving, own reads) and adds three adversarial checks:
//   A. Tue 22 → Wed 23 Sep 2026 (a reading day): Mom with F260 open, Ezra with Kid Verse open (Ezra has Tuesday's ★).
//      Read before (23:59:40) and after 3 minutes past midnight with ~6 real 30 s pulls in between.
//   B. Is it only display? Ezra taps Done ★ on the stale screen after midnight → which day does the server record?
//   C. Does it self-heal on any remote change? An unrelated harmless row is written in F260's own person scope (as Mom)
//      from outside; after the next pull F260 should re-render with the new day (hub.onChange → mergeRemote → render).
//   D. Sun 27 → Mon 28 (new ISO week): Ezra's Kid Verse — does the "mine" card disagree with the rewards card, which
//      reconcile() repaints after every pull?
//   node "audits/tools/phase2/STAB/verify-open-apps-stale-after-midnight-2.mjs"
// Output: audits/evidence/p2/STAB/verify-open-apps-stale-2.json + verify-open-apps-stale-2-*.png
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const R = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });

// ── own clock driver: 10 s slices of page time, then wait for the page's real requests to finish ──
const inflight = new WeakMap();
function trackReq(d) {
  if (inflight.has(d)) return; const T = { n: 0 }; inflight.set(d, T);
  d.page.on('request', () => T.n++); d.page.on('requestfinished', () => T.n--); d.page.on('requestfailed', () => T.n--);
}
async function quiet(d) { const T = inflight.get(d); const until = Date.now() + 3000; let q = 0; await sleep(40); while (Date.now() < until) { if (T.n <= 0) { if (++q >= 6) return; } else q = 0; await sleep(15); } }
async function run(d, ms) { trackReq(d); for (let t = 0; t < ms; t += 10000) { await d.ctx.clock.runFor(Math.min(10000, ms - t)); await quiet(d); } }
const shot = (d, name) => d.page.screenshot({ path: path.join(OUT, `verify-open-apps-stale-2-${name}.png`), scale: 'css', animations: 'disabled', caret: 'hide' });

const readF260 = d => d.frame('f260').evaluate(() => ({ pageNow: new Date().toString().slice(0, 21), todayKind: document.getElementById('todayKind').innerText, todayDate: document.getElementById('todayDate').innerText, readClass: document.getElementById('today').classList.contains('read') }));
const readKV = d => d.frame('kidverse').evaluate(() => {
  const t = s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; };
  return { pageNow: new Date().toString().slice(0, 21), doneLabel: t('#done span'), donePressed: document.querySelector('#done').getAttribute('aria-pressed'),
    mine: t('#mine .sub'), rewardsWeek: t('#rw-week'), rewardsTotal: t('#rw-total'),
    days: [...document.querySelectorAll('#mine .days span')].map(s => (s.classList.contains('today') ? '[' : '') + (s.classList.contains('on') ? '*' : s.textContent) + (s.classList.contains('today') ? ']' : '')).join(' ') };
});
async function openOn(profile, app, start) {
  const d = await L.device({ device: 'ipad-portrait', profile, installClock: start });
  await d.goto('#home'); await d.page.waitForSelector('#view-home .hero-title', { timeout: 15000 });
  await d.openApp(app); await run(d, 20000); return d;
}

try {
  // ── A: Tuesday night ──
  await L.clock('2026-09-22T23:58:00-04:00'); await L.reset('typical');
  const start = Date.parse('2026-09-22T23:59:20-04:00');
  const mom = await openOn('mom', 'f260', start), ezra = await openOn('ezra', 'kidverse', start);
  R.A = { f260: { before: await readF260(mom) }, kidverse: { before: await readKV(ezra) } };
  await L.clock('2026-09-23T00:00:10-04:00');
  await run(mom, 180000); await run(ezra, 180000);
  R.A.f260.after = await readF260(mom); R.A.kidverse.after = await readKV(ezra);
  R.A.pullsSeen = { mom: await mom.hub(mom.frame('f260')).then(h => h.sync && h.sync.lastPull), ezra: await ezra.hub(ezra.frame('kidverse')).then(h => h.sync && h.sync.lastPull) };
  await shot(mom, 'A-f260-wed-0003'); await shot(ezra, 'A-kidverse-wed-0003');

  // ── B: Ezra taps Done ★ on the stale "Done today ★" screen ──
  await L.clock('2026-09-23T00:03:30-04:00');
  const kf = ezra.frame('kidverse');
  await kf.click('#done'); await ezra.ctx.clock.runFor(2000); await quiet(ezra); await run(ezra, 10000);
  const items = (await L.apiAs('ezra', '/api/data/kidverse?scope=person')).body.items || [];
  const st = (items.find(r => r.key === 'stars') || {}).value;
  R.B = { afterTap: await readKV(ezra), serverDays: st && st.days ? Object.keys(st.days).filter(k => st.days[k] === true).sort().slice(-4) : st, serverCount: st && st.count };
  await shot(ezra, 'B-kidverse-after-tap');

  // ── C: an unrelated remote write in F260's person scope — does F260 repaint to Wednesday? ──
  const at = Date.parse('2026-09-23T00:04:00-04:00');
  await L.clock('2026-09-23T00:04:00-04:00');
  const put = await L.apiAs('mom', '/api/data/f260/audit.ping?scope=person', { method: 'PUT', body: { value: { n: 1 }, updated_at: at } });
  R.C = { put: put.status, putBody: put.body };
  await run(mom, 40000);
  R.C.f260AfterRemoteChange = await readF260(mom);
  await mom.close(); await ezra.close();

  // ── D: Sunday night, a new ISO week ──
  await L.clock('2026-09-27T23:58:00-04:00'); await L.reset('typical');
  const start2 = Date.parse('2026-09-27T23:59:20-04:00');
  const ez2 = await openOn('ezra', 'kidverse', start2);
  R.D = { before: await readKV(ez2) };
  await L.clock('2026-09-28T00:00:10-04:00');
  await run(ez2, 180000);
  R.D.after = await readKV(ez2);
  await shot(ez2, 'D-kidverse-mon-0003');

  for (const [k, v] of Object.entries(R)) console.log(k, JSON.stringify(v, null, 1));
  fs.writeFileSync(path.join(OUT, 'verify-open-apps-stale-2.json'), JSON.stringify(R, null, 1));
} finally { await L.close(); }
