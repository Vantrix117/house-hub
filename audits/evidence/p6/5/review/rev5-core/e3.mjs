// rev5-core round 2: E2b streak after two reviews; E3 policy matrix; E8 Undo offline; E9 Undo on a slow network;
// E11 U in F260 inside the hub after rating in Verses; E12 U inside the editor's textarea.
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const L = await local({ variant: 'empty', clock: 'real' });
const NY = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
const today = NY(Date.now());
const D = n => new Date(Date.parse(today + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const put = (who, app, key, value, scope = 'person', updated_at = Date.now()) => L.apiAs(who, `/api/data/${app}/${encodeURIComponent(key)}?scope=${scope}`, { method: 'PUT', body: { value, updated_at } });
const get = async (who, app, key, scope = 'person') => { const r = await L.apiAs(who, `/api/data/${app}?scope=${scope}`); const it = (r.body.items || []).find(i => i.key === key); return it ? it.value : undefined; };
const open = async (who, extra = {}) => { const d = await L.device({ device: 'iphone-pwa', profile: who, fixedTime: false, ...extra }); await d.page.goto(L.site + '/apps/verses.html'); await d.page.waitForFunction(() => window.verses && hub.isLoaded('verses', 'person') && hub.isLoaded('f260', 'person') && verses.current(), null, { timeout: 20000 }); return d; };
const out = {};
try {
  // E2b: Mae: rated D-3 (Not yet -> due D-2), missed D-2, rated D-1 (Not yet, prev {due D-2, last D-3}), then today.
  await put('christian', 'f260', 'mem:2-0', true, 'person', Date.now() - 10 * 86400000);
  await put('christian', 'f260', 'recall:2-0', { s: 'not', t: Date.now() - 86400000, box: 1, due: D(0), last: D(-1), streak: 0, prev: { due: D(-2), last: D(-3) } });
  await put('christian', 'verses', `rev:${D(-3)}:2-0:x`, 1);
  await put('christian', 'verses', `rev:${D(-1)}:2-0:x`, 1);
  const M = await open('christian');
  out.e2b_beforeToday = await M.page.evaluate(() => verses.dayStreak());
  await M.page.evaluate(() => { verses.reveal(); return verses.rate('got'); });
  await sleep(1500);
  out.e2b_afterToday = await M.page.evaluate(() => ({ streak: verses.dayStreak(), row: hub.get('recall:2-0', { app: 'f260', scope: 'person' }) }));
  await M.close();

  // E3: policy matrix on text rows
  const okv = by => ({ text: 'PLACEHOLDER', by, at: Date.now() });
  out.e3 = {
    niece_self: (await put('niece', 'verses', 'text:1-0', okv('niece'), 'family')).status,
    niece_otherBy: (await put('niece', 'verses', 'text:1-0', okv('eli'), 'family')).status,
    niece_junkKey: (await put('niece', 'verses', 'summary', { x: 1 }, 'family')).status,
    niece_week53: (await put('niece', 'verses', 'text:53-0', okv('niece'), 'family')).status,
    niece_huge: (await put('niece', 'verses', 'text:2-1', { text: 'A'.repeat(4001), by: 'niece', at: 1 }, 'family')).status,
    niece_extraField: (await put('niece', 'verses', 'text:2-1', { text: 'x', by: 'niece', at: 1, z: 1 }, 'family')).status,
    eli_tombstone_of_niece_row: (await L.apiAs('eli', '/api/data/verses/text:1-0?scope=family', { method: 'DELETE' })).status,
    ezra: (await put('ezra', 'verses', 'text:1-1', okv('ezra'), 'family')).status,
    ezra_delete: (await L.apiAs('ezra', '/api/data/verses/text:1-0?scope=family', { method: 'DELETE' })).status,
    tv: (await put('tv', 'verses', 'text:1-1', okv('tv'), 'family')).status,
  };
  const g = await L.apiAs('eli', '/api/profiles', { method: 'POST', body: { name: 'Aunt Sue', emoji: '🌻', color: '#137F77', expires_at: Date.now() + 86400000 } });
  const gid = g.body && (g.body.profile ? g.body.profile.id : g.body.id);
  const gd = await L.newDevice({ name: 'Guest phone', profiles: [gid] });
  const gput = (key, value) => L.apiAs(null, `/api/data/verses/${key}?scope=family`, { method: 'PUT', body: { value, updated_at: Date.now() }, deviceToken: gd.device.token, profileToken: gd.sessions[gid] }).then(r => r.status);
  out.e3.guest_self = await gput('text:3-0', okv(gid));
  out.e3.guest_tombstone = await gput('text:3-0', null);
  // a person-scope verses row (summary, mode) is not touched by the family rule
  out.e3.niece_person_summary = (await put('niece', 'verses', 'summary', { due: 0 })).status;

  // E8: Undo offline
  await put('eli', 'f260', 'mem:1-0', true);
  const A = await open('eli');
  await A.page.evaluate(() => { verses.reveal(); return verses.rate('got'); });
  await sleep(1500);
  await A.setOffline(true);
  const t0 = Date.now();
  out.e8_undo = await A.page.evaluate(() => verses.undo());
  out.e8_ms = Date.now() - t0;
  out.e8_local = await A.page.evaluate(() => hub.get('recall:1-0', { app: 'f260', scope: 'person' }) ?? null);
  await A.setOffline(false);
  await sleep(3000);
  out.e8_server = (await get('eli', 'f260', 'recall:1-0')) ?? null;

  // E9: Undo on a hanging network: every API request held 9 s; a second tap on Got it while Undo waits
  await A.page.evaluate(() => { verses.reveal(); return verses.rate('almost'); });
  await sleep(1500);
  await A.ctx.route(u => u.href.startsWith(L.api), async r => { await sleep(9000); r.continue().catch(() => {}); });
  const pending = A.page.evaluate(() => { window.__u = verses.undo(); return true; });
  await pending; await sleep(800);
  out.e9_whileWaiting = await A.page.evaluate(() => ({ cur: verses.current(), cooling: verses.isCooling(), rateVisible: !document.querySelector('#act-rate').hidden, toast: (document.getElementById('hub-toast') || {}).hidden }));
  out.e9_secondRate = await A.page.evaluate(() => verses.rate('got'));
  out.e9_undoResult = await A.page.evaluate(() => window.__u);
  out.e9_toast = await A.page.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent.trim() : null; });
  await A.ctx.unroute(u => u.href.startsWith(L.api)).catch(() => {});
  await A.close();

  // E11/E12: in the hub: rate in Verses, then press U inside F260 / in a textarea
  await put('dad', 'f260', 'mem:1-1', true);
  const H = await L.device({ device: 'ipad-portrait', profile: 'dad', fixedTime: false });
  const f = await H.openApp('verses');
  await f.waitForFunction(() => window.verses && verses.current() === '1-1', null, { timeout: 20000 });
  await f.evaluate(() => { verses.reveal(); return verses.rate('not'); });
  await sleep(1200);
  await H.page.evaluate(() => { location.hash = '#f260'; });
  await sleep(2500);
  const f2 = H.frame('f260');
  out.e11_f260Frame = !!f2;
  if (f2) { await f2.evaluate(() => { document.activeElement && document.activeElement.blur(); }); await H.page.keyboard.press('u'); await H.page.keyboard.press('Control+z'); }
  await sleep(1500);
  out.e11_rowAfter = await f.evaluate(() => (hub.get('recall:1-1', { app: 'f260', scope: 'person' }) || {}).s);
  await H.close();
} catch (e) { console.error(e); }
console.log(JSON.stringify(out, null, 1));
await L.close();
