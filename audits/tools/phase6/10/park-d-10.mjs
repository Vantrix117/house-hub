// Batch 10, Worker D: the park map's waits, the meeting point and the Style pane, on the audit rig (real server clock; Chromium
// stands in for WebKit on the cloud rig). No pairing code. Optional: overlay=<folder under audits/> serves a private build over
// the repo (apps/dollywood-live.html); only=1,2,... runs some sections.
//   node audits/tools/phase6/10/park-d-10.mjs [overlay=audits/tools/d-overlay] [only=1,5]
// Sections: (1) Rally from the meeting bar: the confirm sheet, the request (name, x, y, note), no client-side setMeet, the meta line for
// 3 reached / 0 reached / 429 / an error, the button resting for 60 s, adults only; (2) the pin and the bar drop at 2 h while the map
// stays open; (3) "Dollywood Express" attaches to its listing, and a feed name that matches nothing is logged once; (4) waits older
// than 6 h are gone from the chips, the card, Nearby, Waits and the directions bar (a fresh ride stays); (5) one error line (with and
// without an earlier success), in each pane; (6) the trend arrow from a seeded history (rising, falling, under 5 min, younger than
// 15 min), its aria-label and the card line; (7) the MIN label >= 11 px and >= 4.5:1 on all four bands in all six palettes;
// (8) the Style pane's offline line and the hours link (an adult sees it, a kid and the display do not, 44 px); (9) the meeting
// label: a pill at most 180 px wide, >= 11 px, on the side with no family puck within 40 px.
import { local, sleep } from '../../lib/local.mjs';
const arg = k => (process.argv.find(a => a.startsWith(k + '=')) || '').slice(k.length + 1);
const overlay = arg('overlay') || undefined, only = arg('only') ? arg('only').split(',').map(Number) : null;
let pass = 0, fail = 0;
const ok = (c, name, extra = '') => { c ? pass++ : fail++; console.log(c ? '  ok  ' : '  FAIL', name, c ? '' : extra); };
const want = n => !only || only.includes(n);
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit', overlay });
const errs = [];
const iso = ms => new Date(ms).toISOString();
// a feed in the Worker's shape: [name, land, open, wait, minutes ago]
const feed = rides => ({ ok: true, at: Date.now(), updated: iso(Date.now() - 120e3), source: 'queue-times.com', rides: rides.map(([name, land, open, wait, mins]) => ({ name, land, open, wait, updated: iso(Date.now() - mins * 60e3) })) });
const BASE = [['Thunderhead', 'Timber Canyon', true, 45, 3], ['Wild Eagle', 'Wilderness Pass', true, 35, 3], ['Mystery Mine', 'Timber Canyon', true, 30, 5], ['Tennessee Tornado', 'Craftsman\'s Valley', true, 20, 3],
  ['Dragonflier', 'Jukebox Junction', true, 10, 3], ['Blazing Fury', 'Country Fair', false, 0, 48], ['Dollywood Express', 'Rivertown Junction', true, 25, 5], ['Some Retired Ride', 'Nowhere', true, 5, 5]];
async function open(opts = {}) {
  const d = await L.device({ device: opts.device || 'iphone-pwa', profile: opts.profile || 'eli', fixedTime: false });
  d.page.on('pageerror', e => errs.push(e.message));
  const infos = []; d.page.on('console', m => { if (m.type() === 'info') infos.push(m.text()); });
  d.infos = infos;
  if (opts.waits !== undefined) await d.ctx.route(L.api + '/api/dollywood/waits', r => opts.waits === 'fail' ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"upstream"}' }) : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.waits) }));
  if (opts.rally) await d.ctx.route(L.api + '/api/dollywood/rally', opts.rally);
  if (opts.init) await d.ctx.addInitScript(opts.init);
  if (opts.w) await d.page.setViewportSize({ width: opts.w, height: opts.h || 844 });
  await d.goto('#home'); await sleep(1200);
  const f = await d.openApp('dollywood-live');
  await f.waitForSelector('#lv-pill[data-state]', { timeout: 15000 });
  await f.waitForFunction(() => window.hub && hub.profile && typeof OFFNUM !== 'undefined', null, { timeout: 10000 });
  return { d, f };
}
const waitsReady = (f, ms = 12000) => f.waitForFunction(() => WAITS.at > 0 || WAITS.err, null, { timeout: ms }).catch(() => {});
const run = async (n, title, fn) => { if (!want(n)) return; console.log(`\n## ${n}. ${title}`); try { await fn(); } catch (e) { fail++; console.log('  FAIL crash', String(e.stack || e).slice(0, 500)); } };
const numOf = async (f, name) => f.evaluate(n => { const o = OFF.find(x => x.name === n); return o ? o.num : null; }, name);

await run(1, 'Rally from the meeting bar', async () => {
  const reqs = []; let mode = 'ok3';
  const rally = r => { const rq = r.request(); reqs.push({ method: rq.method(), body: rq.postData() });
    if (mode === '429') return r.fulfill({ status: 429, contentType: 'application/json', body: '{"error":"too_many_attempts","retry_after":50}' });
    if (mode === 'err') return r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' });
    const m = JSON.parse(rq.postData()); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, pushed: mode === 'ok3' ? 3 : 0, meet: { ...m, by: 'eli', byName: 'Eli', at: Date.now() }, updated_at: Date.now(), notified: [], skipped: [] }) }); };
  const { d, f } = await open({ rally });
  await f.waitForFunction(() => MEET && !document.getElementById('lv-meet').hidden, null, { timeout: 10000 });
  const bar = await f.evaluate(() => { const b = document.getElementById('lv-rally'); const r = b.getBoundingClientRect(); return { hidden: b.hidden, text: b.textContent.trim(), h: Math.round(r.height), name: MEET.name }; });
  ok(!bar.hidden && bar.text === 'Rally' && bar.h >= 44, 'the bar has a Rally button (a household adult), at least 44 px tall', JSON.stringify(bar));
  const before = await f.evaluate(() => JSON.stringify({ x: MEET.x, y: MEET.y, name: MEET.name, note: MEET.note }));
  // cancel first
  await f.click('#lv-rally'); await f.waitForSelector('#ask-ok');
  const sheet = await f.evaluate(() => ({ t: document.getElementById('ask-t').textContent, b: document.getElementById('ask-b').textContent, ok: document.getElementById('ask-ok').textContent }));
  ok(sheet.t === `Rally the family to ${bar.name}?` && sheet.b === `The other grown-ups get “Meet at ${bar.name}” on their phones.` && sheet.ok === 'Rally', 'it asks first: title, body and OK "Rally"', JSON.stringify(sheet));
  await f.click('#ask-no'); await sleep(300);
  ok(reqs.length === 0, 'Cancel sends nothing');
  const feedBefore = (await L.apiAs('eli', '/api/activity?limit=60')).body;
  await f.click('#lv-rally'); await f.waitForSelector('#ask-ok'); await f.click('#ask-ok');
  await f.waitForFunction(() => /^Rallied 3/.test(document.getElementById('meet-meta').textContent), null, { timeout: 8000 }).catch(() => {});
  const meta = await f.evaluate(() => ({ meta: document.getElementById('meet-meta').textContent, dis: document.getElementById('lv-rally').disabled, x: MEET.x, y: MEET.y, name: MEET.name }));
  const body = reqs[0] && JSON.parse(reqs[0].body || '{}');
  ok(reqs.length === 1 && reqs[0].method === 'POST' && body.name === bar.name && Number.isFinite(body.x) && Number.isFinite(body.y) && JSON.stringify({ x: body.x, y: body.y, name: body.name, note: body.note || '' }) === before, 'one POST with the pin\'s name, x, y and note', JSON.stringify([reqs, before]));
  ok(meta.meta === 'Rallied 3 · set by you just now', 'the meta line reads "Rallied 3 · set by you just now"', meta.meta);
  ok(meta.dis === true, 'the button is disabled after a success');
  const acts = ((await L.apiAs('eli', '/api/activity?limit=60')).body.items || (await L.apiAs('eli', '/api/activity?limit=60')).body.activity || []).map(a => a.text || '');
  ok(!acts.some(t => /^Meeting point: /.test(t)) || acts.filter(t => /^Meeting point: /.test(t)).length === ((feedBefore.items || feedBefore.activity || []).map(a => a.text || '').filter(t => /^Meeting point: /.test(t)).length), 'the client wrote no "Meeting point:" line (the Worker writes its own)', acts.slice(0, 4));
  // 0 reached, 429 and an error use a fresh page each (the button rests for a minute after a success)
  for (const [m, want_] of [['ok0', 'Nobody else has park alerts on — they will see the pin on the map.'], ['429', 'You rallied a minute ago — try again shortly.'], ['err', 'Couldn’t send the rally — they will see the pin on their next sync.']]) {
    mode = m; const o = await open({ rally }); await o.f.waitForFunction(() => MEET && !document.getElementById('lv-meet').hidden, null, { timeout: 10000 });
    await o.f.click('#lv-rally'); await o.f.waitForSelector('#ask-ok'); await o.f.click('#ask-ok'); await sleep(900);
    const t = await o.f.evaluate(() => ({ meta: document.getElementById('meet-meta').textContent, dis: document.getElementById('lv-rally').disabled }));
    ok(t.meta === want_, `${m}: the meta line reads "${want_}"`, t.meta);
    ok(m !== 'ok0' ? t.dis === false : t.dis === true, m === 'ok0' ? 'a send that reached nobody still rests the button' : `${m}: the button stays usable`, JSON.stringify(t));
    await o.d.close();
  }
  mode = 'ok3';
  // the 60 s rest: the first page's button is back after a minute
  await sleep(61500);
  ok(await f.evaluate(() => document.getElementById('lv-rally').disabled === false), 'the button is back 60 s after a success');
  await d.close();
  // not for a kid or a guest
  const k = await open({ profile: 'ezra' }); await sleep(800);
  ok(await k.f.evaluate(() => { const b = document.getElementById('lv-rally'); return !b || b.hidden || getComputedStyle(b).display === 'none'; }), 'a kid has no Rally button');
  await k.d.close();
  // the ride card keeps "Meet here", and its confirm points at Rally
  const e = await open(); await sleep(800);
  const said = await e.f.evaluate(() => { const o = OFFNUM[28]; let txt = null; window.ask = x => { txt = x; return Promise.resolve(false); }; meetHere(o); return txt && txt.body; });
  ok(said === 'Then tap Rally on the meeting bar to buzz the other grown-ups.', 'Meet here\'s confirm says "Then tap Rally on the meeting bar to buzz the other grown-ups."', said);
  await e.d.close();
});

await run(2, 'the meeting pin drops at 2 h while the map is open', async () => {
  const { d, f } = await open();
  await f.waitForFunction(() => MEET && !document.getElementById('lv-meet').hidden, null, { timeout: 10000 });
  ok(await f.evaluate(() => document.querySelectorAll('#meet .lv-meetpin').length === 1), 'the pin is drawn');
  // the row is 12 s short of two hours old; the 30 s timer (and no pull) must take it off the map
  await f.evaluate(() => { const v = { ...hub.get('meet', { scope: 'family' }), at: Date.now() - 2 * 3600e3 + 12000 }; hub.set('meet', v, { scope: 'family' }); loadMeet(); });
  ok(await f.evaluate(() => !!MEET && !document.getElementById('lv-meet').hidden), 'at 1 h 59 m 48 s the pin still stands');
  await sleep(33000);
  const t = await f.evaluate(() => ({ meet: MEET, bar: document.getElementById('lv-meet').hidden, pins: document.querySelectorAll('#meet .lv-meetpin').length }));
  ok(t.meet === null && t.bar === true && t.pins === 0, 'the pin, the bar and the route end are gone after 2 h without a reload', JSON.stringify(t));
  await d.close(); await L.reset();   // the house's meeting point was aged on purpose: back to the seeded day
});

await run(3, 'Dollywood Express attaches; an unmatched name is logged once', async () => {
  const { d, f } = await open({ waits: feed(BASE) });
  await waitsReady(f);
  const x = await f.evaluate(() => { const o = OFF.find(o => /Dollywood Express/.test(o.name)); const w = waitOf(o); return { name: o.name, w: w && w.wait, chip: !!(o.el && o.el.querySelector('.lv-wait')) }; });
  ok(x.w === 25 && x.chip && /Train Depot/.test(x.name), 'the posted "Dollywood Express" wait (25) attaches to "Dollywood Express Train Depot" and its chip is drawn', JSON.stringify(x));
  await f.evaluate(() => loadWaits()); await sleep(1500);
  const logs = d.infos.filter(t => /matches no listing/.test(t));
  ok(logs.length === 1 && /Some Retired Ride/.test(logs[0]), 'a feed name with no listing is logged once, not on every poll', JSON.stringify(logs));
  await d.close();
});

await run(4, 'waits older than 6 h are gone everywhere', async () => {
  const stale = feed([...BASE.filter(r => r[0] !== 'Thunderhead'), ['Thunderhead', 'Timber Canyon', true, 45, 7 * 60]]);   // Thunderhead's wait was posted 7 h ago
  const { d, f } = await open({ waits: stale });
  await waitsReady(f);
  const n = await numOf(f, 'Thunderhead'), n2 = await numOf(f, 'Wild Eagle');
  ok(await f.evaluate(([a, b]) => !OFFNUM[a].el.querySelector('.lv-wait') && !!OFFNUM[b].el.querySelector('.lv-wait') && waitOf(OFFNUM[a]) === null && waitOf(OFFNUM[b]) !== null, [n, n2]), 'no chip on the 7 h old ride, the fresh one keeps its chip');
  await f.evaluate(() => { nearMode = 'waits'; document.getElementById('near-mode-waits').click(); });
  await sleep(300);
  ok(await f.evaluate(n => !document.querySelector(`#near-list [data-n="${n}"] .wtile`) && !!document.querySelector('#near-list .wtile'), n), 'the Waits list leaves it out');
  await f.evaluate(() => document.getElementById('near-mode-near').click()); await sleep(300);
  ok(await f.evaluate(n => !document.querySelector(`#near-list [data-n="${n}"] .wt`), n), 'Nearby shows no wait on it');
  await f.evaluate(n => showOfficial(OFFNUM[n]), n); await sleep(500);
  ok(await f.evaluate(() => !document.querySelector('#pop .lv-waitline') && !document.querySelector('#pop .lv-hero .wt')), 'its card has no wait line');
  await f.evaluate(n => { closePop(); routeTo(OFFNUM[n]); }, n); await sleep(500);
  ok(await f.evaluate(() => !/min wait|closed/.test(document.getElementById('route-meta').textContent) || !ROUTE), 'the directions bar names no wait', await f.evaluate(() => (document.getElementById('route-meta') || {}).textContent));
  await f.evaluate(() => { try { endRoute(); } catch (e) {} });
  ok(await f.evaluate(n => !wchip(OFFNUM[n]), n), 'the search chip is empty too');
  // the retry keeps running: a newer feed brings it back
  await d.ctx.unroute(L.api + '/api/dollywood/waits'); await d.ctx.route(L.api + '/api/dollywood/waits', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(feed(BASE)) }));
  await f.evaluate(() => loadWaits()); await sleep(1200);
  ok(await f.evaluate(n => waitOf(OFFNUM[n]) !== null, n), 'a fresh post brings the wait back on the next poll');
  await d.close();
});

await run(5, 'one error line', async () => {
  // never succeeded: the short wording
  const a = await open({ waits: 'fail', init: () => { try { localStorage.removeItem('dollywood.live.waits'); } catch (e) {} } });
  await waitsReady(a.f); await sleep(500);
  const one = async (f, mode) => f.evaluate(m => { document.getElementById(m === 'waits' ? 'near-mode-waits' : 'near-mode-near').click(); const t = document.getElementById('lv-near').innerText; return { n: (t.match(/Can.t reach wait times/g) || []).length, t: (t.match(/Can.t reach wait times[^\n]*/) || [''])[0] }; }, mode);
  let r1 = await one(a.f, 'near'), r2 = await one(a.f, 'waits');
  const std = t => t.replace(/[\u2018\u2019]/g, "'");
  ok(r1.n === 1 && std(r1.t) === "Can't reach wait times right now \u00b7 retrying every minute", 'Nearby: one line, "Can\'t reach wait times right now \u00b7 retrying every minute"', JSON.stringify(r1));
  ok(r2.n === 1 && r2.t === r1.t, 'Waits: the same one line, once', JSON.stringify(r2));
  await a.d.close();
  // a success first, then the feed goes down: "last updated H:MM pm"
  const b = await open({ waits: feed(BASE) }); await waitsReady(b.f);
  await b.d.ctx.unroute(L.api + '/api/dollywood/waits'); await b.d.ctx.route(L.api + '/api/dollywood/waits', r => r.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
  await b.f.evaluate(() => loadWaits()); await sleep(900);
  const at = await b.f.evaluate(() => new Date(WAITS.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?([AP]M)$/i, (m, x) => ' ' + x.toLowerCase()));
  r1 = await one(b.f, 'near'); r2 = await one(b.f, 'waits');
  const want_ = t => t.replace(/[‘’']/, '\'') === `Can't reach wait times · last updated ${at} · retrying every minute`;
  ok(r1.n === 1 && want_(r1.t), `Nearby: "Can't reach wait times · last updated ${at} · retrying every minute"`, JSON.stringify(r1));
  ok(r2.n === 1 && want_(r2.t), 'Waits: the same, once', JSON.stringify(r2));
  ok(await b.f.evaluate(() => !/Waits as of|not available right now|Could not reach/.test(document.getElementById('lv-near').innerText)), 'the three older wordings are gone');
  await b.d.close();
});

await run(6, 'the trend arrow from this device\'s own history', async () => {
  const now = Date.now(), hist = {};
  const seed = (name, mins, wait) => ({ name, mins, wait });
  const { d, f } = await open({ waits: feed(BASE), init: () => {} });
  await waitsReady(f);
  const num = Object.fromEntries(await Promise.all(['Thunderhead', 'Wild Eagle', 'Mystery Mine', 'Tennessee Tornado', 'Dragonflier'].map(async n => [n, await numOf(f, n)])));
  await f.evaluate(([num, t0]) => {
    const h = {}; const s = (n, mins, w) => { (h[num[n]] = h[num[n]] || []).push([t0 - mins * 60e3, w]); };
    s('Thunderhead', 30, 20);        // 45 now, 20 half an hour ago: rising
    s('Wild Eagle', 40, 60); s('Wild Eagle', 5, 36);   // 35 now, 60 forty minutes ago: falling (the 5 min old sample is too young)
    s('Mystery Mine', 20, 28);       // 30 now, 28 then: under 5 min
    s('Tennessee Tornado', 10, 5);   // only a 10 min old sample: too young
    WAITS.hist = h; drawWaits(); renderNear();
  }, [num, now]);
  const lab = async n => f.evaluate(k => { const o = OFFNUM[k]; const html = wtrend(o); const m = /data-dir="(\w+)" role="img" aria-label="([^"]*)"/.exec(html); return m ? { dir: m[1], label: m[2] } : null; }, num[n]);
  const up = await lab('Thunderhead'), down = await lab('Wild Eagle');
  ok(up && up.dir === 'up' && up.label === 'Rising — 20 min half an hour ago', 'Thunderhead: rising, aria-label "Rising — 20 min half an hour ago"', JSON.stringify(up));
  ok(down && down.dir === 'down' && /^Falling — 60 min /.test(down.label), 'Wild Eagle: falling against the sample at least 15 min old', JSON.stringify(down));
  ok(!(await lab('Mystery Mine')) && !(await lab('Tennessee Tornado')) && !(await lab('Dragonflier')), 'a change under 5 min, a sample younger than 15 min and no history show nothing');
  await f.evaluate(() => { nearMode = 'waits'; document.getElementById('near-mode-waits').click(); }); await sleep(300);
  ok(await f.evaluate(n => !!document.querySelector(`#near-list [data-n="${n}"] .wtr[data-dir="up"] svg use`), num.Thunderhead), 'the Waits row carries the up arrow icon beside the ride');
  await f.evaluate(n => showOfficial(OFFNUM[n]), num.Thunderhead); await sleep(500);
  const line = await f.evaluate(() => { const e = document.querySelector('#pop .wtrend, .lv-hero .wtrend'); return e && e.textContent.trim(); });
  ok(/^Rising · was 20 min at \d{1,2}:\d{2}$/.test(line || ''), 'the card says "Rising · was 20 min at <time>"', String(line));
  ok(await f.evaluate(() => JSON.parse(localStorage.getItem('dollywood.live.waithist') || '{}') !== null), 'the history is kept in localStorage dollywood.live.waithist');
  // one sample per ride at most every 5 min, 90 min kept
  const kept = await f.evaluate(() => { const t = Date.now(); WAITS.hist = { 28: [[t - 200 * 60e3, 10], [t - 60 * 60e3, 20], [t - 2 * 60e3, 40]] }; whistAdd({ 28: { wait: 45, updated: new Date(t).toISOString(), open: true } }); return WAITS.hist[28].map(a => Math.round((t - a[0]) / 60000)); });
  ok(kept.length === 2 && kept[0] === 60, 'a sample 2 min old blocks a new one; 200 min old is dropped, 60 min kept', JSON.stringify(kept));
  await d.close();
});

await run(7, 'the MIN label: >= 11 px and >= 4.5:1 on all four bands, in all six palettes', async () => {
  const { d, f } = await open({ waits: feed(BASE) });
  await waitsReady(f);
  await f.evaluate(() => { nearMode = 'waits'; document.getElementById('near-mode-waits').click(); }); await sleep(500);
  const THEMES = ['hearth', 'parchment', 'frost', 'midnight', 'forest', 'graphite'];
  for (const th of THEMES) {
    const res = await f.evaluate(async theme => {
      try { hub.setTheme(theme); } catch (e) {}
      document.documentElement.dataset.theme = theme;
      const dark = ['midnight', 'forest', 'graphite'].includes(theme); document.documentElement.dataset.scheme = dark ? 'dark' : 'light'; document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
      await new Promise(r => setTimeout(r, 250));
      const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
      const px = c => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
      const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
      const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
      const out = {};
      for (const t of document.querySelectorAll('#near-list .wtile')) {
        const sm = t.querySelector('small'); if (!sm) continue;
        const cs = getComputedStyle(sm), bg = getComputedStyle(t).backgroundColor;
        out[t.dataset.w] = { px: parseFloat(cs.fontSize), ratio: Math.round(cr(px(cs.color), px(bg)) * 100) / 100, big: Math.round(cr(px(getComputedStyle(t.querySelector('b')).color), px(bg)) * 100) / 100 };
      }
      return out;
    }, th);
    const bands = ['short', 'mid', 'long'];   // the closed band's tile has no MIN label (a cross), its number is checked as `big` below
    ok(bands.every(b => res[b] && res[b].px >= 11 && res[b].ratio >= 4.5), `${th}: MIN at >= 11 px and >= 4.5:1 on short, mid and long`, JSON.stringify(res));
    const closed = await f.evaluate(() => { const t = document.querySelector('#near-list .wtile[data-w="closed"]'); return t ? t.textContent.trim() : null; });
    ok(closed !== null, `${th}: the closed band is drawn`, String(closed));
  }
  await d.close();
});

await run(8, 'the Style pane: the offline line and the hours link', async () => {
  const { d, f } = await open();
  await f.evaluate(() => { const t = document.getElementById('lv-layers-tab'); if (t) t.click(); }); await sleep(400);
  const s = await f.evaluate(() => { const o = document.getElementById('lv-offline'), h = document.getElementById('lv-hours'); const r = h && h.getBoundingClientRect(); return { off: o && o.textContent.trim(), vis: !!(o && o.getClientRects().length), hours: h && { text: h.textContent.trim(), href: h.href, h: Math.round(r.height), shown: h.getClientRects().length > 0, ext: !!h.querySelector('svg use[href$="#i-external-link"]'), rel: h.rel, target: h.target } }; });
  ok(s.vis && s.off === 'Offline, the illustrated map, your dot and the last waits still work. Satellite and live waits need signal.', 'the offline line reads as written', JSON.stringify(s));
  ok(s.hours && s.hours.shown && s.hours.text === 'Park hours, shows and dining · dollywood.com' && /^https:\/\/www\.dollywood\.com\//.test(s.hours.href) && s.hours.h >= 44 && s.hours.ext && /noopener/.test(s.hours.rel), 'an adult sees "Park hours, shows and dining · dollywood.com" with the external-link icon, 44 px', JSON.stringify(s.hours));
  await d.close();
  const k = await open({ profile: 'ezra' });
  await k.f.evaluate(() => { const t = document.getElementById('lv-layers-tab'); if (t) t.click(); }); await sleep(400);
  ok(await k.f.evaluate(() => { const h = document.getElementById('lv-hours'); return !h || h.getClientRects().length === 0; }), 'a kid does not see the hours link');
  // the display (kiosk kind): the rule, applied to the same page
  ok(await k.f.evaluate(() => { const h = document.getElementById('lv-hours'); const was = document.documentElement.getAttribute('data-kind'); document.documentElement.setAttribute('data-kind', 'kiosk'); const none = getComputedStyle(h).display === 'none'; document.documentElement.setAttribute('data-kind', was); return none; }), 'and the display (kind kiosk) does not either');
  await k.d.close();
});

await run(9, 'the meeting label: a pill on the side with no family puck within 40 px', async () => {
  const { d, f } = await open();
  const r = await f.evaluate(() => {
    MEET = { x: 700, y: 800, at: Date.now(), name: 'A very long meeting point name that must be cut with an ellipsis', note: '', by: 'christian', byName: 'Mae' };
    for (const k in FAM) delete FAM[k];
    drawMeet();
    const first = document.querySelector('#meet .lv-meetpin'), side0 = first.dataset.side;
    const k = mpp(), a = -ROT * Math.PI / 180, sx = 100, sy = -27;   // a puck on screen 100 px right of the flag's foot, at the pill's height
    const dx = sx * Math.cos(a) - sy * Math.sin(a), dy = sx * Math.sin(a) + sy * Math.cos(a);   // back to map offsets (the code rotates by +ROT)
    FAM.zz = { x: MEET.x + dx * k, y: MEET.y - dy * k, t: Date.now(), name: 'Z' };
    drawMeet();
    const g = document.querySelector('#meet .lv-meetpin'), pill = g.querySelector('.mp-pill'), tx = g.querySelector('text');
    const pr = pill.getBoundingClientRect(), fs = parseFloat(getComputedStyle(tx).fontSize), scr = svg.getScreenCTM().a || 1;
    return { side0, side: g.dataset.side, w: Math.round(pr.width), h: Math.round(pr.height), fsPx: Math.round(fs * scr * 10) / 10, text: tx.textContent };
  });
  ok(r.side0 === 'right', 'with no puck near, the label sits to the right of the flag', JSON.stringify(r));
  ok(r.side !== 'right', 'a puck on the right side of the flag moves the label to the left or above', JSON.stringify(r));
  ok(r.w <= 181 && r.w >= 60 && /…$/.test(r.text), 'the pill is at most 180 px wide and a long name ends in an ellipsis', JSON.stringify(r));
  ok(r.fsPx >= 10.9 && r.h >= 20, 'the label is at least 11 px on screen', JSON.stringify(r));
  await d.close();
});

ok(errs.length === 0, 'no page errors', errs.slice(0, 4).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await L.close();
process.exit(fail ? 1 : 0);
