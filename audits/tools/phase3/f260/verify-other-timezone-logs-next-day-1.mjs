// Skeptic #1 for F260 finding "other-timezone-logs-next-day": a phone in Europe/London ticks Done in the NY evening.
// Independent reproduction. Tap at 19:30 New York (00:30 Wed in London) — i.e. BEFORE the real 8 pm NY cron fires —
// then force the evening job (which uses the NY date), open F260 on the New York iPad, and then advance to Wed 08:40 NY.
//   node "audits/tools/phase3/f260/verify-other-timezone-logs-next-day-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
import { contextOptions } from '../../lib/devices.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVID = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'f260');
fs.mkdirSync(EVID, { recursive: true });
const PFX = 'verify-other-timezone-logs-next-day-1';
const SEL = ['#todayKind', '#todayDate', '#todayTitle', '#streak'];
const txt = (f) => f.evaluate(ss => Object.fromEntries(ss.map(s => { const e = document.querySelector(s); return [s, e ? e.textContent.replace(/\s+/g, ' ').trim() : null]; })), SEL);
const waitReady = async f => { await f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim(); }, null, { timeout: 15000 }); await sleep(400); };
const serverRows = async (L) => { const r = await L.apiAs('eli', '/api/data/f260?scope=person'); const o = {}; for (const it of (r.body.items || [])) o[it.key] = it.value; return o; };

const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const T = Date.parse('2026-09-22T19:30:00-04:00');   // 00:30 Wed 23 Sep in London
  await L.clock(new Date(T).toISOString());
  const before = await serverRows(L);
  out.logBefore = { '2026-09-22': !!(before['f260.log'] || {})['2026-09-22'], '2026-09-23': !!(before['f260.log'] || {})['2026-09-23'] };

  // New York iPad, signed in as Eli; copy its auth keys into a London-zone phone context
  const ny = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: T });
  await ny.goto('#home'); await sleep(1500);
  const auth = await ny.page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => /^hub\.(api|device|session|profiles|lastProfile)$/.test(k)).map(k => [k, localStorage.getItem(k)])));
  const ctx = await L.browser.newContext({ ...contextOptions('iphone-pwa', 'light'), timezoneId: 'Europe/London', serviceWorkers: 'block' });
  await ctx.route('https://house-hub-api.catalystfarm1.workers.dev/**', r => r.abort());
  await ctx.addInitScript(([ls, site]) => { if (location.origin === site && !localStorage.getItem('v.init')) { localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); localStorage.setItem('v.init', '1'); } }, [auth, L.site]);
  await ctx.clock.install({ time: new Date(T) });
  const page = await ctx.newPage();
  await page.goto(L.site + '/index.html#f260', { waitUntil: 'load' });
  let f; for (let i = 0; i < 150 && !f; i++) { f = page.frames().find(x => x.url().includes('/apps/f260.html')); if (!f) await sleep(100); }
  await waitReady(f);
  out.london = { tz: await f.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone), localNow: await f.evaluate(() => new Date().toString()), before: await txt(f) };
  await f.locator('#todayDone').tap(); await sleep(2500);
  out.london.after = await txt(f);
  await page.screenshot({ path: path.join(EVID, PFX + '-london-after-iphone.png'), scale: 'css' });
  const r1 = await serverRows(L);
  out.serverAfterTap = { log22: !!r1['f260.log']['2026-09-22'], log23: !!r1['f260.log']['2026-09-23'], summaryReadToday: r1['f260.summary'] && r1['f260.summary'].readToday };

  // the evening job (the real cron would fire at 20:00 NY, 30 min after the tap)
  await L.clock('2026-09-22T20:00:00-04:00');
  const ev = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'evening' } });
  const evj = [].concat(ev.body.results || ev.body).find(x => x && x.job === 'evening') || ev.body;
  out.eveningJob = { date: evj.date, eli: (evj.checked || []).find(c => c.profile === 'eli'), notifiedEli: JSON.stringify(evj.notified || []).includes('eli'), skippedEli: (evj.skipped || []).filter(s => JSON.stringify(s).includes('eli')) };

  // New York iPad opens F260 at 20:01 NY
  await ny.ctx.clock.runFor(31 * 60000);
  const g = await ny.openApp('f260'); await waitReady(g); await sleep(1500);
  out.newYorkTue = await txt(g);
  await ny.page.screenshot({ path: path.join(EVID, PFX + '-ny-tue-ipad.png'), scale: 'css' });
  await ctx.close(); await ny.close();

  // next NY morning, nothing read on Wed (NY)
  const W = Date.parse('2026-09-23T08:40:00-04:00');
  await L.clock(new Date(W).toISOString());
  const ny2 = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: W });
  const h = await ny2.openApp('f260'); await waitReady(h); await sleep(1200);
  out.newYorkWedMorning = await txt(h);
  await ny2.page.screenshot({ path: path.join(EVID, PFX + '-ny-wed-ipad.png'), scale: 'css' });
  await ny2.close();
} finally { await L.close(); }
fs.writeFileSync(path.join(EVID, PFX + '.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
