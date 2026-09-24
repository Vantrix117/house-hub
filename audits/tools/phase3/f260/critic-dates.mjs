// Completeness critic (Phase 3, F260): three date-bookkeeping checks the report does not cover.
//   A  tapping into an old HEAR entry and away (no typing) re-stamps its date and adds a journal day
//      (focusout → saveJournal → j.t = Date.now(), apps/f260.html:1864-1868, 1828, 1818)
//   B  a week read ahead from the plan list, then started with "Start week", reads "done in -N days"
//      (weekDone set at completion, weekStart set later by setCurrent; summaryText, apps/f260.html:1327-1329, 1670, 1686)
//   C  the week stepper (− / +) beside "Jump to current week" moves the current week and stamps a start date on every
//      week it passes; the Today card follows it (apps/f260.html:617-621, 1684-1689, 1707-1708, 1480-1481)
//   node "audits/tools/phase3/f260/critic-dates.mjs" [A|B|C]      (default: all)
// Eli on the typical seed (week 38, 2 of 5 read). Throwaway passcode on the local demo database only.
import { local, sleep, DEMO, save, shot, rows, texts, ready } from './_lib.mjs';

const PASS = '2468';
const modes = process.argv[2] ? [process.argv[2]] : ['A', 'B', 'C'];
const out = {};
const tick = async (f, id) => { await f.evaluate(i => { const m = document.querySelector(`[data-day="${i}"] .mark`); m.scrollIntoView({ block: 'center' }); }, id); await f.locator(`[data-day="${id}"] .mark`).click(); await sleep(150); };

for (const mode of modes) {
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
  const o = out[mode] = {};
  try {
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, as: ph });
    const f = await d.openApp('f260'); await d.ctx.clock.runFor(3000); await ready(f);
    const run = async ms => { await d.ctx.clock.runFor(ms); await sleep(200); };
    if (mode === 'A') {
      await f.evaluate(() => document.querySelector('[data-jr="38-0"]').scrollIntoView({ block: 'center' }));
      await f.locator('[data-jr="38-0"]').click(); await run(500);
      await f.waitForSelector('#pass.on'); await f.fill('#pass1', PASS); await f.fill('#pass2', PASS); await f.locator('#passOk').click();
      for (let i = 0; i < 30 && !(await f.evaluate(() => !!document.getElementById('jf-38-0-a'))); i++) await run(500);
      await f.locator('#jf-38-0-a').fill('Share a meal with a neighbour.'); await f.locator('#jf-38-0-h').click(); await run(3000);
      o.written = { saved: await f.evaluate(() => document.querySelector('#jr-38-0 .jsaved').textContent), jstatsDays: await f.evaluate(() => Object.keys((hub.get('f260.jstats') || {}).days || {})) };
      // two days later, the entry is still open (autolock off: "Never"); he taps into Apply to reread it and taps away
      await f.evaluate(() => document.querySelector('#autoSeg [data-min="0"]').click());
      await d.ctx.clock.fastForward('48:00:00'); await run(2000);
      o.before = { saved: await f.evaluate(() => document.querySelector('#jr-38-0 .jsaved').textContent) };
      await f.locator('#jf-38-0-a').click(); await run(300); await f.locator('#jf-38-0-h').click(); await run(300);
      await f.locator('#tabPlan').click(); await run(3000);
      o.after = { saved: await f.evaluate(() => document.querySelector('#jr-38-0 .jsaved').textContent), a: await f.evaluate(() => document.getElementById('jf-38-0-a').value), jstatsDays: await f.evaluate(() => Object.keys((hub.get('f260.jstats') || {}).days || {})) };
      await f.locator('#tabJournal').click(); await run(800);
      o.journalCard = await f.evaluate(() => { const c = document.querySelector('[data-entry="38-0"]'); return c ? c.querySelector('.jc-hd').innerText.replace(/\s+/g, ' ') : null; });
      o.journalStat = await f.evaluate(() => document.getElementById('jStat').innerText.replace(/\s+/g, ' '));
      o.shot = await shot(d.page, 'critic-dates-A-redated-iphone.png');
    }
    if (mode === 'B') {
      // Tue 22 Sep: he reads ahead from the plan list and finishes all of week 39
      await f.evaluate(() => { const s = document.getElementById('week-39'); if (!s.classList.contains('open')) s.querySelector('.wk-head').click(); });
      for (let i = 0; i < 5; i++) await tick(f, '39-' + i);
      await run(2000);
      o.tue = { weekDone39: (await rows(L, 'eli'))['f260.weekDone']?.['39'] ?? null, weekStart39: (await rows(L, 'eli'))['f260.weekStart']?.['39'] ?? null };
      // Thu 24 Sep: he finishes week 38 with Done, then taps "Start week 39" in the hero
      await d.ctx.clock.fastForward('48:00:00'); await run(2000);
      for (let i = 0; i < 3; i++) { await f.locator('#todayDone').click(); await run(400); }
      o.hero = await texts(f, ['#heroKind', '#heroTitle', '#nextUp']);
      await f.evaluate(() => document.getElementById('nextUp').click()); await run(2000);
      o.thu = await f.evaluate(() => ({ head: document.querySelector('#week-39 .wk-head .span').textContent, sumt: document.querySelector('#week-39 .sumt').textContent }));
      const r = await rows(L, 'eli');
      o.server = { weekStart39: r['f260.weekStart']?.['39'], weekDone39: r['f260.weekDone']?.['39'], week: r['f260.week'] };
      await f.evaluate(() => document.querySelector('#week-39 .sumt').scrollIntoView({ block: 'center' }));
      o.shot = await shot(d.page, 'critic-dates-B-negative-days-iphone.png');
    }
    if (mode === 'C') {
      const ws0 = (await rows(L, 'eli'))['f260.weekStart'];
      o.before = { week: (await rows(L, 'eli'))['f260.week'], ws: Object.keys(ws0).filter(k => +k >= 38), today: await texts(f, ['#todayTitle', '#todayMeta']) };
      await f.evaluate(() => document.getElementById('wkPlus').scrollIntoView({ block: 'center' }));
      for (let i = 0; i < 3; i++) { await f.locator('#wkPlus').click(); await run(300); }
      o.peek = { today: await texts(f, ['#todayTitle', '#todayMeta', '#curWeekLbl']) };
      for (let i = 0; i < 3; i++) { await f.locator('#wkMinus').click(); await run(300); }
      await run(2000);
      const r = await rows(L, 'eli');
      o.after = { week: r['f260.week'], ws: Object.fromEntries(Object.entries(r['f260.weekStart']).filter(([k]) => +k >= 38)), summaryWeek: r['f260.summary']?.week, today: await texts(f, ['#todayTitle', '#todayMeta']) };
      await f.evaluate(() => document.getElementById('week-39').scrollIntoView({ block: 'start' }));
      o.week39Head = await f.evaluate(() => document.querySelector('#week-39 .wk-head .span').textContent);
    }
    await d.close();
  } catch (e) { o.error = String(e && e.stack || e).slice(0, 600); }
  finally { await L.close(); }
  for (const [k, v] of Object.entries(o)) console.log(mode, k.padEnd(12), JSON.stringify(v).slice(0, 500));
}
console.log('evidence →', save('critic-dates.json', out));
