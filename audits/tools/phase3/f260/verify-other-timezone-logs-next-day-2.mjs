// Skeptic #2 for "other-timezone-logs-next-day": does a phone in another zone file the F260 reading under its own date,
// and does the 8 pm (New York) nudge then fire for a reading that was done?
//  Case 1 (the claim): London phone taps Done at 20:30 NY (01:30 Wed London) — after the 20:00 scheduled evening job.
//  Case 2 (tightest real trigger): London phone taps Done at 19:30 NY (00:30 Wed London) — before the 20:00 job.
//  Each case: which log key is written, what the New York iPad's F260 Today says, what the evening job (run at 20:00 NY
//  via the admin force path, i.e. the same eveningJob the scheduled run calls) decides for Eli.
//   node "audits/tools/phase3/f260/verify-other-timezone-logs-next-day-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
import { contextOptions } from '../../lib/devices.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'f260');
fs.mkdirSync(EVID, { recursive: true });
const PFX = 'verify-other-timezone-logs-next-day-2';
const out = {};
const log = async (L, pid = 'eli') => { const r = await L.apiAs(pid, '/api/data/f260?scope=person'); const it = (r.body.items || []).find(i => i.key === 'f260.log'); return it ? it.value : {}; };
const ready = async f => { await f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim().length > 0; }, null, { timeout: 15000 }); await sleep(400); };
const txt = f => f.evaluate(() => ({ kind: (document.getElementById('todayKind') || {}).textContent, date: (document.getElementById('todayDate') || {}).textContent, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }));

async function run(tapIso, label) {
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
  const res = { tapAt: tapIso };
  try {
    const T = Date.parse(tapIso);
    await L.clock(new Date(T).toISOString());
    const before = await log(L);
    res.logBefore = { '2026-09-22': !!before['2026-09-22'], '2026-09-23': !!before['2026-09-23'] };
    const ny = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: T });
    await ny.goto('#home'); await sleep(1500);
    const ls = await ny.page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => /^hub\.(api|device|session|profiles|lastProfile)$/.test(k)).map(k => [k, localStorage.getItem(k)])));
    const ctx = await L.browser.newContext({ ...contextOptions('iphone-pwa', 'light'), timezoneId: 'Europe/London', serviceWorkers: 'block' });
    await ctx.route('https://house-hub-api.catalystfarm1.workers.dev/**', r => r.abort());
    await ctx.addInitScript(([ls, site]) => { if (location.origin === site && !localStorage.getItem('rig.init')) { localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); localStorage.setItem('rig.init', '1'); } }, [ls, L.site]);
    await ctx.clock.install({ time: new Date(T) });
    const page = await ctx.newPage();
    await page.goto(L.site + '/index.html#f260', { waitUntil: 'load' });
    let f; for (let i = 0; i < 100 && !f; i++) { f = page.frames().find(x => x.url().includes('/apps/f260.html')); if (!f) await sleep(100); }
    await ready(f);
    res.londonBefore = await txt(f);
    await f.locator('#todayDone').tap(); await sleep(2500);
    res.londonAfter = await txt(f);
    const after = await log(L);
    res.logAfter = { '2026-09-22': !!after['2026-09-22'], '2026-09-23': !!after['2026-09-23'] };
    await ctx.close();
    // the New York iPad opens F260 at 20:00 NY (or a minute after the tap if that is later)
    const T2 = Math.max(Date.parse('2026-09-22T20:00:00-04:00'), T + 60000);
    await ny.ctx.clock.runFor(T2 - T);
    const g = await ny.openApp('f260'); await ready(g); await sleep(800);
    res.newYorkIpadF260 = { at: new Date(T2).toISOString(), ...(await txt(g)) };
    await ny.page.screenshot({ path: path.join(EVID, `${PFX}-${label}-ny-ipad.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
    await ny.close();
    // the evening job as it would run at 20:00 NY
    await L.clock(new Date('2026-09-22T20:00:00-04:00').toISOString());
    const ev = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'evening' } });
    const b = ev.body; res.eveningJobAt2000 = { date: b.date, eli: (b.checked || []).find(c => c.profile === 'eli') };
    // and the next NY evening (Wed 23 Sep 20:00): does the misfiled key suppress Wednesday's nudge?
    await L.clock(new Date('2026-09-23T20:00:00-04:00').toISOString());
    const ev2 = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'evening' } });
    res.eveningJobWed2000 = { date: ev2.body.date, eli: (ev2.body.checked || []).find(c => c.profile === 'eli') };
  } finally { await L.close(); }
  console.log(label, JSON.stringify(res));
  return res;
}

out.case1_claim_2030NY = await run('2026-09-22T20:30:00-04:00', 'case1-2030');
out.case2_1930NY = await run('2026-09-22T19:30:00-04:00', 'case2-1930');
const f = path.join(EVID, PFX + '.json'); fs.writeFileSync(f, JSON.stringify(out, null, 1));
console.log('evidence →', path.relative(ROOT, f));
