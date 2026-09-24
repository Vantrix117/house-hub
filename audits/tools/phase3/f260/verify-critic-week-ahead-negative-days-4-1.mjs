// Skeptic #1 for critic-week-ahead-negative-days-4: read a later week ahead on the plan list, finish the
// current week two days later on the plan list, then tap the plan's own "Start week 39" button (data-next).
// Independent path from the investigator's (who used Today "Done" + the hero's nextUp).
//   node "audits/tools/phase3/f260/verify-critic-week-ahead-negative-days-4-1.mjs"
// Eli on the typical seed (week 38), WebKit iPhone PWA, installClock at the demo time. Local instance only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'f260');
fs.mkdirSync(EVID, { recursive: true });
const P = 'verify-critic-week-ahead-negative-days-4-1';
const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const rows = async () => { const r = await L.apiAs('eli', '/api/data/f260?scope=person'); const o = {}; for (const it of (r.body.items || [])) o[it.key] = it.value; return o; };
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, as: ph });
  const f = await d.openApp('f260');
  const run = async ms => { await d.ctx.clock.runFor(ms); await sleep(200); };
  await run(3000);
  await f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim(); }, null, { timeout: 15000 });
  const tick = async id => { await f.evaluate(i => document.querySelector(`[data-day="${i}"] .mark`).scrollIntoView({ block: 'center' }), id); await f.locator(`[data-day="${id}"] .mark`).click(); await run(200); };
  const openWeek = w => f.evaluate(w => { const s = document.getElementById('week-' + w); if (!s.classList.contains('open')) s.querySelector('.wk-head').click(); }, w);
  const r0 = await rows();
  out.start = { browserDay: await f.evaluate(() => new Date().toString()), week: r0['f260.week'], weekStart38: r0['f260.weekStart']?.['38'], weekStart39: r0['f260.weekStart']?.['39'] ?? null,
    done38: await f.evaluate(() => [0,1,2,3,4].map(i => document.querySelector(`[data-day="38-${i}"]`).classList.contains('done'))) };
  // Day 1 (Tue): read ahead, tick all five of week 39 on the plan list
  await openWeek(39);
  for (let i = 0; i < 5; i++) await tick('39-' + i);
  await run(2500);
  const r1 = await rows();
  out.day1 = { week: r1['f260.week'], weekStart39: r1['f260.weekStart']?.['39'] ?? null, weekDone39: r1['f260.weekDone']?.['39'] ?? null,
    sumt39: await f.evaluate(() => document.querySelector('#week-39 .sumt')?.textContent ?? null) };
  // Day 3 (Thu): finish week 38 by ticking its remaining marks on the plan list, then tap the plan's "Start week 39"
  await d.ctx.clock.fastForward('48:00:00'); await run(2000);
  await openWeek(38);
  const rem = await f.evaluate(() => [0,1,2,3,4].map(i => '38-' + i).filter(id => !document.querySelector(`[data-day="${id}"]`).classList.contains('done')));
  for (const id of rem) await tick(id);
  await run(1000);
  out.day3 = { browserDay: await f.evaluate(() => new Date().toString()), ticked38: rem,
    startBtn: await f.evaluate(() => { const b = document.querySelector('#week-38 [data-next="39"]'); return b ? b.textContent : null; }) };
  await f.evaluate(() => document.querySelector('#week-38 [data-next="39"]').scrollIntoView({ block: 'center' }));
  await f.locator('#week-38 [data-next="39"]').click(); await run(2500);
  out.after = await f.evaluate(() => ({ head39: document.querySelector('#week-39 .wk-head .span').textContent,
    sumt39: document.querySelector('#week-39 .sumt')?.textContent ?? null,
    heroMeta: (document.getElementById('heroMeta') || {}).textContent || null }));
  const r2 = await rows();
  out.server = { week: r2['f260.week'], weekStart39: r2['f260.weekStart']?.['39'], weekDone39: r2['f260.weekDone']?.['39'], weekDone38: r2['f260.weekDone']?.['38'] };
  await f.evaluate(() => document.querySelector('#week-39').scrollIntoView({ block: 'start' }));
  await run(500);
  const png = path.join(EVID, P + '-iphone.png');
  await d.page.screenshot({ path: png, scale: 'css', animations: 'disabled', caret: 'hide' });
  out.shot = path.relative(ROOT, png).split(path.sep).join('/');
  await d.close();
} catch (e) { out.error = String(e && e.stack || e).slice(0, 800); }
finally { await L.close(); }
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(8), JSON.stringify(v));
fs.writeFileSync(path.join(EVID, P + '.json'), JSON.stringify(out, null, 1));
console.log('evidence → audits/evidence/p3/f260/' + P + '.json');
