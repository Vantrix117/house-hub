// STAB skeptic #2 for finding "tv-switch-hidden-board-runs": after the TV board's Switch, does the hidden board keep
// working, is that different from the other Switch (Me -> Switch, which calls hub.signOut), and which of the network
// requests on the picker actually come from the board (index.html:1110-1116 tick, 1133 Switch, 1142 clockTimer) versus
// hub.js's own 30 s poller (apps/hub.js:342), which runs on any picker whatever the path?
//
//   node "audits/tools/phase2/STAB/verify-tv-switch-hidden-board-runs-2.mjs"
//
// Four fresh contexts on one fresh local instance (WebKit, clock:'real', each page on an installed Playwright clock,
// advanced 6 simulated minutes in 10 s slices so hub.request's 12 s abort never fires on a slice boundary):
//   D  TV board visible for 6 min (baseline: what the board costs when it is doing its job)
//   A  TV board -> #kiosk-switch -> picker for 6 min; then a kid is picked and the board is checked again
//   B  TV board -> #me -> #switch (hub.signOut + showPicker) -> picker for 6 min
//   C  adult Kitchen iPad (eli) -> #me -> #switch -> picker for 6 min (control: no board at all)
// After A and B the TV's seeded session token (the one the page held) is tried against GET /api/me.
// Finally: can the paired device alone mint a new kiosk session without a PIN (POST /api/login {profile_id:'tv'})?
// Output: audits/evidence/p2/STAB/verify-tv-switch-hidden-board-runs-2.json
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const SIX = 6 * 60000;

function track(d) {
  const T = { inflight: 0, byKind: {} };
  const kind = u => /\/api\/data\//.test(u) ? 'data' : /\/api\/activity/.test(u) ? 'activity' : /\/api\/media\//.test(u) ? 'media'
    : /\/api\//.test(u) ? 'api-other' : /\/art\/ambient\//.test(u) ? 'ambient-art' : 'site-other';
  d.page.on('request', r => { T.inflight++; const k = kind(r.url()); T.byKind[k] = (T.byKind[k] || 0) + 1; });
  d.page.on('requestfinished', () => { T.inflight--; });
  d.page.on('requestfailed', () => { T.inflight--; });
  T.snap = () => ({ ...T.byKind });
  T.diff = a => { const b = T.snap(); const o = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const n = (b[k] || 0) - (a[k] || 0); if (n) o[k] = n; } return o; };
  return T;
}
async function settle(T) { await sleep(20); let quiet = 0; const until = Date.now() + 3000; while (Date.now() < until) { if (T.inflight <= 0) { if (++quiet >= 6) return; } else quiet = 0; await sleep(12); } }
async function advance(d, T, ms) { for (let t = 0; t < ms; t += 10000) { await d.ctx.clock.runFor(Math.min(10000, ms - t)); await settle(T); } }
const boardState = d => d.page.evaluate(() => {
  const tv = document.querySelector('#tv'); const s = window.__tv && window.__tv.state();
  return { gateVisible: !document.getElementById('gate').hidden, shellHidden: document.getElementById('shell').hidden,
    tvConnected: !!(tv && tv.isConnected), clock: (document.getElementById('clock') || {}).textContent || null,
    lastPaint: s ? s.lastPaint : null, lastFade: s ? s.lastFade : null, lastFeed: s ? s.lastFeed : null,
    localSession: localStorage.getItem('hub.session') ? 'present' : null, hubProfile: window.hub && hub.profile ? hub.profile.id : null };
});
const moved = (a, b) => ({ clockChanged: a.clock !== b.clock, repainted: (b.lastPaint || 0) > (a.lastPaint || 0), crossfaded: (b.lastFade || 0) > (a.lastFade || 0), feedRefreshed: (b.lastFeed || 0) > (a.lastFeed || 0) });

const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const R = { note: 'counts are requests made by the page during the 6 simulated minutes' };
try {
  const tvToken = L.S.info.sessions.tv;
  // ── D: visible board baseline ──
  {
    const d = await L.device({ device: 'tv', profile: 'tv', installClock: Date.now() }); const T = track(d);
    await d.goto('#home'); await d.page.waitForSelector('#tv #clock'); await advance(d, T, 10000);
    const s0 = await boardState(d); const c0 = T.snap(); await advance(d, T, SIX); const s1 = await boardState(d);
    R.D_visibleBoard = { before: s0, after: s1, ...moved(s0, s1), requests: T.diff(c0) };
    await d.close();
  }
  // ── A: board Switch ──
  {
    const d = await L.device({ device: 'tv', profile: 'tv', installClock: Date.now() }); const T = track(d);
    await d.goto('#home'); await d.page.waitForSelector('#tv #clock'); await advance(d, T, 10000);
    await d.page.click('#kiosk-switch'); await d.page.waitForSelector('#profiles .pcard[data-id="ezra"]'); await d.ctx.clock.runFor(500); await settle(T);
    const s0 = await boardState(d); const c0 = T.snap(); await advance(d, T, SIX); const s1 = await boardState(d);
    const me = await L.apiAs('tv', '/api/me', { profileToken: tvToken });
    R.A_boardSwitch = { atSwitch: s0, after6min: s1, ...moved(s0, s1), requests: T.diff(c0), tvTokenAfter: { status: me.status, profile: me.body && me.body.profile && me.body.profile.id } };
    // the orphaned token is bound to this device (worker/src/auth.js:91): try it from another paired device (before B revokes it)
    const other = await L.apiAs('tv', '/api/me', { profileToken: tvToken, deviceToken: (await L.newDevice({ name: 'Other device', profiles: [] })).device.token });
    R.A_orphanTokenFromAnotherDevice = { status: other.status, error: other.body && other.body.error };
    // then someone picks a kid: renderHome clears clockTimer (index.html:976) and replaces the view
    await d.page.click('#profiles .pcard[data-id="ezra"]'); await d.page.waitForSelector('#kid-apps', { timeout: 10000 }); await settle(T);
    const k0 = await boardState(d); const kc = T.snap(); await advance(d, T, 2 * 60000); const k1 = await boardState(d);
    R.A_afterPickingKid = { before: k0, after2min: k1, lastPaintAdvanced: (k1.lastPaint || 0) > (k0.lastPaint || 0), lastFadeAdvanced: (k1.lastFade || 0) > (k0.lastFade || 0), requests: T.diff(kc) };
    await d.close();
  }
  // ── B: Me -> Switch on the TV (the path the finding calls correct) ──
  {
    const d = await L.device({ device: 'tv', profile: 'tv', installClock: Date.now() }); const T = track(d);
    await d.goto('#home'); await d.page.waitForSelector('#tv #clock'); await advance(d, T, 10000);
    await d.page.evaluate(() => { location.hash = '#me'; }); await d.page.waitForSelector('#switch', { state: 'attached' });
    await d.page.evaluate(() => document.getElementById('switch').click()); await d.page.waitForSelector('#profiles .pcard[data-id="ezra"]'); await d.ctx.clock.runFor(500); await settle(T);
    const s0 = await boardState(d); const c0 = T.snap(); await advance(d, T, SIX); const s1 = await boardState(d);
    const me = await L.apiAs('tv', '/api/me', { profileToken: tvToken });
    R.B_meSwitch = { atSwitch: s0, after6min: s1, ...moved(s0, s1), requests: T.diff(c0), tvTokenAfter: { status: me.status, error: me.body && me.body.error } };
    await d.close();
  }
  // ── C: adult iPad Me -> Switch, no board ever built (control for hub.js's own poller) ──
  {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: Date.now() }); const T = track(d);
    await d.goto('#home'); await d.page.waitForSelector('#view-home .hero', { timeout: 15000 }).catch(() => {}); await advance(d, T, 10000);
    await d.page.evaluate(() => { location.hash = '#me'; }); await d.page.waitForSelector('#switch', { state: 'attached' });
    await d.page.evaluate(() => document.getElementById('switch').click()); await d.page.waitForSelector('#profiles .pcard'); await d.ctx.clock.runFor(500); await settle(T);
    const c0 = T.snap(); await advance(d, T, SIX);
    const ch = await d.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.cache.')).length);
    R.C_adultIpadMeSwitch_noBoard = { requests: T.diff(c0), tvConnected: await d.page.evaluate(() => !!document.querySelector('#tv')), cacheKeys: ch };
    await d.close();
  }
  // ── the orphaned kiosk token vs what the paired device can do anyway ──
  const fresh = await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: 'tv' } });
  R.kioskLoginWithDeviceTokenOnly = { status: fresh.status, gotToken: !!(fresh.body && fresh.body.profile_token), kind: fresh.body && fresh.body.profile && fresh.body.profile.kind };
  console.log(JSON.stringify(R, null, 1));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'verify-tv-switch-hidden-board-runs-2.json'), JSON.stringify(R, null, 1));
} finally { await L.close(); }
