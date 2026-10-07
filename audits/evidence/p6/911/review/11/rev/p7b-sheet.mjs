// Round 3 (A), rewritten: the counters sheet. Per case: open with Enter on #cpick, measure, Escape at once (focus inside) ->
// closed + focus back on #cpick; reopen, a mouse pick; reopen, Tab past the last row -> where focus goes, and what Escape does then.
import fs from 'node:fs';
import { local, sleep } from '../../hub-audit/audits/tools/lib/local.mjs';
const OUT = 'C:/Users/ex_bo/b11/rev/shots3'; fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const now = Date.now();
async function seed(pid) {
  const put = (key, value) => L.apiAs(pid, `/api/data/tally/${encodeURIComponent(key)}?scope=person`, { method: 'PUT', body: { value, updated_at: Date.now() } });
  const names = ['Laps around the garden', 'Glasses of water today', 'Pages read this evening', 'Push-ups before dinner', 'Words of kindness given', 'Birds seen at the feeder'];
  for (let i = 0; i < 6; i++) await put('counter:k' + i, { name: names[i], at: now - 100000 + i });
}
await seed('eli'); await seed('ezra');
const open = async (pid, w, h, xxl) => {
  const d = await L.device({ device: 'iphone-pwa', profile: pid, fixedTime: false });
  await d.page.setViewportSize({ width: w, height: h });
  const f = await d.openApp('tally', { wait: '#plus' });
  await f.waitForFunction(() => !document.getElementById('n').classList.contains('skeleton'), null, { timeout: 15000 }); await sleep(800);
  if (xxl) { await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl')); await sleep(600); }
  return { d, f };
};
const openSheet = async (d, f) => { await f.focus('#cpick'); await d.page.keyboard.press('Enter'); await sleep(500); };
try {
  for (const [pid, w, h, xxl] of [['eli', 390, 844, false], ['ezra', 390, 844, false], ['eli', 844, 390, true], ['ezra', 667, 375, true], ['ezra', 375, 667, true]]) {
    const tag = `${pid}-${w}x${h}${xxl ? '-xxl' : ''}`;
    let { d, f } = await open(pid, w, h, xxl);
    await openSheet(d, f);
    const m = await f.evaluate(() => {
      const sh = document.querySelector('.csheet'); if (!sh) return null; const r = sh.getBoundingClientRect();
      const bs = [...sh.querySelectorAll('button')].map(b => { const x = b.getBoundingClientRect(); return { h: Math.round(x.height), b: Math.round(x.bottom) }; });
      const last = sh.querySelectorAll('button')[bs.length - 1]; last.scrollIntoView({ block: 'nearest' }); const lr = last.getBoundingClientRect();
      return { sheet: [Math.round(r.top), Math.round(r.bottom)], ih: innerHeight, rows: bs.length, minRowH: Math.min(...bs.map(b => b.h)), lastReachable: lr.top >= 0 && lr.bottom <= innerHeight, focused: document.activeElement && document.activeElement.textContent.slice(0, 24) };
    });
    await d.page.screenshot({ path: `${OUT}/sheet-${tag}.png` });
    await d.page.keyboard.press('Escape'); await sleep(300);
    const esc = await f.evaluate(() => ({ open: !!document.querySelector('.csheet'), focus: document.activeElement && document.activeElement.id }));
    await f.click('#cpick'); await sleep(300); await f.locator('.csheet button').nth(4).click(); await sleep(400);
    const pick = await f.evaluate(() => ({ chip: document.querySelector('#cpick .cp-n').textContent, open: !!document.querySelector('.csheet'), focus: document.activeElement && document.activeElement.id }));
    console.log(tag, JSON.stringify(m), 'escape:', JSON.stringify(esc), 'pick:', JSON.stringify(pick));
    if (pid === 'eli' && w === 390) {
      await openSheet(d, f);
      const path = [];
      for (let i = 0; i < 9; i++) { await d.page.keyboard.press('Tab'); path.push(await d.page.evaluate(() => { const fr = document.querySelector('iframe'); const inFrame = document.activeElement === fr; const a = inFrame ? fr.contentDocument.activeElement : document.activeElement; return (inFrame ? (a && a.closest && a.closest('.csheet') ? 'sheet:' : 'frame:') : 'SHELL:') + (a ? (a.id || (a.getAttribute && a.getAttribute('aria-label')) || a.textContent.trim().slice(0, 14) || a.tagName) : 'none'); })); }
      console.log('   Tab x9 from the chosen row:', path.join(' > '));
      await d.page.keyboard.press('Escape'); await sleep(500);
      console.log('   Escape after tabbing out:', JSON.stringify(await d.page.evaluate(() => ({ hash: location.hash, frame: !!document.querySelector('iframe[src*="tally"]'), viewerOpen: !!document.querySelector('#viewer:not([hidden])') }))));
    }
    await d.close();
  }
} finally { await L.close(); }
