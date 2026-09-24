// Skeptic #2 for finding "guest-sees-kids-card": do guests get the Home Kids card (with "N to cash in") while Me hides
// Kids' rewards from them? And context: is the data itself guest-visible anyway (family scope API), and what do the
// other audiences (household adult, TV kiosk) see?
//   node "audits/tools/phase2/HOME/verify-guest-sees-kids-card-2.mjs"
// Evidence → audits/evidence/p2/HOME/verify-guest-sees-kids-card-2.json (+ .png of the fresh guest's Home)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/HOME');
fs.mkdirSync(OUT, { recursive: true });
const res = {};

const homeInfo = async d => {
  await d.goto('#home');
  await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#view-home .gcard'), null, { timeout: 20000 });
  await sleep(700);
  return d.page.evaluate(() => {
    const k = document.querySelector('#view-home .kids-card');
    return {
      profile: hub.profile && { id: hub.profile.id, kind: hub.profile.kind },
      isGuest: !!(hub.session && hub.session.profile && hub.session.profile.is_guest),
      cards: [...document.querySelectorAll('#view-home .gcard h2')].map(h => h.textContent.trim()),
      kidsCard: !!k,
      kidsLine: k ? k.querySelector('.kids-line').textContent.trim() : null,
      kidsSub: k ? k.querySelector('.gsub').textContent.trim() : null,
      kidsButtons: k ? k.querySelectorAll('button').length : null,
    };
  });
};
const meInfo = async d => {
  await d.page.click('#tabbar .tab[data-tab="me"]'); await sleep(800);
  return d.page.evaluate(() => ({ headings: [...document.querySelectorAll('#view-me h2')].map(h => h.textContent.trim()), rewardsCard: !!document.querySelector('#rewards'), cashInButtons: document.querySelectorAll('[data-cashin]').length }));
};

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  // 1. the seeded guest (Grandma Jo)
  const g = await L.device({ device: 'ipad-portrait', profile: 'guest-grandmajo' });
  res.seededGuest = { home: await homeInfo(g) };
  res.seededGuest.me = await meInfo(g);
  await g.close();

  // 2. a guest created the real way: Eli → POST /api/profiles, then a new device signed in as that guest
  const made = await L.apiAs('eli', '/api/profiles', { method: 'POST', body: { name: 'Uncle Rig', emoji: '🤠', color: '#5B6FA8', expires_at: null } });
  res.createdGuest = { create: { status: made.status, id: made.body && made.body.profile && made.body.profile.id, is_guest: made.body && made.body.profile && made.body.profile.is_guest, kind: made.body && made.body.profile && made.body.profile.kind } };
  const gid = res.createdGuest.create.id;
  if (gid) {
    const dev = await L.newDevice({ name: 'Guest phone', profiles: [gid] });
    const g2 = await L.device({ device: 'iphone-pwa', profile: gid, as: dev });
    res.createdGuest.home = await homeInfo(g2);
    await g2.page.screenshot({ path: path.join(OUT, 'verify-guest-sees-kids-card-2-home.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
    res.createdGuest.me = await meInfo(g2);
    // the data behind the card: family-scope kidverse rows, read through the API as the guest
    const api = await L.apiAs(null, '/api/data/kidverse?scope=family', { deviceToken: dev.device.token, profileToken: dev.sessions[gid] });
    const items = (api.body && api.body.items) || [];
    res.createdGuest.apiFamilyKidverse = { status: api.status, keys: items.map(i => i.key), starsTotals: Object.fromEntries(items.filter(i => /^stars:/.test(i.key)).map(i => [i.key, i.value && { count: i.value.count, total: i.value.total, badges: i.value.badges && Object.keys(i.value.badges).length }])) };
    await g2.close();
  }

  // 3. a household adult (Eli) for comparison
  const e = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  res.eli = { home: await homeInfo(e) };
  await e.close();

  // 4. the TV kiosk board's stars pane (visible to anyone in the room)
  const tv = await L.device({ device: 'tv', profile: 'tv' }).catch(() => L.device({ device: 'desktop', profile: 'tv' }));
  await tv.goto('#home'); await sleep(2500);
  res.tv = await tv.page.evaluate(() => { const t = document.body.innerText; const m = t.match(/[^\n]*★\d[^\n]*/g); return { starLines: m ? m.slice(0, 6) : [], toCashIn: /to cash in/.test(t) }; });
  await tv.close();
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-guest-sees-kids-card-2.json'), JSON.stringify(res, null, 1));
  await L.close();
}

const s = res.seededGuest, c = res.createdGuest;
console.log(`[seeded guest] ${s.home.profile.id} kind=${s.home.profile.kind} is_guest=${s.home.isGuest}; Home cards: ${s.home.cards.join(' | ')}`);
console.log(`[seeded guest] Kids card: ${s.home.kidsCard} — "${s.home.kidsLine}" / "${s.home.kidsSub}" (buttons in card: ${s.home.kidsButtons})`);
console.log(`[seeded guest] Me headings: ${s.me.headings.join(', ')}; #rewards: ${s.me.rewardsCard}; cash-in buttons: ${s.me.cashInButtons}`);
if (c.home) {
  console.log(`[created guest] POST /api/profiles → ${c.create.status} ${c.create.id} kind=${c.create.kind} is_guest=${c.create.is_guest}`);
  console.log(`[created guest] is_guest=${c.home.isGuest} Kids card: ${c.home.kidsCard} — "${c.home.kidsLine}" / "${c.home.kidsSub}"; Me #rewards: ${c.me.rewardsCard}`);
  console.log(`[created guest] GET /api/data/kidverse?scope=family as the guest → ${c.apiFamilyKidverse.status}; stars rows: ${JSON.stringify(c.apiFamilyKidverse.starsTotals)}`);
}
console.log(`[eli] Kids card: ${res.eli.home.kidsCard} — "${res.eli.home.kidsLine}" / "${res.eli.home.kidsSub}"`);
console.log(`[tv] star lines: ${JSON.stringify(res.tv.starLines)}; "to cash in" on TV: ${res.tv.toCashIn}`);
