// Skeptic s2, UX-DOLLYWOOD-LIVE-5: does kid mode change anything in the park map (type, targets), what does a kid's pill say,
// and on Waits with a kid filter, what do the too-short rows carry (fade only? the inches? a "needs" chip?) vs Nearby.
// Compares Ezra (kid, beacon on), Kiara (kid, view-only) and Eli (adult) on iPhone PWA, park seed, real clock.
// Run: node "audits/tools/phase5/ux-verify/UX-DOLLYWOOD-LIVE-5/s2-kid-reading.mjs"
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../evidence/p5/ux-verify/UX-DOLLYWOOD-LIVE-5/s2');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
const sizes = f => f.evaluate(() => { const cs = s => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e), r = e.getBoundingClientRect(); return { fs: c.fontSize, w: Math.round(r.width), h: Math.round(r.height) }; };
  return { kind: document.documentElement.dataset.kind || null, WHO: (typeof WHO !== 'undefined') ? WHO : 'n/a', pillTitle: cs('#loc-sec'), pillSub: cs('#loc-acc'), tab: cs('#loc-near'), locBtn: cs('#loc-btn'), fitBtn: cs('#lv-fit'),
    sectionLabel: (() => { const t = [...document.querySelectorAll('svg text')].find(t => /TIMBER CANYON/i.test(t.textContent)); if (!t) return null; const r = t.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width) }; })() }; });
async function rows(f) { return f.evaluate(() => [...document.querySelectorAll('#near-list .lv-item')].map(b => ({ text: b.innerText.replace(/\s+/g, ' ').trim().slice(0, 110), noride: b.classList.contains('noride'), opacity: getComputedStyle(b).opacity, need: !!b.querySelector('.need') }))); }
async function run(profile, key, { place = true } = {}) {
  const d = await L.device({ device: 'iphone-pwa', profile, fixedTime: false });
  const r = {};
  try {
    await d.goto('#home'); await sleep(1200);
    const f = await d.openApp('dollywood-live');
    await f.waitForSelector('#lv-pill[data-state]', { timeout: 15000 });
    await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 10000 }).catch(() => {});
    await f.waitForSelector('.lv-wait', { state: 'attached', timeout: 5000 }).catch(() => {});
    await sleep(1500);
    r.sizes = await sizes(f);
    r.whoChipsVisibleToKid = null;
    if (place) {
      await f.locator('#loc-place').click({ timeout: 3000 }).catch(e => r.placeErr = String(e).slice(0, 100)); await sleep(400);
      await f.locator('#lv-act').click({ timeout: 3000 }).catch(e => r.actErr = String(e).slice(0, 100)); await sleep(600);
      r.pillAfterPlace = await f.evaluate(() => ({ state: document.getElementById('lv-pill').dataset.state, title: document.getElementById('loc-sec').textContent, sub: document.getElementById('loc-acc').textContent }));
    }
    await f.locator('#loc-near').click().catch(() => {}); await sleep(600);
    r.whoChips = await f.evaluate(() => [...document.querySelectorAll('#near-list .lv-who-chips button')].map(b => b.textContent.trim()));
    await f.locator('#near-list .lv-who-chips button[data-who="ezra"]').click({ timeout: 3000 }).catch(e => r.chipErr = String(e).slice(0, 100)); await sleep(500);
    r.nearbyRows = (await rows(f)).filter(x => x.noride || /Thunderhead|Drop Line|Lightning/i.test(x.text));
    await f.locator('#near-mode-waits').click().catch(() => {}); await sleep(600);
    // make sure the chip is still Ezra in waits
    r.waitsWho = await f.evaluate(() => WHO);
    const w = await rows(f);
    r.waitsTooShort = w.filter(x => x.noride);
    r.waitsCount = w.length;
    await f.evaluate(() => { const body = document.querySelector('#lv-sheet .lv-body'); const g = body && [...body.querySelectorAll('.lv-grp')].find(e => /35 min and up/i.test(e.textContent)); if (g) body.scrollTop += g.getBoundingClientRect().top - body.getBoundingClientRect().top - 4; });
    await sleep(300);
    r.chipRowInViewAfterScroll = await f.evaluate(() => { const c = document.querySelector('#near-list .lv-who-chips'), b = document.querySelector('#lv-sheet .lv-body'); if (!c || !b) return null; const cr = c.getBoundingClientRect(), br = b.getBoundingClientRect(); return cr.bottom > br.top && cr.top < br.bottom; });
    await d.page.screenshot({ path: path.join(OUT, `${key}-waits-ezra-filter-iphone.png`) });
    out[key] = r;
  } finally { await d.close(); }
}
try { await run('ezra', 'ezra'); await run('eli', 'eli'); await run('kiara', 'kiara', { place: false }); }
finally { fs.writeFileSync(path.join(OUT, 'kid-reading.json'), JSON.stringify(out, null, 2)); console.log(JSON.stringify(out, null, 1)); await L.close(); }
