// Skeptic #2 for finding "home-reading-stale-next-morning": is Home's "Today's reading" card still "read today ✓" the next
// morning, with the data written by the app itself (not the seed) and the same device carried overnight on a running clock?
//
//   node "audits/tools/phase2/HOME/verify-home-reading-stale-next-morning-2.mjs"
//
// Eli (seed: has NOT read today) on the iPhone PWA, browser clock installed (running) at Tue 22 Sep 2026 20:40 New York,
// rig server clock moved to the same instant.
//   1. Home on Tue evening                       → expect "a reading waiting"
//   2. F260 → tap Done (the app writes f260.log + f260.summary itself) → back to Home → expect "reading done" / "read today ✓"
//   3. Overnight: browser clock fast-forwarded 12 h to Wed 08:40, server clock moved too; Home tab re-shown + a pull
//   4. The same device relaunched (page reload) on Wed morning
//   5. F260 opened on Wed → its own Today kicker; back to Home
// Writes audits/evidence/p2/HOME/verify-stale-2.json and verify-stale-2-wed-home.png.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/HOME');
fs.mkdirSync(OUT, { recursive: true });
const TUE_EVE = DEMO + 12 * 3600e3;   // Tue 22 Sep 2026 20:40 New York
const WED = DEMO + 24 * 3600e3;       // Wed 23 Sep 2026 08:40 New York

const home = page => page.evaluate(() => {
  const c = [...document.querySelectorAll('#view-home .gcard')].find(x => /Today's reading/.test(x.querySelector('h2').textContent));
  return {
    now: new Date().toString().slice(0, 24),
    hero: (document.querySelector('#view-home .hero-sub') || {}).textContent || '',
    big: c && c.querySelector('.gbig').textContent.trim(),
    sub: c && c.querySelector('.gsub').textContent.trim(),
    summary: hub.get('f260.summary', { app: 'f260', scope: 'person' }),
    sync: hub.sync.state, lastPull: hub.sync.lastPull,
  };
});
const waitHome = async page => { await page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#view-home .gcard'), null, { timeout: 20000 }); await sleep(700); };
const serverRows = async () => {
  const s = await L.apiAs('eli', '/api/data/f260?scope=person&key=f260.summary');
  const l = await L.apiAs('eli', '/api/data/f260?scope=person&key=f260.log');
  const item = r => r.body && r.body.item;
  return { summary: item(s) && item(s).value, summaryUpdatedAt: item(s) && new Date(item(s).updated_at).toISOString(), logLast: Object.keys((item(l) && item(l).value) || {}).sort().slice(-3) };
};

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
try {
  await L.clock(new Date(TUE_EVE).toISOString());
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: TUE_EVE });
  const { page, ctx } = d;

  // 1. Tue evening, before reading
  await d.goto('#home'); await waitHome(page);
  res.tueBefore = await home(page);
  console.log(`[1 Tue 20:40, not read] hero "${res.tueBefore.hero}" | card "${res.tueBefore.big}" / "${res.tueBefore.sub}"`);

  // 2. F260 → Done → Home
  const f = await d.openApp('f260', { wait: '#todayTitle:not(:empty)' }); await sleep(800);
  const beforeTick = await f.evaluate(() => ({ kind: document.querySelector('#todayKind').textContent, title: document.querySelector('#todayTitle').textContent }));
  await f.click('#todayDone'); await sleep(600);
  const afterTick = await f.evaluate(() => ({ kind: document.querySelector('#todayKind').textContent, title: document.querySelector('#todayTitle').textContent }));
  res.f260Tue = { beforeTick, afterTick };
  console.log(`[2 F260 Tue] before Done: "${beforeTick.kind}" ${beforeTick.title}; after Done: "${afterTick.kind}" next ${afterTick.title}`);
  await page.click('#pill-home'); await sleep(300); await page.click('.tab[data-tab=home]'); await sleep(1500);
  await page.evaluate(() => hub.flush()); await sleep(800);
  res.tueAfter = await home(page);
  res.serverTue = await serverRows();
  console.log(`[2 Home Tue after Done] hero "${res.tueAfter.hero}" | card "${res.tueAfter.big}" / "${res.tueAfter.sub}"`);
  console.log(`[2 server Tue] summary.readToday=${res.serverTue.summary && res.serverTue.summary.readToday} (updated ${res.serverTue.summaryUpdatedAt}); log last ${res.serverTue.logLast.join(', ')}`);

  // 3. Overnight on the same device: running clock jumps 12 h; the family's server clock follows
  await L.clock(new Date(WED).toISOString());
  await ctx.clock.fastForward(12 * 3600e3);
  await page.click('.tab[data-tab=apps]'); await sleep(300);
  await page.click('.tab[data-tab=home]'); await sleep(300);
  await page.evaluate(() => hub.pull()); await sleep(2500);
  res.wedSameSession = await home(page);
  console.log(`[3 Wed 08:40, same session] (${res.wedSameSession.now}) hero "${res.wedSameSession.hero}" | card "${res.wedSameSession.big}" / "${res.wedSameSession.sub}"`);

  // 4. Relaunch the PWA on Wed morning
  await d.goto('#home'); await waitHome(page);
  res.wedRelaunch = await home(page);
  await page.screenshot({ path: path.join(OUT, 'verify-stale-2-wed-home.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  console.log(`[4 Wed relaunch] (${res.wedRelaunch.now}) hero "${res.wedRelaunch.hero}" | card "${res.wedRelaunch.big}" / "${res.wedRelaunch.sub}" | summary.readToday=${res.wedRelaunch.summary && res.wedRelaunch.summary.readToday}`);

  // 5. F260 on Wed, then Home
  const f2 = await d.openApp('f260', { wait: '#todayTitle:not(:empty)' }); await sleep(900);
  res.f260Wed = await f2.evaluate(() => ({ kind: document.querySelector('#todayKind').textContent, title: document.querySelector('#todayTitle').textContent, date: document.querySelector('#todayDate').textContent }));
  await page.click('#pill-home'); await sleep(300); await page.click('.tab[data-tab=home]'); await sleep(1500);
  res.wedAfterF260 = await home(page);
  res.serverWed = await serverRows();
  console.log(`[5 F260 Wed] "${res.f260Wed.kind}" — ${res.f260Wed.title} (${res.f260Wed.date})`);
  console.log(`[5 Home Wed after F260] hero "${res.wedAfterF260.hero}" | card "${res.wedAfterF260.big}" / "${res.wedAfterF260.sub}"; server summary.readToday=${res.serverWed.summary && res.serverWed.summary.readToday}`);
  res.logs = d.logs.filter(l => /error/i.test(l)).slice(0, 10);
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-stale-2.json'), JSON.stringify(res, null, 1));
  await L.close();
}
