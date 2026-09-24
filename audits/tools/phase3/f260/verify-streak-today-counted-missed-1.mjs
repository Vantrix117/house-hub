// Skeptic #1 for finding "streak-today-counted-missed": read Sat 19, rest Sun 20 + Mon 21, open Tue 22 before reading.
// Independent of the investigator's _lib.mjs. Local rig only (typical household, demo clock Tue 22 Sep 2026 08:40 NY).
//   node "audits/tools/phase3/f260/verify-streak-today-counted-missed-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVID = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'f260');
fs.mkdirSync(EVID, { recursive: true });
const P = 'verify-streak-today-counted-missed-1';
const SEL = ['#todayKind', '#todayStreak', '#heroKind', '#heroMeta', '#streak'];
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
const rowsOf = async pid => { const r = await L.apiAs(pid, '/api/data/f260?scope=person'); const o = {}; for (const it of r.body.items || []) o[it.key] = it.value; return o; };
const txt = f => f.evaluate(ss => Object.fromEntries(ss.map(s => { const e = document.querySelector(s); return [s, e ? e.textContent.replace(/\s+/g, ' ').trim() : null]; })), SEL);
const heroQuiet = f => f.evaluate(() => document.getElementById('hero').classList.contains('quiet'));
const homeCard = async d => { await d.goto('#home'); await sleep(2500); return d.page.evaluate(() => { const c = [...document.querySelectorAll('.gcard')].find(e => /reading/i.test(e.textContent)); return c ? c.innerText.replace(/\s+/g, ' ').trim() : null; }); };
const readyF = async f => { await f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim(); }, null, { timeout: 15000 }); await sleep(800); };
try {
  await L.reset('typical');
  const r = await rowsOf('eli');
  const log = { ...(r['f260.log'] || {}) };
  for (const k of ['2026-09-20', '2026-09-21', '2026-09-22']) delete log[k];
  log['2026-09-19'] = true;
  const g = await L.apiAs('eli', '/api/data/f260?scope=person&key=__none__');
  const put = await L.apiAs('eli', '/api/data/f260/f260.log?scope=person', { method: 'PUT', body: { value: log, updated_at: g.body.now } });
  out.put = put.status;
  out.logTail = Object.keys(log).filter(k => log[k]).sort().slice(-5);
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
  let f = await d.openApp('f260'); await readyF(f);
  out.browserToday = await f.evaluate(() => new Date().toString());
  out.before = { ui: await txt(f), heroQuiet: await heroQuiet(f), summaryStreak: (await rowsOf('eli'))['f260.summary'].streak };
  // pure-function probes of the app's own streakInfo (today = Tue 22 by the page clock)
  // the app's functions are not global: lift apps/f260.html:932-933 (dayKey, shiftDay) and 1385-1395 (streakInfo) verbatim
  const SRC = fs.readFileSync(path.resolve(HERE, '..', '..', '..', '..', 'apps', 'f260.html'), 'utf8').split(/\r?\n/);
  const lifted = SRC.slice(931, 933).join('\n') + '\n' + SRC.slice(1384, 1395).join('\n');
  out.liftedFirstLines = [SRC[931].slice(0, 40), SRC[1384].slice(0, 40), SRC[1394].slice(0, 60)];
  out.probe = await f.evaluate(lifted => {
    const streakInfo = new Function(lifted + '\nreturn streakInfo;')();
    const mk = ks => Object.fromEntries(ks.map(k => [k, true]));
    const base = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19'];
    const s = ks => { const i = streakInfo(mk(ks)); return { streak: i.streak, rest: [...i.restDays].sort() }; };
    return {
      'readSat_restSunMon_TueUnread': s(base),
      'readSat_restSunMon_TueRead': s([...base, '2026-09-22']),
      'readSun_restMon_TueUnread (1 rest day)': s([...base, '2026-09-20']),
    };
  }, lifted);
  await d.page.screenshot({ path: path.join(EVID, P + '-before-iphone.png'), scale: 'css', animations: 'disabled' });
  out.homeBefore = await homeCard(d);
  f = await d.openApp('f260'); await readyF(f);
  await f.locator('#todayDone').tap(); await sleep(2000);
  out.after = { ui: await txt(f), heroQuiet: await heroQuiet(f), summaryStreak: (await rowsOf('eli'))['f260.summary'].streak };
  await d.page.screenshot({ path: path.join(EVID, P + '-after-iphone.png'), scale: 'css', animations: 'disabled' });
  out.homeAfter = await homeCard(d);
  await d.close();
} catch (e) { out.error = String(e && e.stack || e); }
finally { await L.close(); }
fs.writeFileSync(path.join(EVID, P + '.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
