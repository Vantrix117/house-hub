// Skeptic #1 for "critic-critic-plot-clear-not-synced-2" (Dollywood build guide, Scale tab plot width).
//   node "audits/tools/phase3/dollywood/verify-critic-critic-plot-clear-not-synced-2-1.mjs"
// Claims under test:  savePlot writes hub.set('plot', v||null) (apps/dollywood.html:1055); adopt() only applies a non-null
// remote plot (:1110), so a second open device keeps the old width after it pulls the cleared row; and the boot pre-fill
// from legacy localStorage 'dw-plot' (:1057) brings the old width back whenever the hub row is empty.
// This run uses the NATURAL legacy path (no hand-set hub.migrated): device A starts with dw-plot='1000' and lets
// hub.migrate run itself (server already has 400, so nothing moves). A clears the field by keyboard, B pulls, then A reloads.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const NAME = 'verify-critic-critic-plot-clear-not-synced-2-1';
const out = {}; const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const L = await local({ variant: 'typical', engine: 'webkit' });
const serverPlot = async () => { const r = await L.apiAs('eli', '/api/data/dollywood?scope=person&since=0'); const it = (r.body.items || []).find(i => i.key === 'plot'); return it ? { value: it.value, deleted: !!it.deleted } : '(no row)'; };
const reopen = async d => { await d.page.reload({ waitUntil: 'load' }); await sleep(2000); const until = Date.now() + 30000; while (Date.now() < until) { const f = d.frame('dollywood'); const ok = f && await f.evaluate(() => !!document.getElementById('sc-plot') && / done/.test((document.getElementById('b-count')||{}).textContent||'')).catch(() => false); if (ok) return f; await sleep(250); } const urls = d.page.frames().map(f => f.url()); throw new Error('no dollywood frame after reload: ' + urls.join(' , ')); };
const ready = async f => { await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent) && window.hub && hub.sync && hub.sync.state === 'synced', null, { timeout: 30000 }); await sleep(1000); };
const read = f => f.evaluate(() => ({ plotInput: document.getElementById('sc-plot').value, fac: scale.fac, facText: document.getElementById('sc-fac').textContent, hubPlot: hub.get('plot') ?? null, hubHas: hub.has('plot'), lsDwPlot: localStorage.getItem('dw-plot'), migrated: localStorage.getItem('hub.migrated') }));
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const A = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false, localStorage: { 'dw-plot': '1000' } });
  const fa = await A.openApp('dollywood', { wait: '#b-count' }); await ready(fa);
  const B = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const fb = await B.openApp('dollywood', { wait: '#b-count' }); await ready(fb);
  log('before', { server: await serverPlot(), ipadA: await read(fa), phoneB: await read(fb) });

  await fa.evaluate(() => { showTab('scale'); document.getElementById('sc-plot').scrollIntoView({ block: 'center' }); }); await sleep(400);
  const inp = await fa.$('#sc-plot'); await inp.click({ clickCount: 3 }); await A.page.keyboard.press('Backspace'); await A.page.keyboard.press('Tab');
  await sleep(3000);
  log('afterClearOnA', { server: await serverPlot(), ipadA: await read(fa) });

  await fb.evaluate(() => hub.pull()); await sleep(2000);
  log('phoneBAfterPull', await read(fb));
  await fb.evaluate(() => { try { showTab('scale'); } catch (e) {} }); await sleep(300);

  // A reloads (same localStorage; dw-plot never removed by the clear or by migrate)
  const fa2 = await reopen(A); await ready(fa2);
  await fa2.evaluate(() => { try { showTab('scale'); } catch (e) {} }); await sleep(300);
  log('ipadAAfterReload', { ...(await read(fa2)), server: await serverPlot() });

  // control: B reloads (no dw-plot key) -> should read empty
  const fb2 = await reopen(B); await ready(fb2);
  log('phoneBAfterReload', await read(fb2));
} finally {
  fs.writeFileSync(path.join(EV, NAME + '.json'), JSON.stringify(out, null, 1));
  await L.close();
}
