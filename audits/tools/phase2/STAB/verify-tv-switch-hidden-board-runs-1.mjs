// STAB skeptic #1 for finding "tv-switch-hidden-board-runs": after the TV board's Switch, does the hidden board keep
// working behind the picker, which of the requests are really the board's, and is the kiosk session left valid?
//   node "audits/tools/phase2/STAB/verify-tv-switch-hidden-board-runs-1.mjs"
// Three runs on one fresh local instance (WebKit, installed clocks, 6 simulated minutes with the picker up each):
//   A  TV (profile tv) → board Switch → picker. Counts DOM work on the hidden board (MutationObserver on #tv) and
//      every request by kind (data per app/scope, /api/activity, /api/media, other).
//   B  Same as A, but right after Switch the #tv node is detached (a stand-in for "the board was stopped"), so the
//      remaining requests are the ones the picker/SDK would make anyway.
//   C  Kitchen iPad as Eli → Me → Switch (hub.signOut + showPicker) → picker: the normal switch, as a baseline.
// Then GET /api/me with the kiosk's token and with Eli's token (after C's signOut).
// Output: audits/evidence/p2/STAB/verify-tv-switch-hidden-board-runs-1.json (+ .png of A's picker)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const SIM = 6 * 60000;

function tracker(d) {
  const T = { inflight: 0, list: [] };
  const kind = u => {
    const m = u.match(/\/api\/data\/([^?]+)\?scope=(\w+)/); if (m) return 'data:' + m[1] + '/' + m[2];
    if (/\/api\/activity/.test(u)) return 'activity';
    if (/\/api\/media\//.test(u)) return 'media';
    if (/\/api\//.test(u)) return 'api:' + u.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
    return 'site:' + u.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
  };
  d.page.on('request', r => { T.inflight++; T.list.push(kind(r.url())); });
  d.page.on('requestfinished', () => { T.inflight--; });
  d.page.on('requestfailed', () => { T.inflight--; });
  T.count = (from = 0) => { const o = {}; for (const k of T.list.slice(from)) o[k] = (o[k] || 0) + 1; return o; };
  return T;
}
async function settle(T, max = 3000) { const until = Date.now() + max; let q = 0; await sleep(15); while (Date.now() < until) { if (T.inflight <= 0) { if (++q >= 6) return; } else q = 0; await sleep(12); } }
// slices < 12 s so hub.request's 12 s page-clock abort never fires while the local Worker is answering
async function run(d, T, ms) { for (let t = 0; t < ms; t += 10000) { await d.ctx.clock.runFor(Math.min(10000, ms - t)); await settle(T); } }
const sum = (o, re) => Object.entries(o).filter(([k]) => re.test(k)).reduce((n, [, v]) => n + v, 0);

async function observeBoard(page) {
  return page.evaluate(() => {
    const tv = document.querySelector('#tv'); const s = window.__verifyObs = { clockWrites: 0, paints: 0, bgSrcChanges: 0, bgClassChanges: 0 };
    if (!tv) return false;
    new MutationObserver(ms => { for (const m of ms) {
      const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if (el && el.id === 'clock') s.clockWrites++;
      else if (el && el.id === 'tv-refs' && m.type === 'childList') s.paints++;        // paint() rewrites #tv-refs each time
      else if (m.type === 'attributes' && m.attributeName === 'src') s.bgSrcChanges++;
      else if (m.type === 'attributes' && m.attributeName === 'class' && el && el.classList.contains('tv-bg-img')) s.bgClassChanges++;
    } }).observe(tv, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['src', 'class'] });
    return true;
  });
}

const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const R = { note: 'WebKit, installed clock, ' + SIM / 60000 + ' simulated minutes with the picker on screen in each run' };
try {
  // ── A: the board's Switch ──
  {
    const tv = await L.device({ device: 'tv', profile: 'tv', installClock: Date.now() });
    const T = tracker(tv);
    await tv.goto('#home'); await tv.page.waitForSelector('#tv #clock'); await run(tv, T, 10000);
    const meBefore = await L.apiAs('tv', '/api/me');
    await tv.page.click('#kiosk-switch');
    await tv.page.waitForSelector('#profiles .pcard[data-id="tv"]'); await tv.ctx.clock.runFor(500); await settle(T);
    const at = await tv.page.evaluate(() => ({ gateVisible: !document.getElementById('gate').hidden, shellHidden: document.getElementById('shell').hidden,
      tvConnected: !!document.querySelector('#tv') && document.querySelector('#tv').isConnected, clock: document.getElementById('clock').textContent,
      localSession: localStorage.getItem('hub.session'), hubProfile: window.hub.profile, bg: [...document.querySelectorAll('.tv-bg-img')].map(i => (i.getAttribute('src') || '').slice(-40)) }));
    await observeBoard(tv.page);
    const from = T.list.length;
    await run(tv, T, SIM);
    const after = await tv.page.evaluate(() => ({ gateVisible: !document.getElementById('gate').hidden, clock: document.getElementById('clock').textContent,
      obs: window.__verifyObs, bg: [...document.querySelectorAll('.tv-bg-img')].map(i => (i.getAttribute('src') || '').slice(-40)) }));
    const c = T.count(from);
    const meAfter = await L.apiAs('tv', '/api/me');
    R.A_boardSwitch = { atSwitch: at, after6min: after, requestsWhilePicker: c,
      totals: { data: sum(c, /^data:/), activity: c.activity || 0, media: c.media || 0 },
      kioskMe: { beforeSwitch: meBefore.status, afterSwitchAnd6min: meAfter.status, profile: meAfter.body && meAfter.body.profile && meAfter.body.profile.id },
      pageErrors: tv.logs.filter(l => /pageerror|error:/.test(l)).slice(0, 10) };
    await tv.page.screenshot({ path: path.join(OUT, 'verify-tv-switch-hidden-board-runs-1-picker.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
    await tv.close();
  }
  // ── B: same, but the board detached right after Switch (what "stopped" would leave) ──
  {
    const tv = await L.device({ device: 'tv', profile: 'tv', installClock: Date.now() });
    const T = tracker(tv);
    await tv.goto('#home'); await tv.page.waitForSelector('#tv #clock'); await run(tv, T, 10000);
    await tv.page.click('#kiosk-switch');
    await tv.page.waitForSelector('#profiles .pcard[data-id="tv"]'); await tv.ctx.clock.runFor(500); await settle(T);
    await tv.page.evaluate(() => document.querySelector('#tv').remove());
    const from = T.list.length;
    await run(tv, T, SIM);
    const c = T.count(from);
    R.B_boardDetached = { requestsWhilePicker: c, totals: { data: sum(c, /^data:/), activity: c.activity || 0, media: c.media || 0 } };
    await tv.close();
  }
  // ── C: an adult's Me → Switch on the iPad (signOut + showPicker) ──
  {
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: Date.now() });
    const T = tracker(ipad);
    await ipad.goto('#me'); await ipad.page.waitForSelector('#switch'); await run(ipad, T, 10000);
    const meBefore = await L.apiAs('eli', '/api/me');
    await ipad.page.click('#switch');
    await ipad.page.waitForSelector('#profiles .pcard[data-id="eli"]'); await ipad.ctx.clock.runFor(500); await settle(T);
    const from = T.list.length;
    await run(ipad, T, SIM);
    const c = T.count(from);
    const meAfter = await L.apiAs('eli', '/api/me');
    R.C_adultMeSwitch = { requestsWhilePicker: c, totals: { data: sum(c, /^data:/), activity: c.activity || 0, media: c.media || 0 },
      eliMe: { beforeSwitch: meBefore.status, afterSwitch: meAfter.status, error: meAfter.body && meAfter.body.error } };
    await ipad.close();
  }
  console.log(JSON.stringify(R, null, 1));
  fs.writeFileSync(path.join(OUT, 'verify-tv-switch-hidden-board-runs-1.json'), JSON.stringify(R, null, 1));
} finally { await L.close(); }
