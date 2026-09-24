// Skeptic #1 for "guest-sees-kids-card": does a guest (Grandma Jo) get the Kids card with the cash-in balance on Home
// while Me hides Kids' rewards from her? Independent of leads.mjs. Also gathers the context that bears on intent/severity:
// a household adult's Home + Me (control), what the guest can see in Kid Verse, and what the API lets the guest read.
//   node "audits/tools/phase2/HOME/verify-guest-sees-kids-card-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/HOME');
fs.mkdirSync(OUT, { recursive: true });
const out = {};

const readHome = page => page.evaluate(() => ({
  isGuest: !!(hub.session && hub.session.profile && hub.session.profile.is_guest),
  kind: hub.profile && hub.profile.kind,
  cards: [...document.querySelectorAll('#view-home .gcard')].map(c => (c.querySelector('h2') || {}).textContent.trim()),
  kidsCard: (() => { const k = document.querySelector('#view-home .kids-card'); return k ? k.innerText.replace(/\s+/g, ' ').trim() : null; })(),
}));
const readMe = page => page.evaluate(() => ({
  headings: [...document.querySelectorAll('#view-me h2')].map(h => h.textContent.replace(/\s+/g, ' ').trim()),
  rewardsCard: !!document.querySelector('#rewards'),
  rewardsText: (document.querySelector('#rewards-body') || {}).innerText || null,
}));

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const [who, device] of [['guest-grandmajo', 'ipad-portrait'], ['guest-grandmajo', 'iphone-pwa'], ['mom', 'ipad-portrait']]) {
    const d = await L.device({ device, profile: who });
    await d.goto('#home');
    await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#view-home .gcard'), null, { timeout: 20000 });
    await sleep(800);
    const home = await readHome(d.page);
    const png = path.join(OUT, `verify-guest-sees-kids-card-1-${who}-${device}-home.png`);
    await d.page.evaluate(() => { const k = document.querySelector('#view-home .kids-card'); if (k) k.scrollIntoView({ block: 'center' }); }); await sleep(300);
    await d.page.screenshot({ path: png, scale: 'css', animations: 'disabled', caret: 'hide' });   // 1x css scale, the Kids card (if any) scrolled into view
    await d.page.click('#tabbar .tab[data-tab="me"]'); await sleep(800);
    const me = await readMe(d.page);
    out[`${who}@${device}`] = { home, me, png: path.relative(ROOT, png) };
    console.log(`[${who} @ ${device}] is_guest=${home.isGuest} kind=${home.kind}`);
    console.log(`   Home cards: ${home.cards.join(' | ')}`);
    console.log(`   Home Kids card: ${home.kidsCard ? JSON.stringify(home.kidsCard) : 'ABSENT'}`);
    console.log(`   Me headings: ${me.headings.join(' | ')}; Kids' rewards card in Me: ${me.rewardsCard}`);
    await d.close();
  }

  // Context 1: the guest opening Kid Verse (apps.json kidverse visibleTo lists household adults, so a guest sees it)
  {
    const d = await L.device({ device: 'ipad-portrait', profile: 'guest-grandmajo' });
    const visible = await (async () => { await d.goto('#apps'); await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 20000 }); await sleep(500); return d.page.evaluate(() => !!document.querySelector('[data-open="kidverse"], [data-app="kidverse"]') || /Kid Verse/.test(document.querySelector('#view-apps') ? document.querySelector('#view-apps').innerText : '')); })();
    const f = await d.openApp('kidverse');
    await f.waitForSelector('#grown:not([hidden])', { timeout: 15000 }).catch(() => {});
    await sleep(800);
    const grown = await f.evaluate(() => { const g = document.querySelector('#grown'); return g && !g.hidden ? g.innerText.replace(/\s+/g, ' ').trim() : null; });
    out.guestKidVerse = { appVisibleInLauncher: visible, grownPane: grown };
    console.log(`[guest Kid Verse] in launcher: ${visible}; grown-ups pane: ${JSON.stringify(grown)}`);
    await d.close();
  }

  // Context 2: what the API gives the guest (UI hiding vs access control)
  {
    const r = await L.apiAs('guest-grandmajo', '/api/data/kidverse?scope=family');
    const items = (r.body && r.body.items) || [];
    const stars = items.filter(i => /^stars:/.test(i.key)).map(i => ({ key: i.key, total: i.value && i.value.total, count: i.value && i.value.count, week: i.value && i.value.week }));
    out.guestApiKidverseFamily = { status: r.status, keys: items.map(i => i.key), stars };
    console.log(`[guest API] GET /api/data/kidverse?scope=family → ${r.status}; stars rows: ${JSON.stringify(stars)}`);
  }
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-guest-sees-kids-card-1.json'), JSON.stringify(out, null, 1));
  await L.close();
}
