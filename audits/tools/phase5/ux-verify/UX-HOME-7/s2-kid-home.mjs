// s2 skeptic, UX-HOME-7: kid Home on iPad portrait/landscape and iPhone — what can a pre-reader tap, and how much of the
// screen do the adult Reminders take? Writes JSON + PNG under audits/evidence/p5/ux-verify/UX-HOME-7/s2/.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/UX-HOME-7/s2');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo' });
const res = {};
try {
  for (const device of ['ipad-portrait', 'ipad-landscape', 'iphone-pwa']) {
    const d = await L.device({ device, profile: 'ezra' });
    await d.goto('#home');
    await d.page.waitForFunction(() => hub.sync.lastPull > 0 && document.querySelector('#remlist .rem-row'), null, { timeout: 15000 }).catch(() => {});
    await sleep(800);
    res[device] = await d.page.evaluate(() => {
      const vh = innerHeight, vw = innerWidth;
      const tb = document.querySelector('.tabbar, nav.tabs, #tabs');
      const tbr = tb ? tb.getBoundingClientRect() : null;
      const usable = tbr && tbr.top > vh / 2 ? tbr.top : vh;              // bottom tab bar on phone/iPad portrait; side bar otherwise
      const rem = document.querySelector('#remlist').closest('.card').getBoundingClientRect();
      const home = document.querySelector('#view-home').getBoundingClientRect();
      const visRem = Math.max(0, Math.min(rem.bottom, usable) - Math.max(rem.top, 0));
      const buttons = [...document.querySelectorAll('#view-home button, #view-home [data-open]')].map(b => { const r = b.getBoundingClientRect(); return { text: b.textContent.trim().replace(/\s+/g, ' '), icon: !!b.querySelector('svg, img'), open: b.dataset.open || b.id || null, w: Math.round(r.width), h: Math.round(r.height) }; });
      return { vw, vh, usableHeight: Math.round(usable), tabbarRect: tbr && [tbr.left, tbr.top, tbr.width, tbr.height].map(Math.round),
        remCard: [rem.top, rem.height].map(Math.round), remVisiblePx: Math.round(visRem), remShareOfFirstScreen: +(visRem / usable).toFixed(3),
        remShareOfHomeContent: +(rem.height / home.height).toFixed(3), homeHeight: Math.round(home.height),
        remRows: document.querySelectorAll('#remlist .rem-row').length, remDoneButtons: document.querySelectorAll('#remlist [data-done]').length,
        buttons, prayerEntry: !!document.querySelector('#view-home [data-open="prayer"]'),
        cardTitles: [...document.querySelectorAll('#view-home .card h2')].map(h => h.textContent.trim()) };
    });
    await d.shot(path.join(OUT, `kid-home-${device}.png`));
    // does the icon CTA reach Kid Verse in one more tap, by icon tile?
    await d.page.click('#kid-apps'); await sleep(600);
    res[device].afterCta = await d.page.evaluate(() => ({ hash: location.hash, tiles: [...document.querySelectorAll('#view-apps [data-open], #view-apps .tile, #view-apps button')].slice(0, 12).map(t => ({ label: t.textContent.trim().replace(/\s+/g, ' ').slice(0, 30), icon: !!t.querySelector('svg, img') })) }));
    await d.close();
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'kid-home.json'), JSON.stringify(res, null, 1));
for (const [k, v] of Object.entries(res)) console.log(k, JSON.stringify({ usable: v.usableHeight, rem: v.remCard, remVisiblePx: v.remVisiblePx, share: v.remShareOfFirstScreen, shareOfContent: v.remShareOfHomeContent, buttons: v.buttons, prayer: v.prayerEntry, afterCta: v.afterCta }));
