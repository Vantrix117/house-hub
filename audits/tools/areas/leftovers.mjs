// Larder Ledger (apps/leftovers.html): the family fridge log. Family scope, no visibleTo, so every adult, guest and
// kid sees it (index.html:481); the kiosk gets no apps at all from the shell (index.html:479), so there is no TV
// capture. One page: header + tally, sync line, warning banner, grouped list (Use it up / Aging / Fresh),
// "Copy list for Hearth" section, and a fixed glass add bar (name, mic, Log, size, date).
// Data: audits/tools/seed/leftovers.mjs (typical 6 items incl. one 8 days old; overflow 32 items, long names).
// States no tap can cause are made at the edge of the page, never in app code: main/error fails the data API the way
// the Worker fails (t.failApi, CORS headers included) and slow-sync holds it (t.hold); copy/error and voice/error stub
// a browser API with t.ctx.addInitScript (a clipboard that refuses; a speech recogniser that hears nothing). The rig
// core already gives every context an inert webkitSpeechRecognition, so the mic shows on every screen, as on Safari.
export const area = 'leftovers';

const READY = '#tally:not(:empty)';                 // render() has run (apps/leftovers.html:205): data is in

/** Open the ledger in the shell viewer and wait until it has rendered (skipped for loading). */
async function open(t) {
  const f = await t.openApp('leftovers', { wait: READY });
  if (!t.loading && t.state !== 'empty' && !t.reopened) {
    // non-empty data: wait for the first card too (the first render can come from an empty cache)
    await f.waitForSelector('.item', { timeout: 6000 }).catch(() => {});
  }
  return f;
}
/** Scroll the app's own document (inside the iframe) to the bottom: the Hearth copy section. */
const toBottom = async (t, f) => { await f.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)).catch(() => {}); await t.sleep(250); };

export const screens = [
  {
    screen: 'main',
    profile: 'eli',
    states: ['empty', 'typical', 'overflow', 'loading', 'offline', 'error'],
    note: 'Top of the ledger as Eli. typical: 6 items, red banner for the 8-day-old alfredo; overflow: 32 items, long names; ' +
      'loading (1.2 s): data calls never answer; the bare page with no tally, no list, and blank Log/Copy buttons, size and date (they are filled after hub.ready); offline: warm cache, "Can\'t reach the house list" line; ' +
      'error: /api/data/leftovers answers 500 {error:"internal"} (with CORS headers, as the Worker does) after a warm load (t.failApi, since no tap can cause it) → "The house list had a problem: internal."',
    async go(t) {
      if (t.error) {
        // Warm load, so the device has a cached list, then the house server starts failing and the app is opened again.
        await open(t); await t.settle(4000);          // let the shell's first pulls finish before the reload
        await t.failApi('/api/data/leftovers', { status: 500, error: 'internal' });
        const f = await t.openApp('leftovers', { wait: READY });
        await f.waitForSelector('#mode:not([hidden])', { timeout: 6000 }).catch(() => {});
        return;
      }
      const f = await open(t);
      if (t.loading) return;
      if (t.reopened) await f.waitForSelector('#mode:not([hidden])', { timeout: 4000 }).catch(() => {});
    },
  },
  {
    screen: 'stalled',
    profile: 'eli',
    states: ['loading'],
    loadingWait: 7500,
    note: 'First open with no cache, still waiting 7.5 s in: hub.ready stops waiting after 6 s (apps/hub.js:337) and the ledger renders ' +
      '"0 in the fridge" + "Nothing logged yet." + "Can\'t reach the house list" (hub.sync starts as \'offline\', apps/hub.js:51), ' +
      'although the server is only slow, not unreachable, and the list is not empty.',
    async go(t) { await open(t); },
  },
  {
    screen: 'slow-sync',
    profile: 'eli',
    states: ['typical'],
    note: 'A device with the list cached opens the ledger while the house server is slow (after a warm load the screen holds ' +
      '/api/data/leftovers with t.hold, so the pull never returns in time): the cached list shows under "Can\'t reach the house list — showing ' +
      'the last copy saved here." Every warm open shows that line until the first pull returns, because hub.sync starts as ' +
      '\'offline\' (apps/hub.js:51) and the ledger subscribes after hub.ready (apps/leftovers.html:183).',
    async go(t) {
      await open(t); await t.settle(4000);                     // warm load: the list is now cached on this device
      await t.hold('/api/data/leftovers');                      // never answered: hub.request gives up after 12 s, after the capture
      const f = await t.openApp('leftovers', { wait: READY });
      await f.waitForSelector('#mode:not([hidden])', { timeout: 4000 }).catch(() => {});
    },
  },
  {
    screen: 'middle',
    profile: 'eli',
    states: ['overflow'],
    note: 'overflow, scrolled so the AGING group heading is at the top: the middle of a 32-item list that neither main (the top) nor ' +
      'lower (the end) reaches on iPad or desktop — the amber group with the longest byName ("Great-Aunt Wilhelmina ' +
      'Fairweather-Pennington") and 80-90-character names. typical is omitted: its Aging group is already in main.',
    async go(t) {
      const f = await open(t);
      await f.evaluate(() => { const g = document.querySelector('.group[data-tone="warn"]'); if (g) window.scrollTo(0, g.getBoundingClientRect().top + window.scrollY - 12); }).catch(() => {});
      await t.sleep(250);
    },
  },
  {
    screen: 'lower',
    profile: 'eli',
    states: ['typical', 'overflow'],
    note: 'Scrolled to the bottom: the "Copy list for Hearth" section above the fixed add bar (overflow: the end of a 32-item list). ' +
      'On iPad portrait the typical page fits the screen, so lower-typical there is the same frame as main-typical. ' +
      'empty is omitted: the whole page fits on one screen there, so it is main-empty.',
    async go(t) { const f = await open(t); await toBottom(t, f); },
  },
  {
    screen: 'copy',
    profile: 'eli',
    states: ['typical', 'error'],
    settle: 120,                                      // the label reverts after 2 s (apps/leftovers.html:357): shoot quickly
    note: 'After tapping "Copy list for Hearth": the button label for ~2 s. typical: " Copied!" (WebKit\'s clipboard accepts). ' +
      'error: " Copy failed — select manually" (:353), made by a stub that refuses both navigator.clipboard.writeText and the ' +
      'execCommand("copy") fallback (:340-346), as Safari can in an iframe — the label asks the user to select text, but the copied ' +
      'text is never shown anywhere to select.',
    async go(t) {
      if (t.error) await t.ctx.addInitScript(() => {
        try { Object.defineProperty(Navigator.prototype, 'clipboard', { configurable: true, get: () => ({ writeText: () => Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError')) }) }); } catch (e) {}
        try { Document.prototype.execCommand = function () { return false; }; } catch (e) {}
      });
      const f = await open(t);
      await toBottom(t, f);
      await t.tap(f.locator('#copy'));
      await f.waitForFunction(() => /Copied|failed/.test(document.getElementById('copy').textContent), null, { timeout: 1500 }).catch(() => {});
    },
  },
  {
    screen: 'voice',
    profile: 'eli',
    states: ['typical', 'error'],
    note: 'Voice add: the mic beside the name field only exists where the browser has SpeechRecognition (apps/leftovers.html:315; ' +
      'hub.js:427). Safari on iOS/macOS has it; Playwright WebKit does not, so the rig gives every capture an inert stand-in and this ' +
      'screen swaps in one that can report "no-speech" (no audio either way). typical: the mic just tapped and listening ' +
      '(.mic.on: red tint; its pulse is frozen by the capture) — there is no "Listening…" text. error: recognition ended with ' +
      '"no-speech" → "Couldn\'t hear that — try again or type it." under the fields (:322). The system\'s microphone/speech ' +
      'permission prompt on first use is native and not captured.',
    async go(t) {
      await t.ctx.addInitScript(fail => {
        // hub.voiceInput (apps/hub.js:415-425) calls new SR(), sets onresult/onerror/onend, then start().
        window.webkitSpeechRecognition = class {
          start() { if (fail) setTimeout(() => { if (this.onerror) this.onerror({ error: 'no-speech' }); if (this.onend) this.onend(); }, 60); }
          stop() { if (this.onend) this.onend(); }
          abort() { this.stop(); }
        };
      }, t.error);
      const f = await open(t);
      const mic = f.locator('#mic');
      await mic.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
      if (!(await mic.isVisible().catch(() => false))) return;
      await t.tap(mic);
      await f.waitForSelector(t.error ? '#err:not([hidden])' : '#mic.on', { timeout: 2000 }).catch(() => {});
    },
  },
  {
    screen: 'add',
    profile: 'eli',
    states: ['typical'],
    note: 'Logging a leftover: the name field focused with "Chicken tortilla soup" typed and the size set to Large (not submitted). ' +
      'The on-screen keyboard, the size picker and the date picker are native and do not render in the capture ' +
      '(the page is not pushed up by a keyboard either). Nothing checks the name until Log: an empty name is ignored silently (:292).',
    async go(t) {
      const f = await open(t);
      await f.locator('#size').selectOption('Large').catch(() => {});
      await t.tap(f.locator('#name'));
      await f.locator('#name').fill('Chicken tortilla soup');
    },
  },
  {
    screen: 'logged',
    profile: 'eli',
    states: ['typical'],
    isolate: true,                                    // the tap writes: each capture gets its own database
    note: 'Right after logging "Chicken tortilla soup" (Large) online: the name field clears, the size snaps back to Medium, the tally ' +
      'reads 7 and the card lands at the end of Fresh (apps/leftovers.html:289-304). There is no toast or other confirmation, and the ' +
      'page does not scroll, so on phones and iPad landscape the new card is out of sight under the add bar. Compare queued (the same tap offline).',
    async go(t) {
      const f = await open(t);
      await f.locator('#size').selectOption('Large').catch(() => {});
      await t.tap(f.locator('#name'));
      await f.locator('#name').fill('Chicken tortilla soup');
      await t.tap(f.locator('#add .log'));
      await f.waitForSelector('.item >> text=Chicken tortilla soup', { timeout: 3000 }).catch(() => {});
    },
  },
  {
    screen: 'queued',
    profile: 'eli',
    states: ['offline'],
    note: 'Logged while offline: "Chicken tortilla soup" lands at once at the end of Fresh ("7 in the fridge") and the sync line adds ' +
      '"Your changes will send when it is back." (the write waits in hub.js\'s local queue). The page does not scroll after Log, so on ' +
      'phones and iPad landscape the new card is below the fixed add bar, off-screen, as the user sees it; it has no pending marker of its own.',
    async go(t) {
      const f = await open(t);
      if (!t.reopened) return;                       // first pass only warms the cache
      await f.waitForSelector(READY, { timeout: 4000 }).catch(() => {});
      await t.tap(f.locator('#name'));
      await f.locator('#name').fill('Chicken tortilla soup');
      await t.tap(f.locator('#add .log'));
      await f.waitForSelector('.item >> text=Chicken tortilla soup', { timeout: 3000 }).catch(() => {});
    },
  },
  {
    screen: 'finished',
    profile: 'eli',
    states: ['typical'],
    isolate: true,                                    // the tap writes: each capture gets its own database and really taps
    note: 'Right after tapping ✓ on the 8-day-old Chicken alfredo: the card and the red banner vanish at once — no confirm, no undo, no toast. ' +
      'With the banner gone, the AGING heading sits tight under the lede.',
    async go(t) {
      const f = await open(t);
      const card = f.locator('.item', { has: f.locator('.nm', { hasText: /^Chicken alfredo$/ }) });
      if (await card.count()) {
        await t.tap(card.first().locator('.done'));
        await card.first().waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
      }
    },
  },
  {
    screen: 'kid',
    profile: 'ezra',
    states: ['typical'],
    note: 'Ezra (5, pre-reader). The app has no kid rules: same text-heavy page, same ✓ buttons and add bar as an adult ' +
      '(a kid can log or finish family items). Guests see the adult page unchanged, so they have no screen of their own.',
    async go(t) { await open(t); },
  },
];
