// Skeptic #2 for "pace-week-plural": does the F260 hero pace line pair "2" with "week"?
// Independent of logic.mjs: fresh local rig (typical, demo clock, WebKit), Eli's own seeded readings, only the
// earliest f260.weekStart moved so the pace diff lands where we want. Then a sweep of paceInfo() inside the app.
//   node "audits/tools/phase3/f260/verify-pace-week-plural-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'f260'); fs.mkdirSync(EVID, { recursive: true });
const out = { cases: [], sweep: null };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const rows = async pid => { const r = await L.apiAs(pid, '/api/data/f260?scope=person'); const o = {}; for (const it of (r.body.items || [])) o[it.key] = it.value; return o; };
const put = async (pid, key, value) => { const g = await L.apiAs(pid, '/api/data/f260?scope=person&key=__none__');
  return L.apiAs(pid, `/api/data/f260/${encodeURIComponent(key)}?scope=person`, { method: 'PUT', body: { value, updated_at: g.body.now } }); };
try {
  // target diffs (days): -12.x and +12.x sit in the suspected 10.5..14 band; -9.x should read "1 week"; -15.x "2 weeks"
  const r0 = await rows('eli'); const n = Object.keys(r0['f260.done']).filter(k => r0['f260.done'][k]).length;
  const covered = n * 7 / 5;
  for (const target of [-12.5, 12.5, -13.5, -9.5, -15.5]) {
    await L.reset('typical');
    const r = await rows('eli');
    const elapsed = Math.round(covered - target);               // integer days since the earliest start
    const start = new Date(Date.UTC(2026, 8, 22) - elapsed * 86400000).toISOString().slice(0, 10);
    const ws = Object.fromEntries(Object.entries(r['f260.weekStart'] || {}).filter(([, v]) => v > start)); ws['1'] = start;
    await put('eli', 'f260.weekStart', ws);
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
    const f = await d.openApp('f260');
    await f.waitForFunction(() => (document.getElementById('heroPace') || {}).textContent, null, { timeout: 15000 }); await sleep(400);
    const hero = await f.evaluate(() => document.getElementById('heroPace').textContent.trim());
    const diff = +(covered - elapsed).toFixed(2);
    out.cases.push({ readings: n, start, elapsedDays: elapsed, diffDays: diff, heroPace: hero });
    console.log('case readings', n, 'start', start, 'elapsed', elapsed, 'diff', diff, '->', JSON.stringify(hero));
    if (target === -12.5) await d.page.screenshot({ path: path.join(EVID, 'verify-pace-week-plural-2-behind-iphone.png'), scale: 'css', animations: 'disabled' });
    if (target === -9.5) {
      // the app's lexical globals are not reachable from evaluate, so sweep the label branch copied verbatim from
      // apps/f260.html:1401-1406 over every 0.2-day diff in -16..16 (diff = readings*7/5 - elapsed is always a multiple of 0.2)
      const label = diff => { let l; if (Math.abs(diff) < 2) l = 'On pace';
        else if (diff >= 7) l = Math.round(diff / 7) + (diff >= 14 ? ' weeks ahead' : ' week ahead');
        else if (diff > 0) l = Math.round(diff) + ' days ahead';
        else if (diff <= -7) l = Math.round(-diff / 7) + (diff <= -14 ? ' weeks behind' : ' week behind');
        else l = Math.round(-diff) + ' days behind'; return l; };
      const all = []; for (let k = -80; k <= 80; k++) { const x = +(k * 0.2).toFixed(1); all.push({ diff: x, label: label(x) }); }
      const bad = all.filter(x => /^[2-9]d* week /.test(x.label));
      const lo = xs => Math.min(...xs), hi = xs => Math.max(...xs);
      const neg = bad.filter(x => x.diff < 0).map(x => x.diff), pos = bad.filter(x => x.diff > 0).map(x => x.diff);
      out.sweep = { wrongDiffs: bad.map(x => x.diff), ranges: { behind: [lo(neg), hi(neg)], ahead: [lo(pos), hi(pos)] }, oneWeekRange: [lo(all.filter(x => /^1 week/.test(x.label)).map(x => Math.abs(x.diff))), hi(all.filter(x => /^1 week/.test(x.label)).map(x => Math.abs(x.diff)))] };
      console.log('sweep: "2 week" labels for diffs', JSON.stringify(out.sweep.ranges), '; "1 week" for |diff| in', JSON.stringify(out.sweep.oneWeekRange));
    }
    await d.close();
  }
  fs.writeFileSync(path.join(EVID, 'verify-pace-week-plural-2.json'), JSON.stringify(out, null, 1));
  console.log('wrote audits/evidence/p3/f260/verify-pace-week-plural-2.json');
} finally { await L.close(); }
