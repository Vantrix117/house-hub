// Skeptic #1 for "guest-hero-adult": does a guest's Me hero kicker read "Adult" instead of "Guest"?
// Signs in the real way: the Kitchen iPad / an iPhone start signed out, the picker loads, one tap on Grandma Jo
// (PIN-less guest) signs her in, then the Me tab is opened and its hero kicker read. Also reads what the picker and
// the household adult's guest list say about her, for contrast. Real clock (so the guest's expiry is in the future).
// Local rig only.
//
//   node "audits/tools/phase2/PROF/verify-guest-hero-adult-1.mjs"
import { local, sleep } from '../../lib/local.mjs';

const log = (k, v) => console.log(k.padEnd(48), typeof v === 'string' ? v : JSON.stringify(v));
const OUT = 'audits/evidence/p2/PROF/';
const L = await local({ variant: 'typical', clock: 'real' });
try {
  for (const dev of ['iphone-pwa', 'ipad-portrait']) {
    const d = await L.device({ device: dev, profile: null, fixedTime: false });
    const { page } = d;
    await d.goto('');
    await page.waitForSelector('#profiles .pcard[data-id="guest-grandmajo"]', { timeout: 20000 });
    const pickerSub = await page.locator('#profiles .pcard[data-id="guest-grandmajo"] .psub').textContent();
    log(dev + ' picker card sub-line', pickerSub.trim());
    await page.click('#profiles .pcard[data-id="guest-grandmajo"]');
    await page.waitForFunction(() => window.hub && hub.profile && hub.profile.id === 'guest-grandmajo', null, { timeout: 15000 });
    const who = await page.evaluate(() => ({ id: hub.profile.id, kind: hub.profile.kind, isAdmin: hub.profile.isAdmin, session_is_guest: !!(hub.session && hub.session.profile && hub.session.profile.is_guest), expires_at: hub.session && hub.session.profile && hub.session.profile.expires_at }));
    log(dev + ' signed in as', who);
    await page.click('.tab[data-tab="me"]');
    await page.waitForSelector('#view-me .me-hero .hero-kicker', { timeout: 15000 });
    await sleep(800);
    const hero = await page.evaluate(() => ({ kicker: document.querySelector('#view-me .me-hero .hero-kicker').textContent, kickerRendered: document.querySelector('#view-me .me-hero .hero-kicker').innerText, title: document.querySelector('#view-me .me-hero .hero-title').textContent }));
    log(dev + ' Me hero kicker (textContent)', hero.kicker);
    log(dev + ' Me hero kicker (as rendered)', hero.kickerRendered);
    log(dev + ' Me hero title', hero.title);
    log(dev + ' "Guest" anywhere in the Me hero?', await page.evaluate(() => /guest/i.test(document.querySelector('#view-me .me-hero').innerText)));
    const shot = OUT + `verify-guest-hero-adult-${dev}.png`;
    await page.locator('#view-me .me-hero').screenshot({ path: shot, scale: 'css', animations: 'disabled', caret: 'hide' });
    log(dev + ' screenshot', shot);
    await d.close();
  }
  // Contrast: what a household adult's guest list says about the same person
  const e = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await e.goto('#me');
  await e.page.waitForSelector('#guest-list .row', { timeout: 15000 }).catch(() => {});
  await sleep(800);
  log('eli Me -> Guests row for Grandma Jo', await e.page.evaluate(() => { const r = [...document.querySelectorAll('#guest-list .row')].find(x => /Grandma Jo/.test(x.textContent)); return r ? r.querySelector('.row-sub').textContent : 'NOT FOUND'; }));
  log('eli Me hero kicker (household admin)', await e.page.evaluate(() => document.querySelector('#view-me .me-hero .hero-kicker').textContent));
  await e.close();
} finally { await L.close(); }
