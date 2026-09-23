// Kid Verse (apps/kidverse.html): the family's memory verse and story for pre-readers, one ★ a day, badges, and the
// grown-ups' week stepper. Seeded by seed/kidverse.mjs (family week 38; Ezra ★3 and Kiara ★1 this week in typical).
// Visible to the kids and the household adults (apps.json:11); the kiosk never lists it, so there is no TV screen.
import { DEMO_TIME } from '../seed/story.mjs';
export const area = 'kidverse';

// Open Kid Verse and wait until render() has replaced the "…" placeholders (apps/kidverse.html:150, 350) and, for a kid,
// the rewards card is up (apps/kidverse.html:491-501). Loading: data never arrives, so return straight away.
async function open(t, extra) {
  const f = await t.openApp('kidverse');
  if (t.loading) return f;
  await f.waitForFunction(() => { const r = document.querySelector('#ref'); return r && r.textContent.trim() && r.textContent.trim() !== '…'; }, null, { timeout: 8000 }).catch(() => {});
  if (extra) await f.waitForSelector(extra, { timeout: 5000 }).catch(() => {});
  await t.sleep(200);
  return f;
}
// Scroll the app's own document so a card sits near the top of the viewport.
async function scrollTo(t, f, sel, gap = 12) {
  await f.evaluate(([s, g]) => { const el = document.querySelector(s); if (!el) return; const se = document.scrollingElement; se.scrollTop = Math.max(0, el.getBoundingClientRect().top + se.scrollTop - g); }, [sel, gap]).catch(() => {});
  await t.sleep(250);
}
// reconcile() only runs once both kidverse scopes have been pulled on this device (apps/kidverse.html:467-469), so a tap
// that should earn a badge waits for the same condition first.
const pulled = f => f.waitForFunction(() => ['person', 'family'].every(sc => {
  try { const c = JSON.parse(localStorage.getItem('hub.cache.kidverse.' + sc + (sc === 'person' ? '.' + window.hub.profile.id : ''))); return !!(c && c.since > 0); } catch { return false; }
}), null, { timeout: 5000 }).catch(() => {});
// A speechSynthesis stand-in that accepts an utterance and never finishes it, so "Read it to me" stays in its
// "Reading…" state for the shot (apps/kidverse.html:280, 299-313). It never makes a sound.
const speechStub = t => t.ctx.addInitScript(() => {
  const synth = { speaking: false, pending: false, paused: false, onvoiceschanged: null,
    speak(u) { this.speaking = true; this._u = u; }, cancel() { this.speaking = false; }, pause() {}, resume() {},
    getVoices() { return []; }, addEventListener() {}, removeEventListener() {} };
  try { Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true, writable: true }); } catch {}
  try { window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; this.rate = 1; this.pitch = 1; this.lang = ''; this.voice = null; } }; } catch {}
});
// A parent's cash-in or week reset arriving from another device, as the kid's app meets it: the family kidverse pull
// (GET /api/data/kidverse?scope=family, apps/hub.js:289) answers with the real rows plus one ledger row Eli has just written
// from Me → Kids' rewards (shape as index.html:1366-1374: { kind, date, amount | days[], by, at }). reconcile() applies it
// once (apps/kidverse.html:442-464, 471), writes the kid's stars row and toasts "Cashed in: N stars!" / "Your week starts
// over." (:482-485). The row lives only in the answer, so the captures stay independent (and the screens are isolated).
const TODAY = DEMO_TIME.slice(0, 10);
const AT = Date.parse(DEMO_TIME) - 2 * 60000;                                   // two minutes ago, on Eli's phone
const ledgerArrives = (t, row) => t.ctx.route(u => u.href.startsWith(t.api + '/api/data/kidverse?') && new URL(u.href).searchParams.get('scope') === 'family', async r => {
  if (r.request().method() !== 'GET') return r.fallback();
  const res = await r.fetch();
  let body; try { body = await res.json(); } catch { return r.fulfill({ response: res }); }
  if (Array.isArray(body.items)) body.items.push({ key: `ledger:${t.profile}:${AT.toString(36)}-rig1`, value: { ...row, by: 'eli', at: AT }, updated_at: AT });
  await r.fulfill({ response: res, json: body });
});
const toastSays = (f, re) => f.waitForFunction(src => { const el = document.getElementById('hub-toast'); return el && !el.hidden && new RegExp(src).test(el.textContent); }, re.source, { timeout: 5000 }).catch(() => {});

export const screens = [
  {
    screen: 'kid',
    profile: 'ezra',
    states: ['empty', 'typical', 'overflow', 'loading', 'offline'],
    note: 'Ezra (kid) at the top: week art, the reference, the paraphrase, Read it to me / Done ★ and his stars this week. Empty = no family week yet (defaults to week 1) and no stars; overflow = long name, 6 stars this week with today\'s ★ already done. Loading = the … placeholders and the default creation art; offline = the cache, with no offline cue anywhere on screen.',
    async go(t) { await open(t, '#rewards:not([hidden])'); },
  },
  {
    screen: 'kid-stalled',
    profile: 'ezra',
    states: ['loading'],
    loadingWait: 400,
    note: 'First open with no cache on a slow connection, about 7 s in: hub.ready stops waiting after 6 s (apps/hub.js:336-337) and Kid Verse renders from an empty cache, scrolled to the buttons. "Ezra · Week 1", Genesis 1:27, "No stars yet this week", 0 to cash in, and Done ★ live, although the family is on week 38 and Ezra has ★3. reconcile() waits for a real pull (apps/kidverse.html:467-469), but award() does not (:323-334), so a tap here writes a fresh stars row stamped now that out-dates the real one (apps/hub.js:236). Loading only.',
    async go(t) {
      const f = await t.openApp('kidverse');
      await f.waitForFunction(() => { const r = document.querySelector('#ref'); return r && r.textContent.trim() && r.textContent.trim() !== '…'; }, null, { timeout: 9000 }).catch(() => {});
      await t.sleep(200);
      await scrollTo(t, f, '.actions', 24);
    },
  },
  {
    screen: 'kid-stars',
    profile: 'ezra',
    states: ['empty', 'typical', 'overflow'],
    note: 'Ezra scrolled to his buttons and "my stars this week" (the count and seven day dots), which sit below the fold on phones and desktop. Typical: Done ★ still to do, ★3; overflow: "Done today ★", ★6; empty: no stars yet. Loading/offline: see the kid screen (the card stays hidden while loading; the cache looks like typical).',
    async go(t) { const f = await open(t, '#mine:not([hidden])'); await scrollTo(t, f, '.actions', 24); },
  },
  {
    screen: 'kid-story',
    profile: 'ezra',
    states: ['empty', 'typical', 'overflow'],
    note: 'Ezra scrolled to this week\'s story card (retelling, Read it to me / I heard it). Overflow has the story already heard today. Loading/offline look the same as on the kid screen, so they are captured there only.',
    async go(t) { const f = await open(t, '#story-heard:not([hidden])'); await scrollTo(t, f, '#story'); },
  },
  {
    screen: 'kid-rewards',
    profile: 'ezra',
    states: ['empty', 'typical', 'overflow'],
    note: 'Ezra scrolled to My rewards: the balance to cash in, the six badges and the last cash-in. Typical: 3 to cash in, 4 badges, last cashed in Sep 20; overflow: hundreds to cash in, every badge; empty: nothing earned yet. Loading/offline: see the kid screen (the card stays hidden while loading; the cache looks like typical).',
    async go(t) { const f = await open(t, '#rewards:not([hidden])'); await scrollTo(t, f, '#rewards'); },
  },
  {
    screen: 'kid-award',
    profile: 'ezra',
    states: ['empty'],
    isolate: true,
    animations: 'allow',
    note: 'Ezra\'s very first star: from the empty household he taps Done ★, so the button turns to "Done today ★", his stars read 1, the calm confetti falls (it may have mostly faded by the shot) and the "New badge: First star!" toast shows at the bottom (apps/kidverse.html:323-334, 476-481). Empty only: it is the one state where a single tap earns a badge; in typical the tap only adds a star.',
    async go(t) {
      const f = await open(t, '#done:not([hidden])');
      await pulled(f);
      await t.tap(f.locator('#done'));
      await f.waitForFunction(() => { const el = document.getElementById('hub-toast'); return el && !el.hidden && /badge/i.test(el.textContent); }, null, { timeout: 5000 }).catch(() => {});
      await scrollTo(t, f, '.words');
    },
  },
  {
    screen: 'kid-cashed-in',
    profile: 'ezra',
    states: ['typical'],
    isolate: true,
    note: 'The moment a parent\'s cash-in reaches the kid: Eli has just tapped Cash in for Ezra\'s 3 stars on his phone (Me → Kids\' rewards), so when Kid Verse pulls, the new ledger row is applied once: My rewards reads 0 to cash in and "Last cashed in: 3 stars on Sep 22", and the toast "Cashed in: 3 stars!" shows (apps/kidverse.html:447-450, 482-485). The ledger row is added to the family pull\'s answer, as if written from another device. Typical only: a one-off moment.',
    async go(t) {
      await ledgerArrives(t, { kind: 'cashin', date: TODAY, amount: 3 });
      const f = await open(t, '#rewards:not([hidden])');
      await toastSays(f, /^Cashed in/);
      await scrollTo(t, f, '#rewards');
    },
  },
  {
    screen: 'kid-week-reset',
    profile: 'ezra',
    states: ['typical'],
    isolate: true,
    note: 'The moment a parent\'s Reset week reaches the kid: Eli has just reset Ezra\'s week (Me → Kids\' rewards), so Kid Verse applies the ledger row. Monday\'s verse ★ and story and today\'s prayed star are marked reset, the stars card drops from ★3 to "No stars yet this week" with no lit dots, the balance loses 3, and the toast "Your week starts over." shows. Done ★ stays open for today (apps/kidverse.html:451-458, 482-485). Added to the pull like kid-cashed-in. Typical only.',
    async go(t) {
      await ledgerArrives(t, { kind: 'reset', date: TODAY, days: ['2026-09-21', TODAY] });
      const f = await open(t, '#mine:not([hidden])');
      await toastSays(f, /week starts over/);
      await scrollTo(t, f, '.actions', 24);
    },
  },
  {
    screen: 'kid-reading',
    profile: 'ezra',
    states: ['typical'],
    note: 'Ezra has tapped "Read it to me": the button reads "Reading…" with its speaker icon pulsing (still in the shot) while the device speaks the reference and the paraphrase. speechSynthesis is a silent stand-in that never finishes. Typical only: the other states differ only in the verse shown.',
    async go(t) {
      await speechStub(t);
      const f = await open(t, '#done:not([hidden])');
      await t.tap(f.locator('#say'));
      await f.waitForSelector('#say.on', { timeout: 3000 }).catch(() => {});
      await scrollTo(t, f, '.ref');
    },
  },
  {
    screen: 'kid-kiara',
    profile: 'kiara',
    states: ['typical'],
    note: 'Kiara (kid, 4) at the top: one star this week, her own colour on the Done ★ button and in the glass. Typical only: every other state looks like Ezra\'s kid screen.',
    async go(t) { await open(t, '#rewards:not([hidden])'); },
  },
  {
    screen: 'adult-verse',
    profile: 'eli',
    states: ['typical'],
    note: 'Eli (adult) at the top: the same verse without Done ★ or stars — only Read it to me. Typical only: empty/loading/offline at the top look like the kid screen\'s (week 1 art, … placeholders, the cache).',
    async go(t) { await open(t, '#grown:not([hidden])'); },
  },
  {
    screen: 'adult',
    profile: 'eli',
    states: ['empty', 'typical', 'overflow'],
    note: 'Eli scrolled to the grown-ups panel: the family week stepper (−/+) and every kid\'s stars this week. Empty = week 1 and no stars; overflow = long kid names, ★6 and ★4, and "Use week 52" (Eli\'s F260 plan is on week 52). No loading (the panel stays hidden until data arrives) or offline (the cache looks like typical; the stepper still queues its write).',
    async go(t) { const f = await open(t, '#grown:not([hidden])'); await scrollTo(t, f, '#grown'); },
  },
  {
    screen: 'adult-stalled',
    profile: 'eli',
    states: ['loading'],
    loadingWait: 400,
    note: 'Eli\'s first open with no cache on a slow connection, about 7 s in: after hub.ready\'s 6 s timeout (apps/hub.js:336-337) the grown-ups panel renders from an empty cache. The stepper reads "Week 1 · the family is on" with − disabled and + live, and each kid shows ★0, although the family is on week 38. setWeek (apps/kidverse.html:336-339) writes { week: 2 } over the real row on a tap. Loading only.',
    async go(t) {
      const f = await t.openApp('kidverse');
      await f.waitForSelector('#grown:not([hidden])', { timeout: 9000 }).catch(() => {});
      await t.sleep(200);
      await scrollTo(t, f, '#grown');
    },
  },
  {
    screen: 'adult-f260-hint',
    profile: 'dad',
    states: ['typical'],
    note: 'David (adult, F260 week 31 while the family is on 38) scrolled to the grown-ups panel: the "Your F260 plan is on week N · Use week N" hint (apps/kidverse.html:370). Needs the F260 seed\'s f260.summary for dad; without it the default hint shows. Typical only: it is a data situation, not a mode.',
    async go(t) { const f = await open(t, '#grown:not([hidden])'); await f.waitForSelector('#week-f260', { timeout: 3000 }).catch(() => {}); await scrollTo(t, f, '#grown'); },
  },
  {
    screen: 'adult-guest',
    profile: 'guest-grandmajo',
    states: ['typical'],
    isolate: true,
    note: 'Grandma Jo (guest, kind adult) scrolled to the grown-ups panel, just after she tapped +: a guest gets the same family week stepper as a parent (apps/kidverse.html:369; setWeek :336-338 checks only kind and canWrite), so the whole family\'s memory verse is now week 39 (the family row is written as { week: 39, by: \'guest-grandmajo\' }). She also sees every kid\'s stars, while the shell hides Kids\' rewards from guests (index.html isGuest). No F260 plan, so the default hint. Without the tap this capture would look exactly like adult-typical, because the pill that names her is scrolled off. Typical only.',
    async go(t) {
      const f = await open(t, '#grown:not([hidden])');
      await scrollTo(t, f, '#grown');
      await t.tap(f.locator('#week-up'));
      await f.waitForFunction(() => /Week 39/.test((document.getElementById('week-now') || {}).textContent || ''), null, { timeout: 3000 }).catch(() => {});
      await scrollTo(t, f, '#grown');
    },
  },
];
