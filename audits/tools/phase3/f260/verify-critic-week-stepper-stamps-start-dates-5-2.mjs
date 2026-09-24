// Skeptic #2 for "critic-week-stepper-stamps-start-dates-5" (F260). Independent re-run on a fresh local instance.
// Lens: intent. The picker is labelled "Set current week" (apps/f260.html:616) and setCurrent stamps weekStart for any
// week without one (:1686). Checks:
//   S  stepper: + three times from week 38, then − three times; which weeks get a start stamp; what Today and the
//      server summary (Home card) show at the peek.
//   P  Week select: 38 → 45 → 38; does the select also stamp (only the target, or intermediates too)?
//   node "audits/tools/phase3/f260/verify-critic-week-stepper-stamps-start-dates-5-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'f260');
fs.mkdirSync(EVID, { recursive: true });
const NAME = 'verify-critic-week-stepper-stamps-start-dates-5-2';

const rowsOf = async (L) => { const r = await L.apiAs('eli', '/api/data/f260?scope=person'); const o = {}; for (const it of (r.body.items || [])) o[it.key] = it.value; return o; };
const ws = o => Object.fromEntries(Object.entries(o['f260.weekStart'] || {}).filter(([k]) => +k >= 38));
const ui = f => f.evaluate(() => { const t = s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
  return { todayTitle: t('#todayTitle'), todayMeta: t('#todayMeta'), heroMeta: t('#heroMeta'), curWeekLbl: t('#curWeekLbl'),
    pickLabel: document.querySelector('.wkpick')?.getAttribute('aria-label'), sel: document.getElementById('wkSel')?.value }; });

const out = {};
for (const mode of ['S', 'P']) {
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
  const o = out[mode] = {};
  try {
    const ph = await L.newDevice({ name: 'Eli phone v2', profiles: ['eli'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, as: ph });
    const f = await d.openApp('f260');
    const run = async ms => { await d.ctx.clock.runFor(ms); await sleep(200); };
    await run(3000);
    await f.waitForFunction(() => (document.getElementById('todayTitle')?.textContent || '').trim().length > 0, null, { timeout: 15000 });
    await run(500);
    const r0 = await rowsOf(L);
    o.before = { week: r0['f260.week'], summaryWeek: r0['f260.summary']?.week, summaryNext: r0['f260.summary']?.next, ws: ws(r0), ui: await ui(f) };
    if (mode === 'S') {
      await f.evaluate(() => document.getElementById('wkPlus').scrollIntoView({ block: 'center' }));
      for (let i = 0; i < 3; i++) { await f.locator('#wkPlus').click(); await run(300); }
      await run(2000);
      const r1 = await rowsOf(L);
      o.peek = { week: r1['f260.week'], summaryWeek: r1['f260.summary']?.week, summaryNext: r1['f260.summary']?.next, ws: ws(r1), ui: await ui(f) };
      await d.page.screenshot({ path: path.join(EVID, NAME + '-peek-iphone.png'), scale: 'css', animations: 'disabled' });
      await f.evaluate(() => document.getElementById('wkMinus').scrollIntoView({ block: 'center' }));
      for (let i = 0; i < 3; i++) { await f.locator('#wkMinus').click(); await run(300); }
    } else {
      await f.evaluate(() => document.getElementById('wkSel').scrollIntoView({ block: 'center' }));
      await f.selectOption('#wkSel', '45'); await run(2000);
      const r1 = await rowsOf(L);
      o.peek = { week: r1['f260.week'], summaryWeek: r1['f260.summary']?.week, ws: ws(r1), ui: await ui(f) };
      await f.selectOption('#wkSel', '38');
    }
    await run(2500);
    const r2 = await rowsOf(L);
    o.after = { week: r2['f260.week'], summaryWeek: r2['f260.summary']?.week, ws: ws(r2), ui: await ui(f) };
    await d.close();
  } catch (e) { o.error = String(e && e.stack || e).slice(0, 800); }
  finally { await L.close(); }
  for (const [k, v] of Object.entries(o)) console.log(mode, k.padEnd(7), JSON.stringify(v).slice(0, 700));
}
fs.writeFileSync(path.join(EVID, NAME + '.json'), JSON.stringify(out, null, 1));
console.log('evidence → audits/evidence/p3/f260/' + NAME + '.json');
