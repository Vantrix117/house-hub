// Skeptic #1 for critic-week-stepper-stamps-start-dates-5 (F260). Independent reproduction.
// Eli, typical seed (week 38, 2 of 5 read), WebKit iPhone PWA, controllable demo clock (Tue 22 Sep 2026 08:40 NY).
//   1  tap + once (a peek / mis-tap) → read Today card; tap − once → back on week 38; read server f260.weekStart
//   2  Thu 24 Sep: finish week 38 with Today "Done" ×3, tap the hero's "Start week 39", read the 'started' date;
//      tick all five week-39 readings the same day and read the week summary ("done in N days")
//   node "audits/tools/phase3/f260/verify-critic-week-stepper-stamps-start-dates-5-1.mjs"
import { local, sleep, DEMO, save, rows, texts, ready } from './_lib.mjs';

const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, as: ph });
  const f = await d.openApp('f260'); await d.ctx.clock.runFor(3000); await ready(f);
  const run = async ms => { await d.ctx.clock.runFor(ms); await sleep(200); };
  const ws = async () => { const r = await rows(L, 'eli'); return { week: r['f260.week'], summaryWeek: r['f260.summary']?.week, ws: Object.fromEntries(Object.entries(r['f260.weekStart'] || {}).filter(([k]) => +k >= 38)) }; };
  out.before = { server: await ws(), ui: await texts(f, ['#todayTitle', '#todayMeta', '#curWeekLbl', '#heroMeta']) };
  await f.evaluate(() => document.getElementById('wkPlus').scrollIntoView({ block: 'center' }));
  await f.locator('#wkPlus').click(); await run(2500);
  out.afterPlus = { server: await ws(), ui: await texts(f, ['#todayTitle', '#todayMeta', '#curWeekLbl', '#heroMeta']) };
  await f.evaluate(() => document.getElementById('wkMinus').scrollIntoView({ block: 'center' }));
  await f.locator('#wkMinus').click(); await run(2500);
  out.afterMinus = { server: await ws(), ui: await texts(f, ['#todayTitle', '#todayMeta', '#curWeekLbl']) };
  // Two days later he really reaches week 39
  await d.ctx.clock.fastForward('48:00:00'); await run(2000);
  out.thuDate = await f.evaluate(() => new Date().toString());
  for (let i = 0; i < 3; i++) { await f.locator('#todayDone').click(); await run(500); }
  out.hero38done = await texts(f, ['#heroKind', '#heroTitle', '#nextUp']);
  await f.evaluate(() => document.getElementById('nextUp').click()); await run(2000);
  out.started39 = { ui: await texts(f, ['#heroMeta', '#curWeekLbl']), head: await f.evaluate(() => document.querySelector('#week-39 .wk-head .span').textContent), server: await ws() };
  for (let i = 0; i < 5; i++) { await f.evaluate(id => document.querySelector(`[data-day="${id}"] .mark`).scrollIntoView({ block: 'center' }), '39-' + i); await f.locator(`[data-day="39-${i}"] .mark`).click(); await run(400); }
  await run(2000);
  const r = await rows(L, 'eli');
  out.done39 = { sumt: await f.evaluate(() => { const e = document.querySelector('#week-39 .sumt'); return e ? e.textContent : null; }), weekStart39: r['f260.weekStart']?.['39'], weekDone39: r['f260.weekDone']?.['39'] };
  await d.close();
} catch (e) { out.error = String(e && e.stack || e).slice(0, 800); }
finally { await L.close(); }
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(12), JSON.stringify(v));
console.log('evidence →', save('verify-critic-week-stepper-stamps-start-dates-5-1.json', out));
