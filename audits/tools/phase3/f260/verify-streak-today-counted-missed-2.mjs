// Skeptic 2 for "streak-today-counted-missed": does an unread today use up one of the two rest days?
// Independent of logic.mjs: own log edits, three scenarios, a Home check on a second device, WebKit + a Chromium repeat.
//   node "audits/tools/phase3/f260/verify-streak-today-counted-missed-2.mjs"
// Scenarios (Eli, typical household, local rig only):
//   A  read Sat 19, rest Sun 20 + Mon 21, open Tue 22 08:40 (demo instant) before reading -> then tap Done
//   B  Mon-Fri reader: read Fri 18, rest Sat 19 + Sun 20, open Mon 21 08:40 before reading (every Monday morning)
//   C  control: read Sun 20, rest Mon 21 only, open Tue 22 08:40 before reading (one rest day)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'f260');
const P = 'verify-streak-today-counted-missed-2';
const SEL = ['#todayKind', '#todayStreak', '#heroKind', '#streak'];
const out = {};

async function rows(L, pid) { const r = await L.apiAs(pid, '/api/data/f260?scope=person'); const o = {}; for (const it of (r.body.items || [])) o[it.key] = it.value; return o; }
async function putLog(L, log) {
  const g = await L.apiAs('eli', '/api/data/f260?scope=person&key=__none__');
  return L.apiAs('eli', '/api/data/f260/f260.log?scope=person', { method: 'PUT', body: { value: log, updated_at: g.body.now } });
}
async function texts(f) { return f.evaluate(ss => Object.fromEntries(ss.map(s => { const e = document.querySelector(s); return [s, e ? e.textContent.replace(/\s+/g, ' ').trim() : null]; })), SEL); }
async function ready(f) { await f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim().length > 0; }, null, { timeout: 20000 }); await sleep(500); }
async function homeCard(d) { return d.page.evaluate(() => { const c = [...document.querySelectorAll('.gcard')].find(e => /Today's reading/.test(e.textContent)); return c ? c.innerText.replace(/\s+/g, ' ').trim() : null; }); }

async function scenario(L, name, { keep, drop, at, tapDone, shots }) {
  await L.reset('typical');
  const r = await rows(L, 'eli');
  const log = { ...(r['f260.log'] || {}) };
  for (const k of drop) delete log[k];
  for (const k of keep) log[k] = true;
  const pr = await putLog(L, log);
  const res = { putStatus: pr.status, logTail: Object.keys(log).filter(k => log[k]).sort().slice(-5) };
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: at });
  const f = await d.openApp('f260'); await ready(f);
  res.browserToday = await f.evaluate(() => new Date().toString());
  res.before = await texts(f);
  await sleep(1500);
  res.summaryBefore = (await rows(L, 'eli'))['f260.summary'];
  if (shots) await d.page.screenshot({ path: path.join(EVID, `${P}-${name}-before-iphone.png`), scale: 'css', animations: 'disabled' });
  // Home on a second device (the rig's Kitchen iPad) reads the summary F260 just wrote
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: at });
  await ipad.goto('#home'); await sleep(3000);
  res.homeBefore = await homeCard(ipad);
  if (tapDone) {
    await f.locator('#todayDone').tap(); await sleep(2000);
    res.after = await texts(f);
    res.summaryAfter = (await rows(L, 'eli'))['f260.summary'];
    if (shots) await d.page.screenshot({ path: path.join(EVID, `${P}-${name}-after-iphone.png`), scale: 'css', animations: 'disabled' });
  }
  await ipad.close(); await d.close();
  const brief = { logTail: res.logTail, before: [res.before['#todayKind'], res.before['#todayStreak'], 'hero ' + res.before['#streak'], 'summary.streak=' + (res.summaryBefore || {}).streak], home: res.homeBefore };
  if (tapDone) brief.after = [res.after['#todayKind'], res.after['#todayStreak'], 'summary.streak=' + (res.summaryAfter || {}).streak];
  console.log(name, JSON.stringify(brief));
  return res;
}

for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'demo', engine });
  try {
    const shots = engine === 'webkit';
    out[engine] = {
      A: await scenario(L, engine + '-A', { drop: ['2026-09-20', '2026-09-21', '2026-09-22'], keep: ['2026-09-19'], at: DEMO, tapDone: true, shots }),
      B: await scenario(L, engine + '-B', { drop: ['2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22'], keep: ['2026-09-18'], at: DEMO - 86400000, tapDone: false, shots }),
      C: await scenario(L, engine + '-C', { drop: ['2026-09-21', '2026-09-22'], keep: ['2026-09-20'], at: DEMO, tapDone: false, shots: false }),
    };
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(EVID, P + '.json'), JSON.stringify(out, null, 1));
console.log('wrote audits/evidence/p3/f260/' + P + '.json');
