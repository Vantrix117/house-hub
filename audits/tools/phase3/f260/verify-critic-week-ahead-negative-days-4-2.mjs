// Skeptic #2 for critic-week-ahead-negative-days-4 (Phase 3, F260). Independent path from the investigator's:
// read ahead on the plan list (week 39, Tue 22 Sep), then two days later finish week 38 on the PLAN LIST marks
// (not the Today Done button) and start week 39 with week 38's own "Start week 39" button (data-next), not the hero.
// Reads the week-39 header, its .sumt, summaryCopy(39) (the Copy summary text) and the server rows.
//   node "audits/tools/phase3/f260/verify-critic-week-ahead-negative-days-4-2.mjs" [webkit|chromium]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits', 'evidence', 'p3', 'f260');
fs.mkdirSync(EV, { recursive: true });
const engine = process.argv[2] || 'webkit';
const TAG = 'verify-critic-week-ahead-negative-days-4-2-' + engine;
const out = { engine };
const rows = async (L) => { const r = await L.apiAs('eli', '/api/data/f260?scope=person'); const o = {}; for (const it of (r.body.items || [])) o[it.key] = it.value; return o; };

const L = await local({ variant: 'typical', clock: 'demo', engine });
try {
  const ph = await L.newDevice({ name: 'Eli phone (skeptic)', profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, as: ph });
  const f = await d.openApp('f260');
  const run = async ms => { await d.ctx.clock.runFor(ms); await sleep(200); };
  await run(3000);
  await f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim(); }, null, { timeout: 15000 });
  const tick = async id => { await f.evaluate(i => document.querySelector(`[data-day="${i}"] .mark`).scrollIntoView({ block: 'center' }), id); await f.locator(`[data-day="${id}"] .mark`).click(); await run(200); };
  const openWeek = async w => f.evaluate(w => { const s = document.getElementById('week-' + w); if (!s.classList.contains('open')) s.querySelector('.wk-head').click(); }, w);
  const r0 = await rows(L);
  out.start = { browserDay: await f.evaluate(() => new Date().toString()), week: r0['f260.week'], done38: Object.keys(r0['f260.done'] || {}).filter(k => k.startsWith('38-')), ws39: r0['f260.weekStart']?.['39'] ?? null, wd39: r0['f260.weekDone']?.['39'] ?? null };
  // Tue: read all of week 39 from the plan list
  await openWeek(39); for (let i = 0; i < 5; i++) await tick('39-' + i); await run(2000);
  const r1 = await rows(L);
  out.tue = { week: r1['f260.week'], ws39: r1['f260.weekStart']?.['39'] ?? null, wd39: r1['f260.weekDone']?.['39'] ?? null, sumt39: await f.evaluate(() => document.querySelector('#week-39 .sumt')?.textContent ?? null) };
  // Thu (+48 h): finish week 38 on the plan list, then tap week 38's "Start week 39"
  await d.ctx.clock.fastForward('48:00:00'); await run(2000);
  out.thuBrowserDay = await f.evaluate(() => new Date().toString());
  await openWeek(38);
  for (let i = 0; i < 5; i++) { const on = await f.evaluate(i => !!document.querySelector(`[data-day="38-${i}"]`)?.classList.contains('done'), i); if (!on) await tick('38-' + i); }
  await run(1500);
  out.startBtn = await f.evaluate(() => { const b = document.querySelector('#week-38 [data-next="39"]'); return b ? b.textContent : null; });
  await f.evaluate(() => document.querySelector('#week-38 [data-next="39"]').scrollIntoView({ block: 'center' }));
  await f.locator('#week-38 [data-next="39"]').click(); await run(2000);
  out.thu = await f.evaluate(() => ({
    head39: document.querySelector('#week-39 .wk-head .span').textContent,
    sumt39: document.querySelector('#week-39 .sumt')?.textContent ?? null,
    copy39: typeof summaryCopy === 'function' ? summaryCopy(39) : '(summaryCopy not global)',
    hero: [document.getElementById('heroKind')?.textContent, document.getElementById('heroTitle')?.textContent, document.getElementById('nextUp')?.textContent],
  }));
  const r2 = await rows(L);
  out.server = { week: r2['f260.week'], ws39: r2['f260.weekStart']?.['39'], wd39: r2['f260.weekDone']?.['39'], ws38: r2['f260.weekStart']?.['38'], wd38: r2['f260.weekDone']?.['38'] };
  await f.evaluate(() => document.querySelector('#week-39').scrollIntoView({ block: 'start' }));
  await run(600);
  const png = path.join(EV, TAG + '.png');
  await d.page.screenshot({ path: png, scale: 'css', animations: 'disabled', caret: 'hide' });
  out.shot = path.relative(ROOT, png).split(path.sep).join('/');
  await d.close();
} catch (e) { out.error = String(e && e.stack || e).slice(0, 800); }
finally { await L.close(); }
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(14), JSON.stringify(v));
fs.writeFileSync(path.join(EV, TAG + '.json'), JSON.stringify(out, null, 1));
console.log('evidence ->', 'audits/evidence/p3/f260/' + TAG + '.json');
