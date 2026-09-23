// F260 Reading Plan (apps/f260.html): person scope, adults only (apps.json visibleTo: eli, christian, mom, dad, niece;
// guests see it too). Data comes from seed/f260.mjs. The app scrolls inside the shell's #frame; at ≥1024 px the plan is two
// panes (Today across the top, a sticky side column that scrolls on its own, weeks on the right), below that one column.
//
// Screens that tap something which writes (Done, reading mode, text size) block the API writes for that capture only
// (noWrites), so the next capture of the same group still starts from the seeded data. The app applies the write
// locally at once, so the screen looks exactly as it does for a real tap.
//
// States: loading and offline are captured on "today" only. Until hub.ready resolves nothing below the static page
// exists (so every screen's loading picture is today's), and F260 has no offline UI of its own (offline is the cached
// plan, pixel for pixel the typical one). Screens reached by tapping are not captured offline for the same reason.
export const area = 'f260';

const READY = '#todayTitle:not(:empty)';
const ALL = ['empty', 'typical', 'overflow'];

async function open(t) { return t.openApp('f260', { wait: READY }); }
const $ = (f, sel) => f.locator(sel).first();
// scroll an element into view; scrollIntoView also scrolls the wide layout's sticky side column
async function reveal(t, f, sel, block = 'start') {
  await f.evaluate(([s, b]) => { const el = document.querySelector(s); if (el) el.scrollIntoView({ block: b, inline: 'nearest', behavior: 'instant' }); }, [sel, block]);
  await t.sleep(200);
}
async function toTop(t, f) { await f.evaluate(() => { window.scrollTo({ top: 0, behavior: 'instant' }); const s = document.querySelector('.side'); if (s) s.scrollTop = 0; }); await t.sleep(150); }
async function waitOn(f, sel, timeout = 3000) { await f.waitForSelector(sel, { timeout }).catch(() => {}); }
// the capture's own writes never reach the server (see the header); reads still pass
async function noWrites(t) {
  await t.ctx.route(u => u.href.startsWith(t.api + '/api/') && !u.href.startsWith(t.api + '/api/media/'),
    r => r.request().method() === 'GET' ? r.fallback() : r.abort());
}
async function settings(t, f) {
  if (!(await f.locator('#sheet.on').count())) await t.tap($(f, '#settingsBtn'));
  await waitOn(f, '#sheet.on');
}

// ── the HEAR journal, unlocked for one capture ──────────────────────────────────────────────────────────────────
// No vault is seeded (it is encrypted). These screens set a passcode through the app's own "Set a journal passcode"
// dialog, then type entries, with writes blocked (noWrites): the vault lives only in that capture's browser, so every
// capture of the group starts again from "no passcode". The passcode is a throwaway demo value, typed and never stored.
const PASS = '2468';
async function setPass(t, f) {
  await waitOn(f, '#pass.on');
  // The dialog focuses #pass1 50 ms after it opens (apps/f260.html:1143). Typing before that lets the focus move in the
  // middle of filling #pass2, so the second entry lands in #pass1 and the passcodes "don't match": wait it out.
  await t.sleep(150);
  await f.fill('#pass1', PASS);
  await f.fill('#pass2', PASS);
  await t.tap($(f, '#passOk'));
  await f.waitForSelector('#pass.on', { state: 'detached', timeout: 5000 }).catch(() => {});   // PBKDF2 (200k) then close
  if (await f.locator('#pass.on').count()) throw new Error('passcode dialog still open: ' + ((await f.textContent('#passErr')) || 'no message'));
  await t.sleep(150);
}
// the current week's day ids, e.g. ["38-0", …, "38-4"], and the last one already read (else the first)
const weekDays = f => f.evaluate(() => [...document.querySelectorAll('.week.current .day')].map(d => d.dataset.day));
const lastRead = f => f.evaluate(() => { const d = [...document.querySelectorAll('.week.current .day.done')].pop() || document.querySelector('.week.current .day'); return d && d.dataset.day; });
// Type one HEAR entry into a day's panel (opening it first); blurring the last field saves it, as leaving the field does.
async function writeEntry(t, f, id, e) {
  if (!(await f.locator(`#jr-${id}.on`).count())) await t.tap($(f, `[data-jr="${id}"]`), { force: true });   // force: skip the slow stability waits
  await waitOn(f, `#jr-${id}.on textarea`);
  for (const k of ['h', 'e', 'a', 'r']) if (e[k]) await f.fill(`#jf-${id}-${k}`, e[k]);
  await f.evaluate(() => document.activeElement && document.activeElement.blur());
  await t.sleep(80);
}
// scroll so an element sits just under the current week's sticky header
async function revealBelowHead(t, f, sel) {
  await f.evaluate(s => {
    const el = document.querySelector(s); if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: 'instant' });
    const head = document.querySelector('.week.current .wk-head');
    window.scrollBy({ top: -((head && head.offsetHeight) || 0) - 8, behavior: 'instant' });
  }, sel);
  await t.sleep(200);
}
// Set a passcode from the current week's first HEAR button, type Eli's two entries for this week, open the Journal tab.
async function typedJournal(t, f) {
  const ids = await weekDays(f);
  await reveal(t, f, '.week.current');
  await t.tap($(f, `[data-jr="${ids[0]}"]`));
  await setPass(t, f);
  for (let i = 0; i < ENTRIES.typical.length; i++) await writeEntry(t, f, ids[i], ENTRIES.typical[i]);
  await t.tap($(f, '#tabJournal'));
  await waitOn(f, '#jList .jcard');
}
// Invented HEAR entries (the Highlight lines quote the KJV, public domain). Typical: Eli's two readings this week
// (week 38: Acts 2-3, Acts 4-5). Overflow: all five days of week 52 in long form, plus a week note.
const ENTRIES = {
  typical: [
    { h: 'They continued stedfastly in the apostles’ doctrine and fellowship, and in breaking of bread, and in prayers. (Acts 2:42)',
      e: 'The first believers kept meeting every day: teaching, meals at home, prayer. Nothing flashy, just steady.',
      a: 'Keep Tuesday dinner free so we can pray together as a family.',
      r: 'Thank you for the people you have put around us.' },
    { h: 'We cannot but speak the things which we have seen and heard. (Acts 4:20)',
      e: 'Peter and John were told to stop speaking about Jesus. They said they had to obey God, and the church prayed for boldness.',
      a: 'Tell the kids at dinner one thing God did for us this week.',
      r: 'Lord, make me bold and kind. Help me listen first.' },
  ],
  overflow: [
    { h: 'I am Alpha and Omega, the beginning and the ending, saith the Lord, which is, and which was, and which is to come, the Almighty. (Revelation 1:8)',
      e: 'John writes to seven churches that are under pressure. Before any warning or promise he shows them who Jesus is: the first and the last, alive for evermore, holding the keys. Everything else in the book hangs on that picture.',
      a: 'Start each morning this week by reading Revelation 1:17-18 before I look at my phone. When the week feels out of control, remember who is holding the keys.',
      r: 'Lord Jesus, you are the beginning and the end of this whole year of reading. Thank you for carrying me through all fifty-two weeks of it, even the weeks I fell behind.' },
    { h: 'Nevertheless I have somewhat against thee, because thou hast left thy first love. (Revelation 2:4)',
      e: 'Ephesus was doing so much right: hard work, patience, sound teaching. But the love they started with had cooled. Jesus says remember, repent, and do the first works again.',
      a: 'Look at where my duty has crowded out my love: reading to tick a box instead of to meet God. Write one thing each day that I am grateful for.',
      r: 'Rekindle my first love. Let this plan never become only a checklist.' },
    { h: 'Thou art worthy, O Lord, to receive glory and honour and power: for thou hast created all things. (Revelation 4:11)',
      e: 'The throne room scene: everything in heaven turns toward God and the Lamb. The only one worthy to open the scroll is the Lamb who was slain.',
      a: 'Sing the doxology with the kids at bedtime this week, and tell them why we sing it.',
      r: 'You are worthy. Teach our family to worship you with our whole lives, not only on Sundays.' },
    { h: 'Alleluia: for the Lord God omnipotent reigneth. (Revelation 19:6)',
      e: 'Babylon falls and heaven rejoices. The marriage supper of the Lamb is announced, and the rider on the white horse is called Faithful and True.',
      a: 'When the news is heavy, pray instead of scrolling. Name one worry each evening and hand it over.',
      r: 'Hallelujah. You reign, even when it does not look like it from here.' },
    { h: 'And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying. (Revelation 21:4)',
      e: 'The end of the story is a new heaven and a new earth, God dwelling with his people, and the river of the water of life. Genesis began with a garden and Revelation ends with a city that has a garden in it.',
      a: 'Write a note to Grandma Jo about the hope in this chapter. Plan how we will start the plan again in January, maybe with Mae and the kids reading along.',
      r: 'Even so, come, Lord Jesus. Thank you for the whole story, Genesis to Revelation.' },
  ],
  note: 'A whole year in the Word. The weeks I fell behind were the weeks I most needed it. Next time: read with Mae in the evenings, keep the journal going, and memorize the verses together as a family.',
};

export const screens = [
  {
    screen: 'today',
    states: ['empty', 'typical', 'overflow', 'loading', 'offline'],
    note: 'Cold open: the Today hero (next reading, Done, this week’s ring, streak, kids’ story line) at the top. Loading = before hub.ready resolves (the static page); offline = reopened from the local cache, and pixel-identical to typical: neither F260 nor the shell’s app viewer shows any offline sign.',
    async go(t) { const f = await open(t); if (t.loading) return; await toTop(t, f); },
  },
  {
    screen: 'today-timeout',
    states: ['loading'],
    loadingWait: 7200,
    note: 'Cold device whose data never arrives: after hub.ready’s 6 s timeout F260 renders as a brand-new plan (week 1) and queues weekStart/summary writes for it. Pixel-identical to today-empty: nothing tells the reader their data has not arrived.',
    async go(t) { await open(t); },
  },
  {
    screen: 'today-done',
    states: ['empty', 'typical'],
    note: 'Right after tapping Done on the Today hero: “Read today ✓”, the ring moves on, Undo appears, the next reading slides in. Animations are finished for this capture, so the confirmation toast has faded: see done-toast. Overflow’s Done is the plan’s last reading: see complete.',
    async go(t) {
      await noWrites(t);
      const f = await open(t);
      await t.tap($(f, '#todayDone'));
      await waitOn(f, '#todayUndo:not([hidden])');
      await t.sleep(500);
      await toTop(t, f);
    },
  },
  {
    screen: 'done-toast',
    states: ['typical'],
    animations: 'allow',
    note: 'The confirmation toast after Done (“✓ Acts 6 · next: Acts 7”), caught while it shows (3.4 s, fading in and out), so animations run in this capture.',
    async go(t) {
      await noWrites(t);
      const f = await open(t);
      await t.tap($(f, '#todayDone'));
      await waitOn(f, '.toast');
      await t.sleep(450);                                 // past the 0.34 s fade-in
    },
  },
  {
    screen: 'plan',
    states: ALL,
    note: 'Side column: reading and chapter meters, the stats strip, the journey through the books, the 52-week grid and the 12-week heatmap. Loading/offline: see today.',
    async go(t) { const f = await open(t); await reveal(t, f, '.side'); },
  },
  {
    screen: 'next-up',
    states: ALL,
    note: 'The “Next up” hero (pace and projected finish, Go to reading, Reading mode), this week’s reflections (locked: no journal passcode yet) and the milestones. Loading/offline: see today.',
    async go(t) { const f = await open(t); await reveal(t, f, '#hero'); },
  },
  {
    screen: 'milestones',
    states: ['typical', 'overflow'],
    note: 'Milestones strip (a horizontal scroller below 1024 px, a wrapped grid in the wide side column) and the toolbar (jump, week stepper, print, settings). Empty: every tile is off, as in next-up’s empty capture.',
    async go(t) { const f = await open(t); await reveal(t, f, '.mlbl'); },
  },
  {
    screen: 'week-open',
    states: ALL,
    note: 'The current week expanded (open by default): five readings with Done marks and HEAR buttons, the memory verses, the “Practice again” row for verses marked not yet, the week note. Loading/offline: see today.',
    async go(t) { const f = await open(t); await reveal(t, f, '.week.current'); },
  },
  {
    screen: 'week-past',
    states: ['typical', 'overflow'],
    note: 'An earlier, finished week opened from the list (week 37; week 51 in overflow): ticked days struck through, the faded header, the verses and the “Week N done 🎉” summary with Copy summary but no Start button (it is not the current week). Empty: no week is finished.',
    async go(t) {
      await noWrites(t);                                  // opening a week saves f260.open
      const f = await open(t);
      const w = t.state === 'overflow' ? 51 : 37;
      await reveal(t, f, `#week-${w}`, 'center');
      await t.tap($(f, `[data-toggle="${w}"]`));
      await waitOn(f, `#week-${w}.open`);
      await t.sleep(350);                                 // the week body's open transition
      await reveal(t, f, `#week-${w}`);
    },
  },
  {
    screen: 'today-week-done',
    profile: 'christian',
    states: ['typical', 'overflow'],
    note: 'Mae read twice this morning and finished her current week: the Today hero reads “Read today ✓”, the ring is full (5/5) and the next reading is the next week’s first (“· starts week 38”; week 52 in overflow). Done there starts that week.',
    async go(t) { const f = await open(t); await toTop(t, f); },
  },
  {
    screen: 'week-complete',
    profile: 'christian',
    states: ['typical', 'overflow'],
    note: 'Mae finished her current week this morning: the week shows “Week N done 🎉”, its summary and “Start week N+1”. No empty state: an empty plan has no finished week.',
    async go(t) { const f = await open(t); await reveal(t, f, '.week.current .nextwk', 'center'); },
  },
  {
    screen: 'reading-mode',
    states: ALL,
    note: 'Reading mode (hero → Reading mode): one week per screen in big type with a sticky glass bar (prev / next / Done); the Today hero stays on top. Offline omitted: the second pass would reopen straight into reading mode from the cached preference.',
    async go(t) {
      await noWrites(t);
      const f = await open(t);
      if (!(await f.locator('#planView.readmode').count())) await t.tap($(f, '#readBtn'));
      await waitOn(f, '#planView.readmode');
      await t.sleep(300);
      await toTop(t, f);
    },
  },
  {
    screen: 'reading-mode-week',
    states: ['typical', 'overflow'],
    note: 'Reading mode scrolled down to the week itself (big-type readings and memory verses).',
    async go(t) {
      await noWrites(t);
      const f = await open(t);
      if (!(await f.locator('#planView.readmode').count())) await t.tap($(f, '#readBtn'));
      await waitOn(f, '#planView.readmode');
      await t.sleep(300);
      await reveal(t, f, '#readbar');
    },
  },
  {
    screen: 'journal',
    states: ['typical', 'error'],
    note: 'The Journal tab. No passcode has been set, so opening it asks for one at once (“Set a journal passcode”). Error: two passcodes that do not match. The vault is encrypted, so no journal content is seeded, and empty/overflow look the same as typical.',
    async go(t) {
      const f = await open(t);
      await t.tap($(f, '#tabJournal'));
      await waitOn(f, '#pass.on');
      await t.sleep(250);
      if (t.error) {
        await f.fill('#pass1', '2468');
        await f.fill('#pass2', '2486');
        await t.tap($(f, '#passOk'));
        await waitOn(f, '#passErr:not(:empty)');
      }
    },
  },
  {
    screen: 'hear',
    states: ['typical'],
    note: 'Tapping HEAR on a reading (Acts 6) with no passcode yet: the same “Set a journal passcode” prompt, over the open week. The HEAR panel itself only opens once the journal is unlocked.',
    async go(t) {
      const f = await open(t);
      await reveal(t, f, '.week.current');
      await t.tap($(f, '.week.current .day:not(.done) [data-jr]'));
      await waitOn(f, '#pass.on'); await t.sleep(250);
    },
  },
  {
    screen: 'journal-locked',
    states: ['typical'],
    note: 'The Journal tab after cancelling the passcode prompt: the private-journal empty state with “Set passcode”, search/sort/copy disabled.',
    async go(t) {
      const f = await open(t);
      await t.tap($(f, '#tabJournal'));
      await waitOn(f, '#pass.on');
      await t.tap($(f, '#passCancel'));
      await f.waitForSelector('#pass.on', { state: 'detached', timeout: 1500 }).catch(() => {});
      await t.sleep(250);
      await toTop(t, f);
    },
  },
  {
    screen: 'journal-unlock',
    states: ['typical', 'error'],
    note: 'A returning reader: the journal has a passcode and is locked (it always locks when the app is reopened), so the Journal tab asks “Unlock journal”. Made in the capture: set a passcode, Lock, then Unlock. Error: a wrong passcode (“Wrong passcode.”).',
    async go(t) {
      await noWrites(t);
      const f = await open(t);
      await t.tap($(f, '#tabJournal'));
      await setPass(t, f);
      await waitOn(f, '#jLock:not([hidden])');
      await t.tap($(f, '#jLock'));
      await waitOn(f, '[data-unlock-view]');
      await t.tap($(f, '[data-unlock-view]'));
      await waitOn(f, '#pass.on'); await t.sleep(200);
      if (t.error) {
        await f.fill('#pass1', '1357');
        await t.tap($(f, '#passOk'));
        await f.waitForFunction(() => document.getElementById('passErr').textContent === 'Wrong passcode.', null, { timeout: 5000 }).catch(() => {});
      }
    },
  },
  {
    screen: 'hear-open',
    states: ALL,
    note: 'A HEAR panel open with the journal unlocked (passcode set in the capture): the prompt of the week and the four fields. Empty: a blank entry on Genesis 1-2. Typical: Eli’s entry on yesterday’s reading (Acts 4-5), saved. Overflow: a long entry on Revelation 18-19. Loading/offline: see today.',
    async go(t) {
      await noWrites(t);
      const f = await open(t);
      const id = await lastRead(f);
      await reveal(t, f, `[data-day="${id}"]`, 'center');
      await t.tap($(f, `[data-jr="${id}"]`));
      await setPass(t, f);
      await waitOn(f, `#jr-${id}.on textarea`);
      if (t.state === 'typical') await writeEntry(t, f, id, ENTRIES.typical[1]);
      if (t.state === 'overflow') await writeEntry(t, f, id, ENTRIES.overflow[3]);
      await revealBelowHead(t, f, `[data-day="${id}"]`);
    },
  },
  {
    screen: 'week-note',
    states: ['typical'],
    note: 'The current week’s “Week note” panel open with the journal unlocked (passcode set from the Week note button, a note typed and saved in the capture).',
    async go(t) {
      await noWrites(t);
      const f = await open(t);
      const w = (await weekDays(f))[0].split('-')[0];
      await reveal(t, f, `[data-wn="${w}"]`, 'center');
      await t.tap($(f, `[data-wntoggle="${w}"]`));
      await setPass(t, f);
      await waitOn(f, `#wn-${w}`);
      await f.fill(`#wn-${w}`, 'Acts this week: the church kept praying together, even under pressure. Want to read Acts 4:23-31 with Mae on Friday.');
      await f.evaluate(() => document.activeElement && document.activeElement.blur());
      await t.sleep(150);
      await revealBelowHead(t, f, `[data-wn="${w}"]`);
    },
  },
  {
    screen: 'journal-entries',
    states: ALL,
    note: 'The Journal tab unlocked. Empty: “No entries yet” straight after setting a passcode. Typical: Eli’s two entries this week, in plan order. Overflow: five long entries and a week note for week 52. Entries are typed in the capture (the vault is encrypted, so none are seeded). Loading/offline: see today.',
    async go(t) {
      await noWrites(t);
      const f = await open(t);
      if (t.state === 'empty') { await t.tap($(f, '#tabJournal')); await setPass(t, f); await waitOn(f, '#jList .empty'); await toTop(t, f); return; }
      const ids = await weekDays(f), list = ENTRIES[t.state];
      await reveal(t, f, '.week.current');
      await t.tap($(f, `[data-jr="${ids[0]}"]`));
      await setPass(t, f);
      for (let i = 0; i < list.length; i++) await writeEntry(t, f, ids[i], list[i]);
      if (t.state === 'overflow') {
        const w = ids[0].split('-')[0];
        await t.tap($(f, `[data-wntoggle="${w}"]`));
        await waitOn(f, `#wn-${w}`);
        await f.fill(`#wn-${w}`, ENTRIES.note);
        await f.evaluate(() => document.activeElement && document.activeElement.blur());
      }
      await t.tap($(f, '#tabJournal'));
      await waitOn(f, '#jList .jcard');
      await toTop(t, f);
    },
  },
  {
    screen: 'reflections',
    states: ['typical'],
    note: 'This week’s reflections once the journal is unlocked and has entries: the hero’s rotating reflection line and “Reflect · 2 applications”, then the “This week” card with each Apply/Respond line and a “How’s it going?” follow-up (the first one filled in, so it reads “followed up”).',
    async go(t) {
      await noWrites(t);
      const f = await open(t);
      const ids = await weekDays(f);
      await reveal(t, f, '.week.current');
      await t.tap($(f, `[data-jr="${ids[0]}"]`));
      await setPass(t, f);
      for (let i = 0; i < 2; i++) await writeEntry(t, f, ids[i], ENTRIES.typical[i]);
      await waitOn(f, '#rfBody textarea[data-rf]');
      await f.fill('#rfBody textarea[data-rf]', 'Asked Mae last night: tonight’s dinner is kept free. Ezra wants to pray too.');
      await f.evaluate(() => document.activeElement && document.activeElement.blur());
      await reveal(t, f, '#hero');
    },
  },
  {
    screen: 'journal-search',
    states: ['typical'],
    note: 'The unlocked Journal tab searched for “bold”: “1 of 2 entries”, the match highlighted in the entry. Entries typed in the capture, as in journal-entries.',
    async go(t) {
      await noWrites(t);
      const f = await open(t);
      await typedJournal(t, f);
      await f.fill('#jSearch', 'bold');
      await waitOn(f, '#jList mark');
      await toTop(t, f);
    },
  },
  {
    screen: 'journal-no-match',
    states: ['typical'],
    note: 'The Journal search with no result: “Nothing matches · Try a different word.”',
    async go(t) {
      await noWrites(t);
      const f = await open(t);
      await typedJournal(t, f);
      await f.fill('#jSearch', 'Nineveh');
      await waitOn(f, '#jList .empty');
      await toTop(t, f);
    },
  },
  {
    screen: 'settings',
    states: ['typical'],
    note: 'Settings, an inline sheet under the toolbar: passage source, weeks, theme, text size, journal passcode, auto-lock, Face ID, backup. Its content does not depend on the plan data, so empty/overflow are omitted.',
    async go(t) { const f = await open(t); await settings(t, f); await reveal(t, f, '#sheet'); },
  },
  {
    screen: 'settings-more',
    states: ['typical'],
    note: 'The lower half of the settings sheet (passcode, auto-lock, Face ID / Touch ID, backup). Lock now, Change passcode, Erase journal and both Face ID buttons are disabled here (no passcode yet). Face ID’s hint reads “Not available in this browser” because the capture engine has no WebAuthn; an iPad would say “Unlock the journal with your passcode first, then enable it here.”',
    async go(t) { const f = await open(t); await settings(t, f); await reveal(t, f, '#backupBtn', 'end'); },
  },
  {
    screen: 'settings-unlocked',
    states: ['typical'],
    note: 'The lower half of settings with the journal unlocked (passcode set in the capture): Lock now, Change passcode and Erase journal are live and the hint says the journal is unlocked. Compare settings-more, where the same buttons are disabled but look the same. Face ID / Touch ID reads “Not available in this browser” because the capture engine has no WebAuthn; on an iPad it offers Enable here.',
    async go(t) {
      await noWrites(t);
      const f = await open(t);
      await t.tap($(f, '#tabJournal')); await setPass(t, f);
      await t.tap($(f, '#tabPlan'));
      await settings(t, f);
      await reveal(t, f, '#backupBtn', 'end');
    },
  },
  {
    screen: 'change-passcode',
    states: ['typical'],
    note: 'Settings → Change passcode with the journal unlocked: the passcode dialog as “New passcode”. The erase-journal confirm uses the same dialog as reset-confirm.',
    async go(t) {
      await noWrites(t);
      const f = await open(t);
      await t.tap($(f, '#tabJournal')); await setPass(t, f);
      await t.tap($(f, '#tabPlan'));
      await settings(t, f);
      await t.tap($(f, '#changePassBtn'));
      await waitOn(f, '#pass.on'); await t.sleep(250);
    },
  },
  {
    screen: 'reset-confirm',
    states: ['typical'],
    note: 'Settings → Reset progress…: the app’s own confirm dialog (not a native confirm). Not confirmed.',
    async go(t) { const f = await open(t); await settings(t, f); await t.tap($(f, '#resetBtn')); await waitOn(f, '#confirm.on'); await t.sleep(250); },
  },
  {
    screen: 'restore',
    states: ['typical', 'error'],
    note: 'Settings → Restore from backup…: paste box. Error: text that is not an F260 backup.',
    async go(t) {
      const f = await open(t); await settings(t, f);
      await t.tap($(f, '#restoreBtn')); await waitOn(f, '#restore.on'); await t.sleep(250);
      if (t.error) { await f.fill('#restoreText', 'Week 38 notes from Tuesday'); await t.tap($(f, '#restoreOk')); await waitOn(f, '#restoreErr:not(:empty)'); }
    },
  },
  {
    screen: 'large-text',
    states: ['typical'],
    note: 'Settings → Text size → Large (body zoom 1.15), back at the top of the plan.',
    async go(t) {
      await noWrites(t);
      const f = await open(t); await settings(t, f);
      await t.tap($(f, '#sizeSeg [data-big="1"]'));
      await t.tap($(f, '#settingsBtn'));
      await t.sleep(200);
      await toTop(t, f);
    },
  },
  {
    screen: 'practice',
    states: ['typical', 'overflow'],
    note: 'Memory-verse practice (the “Practice again” chip in the current week): the text veiled, “Say it from memory, then reveal”. Overflow: a long passage. Empty: nothing is memorised, so there is nothing to practise.',
    async go(t) {
      const f = await open(t);
      const id = t.state === 'overflow' ? '37-0' : '36-1';
      await t.tap($(f, `.week.current [data-practice="${id}"]`));
      await waitOn(f, '#practice.on'); await t.sleep(250);
    },
  },
  {
    screen: 'practice-reveal',
    states: ['typical', 'overflow'],
    note: 'Practice after Reveal: the verse text with Not yet / Got it.',
    async go(t) {
      const f = await open(t);
      const id = t.state === 'overflow' ? '37-0' : '36-1';
      await t.tap($(f, `.week.current [data-practice="${id}"]`));
      await waitOn(f, '#practice.on');
      await t.tap($(f, '#practice [data-prreveal]'));
      await waitOn(f, '#practice [data-prmark]'); await t.sleep(250);
    },
  },
  {
    screen: 'practice-paste',
    states: ['typical'],
    note: 'Practice for a verse whose text was never pasted: the paste box with Open passage ↗ / Cancel / Save.',
    async go(t) {
      const f = await open(t);
      await t.tap($(f, '.week.current [data-practice="37-0"]'));
      await waitOn(f, '#prPaste'); await t.sleep(250);
    },
  },
  {
    screen: 'behind',
    profile: 'dad',
    states: ['typical', 'overflow'],
    note: 'David is behind: nothing read for over a week, so Today says “Pick up where you left off”, the streak is 0 and he has readings left behind in earlier weeks.',
    async go(t) { const f = await open(t); await toTop(t, f); },
  },
  {
    screen: 'behind-pace',
    profile: 'dad',
    states: ['typical', 'overflow'],
    note: 'David’s side column and hero: partial weeks in the 52-week grid, a sparse heatmap, the gold “Pick up where you left off” hero with “N weeks behind · projected finish”.',
    async go(t) { const f = await open(t); await reveal(t, f, '.journey'); },   // book bar, 52-week grid, heatmap and hero together, in the wide side column too
  },
  {
    screen: 'finished',
    profile: 'mom',
    states: ['overflow'],
    note: 'Elizabeth finished all 260 readings yesterday: Today says “Plan complete 🎉” with no Done; the hero offers “See your year”.',
    async go(t) { const f = await open(t); await toTop(t, f); },
  },
  {
    screen: 'finished-hero',
    profile: 'mom',
    states: ['overflow'],
    note: 'The finished plan’s side column from the book bar down: every book finished, a solid 52-week grid, the heatmap and the hero (“Week 52 done · Plan complete · Finished · See your year”). The full meters are in finished.',
    async go(t) { const f = await open(t); await reveal(t, f, '.journey'); },
  },
  {
    screen: 'complete',
    states: ['overflow'],
    note: 'The celebration: Eli taps Done on the plan’s last reading (Revelation 20-22). Week 52 completes and the “Plan complete — Genesis to Revelation 🎉” dialog opens with the year’s stats.',
    async go(t) {
      await noWrites(t);
      const f = await open(t);
      await t.tap($(f, '#todayDone'));
      await waitOn(f, '#complete.on', 4000);
      await t.sleep(600);
    },
  },
  {
    screen: 'year',
    profile: 'mom',
    states: ['overflow'],
    note: 'The finished plan’s “See your year” (hero button): the same Plan complete dialog, opened later.',
    async go(t) {
      const f = await open(t);
      await t.tap($(f, '#nextUp'));
      await waitOn(f, '#complete.on'); await t.sleep(300);
    },
  },
  {
    screen: 'print',
    states: ['typical'],
    devices: ['desktop'],
    modes: ['light'],
    note: 'Print plan (toolbar): the app’s print stylesheet. window.print() opens a native dialog that cannot be captured, so the app document is opened on its own (what the print dialog renders from the app frame) with print media emulated at US Letter width, 816×1056 CSS px, the top of page 1. The printout forces black on white, so dark is omitted; it prints only the plan text, so empty/overflow look the same.',
    async go(t) {
      await t.page.setViewportSize({ width: 816, height: 1056 });
      await t.page.goto(t.site + '/apps/f260.html', { waitUntil: 'load' });
      await t.page.waitForSelector(READY, { timeout: 10000 }).catch(() => {});
      await t.page.emulateMedia({ media: 'print' });
      await t.sleep(300);
    },
  },
  {
    screen: 'guest',
    profile: 'guest-grandmajo',
    states: ['typical'],
    note: 'A guest (Grandma Jo) opens F260: a guest counts as an adult, so she gets her own fresh 52-week plan.',
    async go(t) { const f = await open(t); await toTop(t, f); },
  },
];

// Desktop (mouse) captures: park the pointer in the corner of the shell's top bar once the screen is set up, so a
// click that re-renders or scrolls the page (reading mode, text size, Done) does not leave a hover highlight on
// whatever row ended up under the pointer.
for (const s of screens) {
  const go = s.go;
  s.go = async t => { await go(t); if (!t.touch) await t.page.mouse.move(1, 1).catch(() => {}); };
}
