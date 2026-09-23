// The hub shell (index.html): the gate (pairing, profile picker, PIN pad), Home for each audience, the Apps grid and
// the app viewer. The Chat and Me tabs and the TV board are captured by their own areas.
//
// Every go() only navigates, taps and types. Offline runs go() twice; on the second pass (t.reopened) the page is
// reopened by way of about:blank (a guaranteed full load of the shell from its local cache), and nothing waits for
// the network.
export const area = 'shell';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const wait = (t, sel, timeout = 5000, state = 'visible') => t.page.waitForSelector(sel, { state, timeout }).then(() => true, () => false);
const waitFn = (t, fn, arg, timeout = 5000) => t.page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);

async function open(t, hash = '') {
  if (t.reopened) await t.page.goto('about:blank');
  await t.goto(hash);
}

// Signed-in Home (adult, guest or kid): the hero plus the cards, and (adult/guest) the feed painted from the server.
async function home(t) {
  await open(t, '#home');
  if (!(await wait(t, '#view-home .home-hero', 6000))) return;
  if (t.loading) return;                                                       // data never arrives: capture the skeletons
  await wait(t, '#view-home .glance .gcard', 4000);
  if (t.reopened) { await sleep(300); return; }
  // Home re-renders as each channel of the first pull lands (reminders first, the kids' stars last): wait for the whole
  // pull (hub.sync.lastPull, apps/hub.js:309), then for the feed to replace its skeleton rows (kid Home has no feed)
  await waitFn(t, () => !!(window.hub && hub.sync && hub.sync.lastPull), null, 6000);
  await waitFn(t, () => { const f = document.querySelector('#feed'); return !f || (f.children.length && !f.querySelector('.skeleton')); }, null, 5000);
  await sleep(150);
}

// Scroll the shell's #views so an element sits `pad` px below the top. Screens that scroll call it in go() and again in
// after() (which runs once the rig has settled), so a late re-render above the element cannot leave it mid-screen.
async function scrollTo(t, sel, pad = 16) {
  await t.page.evaluate(([sel, pad]) => {
    const v = document.querySelector('#views'), el = document.querySelector(sel);
    if (!v || !el) return;
    v.scrollTop = Math.max(0, el.getBoundingClientRect().top - v.getBoundingClientRect().top + v.scrollTop - pad);
  }, [sel, pad]);
  await sleep(200);
}

// Scroll #views so the reminders' add field (#remform) sits in the lower third of the screen.
async function remAdd(t) {
  await t.page.evaluate(() => {
    const v = document.querySelector('#views'), el = document.querySelector('#remform');
    if (!v || !el) return;
    v.scrollTop = Math.max(0, el.getBoundingClientRect().top - v.getBoundingClientRect().top + v.scrollTop - v.clientHeight * 0.62);
  });
  await sleep(200);
}

// The profile picker, painted from the server (or the cached list offline).
async function picker(t) {
  await open(t, '');
  if (t.loading) { await wait(t, '#profiles .pcard.skeleton', 4000); return; }
  await wait(t, '#profiles .pcard:not(.skeleton)', 6000);
}

// Tap a profile card on the picker and wait for the PIN pad.
async function toPad(t, id) {
  await picker(t);
  await t.tap(`#profiles .pcard[data-id="${id}"]`);
  await wait(t, '#pad', 4000);
}
async function digits(t, s) { for (const d of s) await t.tap(`#pad [data-d="${d}"]`); }
// Tap Continue and wait for the pad's message line to say something.
async function submitPin(t) {
  await t.tap('#pingo');
  return waitFn(t, () => { const m = document.querySelector('#pinmsg'); return m && m.textContent.trim().length > 0; }, null, 5000);
}

// Open an app in the viewer and wait for its first paint.
async function openViewer(t, id) {
  const f = await t.openApp(id, { wait: 'body' });
  await wait(t, '#viewer.on', 4000, 'attached');
  if (!t.loading && !t.reopened) await f.waitForLoadState('load', { timeout: 5000 }).catch(() => {});
  await sleep(400);
  return f;
}

const HOME_STATES = ['empty', 'typical', 'overflow', 'loading', 'offline'];

export const screens = [
  // ── gate ───────────────────────────────────────────────────────────────────
  // Error states: the Worker allows 10 wrong pairing codes per IP (worker/src/index.js:144) and 5 wrong PINs per profile
  // per device (index.js:241) in 15 min, counted in D1; the rig gives every error capture a fresh database
  // (capture.mjs, groups), so no capture here can trip a limit it does not mean to.
  {
    screen: 'pairing', profile: 'unpaired', states: ['typical', 'error'],
    note: 'First run on a new device: the pairing code form. Error = a wrong code typed and submitted: "That pairing code is not right." under the form. No data states: nothing is loaded before pairing, and a pair attempt offline shows "No connection." on the same message line.',
    async go(t) {
      await open(t, ''); await wait(t, '#pairform', 6000);
      if (!t.error) return;
      await t.tap('#paircode');
      await t.page.fill('#paircode', 'harvest-moon-42');
      await t.tap('#pairform button[type="submit"]');
      await waitFn(t, () => { const m = document.querySelector('#pairmsg'); return m && m.textContent.trim().length > 0; }, null, 6000);
      await t.page.evaluate(() => document.activeElement && document.activeElement.blur());
    },
  },
  {
    // An admin unpaired this device (Me → Admin → Devices → Unpair, on another device): the next data call answers 401
    // device_not_paired (worker/src/auth.js:77), hub.js forgets the device (apps/hub.js:148) and the shell drops to
    // pairing with a message (index.html:771). Emulated at the API edge: /api/data answers that 401.
    screen: 'pairing-unpaired', profile: 'eli', states: ['error'],
    note: 'This device was unpaired while Eli was signed in: the shell drops from Home to the pairing form with "This device was unpaired." (index.html:771).',
    async go(t) {
      await t.failApi('/api/data', { status: 401, error: 'device_not_paired', message: 'This device is not paired with the house.' });
      await open(t, '#home');
      await waitFn(t, () => /unpaired/i.test((document.querySelector('#pairmsg') || {}).textContent || ''), null, 8000);
      await t.page.evaluate(() => document.activeElement && document.activeElement.blur());
    },
  },
  {
    screen: 'picker', profile: null, lastProfile: 'eli', states: HOME_STATES,
    note: 'Who\'s this? One card per profile (Eli was last on this device: ring + "Welcome back"). Empty = the household with no photos and no guests; overflow = long names + four guests (one ended, so hidden); loading = the 8 skeleton cards while /api/profiles is pending; offline = the cached list, which looks exactly like typical (the picker gives no sign it is offline). On iPhone (and iPad landscape in overflow) the centred gate clips its own title (index.html:29); picker-lower shows the rest.',
    go: picker,
  },
  // Where the picker is taller than the screen: its end, with the guest cards. #gate scrolls down fine; it is only the
  // part above the scroll origin that the centred flex column cuts off. The typical picker fits on everything but the
  // iPhones; the overflow one also overflows iPad landscape.
  ...[[['typical'], ['iphone-pwa', 'iphone-safari']], [['overflow'], ['iphone-pwa', 'iphone-safari', 'ipad-landscape']]].map(([states, devices]) => ({
    screen: 'picker-lower', profile: null, lastProfile: 'eli', states, devices,
    note: 'The picker scrolled to its end on the screens where it does not fit: the guest cards (typical: Grandma Jo; overflow: three guests with long names, one with a PIN and one leaving tonight; the guest whose stay ended is not listed).',
    async go(t) { await picker(t); await t.scroll('#gate', 'bottom'); },
    async after(t) { await t.scroll('#gate', 'bottom'); },
  })),
  {
    // Offline, a profile that signs in on tap (a kid) cannot sign in: the message goes to the line above the cards.
    screen: 'picker-tap', profile: null, lastProfile: 'eli', states: ['offline'],
    note: 'Offline, Ezra (a kid, no PIN) tapped on the cached picker: the sign-in fails and "No connection." shows in the message line above the cards (index.html:546). Nothing else changes: the picker still offers every card.',
    async go(t) {
      await picker(t);
      if (!t.reopened) return;                                                  // the warm pass only fills the cache
      await t.tap('#profiles .pcard[data-id="ezra"]');
      await waitFn(t, () => ((document.querySelector('#pickmsg') || {}).textContent || '').trim().length > 0, null, 5000);
    },
  },
  {
    // The session was revoked or ran out (a PIN reset, a guest pass ending): the next data call answers 401
    // profile_session_invalid (worker/src/auth.js:92) and the shell goes back to the picker (index.html:771).
    // Emulated at the API edge: /api/data answers that 401.
    screen: 'picker-signed-out', profile: 'eli', states: ['error'],
    note: 'Eli\'s session stopped working while Home was open: the picker returns with "Please choose your profile again." above the cards (index.html:771).',
    async go(t) {
      await t.failApi('/api/data', { status: 401, error: 'profile_session_invalid', message: 'Please choose your profile again.' });
      await open(t, '#home');
      await waitFn(t, () => /again/i.test((document.querySelector('#pickmsg') || {}).textContent || ''), null, 8000);
      await wait(t, '#profiles .pcard:not(.skeleton)', 5000);
    },
  },
  {
    // A device with no cached profile list that cannot reach the server: the skeletons stay and the message line explains.
    screen: 'picker', profile: null, states: ['error'], localStorage: { 'hub.profiles': '[]' },
    note: 'The picker when /api/profiles fails and the device has no cached list: 8 skeleton cards stay on screen under "No connection."',
    async go(t) {
      await t.ctx.route(u => u.href.startsWith(t.api + '/api/profiles'), r => r.abort('internetdisconnected'));
      await open(t, '');
      await waitFn(t, () => { const m = document.querySelector('#pickmsg'); return m && m.textContent.trim().length > 0; }, null, 6000);
    },
  },
  {
    screen: 'pin-entry', profile: null, lastProfile: 'eli', states: ['typical', 'error', 'offline'],
    note: 'Eli tapped on the picker: the PIN pad. Typical = two digits typed (dots fill in the person\'s colour; Continue stays disabled under 4). Error = a wrong PIN submitted: the dots clear and "Wrong PIN." shows under the pad. Offline = the cached picker, Eli tapped and four digits submitted with no connection: "No connection." (apps/hub.js:137).',
    async go(t) {
      if (t.offline && !t.reopened) { await picker(t); return; }               // warm pass: nothing is submitted online
      await toPad(t, 'eli');
      if (t.state === 'typical') { await digits(t, '48'); return; }
      await digits(t, '2580'); await submitPin(t);
    },
  },
  {
    // The sixth wrong PIN in 15 minutes: the server locks the pad for this profile on this device.
    screen: 'pin-locked', profile: null, lastProfile: 'eli', states: ['error'],
    note: 'After five wrong PINs for Eli on this device: "Too many attempts. Try again in 15 min." (worker/src/auth.js:133).',
    async go(t) {
      await toPad(t, 'eli');
      for (let i = 0; i < 7; i++) {
        await digits(t, '1379'); await submitPin(t);
        const msg = await t.page.textContent('#pinmsg').catch(() => '');
        if (/too many/i.test(msg || '')) break;
      }
    },
  },
  {
    screen: 'pin-create', profile: null, lastProfile: 'eli', states: ['typical', 'error'],
    note: 'Mea (no PIN yet) tapped: "Create your PIN". Typical = two digits typed on the first pass; error = a confirmation that did not match ("Those didn\'t match — start again.", checked on the device, no server call). No PIN is ever saved.',
    async go(t) {
      await toPad(t, 'niece');
      if (!t.error) { await digits(t, '71'); return; }
      await digits(t, '1234'); await t.tap('#pingo');
      await waitFn(t, () => /again/i.test((document.querySelector('#pinhint') || {}).textContent || ''), null, 3000);
      await digits(t, '5678'); await submitPin(t);
    },
  },
  {
    screen: 'pin-confirm', profile: null, lastProfile: 'eli', states: ['typical'],
    note: 'Mea\'s second pass of Create your PIN: four digits chosen and Continue tapped, so the hint reads "Type it again to confirm." (index.html:607); two digits of the confirmation typed. Nothing reaches the server.',
    async go(t) {
      await toPad(t, 'niece');
      await digits(t, '1234'); await t.tap('#pingo');
      await waitFn(t, () => /again/i.test((document.querySelector('#pinhint') || {}).textContent || ''), null, 3000);
      await digits(t, '12');
    },
  },
  {
    screen: 'first-visit', profile: 'eli', states: ['typical'], sw: true, devices: ['ipad-portrait', 'iphone-pwa'],
    note: 'Service worker allowed: the first install on a device. Documents whether the shell\'s "Hub updated — it will use the new version next time it opens." toast (index.html:1695) shows on a first visit, when nothing was updated. It does in most WebKit runs (a race between clients.claim and the installed statechange); when it does not, go() drops the worker and its cache and reloads (up to twice) and logs that to the manifest, so a capture without the toast is possible but rare.',
    async go(t) {
      const toast = () => waitFn(t, () => { const e = document.getElementById('hub-toast'); return e && !e.hidden && /updated/i.test(e.textContent); }, null, 4000);
      await open(t, '#home');
      await wait(t, '#view-home .glance .gcard', 6000);
      // When the race goes the other way there is no toast; make this a first install again (drop the worker and its
      // cache, as clearing site data would, keeping the sign-in) and reload, at most twice. The attempts that showed no
      // toast are logged to the manifest's console lines.
      let tries = 0;
      while (!(await toast()) && tries < 2) {
        tries++;
        await t.page.evaluate(async () => {
          for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
          for (const k of await caches.keys()) await caches.delete(k);
        }).catch(() => {});
        await t.page.goto('about:blank'); await t.goto('#home');
        await wait(t, '#view-home .glance .gcard', 6000);
      }
      const shown = await t.page.evaluate(() => { const e = document.getElementById('hub-toast'); return !!(e && !e.hidden && /updated/i.test(e.textContent)); });
      if (tries || !shown) await t.page.evaluate(([n, ok]) => console.warn('first-visit: ' + n + ' install(s) without the Hub updated toast' + (ok ? ', shown on the next' : ', never shown')), [tries + (shown ? 0 : 1), shown]);
    },
  },

  // ── Home ───────────────────────────────────────────────────────────────────
  {
    screen: 'home', profile: 'eli', states: HOME_STATES,
    note: 'Eli\'s Home, top: hero (date, greeting, summary line) and the glance cards (Today\'s reading, In the fridge, Prayer, Kids). Loading = /api/data pending: only the feed shows skeleton rows — the cards and the hero show their empty wording, because hub.sync.state starts as offline (apps/hub.js:51) and index.html:1158 counts that as pulled. Offline = the cached copy.',
    go: home,
  },
  {
    screen: 'home-lower', profile: 'eli', states: HOME_STATES,
    note: 'The same Home scrolled to Reminders (with the add field) and the "Around the house" feed.',
    async go(t) { await home(t); await scrollTo(t, '#view-home .two-col'); },
    async after(t) { await scrollTo(t, '#view-home .two-col'); },
  },
  {
    screen: 'home-bottom', profile: 'eli', states: ['typical', 'overflow'],
    note: 'Eli\'s Home scrolled to the end: the end of the feed with "Show more" (shown once a full page of 30 lines is loaded, index.html:954). At 1024 px and wider the Reminders column ends beside it; in one column the reminders sit above (home-rem-add).',
    async go(t) { await home(t); await t.scroll('#views', 'bottom'); },
    async after(t) { await t.scroll('#views', 'bottom'); },
  },
  {
    // One column (phones, iPad portrait): the 15 long reminders push the add field far down; bring it to the lower third.
    screen: 'home-rem-add', profile: 'eli', states: ['overflow'], devices: ['ipad-portrait', 'iphone-pwa'],
    note: 'Eli\'s Home in overflow, scrolled to the end of the 15 long reminders: the last rows and the "Add a reminder for the house" field (maxlength 140) with its + button, the feed starting below.',
    async go(t) { await home(t); await remAdd(t); },
    async after(t) { await remAdd(t); },
  },
  {
    screen: 'home-kid', profile: 'ezra', states: HOME_STATES,
    note: 'Ezra\'s kid Home: big hero, "Let\'s play" button to his apps, the Stars card and the read-only Reminders (no add field, no Done).',
    go: home,
  },
  {
    screen: 'home-kid-lower', profile: 'ezra', states: ['typical', 'overflow'],
    note: 'Ezra\'s Home scrolled to the read-only Reminders card (long list in overflow).',
    async go(t) { await home(t); await scrollTo(t, '#view-home .stack-lg > .card:last-child'); },
    async after(t) { await scrollTo(t, '#view-home .stack-lg > .card:last-child'); },
  },
  {
    screen: 'home-kid-park', profile: 'ezra', states: ['typical'], variant: { typical: 'park' },
    note: 'Park day on the kid Home: the At-the-park card joins the Stars card (only when the park-map seed wrote fresh family locations).',
    async go(t) { await home(t); if (await wait(t, '.park-card', 2000)) await scrollTo(t, '#view-home .glance'); },
    async after(t) { if (await wait(t, '.park-card', 500)) await scrollTo(t, '#view-home .glance'); },
  },
  {
    screen: 'home-guest', profile: 'guest-grandmajo', states: ['typical'],
    note: 'Guest Grandma Jo (no PIN, signed in on tap): the adult Home with her own empty F260 and prayer cards, the family fridge, kids, reminders and feed.',
    go: home,
  },
  {
    screen: 'home-park', profile: 'eli', states: ['typical'], variant: { typical: 'park' },
    note: 'Park day: the At the park card (who is at Dollywood, last seen) scrolled into view.',
    async go(t) { await home(t); if (await wait(t, '.park-card', 2000)) await scrollTo(t, '.park-card', 24); },
    async after(t) { if (await wait(t, '.park-card', 500)) await scrollTo(t, '.park-card', 24); },
  },
  {
    screen: 'home-timer', profile: 'mom', states: ['typical'],
    note: 'Elizabeth\'s Home while her kitchen timer runs: the shell\'s floating timer pill (bottom centre; right of the sidebar at 1024+).',
    async go(t) { await home(t); await wait(t, '#timer-pill:not([hidden])', 4000); },
  },
  {
    screen: 'home-pull', profile: 'eli', states: ['typical'], devices: ['ipad-portrait', 'ipad-landscape', 'iphone-pwa'],
    note: 'Pull-to-refresh armed (touch only): a synthetic 130 px downward touch drag on #views at the top shows the arrow indicator. The content does not rubber-band in the capture; check the real gesture on the iPad.',
    async go(t) {
      await home(t);
      await t.page.evaluate(() => {
        const v = document.querySelector('#views');
        const fire = (type, y) => {
          const ev = new Event(type, { bubbles: true, cancelable: false });
          const touch = { identifier: 1, target: v, clientX: 200, clientY: y, pageX: 200, pageY: y };
          Object.defineProperty(ev, 'touches', { value: type === 'touchend' ? [] : [touch] });
          Object.defineProperty(ev, 'changedTouches', { value: [touch] });
          v.dispatchEvent(ev);
        };
        fire('touchstart', 120); fire('touchmove', 190); fire('touchmove', 250);
      });
      await wait(t, '#ptr.arm', 2000, 'attached');
      await sleep(450);                                                         // the arrow springs down (--dur-3)
    },
  },

  // ── Apps grid and the viewer ──────────────────────────────────────────────
  {
    screen: 'apps', profile: 'eli', states: HOME_STATES,
    note: 'Eli\'s Apps tab: the tile grid with the wide F260 tile (ring + week/next/streak) and the Larder badge. Loading = the F260 tile\'s "loading" skeleton; empty = "Start week 1" and no badge.',
    async go(t) {
      await open(t, '#apps');
      await wait(t, '#grid .tile', 6000);
      if (t.loading || t.reopened) { await sleep(300); return; }
      await waitFn(t, () => !document.querySelector('#grid .skeleton'), null, 5000);
    },
  },
  {
    screen: 'apps-kid', profile: 'ezra', states: ['typical'],
    note: 'Ezra\'s Apps: only the apps whose visibleTo lists him, in the bigger kid tiles.',
    async go(t) { await open(t, '#apps'); await wait(t, '#grid .tile', 6000); },
  },
  {
    screen: 'apps-guest', profile: 'guest-grandmajo', states: ['typical'],
    note: 'Grandma Jo\'s Apps: every app open to any household adult (guest rule, index.html:480).',
    async go(t) { await open(t, '#apps'); await wait(t, '#grid .tile', 6000); await waitFn(t, () => !document.querySelector('#grid .skeleton'), null, 5000); },
  },
  {
    screen: 'app-blocked', profile: 'ezra', states: ['typical'],
    note: 'A kid following a link to an app he cannot see (#f260): the Apps tab with the toast "That app is not available for this profile." (index.html:715).',
    async go(t) {
      await open(t, '#apps'); await wait(t, '#grid .tile', 6000); await sleep(600);
      // follow the link now so the 2.2 s toast is still up when the rig shoots
      await t.page.evaluate(() => { location.hash = '#f260'; });
      await wait(t, '#hub-toast:not([hidden])', 2000);
    },
  },
  {
    screen: 'viewer', profile: 'eli', states: ['typical'],
    note: 'An app open in the viewer (Tally counter): the slim glass bar with Hub back, the app name (opens Switch app) and reload.',
    async go(t) { await openViewer(t, 'tally'); },
  },
  {
    screen: 'viewer-timer', profile: 'mom', states: ['typical'],
    note: 'Elizabeth in another app (Tally counter) while her kitchen timer runs: the timer chip in the viewer bar instead of the floating pill.',
    async go(t) { await openViewer(t, 'tally'); await wait(t, '#pill-timer:not([hidden])', 4000); },
  },
  {
    screen: 'switch-app', profile: 'eli', states: ['typical'],
    note: 'In the viewer (Tally counter), the app name tapped: the Switch app sheet listing Eli\'s other apps, plus Home and Me.',
    async go(t) {
      await openViewer(t, 'tally');
      await t.tap('#pill-name');
      await wait(t, '.sheet-backdrop .sheet', 3000);
      await sleep(350);                                                         // the sheet slides up
    },
  },
  {
    screen: 'switch-app-kid', profile: 'ezra', states: ['typical'],
    note: 'Ezra in the Tally counter, the app name tapped: the Switch app sheet lists only his other apps (apps.json visibleTo), plus Home and Me.',
    async go(t) {
      await openViewer(t, 'tally');
      await t.tap('#pill-name');
      await wait(t, '.sheet-backdrop .sheet', 3000);
      await sleep(350);
    },
  },
];
