// SYNC e8 — hub.ready() skips its first-pull wait when ANY declared channel was ever pulled (apps/hub.js:334-337), not the
// channel the app is about to read. The shell pulls prayer|person but not prayer|family (index.html:458-459), so on a device
// where Ezra has signed in (the shell pulled his person scope) Prayer opens with an empty family cache.
//   node "audits/tools/phase2/SYNC/e8-ready-seen.mjs"
// Lead (01-leads.md, Prayer): "Opening Prayer on a new device resets the family list's settings for everyone."
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, shot, writeEvidence } from './_util.mjs';

const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const reader = await L.newDevice({ name: 'Audit reader', profiles: ['mom'] });
  const famRows = async () => Object.fromEntries((await L.apiAs(null, '/api/data/prayer?scope=family', { deviceToken: reader.device.token, profileToken: reader.sessions.mom })).body.items
    .filter(i => !i.key.startsWith('prayer:')).map(i => [i.key, i.key === 'plans' ? (i.value || []).map(p => p.name || p.id) : i.key === 'categories' ? (i.value || []).length + ' categories' : i.value]));
  out.before = await famRows();
  log('family list settings on the server before:', JSON.stringify(out.before));
  const kd = await L.newDevice({ name: 'Playroom iPad', profiles: ['ezra'] });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false, as: kd });
  const posts = [];
  ipad.page.on('request', r => { if (r.method() === 'POST' && /\/api\/data\/prayer\/batch\?scope=family/.test(r.url())) { try { posts.push(JSON.parse(r.postData()).items.map(i => i.key)); } catch {} } });
  await ipad.goto('#home'); await waitFor(() => ipad.page.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 });
  out.shellCaches = await ipad.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.cache.prayer')));
  const f = await ipad.openApp('prayer');
  await sleep(4000);
  out.familyKeysPosted = posts;
  out.after = await famRows();
  out.shot = await shot(ipad.page, 'e8-ezra-prayer-first-open.png');
  log(`shell caches before Prayer opened: ${JSON.stringify(out.shellCaches)}; family keys Prayer POSTed on first open: ${JSON.stringify(out.familyKeysPosted)}`);
  log('family list settings on the server after Ezra opened Prayer once:', JSON.stringify(out.after));
  log('evidence', writeEvidence('e8-ready-seen.json', out));
} finally { await L.close(); }
