// F260 — plan logic at runtime: Undo after Done, a week-ahead Done, the streak on a day not yet read, pace wording,
// percent rounding, the end of the plan (260/260) and an untick after it, the "Pick up where you left off" copy.
// Local rig, typical household, demo clock; browsers run a flowing clock installed at the demo instant.
//   node "audits/tools/phase3/f260/logic.mjs"            (all cases)   ·   node ... logic.mjs undo streak   (some)
import { local, sleep, DEMO, save, shot, rows, put, texts, ready } from './_lib.mjs';

const want = process.argv.slice(2); const on = c => !want.length || want.includes(c);
const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const SEL = ['#todayKind', '#todayTitle', '#todayMeta', '#todayStreak', '#todayRingN', '#heroKind', '#heroMeta', '#heroPace', '#streak', '#pct', '#doneCount', '#curWeekLbl'];
async function open(profile, device = 'iphone-pwa', at = DEMO) {
  const d = await L.device({ device, profile, installClock: at });
  const f = await d.openApp('f260'); await ready(f); return { d, f };
}
const summary = async pid => (await rows(L, pid))['f260.summary'];
try {
  // ── A. Done, then Undo: does "read today" go back? ─────────────────────────────────────────────────────────────
  if (on('undo')) {
    await L.reset('typical');
    const { d, f } = await open('eli');
    const s0 = await texts(f, SEL); const r0 = await rows(L, 'eli');
    await f.locator('#todayDone').tap(); await sleep(1500);
    const s1 = await texts(f, SEL); const r1 = await rows(L, 'eli');
    await f.locator('#todayUndo').tap(); await sleep(1500);
    const s2 = await texts(f, SEL); const r2 = await rows(L, 'eli');
    const today = '2026-09-22';
    out.undo = {
      before: { ui: s0, logToday: !!(r0['f260.log'] || {})[today], readToday: r0['f260.summary'].readToday, streak: r0['f260.summary'].streak, tick: !!r0['f260.done']['38-2'] },
      afterDone: { ui: s1, logToday: !!r1['f260.log'][today], readToday: r1['f260.summary'].readToday, streak: r1['f260.summary'].streak, tick: !!r1['f260.done']['38-2'] },
      afterUndo: { ui: s2, logToday: !!r2['f260.log'][today], readToday: r2['f260.summary'].readToday, streak: r2['f260.summary'].streak, tick: !!r2['f260.done']['38-2'], undoHidden: await f.evaluate(() => document.getElementById('todayUndo').hidden) },
    };
    await shot(d.page, 'logic-undo-after-iphone.png');
    // the 8 pm nudge's own check (worker/src/reminders.js eveningJob judges by f260.log[today])
    const ev = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'evening' } });
    const evOut = [].concat(ev.body.results || ev.body).find(x => x && x.job === 'evening') || ev.body;
    out.undo.eveningJobEli = (evOut.checked || []).find(c => c.profile === 'eli') || evOut;
    // Home after the Undo (the shell reads f260.summary)
    await d.goto('#home'); await sleep(2500);
    out.undo.homeAfterUndo = await d.page.evaluate(() => { const c = [...document.querySelectorAll('.gcard')].find(e => /Today's reading/.test(e.textContent)); return c ? c.innerText.replace(/\s+/g, ' ').trim() : null; });
    await shot(d.page, 'logic-undo-home-iphone.png');
    await d.close();
    console.log("A undo evening job:", JSON.stringify(out.undo.eveningJobEli)); console.log("A undo", JSON.stringify({ before: out.undo.before.ui['#todayKind'], afterDone: out.undo.afterDone.ui['#todayKind'], afterUndo: out.undo.afterUndo.ui['#todayKind'], logToday: out.undo.afterUndo.logToday, readToday: out.undo.afterUndo.readToday, tick: out.undo.afterUndo.tick, streak: [out.undo.before.streak, out.undo.afterDone.streak, out.undo.afterUndo.streak], home: out.undo.homeAfterUndo }));
  }
  // ── B. Done on a reading in the next week starts that week; Undo does not give it back ─────────────────────────
  if (on('ahead')) {
    await L.reset('typical');
    const r0 = await rows(L, 'christian');   // Mae: week 37 complete, has not started 38
    const { d, f } = await open('christian');
    const s0 = await texts(f, SEL);
    await f.locator('#todayDone').tap(); await sleep(1500);
    const r1 = await rows(L, 'christian'); const s1 = await texts(f, SEL);
    await f.locator('#todayUndo').tap(); await sleep(1500);
    const r2 = await rows(L, 'christian'); const s2 = await texts(f, SEL);
    out.ahead = { before: { week: r0['f260.week'], ws38: (r0['f260.weekStart'] || {})['38'] || null, ui: s0 },
      afterDone: { week: r1['f260.week'], ws38: r1['f260.weekStart']['38'] || null, tick: !!r1['f260.done']['38-0'], ui: s1 },
      afterUndo: { week: r2['f260.week'], ws38: r2['f260.weekStart']['38'] || null, tick: !!r2['f260.done']['38-0'], ui: s2 } };
    await d.close();
    console.log('B ahead', JSON.stringify({ week: [out.ahead.before.week, out.ahead.afterDone.week, out.ahead.afterUndo.week], ws38: [out.ahead.before.ws38, out.ahead.afterDone.ws38, out.ahead.afterUndo.ws38], tick: out.ahead.afterUndo.tick, todayTitleAfterUndo: s2['#todayTitle'], metaAfterUndo: s2['#todayMeta'] }));
  }
  // ── C. The streak on a day not yet read: last read Sat 19, rest Sun 20 + Mon 21, today Tue 22 not read yet ────
  if (on('streak')) {
    await L.reset('typical');
    const r = await rows(L, 'eli');
    const log = { ...r['f260.log'] }; for (const k of ['2026-09-20', '2026-09-21', '2026-09-22']) delete log[k];
    log['2026-09-19'] = true;                                      // read Saturday; Sunday and Monday are the two allowed rest days
    const kept = Object.keys(log).sort().slice(-6);
    await put(L, 'eli', 'f260.log', log);
    const { d, f } = await open('eli');
    const s0 = await texts(f, SEL); const sum0 = await summary('eli');
    const heat0 = await f.evaluate(() => [...document.querySelectorAll('#heat span')].slice(-10).map(s => s.title + ':' + s.className));
    await shot(d.page, 'logic-streak-before-read-iphone.png');
    await f.locator('#todayDone').tap(); await sleep(1500);
    const s1 = await texts(f, SEL); const sum1 = await summary('eli');
    out.streak = { lastSixLogDays: kept, beforeReadingToday: { ui: s0, summaryStreak: sum0.streak, heatTail: heat0 }, afterReadingToday: { ui: s1, summaryStreak: sum1.streak } };
    await shot(d.page, 'logic-streak-after-read-iphone.png');
    // Home before reading (a fresh device reading the summary written at open)
    await d.close();
    console.log('C streak', JSON.stringify({ lastLogDays: kept, before: [s0['#todayKind'], s0['#todayStreak'], 'summary.streak=' + sum0.streak], after: [s1['#todayKind'], s1['#todayStreak'], 'summary.streak=' + sum1.streak] }));
  }
  // ── D. Pace wording: 11 days behind / ahead ────────────────────────────────────────────────────────────────────
  if (on('pace')) {
    out.pace = [];
    for (const [label, startDaysAgo] of [['behind11', 273], ['ahead11', 251], ['behind8', 270], ['behind15', 277]]) {
      await L.reset('typical');
      const r = await rows(L, 'eli'); const n = Object.keys(r['f260.done']).length;
      const start = new Date(Date.UTC(2026, 8, 22) - startDaysAgo * 86400000).toISOString().slice(0, 10);
      const ws = Object.fromEntries(Object.entries(r['f260.weekStart']).filter(([, v]) => v > start)); ws['1'] = start;   // the earliest start is the pace anchor
      await put(L, 'eli', 'f260.weekStart', ws);
      const { d, f } = await open('eli');
      const t = await texts(f, ['#heroPace']);
      const diff = +(n * 7 / 5 - startDaysAgo).toFixed(2);
      out.pace.push({ label, readings: n, start, elapsedDays: startDaysAgo, diffDays: diff, heroPace: t['#heroPace'] });
      console.log('D pace', label, 'readings', n, 'start', start, 'diff', diff, '→', JSON.stringify(t['#heroPace']));
      if (label === 'behind11') await shot(d.page, 'logic-pace-2-week-behind-iphone.png', {});
      await d.close();
    }
  }
  // ── E. 259 of 260, the last tick, then an untick ───────────────────────────────────────────────────────────────
  if (on('end')) {
    await L.reset('typical');
    const done = {}; for (let w = 1; w <= 52; w++) for (let d = 0; d < 5; d++) done[w + '-' + d] = true; delete done['52-4'];
    const weekDone = {}; for (let w = 1; w <= 51; w++) weekDone[w] = '2026-09-0' + (1 + (w % 9));
    await put(L, 'eli', 'f260.done', done); await put(L, 'eli', 'f260.week', 52); await put(L, 'eli', 'f260.weekDone', weekDone);
    const { d, f } = await open('eli', 'ipad-portrait');
    const s0 = await texts(f, [...SEL, '#jWhere']);
    await shot(d.page, 'logic-259-of-260-ipad.png');
    await f.locator('#todayDone').tap(); await sleep(2500);
    const modal = await f.evaluate(() => ({ on: document.getElementById('complete').classList.contains('on'), text: document.getElementById('complete').innerText.replace(/\s+/g, ' ').trim() }));
    await shot(d.page, 'logic-plan-complete-ipad.png');
    const r1 = await rows(L, 'eli'); const s1 = await texts(f, [...SEL, '#jWhere']);
    await f.evaluate(() => document.getElementById('completeClose').click()); await sleep(300);
    // untick one reading (week 52 is the current week, open): the plan's own circle
    await f.evaluate(() => document.querySelector('[data-day="52-1"] .mark').click()); await sleep(1500);
    const r2 = await rows(L, 'eli'); const s2 = await texts(f, [...SEL, '#jWhere']);
    // tick it again: does the year-complete moment come back?
    await f.evaluate(() => document.querySelector('[data-day="52-1"] .mark').click()); await sleep(2500);
    const modal2 = await f.evaluate(() => document.getElementById('complete').classList.contains('on'));
    out.end = { at259: { ui: s0 }, lastTick: { modal, finished: r1['f260.finished'], summary: r1['f260.summary'], ui: s1 },
      untick: { finished: r2['f260.finished'], summaryFinished: r2['f260.summary'].finished, summaryTotal: r2['f260.summary'].total, next: r2['f260.summary'].next, ui: s2 }, retickShowsComplete: modal2 };
    await d.close();
    console.log('E end', JSON.stringify({ pctAt259: s0['#pct'], todayAt259: s0['#todayTitle'], modalOnLastTick: modal.on, finished: r1['f260.finished'], untick: out.end.untick.finished + ' summary.finished=' + out.end.untick.summaryFinished + ' total=' + out.end.untick.summaryTotal + ' pct=' + s2['#pct'] + ' pace=' + s2['#heroPace'], retickShowsComplete: modal2 }));
  }
  // ── G. A reading missed in an earlier week (30-2) while the plan moved on to week 38: what offers it? ─────────────
  if (on('gap')) {
    await L.reset('typical');
    const r = await rows(L, 'eli'); const done = { ...r['f260.done'] }; delete done['30-2'];
    await put(L, 'eli', 'f260.done', done);
    const { d, f } = await open('eli');
    const t = await texts(f, SEL);
    const g = await f.evaluate(() => ({ week30Cell: (document.querySelector('[data-ygo="30"]') || {}).className, week30Label: (document.querySelector('[data-ygo="30"]') || {}).getAttribute && document.querySelector('[data-ygo="30"]').getAttribute('aria-label'), anyCatchUpText: /catch|missed|behind/i.test(document.body.innerText) ? [...document.body.innerText.matchAll(/[^\n]*(catch|missed|behind)[^\n]*/ig)].map(m => m[0]).slice(0, 4) : [] }));
    // tick every remaining reading of weeks 38-52 through the plan's own circles: when does 30-2 come up?
    let n = 0, first30 = null;
    for (let i = 0; i < 80; i++) { const id = await f.evaluate(() => document.getElementById('todayDone').dataset.target); if (!id) break; if (id === '30-2') { first30 = n; break; } await f.evaluate(() => document.getElementById('todayDone').click()); n++; await sleep(60); }
    out.gap = { todayWithGap: [t['#todayTitle'], t['#todayMeta']], yearGrid: g, readingsBefore30_2Offered: first30, ui30: await texts(f, ['#todayTitle', '#todayMeta']) };
    await d.close();
    console.log('G gap', JSON.stringify(out.gap));
  }
  // ── K. The kiosk (Downstairs TV) and #f260 ──
  if (on('kiosk')) {
    await L.reset('typical');
    const d = await L.device({ device: 'tv', profile: 'tv', installClock: DEMO });
    await d.goto('#f260'); await sleep(3000);
    out.kiosk = await d.page.evaluate(() => ({ frame: [...document.querySelectorAll('iframe')].some(i => /f260/.test(i.src)), toast: [...document.querySelectorAll('.toast,[role=status]')].map(e => e.textContent.trim()).filter(Boolean).slice(0, 2) }));
    await d.close();
    console.log('K kiosk #f260', JSON.stringify(out.kiosk));
  }
  // ── W. "Pick up where you left off" copy (David, streak 0) ──────────────────────────────────────────────────────
  if (on('quiet')) {
    await L.reset('typical');
    const { d, f } = await open('dad');
    const t = await texts(f, SEL);
    out.quiet = t; console.log('W quiet', JSON.stringify({ today: [t['#todayKind'], t['#todayStreak']], hero: [t['#heroKind'], t['#streak'], t['#heroMeta']] }));
    await d.close();
  }
} finally { await L.close(); }
console.log('evidence →', save('logic' + (want.length ? '-' + want.join('-') : '') + '.json', out));
