// Area "tv": the kiosk TV board (the Downstairs TV profile's Home, index.html renderHome kiosk branch 977-1143), what
// that TV shows after its Switch button (the profile picker at 1920×1080), and the two other views the kiosk can reach by
// typing a hash into the TV browser's address bar (#me, #chat). Also the same board in the evening (greeting and the
// ambient stand-in follow the hour, index.html:835, 1044), scrolled to show what an overflowing board hides below the
// screen edge, and on the "kiosk iPad" the user guide describes (README.md:25), where the grid is two columns.
//
// The board reads other apps' rows; this area seeds nothing itself. What a full typical board needs:
//   album photos      app_data(family, 'hub', 'album:<id>') = { id, sm, lg, by, byName, caption, at }   index.html:1046 (worker/src/index.js:369)
//   verse week        app_data(family, 'kidverse', 'week') = { week, by, at }                               index.html:1053-1056 (apps/kidverse.html:338)
//   prayed today      app_data(family, 'prayer', 'prayer:<id>').prayedBy['YYYY-MM-DD'] = [names]         index.html:1058-1061
//   kids' stars       app_data(family, 'kidverse', 'stars:<kid>') { week, count, … } + 'ledger:<kid>:<id>' index.html:1067-1068, 882, 885, 1348
//   reading today     activity rows 'Read week N day D — ref' created today, by adult profile_id          index.html:1063-1065
//   feed              latest five activity rows (GET /api/activity?limit=100)                             index.html:1069-1071, 1107-1108
//   reminders         app_data(family, 'reminders', 'item:<id>') = { id, text, by, byName, createdAt }    index.html:1073-1074, 1218-1227
//
// Timers: the rig fixes Date.now() at the demo time, so the board's 1 s tick never reaches its 45 s crossfade, 60 s
// repaint or 5 min feed refresh (index.html:1110-1116). What gets captured is the board's first settled paint: the
// first pull and the feed have landed and the front backdrop <img> holds a loaded picture with no fade in flight (the
// screenshot's animations: 'disabled' finishes the 2.5 s opacity transition).
import { DEMO_TIME } from '../seed/story.mjs';

export const area = 'tv';

// 8:30 pm on the demo day: prime time for the family TV. The server clock stays at 8:40 am, so every row is still
// "today" (prayedBy, readers, this ISO week's stars); only the browser clock moves (greeting, ambient art, "ago" times).
const EVENING = new Date(DEMO_TIME).getTime() + (11 * 60 + 50) * 60000;

// The front backdrop is settled: no fade in flight, the front <img> is shown and loaded, and — when the family album has
// photos — it is an album photo rather than the ambient stand-in the board paints before the album arrives.
async function backdropSettled(page, timeout) {
  return page.waitForFunction(() => {
    const tv = window.__tv; if (!tv || !window.hub) return false;
    const s = tv.state(); if (s.fading) return false;
    const img = document.getElementById('tv-bg-' + s.front);
    if (!img || !img.classList.contains('on') || !img.complete || !img.naturalWidth) return false;
    let album = [];
    try { album = window.hub.list('album:', { app: 'hub', scope: 'family' }).filter(r => r.value && (r.value.lg || r.value.sm)); } catch {}
    return !album.length || /\/api\/media\/album\//.test(s.url[s.front] || '');
  }, null, { timeout, polling: 100 }).then(() => true, () => false);
}

async function openBoard(t) {
  const { page } = t;
  await t.goto('#home');
  await page.waitForSelector('#tv #clock:not(:empty)', { timeout: 8000 }).catch(() => {});
  if (t.loading) {
    // data, profiles and the feed never answer: only the local ambient art can arrive
    await page.waitForFunction(() => { const s = window.__tv && window.__tv.state(); const img = s && document.getElementById('tv-bg-' + s.front); return !!(img && img.classList.contains('on') && img.naturalWidth); }, null, { timeout: 3000, polling: 100 }).catch(() => {});
    return;
  }
  if (!t.reopened) {
    // the first pull (family prayer is declared by the board itself and joins it) and the board's own 100-line feed read
    await page.waitForFunction(() => window.hub && window.hub.sync.lastPull > 0 && localStorage.getItem('hub.feed') !== null, null, { timeout: 6000, polling: 100 }).catch(() => {});
  }
  await backdropSettled(page, t.reopened ? 3000 : 5000);
}

// The kiosk reaches another tab only through the address bar: a page load at #me/#chat is forced back to Home
// (enterShell, index.html:626), but a hash change on the open board is not (the hashchange handler has no kiosk guard,
// index.html:650-654). The board stays painted over the new view: the kiosk rule `#view-home { display: grid }`
// (index.html:129) outranks `.view { display: none }` (index.html:68), so the tab's view renders below the board.
async function hashFromBoard(t, tab) {
  await openBoard(t);
  await t.page.evaluate(h => { location.hash = h; }, '#' + tab);
  await t.page.waitForSelector(`#view-${tab}.on`, { timeout: 4000 }).catch(() => {});
}

export const screens = [
  {
    screen: 'board',
    profile: 'tv',
    devices: ['tv'],
    states: ['empty', 'typical', 'overflow', 'loading', 'offline'],
    note: 'Kiosk Home (TV glue board), read-only, 1920×1080, first settled paint (clock fixed, so no later crossfade). Loading looks like empty and offline like typical: the board has no loading or offline cue. No error state: a failed pull or feed read is silent. No park variant: the kiosk branch returns before atPark(), so nothing park-related shows.',
    go: openBoard,
  },
  {
    screen: 'board-evening',
    profile: 'tv',
    devices: ['tv'],
    states: ['empty', 'typical'],
    note: 'The board at 8:30 pm (browser clock only; the day\'s rows are the morning\'s): "Good evening", and with an empty album the ambient stand-in is art/ambient/night.svg (ambientOf, index.html:1044). With photos the backdrop is the album at any hour, so typical differs from the morning board only in the greeting and the "ago" times.',
    async go(t) { await t.clockTo(EVENING); await openBoard(t); },
  },
  {
    screen: 'board-below-fold',
    profile: 'tv',
    devices: ['tv'],
    states: ['overflow'],
    note: 'The overflow board with #views scrolled to the bottom: what sits below the 1080 px edge (the rest of Around the house and Reading today, and every reminder). Nothing on the board shows that it scrolls, and a TV with only a remote cannot scroll it.',
    async go(t) { await openBoard(t); await t.scroll('#views', 'bottom'); },
  },
  {
    screen: 'board-ipad',
    profile: 'tv',
    devices: ['ipad-landscape', 'ipad-portrait'],
    states: ['empty', 'typical', 'overflow'],
    note: 'The same board on the "kiosk iPad" of the user guide (README.md:25: add to Home Screen, pick Downstairs TV once, leave it). Below 1200 px the grid is two columns (index.html:134-136), so both orientations get the stacked layout, tightened by the max-height rules on the landscape iPad (174-175). First screen only; #views scrolls by touch here. Loading and offline behave as on the TV (see board).',
    go: openBoard,
  },
  {
    screen: 'picker-tv',
    profile: null,
    lastProfile: 'tv',
    devices: ['tv'],
    states: ['typical'],
    note: 'What the TV shows after its Switch button: the profile picker at 1920×1080 with the Downstairs TV card as last profile. Other picker states are covered by the shell area on the handheld devices.',
    async go(t) {
      await t.goto('');
      await t.page.waitForSelector('#profiles .pcard:not(.skeleton)', { timeout: 8000 }).catch(() => {});
    },
  },
  {
    screen: 'me-kiosk',
    profile: 'tv',
    devices: ['tv'],
    states: ['typical'],
    note: 'The kiosk\'s Me, the only place the TV\'s device-local theme is set, reached by typing …#me on the open board and shown here scrolled into view. The board stays on screen (index.html:129 beats 68), so Me renders below it, and its cards paint under the board\'s fixed backdrop and scrim (.tv-bg, index.html:130-133): only the hero, the card headings and Switch show, while the hidden theme cards still take taps (the backdrop is pointer-events: none). Kiosk Me: "Display" kicker, Appearance, Sync with "Forget this device", Switch (signs out, unlike the board\'s Switch). #apps, reached the same way, puts the "No apps for this profile yet." empty state below the board (index.html:696).',
    async go(t) {
      await hashFromBoard(t, 'me');
      await t.page.waitForSelector('#view-me.on #theme .theme-card', { timeout: 4000 }).catch(() => {});
      await t.page.evaluate(() => { const v = document.getElementById('views'), m = document.getElementById('view-me'); if (v && m) v.scrollTop = m.offsetTop - 24; });
      await t.sleep(250);
    },
  },
  {
    screen: 'chat-kiosk',
    profile: 'tv',
    devices: ['tv'],
    states: ['typical'],
    note: 'Typing …#chat on the open board: the chat composer un-hides over the board (index.html:636) although openChat returns early for the kiosk (1465); chatEnabled stays true (1437), so a send reaches the server and gets 403 no_chat, and the reply bubble lands in the chat view below the board, out of sight.',
    async go(t) {
      await hashFromBoard(t, 'chat');
      await t.page.waitForSelector('#chat-form:not([hidden])', { timeout: 4000 }).catch(() => {});
    },
  },
];
