// Skeptic #2 for finding "home-full-rebuild-every-pull": does every routine 30 s pull with no data change rebuild all of Home?
//
//   node "audits/tools/phase2/HOME/verify-home-full-rebuild-every-pull-2.mjs" [webkit,chromium]   (both by default; ~2 min each)
//
// Independent of leads.mjs. Real browser clock (hub.sync.lastPull must move), Kitchen iPad portrait, Eli (adult).
//   A1  one manual hub.pull(): data changes delivered (hub.onChange), #view-home nodes kept, <img> count, network requests
//       for art/ during the rebuild, visible text identical before/after, scroll position kept.
//   A2  natural cadence: nothing touched for 65 s — how many pulls, how many data changes, how many #view-home rebuilds.
//   A3  cost: hub.pull() duration (network + onSync listeners, i.e. renderHome) on Home versus on Me (which does not
//       re-render on a pull), 8 interleaved runs each; medians.
//   A4  an app opened from a Home card (the shell's tab stays 'home'): does Home keep rebuilding behind the app viewer?
//   B   the TV kiosk board (the one surface CLAUDE.md promises is repainted in place): nodes kept after a pull.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/HOME');
fs.mkdirSync(OUT, { recursive: true });
const ENGINES = (process.argv[2] || 'webkit,chromium').split(',');
const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const results = {};

const instrument = page => page.evaluate(() => {
  const v = document.querySelector('#view-home');
  window.__s = { pulls: [], changes: [], rebuilds: 0 };
  hub.onSync(s => { const a = window.__s.pulls; if (s.lastPull && a[a.length - 1] !== s.lastPull) a.push(s.lastPull); });
  window.__s.pulls = [hub.sync.lastPull];
  hub.onChange(c => window.__s.changes.push({ app: c.app, key: c.key }));
  // a rebuild = a childList mutation on #view-home that removes its top-level children (innerHTML = …)
  new MutationObserver(recs => { if (recs.some(r => r.removedNodes.length)) window.__s.rebuilds++; }).observe(v, { childList: true });
});
const resetCounters = page => page.evaluate(() => { window.__s.pulls = [hub.sync.lastPull]; window.__s.changes = []; window.__s.rebuilds = 0; });
const counters = page => page.evaluate(() => ({ pulls: window.__s.pulls.length - 1, changes: window.__s.changes.length, changeKeys: window.__s.changes.slice(0, 5), rebuilds: window.__s.rebuilds }));

// one pull, observed from inside the page: nodes kept, images, text identical, scroll kept
const onePull = (page, sel) => page.evaluate(async sel => {
  const v = document.querySelector(sel);
  const scroller = document.querySelector('#views');
  if (scroller) scroller.scrollTop = 300;
  const before = [...v.querySelectorAll('*')]; before.forEach(e => { e.__old = 1; });
  const imgsBefore = [...v.querySelectorAll('img')];
  const textBefore = v.innerText;
  const scrollBefore = scroller ? scroller.scrollTop : null;
  const changes0 = window.__s ? window.__s.changes.length : 0;
  const t0 = performance.now();
  await hub.pull();
  const pullMs = performance.now() - t0;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const after = [...v.querySelectorAll('*')];
  const imgsAfter = [...v.querySelectorAll('img')];
  const textAfter = v.innerText;
  let diffAt = -1; if (textAfter !== textBefore) { diffAt = 0; while (textBefore[diffAt] === textAfter[diffAt]) diffAt++; }
  return {
    nodesBefore: before.length, nodesAfter: after.length, nodesKept: after.filter(e => e.__old).length,
    imgsBefore: imgsBefore.length, imgsAfter: imgsAfter.length, imgsSameElement: imgsAfter.filter(i => imgsBefore.includes(i)).length,
    imgSrcs: [...new Set(imgsAfter.map(i => i.getAttribute('src')))],
    textIdentical: textAfter === textBefore, textDiff: diffAt < 0 ? null : { before: textBefore.slice(Math.max(0, diffAt - 30), diffAt + 30), after: textAfter.slice(Math.max(0, diffAt - 30), diffAt + 30) },
    scrollBefore, scrollAfter: scroller ? scroller.scrollTop : null,
    dataChangesDelivered: window.__s ? window.__s.changes.length - changes0 : null,
    pullMs: Math.round(pullMs), pullPlusTwoFramesMs: Math.round(performance.now() - t0),
    tab: document.documentElement.dataset.tab,
  };
}, sel);

for (const engine of ENGINES) {
  const L = await local({ variant: 'typical', clock: 'real', engine });
  const R = results[engine] = {};
  try {
    // ── A: the Kitchen iPad, adult Home ─────────────────────────────────────────────────────────────────────────
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const reqs = [];
    d.page.on('request', r => reqs.push(r.url()));
    await d.goto('#home');
    await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#feed .fline'), null, { timeout: 20000 });
    await sleep(1500);
    await instrument(d.page);

    // A1 one manual pull
    const r0 = reqs.length;
    R.A1 = await onePull(d.page, '#view-home');
    const during = reqs.slice(r0);
    R.A1.requestsDuringPull = during.map(u => u.replace(L.site, 'SITE').replace(L.api, 'API').replace(/\?.*$/, '?…'));
    R.A1.artRequestsDuringPull = during.filter(u => /\/art\//.test(u)).length;
    console.log(`[${engine}] A1 one pull, data changes delivered: ${R.A1.dataChangesDelivered}; #view-home nodes kept ${R.A1.nodesKept}/${R.A1.nodesAfter}; <img> ${R.A1.imgsAfter} (same element kept: ${R.A1.imgsSameElement}); art/ requests: ${R.A1.artRequestsDuringPull}; visible text identical: ${R.A1.textIdentical}${R.A1.textDiff ? ' ' + JSON.stringify(R.A1.textDiff) : ''}; scroll ${R.A1.scrollBefore} → ${R.A1.scrollAfter}; pull ${R.A1.pullMs} ms, +2 frames ${R.A1.pullPlusTwoFramesMs} ms`);

    // A2 natural cadence, hands off
    await resetCounters(d.page);
    const t0 = Date.now();
    await sleep(65000);
    R.A2 = { seconds: Math.round((Date.now() - t0) / 1000), ...(await counters(d.page)), hidden: await d.page.evaluate(() => document.hidden) };
    console.log(`[${engine}] A2 hands-off ${R.A2.seconds} s on Home: ${R.A2.pulls} pulls, ${R.A2.changes} data changes, ${R.A2.rebuilds} full #view-home rebuilds (document.hidden=${R.A2.hidden})`);

    // A3 cost of the re-render: pull duration on Home vs Me (Me does not re-render on a pull)
    const home = [], me = [];
    for (let i = 0; i < 8; i++) {
      for (const [t, arr] of [['home', home], ['me', me]]) {
        await d.page.click(`#tabbar .tab[data-tab="${t}"]`); await sleep(600);
        arr.push(await d.page.evaluate(async () => { const t0 = performance.now(); await hub.pull(); const a = performance.now() - t0; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return { pull: Math.round(a * 10) / 10, twoFrames: Math.round((performance.now() - t0) * 10) / 10 }; }));
      }
    }
    R.A3 = { home, me, medianPullHome: median(home.map(x => x.pull)), medianPullMe: median(me.map(x => x.pull)), medianTwoFramesHome: median(home.map(x => x.twoFrames)), medianTwoFramesMe: median(me.map(x => x.twoFrames)) };
    console.log(`[${engine}] A3 hub.pull() median on Home ${R.A3.medianPullHome} ms (+2 frames ${R.A3.medianTwoFramesHome}) vs on Me ${R.A3.medianPullMe} ms (+2 frames ${R.A3.medianTwoFramesMe}) → re-render share ≈ ${Math.round((R.A3.medianPullHome - R.A3.medianPullMe) * 10) / 10} ms per pull`);

    // A4 an app opened from a Home card: tab stays 'home' → does Home rebuild behind the viewer?
    await d.page.click('#tabbar .tab[data-tab="home"]'); await sleep(800);
    await d.page.click('#view-home [data-open="prayer"]');
    await d.page.waitForFunction(() => document.querySelector('#viewer.on'), null, { timeout: 10000 });
    await sleep(1500);
    await resetCounters(d.page);
    const a4 = await d.page.evaluate(async () => { await hub.pull(); await new Promise(r => setTimeout(r, 200)); return { tab: document.documentElement.dataset.tab, viewerOn: !!document.querySelector('#viewer.on'), homeViewVisible: document.querySelector('#view-home').getBoundingClientRect().height > 0 && getComputedStyle(document.querySelector('#view-home')).display !== 'none' }; });
    R.A4 = { ...a4, ...(await counters(d.page)) };
    console.log(`[${engine}] A4 Prayer open from a Home card (viewer on: ${R.A4.viewerOn}, shell tab '${R.A4.tab}'): one shell pull → ${R.A4.rebuilds} #view-home rebuild(s) behind the app, ${R.A4.changes} data changes`);
    await d.close();

    // ── B: the TV kiosk board — built once, repainted in place (index.html:977-983) ─────────────────────────────
    const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
    await tv.goto('#home');
    await tv.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#tv'), null, { timeout: 20000 });
    await sleep(1500);
    await instrument(tv.page);
    R.B = await onePull(tv.page, '#view-home');
    R.B.rebuilds = (await counters(tv.page)).rebuilds;
    console.log(`[${engine}] B TV board, one pull: nodes kept ${R.B.nodesKept}/${R.B.nodesAfter}, <img> same element ${R.B.imgsSameElement}/${R.B.imgsAfter}, rebuilds ${R.B.rebuilds}`);
    await tv.close();
  } catch (e) {
    R.error = String(e && e.stack || e);
    console.log(`[${engine}] ERROR ${R.error}`);
  } finally {
    await L.close();
  }
}
fs.writeFileSync(path.join(OUT, 'verify-home-full-rebuild-every-pull-2.json'), JSON.stringify(results, null, 1));
console.log('\nwrote audits/evidence/p2/HOME/verify-home-full-rebuild-every-pull-2.json');
