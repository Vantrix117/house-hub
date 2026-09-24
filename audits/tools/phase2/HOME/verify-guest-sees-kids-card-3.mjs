// Skeptic #3 (tie-break) for finding "guest-sees-kids-card".
// Question: a guest (kind 'adult', is_guest) gets the Home Kids card with "N to cash in", while Me hides Kids' rewards.
// Is that a defect against the hub's own intent, or by design? This script gathers the runtime facts on a fresh local
// instance; the intent question is settled from CLAUDE.md / ROADMAP / test-rewards.mjs (see the verdict).
//   node "audits/tools/phase2/HOME/verify-guest-sees-kids-card-3.mjs"
// Evidence → audits/evidence/p2/HOME/verify-guest-sees-kids-card-3.json (+ -guest-home.png, iPhone PWA at 1x css)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/HOME');
fs.mkdirSync(OUT, { recursive: true });
const res = {};

async function home(d) {
  await d.goto('#home');
  await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#view-home .gcard'), null, { timeout: 20000 });
  await sleep(800);
  return d.page.evaluate(() => {
    const k = document.querySelector('#view-home .kids-card');
    const r = k && k.getBoundingClientRect();
    return {
      id: hub.profile && hub.profile.id, kind: hub.profile && hub.profile.kind,
      is_guest: !!(hub.session && hub.session.profile && hub.session.profile.is_guest),
      cards: [...document.querySelectorAll('#view-home .gcard h2')].map(h => h.textContent.trim()),
      kidsCard: !!k,
      kidsText: k ? k.querySelector('.gbody').textContent.replace(/\s+/g, ' ').trim() : null,
      kidsButtons: k ? k.querySelectorAll('button,a,[data-open]').length : null,
      kidsTop: r ? Math.round(r.top) : null, viewportH: innerHeight,
    };
  });
}
async function me(d) {
  await d.page.click('#tabbar .tab[data-tab="me"]'); await sleep(900);
  return d.page.evaluate(() => ({
    headings: [...document.querySelectorAll('#view-me h2')].map(h => h.textContent.replace(/\s+/g, ' ').trim()),
    rewards: !!document.querySelector('#rewards'), cashin: document.querySelectorAll('[data-cashin]').length,
  }));
}

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  // A. the seeded guest, Grandma Jo, on the family's iPhone (PWA)
  const g = await L.device({ device: 'iphone-pwa', profile: 'guest-grandmajo' });
  res.guestHome = await home(g);
  await g.page.screenshot({ path: path.join(OUT, 'verify-guest-sees-kids-card-3-guest-home.png'), scale: 'css', fullPage: true, animations: 'disabled', caret: 'hide' });
  res.guestMe = await me(g);
  // A2. what the guest sees in Kid Verse (open to guests via the household-adult rule): stars, balance, badges?
  await g.goto('#home');
  const f = await g.openApp('kidverse', { wait: '#grown' });
  await sleep(1500);
  res.guestKidVerse = await f.evaluate(() => {
    const gr = document.querySelector('#grown');
    return { grownHidden: gr ? gr.hidden : null, grownText: gr ? gr.textContent.replace(/\s+/g, ' ').trim().slice(0, 240) : null, mentionsCashIn: /cash in/i.test(document.body.innerText), stepper: !!document.querySelector('#week-up') };
  });
  await g.close();

  // B. a household adult (Mom) on the same kind of device: same Home card? Me has Kids' rewards?
  const m = await L.device({ device: 'iphone-pwa', profile: 'mom' });
  res.momHome = await home(m);
  res.momMe = await me(m);
  await m.close();

  // C. the raw data behind the card, read as the guest through the API (family scope)
  const api = await L.apiAs('guest-grandmajo', '/api/data/kidverse?scope=family');
  const items = (api.body && api.body.items) || [];
  res.guestApi = { status: api.status, stars: Object.fromEntries(items.filter(i => /^stars:/.test(i.key)).map(i => [i.key, i.value && { week: i.value.week, count: i.value.count, total: i.value.total, badges: i.value.badges && Object.keys(i.value.badges).length }])) };
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-guest-sees-kids-card-3.json'), JSON.stringify(res, null, 1));
  await L.close();
}

const G = res.guestHome, M = res.momHome;
console.log(`[guest ${G.id}] kind=${G.kind} is_guest=${G.is_guest}; Home cards: ${G.cards.join(' | ')}`);
console.log(`[guest] Kids card: ${G.kidsCard} "${G.kidsText}" (actions in card: ${G.kidsButtons}; top ${G.kidsTop}px of a ${G.viewportH}px viewport)`);
console.log(`[guest] Me headings: ${res.guestMe.headings.join(' | ')}; #rewards=${res.guestMe.rewards}; cash-in buttons=${res.guestMe.cashin}`);
console.log(`[guest] Kid Verse grown-ups pane hidden=${res.guestKidVerse.grownHidden}; stepper=${res.guestKidVerse.stepper}; "cash in" anywhere=${res.guestKidVerse.mentionsCashIn}; text: "${res.guestKidVerse.grownText}"`);
console.log(`[mom] is_guest=${M.is_guest}; Kids card: ${M.kidsCard} "${M.kidsText}"; Me #rewards=${res.momMe.rewards}; cash-in buttons=${res.momMe.cashin}`);
console.log(`[guest API] GET /api/data/kidverse?scope=family → ${res.guestApi.status}; ${JSON.stringify(res.guestApi.stars)}`);
