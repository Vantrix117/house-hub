// Skeptic #2 for "Long item names are cut off with no way to read them" (Larder, apps/leftovers.html:75).
// Measures every .item .nm on the overflow seed (iPhone PWA, iPad portrait, desktop), checks for any title / expand /
// tap handler that reveals the full name, finds the realistic-length threshold at which truncation starts on iPhone,
// and checks whether the shell's Home fridge card shows the full name for the oldest items (a partial mitigation).
// Run: node "audits/tools/phase3/leftovers/verify-vis-long-item-names-are-cut-off-with-no-way-to-read--3-2.mjs"
import { local, save, shot, openLarder } from './_lib.mjs';

const P = 'verify-vis-long-item-names-are-cut-off-with-no-way-to-read--3-2';
const out = { devices: {} };
const L = await local({ variant: 'overflow', clock: 'demo', engine: 'webkit' });
try {
  for (const device of ['iphone-pwa', 'ipad-portrait', 'desktop']) {
    const d = await L.device({ device, profile: 'eli' });
    await d.goto('#home');
    const f = await openLarder(d);
    const r = await f.evaluate(() => {
      const nms = [...document.querySelectorAll('.item .nm')];
      const cut = nms.filter(n => n.scrollWidth > n.clientWidth + 1);
      const reveal = [...document.querySelectorAll('.item')].map(c => ({
        cardTitle: c.getAttribute('title'), nmTitle: c.querySelector('.nm').getAttribute('title'),
        cardClick: typeof c.onclick === 'function', nmClick: typeof c.querySelector('.nm').onclick === 'function',
        details: !!c.querySelector('details,[aria-expanded]'),
        buttons: [...c.querySelectorAll('button')].map(b => b.title + ' | ' + b.getAttribute('aria-label')),
      }));
      const cs = nms[0] && getComputedStyle(nms[0]);
      return {
        total: nms.length, truncated: cut.length,
        style: cs && { whiteSpace: cs.whiteSpace, overflow: cs.overflow, textOverflow: cs.textOverflow, userSelect: cs.webkitUserSelect || cs.userSelect },
        examples: cut.slice(0, 5).map(n => ({ name: n.textContent, clientWidth: n.clientWidth, scrollWidth: n.scrollWidth,
          visibleFraction: +(n.clientWidth / n.scrollWidth).toFixed(2) })),
        anyTitleOnNameOrCard: reveal.some(x => x.cardTitle || x.nmTitle),
        anyTapOnNameOrCard: reveal.some(x => x.cardClick || x.nmClick),
        anyExpand: reveal.some(x => x.details),
        buttonsOnFirstCard: reveal[0] && reveal[0].buttons,
      };
    });
    await shot(f, `${P}-${device}.png`, { fullPage: false });
    out.devices[device] = r;
    console.log(device, JSON.stringify({ total: r.total, truncated: r.truncated, style: r.style, anyTitle: r.anyTitleOnNameOrCard, anyTap: r.anyTapOnNameOrCard, anyExpand: r.anyExpand, buttons: r.buttonsOnFirstCard }));
    for (const e of r.examples) console.log('   ', e.visibleFraction, e.name);

    if (device === 'iphone-pwa') {
      // Realistic lengths: at what character count does a plain name start to be cut on a 430-wide iPhone?
      out.threshold = await f.evaluate(() => {
        const n = document.querySelector('.item .nm'); const orig = n.textContent; const res = [];
        for (const s of ['Chicken alfredo', 'Beef and bean chili', 'Roasted sweet potatoes', 'Spaghetti and meatballs',
                         'Vegetable fried rice with egg', 'Chicken enchiladas with rice', 'Broccoli cheddar soup from Panera']) {
          n.textContent = s; res.push({ name: s, len: s.length, cut: n.scrollWidth > n.clientWidth + 1, clientWidth: n.clientWidth, scrollWidth: n.scrollWidth });
        }
        n.textContent = orig; return res;
      });
      console.log('iphone threshold', JSON.stringify(out.threshold));
      // Home fridge card: does it show the full name of the oldest items?
      await d.goto('#home');
      await d.page.waitForSelector('.fresh .fl span', { timeout: 15000 }).catch(() => {});
      out.homeCard = await d.page.evaluate(() => [...document.querySelectorAll('.fresh .fl span:first-child')].map(s => ({
        text: s.textContent, clipped: s.scrollWidth > s.clientWidth + 1, ws: getComputedStyle(s).whiteSpace, height: s.getBoundingClientRect().height })));
      console.log('home fridge card', JSON.stringify(out.homeCard));
    }
    await d.close?.();
  }
} finally {
  save(`${P}.json`, out);
  await L.close();
}
