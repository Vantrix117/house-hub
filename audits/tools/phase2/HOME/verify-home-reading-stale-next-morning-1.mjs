// Skeptic #1 for finding "home-reading-stale-next-morning": does Home's "Today's reading" card / hero keep saying
// "read today ✓" / "reading done" after midnight until F260 is opened?  Independent of HOME/leads.mjs.
//
//   node "audits/tools/phase2/HOME/verify-home-reading-stale-next-morning-1.mjs"
//
// A  overnight on ONE device: Elizabeth's Kitchen iPad sits on Home from Tue 22 Sep 08:40 (she read Tue — the seed's
//    f260.log has 2026-09-22 and f260.summary.readToday = true, as the app itself would have written it). The browser
//    clock is fast-forwarded 24 h and the Worker's clock moved to Wed too (no client/server skew), then Home repaints
//    (tab switch + a fresh pull). What does Home say?  Then open F260: what does it say?  Back on Home: what now?
// B  four days later (Sat 26 Sep 08:40, no reading Wed–Fri): Home's streak vs F260's own streak.
// Writes audits/evidence/p2/HOME/verify-stale-1*.{json,png}.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/HOME');
fs.mkdirSync(OUT, { recursive: true });
const DAY = 24 * 3600e3;
const home = page => page.evaluate(() => {
  const c = [...document.querySelectorAll('#view-home .gcard')].find(x => /Today's reading/.test(x.querySelector('h2').textContent));
  return { now: new Date().toString(), hero: (document.querySelector('#view-home .hero-sub') || {}).textContent || '',
    big: c && c.querySelector('.gbig').textContent.trim(), sub: c && c.querySelector('.gsub').textContent.trim(),
    cachedSummary: hub.get('f260.summary', { app: 'f260', scope: 'person' }), lastPull: hub.sync.lastPull, state: hub.sync.state };
});
const f260View = f => f.evaluate(() => ({ todayKind: document.querySelector('#todayKind').textContent, todayTitle: document.querySelector('#todayTitle').textContent,
  streak: document.querySelector('#streak').textContent.replace(/\s+/g, ' ').trim(), heroKind: document.querySelector('#heroKind').textContent }));
const serverSummary = async L => { const r = await L.apiAs('mom', '/api/data/f260?scope=person&key=f260.summary'); return r.body && r.body.item; };
const serverLogTail = async L => { const r = await L.apiAs('mom', '/api/data/f260?scope=person&key=f260.log'); return Object.keys((r.body.item && r.body.item.value) || {}).sort().slice(-3); };
const backHome = async d => { await d.goto('#home'); await d.page.waitForFunction(() => hub.sync.lastPull > 0 && document.querySelector('#view-home .gcard'), null, { timeout: 15000 }); await sleep(900); };
const out = {};

// ── A: overnight on one device ───────────────────────────────────────────────────────────────────────────────────
{
  const L = await local({ variant: 'typical', clock: 'demo' });
  const d = await L.device({ device: 'ipad-portrait', profile: 'mom', installClock: DEMO });
  await backHome(d);
  const tue = await home(d.page);
  const srvTue = await serverSummary(L);
  console.log(`[A] Tue ${tue.now}\n    Home hero "${tue.hero}" | card "${tue.big}" / "${tue.sub}"`);
  console.log(`    server f260.summary readToday=${srvTue && srvTue.value.readToday}, updated_at ${srvTue && new Date(srvTue.updated_at).toString()}; log tail ${JSON.stringify(await serverLogTail(L))}`);

  // midnight passes with the iPad left on Home
  await L.clock(new Date(DEMO + DAY).toISOString());
  await d.ctx.clock.fastForward(DAY);
  await d.page.click('#tabbar .tab[data-tab="apps"]'); await sleep(300);
  await d.page.evaluate(() => hub.pull()); await sleep(600);
  await d.page.click('#tabbar .tab[data-tab="home"]'); await sleep(800);
  const wedStayed = await home(d.page);
  console.log(`[A] Wed (same tab, clock fast-forwarded 24 h, repainted after a pull) ${wedStayed.now}\n    Home hero "${wedStayed.hero}" | card "${wedStayed.big}" / "${wedStayed.sub}"`);
  await d.page.screenshot({ path: path.join(OUT, 'verify-stale-1-wed-home.png'), scale: 'css', animations: 'disabled', caret: 'hide' });

  // a full reload on Wednesday too (the case of opening the Home Screen app fresh)
  await backHome(d);
  const wedReload = await home(d.page);
  console.log(`[A] Wed after a full reload: hero "${wedReload.hero}" | card "${wedReload.big}" / "${wedReload.sub}"`);

  const f = await d.openApp('f260', { wait: '#todayTitle:not(:empty)' }); await sleep(1200);
  const f260 = await f260View(f);
  console.log(`[A] F260 on Wed says: todayKind "${f260.todayKind}", title "${f260.todayTitle}", streak "${f260.streak}"`);
  await sleep(1500);                                   // let the summary write flush
  const srvWed = await serverSummary(L);
  await backHome(d);
  const wedAfter = await home(d.page);
  console.log(`[A] server f260.summary after F260 opened: readToday=${srvWed && srvWed.value.readToday}, updated_at ${srvWed && new Date(srvWed.updated_at).toString()}`);
  console.log(`[A] Home after F260 opened: hero "${wedAfter.hero}" | card "${wedAfter.big}" / "${wedAfter.sub}"`);
  out.A = { tue, srvTue, wedStayed, wedReload, f260, srvWed, wedAfter, logs: d.logs.filter(l => /error/i.test(l)).slice(0, 10) };
  await L.close();
}

// ── B: four days later, streak ───────────────────────────────────────────────────────────────────────────────────
{
  const L = await local({ variant: 'typical', clock: 'demo' });
  const SAT = DEMO + 4 * DAY;
  await L.clock(new Date(SAT).toISOString());
  const d = await L.device({ device: 'ipad-portrait', profile: 'mom', fixedTime: SAT });
  await backHome(d);
  const sat = await home(d.page);
  console.log(`\n[B] Sat ${sat.now}; log tail ${JSON.stringify(await serverLogTail(L))}\n    Home hero "${sat.hero}" | card "${sat.big}" / "${sat.sub}"`);
  await d.page.screenshot({ path: path.join(OUT, 'verify-stale-1-sat-home.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  const f = await d.openApp('f260', { wait: '#todayTitle:not(:empty)' }); await sleep(1200);
  const f260 = await f260View(f);
  console.log(`[B] F260 on Sat says: todayKind "${f260.todayKind}", heroKind "${f260.heroKind}", streak "${f260.streak}"`);
  await sleep(1500);
  await backHome(d);
  const satAfter = await home(d.page);
  console.log(`[B] Home after F260 opened: hero "${satAfter.hero}" | card "${satAfter.big}" / "${satAfter.sub}"`);
  out.B = { sat, f260, satAfter };
  await L.close();
}
fs.writeFileSync(path.join(OUT, 'verify-stale-1.json'), JSON.stringify(out, null, 1));
console.log('\nwrote audits/evidence/p2/HOME/verify-stale-1.json');
