// Phase 2 / PWA — does praying for a PRIVATE request put its title on the family feed? (lead: Prayer, 01-leads.md)
//   node "audits/tools/phase2/PWA/feed-private.mjs"
// Eli opens Prayer on his own ("Mine") list and taps the check on one request; then the feed is read the way the TV
// reads it — with the device token alone, no profile (hub.activityFeed sends profile:false, apps/hub.js:387).
// Writes audits/evidence/p2/PWA/feed-private-run.json.
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  const f = await d.openApp('prayer', { wait: '.mark' }); await sleep(1500);
  const pick = await f.evaluate(() => {
    const b = [...document.querySelectorAll('.mark[data-pray]')].find(x => x.getAttribute('aria-pressed') === 'false');
    if (!b) return null;
    const row = b.closest('li, .row, .item') || b.parentElement;
    const id = b.dataset.pray; const list = (typeof D !== 'undefined' && D) ? D.activeList : '?';
    const title = (typeof D !== 'undefined' && D && D.lists && D.lists[D.activeList] && (D.lists[D.activeList].prayers || []).find(p => p.id === id) || {}).title || (row ? row.innerText.split('\n')[0] : '');
    b.click();
    return { id, activeList: list, title };
  });
  out.tapped = pick;
  await sleep(2000);
  const personRows = (await L.apiAs('eli', '/api/data/prayer?scope=person')).body.items.map(i => i.key);
  const familyRows = (await L.apiAs('eli', '/api/data/prayer?scope=family')).body.items.map(i => i.key);
  out.rowScope = pick ? { inElisPersonScope: personRows.includes('prayer:' + pick.id), inFamilyScope: familyRows.includes('prayer:' + pick.id) } : null;
  const feedAsDevice = (await L.apiAs(null, '/api/activity?limit=10')).body.activity;   // device token only, as the TV board / Home fetch it
  out.feedLine = feedAsDevice.filter(a => pick && a.text.startsWith('Prayed for ') && a.text.includes(pick.title)).map(a => ({ who: a.profile_id, text: a.text }));
  console.log(JSON.stringify(out, null, 1));
} finally {
  fs.writeFileSync(path.join(OUT, 'feed-private-run.json'), JSON.stringify(out, null, 1));
  await L.close();
}
