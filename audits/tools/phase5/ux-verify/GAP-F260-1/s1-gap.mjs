// Skeptic s1, GAP-F260-1: a reading left unticked in an earlier week (30-2) while the plan is at week 38.
// What does the app offer, what cues exist for week 30 anywhere on the Plan page, and how many Done taps pass before
// 30-2 is offered? Also: does the hub's f260.summary (Home card) ever mention it? And the ways a gap can arise:
// the week stepper (+) and the week select move the plan on with readings unticked.
//   node "audits/tools/phase5/ux-verify/GAP-F260-1/s1-gap.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO, ROOT } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/GAP-F260-1/s1'); fs.mkdirSync(OUT, { recursive: true });
const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const rows = async (pid) => { const r = await L.apiAs(pid, '/api/data/f260?scope=person'); const o = {}; for (const it of (r.body.items || [])) o[it.key] = it.value; return o; };
const put = async (pid, key, value) => { const g = await L.apiAs(pid, `/api/data/f260?scope=person&key=__none__`); return L.apiAs(pid, `/api/data/f260/${encodeURIComponent(key)}?scope=person`, { method: 'PUT', body: { value, updated_at: g.body.now } }); };
const txt = (f, sels) => f.evaluate(ss => Object.fromEntries(ss.map(s => { const e = document.querySelector(s); return [s, e ? (e.hidden ? '(hidden) ' : '') + e.textContent.replace(/\s+/g, ' ').trim() : null]; })), sels);
try {
  await L.reset('typical');
  const r = await rows('eli');
  out.seed = { week: r['f260.week'], doneCount: Object.values(r['f260.done'] || {}).filter(Boolean).length, has30_2: !!(r['f260.done'] || {})['30-2'], missingBefore38: [] };
  for (let w = 1; w < 38; w++) for (let i = 0; i < 5; i++) if (!(r['f260.done'] || {})[w + '-' + i]) out.seed.missingBefore38.push(w + '-' + i);
  const done = { ...r['f260.done'] }; delete done['30-2']; await put('eli', 'f260.done', done);
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
  const f = await d.openApp('f260');
  await f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim().length > 0; }, null, { timeout: 15000 }); await sleep(600);
  out.ui = await txt(f, ['#todayKind', '#todayTitle', '#todayMeta', '#heroKind', '#heroTitle', '#heroMeta', '#heroPace', '#pct', '#doneCount']);
  out.cues = await f.evaluate(() => {
    const cell = document.querySelector('[data-ygo="30"]'); const cr = cell.getBoundingClientRect();
    const sec = document.getElementById('week-30'); const head = sec && sec.querySelector('.wk-head');
    const nb = document.getElementById('week-29'); const nbHead = nb && nb.querySelector('.wk-head');
    const jb = [...document.querySelectorAll('#jbar button')].find(b => /Malachi/.test(b.getAttribute('aria-label') || b.title));
    return {
      gridCell: { cls: cell.className, label: cell.getAttribute('aria-label'), size: Math.round(cr.width) + 'x' + Math.round(cr.height), y: Math.round(cr.top + scrollY) },
      week30Header: head ? { text: head.textContent.replace(/\s+/g, ' ').trim(), opacity: getComputedStyle(head).opacity, sectionCls: sec.className, y: Math.round(head.getBoundingClientRect().top + scrollY) } : null,
      week29HeaderOpacity: nbHead ? getComputedStyle(nbHead).opacity : null,
      malachiBar: jb ? { title: jb.title, label: jb.getAttribute('aria-label') } : null,
      pageHeight: document.documentElement.scrollHeight,
      bodyMentions: [...document.body.innerText.matchAll(/[^\n]*(catch|missed|behind|week 30|Malachi 2)[^\n]*/ig)].map(m => m[0].trim()).slice(0, 8),
    };
  });
  out.summaryRow = (await rows('eli'))['f260.summary'];
  await d.page.screenshot({ path: path.join(OUT, 's1-gap-today-iphone.png'), scale: 'css', animations: 'disabled' });
  let n = 0, first = null;
  for (let i = 0; i < 90; i++) { const id = await f.evaluate(() => document.getElementById('todayDone').dataset.target); if (!id) break; if (id === '30-2') { first = n; break; } await f.evaluate(() => document.getElementById('todayDone').click()); n++; await sleep(50); }
  out.tapsBefore30_2 = first;
  out.ui30 = await txt(f, ['#todayKind', '#todayTitle', '#todayMeta', '#heroKind', '#heroTitle']);
  await d.page.screenshot({ path: path.join(OUT, 's1-gap-offered-iphone.png'), scale: 'css', animations: 'disabled' });
  await d.close();

  // How a gap arises: from a fresh state at week 38 day 3 unread, the "+" week stepper moves the plan on to week 39.
  await L.reset('typical');
  const d2 = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
  const f2 = await d2.openApp('f260');
  await f2.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim().length > 0; }, null, { timeout: 15000 }); await sleep(600);
  const before = await txt(f2, ['#todayTitle', '#todayMeta', '#curWeekLbl']);
  await f2.evaluate(() => document.getElementById('wkPlus').click()); await sleep(800);
  const after = await txt(f2, ['#todayTitle', '#todayMeta', '#curWeekLbl', '#heroTitle', '#heroMeta']);
  out.stepper = { before, afterPlus: after, confirmAsked: false };
  await d2.close();
  console.log(JSON.stringify(out, null, 1));
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 's1-gap.json'), JSON.stringify(out, null, 1));
console.log('saved', path.relative(ROOT, path.join(OUT, 's1-gap.json')));
