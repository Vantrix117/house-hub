// Area "timer": the Kitchen timer (apps/timer.html) and the shell surfaces that carry a running timer: the pill on every
// tab, the chip in the app viewer's bar, the ringing pill with its toast, and the Kitchen device.
//
// Since batch 6 every timer is its own person-scope row timer:<id> in server time (apps/hub.js hub.timers; seeded by
// seed/timer.mjs: Elizabeth ('mom', PLOT.timerRunningFor) has one 15-min timer with 6:20 left at the reset, overflow three
// timers: one over an hour, one with a long label, one paused; the park variant keeps the old single row timer.active for
// the migration). The app's states: idle (the last length, Start), running (Pause is the primary), paused (Resume), the
// picker opened by New timer, ringing ("Time's up" with the bell, Stop) and ended unseen
// ("Ended 8:37 AM" with OK). Eli never has a timer, so no Eli capture anywhere shows the shell pill.
//
// Clock: the rig fixes the BROWSER clock at the demo instant, but hub.js counts in server time (Date.now() + hub.skew,
// re-measured on every Worker reply) and the rig's Worker clock runs from the demo instant at each reset. So a timer counts
// down by the seconds since the reset (6:20 give or take a few seconds in a shot), and moving the browser clock would change
// nothing; between replies serverNow stands still. A timer reaches 0 here only because the screen script writes its end
// a second before hub.serverNow() (ringing, seen as it ends) or minutes before it (ended unseen), on an isolated database; no app code is touched.
//
// The typical pill on Home and the typical chip over another app are captured by the shell area (shell/home-timer,
// shell/viewer-timer); this area adds their overflow, the pill on the Chat tab and the ringing pill with its toast.
// Not capturable: the sound (Web Audio) and the local "Timer done" notification (needs permission and a service worker).
// Not captured: kiosk (the TV board's timer line is in the tv area); guests (the same view as an adult).
export const area = 'timer';

const ready = { timeout: 6000, polling: 100 };
const P = { app: 'timer', scope: 'person' };

// Open the app and wait until it is live (it has pulled: apps/timer.html's wake(), window.__timer.isLive()).
async function openTimer(t) {
  const f = await t.openApp('timer', { wait: '#go' });
  if (t.loading) return f;                          // the controls stay off and the dial shows its skeleton
  await f.waitForFunction(() => window.__timer && __timer.isLive(), null, ready).catch(() => {});
  return f;
}
// Open Elizabeth's running timer: live, and the primary button is Pause.
async function openRunning(t) {
  const f = await openTimer(t);
  if (t.loading) return f;
  await f.waitForFunction(() => document.getElementById('go').dataset.state === 'pause', null, ready).catch(() => {});
  return f;
}
// Make the timer on the dial (or a new one) end at `endAt = hub.serverNow() + offset` (server time, as the app counts).
const endIn = (f, offset, extra = {}) => f.evaluate(([offset, extra, P]) => {
  const n = hub.serverNow();
  if (extra.id) return hub.timers.put({ label: '', pausedAt: null, remaining: null, ackAt: null, ...extra, endAt: n + offset, startedAt: n + offset - extra.total }, { fresh: true });
  const r = hub.timers.list()[0]; if (!r) return null;
  return hub.timers.put({ ...r, endAt: n + offset });
}, [offset, extra, P]);

// The Chat tab scrolls #views; the shell scrolls it to the bottom once the history is in.
async function chatBottom(t) {
  await t.page.evaluate(() => { const v = document.querySelector('#views'); if (v) v.scrollTop = v.scrollHeight; }).catch(() => {});
  await t.sleep(150);
}

const IPADS = ['ipad-portrait', 'ipad-landscape'];

export const screens = [
  {
    screen: 'idle',
    profile: 'eli',
    states: ['empty', 'typical', 'overflow', 'loading', 'offline'],
    note: "Eli, no timer running: the 5:00 default (empty); his last length, 10:00 (typical; offline opens the same from the cache); 30:00 (overflow). Loading = the skeleton dial with every control off until the first pull.",
    go: openTimer,
  },
  {
    screen: 'running',
    profile: 'mom',
    states: ['typical', 'overflow', 'loading', 'offline'],
    note: "Elizabeth's timers. Typical: one 15-min timer, about 6:00 left; Pause is the primary, +1 min and Reset beside it, her three recents below. Overflow: three timers (the most; New timer is gone): a 2-hour one with 1:44:05 left on the dial, a long-labelled one and a paused Tea, in the list. Offline resumes from the cache. Loading: the skeleton dial.",
    go: openRunning,
  },
  {
    screen: 'paused',
    profile: 'mom',
    states: ['typical'],
    isolate: true,                                  // Pause writes the row (pausedAt, remaining)
    note: "Elizabeth tapped Pause: the row keeps {pausedAt, remaining} so every device shows it paused; the dial says Paused, the primary button is Resume.",
    async go(t) {
      const f = await openRunning(t);
      await t.tapIn(f, '#go');
      await f.waitForFunction(() => document.getElementById('go').dataset.state === 'resume', null, ready).catch(() => {});
    },
  },
  {
    screen: 'new-timer',
    profile: 'mom',
    states: ['typical'],
    note: "Elizabeth tapped New timer while her timer runs: the picker (presets, Custom, the label, recents, Say it, Timer settings) opens in place under the list, her running timer in the list (rescore 6). While a timer is on the dial no preset shows, so none can replace it (UX-TIMER-1).",
    async go(t) {
      const f = await openRunning(t);
      await t.tapIn(f, '#add');
      await f.waitForSelector('#presets:not([hidden])', ready).catch(() => {});
    },
  },
  {
    screen: 'ringing',
    profile: 'mom',
    states: ['typical'],
    isolate: true,                                  // the end is moved on the server
    note: "Elizabeth's timer reached 0 with the app open (its end written 1 s before hub.serverNow(): the browser clock is fixed, so a page sees server time move only when a Worker reply re-measures the skew): \"Time's up\" with the bell, the ring in --timer-done, Stop as the primary button, +1 min beside it. It rings every 15 s until Stop (not capturable).",
    async go(t) {
      const f = await openRunning(t);
      await endIn(f, -1000);
      await f.waitForSelector('body.done', { timeout: 8000 }).catch(() => {});
    },
  },
  {
    screen: 'ended-unseen',
    profile: 'mom',
    states: ['typical'],
    isolate: true,
    note: "A timer that ended while the device was away (written to have ended 3 min ago): it comes to the front ringing; the dial reads \"Ended 8:37 AM\" with the bell and the main button OK, said once (UX-TIMER-3, rescore 6); her running oven timer stays in the list.",
    async go(t) {
      const f = await openRunning(t);
      await endIn(f, -180000, { id: 'rigbread', label: 'bread', total: 600000 });
      await f.waitForSelector('#go[data-state="ok"]', ready).catch(() => {});
    },
  },
  {
    screen: 'migrated',
    profile: 'mom',
    states: ['typical'],
    variant: { typical: 'park' },                   // the park variant keeps the old single row timer.active
    isolate: true,                                  // opening the app writes the migrated row
    note: "The migration: Elizabeth's pre-batch-6 timer.active (the park variant) opens as one running timer, which the app has just moved to timer:m<startedAt> (timer.active removed). It looks like running-typical.",
    go: openRunning,
  },
  {
    screen: 'kid',
    profile: 'ezra',
    states: ['typical'],
    note: "Ezra (kid), no timer: the preset pictures and the big controls (B's kid CSS: 64 px+, the custom time, label, sound and Notify me hidden). It opens on the 5:00 default.",
    go: openTimer,
  },
  {
    screen: 'kid-running',
    profile: 'ezra',
    states: ['typical'],
    isolate: true,
    note: "Ezra tapped the popcorn (3 min) and Start: his own timer runs (kids write their own timer rows and its family mirror); Pause is the primary, with its icon.",
    async go(t) {
      const f = await openTimer(t);
      await t.tapIn(f, '[data-s="180"]'); await t.tapIn(f, '#go');
      await f.waitForFunction(() => document.getElementById('go').dataset.state === 'pause', null, ready).catch(() => {});
    },
  },
  {
    screen: 'kitchen',
    profile: 'kitchen',                             // the rig's kitchen device (seed.mjs KITCHEN_DEVICE, role 'kitchen')
    devices: IPADS,
    states: ['typical'],
    isolate: true,
    note: "The Kitchen iPad (the real kitchen device and profile): the Timer with its own 10-minute timer running; the dial cap lifted and the digits at --fs-glance-1 (UX-TIMER-5).",
    async go(t) {
      const f = await openTimer(t);
      await t.tapIn(f, '[data-s="600"]'); await t.tapIn(f, '#go');
      await f.waitForFunction(() => document.getElementById('go').dataset.state === 'pause', null, ready).catch(() => {});
    },
  },
  {
    screen: 'kitchen-home',
    profile: 'kitchen',
    devices: IPADS,
    states: ['typical'],
    isolate: true,
    note: "The Kitchen Home's timer card: every running family timer from the run: mirror, Elizabeth's with her face (read-only) and the kitchen's own Rice timer.",
    async go(t) {
      await t.goto('#home');
      await t.page.waitForFunction(() => window.hub && hub.isLoaded && hub.isLoaded('timer', 'person'), null, ready).catch(() => {});
      await t.page.evaluate(() => { try { hub.timers.start({ total: 1200000, label: 'Rice' }); } catch {} }).catch(() => {});
      await t.page.waitForSelector('#k-timer .k-timer-row', ready).catch(() => {});
    },
  },
  {
    screen: 'pill',
    profile: 'mom',
    states: ['overflow'],
    note: "The shell's timer pill on Elizabeth's Home tab with her three timers: the most urgent one (the long-labelled 20:00 one), and +2 for the others. At 1024 px and wider it sits right of the sidebar. The typical pill is shell/home-timer.",
    async go(t) {
      await t.goto('#home');
      if (t.loading) return;
      await t.page.waitForSelector('#timer-pill:not([hidden])', { timeout: 6000 }).catch(() => {});
    },
  },
  {
    screen: 'pill-chat',
    profile: 'mom',
    states: ['typical', 'overflow'],
    note: "The pill on Elizabeth's Chat tab: the composer owns the bottom band there, so the pill lifts above it. Typical: her two short exchanges. Overflow: two weeks of her messages fill the log, and the pill floats over the newest bubbles.",
    async go(t) {
      await t.goto('#chat');
      await t.page.waitForFunction(() => { const l = document.querySelector('#chat-log'); return !!l && l.children.length > 0 && !l.querySelector('.skeleton'); }, null, ready).catch(() => {});
      await t.page.waitForSelector('#timer-pill:not([hidden])', { timeout: 6000 }).catch(() => {});
      await chatBottom(t);
    },
    async after(t) { await chatBottom(t); },        // avatars and art load after the first scroll
  },
  {
    screen: 'chip',
    profile: 'mom',
    states: ['overflow'],
    note: "Inside another app (Tally) the running timer is a chip in the viewer bar, not the pill. The typical chip is shell/viewer-timer.",
    async go(t) {
      const f = await t.openApp('tally', { wait: '.dial' });
      await f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, ready).catch(() => {});
      await t.page.waitForSelector('#pill-timer:not([hidden])', { timeout: 5000 }).catch(() => {});
    },
  },
  {
    screen: 'done-toast',
    profile: 'mom',
    states: ['typical'],
    isolate: true,                                  // the end is moved on the server
    note: "The timer reached 0 while Elizabeth was on Home (its end written 1 s before hub.serverNow()): the shell rings, the pill turns to \"Time's up\" with the bell and Stop, and the toast \"Time's up: Timer.\" with Stop (8 s). The sound and the local notification cannot be captured.",
    async go(t) {
      await t.goto('#home');
      await t.page.waitForSelector('#timer-pill:not([hidden])', { timeout: 6000 }).catch(() => {});
    },
    // the toast hides itself after 8 s, so the end is moved only after the rig has settled Home
    async after(t) {
      await endIn(t.page, -1000);
      await t.page.waitForSelector('#hub-toast:not([hidden])', { timeout: 8000 }).catch(() => {});
      await t.page.waitForSelector('#timer-pill.ringing', { timeout: 3000 }).catch(() => {});
      await t.sleep(250);
    },
  },
];
