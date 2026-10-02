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
  // H1: a stale offline device. S0 = due D-3, last D-10 (box 4). Device A rated on D-3 (Got it -> due D+4) but that row was
  // lost to device B, which rated today from its stale copy (offline since before D-3). Reviews: D-10, D-3 (A), D0 (B).
  // Truth: D-2 and D-1 had nothing due (A's schedule), so the streak is 3. The row only knows S0.
  await put('christian', 'f260', 'mem:3-0', true, 'person', Date.now() - 20 * 86400000);
  await put('christian', 'f260', 'recall:3-0', { s: 'got', t: Date.now(), box: 5, due: D(14), last: D(0), streak: 2, hist: [{ due: D(-3), last: D(-10) }] });
  for (const [d, dev] of [[D(-10), 'a'], [D(-3), 'a'], [D(0), 'b']]) await put('christian', 'verses', `rev:${d}:3-0:${dev}`, 1);
  const h1 = await both('christian'); out.H1_staleDevice = { verses: h1.verses, home: h1.home, truth: 3 }; await h1.dev.close();

  // H2: the trim. Mae's other verse 4-0: hist [never, E1 last D-40, E2 last D-20 (due D-12)], current last D-12, due D(0).
  await put('dad', 'f260', 'mem:4-0', true, 'person', Date.now() - 60 * 86400000);
  await put('dad', 'f260', 'recall:4-0', { s: 'got', t: Date.now(), box: 3, due: D(0), last: D(-12), streak: 2, hist: [{ due: null, last: null }, { due: D(-33), last: D(-40) }, { due: D(-12), last: D(-20) }] });
  for (const d of [D(-40), D(-20), D(-12)]) await put('dad', 'verses', `rev:${d}:4-0:x`, 1);
  const dd = await L.device({ device: 'iphone-pwa', profile: 'dad', fixedTime: false });
  await dd.page.goto(L.site + '/apps/verses.html');
  await dd.page.waitForFunction(() => window.verses && hub.isLoaded('verses', 'person') && hub.isLoaded('f260', 'person') && verses.current() === '4-0', null, { timeout: 20000 });
  out.H2_beforeRate = await dd.page.evaluate(() => verses.dayStreak());
  await dd.page.evaluate(() => { verses.reveal(); return verses.rate('got'); });
  await sleep(1500);
  out.H2_hist = await dd.page.evaluate(() => hub.get('recall:4-0', { app: 'f260', scope: 'person' }).hist);
  // second rating the same day adds nothing
  await dd.page.evaluate(() => verses.practise('4-0'));
  await sleep(300);
  await dd.page.evaluate(() => { verses.reveal(); return verses.rate('almost'); });
  await sleep(1500);
  out.H2_histAfterSecond = await dd.page.evaluate(() => hub.get('recall:4-0', { app: 'f260', scope: 'person' }).hist);
  const h2 = await both('dad', dd); out.H2_afterRate = { verses: h2.verses, home: h2.home }; await dd.close();

  // H3: a row with both prev and hist (hist wins), then F260's practice mark (Object.assign of s,t) keeps hist
  await put('mom', 'f260', 'mem:5-0', true, 'person', Date.now() - 20 * 86400000);
  await put('mom', 'f260', 'recall:5-0', { s: 'got', t: 1, box: 2, due: D(1), last: D(-1), streak: 1, prev: { due: D(-5), last: D(-8) }, hist: [{ due: D(-2), last: D(-4) }] });
  for (const d of [D(-4), D(-1)]) await put('mom', 'verses', `rev:${d}:5-0:x`, 1);
  // truth by hist: D-2 due (schedule last D-4, due D-2) and not rated -> break: streak 1 (D-1). By prev it would be generous.
  const h3 = await both('mom'); out.H3_prevAndHist = { verses: h3.verses, home: h3.home, wantByHist: 1 };
  const f = await (async () => { await h3.dev.page.goto(L.site + '/apps/f260.html'); await h3.dev.page.waitForFunction(() => window.hub && hub.isLoaded && hub.isLoaded(), null, { timeout: 20000 }); return h3.dev.page; })();
  out.H3_f260HasPractice = await f.evaluate(() => !!document.querySelector('[data-prmark]'));
  await h3.dev.close();

  // C: Undo pressed within the 400 ms cool-down while every API call is held 9 s; then try to tap a rating
  await put('eli', 'f260', 'mem:6-0', true); await put('eli', 'f260', 'mem:6-1', true);
  const A = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await A.page.goto(L.site + '/apps/verses.html');
  await A.page.waitForFunction(() => window.verses && hub.isLoaded('verses', 'person') && hub.isLoaded('f260', 'person') && verses.current(), null, { timeout: 20000 });
  const first = await A.page.evaluate(() => verses.current());
  await A.page.evaluate(() => { verses.reveal(); return verses.rate('got'); });
  await A.ctx.route(u => u.href.startsWith(L.api), async r => { await sleep(9000); r.continue().catch(() => {}); });
  await sleep(100);
  await A.page.evaluate(() => { window.__u = verses.undo(); });
  await sleep(600);
  out.C_during = await A.page.evaluate(() => ({ cur: verses.current(), cooling: verses.isCooling(), rated: document.querySelector('#trainer').classList.contains('rated'), tapRate: verses.rate('not') }));
  out.C_result = await A.page.evaluate(() => window.__u);
  out.C_after = await A.page.evaluate(f => ({ cur: verses.current(), row: hub.get('recall:' + f, { app: 'f260', scope: 'person' }) ?? null, toast: (() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent.trim() : null; })() }), first);
  await A.close();
} catch (e) { console.error(e); }
console.log(JSON.stringify(out, null, 1));
await L.close();
