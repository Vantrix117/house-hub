// Completeness critic, Prayer: independent bug sweep. Sections (pass one name to run only it):
//  kitchen  Kitchen view is built once (apps/prayer.html:1645-1656) and absorbRemote's repaint (699-705) never touches it,
//           so a request another adult adds does not appear on an open Kitchen view even after the pull has landed.
//  untick   A tick calls markDay() (1604) but an un-tick never takes the day back out of prayerDays, so a mis-tap that is
//           undone still counts the day in the streak, month count and calendar.
//  sunday   reviewDue() is true every Sunday (805), and Today's nudge then says "Some of the list has gone quiet" (912)
//           even when nothing has gone quiet.
//  planxss  A family `plans` row whose plan id carries markup: renderPlans puts p.id raw into <option value="..."> (1184).
//           Optional 2nd arg: engine (webkit | chromium).
//  guest    prayedBy is keyed by display name (729, 1599; index.html:1059): a guest who shares a household member's name.
// Run: node "audits/tools/phase3/prayer/critic-sweep.mjs" [kitchen|untick|sunday|planxss|guest] [engine]
//   -> audits/evidence/p3/prayer/critic-sweep-<section>.json (+ PNGs)
import fs from 'node:fs';
import { local, sleep, DEMO } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const only = process.argv[2];
const want = s => !only || only === s;
async function app(L, profile, device = 'iphone-pwa', extra = {}) {
  const d = await L.device({ device, profile, ...extra });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 12000 }); await sleep(700);
  return { d, f };
}
async function section(name, engine, clock, fn) {
  if (!want(name)) return;
  const res = { engine }; const log = (k, v) => { res[k] = v; console.log(`[${name}]`, k, '->', JSON.stringify(v).slice(0, 700)); };
  const L = await local({ variant: 'typical', clock, engine });
  try { await fn(L, log); } catch (e) { log('error', String(e.stack || e)); }
  finally { fs.writeFileSync(`${OUT}/critic-sweep-${name}${engine === 'chromium' ? '-chromium' : ''}.json`, JSON.stringify(res, null, 2)); await L.close(); }
}

await section('kitchen', 'webkit', 'real', async (L, log) => {
  const { d: ipad, f } = await app(L, 'eli', 'ipad-landscape', { fixedTime: false });
  await f.click('#listSwitch [data-list="shared"]'); await sleep(500);
  await f.click('#moreBtn'); await sleep(300); await f.click('[data-more="kitchen"]'); await sleep(500);
  const title = 'Critic: rain for the garden';
  log('kitchenBefore', { on: await f.evaluate(() => document.getElementById('kitchen').classList.contains('on')), hasNew: await f.evaluate(t => document.getElementById('kitchenBody').innerText.includes(t), title) });
  // Mae adds a family request on her own phone through the Add form
  const ph = await L.newDevice({ name: 'Mae phone', profiles: ['christian'] });
  const mae = await L.device({ device: 'iphone-pwa', profile: 'christian', fixedTime: false, as: ph });
  const mf = await mae.openApp('prayer', { wait: '#todayLine' }); await sleep(1200);
  await mf.click('#listSwitch [data-list="shared"]'); await sleep(400);
  await mf.click('nav [data-go="add"]'); await mf.fill('#f-title', title); await mf.click('#f-save'); await sleep(3000);
  const srv = await L.apiAs('mom', '/api/data/prayer?scope=family');
  log('onServer', (srv.body.items || []).some(i => i.value && i.value.title === title));
  // wait for the iPad's own 30 s poll to bring it in
  const t0 = Date.now(); let inData = false;
  while (Date.now() - t0 < 45000 && !inData) { await sleep(1000); inData = await f.evaluate(t => D.lists.shared.prayers.some(p => p.title === t), title); }
  log('ipadPulled', { inData, afterMs: Date.now() - t0 });
  await sleep(1500);
  log('kitchenAfterPull', { stillOpen: await f.evaluate(() => document.getElementById('kitchen').classList.contains('on')), kitchenShowsNew: await f.evaluate(t => document.getElementById('kitchenBody').innerText.includes(t), title), todayListHasNew: await f.evaluate(t => document.getElementById('todayList').innerText.includes(t), title) });
  await ipad.shot(`${OUT}/critic-kitchen-stale-ipad.png`);
  await f.click('#kitchenShut'); await sleep(300); await f.click('#moreBtn'); await sleep(300); await f.click('[data-more="kitchen"]'); await sleep(500);
  log('kitchenReopened', { kitchenShowsNew: await f.evaluate(t => document.getElementById('kitchenBody').innerText.includes(t), title) });
});

await section('untick', 'webkit', 'demo', async (L, log) => {
  // Mae (christian): by-day plan with nothing on Tuesday, a 3-day streak that does not include today (seed/prayer.mjs).
  const { d, f } = await app(L, 'christian');
  const read = () => f.evaluate(() => ({ TODAY, daysHasToday: D.lists.personal.prayerDays.includes(TODAY), streak: currentStreak(), month: monthDays(), strip: document.getElementById('todayStrip').innerText.replace(/\s+/g, ' ') }));
  log('before', await read());
  await f.click('nav [data-go="all"]'); await sleep(300);
  const id = await f.evaluate(() => D.lists.personal.prayers.find(p => p.status === 'active').id);
  const openGroup = () => f.evaluate(id => { const b = document.querySelector(`#allList [data-pray="${id}"]`); b.closest('details').open = true; }, id);
  await openGroup();
  await f.click(`#allList [data-pray="${id}"]`); await sleep(500);
  log('afterTick', await read());
  await openGroup();                     // the tick folds the group (P3-PRAYER-07)
  await f.click(`#allList [data-pray="${id}"]`); await sleep(3000);
  log('afterUntick', { ...(await read()), rowLastPrayedAt: await f.evaluate(id => D.lists.personal.prayers.find(p => p.id === id).lastPrayedAt, id) });
  const srv = await L.apiAs('christian', '/api/data/prayer?scope=person');
  const pd = (srv.body.items || []).find(i => i.key === 'prayerDays');
  const today = await f.evaluate(() => TODAY);
  log('serverPrayerDaysHasToday', !!(pd && pd.value.includes(today)));
  await f.click('nav [data-go="answered"]'); await sleep(400);
  log('recordStrip', await f.evaluate(() => document.getElementById('record').innerText.replace(/\s+/g, ' ').slice(0, 120)));
  await d.shot(`${OUT}/critic-untick-record.png`);
});

await section('sunday', 'webkit', 'demo', async (L, log) => {
  const SUN = DEMO + 5 * 86400000;           // Sun 27 Sep 2026 08:40 New York
  for (const p of ['christian', 'niece', 'eli']) {
    const { d, f } = await app(L, p, 'iphone-pwa', { fixedTime: SUN });
    const r = await f.evaluate(() => { const r = reviewItems(); return { day: new Date().toDateString(), cold: r.cold.length, silent: r.silent.length, fresh: r.fresh.length, prompt: document.getElementById('reviewPrompt').innerText.replace(/\s+/g, ' ').trim(), headline: document.getElementById('todayLine').textContent }; });
    log(p, r);
    if (!r.cold) {
      await d.shot(`${OUT}/critic-sunday-${p}-today.png`);
      await f.click('#reviewPrompt [data-go="answered"]').catch(() => {}); await sleep(500);
      log(p + '-record', await f.evaluate(() => ({ open: document.getElementById('reviewWrap').open, body: document.getElementById('reviewBody').innerText.replace(/\s+/g, ' ').slice(0, 160), badge: document.getElementById('reviewCount').textContent })));
    }
    await d.close();
  }
});

await section('planxss', process.argv[3] || 'webkit', 'real', async (L, log) => {
  const payload = 'plx"><img src="x:" onerror="window.__px=(window.__px||0)+1"><i x="';
  const plan = { id: payload, name: 'Everything', mode: 'everything', focusCategory: '', includeDaily: true, rotationSize: 3, groupByCategory: false,
    dayMap: { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] }, show: { meter: true, streak: true, answered: true, anniversaries: true, review: true } };
  // Both pages are opened FIRST: a fresh device's first Prayer open rewrites the family plan row itself (P2-SYNC-02),
  // which would replace the crafted row before it renders. The crafted row is then written and arrives by the normal pull.
  const kid = await app(L, 'kiara', 'ipad-portrait', { fixedTime: false });
  const eli = await app(L, 'eli', 'iphone-pwa', { fixedTime: false });
  await sleep(4000);                                   // let both first-open writes flush
  const now = Date.now();
  const w = await L.apiAs('ezra', '/api/data/prayer/batch?scope=family', { method: 'POST', body: { items: [{ key: 'plans', value: [plan], updated_at: now }, { key: 'activePlan', value: payload, updated_at: now }] } });
  log('writeAsEzra', { status: w.status, body: JSON.stringify(w.body).slice(0, 200) });
  // Kiara: wait for her own 30 s poll; absorbRemote then calls renderPlans() (apps/prayer.html:704)
  const t0 = Date.now(); let got = false;
  while (Date.now() - t0 < 45000 && !got) { await sleep(1000); got = await kid.f.evaluate(p => D.lists.shared.activePlan === p, payload); }
  await sleep(1000);
  log('kiara', { pulled: got, afterMs: Date.now() - t0, px: await kid.f.evaluate(() => window.__px || 0), imgInSelect: await kid.f.evaluate(() => document.querySelectorAll('#f-plan img').length), sessionReadable: await kid.f.evaluate(() => typeof localStorage.getItem('hub.session')) });
  await kid.d.shot(`${OUT}/critic-planxss-kiara.png`);
  // Eli (admin): on his own list; then Family -> Settings
  const t1 = Date.now(); got = false;
  while (Date.now() - t1 < 45000 && !got) { await sleep(1000); got = await eli.f.evaluate(p => D.lists.shared.activePlan === p, payload); }
  const before = await eli.f.evaluate(() => window.__px || 0);
  await eli.f.click('#listSwitch [data-list="shared"]'); await sleep(800);
  const afterSwitch = await eli.f.evaluate(() => window.__px || 0);
  await eli.f.click('nav [data-go="more"]'); await sleep(800);
  log('eli', { pulled: got, pxOnPersonal: before, pxAfterFamily: afterSwitch, pxOnFamilySettings: await eli.f.evaluate(() => window.__px || 0), imgInSelect: await eli.f.evaluate(() => document.querySelectorAll('#f-plan img').length), pageErrors: eli.d.logs.filter(l => l.startsWith('pageerror')).map(l => l.slice(0, 120)) });
  await kid.d.close(); await eli.d.close();
  // parser check on its own: does this engine keep an <img> that select.innerHTML receives?
  const pg = await L.browser.newPage();
  await pg.setContent('<select id=s></select>');
  log('selectParser', await pg.evaluate(async () => { const s = document.getElementById('s'); s.innerHTML = '<option value="a"><img src="x:" onerror="window.__t=1"><i x="">A</option>'; await new Promise(r => setTimeout(r, 300)); return { ua: navigator.userAgent.slice(0, 110), imgKept: !!s.querySelector('img'), fired: !!window.__t }; }));
  await pg.close();
});

await section('guest', 'webkit', 'demo', async (L, log) => {
  // A visiting friend named David (same first name as Dad) is added as a guest, then prays one family request.
  const g = await L.apiAs('mom', '/api/profiles', { method: 'POST', body: { name: 'David', emoji: '\u{1F3A3}', color: '#3A6E8F' } });
  const gid = g.body && (g.body.profile ? g.body.profile.id : g.body.id);
  log('guestCreated', { status: g.status, id: gid });
  await L.sessions();
  const dev = await L.newDevice({ name: 'Guest David phone', profiles: [gid] });
  const gd = await L.device({ device: 'iphone-pwa', profile: gid, as: dev });
  const gf = await gd.openApp('prayer', { wait: '#todayLine' }); await sleep(1500);
  await gf.click('#listSwitch [data-list="shared"]'); await sleep(500);
  const target = await gf.evaluate(() => { const ids = [...document.querySelectorAll('#todayList [data-pray]')].map(b => b.dataset.pray); const p = D.lists.shared.prayers.find(x => ids.includes(x.id) && !(x.prayedBy[TODAY] || []).length); return p && { id: p.id, title: p.title }; });
  log('target', target);
  await gf.click(`#todayList [data-pray="${target.id}"]`); await sleep(3000);
  const srv = await L.apiAs('mom', '/api/data/prayer?scope=family');
  const row = (srv.body.items || []).find(i => i.key === 'prayer:' + target.id);
  log('serverPrayedBy', row.value.prayedBy);
  await gd.close();
  // Elizabeth's view of that row, and the TV board
  const { d: md, f: mf } = await app(L, 'mom');
  await mf.click('#listSwitch [data-list="shared"]'); await sleep(600);
  log('momSeesFaces', await mf.evaluate(id => { const b = document.querySelector(`#todayList [data-pray="${id}"]`); const w = b && b.closest('li').querySelector('.who'); return w ? { label: w.getAttribute('aria-label'), html: w.innerHTML.slice(0, 300) } : null; }, target.id));
  await md.shot(`${OUT}/critic-guest-samename-mom.png`);
  await md.close();
  const tv = await L.device({ device: 'tv', profile: 'tv' }); await tv.goto(''); await sleep(4000);
  log('tvWhoPrayed', await tv.page.evaluate(() => document.body.innerText.split('\n').filter(l => /pray/i.test(l)).slice(0, 8)));
  await tv.shot(`${OUT}/critic-guest-samename-tv.png`);
});
