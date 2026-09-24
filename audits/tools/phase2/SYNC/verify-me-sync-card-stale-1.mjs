// Skeptic #1 for SYNC finding "me-sync-card-stale": does the Me -> Sync card really stay stale after hub.sync changes?
//   node "audits/tools/phase2/SYNC/verify-me-sync-card-stale-1.mjs"            (both engines)
//   node "audits/tools/phase2/SYNC/verify-me-sync-card-stale-1.mjs" webkit     (one engine)
// Independent of e7: fresh local instance per engine, real clock, a second paired phone for Eli.
// A. land on #me directly, wait for the first pull to succeed, read the card vs hub.sync vs the tab-bar dot; wait past the
//    30 s periodic pull and read again.
// B. pick a theme on Me (a person-scope write) -> card at once and 5 s later vs hub.sync and the server's row.
// C. controls: Home -> Me by tab tap repaints correctly; "Check now" repaints correctly.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
fs.mkdirSync(EVID, { recursive: true });
const engines = process.argv[2] ? [process.argv[2]] : ['webkit', 'chromium'];
const t0 = Date.now();
const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's', ...a);
const waitFor = async (fn, timeout = 15000) => { const until = Date.now() + timeout; while (Date.now() < until) { try { const v = await fn(); if (v) return v; } catch {} await sleep(200); } return null; };
const all = {};

for (const engine of engines) {
  const out = all[engine] = {};
  const L = await local({ variant: 'typical', clock: 'real', engine });
  try {
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    const page = phone.page;
    const read = () => page.evaluate(() => {
      const c = [...document.querySelectorAll('#view-me .card')].find(c => c.querySelector('h2') && /^Sync/.test(c.querySelector('h2').textContent));
      const card = c ? [...c.querySelectorAll('.kv')].slice(0, 3).map(k => k.textContent.replace(/\s+/g, ' ').trim()).join(' | ') : null;
      return { tab: document.documentElement.dataset.tab, card, tabbarDot: document.getElementById('syncdot').className, sync: { ...hub.sync } };
    });
    const shot = async name => {
      await page.evaluate(() => { const c = [...document.querySelectorAll('#view-me .card')].find(c => c.querySelector('h2') && /^Sync/.test(c.querySelector('h2').textContent)); if (c) c.scrollIntoView({ block: 'center' }); }); await sleep(300);
      const f = path.join(EVID, `verify-me-sync-card-stale-1-${engine}-${name}.png`); await page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f).split(path.sep).join('/'); };

    // A
    await phone.goto('#me');
    out.A0_atLoad = await read();
    await waitFor(() => page.evaluate(() => hub.sync.lastPull > 0));
    await sleep(1500);
    out.A1_afterFirstPull = await read();
    out.A1_shot = await shot('A1-me-direct-after-pull');
    log(`[${engine}] A1 Me opened directly, first pull done: card "${out.A1_afterFirstPull.card}" · tab-bar dot "${out.A1_afterFirstPull.tabbarDot}" · hub.sync ${JSON.stringify(out.A1_afterFirstPull.sync)}`);
    const firstPull = out.A1_afterFirstPull.sync.lastPull;
    await waitFor(() => page.evaluate(fp => hub.sync.lastPull > fp, firstPull), 40000);
    out.A2_afterPeriodicPull = await read();
    log(`[${engine}] A2 after the 30 s periodic pull: card "${out.A2_afterPeriodicPull.card}" · hub.sync.lastPull ${new Date(out.A2_afterPeriodicPull.sync.lastPull).toLocaleTimeString()} (first was ${new Date(firstPull).toLocaleTimeString()})`);

    // C1 control: Home -> Me by tab tap
    await page.click('#tabbar .tab[data-tab="home"]'); await sleep(300);
    await page.click('#tabbar .tab[data-tab="me"]'); await sleep(300);
    out.C1_afterTabTap = await read();
    log(`[${engine}] C1 control, Home -> Me tab tap: card "${out.C1_afterTabTap.card}"`);

    // B theme pick
    const cur = await page.evaluate(() => hub.theme());
    const pick = cur === 'parchment' ? 'frost' : 'parchment';
    await page.click(`#theme [data-theme="${pick}"]`);
    out.B0_rightAfterPick = await read();
    await sleep(5000);
    out.B1_fiveSecondsLater = await read();
    out.B1_shot = await shot('B1-me-5s-after-theme');
    const srv = await L.apiAs('eli', '/api/data/hub?scope=person');
    const row = (srv.body.items || []).find(i => i.key === 'theme');
    out.B1_serverThemeRow = row ? { value: row.value, updated_at: row.updated_at } : null;
    log(`[${engine}] B0 right after picking ${pick}: card "${out.B0_rightAfterPick.card}"`);
    log(`[${engine}] B1 5 s later: card "${out.B1_fiveSecondsLater.card}" · tab-bar dot "${out.B1_fiveSecondsLater.tabbarDot}" · hub.sync ${JSON.stringify(out.B1_fiveSecondsLater.sync)} · server theme row ${JSON.stringify(out.B1_serverThemeRow)}`);

    // C2 control: Check now
    await page.click('#syncnow'); await sleep(1200);
    out.C2_afterCheckNow = await read();
    log(`[${engine}] C2 control, after "Check now": card "${out.C2_afterCheckNow.card}"`);
    if (phone.logs.length) out.consoleLogs = phone.logs.slice(0, 20);
  } finally { await L.close(); }
}
const f = path.join(EVID, 'verify-me-sync-card-stale-1.json');
fs.writeFileSync(f, JSON.stringify(all, null, 1));
log('evidence', path.relative(ROOT, f));
