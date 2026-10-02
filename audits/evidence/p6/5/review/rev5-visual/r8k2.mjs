import { pathToFileURL } from 'node:url';
const { local, sleep, DEMO } = await import(pathToFileURL('C:/Users/ex_bo/OneDrive/Claude Related/App Hub/audits/tools/lib/local.mjs').href);
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
for (const [device, w] of [['ipad-portrait'], ['ipad-landscape'], ['desktop'], ['iphone-pwa', 390]]) {
  const d = await L.device({ device, profile: 'ezra', installClock: DEMO }); if (w) await d.page.setViewportSize({ width: w, height: 844 });
  await d.goto('#home'); await sleep(2500);
  console.log(device, JSON.stringify(await d.page.evaluate(() => { const c = document.querySelector('.stars-card'); if (!c) return null; const big = c.querySelector('.gbig, h3, .big') || c.querySelector('.gbody *'); const els = [...c.querySelectorAll('.gbody *')].filter(e => e.children.length === 0 && /stars this week/.test(e.textContent)); const e = els[0]; const lh = parseFloat(getComputedStyle(e).lineHeight) || 30; const r = e.getBoundingClientRect(), gb = c.querySelector('.gbody').getBoundingClientRect(); return { card: [Math.round(c.getBoundingClientRect().width), Math.round(c.getBoundingClientRect().height)], gbody: Math.round(gb.width), line: e.textContent, w: Math.round(r.width), lines: Math.round(r.height / lh), cls: e.className, maxW: getComputedStyle(e.parentElement).maxWidth, cq: getComputedStyle(c).containerType }; })));
  await d.close();
}
await L.close();
