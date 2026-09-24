// HOME brief (5): confirm or refute the Home-related leads of audits/01-leads.md with runtime reproductions.
//
//   node "audits/tools/phase2/HOME/leads.mjs" [only=cold,switch,retype,guest,pill,done,stale,tvtimer,cost]   (all by default; run one at a time for speed)
// Each experiment prints its observations and writes JSON/PNG under audits/evidence/p2/HOME/leads-*.
//   cold    Cold load (no local cache, the first /api/data pull held for 8 s): what Home, kid Home and the TV board say
//           while the pull is pending, versus after it lands.
//   switch  Me → Switch → a kid who has never used this iPad: where the shell lands, and what his Home says while his pull is pending.
//   retype  A half-typed reminder on the iPad (real clock): is it still there after the next 30 s pull? Scroll kept?
//   guest   Grandma Jo (guest) Home: Kids card with the cash-in balance? Me's Kids' rewards card? F260/Prayer cards?
//   pill    Elizabeth's running timer: what the floating pill covers at the top and at the very bottom of Home.
//   done    Grandma Jo taps ✓ on a family reminder: removed at once? undo? what the server and the feed hold after.
//   stale   "Today's reading" the next morning: Elizabeth read on Tue; on Wed Home still says "read today ✓"?
//   cost    What one routine 30 s pull costs Home on the iPad: nodes replaced, images re-created, sync render time.
//   tvtimer Elizabeth's running kitchen timer: is it shown on the TV board or on the shared iPad signed in as someone else?
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/HOME');
fs.mkdirSync(OUT, { recursive: true });
const ONLY = (process.argv[2] || 'cold,switch,retype,guest,pill,done,stale,tvtimer,cost').split(',');
const shot = (d, name) => d.page.screenshot({ path: path.join(OUT, name), scale: 'css', animations: 'disabled', caret: 'hide' });
const save = (name, obj) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(obj, null, 1));
const homeText = page => page.evaluate(() => ({
  sync: { state: hub.sync.state, lastPull: hub.sync.lastPull },
  heroSub: (document.querySelector('#view-home .hero-sub') || {}).textContent || '',
  cards: [...document.querySelectorAll('#view-home .gcard')].map(c => ({ title: c.querySelector('h2').textContent.trim(), big: (c.querySelector('.gbig, .kids-line') || {}).textContent?.trim(), sub: (c.querySelector('.gsub') || {}).textContent?.trim(), ring: (c.querySelector('.ring-lbl') || {}).textContent })),
  reminders: (document.querySelector('#remlist') || {}).innerText?.replace(/\s+/g, ' ').trim().slice(0, 120),
  feed: (document.querySelector('#feed') || {}).innerText?.replace(/\s+/g, ' ').trim().slice(0, 80),
  skeletons: document.querySelectorAll('#view-home .skeleton').length,
}));

// ── cold ──────────────────────────────────────────────────────────────────────────────────────────────────────────
if (ONLY.includes('cold')) {
  const L = await local({ variant: 'typical', clock: 'demo' });
  const res = {};
  for (const [label, device, profile] of [['adult', 'ipad-portrait', 'eli'], ['kid', 'ipad-portrait', 'ezra'], ['tv', 'tv', 'tv']]) {
    const d = await L.device({ device, profile });
    let release; const gate = new Promise(r => { release = r; });
    await d.ctx.route(u => /\/api\/(data|activity)/.test(u.pathname), async r => { await gate; await r.continue().catch(() => {}); });
    await d.goto('#home'); await sleep(1200);
    const during = label === 'tv'
      ? await d.page.evaluate(() => ({ sync: { state: hub.sync.state, lastPull: hub.sync.lastPull }, verse: document.querySelector('#tv-verse-hd').textContent, refs: document.querySelector('#tv-refs').textContent, prayed: document.querySelector('#tv-prayed').innerText.replace(/\s+/g, ' '), stars: document.querySelector('#tv-stars').innerText.replace(/\s+/g, ' '), feed: document.querySelector('#tv-feed').innerText.replace(/\s+/g, ' '), reading: [...document.querySelectorAll('#tv-read .tv-face')].map(f => f.textContent.trim() + (f.classList.contains('off') ? ' (dim)' : '')), skeletons: document.querySelectorAll('#tv .skeleton').length }))
      : await homeText(d.page);
    await shot(d, `leads-cold-${label}-pending.png`);
    const late = label === 'tv' ? null : (await sleep(6500), await homeText(d.page));   // hub.ready()'s 6 s wait has run out by now
    release(); await d.page.waitForFunction(() => hub.sync.lastPull > 0, null, { timeout: 15000 }).catch(() => {}); await sleep(1500);
    const after = label === 'tv'
      ? await d.page.evaluate(() => ({ verse: document.querySelector('#tv-verse-hd').textContent, refs: document.querySelector('#tv-refs').textContent, prayed: document.querySelector('#tv-prayed').innerText.replace(/\s+/g, ' '), stars: document.querySelector('#tv-stars').innerText.replace(/\s+/g, ' '), feed: document.querySelector('#tv-feed').innerText.replace(/\s+/g, ' ').slice(0, 80), reading: [...document.querySelectorAll('#tv-read .tv-face')].map(f => f.textContent.trim() + (f.classList.contains('off') ? ' (dim)' : '')) }))
      : await homeText(d.page);
    res[label] = { during, late, after };
    console.log(`\n[cold ${label}] while the first pull is pending (1.2 s): ${JSON.stringify(during)}`);
    if (late) console.log(`[cold ${label}] still pending at 7.7 s: skeletons ${late.skeletons}, hero "${late.heroSub}", cards ${late.cards.map(c => c.title + ': ' + c.big).join(' | ')}`);
    console.log(`[cold ${label}] after the pull lands: ${JSON.stringify(after)}`);
    await d.close();
  }
  save('leads-cold.json', res);
  await L.close();
}

// ── switch: the same wrong-final-wording on the shared iPad when someone signs in there for the first time ─────────
// Eli is on Home (so hub.sync.lastPull is set); Me → Switch → tap Ezra (a kid signs in on tap). Ezra has never used this
// device, so his person-scope rows are not cached; his kidverse person pull is held for 5 s.
if (ONLY.includes('switch')) {
  const L = await local({ variant: 'typical', clock: 'demo' });
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  await d.goto('#home');
  await d.page.waitForFunction(() => hub.sync.lastPull > 0 && document.querySelector('#view-home .gcard'), null, { timeout: 15000 });
  let release; const gate = new Promise(r => { release = r; });
  await d.ctx.route(u => /\/api\/data\/kidverse/.test(u.pathname) && /scope=person/.test(u.search), async r => { await gate; await r.continue().catch(() => {}); });
  await d.page.click('#tabbar .tab[data-tab="me"]'); await sleep(400);
  await d.page.click('#switch'); await d.page.waitForSelector('#profiles .pcard[data-id="ezra"]', { timeout: 8000 });
  await d.page.click('#profiles .pcard[data-id="ezra"]');
  await d.page.waitForFunction(() => hub.profile && hub.profile.id === 'ezra' && !document.querySelector('#shell').hidden, null, { timeout: 8000 }); await sleep(600);
  const landed = await d.page.evaluate(() => ({ hash: location.hash, tab: document.documentElement.dataset.tab, heading: (document.querySelector('.view.on h1, .view.on .hero-title') || {}).textContent, cards: [...document.querySelectorAll('.view.on h2')].map(h => h.textContent.trim()).slice(0, 6) }));
  await shot(d, 'leads-switch-kid-lands.png');
  console.log(`\n[switch] after Me → Switch → Ezra the shell lands on ${landed.hash} (tab ${landed.tab}): "${landed.heading}" — ${landed.cards.join(', ')}`);
  await d.page.click('#tabbar .tab[data-tab="home"]');
  await d.page.waitForSelector('#view-home .stars-card', { timeout: 8000 }); await sleep(900);
  const during = await d.page.evaluate(() => ({ who: hub.profile.id, lastPull: hub.sync.lastPull, state: hub.sync.state, star: document.querySelector('.star-big b').textContent, big: document.querySelector('.stars-card .gbig').textContent, sub: document.querySelector('.stars-card .gsub').textContent, hero: document.querySelector('.home-hero .hero-sub').textContent, skeletons: document.querySelectorAll('#view-home .skeleton').length }));
  await shot(d, 'leads-switch-kid-pending.png');
  release(); await sleep(2500);
  const after = await d.page.evaluate(() => ({ star: document.querySelector('.star-big b').textContent, big: document.querySelector('.stars-card .gbig').textContent, hero: document.querySelector('.home-hero .hero-sub').textContent }));
  save('leads-switch.json', { landed, during, after });
  console.log(`\n[switch] Eli → Switch → Ezra, Ezra's person pull pending (1.5 s): lastPull carried over = ${during.lastPull > 0}; Stars card "★${during.star} ${during.big} / ${during.sub}", hero "${during.hero}", skeletons ${during.skeletons}`);
  console.log(`[switch] after the pull lands: "★${after.star} ${after.big}", hero "${after.hero}"`);
  await L.close();
}

// ── retype ────────────────────────────────────────────────────────────────────────────────────────────────────────
if (ONLY.includes('retype')) {
  const L = await local({ variant: 'typical', clock: 'real' });
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await d.goto('#home');
  await d.page.waitForFunction(() => hub.sync.lastPull > 0 && document.querySelector('#remtext'), null, { timeout: 15000 });
  await sleep(800);
  await d.page.evaluate(() => { window.__renders = 0; window.__changes = []; hub.onChange(c => window.__changes.push(c.app + ":" + c.key)); const v = document.querySelector('#view-home'); new MutationObserver(() => { window.__renders++; }).observe(v, { childList: true }); });
  // scroll so the reminders card is in view, then type without sending
  await d.page.evaluate(() => document.querySelector('#remtext').scrollIntoView({ block: 'center' }));
  await d.page.click('#remtext'); await d.page.keyboard.type('Pick up the dry cleaning before 5', { delay: 20 });
  const before = await d.page.evaluate(() => ({ value: document.querySelector('#remtext').value, focused: document.activeElement && document.activeElement.id, scrollTop: document.querySelector('#views').scrollTop, lastPull: hub.sync.lastPull, t: Date.now() }));
  await shot(d, 'leads-retype-before.png');
  await d.page.waitForFunction(lp => hub.sync.lastPull > lp, before.lastPull, { timeout: 45000 });
  await sleep(300);
  const after = await d.page.evaluate(() => ({ value: document.querySelector('#remtext').value, focused: document.activeElement && (document.activeElement.id || document.activeElement.tagName), scrollTop: document.querySelector('#views').scrollTop, lastPull: hub.sync.lastPull, t: Date.now(), homeRebuilt: window.__renders, dataChanges: window.__changes }));
  await shot(d, 'leads-retype-after.png');
  const server = await L.apiAs('eli', '/api/data/reminders?scope=family');
  const saved = (server.body.items || []).some(i => i.value && /dry cleaning/.test(i.value.text || ''));
  const res = { before, after, secondsBetween: Math.round((after.t - before.t) / 1000), draftReachedServer: saved };
  save('leads-retype.json', res);
  console.log(`\n[retype] typed "${before.value}" (focus #${before.focused}); ${res.secondsBetween} s later a routine pull ran (data changes it delivered: ${after.dataChanges.length ? after.dataChanges.join(", ") : "none"}): value now "${after.value}", focus ${after.focused}, #view-home rebuilt ${after.homeRebuilt}×, scrollTop ${before.scrollTop} → ${after.scrollTop}; draft on the server: ${saved}`);
  await L.close();
}

// ── guest ─────────────────────────────────────────────────────────────────────────────────────────────────────────
if (ONLY.includes('guest')) {
  const L = await local({ variant: 'typical', clock: 'demo' });
  const d = await L.device({ device: 'ipad-portrait', profile: 'guest-grandmajo' });
  await d.goto('#home');
  await d.page.waitForFunction(() => hub.sync.lastPull > 0 && document.querySelector('#view-home .gcard'), null, { timeout: 15000 });
  await sleep(600);
  const home = await homeText(d.page);
  const isGuest = await d.page.evaluate(() => !!(hub.session && hub.session.profile && hub.session.profile.is_guest));
  await shot(d, 'leads-guest-home.png');
  await d.page.click('#tabbar .tab[data-tab="me"]'); await sleep(700);
  const me = await d.page.evaluate(() => ({ headings: [...document.querySelectorAll('#view-me h2')].map(h => h.textContent.trim()), rewards: /Kids' rewards/.test(document.querySelector('#view-me').innerText) }));
  save('leads-guest.json', { isGuest, home, me });
  const kids = home.cards.find(c => c.title === 'Kids');
  console.log(`\n[guest] Grandma Jo (is_guest=${isGuest}) Home cards: ${home.cards.map(c => `${c.title} "${c.big}${c.sub ? ' / ' + c.sub : ''}"`).join(' | ')}`);
  console.log(`[guest] Kids card on Home: ${!!kids}${kids ? ' — "' + kids.sub + '"' : ''}; Me headings: ${me.headings.join(', ')}; Kids' rewards card in Me: ${me.rewards}`);
  await L.close();
}

// ── pill ──────────────────────────────────────────────────────────────────────────────────────────────────────────
if (ONLY.includes('pill')) {
  const L = await local({ variant: 'typical', clock: 'demo' });
  const res = {};
  for (const dev of ['iphone-pwa', 'ipad-portrait', 'ipad-landscape', 'desktop']) {
    const d = await L.device({ device: dev, profile: 'mom' });
    await d.goto('#home');
    await d.page.waitForFunction(() => hub.sync.lastPull > 0 && document.querySelector('#feed .fline') && !document.querySelector('#timer-pill').hidden, null, { timeout: 15000 });
    await sleep(500);
    const probe = () => d.page.evaluate(() => {
      const pill = document.querySelector('#timer-pill'); const r = pill.getBoundingClientRect(); const hits = new Map();
      for (let x = r.left + 4; x < r.right - 2; x += 8) for (let y = r.top + 4; y < r.bottom - 2; y += 8) {
        const under = document.elementsFromPoint(x, y).find(e => e !== pill && !pill.contains(e) && e.closest('#views') && !['VIEWS', 'SECTION'].includes(e.tagName) && e.id !== 'views' && !e.classList.contains('view'));
        if (!under) continue;
        const tag = under.closest('.rem-text,.rem-by,.fline,.fwho,.input,button,.gcard,.card,li,h2') || under;
        const k = (tag.className && typeof tag.className === 'string' ? tag.tagName.toLowerCase() + '.' + tag.className.split(' ')[0] : tag.tagName.toLowerCase()) + ': ' + (tag.value || tag.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
        hits.set(k, (hits.get(k) || 0) + 1);
      }
      const v = document.querySelector('#views');
      const lastContent = [...document.querySelectorAll('#view-home .card')].pop().getBoundingClientRect();
      return { pill: { left: Math.round(r.left), top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }, over: [...hits.entries()].map(([k, n]) => k + ' ×' + n), scrollTop: Math.round(v.scrollTop), maxScroll: v.scrollHeight - v.clientHeight, lastCardBottom: Math.round(lastContent.bottom), clearance: Math.round(r.top - lastContent.bottom), bg: getComputedStyle(pill).backgroundColor, backdrop: getComputedStyle(pill).backdropFilter || getComputedStyle(pill).webkitBackdropFilter };
    });
    const top = await probe(); await shot(d, `leads-pill-${dev}-top.png`);
    // bottom of Home: the reminders card on phones/portrait, the feed card beside it at 1024+
    await d.page.evaluate(() => { const v = document.querySelector('#views'); v.scrollTop = v.scrollHeight; }); await sleep(300);
    const bottom = await probe(); await shot(d, `leads-pill-${dev}-bottom.png`);
    // the reminders' add row: can it be brought out from under the pill?
    const add = await d.page.evaluate(() => { const f = document.querySelector('#remform'); const v = document.querySelector('#views'); let best = null;
      for (let s = 0; s <= v.scrollHeight; s += 20) { v.scrollTop = s; const r = f.getBoundingClientRect(), p = document.querySelector('#timer-pill').getBoundingClientRect(); const overlap = !(r.right < p.left || r.left > p.right || r.bottom < p.top || r.top > p.bottom); const inView = r.top >= 0 && r.bottom <= innerHeight; if (inView && !overlap) { best = s; break; } }
      return { clearPosition: best }; });
    res[dev] = { top, bottom, addRow: add };
    console.log(`\n[pill ${dev}] pill at ${JSON.stringify(top.pill)} (${top.bg}, backdrop ${top.backdrop})\n   at top: over ${top.over.join(' · ') || 'nothing'}\n   at max scroll (${bottom.scrollTop}/${bottom.maxScroll}): over ${bottom.over.join(' · ') || 'nothing'}; last card bottom ${bottom.lastCardBottom} vs pill top ${bottom.pill.top} (clearance ${bottom.clearance} px); reminder add row can be scrolled clear: ${add.clearPosition != null}`);
    await d.close();
  }
  save('leads-pill.json', res);
  await L.close();
}

// ── done ──────────────────────────────────────────────────────────────────────────────────────────────────────────
if (ONLY.includes('done')) {
  const L = await local({ variant: 'typical', clock: 'demo' });
  const d = await L.device({ device: 'ipad-portrait', profile: 'guest-grandmajo' });
  await d.goto('#home');
  await d.page.waitForFunction(() => hub.sync.lastPull > 0 && document.querySelector('#remlist [data-done]'), null, { timeout: 15000 });
  await sleep(500);
  const before = await d.page.evaluate(() => [...document.querySelectorAll('#remlist .rem-text')].map(e => e.textContent));
  const target = await d.page.evaluate(() => { const b = document.querySelector('#remlist [data-done]'); const r = b.getBoundingClientRect(); return { id: b.dataset.done, w: Math.round(r.width), h: Math.round(r.height), label: b.getAttribute('aria-label') }; });
  let dialogs = 0; d.page.on('dialog', async dl => { dialogs++; await dl.dismiss(); });
  await d.page.click(`#remlist [data-done="${target.id}"]`);
  await sleep(150);
  const right = await d.page.evaluate(() => { const t = document.getElementById('hub-toast'); return { list: [...document.querySelectorAll('#remlist .rem-text')].map(e => e.textContent), toast: t && !t.hidden ? t.textContent : null, undo: [...document.querySelectorAll('button')].filter(b => /undo/i.test(b.textContent + (b.getAttribute('aria-label') || ''))).length }; });
  await shot(d, 'leads-done-after-tap.png');
  await d.page.evaluate(() => hub.flush()); await sleep(800);
  const server = await L.apiAs('eli', '/api/data/reminders?scope=family');
  const row = (server.body.items || []).find(i => i.key === 'item:' + target.id);
  const feed = await L.apiAs('eli', '/api/activity?limit=5');
  const feedRows = (feed.body.items || feed.body.activity || feed.body || []);
  const line = Array.isArray(feedRows) ? feedRows.find(a => /Cleared the reminder/.test(a.text || '')) : null;
  // the kid: no ✓ in the UI — does the server stop a kid clearing one?
  const kidDel = await L.apiAs('ezra', '/api/data/reminders/' + encodeURIComponent((server.body.items || []).find(i => i.value && i.key !== 'item:' + target.id).key) + '?scope=family', { method: 'DELETE' });
  const res = { before, target, afterTap: right, confirmDialogs: dialogs, serverRow: row, feedLine: line && { name: line.name, text: line.text }, kidDeleteViaApi: { status: kidDel.status, body: kidDel.body } };
  save('leads-done.json', res);
  console.log(`\n[done] ${before.length} reminders; guest taps ✓ (${target.w}×${target.h}, "${target.label}") on "${before[0]}": confirm dialogs ${dialogs}, list now ${right.list.length}, toast ${JSON.stringify(right.toast)}, undo buttons ${right.undo}`);
  console.log(`[done] server row after flush: value=${JSON.stringify(row && row.value)} (updated_at ${row && row.updated_at}); feed: ${line ? line.name + ': ' + line.text : 'none'}; kid DELETE via API → ${kidDel.status}`);
  await L.close();
}

// ── stale ─────────────────────────────────────────────────────────────────────────────────────────────────────────
if (ONLY.includes('stale')) {
  const L = await local({ variant: 'typical', clock: 'demo' });
  const WED = DEMO + 24 * 3600e3;          // Wed 23 Sep 2026, 08:40 New York
  const d = await L.device({ device: 'ipad-portrait', profile: 'mom', fixedTime: WED });
  await d.goto('#home');
  await d.page.waitForFunction(() => hub.sync.lastPull > 0 && document.querySelector('#view-home .gcard'), null, { timeout: 15000 });
  await sleep(600);
  const wed = await homeText(d.page);
  const log = await L.apiAs('mom', '/api/data/f260?scope=person&key=f260.log');
  const logDays = Object.keys((log.body.item && log.body.item.value) || {}).sort().slice(-3);
  await shot(d, 'leads-stale-wed-home.png');
  const f = await d.openApp('f260', { wait: '#todayTitle:not(:empty)' }); await sleep(800);
  const f260says = await f.evaluate(() => ({ kind: document.querySelector('#todayKind').textContent, title: document.querySelector('#todayTitle').textContent }));
  await d.page.click('#pill-name'); await sleep(250); await d.page.click('.sheet [data-open-tab="home"]'); await sleep(900);
  const afterOpen = await homeText(d.page);
  const res = { browserDate: new Date(WED).toString(), f260LogLastDays: logDays, homeBeforeOpeningF260: wed, f260Today: f260says, homeAfterOpeningF260: afterOpen };
  save('leads-stale.json', res);
  const card = c => c.cards.find(x => x.title === "Today's reading");
  console.log(`\n[stale] browser date Wed 23 Sep 08:40; Elizabeth's f260.log last days: ${logDays.join(', ')}`);
  console.log(`[stale] Home before opening F260: hero "${wed.heroSub}", card "${card(wed).big}" / "${card(wed).sub}"`);
  console.log(`[stale] F260 itself says: "${f260says.kind}" — ${f260says.title}`);
  console.log(`[stale] Home after F260 has rewritten its summary: hero "${afterOpen.heroSub}", card "${card(afterOpen).big}" / "${card(afterOpen).sub}"`);
  await L.close();
}

// ── tvtimer: Elizabeth's kitchen timer is running — does any shared screen (the TV board, the kitchen iPad signed in as
// someone else) show it? timer.active lives in Elizabeth's person scope.
if (ONLY.includes('tvtimer')) {
  const L = await local({ variant: 'typical', clock: 'demo' });
  const out = {};
  for (const [dev, who] of [['tv', 'tv'], ['ipad-portrait', 'eli'], ['ipad-portrait', 'mom']]) {
    const d = await L.device({ device: dev, profile: who });
    await d.goto('#home');
    await d.page.waitForFunction(() => hub.sync.lastPull > 0, null, { timeout: 15000 }).catch(() => {}); await sleep(1200);
    out[dev + ':' + who] = await d.page.evaluate(() => ({ pillVisible: !document.querySelector('#timer-pill').hidden, text: document.querySelector('#timer-pill').hidden ? null : document.querySelector('#timer-pill-time').textContent, boardMentionsTimer: /timer/i.test((document.querySelector('#view-home') || {}).innerText || '') }));
    await d.close();
  }
  const server = await L.apiAs('mom', '/api/data/timer?scope=person&key=timer.active');
  save('leads-tvtimer.json', { timerActive: server.body.item, surfaces: out });
  console.log(`\n[tvtimer] Elizabeth's timer.active: ${JSON.stringify(server.body.item && server.body.item.value)}; ` + Object.entries(out).map(([k, v]) => `${k}: pill ${v.pillVisible ? v.text : 'hidden'}${v.boardMentionsTimer ? ' (Home mentions a timer)' : ''}`).join(' | '));
  await L.close();
}

// ── cost ──────────────────────────────────────────────────────────────────────────────────────────────────────────
if (ONLY.includes('cost')) {
  const L = await local({ variant: 'typical', clock: 'real' });            // a real browser clock: hub.sync.lastPull = Date.now() must move for onSync to re-render
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await d.goto('#home');
  await d.page.waitForFunction(() => hub.sync.lastPull > 0 && document.querySelector('#feed .fline'), null, { timeout: 15000 });
  await sleep(800);
  const r = await d.page.evaluate(async () => {
    const v = document.querySelector('#view-home');
    const mark = [...v.querySelectorAll('*')]; mark.forEach(e => { e.__old = 1; });
    const imgsBefore = v.querySelectorAll('img').length;
    const t0 = performance.now(); let tSync = null;
    const origRender = null;
    const p = hub.pull(); await p; tSync = performance.now() - t0;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const all = [...v.querySelectorAll('*')];
    return { nodesNow: all.length, nodesKept: all.filter(e => e.__old).length, imgs: v.querySelectorAll('img').length, imgsBefore, pullPlusRenderMs: Math.round(performance.now() - t0), pullMs: Math.round(tSync) };
  });
  // time renderHome itself: a tab switch Apps → Home runs it synchronously inside the click handler
  const tabs = [];
  for (let i = 0; i < 5; i++) {
    await d.page.click('#tabbar .tab[data-tab="apps"]'); await sleep(300);
    tabs.push(await d.page.evaluate(() => { const t0 = performance.now(); document.querySelector('#tabbar .tab[data-tab="home"]').click(); return Math.round((performance.now() - t0) * 10) / 10; }));
    await sleep(300);
  }
  const res = { perPull: r, homeTabSyncMs: tabs, pullsPerDay: 2880 };
  save('leads-cost.json', res);
  console.log(`\n[cost] one routine pull with no data change on the iPad: #view-home rebuilt — ${r.nodesKept} of ${r.nodesNow} nodes survive, ${r.imgs} <img> re-created; pull+re-render ${r.pullPlusRenderMs} ms. renderHome inside a tab tap: ${tabs.join(' / ')} ms (sync). At one pull per 30 s that is ${res.pullsPerDay} full rebuilds a day on an iPad left on Home.`);
  await L.close();
}
