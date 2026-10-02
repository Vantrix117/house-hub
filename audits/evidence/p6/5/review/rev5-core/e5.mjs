// rev5-core round 3: hist edge cases (stale second device, trim boundary, prev+hist, F260 practice), Home == Verses,
// Undo within the 400 ms cool-down on a held network.
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const L = await local({ variant: 'empty', clock: 'real' });
const NY = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
const T0 = NY(Date.now());
const D = n => new Date(Date.parse(T0 + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const put = (who, app, key, value, scope = 'person', updated_at = Date.now()) => L.apiAs(who, `/api/data/${app}/${encodeURIComponent(key)}?scope=${scope}`, { method: 'PUT', body: { value, updated_at } });
const get = async (who, app, key, scope = 'person') => { const r = await L.apiAs(who, `/api/data/${app}?scope=${scope}`); const it = (r.body.items || []).find(i => i.key === key); return it ? it.value : undefined; };
const F = { app: 'f260', scope: 'person' };
async function both(who, dev) {   // Verses' dayStreak and the shell's versesStreak on the same device's rows
  const d = dev || await L.device({ device: 'iphone-pwa', profile: who, fixedTime: false });
  await d.page.goto(L.site + '/apps/verses.html');
  await d.page.waitForFunction(() => window.verses && hub.isLoaded('verses', 'person') && hub.isLoaded('f260', 'person'), null, { timeout: 20000 });
  await sleep(500);
  const v = await d.page.evaluate(() => verses.dayStreak());
  await d.page.goto(L.site + '/index.html');
  await d.page.waitForFunction(() => document.querySelector('#view-home .verses-card .gsub'), null, { timeout: 20000 }).catch(() => {});
  await sleep(1500);
  const h = await d.page.evaluate(() => (document.querySelector('#view-home .verses-card .gsub') || {}).textContent || '');
  return { verses: v, home: h, dev: d };
}
const out = {};
try {
  // Round 4: rev rows that must NOT count as a rating, on the H1 shape (S0 due D-3, last D-10; reviews D-10 and D0).
  // With no lost rating, D-1 was due (S0) and nothing was rated -> streak 1.
  const shape = async (who, id) => { await put(who, 'f260', 'mem:' + id, true, 'person', Date.now() - 20 * 86400000);
    await put(who, 'f260', 'recall:' + id, { s: 'got', t: Date.now(), box: 5, due: D(14), last: D(0), streak: 2, hist: [{ due: D(-3), last: D(-10) }] });
    for (const d of [D(-10), D(0)]) await put(who, 'verses', 'rev:' + d + ':' + id + ':a', 1); };
  await shape('niece', '7-0'); await put('niece', 'verses', 'rev:' + D(-3) + ':7-0:b', 0);
  let z = await both('niece'); out.R_value0 = { verses: z.verses, home: z.home, want: 1 }; await z.dev.close();
  await shape('mom', '8-0'); await put('mom', 'verses', 'rev:' + D(-3) + ':8-0:b', 1);
  out.R_tombDel = (await L.apiAs('mom', '/api/data/verses/' + encodeURIComponent('rev:' + D(-3) + ':8-0:b') + '?scope=person', { method: 'DELETE' })).status;
  z = await both('mom'); out.R_tombstone = { verses: z.verses, home: z.home, want: 1 }; await z.dev.close();
  await shape('eli', '9-0'); await put('eli', 'verses', 'rev:' + D(-10) + ':9-0:b', 1);
  z = await both('eli'); out.R_sameDayAsLast = { verses: z.verses, home: z.home, want: 1 }; await z.dev.close();
  await shape('dad', '10-0'); await put('dad', 'verses', 'rev:' + D(-1) + ':10-0:b', 1);
  z = await both('dad'); out.R_revOnD = { verses: z.verses, home: z.home, want: 2 }; await z.dev.close();
  await shape('christian', '11-0'); await put('christian', 'verses', 'rev:' + D(-3) + ':11-0:b', 1);
  z = await both('christian'); out.R_lostThenNothingDue = { verses: z.verses, home: z.home, want: 3 }; await z.dev.close();
  // a kid: Ezra, the same shape on week 1's verse; a kid's every past unrated day breaks (rule unchanged)
  await put('ezra', 'f260', 'recall:1-0', { s: 'got', t: Date.now(), box: 5, due: D(14), last: D(0), streak: 2, hist: [{ due: D(-3), last: D(-10) }] });
  for (const d of [D(-10), D(-3), D(0)]) await put('ezra', 'verses', 'rev:' + d + ':1-0:a', 1);
  const k = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
  await k.page.goto(L.site + '/apps/verses.html');
  await k.page.waitForFunction(() => window.verses && hub.isLoaded('verses', 'person') && hub.isLoaded('f260', 'person') && hub.isLoaded('kidverse', 'family'), null, { timeout: 20000 });
  out.R_kid = { verses: await k.page.evaluate(() => verses.dayStreak()), want: 1 }; await k.close();
} catch (e) { console.error(e); }
console.log(JSON.stringify(out, null, 1));
await L.close();
