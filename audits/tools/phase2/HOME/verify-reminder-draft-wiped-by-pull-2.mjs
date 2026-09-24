// Skeptic #2 for finding "reminder-draft-wiped-by-pull": does a routine 30 s pull erase a half-typed Home reminder?
//
//   node "audits/tools/phase2/HOME/verify-reminder-draft-wiped-by-pull-2.mjs" [webkit,chromium]   (both by default; ~60 s each)
//
// Independent of leads.mjs: real browser clock, Kitchen iPad portrait, Eli. Instead of typing the whole text at once and
// waiting, it types one character per second (a slow but ordinary typist on the iPad keyboard) for ~40 s, so the 30 s pull
// must land mid-typing. After every keystroke it records the field's value, where focus is, and whether the <input> the
// user tapped is still in the document. It also records every pull (hub.sync.lastPull) and every data change (hub.onChange)
// so we can tell whether the pull carried any news. Run in both engines to rule out a WebKit-on-Windows artefact.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/HOME');
fs.mkdirSync(OUT, { recursive: true });
const ENGINES = (process.argv[2] || 'webkit,chromium').split(',');
const TEXT = 'Call the plumber about the kitchen sink leak';   // 44 chars, 1 per second → ~44 s > one 30 s pull cycle
const results = {};

for (const engine of ENGINES) {
  const L = await local({ variant: 'typical', clock: 'real', engine });
  try {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await d.goto('#home');
    await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#remtext'), null, { timeout: 20000 });
    await sleep(1000);
    await d.page.evaluate(() => {
      window.__v2 = { pulls: [], changes: [], homeMutations: 0 };
      hub.onSync(s => { const a = window.__v2.pulls; if (s.lastPull && a[a.length - 1] !== s.lastPull) a.push(s.lastPull); });
      window.__v2.pulls = [hub.sync.lastPull];
      hub.onChange(c => window.__v2.changes.push({ at: Date.now(), app: c.app, key: c.key }));
      new MutationObserver(() => { window.__v2.homeMutations++; }).observe(document.querySelector('#view-home'), { childList: true });
      const el = document.querySelector('#remtext'); el.dataset.v2orig = '1'; window.__v2el = el;
      el.scrollIntoView({ block: 'center' });
    });
    await d.page.tap('#remtext').catch(() => d.page.click('#remtext'));
    const t0 = Date.now();
    const log = [];
    for (let i = 0; i < TEXT.length; i++) {
      await d.page.keyboard.type(TEXT[i]);
      const s = await d.page.evaluate(() => {
        const cur = document.querySelector('#remtext'); const ae = document.activeElement;
        return { value: cur ? cur.value : null, focus: ae ? (ae.id || ae.tagName) : null, origConnected: window.__v2el.isConnected, sameEl: cur === window.__v2el, pulls: window.__v2.pulls.length, t: Date.now() };
      });
      log.push({ i, typed: TEXT.slice(0, i + 1), ...s, sec: Math.round((s.t - t0) / 100) / 10 });
      await sleep(1000);
    }
    const inst = await d.page.evaluate(() => ({ pulls: window.__v2.pulls, changes: window.__v2.changes, homeMutations: window.__v2.homeMutations }));
    await d.page.screenshot({ path: path.join(OUT, `verify2-reminder-draft-end-${engine}.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
    const firstLoss = log.find(r => r.value !== r.typed);
    const lastGood = firstLoss ? log[firstLoss.i - 1] : null;
    const server = await L.apiAs('eli', '/api/data/reminders?scope=family');
    const onServer = (server.body.items || []).some(it => it.value && /plumber/.test(it.value.text || ''));
    const pullsDuring = inst.pulls.filter(p => p >= t0);
    const changesDuring = inst.changes.filter(c => c.at >= t0);
    const r = {
      engine, typedChars: TEXT.length, secondsTyping: log[log.length - 1].sec,
      pullsDuringTyping: pullsDuring.map(p => Math.round((p - t0) / 100) / 10 + ' s'),
      dataChangesDuringTyping: changesDuring,
      homeRebuilds: inst.homeMutations,
      lastGoodKeystroke: lastGood && { sec: lastGood.sec, value: lastGood.value, focus: lastGood.focus },
      firstBadKeystroke: firstLoss && { sec: firstLoss.sec, typed: firstLoss.typed, value: firstLoss.value, focus: firstLoss.focus, origConnected: firstLoss.origConnected, sameEl: firstLoss.sameEl },
      finalValue: log[log.length - 1].value, finalFocus: log[log.length - 1].focus,
      draftOnServer: onServer,
      log,
      pageErrors: d.logs.filter(l => /pageerror|error:/.test(l)).slice(0, 5),
    };
    results[engine] = r;
    console.log(`\n[${engine}] typed "${TEXT}" 1 char/s over ${r.secondsTyping} s; pulls during typing at ${r.pullsDuringTyping.join(', ') || 'none'}; data changes those pulls delivered: ${changesDuring.length ? JSON.stringify(changesDuring) : 'none'}; #view-home rebuilt ${r.homeRebuilds}x`);
    if (lastGood) console.log(`  last intact keystroke at ${lastGood.sec} s: value "${lastGood.value}", focus #${lastGood.focus}`);
    if (firstLoss) console.log(`  next keystroke at ${firstLoss.sec} s: value "${firstLoss.value}", focus ${firstLoss.focus}, original <input> still in document: ${firstLoss.origConnected}`);
    else console.log('  no keystroke lost');
    console.log(`  after typing all ${TEXT.length} chars: field value "${r.finalValue}", focus ${r.finalFocus}; draft on the server: ${onServer}`);
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(OUT, 'verify2-reminder-draft.json'), JSON.stringify(results, null, 1));
