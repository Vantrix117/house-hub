// HOME brief (4): Home's information architecture per audience — what each Home shows, what is missing (apps with no
// card / no one-tap entry), and what is repeated. Local instance, demo clock.
//   adult  = Eli (typical)          kid   = Ezra (typical)          guest = Grandma Jo (typical)
//   park   = Eli and Ezra on the park variant (a park day)          first = Eli on the empty variant (a new household)
//   kiosk  = the TV board (typical)
//
//   node "audits/tools/phase2/HOME/ia.mjs"
// Writes audits/evidence/p2/HOME/ia.json and ia-<case>.png (1×, iPad portrait, full page of #views scrolled in steps).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/HOME');
const L = await local({ variant: 'typical', clock: 'demo' });
const res = {};
const dump = page => page.evaluate(() => {
  const v = document.querySelector('#view-home');
  const t = s => (s ? s.textContent.replace(/\s+/g, ' ').trim() : null);
  const regs = (JSON.parse(localStorage.getItem('hub.registry') || '{}').apps || []);
  const grid = [...document.querySelectorAll('#grid .tile')].map(x => x.dataset.id);
  const oneTap = [...new Set([...v.querySelectorAll('[data-open]')].map(b => b.dataset.open))];
  const cards = [...v.querySelectorAll('.gcard')].map(c => ({ title: t(c.querySelector('h2')), headline: t(c.querySelector('.gbig, .kids-line')), sub: t(c.querySelector('.gsub')), button: t(c.querySelector('.btn')) }));
  const blocks = [...v.querySelectorAll(':scope > .home-hero, :scope .kid-cta, :scope .card:not(.gcard), :scope .tv-pane')].map(b => t(b.querySelector('h2')) || (b.classList.contains('home-hero') ? 'hero' : t(b)).slice(0, 40));
  return {
    profile: hub.profile.id, kind: hub.profile.kind,
    hero: { title: t(v.querySelector('.hero-title')), sub: t(v.querySelector('.hero-sub')) },
    cards, blocks, oneTap, appsVisible: grid.length ? grid : null,
    reminders: { count: v.querySelectorAll('#remlist .rem-row').length, canAdd: !!v.querySelector('#remform'), canClear: v.querySelectorAll('#remlist [data-done]').length },
    feed: !!v.querySelector('#feed'),
    registry: regs.map(a => a.id),
  };
});

async function run(label, variant, device, profile) {
  if (variant !== L.__variant) { await L.reset(variant); L.__variant = variant; }
  const d = await L.device({ device, profile });
  await d.goto('#apps');
  await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 15000 }).catch(() => {});
  await sleep(400);
  const apps = await d.page.evaluate(() => [...document.querySelectorAll('#grid .tile')].map(x => x.dataset.id));
  await d.goto('#home');
  await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#view-home .hero, #tv'), null, { timeout: 15000 }).catch(() => {});
  await sleep(900);
  const r = await dump(d.page); r.appsVisible = apps;
  r.noHomePresence = apps.filter(a => !r.oneTap.includes(a) && !r.cards.some(c => (c.button || '').toLowerCase().includes(a)));
  res[label] = r;
  await d.page.screenshot({ path: path.join(OUT, `ia-${label}.png`), scale: 'css', animations: 'disabled' });
  console.log(`\n== ${label} (${variant}, ${profile})`);
  if (r.hero.title) console.log(`   hero: "${r.hero.title}" — "${r.hero.sub}"`);
  for (const c of r.cards) console.log(`   card ${c.title}: "${c.headline}"${c.sub ? ' / "' + c.sub + '"' : ''}${c.button ? ' [' + c.button + ']' : ''}`);
  console.log(`   blocks in order: ${r.blocks.join(' → ')}`);
  console.log(`   reminders: ${r.reminders.count} (add: ${r.reminders.canAdd}, ✓ buttons: ${r.reminders.canClear}); feed: ${r.feed}`);
  console.log(`   apps visible: ${apps.join(', ') || '(none)'}; one tap from Home: ${r.oneTap.join(', ') || '(none)'}; no Home presence: ${r.noHomePresence.join(', ') || '(none)'}`);
  await d.close();
}
L.__variant = 'typical';
await run('adult', 'typical', 'ipad-portrait', 'eli');
await run('kid', 'typical', 'ipad-portrait', 'ezra');
await run('guest', 'typical', 'ipad-portrait', 'guest-grandmajo');
await run('kiosk', 'typical', 'tv', 'tv');
await run('park-adult', 'park', 'ipad-portrait', 'eli');
await run('park-kid', 'park', 'ipad-portrait', 'ezra');
await run('first-adult', 'empty', 'ipad-portrait', 'eli');
fs.writeFileSync(path.join(OUT, 'ia.json'), JSON.stringify(res, null, 1));
await L.close();
