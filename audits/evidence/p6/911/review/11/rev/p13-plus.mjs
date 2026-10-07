// Round 8: where is + in the failing cases, and is it the pill or the counters button that pushes it? Kid XXL 320x568 (Count
// with no named counters vs with one) and 844x390 with the unbroken name; does fit() recover after a resize nudge?
import { local, sleep } from '../../hub-audit/audits/tools/lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const put = (key, value) => L.apiAs('ezra', `/api/data/tally/${encodeURIComponent(key)}?scope=person`, { method: 'PUT', body: { value, updated_at: Date.now() } });
const R = s => { const e = document.querySelector(s); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return r.height ? [Math.round(r.top), Math.round(r.bottom)] : null; };
await L.apiAs('ezra', '/api/data/hub/textSize?scope=person', { method: 'PUT', body: { value: 'xxl', updated_at: Date.now() } });
try {
  for (const [label, rows, sel, w, h] of [['no named counters', {}, '', 320, 568], ['one named, Count chosen', { 'counter:kL': 'Glasses of water today!!' }, '', 320, 568], ['one named, it chosen', {}, 'kL', 320, 568], ['unbroken name chosen', { 'counter:kW': 'WWWWWWWWWWWWWWWWWWWWWWWW' }, 'kW', 844, 390], ['spaced name chosen', {}, 'kL', 844, 390]]) {
    for (const [k, v] of Object.entries(rows)) await put(k, { name: v, at: Date.now() - 1000 });
    const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false, localStorage: { 'hub.tally.sel.ezra': sel, 'hub.prefs': { textSize: 'xxl' } } });
    await d.page.setViewportSize({ width: w, height: h });
    const f = await d.openApp('tally', { wait: '#plus' }); await f.waitForFunction(() => !document.getElementById('n').classList.contains('skeleton'), null, { timeout: 15000 }); await sleep(1500);
    const m = () => f.evaluate(`(() => { const R = ${R.toString()}; return { ih: innerHeight, who: R('#who'), switcher: R('#switcher'), dial: R('.dial'), plus: R('#plus'), reset: R('#reset'), room: document.documentElement.style.getPropertyValue('--room'), compact: document.getElementById('main').classList.contains('compact') }; })()`);
    const a = await m();
    await d.page.setViewportSize({ width: w, height: h - 1 }); await sleep(300); await d.page.setViewportSize({ width: w, height: h }); await sleep(1200);
    const b = await m();
    console.log(`${label} ${w}x${h}\n  load:   ${JSON.stringify(a)}\n  resize: ${JSON.stringify(b)}`);
    await d.page.screenshot({ path: `C:/Users/ex_bo/b11/rev/shots11/p13-${label.replace(/\W+/g, '-')}.png` });
    await d.close();
  }
} finally { await L.close(); }
