// Phase 3 / dollywood — completeness critic: two suspected defects the report does not cover.
//   node "audits/tools/phase3/dollywood/critic-keys-plot.mjs" [keys] [plot]
// keys  The document keydown handler (apps/dollywood.html:852-857) ignores ctrlKey / metaKey / altKey. So the browser
//       shortcuts Ctrl/Cmd+D (bookmark), Ctrl/Cmd+P (print) and Ctrl/Cmd +/−/0 (page zoom) are swallowed
//       (preventDefault) and instead run stepDone() (a real progress write + feed line), stepNav(-1) and the map zoom.
// plot  Clearing the Scale tab's plot width writes hub.set('plot', null) (:1055), but adopt() only applies a non-null
//       plot (:1110), so another open device keeps the old width; and a device holding the legacy 'dw-plot' key
//       pre-fills that value on every boot (:1057) whenever the person's hub plot is empty.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const want = process.argv.slice(2); const on = a => !want.length || want.includes(a);
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const L = await local({ variant: 'typical', engine: 'webkit' });
const serverProgress = async () => { const r = await L.apiAs('eli', '/api/data/dollywood?scope=person&since=0'); const it = (r.body.items || []).find(i => i.key === 'progress'); const v = it && it.value || {}; return { trueTicks: Object.values(v).filter(Boolean).length, updated_at: it && it.updated_at }; };
const serverPlot = async () => { const r = await L.apiAs('eli', '/api/data/dollywood?scope=person&since=0'); const it = (r.body.items || []).find(i => i.key === 'plot'); return it ? it.value : '(no row)'; };
const open = async (opts) => { const d = await L.device({ profile: 'eli', fixedTime: false, ...opts }); const f = await d.openApp('dollywood', { wait: '#b-count' }); await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent) && window.hub && hub.sync && hub.sync.state === 'synced', null, { timeout: 30000 }); await sleep(800); return { d, f }; };
try {
  if (on('keys')) {
    const { d, f } = await open({ device: 'desktop' });
    const state = () => f.evaluate(() => ({ step: curIdx, sec: curSec, count: document.getElementById('b-count').textContent, doneBtn: (document.getElementById('b-done') || {}).textContent, view: view.map(v => Math.round(v)) }));
    const feedBefore = ((await L.apiAs('eli', '/api/activity?limit=30')).body.activity || []).map(a => a.id);
    // focus the page body (not an input), as a person does after clicking the map header
    const h1 = await f.$('h1'); const b = await h1.boundingBox(); await d.page.mouse.click(b.x + 5, b.y + 5);
    const s0 = await state(); const p0 = await serverProgress();
    // does the page cancel the browser shortcut?
    await f.evaluate(() => { window.__prevented = []; document.addEventListener('keydown', e => setTimeout(() => window.__prevented.push({ key: e.key, ctrl: e.ctrlKey, meta: e.metaKey, prevented: e.defaultPrevented }), 0)); });
    await d.page.keyboard.press('Control+d'); await sleep(2500);
    const s1 = await state(); const p1 = await serverProgress();
    await d.page.keyboard.press('Meta+d'); await sleep(2500);
    const s2 = await state(); const p2 = await serverProgress();
    await d.page.keyboard.press('Control+p'); await sleep(600);
    const s3 = await state();
    await d.page.keyboard.press('Control+Equal'); await sleep(900);
    const s4 = await state();
    const prevented = await f.evaluate(() => window.__prevented);
    const feedAfter = ((await L.apiAs('eli', '/api/activity?limit=30')).body.activity || []).filter(a => !feedBefore.includes(a.id)).map(a => `${a.app_id}: ${a.text}`);
    await d.page.screenshot({ path: path.join(EV, 'critic-ctrl-d-desktop.png'), scale: 'css', animations: 'disabled' });
    log('keys', { before: { ...s0, server: p0 }, afterCtrlD: { ...s1, server: p1 }, afterMetaD: { ...s2, server: p2 }, afterCtrlP: s3, afterCtrlEqual: s4, keydownDefaultPrevented: prevented, newFeedLines: feedAfter, png: 'audits/evidence/p3/dollywood/critic-ctrl-d-desktop.png' });
    await d.close();
  }
  if (on('plot')) {
    await L.reset('typical');
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const A = await open({ device: 'ipad-portrait' });
    const B = await open({ device: 'iphone-pwa', as: ph });
    const read = f => f.evaluate(() => ({ plotInput: document.getElementById('sc-plot').value, fac: scale.fac, facText: document.getElementById('sc-fac').textContent, hubPlot: hub.get('plot') ?? null }));
    const before = { server: await serverPlot(), ipad: await read(A.f), phone: await read(B.f) };
    // clear the width on the iPad the way a person does: select the field's text and delete it
    await A.f.evaluate(() => { showTab('scale'); document.getElementById('sc-plot').scrollIntoView({ block: 'center' }); }); await sleep(300);
    const inp = await A.f.$('#sc-plot'); await inp.click({ clickCount: 3 }); await A.d.page.keyboard.press('Backspace'); await A.d.page.keyboard.press('Tab');
    await sleep(3000);
    const afterClearIpad = { server: await serverPlot(), ipad: await read(A.f) };
    await B.f.evaluate(() => hub.pull()); await sleep(1500);
    const phoneAfterPull = await read(B.f);
    await B.d.close(); await A.d.close();
    // a third context that still holds a legacy dw-plot key (and whose migration already ran), opened after the clear
    const C = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false, localStorage: { 'dw-plot': '1000', 'hub.migrated': JSON.stringify({ 'dollywood.person': Date.now() }) } });
    const cf = await C.openApp('dollywood', { wait: '#b-count' }); await cf.waitForFunction(() => window.hub && hub.sync && hub.sync.state === 'synced', null, { timeout: 30000 }); await sleep(1200);
    const legacyDevice = { ...(await read(cf)), server: await serverPlot() };
    await C.close();
    log('plot', { before, afterClearIpad, phoneAfterPull, legacyDevice });
  }
} finally {
  fs.writeFileSync(path.join(EV, 'critic-keys-plot' + (want.length ? '-' + want.join('-') : '') + '.json'), JSON.stringify(out, null, 1));
  await L.close();
}
