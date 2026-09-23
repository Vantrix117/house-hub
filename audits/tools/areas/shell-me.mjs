// The hub shell's Chat and Me tabs (index.html): the chat log for each audience (adult, kid, guest), the Me tab from the
// top and scrolled to each of its cards (album, appearance, notifications, kids' rewards, sync, admin), each named
// palette picked in Appearance, Me for the other audiences (a non-admin adult, a kid, a guest) and every sheet Me opens
// (add a guest, your photo, edit profile, choose / generate a pairing code). The gate, Home, Apps and the viewer are in areas/shell.mjs; the TV board in tv.mjs.
//
// Every go() only navigates, taps and types. A few screens also answer one API call in the browser to reach a state
// the local instance cannot produce on its own (an upstream chat failure, a reply that is still streaming, a house
// server with no assistant key, a generated pairing code); each says so in its note. Offline runs go() twice; on the
// second pass (t.reopened) the page is reopened from a blank page (a same-URL goto with only a #fragment would not
// reload) and nothing waits for the network.
export const area = 'shell';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const wait = (t, sel, timeout = 5000, state = 'visible') => t.page.waitForSelector(sel, { state, timeout }).then(() => true, () => false);
const waitFn = (t, fn, arg, timeout = 5000) => t.page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);

async function open(t, hash) {
  if (t.reopened) await t.page.goto('about:blank');
  await t.goto(hash);
}

// ── chat ────────────────────────────────────────────────────────────────────────────────────────────────────
// Opens the Chat tab and waits for the history (GET /api/chat/history, index.html:1464-1485) to replace the skeleton
// bubble with messages, the greeting, or the "Could not load the chat" note (offline).
async function chat(t) {
  await open(t, '#chat');
  if (t.loading) { await wait(t, '#chat-log .skeleton', 4000, 'attached'); return; }
  await waitFn(t, () => { const l = document.querySelector('#chat-log'); return !!l && l.children.length > 0 && !l.querySelector('.skeleton'); }, null, 6000);
  await chatBottom(t);
}
// The log scrolls #views; openChat scrolls to the bottom once the history is in (index.html:1438). Avatars and the
// greeting art load after that, so the rig scrolls again in after().
async function chatBottom(t) { await t.page.evaluate(() => { const v = document.querySelector('#views'); if (v) v.scrollTop = v.scrollHeight; }); await sleep(150); }

// Answer POST /api/chat in the browser (the preflight gets the CORS headers the Worker would send).
async function routeChat(t, answer) {
  await t.page.route(u => u.href.startsWith(t.api + '/api/chat') && !u.href.includes('/history'), async route => {
    const cors = { 'Access-Control-Allow-Origin': t.site, 'Access-Control-Allow-Headers': 'Content-Type, X-Device-Token, X-Profile-Token', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    return route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' }, body: answer });
  });
}
async function send(t, text) {
  await t.page.fill('#chat-in', text);
  await t.tap('#chat-send');
}

// ── me ──────────────────────────────────────────────────────────────────────────────────────────────────────
// A device that has used the hub opens on Home, the first pull lands, then the person taps Me. (Opening #me straight
// onto an empty cache paints Kids' rewards from nothing and nothing repaints it after the pull — see the observation in
// the phase notes — so the capture goes the way a returning device does.) Loading and the offline reopen go straight
// to #me: the data never arrives / the cache is already warm.
async function me(t) {
  if (t.loading || t.reopened) {
    await open(t, '#me');
    await wait(t, '#view-me .me-hero', 6000);
    await sleep(t.reopened ? 400 : 0);
    return;
  }
  await open(t, '#home');
  await waitFn(t, () => !!(window.hub && hub.sync && hub.sync.lastPull), null, 6000);
  await t.tap('#tabbar .tab[data-tab="me"]');
  await wait(t, '#view-me .me-hero', 4000);
  await sleep(200);
}
// Wait for the admin card to replace its skeleton (renderAdmin, index.html:1579-1584) with the panel or its error line.
async function admin(t) {
  if (t.loading) return;
  await wait(t, '#admin-body .admin-people, #admin-body p.text-2', 6000);
}
// Scroll #views so the card holding `sel` (or the first `sel` whose text includes `text`) sits `pad` px below the top.
async function scrollTo(t, sel, { text = null, pad = 12, card = true } = {}) {
  await t.page.evaluate(([sel, text, pad, card]) => {
    const v = document.querySelector('#views');
    let el = [...document.querySelectorAll(sel)].find(e => !text || e.textContent.includes(text));
    if (!v || !el) return;
    if (card) el = el.closest('.card') || el;
    v.scrollTop = Math.max(0, el.getBoundingClientRect().top - v.getBoundingClientRect().top + v.scrollTop - pad);
  }, [sel, text, pad, card]);
  await sleep(200);
}
// A Me screen scrolled to one card: scroll in go() and again in after() (a late image or re-render above it can move it).
const section = (sel, opts, extra) => ({
  async go(t) { await me(t); if (extra) await extra(t); await scrollTo(t, sel, opts); },
  async after(t) { await scrollTo(t, sel, opts); },
});
// Open a sheet from Me and wait for it.
async function sheetFrom(t, trigger, ready) {
  await t.tap(trigger);
  await wait(t, ready, 4000);
  await sleep(250);                                                                   // the sheet's slide-in
}

const ALL = ['empty', 'typical', 'overflow', 'loading', 'offline'];

// Me → Appearance → a named palette. The light/dark captures only ever show System (Hearth by day, Midnight at night),
// so the three other palettes are picked here the way a person does: a tap on the card. hub.setTheme writes the
// person's app_data(person, hub, theme) row (apps/hub.js:88-93) — a write, so each capture gets its own database.
// A named palette ignores the device's light/dark setting, so one mode is enough.
const themePick = (id, name) => ({
  screen: 'me-theme-' + id, profile: 'eli', states: ['typical'], modes: ['light'], isolate: true,
  note: `Me → Appearance → ${name}: the Me tab repaints in the ${name} palette at once, the card shows as picked, and the choice follows Eli to his other devices (apps/hub.js:88-93). One mode only: a named palette ignores the device's light/dark setting. The Sync card below still reads "pending · 1 waiting" after the write has gone (the tab-bar dot is green): Me does not repaint on sync (index.html:1243). Home, Apps and the apps in this palette are not captured here.`,
  async go(t) {
    await me(t);
    await scrollTo(t, '#theme');
    await t.tap(`#theme [data-theme="${id}"]`);
    await wait(t, `#theme [data-theme="${id}"].on`, 3000);
    await scrollTo(t, '#theme');
  },
  async after(t) { await scrollTo(t, '#theme'); },
});

export const screens = [
  // ── Chat tab ───────────────────────────────────────────────────────────────────────────────────────────────
  {
    screen: 'chat', profile: 'eli', states: [...ALL, 'error'],
    note: 'Chat as Eli (admin). Empty: the greeting with art. Typical: a question last night and four this morning (counter 4/60); two replies carry a tool chip (the pancakes on the fridge list, the dentist reminder). Overflow: 60 messages today, so the counter reads 60/60 and the input is disabled with "Back tomorrow"; very long messages, a long link and a six-chip reply. Loading: the skeleton bubble. Offline: "Could not load the chat". Error: a message sent while the assistant is down; the rig answers POST /api/chat with the error event the Worker streams on an upstream failure, in the Worker\'s own wording (worker/src/chat.js:353, 441-442).',
    async go(t) {
      await chat(t);
      if (!t.error) return;
      await routeChat(t, 'event: error\ndata: ' + JSON.stringify({ error: 'upstream', message: 'The assistant is unavailable right now (Overloaded).' }) + '\n\n');
      await send(t, 'Is the chili still good to eat?');
      await wait(t, '#chat-log .msg.err', 5000);
      await chatBottom(t);
    },
    async after(t) { if (!t.loading) await chatBottom(t); },
  },
  {
    screen: 'chat-top', profile: 'eli', states: ['overflow'],
    note: 'The overflow chat scrolled back to the top: the "60/60 today" counter and the oldest of the 20 messages the tab keeps, a very long question and a very long answer. (The Chat tab shows only the newest 20 rows, so the first 50 of today\'s messages are not reachable.) Only overflow: the other logs fit on one screen or differ from chat only in scroll position.',
    async go(t) { await chat(t); await t.page.evaluate(() => { const v = document.querySelector('#views'); if (v) v.scrollTop = 0; }); },
    async after(t) { await t.page.evaluate(() => { const v = document.querySelector('#views'); if (v) v.scrollTop = 0; }); },
  },
  {
    screen: 'chat-sending', profile: 'eli', states: ['typical'],
    note: 'Eli has just sent a message: his bubble, the assistant bubble with the typing dots, and the Send button disabled while the reply streams. The rig holds POST /api/chat open so the reply never arrives. Loading/offline/empty are the chat screen\'s.',
    async go(t) {
      await chat(t);
      // t.hold (not a bare route that never answers): the rig's settle() then does not wait 8 s for the open request
      await t.hold(u => u.href.startsWith(t.api + '/api/chat') && !u.href.includes('/history'));
      await send(t, 'What can I make for dinner with what is in the fridge?');
      await wait(t, '#chat-log .typing', 4000);
      await chatBottom(t);
    },
    async after(t) { await chatBottom(t); },
  },
  {
    screen: 'chat-not-set-up', profile: 'eli', states: ['error'],
    note: 'The house server has no Anthropic key: the rig answers GET /api/chat/history with enabled:false (what chatHistory returns without ANTHROPIC_API_KEY, worker/src/chat.js:457), so the tab shows "The assistant is not set up yet…" (index.html:1473). The composer stays enabled; Send then does nothing (index.html:1488).',
    async go(t) {
      await t.answer('/api/chat/history', { body: { messages: [], used: 0, cap: 60, enabled: false } });
      await chat(t);
    },
  },
  {
    screen: 'chat-kid', profile: 'ezra', states: ['empty', 'typical', 'overflow'],
    note: 'Chat as Ezra (kid mode). Empty: the kid greeting ("Hi Ezra! Ask me something fun…"). Typical: he asked for the week\'s verse (the hub reads it aloud — not captured), why the place shook, and told it which family prayer he prayed this morning. Overflow: a long chat with long replies. Loading/offline are the same as the adult chat.',
    async go(t) { await chat(t); },
    async after(t) { await chatBottom(t); },
  },
  {
    screen: 'chat-kid-listening', profile: 'ezra', states: ['typical'],
    note: 'Ezra (a pre-reader) taps the mic: the button turns red and pulses while the browser listens (index.html:265, 1522-1526). The rig\'s speech recognition is inert, so nothing is ever heard and the mic stays on. Other states are the chat-kid ones.',
    async go(t) {
      await chat(t);
      await t.tap('#chat-mic');
      await wait(t, '#chat-mic.on', 3000);
    },
    async after(t) { await chatBottom(t); },
  },
  {
    screen: 'chat-guest', profile: 'guest-grandmajo', states: ['typical'],
    note: 'Chat as the guest Grandma Jo: a guest gets the adult tools and apps. Her history: the fridge and the family memory verse. Other states are the same as the adult chat.',
    async go(t) { await chat(t); },
    async after(t) { await chatBottom(t); },
  },

  // ── Me tab (Eli, admin) ───────────────────────────────────────────────────────────────────────────────────
  {
    screen: 'me', profile: 'eli', states: ALL,
    note: 'Top of Me as Eli: the hero (photo, "Adult · Admin", Switch), then the Guests card and the Family album. Empty: no photo, no guests, no album. Loading: the album shows its empty state because no data has arrived. Offline: painted from the local cache.',
    async go(t) { await me(t); },
    async after(t) { await t.page.evaluate(() => { const v = document.querySelector('#views'); if (v) v.scrollTop = 0; }); },
  },
  {
    screen: 'me-album', profile: 'eli', states: ['empty', 'typical', 'overflow'],
    note: 'Me → Family album (Eli sees a remove × on every photo as the admin). Empty: the illustrated empty state. Overflow: 12 photos. Removing a photo asks with a native confirm() (not capturable). Loading shows the empty state (see me loading); offline paints the cached album, the same as typical.',
    ...section('#album'),
  },
  {
    screen: 'me-appearance', profile: 'eli', states: ['typical'],
    note: 'Me → Appearance: the six theme cards (System picked by default). Other states do not change this card.',
    ...section('#theme'),
  },
  themePick('parchment', 'Parchment'),
  themePick('frost', 'Frost'),
  themePick('forest', 'Forest'),
  {
    screen: 'me-notifications', profile: 'eli', states: ['typical'],
    note: 'Me → Notifications. The local instance is plain http and WebKit here has no Push API, so the card always shows its "cannot receive" help text with the switch disabled; the per-kind switches and "Send a test notification" only appear once subscribed (a manual check on a real device).',
    ...section('#notif'),
  },
  {
    screen: 'me-rewards', profile: 'eli', states: ['empty', 'typical', 'overflow'],
    note: 'Me → Kids\' rewards: each kid\'s balance to cash in, this week, all-time, badges, last cash-in, with Cash in / Reset week (both ask with a native confirm(), not capturable). Empty: both kids at ★0 with the buttons disabled. Loading looks like empty (★0, see me-admin loading); offline paints the cached rows, the same as typical.',
    ...section('#rewards'),
  },
  {
    screen: 'me-sync', profile: 'eli', states: ['typical'],
    note: 'Me → Sync: status, waiting to send, last checked, this device, Check now, Forget this device (asks with a native confirm()). The offline Sync card ("offline", "Last checked: not yet") is in me-admin offline: both cards sit at the bottom of Me, so a separate offline capture here was the same image.',
    ...section('#syncnow'),
  },
  {
    screen: 'me-admin', profile: 'eli', states: ALL,
    note: 'Me → Admin, top: the profile list with Edit / Reset PIN, and for guests Edit / Clear PIN / Remove / Purge (overflow has an ended guest with Purge and a guest with a PIN). Loading: the skeleton. Offline: "Could not load admin data". Reset PIN, Remove, Purge and Unpair ask with a native confirm() (not capturable).',
    ...section('#admin', {}, admin),
  },
  {
    screen: 'me-admin-usage', profile: 'eli', states: ['empty', 'typical', 'overflow'],
    note: 'Me → Admin, lower half: Devices (paired / last seen / Unpair) and Usage (30 days): chat messages and pushes per person per day. The chat table counts UTC days (index.js:522) while the chat cap counts New York days, so evening messages land on the next day. No seed writes push_log rows (h.push is unused), so the push table always reads "No pushes yet." Loading (skeleton) and offline (the error line) are me-admin\'s.',
    ...section('#admin-body h3', { text: 'Devices', card: false, pad: 16 }, admin),
  },

  // ── Me for the other audiences ──────────────────────────────────────────────────────────────────────────────
  {
    screen: 'me-adult', profile: 'dad', states: ['typical', 'overflow'],
    note: 'Me as David, a household adult who is not the admin: no Admin card; Guests, album, appearance, notifications, kids\' rewards and sync. Overflow: long name. Empty, loading and offline are Eli’s me captures without the Admin card.',
    async go(t) { await me(t); },
  },
  {
    screen: 'me-kid', profile: 'ezra', states: ['typical', 'overflow'],
    note: 'Me as Ezra (kid mode): the photo button is disabled, no guests, album or rewards; appearance, notifications and sync only. Overflow: long name. Nothing on a kid’s Me depends on app data, so empty, loading and offline look like typical (the sync card is the only change, as in me-admin offline).',
    async go(t) { await me(t); },
  },
  {
    screen: 'me-guest', profile: 'guest-grandmajo', states: ['typical', 'overflow'],
    note: 'Me as the guest Grandma Jo: she can set her own photo and add album photos (a guest is an adult), but has no Guests or Kids\' rewards card; the kicker reads "Adult". The empty variant has no guests; loading and offline are as in Eli’s me captures.',
    async go(t) { await me(t); },
  },

  // ── sheets opened from Me ──────────────────────────────────────────────────────────────────────────────────
  {
    screen: 'guest-add', profile: 'eli', states: ['typical', 'error'],
    note: 'Me → Guests → Add a guest: name, a face from 24 emoji, a colour, an optional PIN and how long they stay. Error: a 2-digit PIN ("The PIN is 4 to 8 digits…"). The sheet shows no stored data, so empty/overflow/loading/offline would repeat typical. Adding the guest ends in a toast (not captured).',
    async go(t) {
      await me(t);
      await sheetFrom(t, '#guest-add', '.sheet #gform');
      if (!t.error) return;
      await t.page.fill('.sheet #gname', 'Pastor Tim');
      await t.page.fill('.sheet #gpin', '12');
      await t.tap('.sheet button[type=submit]');
      await waitFn(t, () => { const m = document.querySelector('#gmsg'); return !!m && m.textContent.trim().length > 0; }, null, 3000);
    },
  },
  {
    screen: 'photo', profile: 'eli', states: ['empty', 'typical'],
    note: 'Me → the photo button → "Your photo": Choose a photo (opens the system picker, not capturable), Remove photo (only when a photo is set: typical), Cancel. Nothing else in the sheet depends on data.',
    async go(t) { await me(t); await sheetFrom(t, '#photo-btn', '.sheet [data-act="pick"]'); },
  },
  {
    screen: 'profile-edit', profile: 'eli', states: ['typical', 'overflow'],
    note: 'Me → Admin → Edit on Mae: name, emoji, photo, colour, kind. Overflow: her long name in the title and field. Empty is typical without her photo (no Remove); the sheet opens only once the admin data has loaded, so there is no loading/offline sheet (see me-admin).',
    async go(t) {
      await me(t); await admin(t);
      await scrollTo(t, '#admin');
      await sheetFrom(t, '#admin-body [data-edit="christian"]', '.sheet #pform');
    },
  },
  {
    screen: 'pairing-code', profile: 'eli', states: ['typical', 'error'],
    note: 'Me → Admin → Pairing code → Choose a new code: the code typed twice. Error: the two do not match. (Example strings only; nothing is submitted to the server.) The sheet shows no stored data, so other states would repeat typical.',
    async go(t) {
      await me(t); await admin(t);
      await scrollTo(t, '#admin-body h3', { text: 'Pairing code', card: false });
      await sheetFrom(t, '#rotate-choose', '.sheet #rotform');
      if (!t.error) return;
      await t.page.fill('.sheet #rotcode', 'example-code-one');
      await t.page.fill('.sheet #rotcode2', 'example-code-two');
      await t.tap('.sheet #rotform button[type=submit]');
      await waitFn(t, () => { const m = document.querySelector('#rotmsg'); return !!m && m.textContent.trim().length > 0; }, null, 3000);
    },
  },
  {
    screen: 'pairing-code-new', profile: 'eli', states: ['typical'],
    note: 'Me → Admin → Pairing code → Generate one → (native confirm, accepted by the rig) → the one-time "New pairing code" sheet. The rig answers the rotate call with a placeholder code, so no code is generated and the demo instance keeps its own.',
    async go(t) {
      await me(t); await admin(t);
      await scrollTo(t, '#admin-body h3', { text: 'Pairing code', card: false });
      await t.page.route(u => u.href === t.api + '/api/admin/pairing-code/rotate', route => {
        const cors = { 'Access-Control-Allow-Origin': t.site, 'Access-Control-Allow-Headers': 'Content-Type, X-Device-Token, X-Profile-Token', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS' };
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
        return route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, code: 'demo7xkq' }) });
      });
      t.page.once('dialog', d => d.accept().catch(() => {}));
      await sheetFrom(t, '#rotate-gen', '.sheet .well');
    },
  },
];
