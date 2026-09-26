// UX-HOME-7 skeptic s1: measure kid Home (Ezra) on iPhone PWA, iPad portrait/landscape.
//   node "audits/tools/phase5/ux-verify/UX-HOME-7/s1-kid-home.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/UX-HOME-7/s1');
fs.mkdirSync(OUT, { recursive: true });
const res = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const device of ['iphone-pwa', 'ipad-portrait', 'ipad-landscape']) {
    const d = await L.device({ device, profile: 'ezra' });
    await d.goto('#home');
    await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#remlist .rem-row'), null, { timeout: 15000 });
    await sleep(800);
    res[device] = await d.page.evaluate(() => {
      const vh = innerHeight, vw = innerWidth;
      const R = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; };
      const tb = document.querySelector('.tabbar'); const tbr = tb && getComputedStyle(tb).display !== 'none' ? tb.getBoundingClientRect() : null;
      const visibleBottom = tbr && tbr.y < vh ? tbr.y : vh;
      const remCard = document.querySelector('#remlist').closest('.card');
      const cards = [...document.querySelectorAll('#view-home > *, #view-home .stack-lg > *, #view-home .glance > *')].map(e => ({ cls: e.className, text: e.innerText.replace(/\s+/g, ' ').slice(0, 60), rect: R(e) }));
      const controls = [...document.querySelectorAll('#view-home button, #view-home a, #view-home [data-open]')].map(b => ({ text: b.innerText.replace(/\s+/g, ' ').trim(), aria: b.getAttribute('aria-label'), hasIcon: !!b.querySelector('svg,img'), rect: R(b), open: b.dataset.open || null, id: b.id || null }));
      const rr = R(remCard);
      const overlap = (top, bot) => Math.max(0, Math.min(bot, visibleBottom) - Math.max(top, 0));
      const remVisibleAtRest = overlap(rr.y, rr.y + rr.h);
      const pageH = document.documentElement.scrollHeight;
      return {
        viewport: [vw, vh], tabbarTop: tbr ? Math.round(tbr.y) : null, visibleBottom: Math.round(visibleBottom), pageHeight: pageH,
        reminderCard: rr, reminderRows: document.querySelectorAll('#remlist .rem-row').length, reminderDoneButtons: document.querySelectorAll('#remlist [data-done]').length,
        remShareOfViewportAtRest: +(remVisibleAtRest / visibleBottom).toFixed(3),
        remShareOfCardArea: +(rr.h / (document.querySelector('#view-home').getBoundingClientRect().height)).toFixed(3),
        remShareOfCardHeightVsViewport: +(rr.h / vh).toFixed(3),
        controls, blocks: cards,
        prayerMentioned: /pray/i.test(document.querySelector('#view-home').innerText),
        prayerOpen: !!document.querySelector('#view-home [data-open="prayer"]'),
        heroSub: (document.querySelector('#view-home .hero-sub') || {}).textContent || null,
      };
    });
    await d.page.screenshot({ path: path.join(OUT, `kid-home-${device}.png`), scale: 'css', animations: 'disabled', caret: 'hide', fullPage: true });
    if (device === 'iphone-pwa') {   // where does the big CTA go?
      await d.page.click('#kid-apps'); await sleep(600);
      res.ctaTarget = await d.page.evaluate(() => ({ hash: location.hash, activeTab: (document.querySelector('.tab.on, .tab[aria-current], .tab.active') || {}).textContent || null, tiles: [...document.querySelectorAll('#view-apps [data-open], #view-apps .tile')].map(t => ({ open: t.dataset.open || null, text: t.innerText.replace(/\s+/g, ' ').trim(), hasIcon: !!t.querySelector('svg,img') })) }));
      await d.page.screenshot({ path: path.join(OUT, 'kid-cta-target-iphone-pwa.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
    }
    await d.close();
  }
  fs.writeFileSync(path.join(OUT, 'kid-home.json'), JSON.stringify(res, null, 1));
  for (const k of ['iphone-pwa', 'ipad-portrait', 'ipad-landscape']) { const r = res[k]; console.log(k, 'viewport', r.viewport, 'page', r.pageHeight, 'rem card', r.reminderCard, 'rows', r.reminderRows, 'share at rest', r.remShareOfViewportAtRest, 'share of Home', r.remShareOfCardArea, 'controls', r.controls.map(c => `${c.text || c.aria}(${c.rect.w}x${c.rect.h}${c.hasIcon ? ',icon' : ''}${c.open ? ',open=' + c.open : ''})`).join(' | '), 'prayer', r.prayerMentioned, r.prayerOpen); }
  console.log('cta', JSON.stringify(res.ctaTarget));
} finally { await L.close(); }
