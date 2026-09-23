// Prayer (apps/prayer.html): a private list per person (person scope) and the shared family list (family scope),
// with a daily plan, "Pray now" mode, the Record, a kitchen view and settings. Its own component CSS (no .ds).
// Views (apps/prayer.html): Today #s-today 438-460 · List #s-all 462-467 · Record #s-answered 469-477 · Add #s-add
// 479-501 · Settings #s-more 503-532 · Pray now overlay #pray 537-551 · Kitchen overlay #kitchen 553-556 · detail /
// edit / More sheets 985-1049, 1725-1735 · inline "ask" panels 1089-1126 (stand in for confirm/prompt) · kid cards
// 1578-1592. visibleTo lists every household person but the kiosk (apps.json:6), so there is no TV capture; guests
// see it (adult rule). Data: audits/tools/seed/prayer.mjs.
export const area = 'prayer';

const READY = '#todayLine:not(:empty)';                    // renderToday() has run (apps/prayer.html:886): the data is in

// Prayer is the one app on Google Fonts (apps/prayer.html:12-14). For a Safari user agent Google sends a single
// variable Manrope file for all five weights, and Playwright's WebKit build (Windows) does not apply its weight axis:
// every weight then renders as the same light face, unlike a real iPad. Ask Google for its per-weight static files
// instead (what it sends an old user agent), so 400/500/600/700 look as they do on the device. On the offline second
// pass the rig's own block is registered later and wins, as it should.
async function staticFonts(t) {
  if (t.ctx.__prayerFonts) return;
  t.ctx.__prayerFonts = true;
  await t.ctx.route(u => u.href.startsWith('https://fonts.googleapis.com/css2'), r =>
    r.continue({ headers: { ...r.request().headers(), 'user-agent': 'Mozilla/4.0 (compatible)' } }).catch(() => {}));
}

// A device that has opened Prayer before holds the family list in hub.js's cache ('hub.cache.prayer.family'). The rig
// starts every capture on a fresh device, where the shell has already cached prayer/person (index.html:458-459) but never
// prayer/family. hub.ready then does not wait for the first pull (apps/hub.js:334-337), and a profile whose list is the
// family one (every kid; an adult who last looked at Family) renders an empty family list, whose todaySet() → save()
// writes the default family settings over the real ones (apps/prayer.html:630-639, 826-833, 685-693) - a real bug, shown
// by the 'family-reset' screen. So that the other screens show the household as it is, open() first fills that cache
// the way hub.js's own pull would (apps/hub.js pullScope: GET /api/data/prayer?scope=family → {items, now}).
// Skipped while loading (the data call never answers) and on the offline second pass (the first pass left the cache).
// The same partial-cache path hits the person list if the app opens while only the family cache exists, so the shell's
// first pull (which caches prayer/person) must have finished before the app is opened.
async function warmFamily(t) {
  if (t.loading || t.reopened) return;
  await t.goto('');
  await t.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0
    && Object.keys(localStorage).some(k => k.startsWith('hub.cache.prayer.person.')), null, { timeout: 8000 }).catch(() => {});
  await t.page.evaluate(async () => {
    const get = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
    const api = get('hub.api'), dev = get('hub.device'), ses = get('hub.session');
    if (!api || !dev || !ses || get('hub.cache.prayer.family')) return;
    const r = await fetch(api + '/api/data/prayer?scope=family&since=0', { headers: { 'X-Device-Token': dev.token, 'X-Profile-Token': ses.token } });
    if (!r.ok) return;
    const res = await r.json();
    const items = {};
    for (const it of res.items || []) items[it.key] = { v: it.value, t: it.updated_at };
    localStorage.setItem('hub.cache.prayer.family', JSON.stringify({ items, since: res.now }));
  }).catch(() => {});
}

// Guard: no screen here changes a plan, so a batch write carrying 'plans' is the partial-cache reset above. It is logged
// into the capture's console lines (manifest.json) so a regression is visible; only family-reset expects it.
function watchResets(t) {
  if (t.ctx.__prayerWatch) return;
  t.ctx.__prayerWatch = true;
  t.page.on('request', r => {
    if (r.method() === 'POST' && /\/api\/data\/prayer\/batch/.test(r.url()) && /"key":"plans"/.test(r.postData() || ''))
      t.ctx.__prayerReset = /scope=family/.test(r.url()) ? 'family' : 'person';
  });
}
async function guard(t) {
  // In the empty variant the first open writes the default settings of two lists that do not exist yet: first use, nothing lost.
  // Likewise the private list of anyone the seed gives none (the kids, a guest, David, Mea): its defaults are first saved on the
  // first write (a kid's Prayed tap) or the first open (a guest), into that person's own scope — first use, nothing lost.
  const HAS_OWN_LIST = ['eli', 'mom', 'christian'];                               // the private lists seed/prayer.mjs writes
  const firstUse = t.variant === 'empty' || (t.ctx.__prayerReset === 'person' && !HAS_OWN_LIST.includes(t.profile));
  if (t.ctx.__prayerReset && !firstUse) await t.page.evaluate(w => console.warn('rig guard: Prayer wrote default ' + w + '-list settings (partial-cache reset)'), t.ctx.__prayerReset).catch(() => {});
}

/** Open Prayer in the shell viewer and wait for the first render (skipped while loading: data never arrives).
 *  cold: true skips warming the family cache (only the family-reset evidence screen). */
async function open(t, { cold = false } = {}) {
  watchResets(t);
  await staticFonts(t);
  if (!cold) await warmFamily(t);
  const f = await t.openApp('prayer', { wait: READY });
  if (!t.loading) await f.waitForSelector(READY, { timeout: 8000 }).catch(() => {});
  return f;
}
const tapIn = (t, f, sel) => t.tap(f.locator(sel).first());
const waitIn = (f, sel, ms = 4000) => f.waitForSelector(sel, { timeout: ms }).catch(() => {});
/** Bottom nav (apps/prayer.html:565-571): today | all | answered | add | more. */
async function nav(t, f, name) { await tapIn(t, f, `nav [data-go="${name}"]`); if (!t.loading) await waitIn(f, `#s-${name}.on`); await t.sleep(150); }
/** Mine/Family switch (442-445). Writes activeList, so it only taps when the list is not already showing. */
async function family(t, f) {
  if (await f.locator('#listSwitch [data-list="shared"][aria-pressed="true"]').count()) return;
  await tapIn(t, f, '#listSwitch [data-list="shared"]');
  if (!t.loading) await waitIn(f, 'body.shared');
}
/** Open a request's detail sheet from wherever its row is showing (data-open, 847/935). The row is a <div> that only a
 *  document-level click listener handles (1230-1266). In this WebKit a touch tap on it fires touchstart/touchend but no
 *  click (buttons are fine), so rows are clicked with the mouse instead; see the note on 'detail'. Hidden screens hold
 *  copies of the same data-open (anniversaries, review lists), hence the visible filter. */
async function detail(t, f, id) {
  const row = f.locator(`[data-open="${id}"]`).filter({ visible: true }).first();
  await row.scrollIntoViewIfNeeded().catch(() => {});
  await row.click({ timeout: 8000 });
  await waitIn(f, '#sheet.on');
  await t.sleep(350);                                          // the sheet's slide-in (241)
}
const top = f => f.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
/** Scroll to the row/card whose "prayed today" group names the most people (its aria-label lists them, apps/prayer.html:1562). */
const toMostFaces = (f, rowSel) => f.evaluate(sel => {
  const count = r => { const w = r.querySelector('.who'); return w ? (w.getAttribute('aria-label') || '').replace(/^Prayed today: /, '').split(', ').length : 0; };
  const best = [...document.querySelectorAll(sel)].sort((a, b) => count(b) - count(a))[0];
  if (best) window.scrollTo(0, best.getBoundingClientRect().top + window.scrollY - 140);
}, rowSel).catch(() => {});

// Which request each variant opens: typical p003 "Dad's knee recovery" (detail, phone, two updates); overflow p001
// (the long Grandpa title, a 400-character detail and eight updates). Answered: p015 "A job for Luke" / p040 (long title and note, answered a year ago today).
const ACTIVE = t => (t.variant === 'overflow' ? 'p001' : 'p003');
const ANSWERED = t => (t.variant === 'overflow' ? 'p040' : 'p015');

const SCREENS = [
  {
    screen: 'today',
    profile: 'eli',
    states: ['empty', 'typical', 'overflow', 'loading', 'offline'],
    note: 'Eli\'s own list (Mine). typical: plan "Morning", 9 today, 3 done ("6 to pray through this morning"), three quiet rotation rows in terracotta, ' +
      'a two-year anniversary and "Answered recently"; overflow: 34 today, 11 done, long titles and a long custom category at the top, the review nudge, a 1204-day streak, long plan name; ' +
      'empty: illustrated empty state; loading: 1.2 s in, before hub.ready — the static page (no date, no headline, but "Pray now" and More already showing); ' +
      'offline: reopened from the warm cache (the app has no offline indicator of its own). No error state: the app has no error UI.',
    async go(t) { await open(t); },
  },
  {
    screen: 'today-lower',
    profile: 'eli',
    states: ['typical', 'overflow'],
    note: 'Today scrolled to the end: the anniversary line (typical: "2 years ago today you started praying for this." — Uncle Ray; overflow: "A year ago today this was answered.") ' +
      'and the gold "Answered recently" box (last 30 days), above the nav. empty has neither (today-empty is the whole page).',
    async go(t) {
      const f = await open(t);
      await f.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)).catch(() => {});
      await t.sleep(250);
    },
  },
  {
    screen: 'today-done',
    profile: 'eli',
    states: ['typical'],
    isolate: true,                                             // taps write (lastPrayedAt, feed lines)
    note: 'Pray now → "Prayed" through the six still to pray: back on Today, "You have prayed through the whole list.", the meter full, 9/9, ' +
      'the milestone cheer line ("9 days in a row.") and the finish toast repeating it. Only typical: the same page for any list once every row is done.',
    async go(t) {
      const f = await open(t);
      await tapIn(t, f, '#startPray'); await waitIn(f, '#pray.on');
      for (let i = 0; i < 12 && await f.locator('#pray.on').count(); i++) { await tapIn(t, f, '#prayNext'); await t.sleep(90); }
      await waitIn(f, '#toast.on', 3000);
      await top(f);
    },
  },
  {
    screen: 'stalled',
    profile: 'eli',
    states: ['loading'],
    loadingWait: 7500,
    note: 'Loading that never finishes, 7.5 s in: hub.ready stops waiting after 6 s (apps/hub.js:337) and Prayer renders "Nothing on this list yet." ' +
      'with the Add button, although the lists simply have not arrived — pixel-identical to today-empty, so a slow start cannot be told from an empty ' +
      'list. It also queues the default settings of Eli\'s list (the rig guard line in the ' +
      'console): held here, but on a real slow start they would be sent once the network answers and, being newer, replace his real plan and streak.',
    async go(t) { await open(t); },
  },
  {
    screen: 'today-family',
    profile: 'eli',
    states: ['empty', 'typical', 'overflow', 'loading', 'offline'],
    note: 'Family switch: plan "Around the table", 8 today, 16 days in a row; teal on the switch and nav (Pray now, Add and + keep Eli\'s navy: ' +
      'body.shared rebinds --accent but not --accent-deep), "Elizabeth asked" faces, who prayed today (Elizabeth, Ezra). Rows Elizabeth or Ezra prayed show ' +
      'as done for Eli too (done reads the row\'s single lastPrayedAt), and his tap on such a check would clear lastPrayedAt for everyone (setPrayed toggles, ' +
      'apps/prayer.html:1595). overflow: long requester names; the rows with up to 9 prayed-today names (5 faces then "+N") are below the fold, see today-family-faces. loading: the tap lands before hub.ready, ' +
      'so nothing changes (pixel-identical to today-loading: the tap is simply lost) and the page logs a TypeError (the click handler reads D before load(), ' +
      'apps/prayer.html:1273) — the console lines are the evidence.',
    async go(t) { const f = await open(t); await family(t, f); },
  },
  {
    screen: 'today-family-faces',
    profile: 'eli',
    states: ['overflow'],
    note: 'Family Today scrolled to the row with the most people on today\'s prayed list (nine long names: five faces, then "+4" beside a long title). ' +
      'Rows prayed today sit below the rest (the order they were synced in), so today-family-overflow never reaches them.',
    async go(t) { const f = await open(t); await family(t, f); await toMostFaces(f, '#todayList li.row'); },
  },
  {
    screen: 'family-reset',
    profile: 'eli',
    states: ['typical'],
    note: 'Evidence of a data-loss bug, reproduced on purpose (compare today-family-typical): Eli switches to Family (activeList "shared", synced), then opens ' +
      'Prayer on a device that has never shown the family list (its family cache dropped; the shell\'s prayer/person cache kept). hub.ready does not wait for ' +
      'the family pull, the empty default family list renders, and todaySet() → save() writes the defaults over the real family settings with a newer ' +
      'updated_at, which the Worker accepts: the family streak and month count fall to 0 and the plan "Around the table" becomes "Everything" — for everyone. ' +
      'On the device that did it, today\'s rotation requests also drop out for the day (3/6 instead of 3/8; the frozen rotation was computed from the empty list). ' +
      'A kid opening Prayer on a new device takes the same path. Every capture performs the reset on its own fresh database.',
    isolate: true,                                             // two resets racing on one database pull each other's plan ids (3/8 or 3/6 by timing)
    async go(t) {
      const f = await open(t);
      await family(t, f);
      await f.waitForFunction(() => window.hub && hub.sync && !hub.sync.pending, null, { timeout: 4000 }).catch(() => {});
      // Leave the hub first: no page may be open while its cache changes (an open Prayer page reloads the emptied cache on
      // the storage event and its save() then tombstones every family row it no longer sees — apps/prayer.html:692).
      await t.page.goto(t.site + '/manifest.json', { waitUntil: 'load' });
      await t.page.evaluate(() => { for (const k of ['hub.cache.prayer.family', 'hub.queue.prayer.family']) localStorage.removeItem(k); });
      await t.openApp('prayer', { wait: READY });
      await t.sleep(1500);                                        // the reset write, and the pull that follows it
    },
  },
  {
    screen: 'today-grouped',
    profile: 'mom',
    states: ['typical', 'overflow'],
    note: 'Elizabeth\'s own list under a by-day plan with "Group by category" on: Tuesday\'s categories as open <details> groups with Copy buttons, her colour as accent. ' +
      'empty/loading/offline are today-*: the grouping is the only difference.',
    async go(t) { await open(t); },
  },
  {
    screen: 'today-unscheduled',
    profile: 'christian',
    states: ['typical'],
    note: 'Mae: requests on the list but her by-day plan has nothing for Tuesdays → "Nothing scheduled for today under this plan." with "Change the plan"; ' +
      'Pray now and More are hidden, while the gold cheer "3 days in a row." shows under "Nothing on the list today." (milestone() fires whenever none ' +
      'are left, 0 of 0 included; her streak ended yesterday). Only reachable with data, so typical only.',
    async go(t) { await open(t); },
  },
  {
    screen: 'list',
    profile: 'eli',
    states: ['empty', 'typical', 'overflow', 'loading', 'offline'],
    note: 'List tab: search box and every active request grouped by category in closed <details> (count + Copy per group). Answered requests only appear when searching. ' +
      'overflow: 36 requests, five long custom category names. loading: the tab tap lands before hub.ready: go() switches the screen and the nav, then ' +
      'the render throws (D undefined, a pageerror in the console lines), so the heading and search box show over nothing, with no sign of loading.',
    async go(t) { const f = await open(t); await nav(t, f, 'all'); },
  },
  {
    screen: 'list-open',
    profile: 'eli',
    states: ['typical', 'overflow'],
    note: 'List tab with two category groups opened: the rows inside a group (mark circle, title, category, last update). typical: the first two groups; ' +
      'overflow: the first two groups with long custom category names (the long "Grandparents, Great-Grandparents and Extended Family Across Three States" ' +
      'group holds the longest titles), scrolled to. empty has no groups (list-empty).',
    async go(t) {
      const f = await open(t); await nav(t, f, 'all');
      // typical: groups 0 and 1; overflow: the first two whose category name is long (the custom ones, at the end of the list)
      const idx = t.variant === 'overflow'
        ? await f.evaluate(() => [...document.querySelectorAll('#allList details.cat')].map((d, i) => [i, d.querySelector('summary > span').textContent.trim().length]).filter(x => x[1] > 40).slice(0, 2).map(x => x[0])).catch(() => [])
        : [0, 1];
      for (const i of idx) {
        const s = f.locator('#allList details.cat').nth(i);
        if (await s.count() && !(await s.evaluate(d => d.open))) { await s.scrollIntoViewIfNeeded().catch(() => {}); await t.tap(s.locator('summary > span').first()); }
      }
      if (t.variant === 'overflow' && idx.length) {
        await f.evaluate(i => { const d = document.querySelectorAll('#allList details.cat')[i]; if (d) window.scrollTo(0, d.getBoundingClientRect().top + window.scrollY - 70); }, idx[0]).catch(() => {});
      } else await top(f);
    },
  },
  {
    screen: 'list-search',
    profile: 'eli',
    states: ['empty', 'typical', 'overflow'],
    note: 'Searching: typical "job" finds the active interview request and, in its own "Answered" group, "A job for Luke"; overflow "the" matches most of the list ' +
      'and a long Answered group; empty: "Nothing matches that." The keyboard a phone would show is not emulated.',
    async go(t) {
      const f = await open(t); await nav(t, f, 'all');
      await f.fill('#f-search', t.variant === 'overflow' ? 'the' : 'job');
      await t.sleep(200);
    },
  },
  {
    screen: 'record',
    profile: 'eli',
    states: ['empty', 'typical', 'overflow', 'loading', 'offline'],
    note: 'Record tab: "Needs attention" (folded unless the review is due), streak strip (in a row / best run / this month / answered), this month\'s calendar, ' +
      'then Answered with dates and notes. typical: 9 in a row, best 23, 18 days in September, 5 answered; overflow: 1204-day streak, 26 answered, review open. ' +
      'empty: "Nothing answered yet — it will come." loading: the tab tap lands before hub.ready: the screen and nav switch, then reviewDue() throws ' +
      '(D undefined), leaving the static heading, a folded "Needs attention" with no count and a bare "Answered" — and the + button, which the loaded ' +
      'Record never shows (screenName is never updated). overflow: a request can sit in two review groups and the count adds both.',
    async go(t) { const f = await open(t); await nav(t, f, 'answered'); },
  },
  {
    screen: 'record-review',
    profile: 'eli',
    states: ['empty', 'typical', 'overflow'],
    note: 'Record with "Needs attention" opened: Gone quiet / No news in a while / Added recently, each a list of rows. empty: "Nothing needs attention. ' +
      'The list is current." typical: tapped open (Believers facing persecution and the city council sit in both of the first two groups). overflow: the ' +
      'review is due, so it is already open on record-overflow; this one is scrolled to "No news in a while", the long second group.',
    async go(t) {
      const f = await open(t); await nav(t, f, 'answered');
      if (!(await f.locator('#reviewWrap').evaluate(d => d.open).catch(() => true))) await tapIn(t, f, '#reviewWrap > summary > span');
      if (t.variant === 'overflow') await f.evaluate(() => {
        const h = [...document.querySelectorAll('#reviewBody h3')].find(x => /No news/.test(x.textContent));
        if (h) window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 20);
      }).catch(() => {});
      await t.sleep(200);
    },
  },
  {
    screen: 'record-answered',
    profile: 'eli',
    states: ['typical', 'overflow'],
    note: 'Record scrolled to the Answered list (dates in gold, notes in Instrument Serif italic). empty: the list is one line ("Nothing answered yet"), see record-empty.',
    async go(t) {
      const f = await open(t); await nav(t, f, 'answered');
      await f.locator('#s-answered h2').scrollIntoViewIfNeeded().catch(() => {});
      await f.evaluate(() => { const h = document.querySelector('#s-answered h2'); if (h) window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 20); }).catch(() => {});
    },
  },
  {
    screen: 'record-family',
    profile: 'eli',
    states: ['typical', 'overflow'],
    note: 'The family list\'s Record (Family switch, then Record): the family streak (typical 16 days, best run 16, 20 this month), its September calendar and ' +
      'the two answered family requests; overflow 701 days and 6 answered. These are the numbers family-reset wipes to 0.',
    async go(t) { const f = await open(t); await family(t, f); await nav(t, f, 'answered'); },
  },
  {
    screen: 'add',
    profile: 'eli',
    states: ['typical', 'error'],
    note: 'Add tab: title with the mic button (the rig\'s inert speech stub stands in for Safari\'s, so it shows as on an iPad), who, detail, phone, category, cadence chips. ' +
      'error: "Add to the list" with no title → "Add a few words about what you are praying for." The form does not depend on the list\'s data, so empty/overflow ' +
      'are the same picture; offline changes nothing visible. On the phones "Add to the list" starts under the nav (scroll to reach it).',
    async go(t) {
      const f = await open(t); await nav(t, f, 'add');
      if (t.error) {
        await f.locator('#f-save').scrollIntoViewIfNeeded().catch(() => {});
        await tapIn(t, f, '#f-save');
        await waitIn(f, '#f-titleErr:not(:empty)');
        await top(f);
      }
    },
  },
  {
    screen: 'add-filled',
    profile: 'eli',
    states: ['typical'],
    note: 'Add form filled in: "On certain days" with Tue and Thu picked shows the day chips; category Friends. Scrolled so the chips and the Add button show.',
    async go(t) {
      const f = await open(t); await nav(t, f, 'add');
      await f.fill('#f-title', 'Safe travels for the Okafors');
      await f.fill('#f-for', 'The Okafors');
      await f.fill('#f-detail', "Driving to their daughter's graduation on Saturday, eight hours each way.");
      await f.selectOption('#f-cat', 'Friends').catch(() => {});
      await tapIn(t, f, '#f-cad [data-cad="weekly"]');
      await tapIn(t, f, '#fday [data-fday="Tue"]');
      await tapIn(t, f, '#fday [data-fday="Thu"]');
      await f.evaluate(() => document.activeElement && document.activeElement.blur()).catch(() => {});
      await f.locator('#f-save').scrollIntoViewIfNeeded().catch(() => {});
    },
  },
  {
    screen: 'detail',
    profile: 'eli',
    states: ['typical', 'overflow', 'offline'],
    note: 'Tapping a request opens its sheet: category, title, who, detail, last prayed / on the list since, history of updates, then Add an update · Tell them you prayed · ' +
      'Change category · Send to family list · Mark answered, and Edit · Delete. typical: "Dad\'s knee recovery"; overflow: long title, 400-character detail, 8 updates. ' +
      'Needs a request, so no empty/loading. The rows are opened with a mouse click: a touch tap on a row (a <div> handled only by a document-level click ' +
      'listener) fires no click in this WebKit build. The row body has cursor:pointer (apps/prayer.html:101), which is what lets iOS Safari dispatch a ' +
      'delegated click, so this is likely the rig\'s touch emulation — still worth one tap on a real iPhone/iPad.',
    async go(t) { const f = await open(t); await detail(t, f, ACTIVE(t)); },
  },
  {
    screen: 'detail-answered',
    profile: 'eli',
    states: ['typical', 'overflow'],
    note: 'An answered request\'s sheet, from the Record: "Answered <date>" in gold, the note, and "Put back on the list".',
    async go(t) { const f = await open(t); await nav(t, f, 'answered'); await detail(t, f, ANSWERED(t)); },
  },
  {
    screen: 'detail-family',
    profile: 'eli',
    states: ['typical', 'overflow'],
    note: 'A family request\'s sheet: no "Send to family list"; the delete warning differs (see ask-delete). The sheet shows neither who asked nor who prayed today.',
    async go(t) { const f = await open(t); await family(t, f); await detail(t, f, 's001'); },
  },
  {
    screen: 'edit',
    profile: 'eli',
    states: ['typical', 'overflow'],
    note: 'Edit, in the same sheet: every field of the request, cadence chips, Save / Cancel.',
    async go(t) {
      const f = await open(t); await detail(t, f, ACTIVE(t));
      await tapIn(t, f, `[data-edit="${ACTIVE(t)}"]`);
      await waitIn(f, '#e-title');
      await f.evaluate(() => document.activeElement && document.activeElement.blur()).catch(() => {});
    },
  },
  {
    screen: 'ask-answer',
    profile: 'eli',
    states: ['typical'],
    note: '"Mark answered" opens an inline panel under the buttons (the app\'s stand-in for prompt()): a required note, "Mark answered" disabled until something is typed.',
    async go(t) {
      const f = await open(t); await detail(t, f, ACTIVE(t));
      await tapIn(t, f, `[data-answer="${ACTIVE(t)}"]`);
      await waitIn(f, '.ask #askIn');
      await f.locator('.ask').scrollIntoViewIfNeeded().catch(() => {});
    },
  },
  {
    screen: 'mark-answered',
    profile: 'eli',
    states: ['typical'],
    isolate: true,                                             // writes the answer
    note: 'After "Mark answered" is saved: the app jumps to the Record, scrolled to the top (the new answer heads the Answered list under the ' +
      'calendar: in view on the tall screens, below the fold on iPhone Safari and the landscape ones), with the "Moved to the record." toast and Undo for 6 s.',
    async go(t) {
      const f = await open(t); await detail(t, f, ACTIVE(t));
      await tapIn(t, f, `[data-answer="${ACTIVE(t)}"]`);
      await waitIn(f, '.ask #askIn');
      await f.fill('#askIn', 'He walked the whole block with Grandma on Sunday, no cane.');
      await tapIn(t, f, '#askSave');
      await waitIn(f, '#s-answered.on');
      await waitIn(f, '#toast.on', 3000);
    },
  },
  {
    screen: 'ask-tell',
    profile: 'eli',
    states: ['typical'],
    note: '"Tell them you prayed" on a request with a number: the inline panel "Send this to Dad?" with the message filled in and "Open Messages" ' +
      '(an sms: link, not followed here). Without a number the button reads Copy.',
    async go(t) {
      const f = await open(t); await detail(t, f, ACTIVE(t));
      await tapIn(t, f, `[data-tell="${ACTIVE(t)}"]`);
      await waitIn(f, '.ask #askIn');
      await f.evaluate(() => document.activeElement && document.activeElement.blur()).catch(() => {});
      await f.locator('.ask').scrollIntoViewIfNeeded().catch(() => {});
    },
  },
  {
    screen: 'ask-update',
    profile: 'eli',
    states: ['typical'],
    note: '"Add an update": the inline textarea panel "What is the update?" with Save disabled until something is typed (the app\'s stand-in for prompt()).',
    async go(t) {
      const f = await open(t); await detail(t, f, ACTIVE(t));
      await tapIn(t, f, `[data-update="${ACTIVE(t)}"]`);
      await waitIn(f, '.ask #askIn');
      await f.locator('.ask').scrollIntoViewIfNeeded().catch(() => {});
    },
  },
  {
    screen: 'ask-recat',
    profile: 'eli',
    states: ['typical'],
    note: '"Change category": the inline panel "Move to which category?" with the list\'s categories in a native select and Move / Cancel.',
    async go(t) {
      const f = await open(t); await detail(t, f, ACTIVE(t));
      await tapIn(t, f, `[data-recat="${ACTIVE(t)}"]`);
      await waitIn(f, '.ask #askIn');
      await f.locator('.ask').scrollIntoViewIfNeeded().catch(() => {});
    },
  },
  {
    screen: 'ask-share',
    profile: 'eli',
    states: ['typical'],
    note: '"Send to family list" (private list only): the inline panel "How should this read on the family list?" with the title filled in, "Everyone in the house ' +
      'can see it." and Send. Sending would add a family row and show an "Added to the family list. Open it" toast (not captured: it writes).',
    async go(t) {
      const f = await open(t); await detail(t, f, ACTIVE(t));
      await tapIn(t, f, `[data-share="${ACTIVE(t)}"]`);
      await waitIn(f, '.ask #askIn');
      await f.evaluate(() => document.activeElement && document.activeElement.blur()).catch(() => {});
      await f.locator('.ask').scrollIntoViewIfNeeded().catch(() => {});
    },
  },
  {
    screen: 'ask-delete',
    profile: 'eli',
    states: ['typical'],
    note: 'Delete on a family request: the red inline confirm (stand-in for confirm()) — "Sync does not carry deletions, so it can come back from another device." ' +
      '(the code does sync the delete, apps/prayer.html:692).',
    async go(t) {
      const f = await open(t); await family(t, f); await detail(t, f, 's001');
      await tapIn(t, f, '[data-delete="s001"]');
      await waitIn(f, '.ask.danger');
      await f.locator('.ask.danger').scrollIntoViewIfNeeded().catch(() => {});
    },
  },
  {
    screen: 'more',
    profile: 'eli',
    states: ['typical'],
    note: 'Today\'s More sheet: Kitchen view · Copy as text · Print. The same three for every list and variant; hidden when today\'s list is empty. ' +
      'Print calls window.print(), which the rig cannot show (manual check).',
    async go(t) { const f = await open(t); await tapIn(t, f, '#moreBtn'); await waitIn(f, '#sheet.on'); await t.sleep(350); },
  },
  {
    screen: 'more-copy',
    profile: 'eli',
    states: ['typical', 'error'],
    note: 'More → "Copy as text". typical: the clipboard accepts, the sheet closes and a "Copied 9 requests." toast shows (the copied text itself is never shown). ' +
      'error: the clipboard refuses (as Safari may inside an iframe) — the screen makes navigator.clipboard.writeText reject before the app loads — and the sheet ' +
      'stays up with the "Copy this yourself" box holding the list (apps/prayer.html:1132-1139).',
    async go(t) {
      if (t.error) await t.ctx.addInitScript(() => {
        try { Object.defineProperty(Navigator.prototype, 'clipboard', { configurable: true, get: () => ({ writeText: () => Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError')) }) }); } catch (e) {}
      });
      const f = await open(t); await tapIn(t, f, '#moreBtn'); await waitIn(f, '#sheet.on');
      await tapIn(t, f, '[data-more="copy"]');
      await waitIn(f, '.ask, #toast.on', 3000);
      await t.sleep(350);
    },
  },
  {
    screen: 'print',
    profile: 'eli',
    states: ['typical', 'overflow'],
    modes: ['light'],                                          // paper: the print sheet forces black on white in either theme
    note: 'More → Print, as the page lays out for paper: the app builds #printArea (title, date, "N requests", a tick box per active request by category, ' +
      'answered in the last 90 days) and calls window.print(). The rig stubs window.print (the dialog cannot be captured) and switches the page to print ' +
      'media: the shell\'s bar hides as well, so the shot is the frame\'s print layout at the device\'s width, first screenful only — a stand-in for the paper ' +
      'page, not the paper page (no printer margins, no page breaks).',
    async go(t) {
      await t.ctx.addInitScript(() => { window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; }; });
      const f = await open(t); await tapIn(t, f, '#moreBtn'); await waitIn(f, '#sheet.on');
      await tapIn(t, f, '[data-more="print"]');
      await f.waitForSelector('#printArea h1', { state: 'attached', timeout: 4000 }).catch(() => {});   // hidden until print media
      await t.page.emulateMedia({ media: 'print' });
      await t.sleep(300);
    },
  },
  {
    screen: 'pray-mode',
    profile: 'eli',
    states: ['typical', 'overflow'],
    note: '"Pray now": full-screen, one request at a time from those not yet prayed today — count, category, title, who, the last update in serif italic, ' +
      'progress bar, Back / Prayed / Skip. typical starts at "Dad\'s knee recovery"; overflow "1 of 23" on a five-line title under a two-line category ("That the whole extended family would come together…"). Swipe and keys (→, Space, Esc) are not shown.',
    async go(t) { const f = await open(t); await tapIn(t, f, '#startPray'); await waitIn(f, '#pray.on'); await t.sleep(350); },
  },
  {
    screen: 'pray-mode-last',
    profile: 'eli',
    states: ['typical'],
    note: 'Pray now after five Skips: the sixth and last of the six still to pray, with "Prayed, finish" and the bar at 83%. Skip writes nothing.',
    async go(t) {
      const f = await open(t); await tapIn(t, f, '#startPray'); await waitIn(f, '#pray.on');
      for (let i = 0; i < 5; i++) { await tapIn(t, f, '#praySkip'); await t.sleep(80); }
      await t.sleep(450);
    },
  },
  {
    screen: 'kitchen',
    profile: 'eli',
    states: ['typical', 'overflow'],
    note: 'More → Kitchen view: the whole active list in big type by category, with a glass Close. Reached only through More, which is hidden when today\'s list is empty.',
    async go(t) {
      const f = await open(t); await tapIn(t, f, '#moreBtn'); await waitIn(f, '#sheet.on');
      await tapIn(t, f, '[data-more="kitchen"]'); await waitIn(f, '#kitchen.on'); await t.sleep(350);
    },
  },
  {
    screen: 'kitchen-family',
    profile: 'eli',
    states: ['typical'],
    note: 'Kitchen view of the family list (heading "Family list", category labels in teal).',
    async go(t) {
      const f = await open(t); await family(t, f); await tapIn(t, f, '#moreBtn'); await waitIn(f, '#sheet.on');
      await tapIn(t, f, '[data-more="kitchen"]'); await waitIn(f, '#kitchen.on'); await t.sleep(350);
    },
  },
  {
    screen: 'settings',
    profile: 'eli',
    states: ['empty', 'typical', 'overflow', 'loading', 'offline'],
    note: 'More tab (#s-more, titled "Settings"): Prayer plan (active plan select, what Today shows, rotation size, layout chips, Rename/Delete plan, New plan), ' +
      'Paste a list, Categories, Backup. overflow: three long plan names, 33 categories. loading: the tab tap lands before hub.ready, the screen switches ' +
      'and the render throws: the static form with an empty plan select, no plan editor and no categories, but live-looking New plan, Read these lines, ' +
      'Add category and Export/Import buttons.',
    async go(t) { const f = await open(t); await nav(t, f, 'more'); },
  },
  {
    screen: 'settings-categories',
    profile: 'eli',
    states: ['typical', 'overflow'],
    note: 'Settings scrolled to Categories: each with its dot, active count, Rename / Remove (small text buttons, padding 5px 3px, well under 44 px), then Add a category and Backup. ' +
      'typical: the top of the list; overflow: the end of its 33, where the five long custom names wrap beside Rename / Remove.',
    async go(t) {
      const f = await open(t); await nav(t, f, 'more');
      await f.evaluate(over => {
        const rows = document.querySelectorAll('#catAdmin .catrow');
        const h = over && rows.length > 10 ? rows[rows.length - 10] : [...document.querySelectorAll('#s-more h2')].find(x => /Categories/.test(x.textContent));
        if (h) window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 20);
      }, t.variant === 'overflow').catch(() => {});
    },
  },
  {
    screen: 'settings-delcat',
    profile: 'eli',
    states: ['typical', 'overflow'],
    note: 'Remove on a category that holds requests: the red inline confirm under its row ("2 requests are in "Health Needs". Remove it and move them to Personal?"). ' +
      'overflow: the longest custom category. Nothing is removed.',
    async go(t) {
      const f = await open(t); await nav(t, f, 'more');
      const name = t.variant === 'overflow' ? 'Grandparents, Great-Grandparents and Extended Family Across Three States' : 'Health Needs';
      const btn = f.locator('#catAdmin .catrow', { hasText: name }).first().locator('[data-delcat]');
      await btn.scrollIntoViewIfNeeded().catch(() => {});
      await t.tap(btn);
      await waitIn(f, '.catrow + .ask.danger');
      await t.page.mouse.move(1, 1).catch(() => {});             // the panel pushes the next row under the pointer: no stray :hover on its Remove
      await f.evaluate(() => { const a = document.querySelector('.ask.danger'); if (a) window.scrollTo(0, a.getBoundingClientRect().top + window.scrollY - 160); }).catch(() => {});
    },
  },
  {
    screen: 'settings-import',
    profile: 'eli',
    states: ['typical'],
    note: 'Backup → "Import a backup": the inline panel "Paste the contents of a backup file" with "This replaces both lists on this device." (Import stays disabled until ' +
      'something is pasted). "Export both lists" downloads a JSON file, which the rig does not follow.',
    async go(t) {
      const f = await open(t); await nav(t, f, 'more');
      await f.locator('#f-import').scrollIntoViewIfNeeded().catch(() => {});
      await tapIn(t, f, '#f-import');
      await waitIn(f, '.ask #askIn');
      await f.evaluate(() => { const a = document.querySelector('.ask'); if (a) window.scrollTo(0, a.getBoundingClientRect().top + window.scrollY - 200); }).catch(() => {});
    },
  },
  {
    screen: 'settings-byday',
    profile: 'mom',
    states: ['typical'],
    note: 'Elizabeth\'s by-day plan in Settings: day chips, the native multi-select of categories ("tap to toggle") and "Always include every-day requests".',
    async go(t) {
      const f = await open(t); await nav(t, f, 'more');
      await f.locator('#p-day').scrollIntoViewIfNeeded().catch(() => {});
    },
  },
  {
    screen: 'settings-paste',
    profile: 'eli',
    states: ['typical'],
    note: 'Paste a list → "Read these lines": the parsed requests with a Keep button each and Keep all (nothing is kept here).',
    async go(t) {
      const f = await open(t); await nav(t, f, 'more');
      await f.fill('#f-paste', 'Health Needs:\nSam - recovery after surgery\nAunt Ruth\n\nMissionaries - Abroad:\nThe Carters in Peru\nThe Hendersons - settling in Kenya');
      await tapIn(t, f, '#f-parse');
      await waitIn(f, '#parsed .pending');
      await f.evaluate(() => { const p = document.getElementById('f-paste'); if (p) window.scrollTo(0, p.getBoundingClientRect().top + window.scrollY - 60); }).catch(() => {});
    },
  },
  {
    screen: 'kid',
    profile: 'ezra',
    states: ['empty', 'typical', 'overflow', 'loading', 'offline'],
    note: 'Ezra (kid mode): the family list only, one big card per request with who asked and a 64 px Prayed button; no nav, switch, Pray now or Add. ' +
      'loading: 1.2 s in, before hub.ready — a blank page (kid CSS hides the switch, actions and strip, and there is no heading or card until the data ' +
      'arrives, up to 6 s on a slow start); offline: reopened from the warm cache. ' +
      'typical: 8 cards, the two he prayed this morning (Grandpa\'s knee, Mae\'s interview) in olive; overflow: 30 cards with long titles and long requester names (the cards with up to 9 prayed-today faces are further down, see kid-faces); ' +
      'empty: "Nothing to pray for yet." with the empty art. Opened as on a device that has shown Prayer before (warm family cache): a kid\'s first open ' +
      'on a new device resets the family settings instead — see family-reset.',
    async go(t) { const f = await open(t); if (!t.loading) await waitIn(f, 'ul.kids, .empty', 3000); },
  },
  {
    screen: 'kid-faces',
    profile: 'ezra',
    states: ['overflow'],
    note: 'Kid cards scrolled to the one with the most people on today\'s prayed list: five faces then "+4", under "prayed today", on a card Ezra has prayed (olive).',
    async go(t) { const f = await open(t); await waitIn(f, 'ul.kids', 3000); await toMostFaces(f, 'ul.kids li.kid'); },
  },
  {
    screen: 'kid-all-prayed',
    profile: 'ezra',
    states: ['typical'],
    isolate: true,                                             // taps write the family rows
    note: 'Ezra after tapping Prayed on the six cards he had not prayed yet: "You prayed for everyone today!", every card in olive with his face ' +
      'added to the prayed-today row. No toast, sound or star here (Kid Verse credits the prayed day the next time it opens).',
    async go(t) {
      const f = await open(t); await waitIn(f, 'ul.kids', 3000);
      for (let i = 0; i < 12; i++) {
        const b = f.locator('[data-kpray][aria-pressed="false"]').first();
        if (!(await b.count())) break;
        await b.scrollIntoViewIfNeeded().catch(() => {});
        await t.tap(b); await t.sleep(90);
      }
      await top(f);
    },
  },
  {
    screen: 'guest',
    profile: 'guest-grandmajo',
    states: ['typical'],
    note: 'Guest Grandma Jo (adult rules): opens on her own empty private list — the illustrated empty state — with the Family switch next to it.',
    async go(t) { await open(t); },
  },
];

// The sheet, its veil and the nav are glass: a translucent fill over backdrop-filter blur (apps/prayer.html:234-235, 283-298). This WebKit build
// reports backdrop-filter as supported but paints no blur, so on these screens the page behind reads through the sheet far more than on a device.
const NOBLUR = ' Rig limit: no backdrop blur in this WebKit build, so the page behind shows through the sheet (and the nav) more sharply than on an iPad or iPhone.';
const SHEETS = new Set(['detail', 'detail-answered', 'detail-family', 'edit', 'ask-answer', 'ask-update', 'ask-recat', 'ask-share', 'ask-tell', 'ask-delete', 'more', 'more-copy']);

// Offline, fonts.googleapis.com / fonts.gstatic.com are unreachable like every other host, and sw.js lets cross-origin requests
// through uncached (sw.js:36), so Prayer falls back to the system face (Segoe UI in this Windows WebKit, San Francisco on iOS).
// A real device looks the same offline unless Safari's HTTP cache still holds the fonts.
const OFFLINE_FONT = ' Offline shots are in the system font, not Manrope: Google Fonts is unreachable and sw.js does not cache it (sw.js:36), ' +
  'as on a device whose browser cache no longer holds the fonts.';

// Every screen runs the reset guard after it settles (before the shot).
export const screens = SCREENS.map(s => ({ after: guard, ...s,
  note: s.note + (SHEETS.has(s.screen) ? NOBLUR : '') + ((s.states || []).includes('offline') ? OFFLINE_FONT : '') }));
