// Batch 11 copy of audits/tools/phase3/tally/verify-minus-at-zero-silent-write-1.mjs: changed on purpose, because the off buttons (- at 0 and + at 999 999, Reset at 0: P3-TALLY-04, P3-TALLY-08) are aria-disabled, which Playwright will not click; the clicks are forced ({ force: true }) to prove that a forced tap on an off button writes nothing. Everything else is the original.
// Skeptic #1 for finding "minus-at-zero-silent-write" (tally.html:152/154).
// 1) Signed in as Eli on the iPhone (shell viewer): reset to 0, then tap − three times. Record each batch POST,
//    the server row's updated_at before/after each tap, the button's disabled/aria state, any toast / role=status text,
//    and whether the display or the page changes at all (feedback).
// 2) Stale-device facet: another device (API as Eli) sets count=4; before device A pulls, A taps − at 0.
//    Record what the server ends with (does a no-op − overwrite the newer 4?).
// Run: node "audits/tools/phase3/tally/verify-minus-at-zero-silent-write-1.mjs"
//   -> audits/evidence/p3/tally/verify-minus-at-zero-silent-write-1.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p6/11/p3copies';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const row = async () => { const r = await L.apiAs('eli', '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return { value: it ? it.value : null, updated_at: it ? it.updated_at : null, now: r.body.now }; };
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  let posts = [];
  d.page.on('request', r => { if (r.method() === 'POST' && r.url().includes('/api/data/tally/batch')) posts.push(r.postDataJSON()); });
  const f = await d.openApp('tally');
  await f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0);
  await f.locator('#reset').click({ force: true }); await sleep(900);
  res.afterReset = { display: await f.evaluate(() => document.getElementById('n').textContent), server: await row() };
  const state = () => f.evaluate(() => {
    const m = document.getElementById('minus'); const t = document.getElementById('hub-toast');
    return { display: document.getElementById('n').textContent, disabled: m.disabled, ariaDisabled: m.getAttribute('aria-disabled'),
      opacity: getComputedStyle(m).opacity, cursor: getComputedStyle(m).cursor, toast: t ? t.textContent : null, bodyLen: document.body.innerHTML.length };
  });
  res.before = await state();
  res.taps = [];
  for (let i = 0; i < 3; i++) {
    posts = [];
    const b = await row();
    await f.locator('#minus').click({ force: true }); await sleep(900);
    const a = await row();
    res.taps.push({ i, posts: posts.length, values: posts.map(p => p.items.map(x => ({ key: x.key, value: x.value }))), serverBefore: b, serverAfter: a, restamped: a.updated_at > b.updated_at, ui: await state() });
  }
  console.log('taps', JSON.stringify(res.taps.map(t => ({ posts: t.posts, values: t.values, restamped: t.restamped, before: t.serverBefore.updated_at, after: t.serverAfter.updated_at, disabled: t.ui.disabled, aria: t.ui.ariaDisabled, toast: t.ui.toast, display: t.ui.display }))));

  // Stale-device facet: a newer write from elsewhere, then A's − at 0 before A pulls.
  const cur = await row();
  const w = await L.apiAs('eli', '/api/data/tally/batch?scope=person', { method: 'POST', body: { items: [{ key: 'count', value: 4, updated_at: Math.max(cur.now, cur.updated_at + 1) }] } });   // newer than the current row (the demo server clock runs slow)
  const afterOther = await row();
  posts = [];
  const dispBefore = await f.evaluate(() => document.getElementById('n').textContent);
  await f.locator('#minus').click({ force: true }); await sleep(900);
  const afterTap = await row();
  await sleep(500);
  res.stale = { otherWrite: { status: w.status, results: w.body.results }, serverAfterOther: afterOther, displayOnA: dispBefore, posts: posts.map(p => p.items), serverAfterMinusOnA: afterTap, displayAfter: await f.evaluate(() => document.getElementById('n').textContent) };
  console.log('stale', JSON.stringify(res.stale));
  await d.shot(`${OUT}/verify-minus-at-zero-silent-write-1.png`);
} finally {
  fs.writeFileSync(`${OUT}/verify-minus-at-zero-silent-write-1.json`, JSON.stringify(res, null, 1));
  await L.close();
}
