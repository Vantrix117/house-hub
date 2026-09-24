// F260 — date logic across the New York DST change (Sun 1 Nov 2026, 02:00 → 01:00) and on a device in another time zone.
//  A) DST: Eli read every day Oct 25 … Nov 1; open on Mon 2 Nov 08:40 (EST) → streak, heatmap dates, "last read".
//     Then read on Mon 2 Nov → log key, streak.
//  B) Time zone: the same person on a phone set to Europe/London taps Done at 20:30 New York time (01:30 in London,
//     the next day). What day is logged, what the New York iPad's F260 and Home say.
//   node "audits/tools/phase3/f260/time.mjs"
import { local, sleep, save, shot, rows, put, texts, ready } from './_lib.mjs';
import { contextOptions } from '../../lib/devices.mjs';

const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const SEL = ['#todayKind', '#todayDate', '#todayTitle', '#todayStreak', '#streak', '#heroPace'];
const keys = (a, b) => { const o = []; for (let t = Date.UTC(...a); t <= Date.UTC(...b); t += 86400000) o.push(new Date(t).toISOString().slice(0, 10)); return o; };
try {
  // ── A. DST ──
  {
    const T = Date.parse('2026-11-02T08:40:00-05:00');
    await L.clock('2026-09-22T08:40:00-04:00'); await L.reset('typical'); await L.clock(new Date(T).toISOString());
    const r = await rows(L, 'eli');
    const log = { ...r['f260.log'] }; for (const k of keys([2026, 8, 22], [2026, 10, 2])) delete log[k];
    for (const k of keys([2026, 9, 25], [2026, 10, 1])) log[k] = true;          // Oct 25 … Nov 1: 8 days, DST night inside
    await put(L, 'eli', 'f260.log', log);
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: T });
    const f = await d.openApp('f260'); await ready(f);
    const before = await texts(f, SEL);
    const heat = await f.evaluate(() => [...document.querySelectorAll('#heat span')].map(s => s.title + (s.className ? ':' + s.className.trim() : '')));
    const col = i => heat.slice(i * 7, i * 7 + 7);     // one column per Monday-start week
    await f.locator('#todayDone').tap(); await sleep(1500);
    const after = await texts(f, SEL); const r2 = await rows(L, 'eli');
    out.dst = { openAt: '2026-11-02T08:40-05:00', loggedDays: keys([2026, 9, 25], [2026, 10, 1]), before, heatLastTwoColumns: [col(10), col(11)], after, newLogKeys: Object.keys(r2['f260.log']).filter(k => !log[k]) };
    await shot(d.page, 'time-dst-ipad.png');
    await d.close();
    console.log('A DST before:', JSON.stringify([before['#todayKind'], before['#todayStreak'], before['#streak']]));
    console.log('A DST heat columns (Mon..Sun):', JSON.stringify(out.dst.heatLastTwoColumns));
    console.log('A DST after Done:', JSON.stringify([after['#todayStreak'], 'new log keys', out.dst.newLogKeys]));
  }
  // ── B. a phone in London, the family's iPad in New York ──
  {
    const T = Date.parse('2026-09-22T20:30:00-04:00');          // 01:30 Wed 23 Sep in London
    await L.clock('2026-09-22T08:40:00-04:00'); await L.reset('typical');   // reseed relative to the demo morning (a reset keeps the moved clock)
    await L.clock(new Date(T).toISOString());
    // the rig's iPad (New York) — signed in as Eli the normal way; copy its storage into a London context
    const ny = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: T });
    await ny.goto('#home'); await sleep(1500);
    const ls = await ny.page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => /^hub\.(api|device|session|profiles|lastProfile)$/.test(k)).map(k => [k, localStorage.getItem(k)])));
    const ctx = await L.browser.newContext({ ...contextOptions('iphone-pwa', 'light'), timezoneId: 'Europe/London', serviceWorkers: 'block' });
    await ctx.route('https://house-hub-api.catalystfarm1.workers.dev/**', r => r.abort());
    await ctx.addInitScript(([ls, site]) => { if (location.origin === site && !localStorage.getItem('rig.init')) { localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); localStorage.setItem('rig.init', '1'); } }, [ls, L.site]);
    await ctx.clock.install({ time: new Date(T) });
    const page = await ctx.newPage();
    await page.goto(L.site + '/index.html#f260', { waitUntil: 'load' });
    let f; for (let i = 0; i < 100 && !f; i++) { f = page.frames().find(x => x.url().includes('/apps/f260.html')); if (!f) await sleep(100); }
    await ready(f);
    const london = { tz: await f.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone), before: await texts(f, SEL), logBefore: Object.keys((await rows(L, 'eli'))['f260.log']).sort().slice(-3) };
    await f.locator('#todayDone').tap(); await sleep(2000);
    const r = await rows(L, 'eli');
    london.after = await texts(f, SEL); london.logHas = { '2026-09-22': !!r['f260.log']['2026-09-22'], '2026-09-23': !!r['f260.log']['2026-09-23'] }; london.summary = r['f260.summary'];
    // the New York iPad opens F260 a minute later
    await ny.ctx.clock.runFor(60000);
    const g = await ny.openApp('f260'); await ready(g); await sleep(1200);
    const nyUi = await texts(g, SEL);
    await ny.goto('#home'); await sleep(2500);
    const nyHome = await ny.page.evaluate(() => { const c = [...document.querySelectorAll('.gcard')].find(e => /Today's reading/.test(e.textContent)); return c ? c.innerText.replace(/\s+/g, ' ').trim() : null; });
    const ev = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'evening' } });
    const evOut = [].concat(ev.body.results || ev.body).find(x => x && x.job === 'evening') || ev.body;
    out.tz = { at: '2026-09-22T20:30-04:00 (01:30 Sep 23 London)', london, newYorkF260: nyUi, newYorkHome: nyHome, eveningJobEli: (evOut.checked || []).find(c => c.profile === 'eli') };
    await ctx.close(); await ny.close();
    console.log('B London phone:', london.tz, JSON.stringify([london.before['#todayDate'], '→ after Done', london.after['#todayKind']]), 'log', JSON.stringify(london.logHas), 'summary.readToday', london.summary.readToday);
    console.log('B New York iPad F260:', JSON.stringify([nyUi['#todayKind'], nyUi['#todayDate'], nyUi['#todayStreak']]));
    console.log('B New York Home:', nyHome);
    console.log('B evening job (NY date):', JSON.stringify(out.tz.eveningJobEli));
  }
} finally { await L.close(); }
console.log('evidence →', save('time.json', out));
