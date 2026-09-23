// Area "tally": the Tally counter (apps/tally.html). One view: the "<name>'s counter" pill (:130, text set at :149 after
// hub.ready), the glass dial with the count (:133-135, font shrinks with the digit count at :60 / :151), − and + (:136-139)
// and "Reset to zero" (:140). Kids get bigger buttons and dial through CSS only (:122-124).
// Data: app_data(person, 'tally', 'count') — seeded by seed/tally.mjs (Eli 37 / 1,284,750; Ezra 12 / 250,000).
//
// Not captured: kiosk (the shell lists no apps for the kiosk, index.html:479); guests (a guest sees the same view as an
// adult — only the name in the pill changes); error (the app has no error UI of its own). Reset has no confirm and no
// undo (:155), so there is no dialog to capture.
export const area = 'tally';

async function openTally(t) {
  const f = await t.openApp('tally', { wait: '.dial' });
  if (t.loading) return f;                          // hub.ready() waits on the held first pull: the pill stays empty
  // the pill's text and the count are written together once hub.ready() resolves (:149, :157)
  await f.waitForFunction(() => {
    const who = document.getElementById('who');
    return who && who.textContent.trim().length > 0;
  }, null, { timeout: 6000, polling: 100 }).catch(() => {});
  return f;
}

export const screens = [
  {
    screen: 'main',
    profile: 'eli',
    states: ['empty', 'typical', 'overflow', 'loading', 'offline'],
    note: "Eli's counter: 0 (empty), 37 (typical), 1,284,750 with the long name in the pill (overflow). Loading = the bare markup (count 0, empty name pill, buttons not wired yet) while hub.ready() waits up to 6 s. Offline is pixel-identical to typical: the app shows no offline or pending indicator.",
    go: openTally,
  },
  {
    screen: 'kid',
    profile: 'ezra',
    states: ['typical', 'overflow'],
    note: "Ezra's counter in kid mode (bigger dial and buttons, apps/tally.html:122-124): 12 (typical), 250,000 with the long name (overflow). Empty/loading/offline look like the adult's.",
    go: openTally,
  },
];
