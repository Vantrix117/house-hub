// Verses (apps/verses.html): the Leitner memory-verse trainer over the person's F260 memorised verses. The verses and their
// recall rows are F260's (seed/f260.mjs: Eli has a few due today); seed/verses.mjs adds the day-streak log and the summary.
// Kids train the family week's two verses (Kid Verse's week 38) with big buttons and no stats. Not visible to the kiosk.
import { DEMO_TIME } from '../seed/story.mjs';
export const area = 'verses';

// Open Verses and wait until render() has picked a card, the all-done card or the empty card (apps/verses.html:318-320).
const VIEW = '#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])';
// Batch 5 (rescore follow-up): the rig's WebKit has no MediaRecorder, so Verses' "Record yourself" row (IMP-VERSES-I1,
// adults) never showed in the captures and every adult card was about 85 px shorter than on a phone. Minimal stand-ins
// make the row appear as a device does; getUserMedia is replaced too, so no capture ever asks for a real microphone
// (nothing here records: the captures never tap the button). Kids never get the row whatever the browser has.
const fakeRecorder = () => {
  if (!/\/apps\/verses\.html/.test(location.pathname)) return;
  if (typeof window.MediaRecorder !== 'function') window.MediaRecorder = class { constructor(stream) { this.stream = stream; this.state = 'inactive'; this.mimeType = 'audio/webm'; } start() { this.state = 'recording'; } stop() { this.state = 'inactive'; if (this.onstop) this.onstop(); } };
  const md = navigator.mediaDevices || {};
  try { if (!navigator.mediaDevices) Object.defineProperty(Navigator.prototype, 'mediaDevices', { get: () => md, configurable: true }); } catch {}
  md.getUserMedia = async () => (typeof MediaStream === 'function' ? new MediaStream() : {});
};
async function open(t) {
  await t.ctx.addInitScript(fakeRecorder);
  const f = await t.openApp('verses');
  if (t.loading) return f;
  await f.waitForSelector(VIEW, { timeout: 8000 }).catch(() => {});
  await t.sleep(200);
  return f;
}
const visible = (f, sel) => f.locator(sel).first().isVisible().catch(() => false);
// Tap Show and wait for the rating buttons (apps/verses.html:364, 328-329).
async function reveal(t, f) {
  if (!(await visible(f, '#trainer'))) return;
  if (await visible(f, '#show')) await t.tap(f.locator('#show'));
  await f.waitForSelector('#act-rate:not([hidden])', { timeout: 3000 }).catch(() => {});
}
// Rate every card in the queue "Got it" until the all-done card shows (apps/verses.html:290-306); at most `max` cards.
// The ratings stay on this device: its data uploads (POST /api/data/<app>/batch) fail as if the connection dropped and
// hub.js keeps them queued. Without that, the other devices of the same run, rating the same shared queue at the same
// moment, overwrite each other: the rig freezes the browser clock, so hub.js stamps every write with the time of its last
// pull and last-write-wins picks a device at random, sometimes putting a rated card back (a rig artefact, not an app bug).
// Each rating shows a toast for 2.2 s (apps/hub.js:431-434: #hub-toast, hidden again by a timer), so wait until the
// last one has gone before the shot.
const keepOnDevice = t => t.ctx.route(u => u.href.startsWith(t.api) && /^\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
const toastGone = f => f.waitForFunction(() => { const el = document.getElementById('hub-toast'); return !el || el.hidden; }, null, { timeout: 3500 }).catch(() => {});
// One "Got it" by the keyboard shortcuts (apps/verses.html:373-378: Enter reveals, 3 rates Got it). It runs the same
// rate() a tap does, without a tap's actionability waits, so even six ratings take well under a second. Keys go to the
// focused frame, so the app's document gets focus first (focusing #show; its own Enter handling only reveals, like the
// shortcut). The screens that show the reveal or a rating (revealed, rated, kid-revealed) tap the real buttons instead.
async function rateGot(t, f) {
  const n = await f.evaluate(() => document.getElementById('ref').textContent).catch(() => '');
  await t.page.keyboard.press('Enter');
  await t.page.keyboard.press('3');
  // batch 5: after a rating the card stays for 400 ms and its rating row ignores taps (#trainer.rated, P3-VERSES-12), then
  // the next card comes in; wait that out before judging whether the keys landed (a no-op on the pre-batch-5 page)
  await f.waitForFunction(r => { const tr = document.getElementById('trainer'); return !tr.classList.contains('rated') && (tr.hidden || document.getElementById('ref').textContent !== r); }, n, { timeout: 1500 }).catch(() => {});
  // fall back to taps if the keys did not land (the card on top did not change)
  if (await visible(f, '#trainer') && await f.evaluate(r => document.getElementById('ref').textContent === r, n).catch(() => false)) {
    await reveal(t, f); await t.tap(f.locator('#act-rate [data-rate="got"]'));
  }
}
const focusApp = f => f.focus('#show', { timeout: 2000 }).catch(() => {});
async function rateAll(t, f, max = 8) {
  await keepOnDevice(t);
  await focusApp(f);
  for (let i = 0; i < max && await visible(f, '#trainer'); i++) await rateGot(t, f);
  await f.waitForSelector('#done:not([hidden])', { timeout: 3000 }).catch(() => {});
  await toastGone(f);
}
// Rate cards "Got it" (kept on the device) until one whose verse text F260 has on file is on top (apps/verses.html:326).
// Typical: Eli's first due card (Luke 14:26-27) has none, his second (John 17:3, 109 characters) has. Overflow: the
// seventh due card is Matthew 28:18-20 with 352 characters of KJV text, the long-text case. Then wait out the toast.
async function toTextCard(t, f, max = 8) {
  await keepOnDevice(t);
  await focusApp(f);
  for (let i = 0; i < max && await visible(f, '#trainer') && !(await visible(f, '#text')); i++) await rateGot(t, f);
  await toastGone(f);
}

export const screens = [
  {
    screen: 'trainer',
    profile: 'eli',
    states: ['empty', 'typical', 'overflow', 'loading', 'offline'],
    note: 'Eli\'s trainer: the card for the first due verse (reference, box chip, Read aloud / Show), then his boxes and the Due today / Coming up queues. Empty = no memorised verses (the "Nothing to train yet" card); overflow = many due.',
    async go(t) { await open(t); },
  },
  {
    screen: 'trainer-stalled',
    profile: 'eli',
    states: ['loading'],
    loadingWait: 400,
    note: 'Eli\'s first open with no cache on a slow connection, about 7 s in: hub.ready stops waiting after 6 s (apps/hub.js:336-337) and the trainer renders from an empty cache. "Eli · all done" over "Nothing to train yet", although he has 64 memorised verses and 3 due. writeSummary (apps/verses.html:239-245) also queues a { total: 0 } summary. Loading only; the 1.2 s moment is trainer-loading.',
    async go(t) {
      await t.ctx.addInitScript(fakeRecorder);
      const f = await t.openApp('verses');
      await f.waitForSelector(VIEW, { timeout: 9000 }).catch(() => {});
      await t.sleep(200);
    },
  },
  {
    screen: 'revealed',
    profile: 'eli',
    states: ['typical', 'overflow'],
    note: 'After tapping Show on the first due card, which has no verse text on file: the honesty hint and Not yet / Almost / Got it. Overflow: the long name and 20 to go. No empty (no card to reveal); loading/offline match the trainer captures.',
    async go(t) { const f = await open(t); await reveal(t, f); },
  },
  {
    screen: 'text-veiled',
    profile: 'eli',
    states: ['typical', 'overflow'],
    note: 'A card whose verse text F260 has on file, reached by rating the cards before it Got it on the device: the text sits blurred under the reference until Show. Typical: John 17:3 (2 to go). Overflow: Matthew 28:18-20, 352 characters, after six ratings (14 to go). No empty/loading/offline: needs a live queue and on-device ratings.',
    async go(t) { const f = await open(t); await toTextCard(t, f); },
  },
  {
    screen: 'text-revealed',
    profile: 'eli',
    states: ['typical', 'overflow'],
    note: 'The same card after Show: the verse text (KJV, from F260) unblurred, "How did it go?" and the three ratings. Overflow is the long-text case: the card grows past its fixed min-height. States as for text-veiled.',
    async go(t) { const f = await open(t); await toTextCard(t, f); await reveal(t, f); await t.sleep(300); },
  },
  {
    screen: 'rated',
    profile: 'eli',
    states: ['typical'],
    note: 'The moment after rating: Eli rated his first due card (Luke 14:26-27) "Got it" (kept on the device), so the toast "Got it — Luke 14:26-27 moves to box 4" shows at the bottom over the next card, John 17:3, and the pill reads 2 to go (apps/verses.html:290-306). Typical only: a one-off moment.',
    async go(t) {
      const f = await open(t);
      await keepOnDevice(t);
      await reveal(t, f);
      await t.tap(f.locator('#act-rate [data-rate="got"]'));
      await f.waitForFunction(() => { const el = document.getElementById('hub-toast'); return el && !el.hidden && /^Got it/.test(el.textContent); }, null, { timeout: 3000 }).catch(() => {});
    },
  },
  {
    screen: 'overdue',
    profile: 'eli',
    states: ['typical'],
    note: 'Eli comes back on Friday 25 Sep after three days away (the browser clock moved on 3 days; the data is typical): 25 to go, scrolled to the stats (the day streak back to 0) and a Due today list that starts with verses "3 days overdue" and "2 days overdue" in the late colour before the ones due today. The seeds have no overdue verse on the demo Tuesday, so this is the only capture of the late styling. Typical only.',
    async go(t) {
      await t.clockTo(Date.parse(DEMO_TIME) + 3 * 86400000);
      const f = await open(t);
      if (t.loading) return;
      await f.evaluate(() => { const el = document.querySelector('#stats'); if (el) document.scrollingElement.scrollTop = Math.max(0, el.getBoundingClientRect().top + document.scrollingElement.scrollTop - 12); }).catch(() => {});
      await t.sleep(250);
    },
  },
  {
    screen: 'done',
    profile: 'eli',
    states: ['typical'],
    note: 'All reviewed today: the capture rates each of Eli\'s 3 due cards "Got it" (kept on the device), so "All done for today · N reviews today", Practise one anyway, the stats and an empty Due today queue show. Typical only: overflow would need 20 ratings, and empty/loading/offline have no queue to finish.',
    async go(t) { const f = await open(t); await rateAll(t, f); },
  },
  {
    screen: 'nothing-due',
    profile: 'mom',
    states: ['typical'],
    note: 'Elizabeth has memorised verses but none is due today and she has not rated any yet: "Nothing due today", Next up …, Practise one anyway, her boxes and Coming up. Typical only: it is a data situation, not a mode; loading/offline look like the trainer captures.',
    async go(t) { await open(t); },
  },
  {
    screen: 'practise-anyway',
    profile: 'mom',
    states: ['typical'],
    note: 'Elizabeth, with nothing due, taps "Practise one anyway": the next verse to come due (Exodus 20:1-3, box 5, due tomorrow) goes on the card as "Week 8 · verse 1 · last one", and the Due today list shows it with its "tomorrow" label (apps/verses.html:307, 366-371). Nothing is rated, so nothing is written. Typical only.',
    async go(t) {
      const f = await open(t);
      if (await visible(f, '#again')) await t.tap(f.locator('#again'));
      await f.waitForSelector('#trainer:not([hidden])', { timeout: 3000 }).catch(() => {});
      await t.sleep(200);
    },
  },
  {
    screen: 'kid',
    profile: 'ezra',
    states: ['empty', 'typical', 'overflow', 'offline'],
    note: 'Ezra (kid): the family week\'s first verse, big type and 64 px buttons, no stats or queue. Empty: no family week set, so the trainer falls back to week 1 (Genesis 1:27). Overflow: the long name in the pill. No loading: the same blank page as trainer-loading.',
    async go(t) { await open(t); },
  },
  {
    screen: 'kid-revealed',
    profile: 'ezra',
    states: ['typical'],
    note: 'Ezra after Show: the three rating buttons at kid size (stacked on a phone), under adult copy, with nothing revealed (kids have no verse text). Typical only: the other states look like the kid screen.',
    async go(t) { const f = await open(t); await reveal(t, f); },
  },
  {
    screen: 'kid-done',
    profile: 'ezra',
    states: ['typical'],
    note: 'Ezra after rating both of the week\'s verses (kept on the device): "All done for today" with Practise again. Typical only: the other states look the same once rated.',
    async go(t) { const f = await open(t); await rateAll(t, f, 4); },
  },
];
