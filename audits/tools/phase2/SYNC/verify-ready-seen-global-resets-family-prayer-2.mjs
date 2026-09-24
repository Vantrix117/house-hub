// Skeptic #2 for SYNC finding "ready-seen-global-resets-family-prayer".
// Claim: hub.ready() skips the first-pull wait when ANY declared channel has since > 0 (apps/hub.js:334-337); the shell pulls
// prayer|person but not prayer|family (index.html:458), so Prayer's first open on a device builds a default family list and
// save() overwrites the family list settings for the whole house (apps/prayer.html:624-627, 652-655, 685-693, 826-831).
//   node "audits/tools/phase2/SYNC/verify-ready-seen-global-resets-family-prayer-2.mjs"      (~2.5 min)
// Every scenario runs on a freshly reset instance and a fresh browser context (= a new device's storage).
// Part 1, clock 'real':
//   A  Ezra, new device: Home, then Prayer                      (the claim)
//   B  Ezra, new device: Home, then Kid Verse, then Prayer      (does Kid Verse's hub.use('prayer','family') pre-warm it?)
//   C  Mom (adult), new device: Home, then Prayer               (is it kid-only?)
//   D  Eli (adult), new device: Home, then Prayer
//   E  Ezra, new device: Home, Prayer, back Home, Prayer again  (second open: nothing more written)
// Part 2, the demo clock (server + browser at Tue 22 Sep 2026 08:40 NY). With clock 'real' before ~07:32 New York the seed
// stamps prayerDays/rotationFor later than the real now, so the server rejects those two writes (applied=false) and the
// damage looks smaller than it would be in a real house, where those rows were written in the past:
//   F  Ezra, new device: Home, then Prayer                      (is prayerDays, the family's prayed-days history, wiped too?)
//   G  Eli (adult), new device, his own daily rotation not yet frozen today (his rotationFor dated yesterday): Home, Prayer
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
fs.mkdirSync(EVID, { recursive: true });
const log = (...a) => console.log(...a);
const waitFor = async (fn, ms = 15000) => { const u = Date.now() + ms; while (Date.now() < u) { try { const v = await fn(); if (v) return v; } catch {} await sleep(200); } return null; };

const SUM = (k, v) => k === 'plans' ? (v || []).map(p => `${p.id}:${p.name}`) : k === 'categories' ? (v || []).length + ' cats'
  : k === 'prayerDays' ? (v || []).length + ' days' : k === 'rotationFor' ? (v ? `${v.date}|${v.key}|${(v.ids || []).join(',')}` : v) : v;

const out = { realNow: new Date().toISOString(), scenarios: {} };
for (const clock of ['real', 'demo']) {
  const L = await local({ variant: 'typical', clock });
  try {
    async function famRows(reader) {
      const r = await L.apiAs(null, '/api/data/prayer?scope=family', { deviceToken: reader.device.token, profileToken: reader.sessions.mom });
      const items = r.body.items || [];
      return {
        settings: Object.fromEntries(items.filter(i => !i.key.startsWith('prayer:')).map(i => [i.key, { v: SUM(i.key, i.value), t: new Date(i.updated_at).toISOString() }])),
        prayerRows: items.filter(i => i.key.startsWith('prayer:') && i.value != null).length,
      };
    }
    async function scenario(name, profile, steps, pre) {
      await L.reset('typical');
      const setup = pre ? await pre() : null;
      const reader = await L.newDevice({ name: 'Audit reader', profiles: ['mom'] });
      const before = await famRows(reader);
      const nd = await L.newDevice({ name: 'New device ' + name, profiles: [profile] });
      const d = await L.device({ device: 'ipad-portrait', profile, fixedTime: clock === 'real' ? false : undefined, as: nd });
      const posts = [];
      d.page.on('response', async r => {
        const q = r.request();
        if (q.method() === 'POST' && /\/api\/data\/prayer\/batch\?scope=family/.test(q.url())) {
          let sent = []; let res = [];
          try { sent = JSON.parse(q.postData()).items.map(i => ({ key: i.key, v: SUM(i.key, i.value), t: new Date(i.updated_at).toISOString() })); } catch {}
          try { res = (await r.json()).results.map(x => ({ key: x.key, applied: x.applied })); } catch {}
          posts.push({ sent, res });
        }
      });
      await d.goto('#home');
      await waitFor(() => d.page.evaluate(() => hub.sync.lastPull > 0));
      const shellCaches = await d.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.cache.prayer')));
      const trail = await steps(d);
      await sleep(4000);
      const pf = d.frame('prayer');
      const inApp = pf ? await pf.evaluate(() => ({ kind: hub.profile && hub.profile.kind, activeList: D.activeList, famPlans: D.lists.shared.plans.map(p => p.id + ':' + p.name), famActive: D.lists.shared.activePlan, famPrayerDays: D.lists.shared.prayerDays.length, famPrayers: D.lists.shared.prayers.length })).catch(e => String(e)) : null;
      const after = await famRows(reader);
      const changed = Object.keys(before.settings).filter(k => JSON.stringify(before.settings[k].v) !== JSON.stringify((after.settings[k] || {}).v));
      const r = { clock, profile, setup, shellCaches, trail, posts, inApp, before, after, changedOnServer: changed };
      out.scenarios[name] = r;
      log(`\n== ${name} (${profile}, clock ${clock}) ==`);
      if (setup) log('  setup:', JSON.stringify(setup));
      log('  prayer caches after Home pulled:', JSON.stringify(shellCaches), ' trail:', JSON.stringify(trail));
      log('  family batch POSTs:', JSON.stringify(posts.map(p => p.sent.map(s => s.key))));
      for (const p of posts) for (const s of p.sent) log(`    sent ${s.key} = ${JSON.stringify(s.v)} @${s.t}  applied=${(p.res.find(x => x.key === s.key) || {}).applied}`);
      log('  server before:', JSON.stringify(Object.fromEntries(Object.entries(before.settings).map(([k, x]) => [k, x.v]))));
      log('  server before timestamps:', JSON.stringify(Object.fromEntries(Object.entries(before.settings).map(([k, x]) => [k, x.t]))));
      log('  server after: ', JSON.stringify(Object.fromEntries(Object.entries(after.settings).map(([k, x]) => [k, x.v]))), ' prayer rows', before.prayerRows, '->', after.prayerRows);
      log('  CHANGED ON SERVER:', JSON.stringify(changed), ' in-app:', JSON.stringify(inApp));
      if (name === 'A' || name === 'F') await d.page.screenshot({ path: path.join(EVID, `verify2-ready-seen-${name}-ezra-prayer.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
      await d.close();
      return r;
    }

    if (clock === 'real') {
      await scenario('A', 'ezra', async d => { await d.openApp('prayer'); return ['prayer']; });
      await scenario('B', 'ezra', async d => {
        await d.openApp('kidverse'); await sleep(4000);
        const c = await d.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.cache.prayer')));
        await d.goto('#home'); await sleep(500);
        await d.openApp('prayer');
        return ['kidverse', 'caches after kidverse: ' + c.join(','), 'prayer'];
      });
      await scenario('C', 'mom', async d => { await d.openApp('prayer'); return ['prayer']; });
      await scenario('D', 'eli', async d => { await d.openApp('prayer'); return ['prayer']; });
      await scenario('E', 'ezra', async d => { await d.openApp('prayer'); await sleep(4000); await d.goto('#home'); await sleep(1000); await d.openApp('prayer'); return ['prayer', 'home', 'prayer']; });
    } else {
      await scenario('F', 'ezra', async d => { await d.openApp('prayer'); return ['prayer']; });
      await scenario('G', 'eli', async d => { await d.openApp('prayer'); return ['prayer']; }, async () => {
        const cur = (await L.apiAs('eli', '/api/data/prayer?scope=person&key=rotationFor')).body.item;
        const v = { ...cur.value, date: '2026-09-21' };
        const r = await L.apiAs('eli', '/api/data/prayer/rotationFor?scope=person', { method: 'PUT', body: { value: v } });
        return { eliRotationForRedated: v.date, key: v.key, status: r.status, applied: r.body && r.body.applied };
      });
    }
  } finally { await L.close(); }
}
const f = path.join(EVID, 'verify2-ready-seen.json');
fs.writeFileSync(f, JSON.stringify(out, null, 2));
log('\nevidence', path.relative(ROOT, f));
