// Skeptic check: are long Larder item names truncated with no way to read them? (overflow seed, iphone-pwa + ipad-portrait, Eli)
import fs from 'node:fs';
import { local } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/leftovers/verify-vis-long-item-names-are-cut-off-with-no-way-to-read--3-1';
const L = await local({ variant: 'overflow', clock: 'demo' });
const res = {};
try {
  for (const device of ['iphone-pwa', 'ipad-portrait', 'desktop']) {
    const d = await L.device({ device, profile: 'eli' });
    await d.goto('#home');
    const f = await d.openApp('leftovers');
    await f.waitForFunction(() => document.querySelectorAll('.item .nm').length > 0, null, { timeout: 20000 });
    const r = await f.evaluate(() => {
      const cards = [...document.querySelectorAll('.item')];
      return cards.map(c => {
        const nm = c.querySelector('.nm');
        const truncated = nm.scrollWidth > nm.clientWidth + 1;
        const visibleFull = [...c.querySelectorAll('*')].some(e => e !== nm && e.children.length === 0 && e.textContent.includes(nm.textContent) && e.getBoundingClientRect().width > 0);
        return {
          name: nm.textContent, truncated, scrollW: nm.scrollWidth, clientW: nm.clientWidth,
          nmTitle: nm.getAttribute('title'), cardTitle: c.getAttribute('title'),
          cardHandlers: !!(c.onclick || nm.onclick || c.querySelector('.info').onclick),
          interactive: [...c.querySelectorAll('button,a,[tabindex],details,summary')].map(e => ({ tag: e.tagName, cls: e.className, title: e.title, aria: e.getAttribute('aria-label') })),
          fullNameVisibleElsewhereInCard: visibleFull,
          nmCss: (s => ({ ws: s.whiteSpace, to: s.textOverflow, ov: s.overflow }))(getComputedStyle(nm)),
        };
      });
    });
    const trunc = r.filter(x => x.truncated);
    res[device] = { cards: r.length, truncated: trunc.length, truncatedCards: trunc };
    console.log(device, 'cards', r.length, 'truncated', trunc.length);
    for (const t of trunc) console.log('  ', JSON.stringify({ name: t.name, sw: t.scrollW, cw: t.clientW, title: t.nmTitle, cardTitle: t.cardTitle, handlers: t.cardHandlers, fullVisible: t.fullNameVisibleElsewhereInCard, controls: t.interactive.map(i => i.cls + ':' + (i.aria || '')) }));
    // tap the name area: does anything open?
    if (trunc.length) {
      const before = await f.evaluate(() => document.body.innerHTML.length);
      const nmEl = await f.$$('.item .nm');
      const idx = (await f.evaluate(() => [...document.querySelectorAll('.item .nm')].findIndex(n => n.scrollWidth > n.clientWidth + 1)));
      await nmEl[idx].click();
      await new Promise(r => setTimeout(r, 600));
      const after = await f.evaluate(() => ({ len: document.body.innerHTML.length, items: document.querySelectorAll('.item').length, dialogs: document.querySelectorAll('dialog[open],.sheet,[role=dialog]').length }));
      res[device].tapName = { before, after };
      console.log('  tap on truncated name ->', JSON.stringify({ before, after }));
    }
    if (device === 'iphone-pwa') await d.page.screenshot({ path: OUT + '-iphone.png', scale: 'css', animations: 'disabled', caret: 'hide' });
  }
} finally { await L.close(); }
fs.writeFileSync(OUT + '.json', JSON.stringify(res, null, 1));
console.log('wrote', OUT + '.json');
