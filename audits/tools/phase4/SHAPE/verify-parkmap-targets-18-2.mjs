// Skeptic #2 for SHAPE "parkmap-targets-18": re-measure every control the finding lists in the park map, on iPhone,
// iPad portrait and desktop, as an adult (Eli) on a park day. For each: own box, the EFFECTIVE hit box (an <input> inside a
// <label> is toggled by the whole label), computed min-height, and whether (pointer:coarse) matches in that context.
//   node audits/tools/phase4/SHAPE/verify-parkmap-targets-18-2.mjs → audits/evidence/p4/SHAPE/verify-parkmap-targets-18-2.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits/evidence/p4/SHAPE');
const SELS = {
  handle: '#lv-handle', segNear: '#near-mode-near', segWaits: '#near-mode-waits', setSpot: '#loc-place',
  whoChip: '#near-list .lv-who-chips button', filterChip: '#near-list .lv-chips:not(.lv-who-chips) button', srcLink: '#lv-src a',
  meetGo: '#meet-go', meetDone: '#meet-done', share: '#lv-share', beacon: '#fam-list label.lv-share input', kidStep: '.lv-kid .st button',
  togInput: '#toggles label.tog input', slope: '#l-slope', seclab: '#l-seclab', about: '#about > summary', routeX: '#route-x', popX: '#pop-x',
  tabs: '#loc-near',
};
function measure(SELS) {
  const vis = el => { const s = getComputedStyle(el); const b = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && b.width > 0 && b.height > 0; };
  const r = b => ({ w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 });
  const o = { coarse: matchMedia('(pointer:coarse)').matches, W: innerWidth, sheet: document.getElementById('lv-sheet')?.dataset.state };
  for (const [k, s] of Object.entries(SELS)) {
    const el = [...document.querySelectorAll(s)].find(vis); if (!el) { o[k] = null; continue; }
    const lab = el.tagName === 'INPUT' ? el.closest('label') : null;
    o[k] = { own: r(el.getBoundingClientRect()), eff: lab ? r(lab.getBoundingClientRect()) : null, minH: getComputedStyle(el).minHeight, text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30) };
  }
  // the sheet's drag zone: sheet box minus its scrolling body (pointerdown outside .lv-body starts a drag, :1473)
  const sh = document.getElementById('lv-sheet'), bd = sh && sh.querySelector('.lv-body');
  if (sh && bd) { const a = sh.getBoundingClientRect(), b = bd.getBoundingClientRect(); o.dragZoneH = Math.round(b.top - a.top); }
  return o;
}
const out = { runs: [] };
const L = await local({ variant: 'park', engine: 'webkit' });
try {
  for (const device of ['iphone-pwa', 'ipad-portrait', 'desktop']) {
    const d = await L.device({ device, mode: 'light', profile: 'eli' });
    const run = { device, steps: {} }; out.runs.push(run);
    try {
      const f = await d.openApp('dollywood-live');
      await f.waitForSelector('#lv-pill[data-state]', { timeout: 15000 }); await sleep(4000);
      const tab = async id => { await f.locator(id).click(); await sleep(700); };
      run.steps.open = await f.evaluate(measure, SELS);
      await tab('#loc-near'); run.steps.near = await f.evaluate(measure, SELS);
      await f.locator('#near-mode-waits').click().catch(() => {}); await sleep(600); run.steps.waits = await f.evaluate(measure, SELS);
      await tab('#lv-family'); run.steps.family = await f.evaluate(measure, SELS);
      if (device === 'iphone-pwa') await d.page.screenshot({ path: path.join(EV, 'verify-parkmap-targets-18-2-family-iphone.png'), scale: 'css' });
      await tab('#lv-layers-tab'); await f.evaluate(() => { const b = document.querySelector('#lv-sheet .lv-body'); if (b) b.scrollTop = 1e5; }); await sleep(300);
      run.steps.layers = await f.evaluate(measure, SELS);
      if (device === 'iphone-pwa') await d.page.screenshot({ path: path.join(EV, 'verify-parkmap-targets-18-2-layers-iphone.png'), scale: 'css' });
      // place a spot, then route to the meeting point → route-x
      await tab('#loc-near'); await f.locator('#loc-place').click({ timeout: 4000 }).catch(e => run.placeErr = e.message.slice(0, 80)); await sleep(500); await f.locator('#lv-act').click().catch(() => {}); await sleep(800);
      await f.locator('#meet-go').click({ timeout: 3000 }).catch(e => run.meetGoErr = e.message.slice(0, 80)); await sleep(1200);
      run.steps.route = await f.evaluate(measure, SELS);
      await f.locator('#route-x').click({ timeout: 2000 }).catch(() => {}); await sleep(500);
      // open a listing card → pop-x
      await tab('#lv-search'); await f.locator('#q').fill('Thunderhead'); await sleep(600);
      await f.locator('#tab-list .oi').first().click({ timeout: 3000 }).catch(e => run.cardErr = e.message.slice(0, 80)); await sleep(1500);
      run.steps.card = await f.evaluate(measure, SELS);
    } catch (e) { run.error = e.message.slice(0, 200); console.log('ERR', device, e.message); }
    await d.close();
  }
} finally { await L.close(); }
// roll up the minimum own and effective size per key across steps and devices
const roll = {};
for (const run of out.runs) for (const st of Object.values(run.steps)) for (const [k, v] of Object.entries(st)) {
  if (!v || typeof v !== 'object' || !v.own) continue;
  const e = v.eff || v.own; const R = roll[k] ||= {};
  const cur = R[run.device]; const m = { own: `${v.own.w}x${v.own.h}`, eff: `${e.w}x${e.h}`, minSide: Math.min(e.w, e.h), coarse: st.coarse, minH: v.minH };
  if (!cur || m.minSide < cur.minSide) R[run.device] = m;
}
out.roll = roll;
out.dragZone = Object.fromEntries(out.runs.map(r => [r.device, r.steps.open?.dragZoneH]));
fs.writeFileSync(path.join(EV, 'verify-parkmap-targets-18-2.json'), JSON.stringify(out, null, 1));
for (const [k, R] of Object.entries(roll)) console.log(k.padEnd(11), Object.entries(R).map(([dv, m]) => `${dv}: own ${m.own} eff ${m.eff} coarse ${m.coarse}`).join(' | '));
console.log('dragZone', out.dragZone, 'errs', out.runs.map(r => [r.device, r.placeErr, r.meetGoErr, r.cardErr, r.error]));
