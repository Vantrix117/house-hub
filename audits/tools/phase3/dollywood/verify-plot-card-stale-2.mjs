// Phase 3 / dollywood — skeptic #2 for finding "plot-card-stale": after load, does the step card's in-game line ignore a
// saved plot width? Independent of data-checks.mjs. Uses the TYPICAL seed (Eli, plot '400', a realistic width) and the phone.
//   node "audits/tools/phase3/dollywood/verify-plot-card-stale-2.mjs"
// Arms:
//   A  first open on the iPhone PWA: card line right after load vs #sc-plot / scale.fac, then after Next+Prev
//   B  every step of the guide: does gameLine() output differ between fac=null and the saved fac (i.e. are NUMBERS wrong, not
//      only the "set a plot width" label)? counts steps whose horizontal metres change
//   C  typing a new plot width in the Scale tab: does the open step card follow? (updScale :1049-1052 has no renderStep)
//   D  a remote change of 'plot' from a second device (hub.onChange -> adopt, :1110): does the open card follow?
// Writes audits/evidence/p3/dollywood/verify-plot-card-stale-2.json (DOM text only; the phone's collapsed sheet hides the card in a screenshot).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const f = await d.openApp('dollywood', { wait: '#b-count' });
  await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
  await sleep(1500);
  const card = () => f.evaluate(() => { const g = document.querySelector('#b-now .meas.game'); return { sec: curSec, step: stepsOf(curSec)[curIdx].id, gameLine: g ? g.textContent.replace(/\s+/g, ' ').trim() : null, plotInput: document.getElementById('sc-plot').value, scaleFac: scale.fac, hubPlot: hub.get('plot') }; });
  const a0 = await card();
  await f.evaluate(() => { document.getElementById('b-next').click(); document.getElementById('b-prev').click(); }); await sleep(500);
  log('A.firstOpen', { afterLoad: a0, afterNextPrev: await card() });

  // B: which steps' numbers depend on the factor
  const B = await f.evaluate(() => {
    const saved = scale.fac; const rows = [];
    for (const s of D.steps) { if (!s.elev) continue; const sec = SEC[s.section];
      scale.fac = null; const one = gameLine(s.elev, sec).replace(/<[^>]+>/g, '');
      scale.fac = saved; const sc = gameLine(s.elev, sec).replace(/<[^>]+>/g, '');
      const strip = t => t.replace(/at 1:1.*$|at \d+% scale.*$/, '').trim();
      if (one && strip(one) !== strip(sc)) rows.push({ id: s.id, at1to1: strip(one).slice(0, 160), atSaved: strip(sc).slice(0, 160) }); }
    scale.fac = saved; return { stepsWithElev: D.steps.filter(s => s.elev).length, stepsWhoseNumbersChange: rows.length, sample: rows.slice(0, 4) };
  });
  log('B.numbersDependOnFac', B);

  // C: go to a step whose numbers change, then type a new plot width in the Scale tab
  if (B.sample.length) {
    const id = B.sample[0].id;
    await f.evaluate(id => { const s = D.steps.find(x => x.id === id); if (curSec !== s.section) selectSection(s.section, false); curIdx = stepsOf(s.section).findIndex(x => x.id === id); renderStep(); }, id);
    const before = await card();
    await f.evaluate(() => { showTab('scale'); const el = document.getElementById('sc-plot'); el.focus(); el.value = '800'; el.dispatchEvent(new Event('input', { bubbles: true })); el.blur(); showTab('list'); });
    await sleep(800);
    const afterType = await card();
    await f.evaluate(() => { document.getElementById('b-next').click(); document.getElementById('b-prev').click(); }); await sleep(400);
    log('C.typeNewPlot', { before, afterType, afterNextPrev: await card() });
    // D: remote change from the server as Eli, then wait for a pull
    const r = await L.apiAs('eli', '/api/data/dollywood/batch?scope=person', { method: 'POST', body: { items: [{ key: 'plot', value: '1600', updated_at: Date.now() + 1000 }] } });
    await f.evaluate(() => hub.sync && hub.sync.pull ? hub.sync.pull() : null).catch(() => {});
    let got = null; for (let i = 0; i < 45; i++) { got = await card(); if (got.plotInput === '1600') break; await sleep(1000); }
    log('D.remotePlot', { post: r.status, afterPull: got });
  }
  await d.close();

  // A2: the load case with the realistic plot (400): clear Eli's progress so the boot section opens on entrance-01, fresh device
  const rp = await L.apiAs('eli', '/api/data/dollywood/batch?scope=person', { method: 'POST', body: { items: [{ key: 'progress', value: {}, updated_at: Date.now() + 5000 }, { key: 'plot', value: '400', updated_at: Date.now() + 5000 }] } });
  const d2 = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const f2 = await d2.openApp('dollywood', { wait: '#b-count' });
  await f2.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
  await sleep(1500);
  const card2 = () => f2.evaluate(() => { const g = document.querySelector('#b-now .meas.game'); return { step: stepsOf(curSec)[curIdx].id, gameLine: g ? g.textContent.replace(/\s+/g, ' ').trim() : null, plotInput: document.getElementById('sc-plot').value, scaleFac: scale.fac }; });
  const l0 = await card2();
  await f2.evaluate(() => { document.getElementById('b-next').click(); document.getElementById('b-prev').click(); }); await sleep(500);
  log('A2.loadRealisticPlot', { post: rp.status, afterLoad: l0, afterNextPrev: await card2() });
  await d2.close();
} finally {
  fs.writeFileSync(path.join(EV, 'verify-plot-card-stale-2.json'), JSON.stringify(out, null, 1));
  await L.close();
}
