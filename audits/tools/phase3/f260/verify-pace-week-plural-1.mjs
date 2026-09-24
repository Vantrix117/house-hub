// Skeptic #1 for finding "pace-week-plural": does the F260 hero pace line pair "2" with "week" (singular)?
// Local rig, typical household, demo clock. Rewrites only Eli's local f260.weekStart so the earliest start sits
// N days before the demo day, opens F260 on an iPhone, reads #heroPace and re-reads the rows the app used.
//   node "audits/tools/phase3/f260/verify-pace-week-plural-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVID = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'f260');
fs.mkdirSync(EVID, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = { cases: [] };
async function rows(pid) { const r = await L.apiAs(pid, '/api/data/f260?scope=person'); const o = {}; for (const it of r.body.items || []) o[it.key] = it.value; return o; }
try {
  await L.reset('typical');
  const r0 = await rows('eli');
  const n = Object.values(r0['f260.done'] || {}).filter(Boolean).length;
  out.readings = n;
  // target diffs (covered - elapsed, days): singular/plural boundary region and controls
  const targets = [-13.6, -12, -10.6, -10.2, -8, 8, 10.4, 10.8, 12.8, 14.6];
  for (const tgt of targets) {
    await L.reset('typical');
    const elapsed = Math.round(n * 7 / 5 - tgt);
    const start = new Date(Date.UTC(2026, 8, 22) - elapsed * 86400000).toISOString().slice(0, 10);
    const ws = {}; for (const [k, v] of Object.entries(r0['f260.weekStart'] || {})) if (v && v > start) ws[k] = v; ws['1'] = start;
    const g = await L.apiAs('eli', '/api/data/f260?scope=person&key=__none__');
    const p = await L.apiAs('eli', '/api/data/f260/' + encodeURIComponent('f260.weekStart') + '?scope=person', { method: 'PUT', body: { value: ws, updated_at: g.body.now } });
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
    const f = await d.openApp('f260');
    await f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim().length > 0; }, null, { timeout: 15000 });
    await sleep(500);
    const res = await f.evaluate(() => ({ hero: document.getElementById('heroPace').textContent, heroClass: document.getElementById('heroPace').className }));
    const r1 = await rows('eli');   // the rows the app used (it rewrites weekStart only if the current week has none)
    res.n = Object.values(r1['f260.done'] || {}).filter(Boolean).length;
    res.anchor = Object.values(r1['f260.weekStart'] || {}).filter(Boolean).sort()[0];
    res.today = '2026-09-22';
    res.elapsed = Math.round((Date.UTC(2026, 8, 22) - Date.parse(res.anchor + 'T00:00:00Z')) / 86400000);
    const diff = +(res.n * 7 / 5 - res.elapsed).toFixed(2);
    const m = /^(\d+) (weeks?) (ahead|behind)/.exec(res.hero || '');
    const bad = !!(m && ((+m[1] >= 2 && m[2] === 'week') || (+m[1] === 1 && m[2] === 'weeks')));
    const c = { target: tgt, putStatus: p.status, anchor: res.anchor, today: res.today, elapsed: res.elapsed, readings: res.n, diff, heroPace: res.hero, heroClass: res.heroClass, mismatch: bad };
    out.cases.push(c);
    console.log('diff', diff, 'readings', res.n, 'elapsed', res.elapsed, '->', JSON.stringify(res.hero), bad ? 'MISMATCH' : 'ok');
    if (bad && !out.shot) { await f.locator('#heroPace').scrollIntoViewIfNeeded(); await sleep(400); out.heroPaceVisible = await f.locator('#heroPace').isVisible(); const file = path.join(EVID, 'verify-pace-week-plural-1-iphone.png'); await d.page.screenshot({ path: file, scale: 'css', animations: 'disabled', caret: 'hide' }); out.shot = 'audits/evidence/p3/f260/verify-pace-week-plural-1-iphone.png'; }
    await d.close();
  }
  fs.writeFileSync(path.join(EVID, 'verify-pace-week-plural-1.json'), JSON.stringify(out, null, 1));
  console.log('mismatches', out.cases.filter(c => c.mismatch).length, 'of', out.cases.length);
} finally { await L.close(); }
