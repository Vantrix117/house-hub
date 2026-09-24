// Skeptic #1 for finding "reminder-draft-wiped-by-pull" (Home: a half-typed family reminder vs the routine 30 s pull).
//   node "audits/tools/phase2/HOME/verify-reminder-draft-wiped-by-pull-1.mjs"      (~90 s; real clock, WebKit, iPad portrait, Eli)
// Independent of leads.mjs. Three runs on one fresh local instance:
//   control  type a draft right after a pull, read it back 5 s later (no pull in between) -> the draft should survive
//   typing   start typing slowly (350 ms/char, a real key-by-key type into the tapped field) ~4 s before the next routine
//            30 s pull, keep typing across it; record each pull (who called it, what data it delivered), the field value,
//            focus and whether #remtext is still the same DOM node; what the user typed versus what is left in the field
//   visible  a visibilitychange (returning to the tab) with a draft in the field
// Evidence: audits/evidence/p2/HOME/verify-reminder-draft-1.json (+ -before/-after PNGs at 1x css scale).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/HOME');
fs.mkdirSync(OUT, { recursive: true });
const res = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const page = d.page;
  await d.goto('#home');
  await page.waitForFunction(() => hub.sync.lastPull > 0 && document.querySelector('#remtext'), null, { timeout: 20000 });
  // instrumentation: every hub.pull call (with the caller), every data change delivered, every #view-home rebuild
  await page.evaluate(() => {
    window.__log = [];
    const orig = hub.pull;
    hub.pull = function () {
      const st = (new Error().stack || '').split('\n').slice(1, 3).map(s => s.trim()).join(' <- ');
      const t0 = Date.now();
      const p = orig.apply(this, arguments);
      Promise.resolve(p).then(changed => window.__log.push({ ev: 'pull', t0, t1: Date.now(), changed, caller: st.slice(0, 160) }));
      return p;
    };
    hub.onChange(c => window.__log.push({ ev: 'change', t: Date.now(), app: c.app, key: c.key }));
    new MutationObserver(() => window.__log.push({ ev: 'home-rebuilt', t: Date.now(), active: document.activeElement && (document.activeElement.id || document.activeElement.tagName) }))
      .observe(document.querySelector('#view-home'), { childList: true });
  });
  const state = () => page.evaluate(() => { const el = document.querySelector('#remtext'); return { t: Date.now(), value: el && el.value, focused: document.activeElement && (document.activeElement.id || document.activeElement.tagName), sameNode: el === window.__el, lastPull: hub.sync.lastPull, syncState: hub.sync.state }; });
  const waitNextPull = async () => { const lp = await page.evaluate(() => hub.sync.lastPull); await page.waitForFunction(lp => hub.sync.lastPull !== lp, lp, { timeout: 40000 }); return page.evaluate(() => hub.sync.lastPull); };

  // ── control: no pull between typing and reading back ───────────────────────────────────────────────────────
  const lp0 = await waitNextPull(); await sleep(300);
  await page.evaluate(() => document.querySelector('#remtext').scrollIntoView({ block: 'center' }));
  await page.click('#remtext');
  await page.evaluate(() => { window.__el = document.querySelector('#remtext'); });
  await page.keyboard.type('Buy milk', { delay: 60 });
  const c1 = await state(); await sleep(5000); const c2 = await state();
  res.control = { typedAt: c1, fiveSecondsLater: c2, pullInBetween: c2.lastPull !== c1.lastPull };
  console.log(`[control] typed "Buy milk" ${c1.t - lp0} ms after a pull; 5 s later: value "${c2.value}", focus ${c2.focused}, same node ${c2.sameNode}, pull in between: ${res.control.pullInBetween}`);
  await page.evaluate(() => { document.querySelector('#remtext').value = ''; });

  // ── typing across the routine pull ────────────────────────────────────────────────────────────────────────────
  const lp1 = await waitNextPull();
  await sleep(Math.max(0, 26000 - (Date.now() - lp1)));   // start ~4 s before the next 30 s tick
  await page.evaluate(() => { window.__log.length = 0; });
  await page.click('#remtext');
  await page.evaluate(() => { window.__el = document.querySelector('#remtext'); });
  const before = await state();
  const draft = 'Pick up the dry cleaning before 5';
  const samples = [];
  const typing = (async () => { for (const ch of draft) { await page.keyboard.type(ch); await sleep(350); } })();
  const sampler = (async () => { const end = Date.now() + draft.length * 400 + 1500; while (Date.now() < end) { samples.push(await state()); await sleep(500); } })();
  await sleep(1800);
  await page.screenshot({ path: path.join(OUT, 'verify-reminder-draft-1-before.png'), scale: 'css', animations: 'disabled' });
  await Promise.all([typing, sampler]);
  const after = await state();
  await page.screenshot({ path: path.join(OUT, 'verify-reminder-draft-1-after.png'), scale: 'css', animations: 'disabled' });
  const log = await page.evaluate(() => window.__log.slice());
  // where the typing stood when the field was replaced
  const lastGood = samples.filter(s => s.sameNode).pop();
  const firstBad = samples.find(s => !s.sameNode);
  const server = await L.apiAs('eli', '/api/data/reminders?scope=family');
  const onServer = JSON.stringify(server).includes('dry cleaning') || JSON.stringify(server).includes('Pick up');
  res.typing = { draft, before, after, lastSampleBeforeRebuild: lastGood, firstSampleAfterRebuild: firstBad, log, draftFragmentOnServer: onServer };
  console.log(`\n[typing] tapped #remtext ${before.t - lp1} ms after a pull, typing "${draft}" at 350 ms/char`);
  for (const e of log) console.log('   ', e.ev === 'pull' ? `pull ${e.t1 - lp1} ms after the previous, changed=${e.changed}, caller: ${e.caller}` : e.ev === 'change' ? `change ${e.app}:${e.key}` : `#view-home rebuilt (activeElement at mutation: ${e.active})`);
  console.log(`   last sample on the original field: value "${lastGood && lastGood.value}", focus ${lastGood && lastGood.focused}`);
  console.log(`   first sample after the rebuild:    value "${firstBad && firstBad.value}", focus ${firstBad && firstBad.focused}, same node ${firstBad && firstBad.sameNode}`);
  console.log(`   after typing ended: value "${after.value}", focus ${after.focused}; any part of the draft on the server: ${onServer}`);

  // ── visibilitychange with a draft in the field ──────────────────────────────────────────────────────────────
  await page.click('#remtext'); await page.evaluate(() => { window.__el = document.querySelector('#remtext'); });
  await page.keyboard.type('Call the plumber', { delay: 40 });
  const v1 = await state();
  const lpv = v1.lastPull;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));   // document.hidden is false: hub.js pulls
  await page.waitForFunction(lp => hub.sync.lastPull !== lp, lpv, { timeout: 15000 }).catch(() => {});
  await sleep(500);
  const v2 = await state();
  res.visible = { before: v1, after: v2 };
  console.log(`\n[visible] draft "${v1.value}" (focus ${v1.focused}); after a visibilitychange pull: value "${v2.value}", focus ${v2.focused}, same node ${v2.sameNode}`);
  res.consoleErrors = d.logs.filter(l => /error/i.test(l)).slice(0, 10);
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-reminder-draft-1.json'), JSON.stringify(res, null, 1));
  await L.close();
}
