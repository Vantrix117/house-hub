import { local, sleep } from './wr7/audits/tools/lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'real' });
for (const xxl of [false, true]) for (const [dev, w, h] of [['iphone-pwa', 375, 667], ['iphone-pwa', 390, 844], ['ipad-portrait', 820, 1180]]) {
  const d = await L.device({ device: dev, profile: 'ezra', fixedTime: false }); await d.page.setViewportSize({ width: w, height: h });
  const f = await d.openApp('timer'); await f.waitForFunction(() => window.__timer && __timer.isLive(), null, { timeout: 15000 });
  if (xxl) { await d.page.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl')); await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl')); }
  await f.evaluate(async () => { for (const r of hub.timers.list({ stale: true })) await hub.timers.clear(r.id, r.startedAt); });
  await sleep(600);
  const m = async () => f.evaluate(() => { const r = s => { const e = document.querySelector(s); if (!e || e.hidden || getComputedStyle(e).display === 'none') return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.bottom)]; }; const btns = [...document.querySelectorAll('#presets [data-s]')].map(b => b.getBoundingClientRect()); return { vh: innerHeight, dial: r('#dial'), go: r('#go'), plus1: r('#plus1'), reset: r('#reset'), pre: r('#presets'), picsOnScreen: btns.filter(b => b.bottom <= innerHeight).length, small: [...document.querySelectorAll('main button')].filter(b => b.offsetParent && getComputedStyle(b).visibility !== 'hidden').map(b => b.getBoundingClientRect()).filter(b => b.width < 64 || b.height < 64).length }; });
  const idle = await m(); await d.shot(`r7/kid-${xxl ? 'xxl' : 'std'}-${w}-idle.png`);
  await f.click('#presets [data-s="300"]'); await f.click('#go'); await sleep(500); const run = await m();
  console.log(xxl ? 'xxl' : 'std', w, 'idle', JSON.stringify(idle), '\n      run ', JSON.stringify(run));
  await f.evaluate(async () => { for (const r of hub.timers.list({ stale: true })) await hub.timers.clear(r.id, r.startedAt); });
  await d.close();
}
await L.close();
