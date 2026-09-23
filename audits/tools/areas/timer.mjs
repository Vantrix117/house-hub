// Area "timer": the Kitchen timer (apps/timer.html) and the shell surfaces that carry a running timer (index.html:773-828):
// the pill on every tab, the chip in the app viewer's bar and the "Timer done" toast.
//
// The app is one view in four modes: idle (dial on the last preset, Start), running (ring + countdown, Pause), paused
// (the remaining time, Start again; pause clears timer.active, apps/timer.html:114) and done (danger ring, blinking 0:00,
// apps/timer.html:12, 35-39). Data: app_data(person, 'timer', 'timer.active' = { endAt, total, startedAt } | 'lastPreset'),
// seeded by seed/timer.mjs. Elizabeth ('mom', PLOT.timerRunningFor) has a 15-min timer with 6:20 left (overflow: a 2-hour
// one with 104:05 left). Eli never has one, so no Eli capture anywhere shows the shell pill.
//
// The rig fixes the browser clock at the demo instant, so a running timer never counts down in a capture. The done state
// and the done toast are reached by moving the fixed clock 1.5 s past endAt from the screen script (t.clockTo), which is
// what waiting for the timer to run out does; no app code is touched. Pause and finish clear Elizabeth's timer.active on
// the server, so those screens are isolated (a fresh database per capture) and never take the running timer away from
// the captures that follow.
//
// The typical pill on Home and the typical chip over another app are already captured by the shell area
// (shell/home-timer, shell/viewer-timer); this area adds their overflow, the pill on the Chat tab and the done toast.
// Not capturable: the beep (Web Audio, apps/timer.html:93-101, index.html:788-796) and the local "Timer done"
// notification (index.html:797-803, needs permission and a service worker).
// Not captured: kiosk (the shell lists no apps for the kiosk, index.html:479, and it cannot write a timer); guests (the
// same view as an adult: the app shows no name); error (the app has no error UI of its own).
export const area = 'timer';

const ready = { timeout: 6000, polling: 100 };

// Open the app and wait until hub.ready() has resolved and it has painted from data: show() writes the ring's --p as
// toFixed(4) (apps/timer.html:86), so it no longer reads the markup's '1'; a resumed timer flips the button to Pause (:106).
async function openTimer(t) {
  const f = await t.openApp('timer', { wait: '#go' });
  if (t.loading) return f;                          // hub.ready() waits on the held first pull: the bare markup stays
  await f.waitForFunction(() => {
    const ring = document.querySelector('#dial .ring');
    return (ring && ring.style.getPropertyValue('--p') !== '1') || document.getElementById('go').textContent === 'Pause';
  }, null, ready).catch(() => {});
  return f;
}

// Open Elizabeth's running timer and wait for it to resume (Pause showing, apps/timer.html:106, 127-129).
async function openRunning(t) {
  const f = await t.openApp('timer', { wait: '#go' });
  if (t.loading) return f;
  await f.waitForFunction(() => document.getElementById('go').textContent === 'Pause', null, ready).catch(() => {});
  return f;
}

// The running timer's endAt as the page sees it (seeded at the demo instant + 6:20).
async function endAtIn(frameOrPage) {
  const v = await frameOrPage.evaluate(() => {
    try { const a = window.hub.get('timer.active', { app: 'timer', scope: 'person' }); return a && a.endAt; } catch { return null; }
  }).catch(() => null);
  return Number(v) || 0;
}

// The Chat tab scrolls #views; the shell scrolls it to the bottom once the history is in (scrollChat, index.html:1438).
async function chatBottom(t) {
  await t.page.evaluate(() => { const v = document.querySelector('#views'); if (v) v.scrollTop = v.scrollHeight; }).catch(() => {});
  await t.sleep(150);
}

export const screens = [
  {
    screen: 'idle',
    profile: 'eli',
    states: ['empty', 'typical', 'overflow', 'loading', 'offline'],
    note: "Eli, no timer running: the 5:00 default (empty); his last preset, 10:00 (typical; offline opens the same from the cache and shows no offline indicator); 30:00, the last chip (overflow; the view has no names or lists to overflow). Loading = the bare markup (5:00, 5 min chip) while hub.ready() waits, which looks like empty.",
    go: openTimer,
  },
  {
    screen: 'running',
    profile: 'mom',
    states: ['typical', 'overflow', 'loading', 'offline'],
    note: "Elizabeth's running timer: 15 min with 6:20 left (typical; offline resumes it from the cache and looks the same, with no offline indicator); a 2-hour one with 104:05 left (overflow; the presets stop at 30 min, but chat's set_data can write any timer record). Loading shows the idle 5:00 markup although a timer is running. No empty: with no data nothing is running (that is idle-empty).",
    go: openRunning,
  },
  {
    screen: 'paused',
    profile: 'mom',
    states: ['typical'],
    isolate: true,                                  // Pause clears timer.active on the server (apps/timer.html:114)
    note: "Elizabeth tapped Pause at 6:20: the dial keeps 6:20 and the button is back to Start. timer.active is cleared (apps/timer.html:114), so the pill disappears on every device and there is no \"paused\" record to resume from.",
    async go(t) {
      const f = await openRunning(t);
      await t.tapIn(f, '#go');
      await f.waitForFunction(() => document.getElementById('go').textContent === 'Start', null, { timeout: 3000, polling: 100 }).catch(() => {});
    },
  },
  {
    screen: 'done',
    profile: 'mom',
    states: ['typical'],
    isolate: true,                                  // finish() clears timer.active on the server (apps/timer.html:102)
    note: "Elizabeth's timer ran out with the app open (the fixed clock moved 1.5 s past endAt): danger ring, 0:00 in danger red (it blinks in the app; captured on its first frame), the app's own beep. timer.active is cleared.",
    async go(t) {
      const f = await openRunning(t);
      const endAt = await endAtIn(f);
      if (!endAt) return;
      await t.clockTo(endAt + 1500);
      await f.waitForSelector('body.done', { timeout: 3000 }).catch(() => {});
    },
  },
  {
    screen: 'kid',
    profile: 'ezra',
    states: ['typical'],
    note: "Ezra (kid): the adult view. The timer has no kid rules of its own (no data-kind CSS, no visibleTo); only design.css's kid tokens (--tap 64 px, bigger type, apps/design.css:280-284) make the chips and buttons larger. He has no timer data, so it opens on 5:00.",
    go: openTimer,
  },
  {
    screen: 'pill',
    profile: 'mom',
    states: ['overflow'],
    note: "The shell's timer pill on Elizabeth's Home tab (index.html:404, 813-823) with a three-digit minute count, 104:05, beside her long name. At 1024 px and wider it sits right of the sidebar. The typical 6:20 pill is shell/home-timer.",
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
    note: "The pill on Elizabeth's Chat tab: the composer owns the bottom band there, so the pill lifts above it (index.html:356-358; --chat-h is measured in showTab, :639). Typical: her two short exchanges, so the pill sits in the empty space above the composer (6:20). Overflow: two weeks of her messages fill the log, and the pill (104:05) floats over the newest bubbles at the bottom of the scrolled history. The Apps and Me tabs place it as Home does.",
    async go(t) {
      await t.goto('#chat');
      // the history replaces the skeleton bubble (the same wait as the shell's chat screens, areas/shell-me.mjs)
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
    note: "Inside another app (Tally) the running timer is a chip in the viewer bar (index.html:410, 821), not the pill: 104:05 beside the app name in the narrow bar. The typical 6:20 chip is shell/viewer-timer.",
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
    isolate: true,                                  // finishTimer() clears timer.active on the server (index.html:809)
    note: 'The timer ran out while Elizabeth was on Home (the fixed clock moved 1.5 s past endAt): the shell hides the pill and shows "Timer done — 15:00 is up." for 4 s (index.html:804-812). Its beep and local notification cannot be captured.',
    async go(t) {
      await t.goto('#home');
      await t.page.waitForSelector('#timer-pill:not([hidden])', { timeout: 6000 }).catch(() => {});
    },
    // The toast hides itself after 4 s (index.html:811, apps/hub.js:433), so the clock moves only after the rig has
    // settled Home, and the shot follows as soon as the toast is up rather than after another settle.
    async after(t) {
      const endAt = await endAtIn(t.page);
      if (!endAt) return;
      await t.clockTo(endAt + 1500);
      await t.page.waitForSelector('#hub-toast:not([hidden])', { timeout: 3000 }).catch(() => {});
      await t.page.waitForSelector('#timer-pill', { state: 'hidden', timeout: 1500 }).catch(() => {});
      await t.sleep(250);
    },
  },
];
