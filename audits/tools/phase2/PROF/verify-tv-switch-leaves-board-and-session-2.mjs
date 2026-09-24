// PROF skeptic #2 for "tv-switch-leaves-board-and-session": does the TV board's Switch leave the hidden board running and the
// kiosk session valid, and how much of that is specific to the board's Switch rather than the picker in general?
// Three fresh devices on one fresh local instance, each on its own paired device + session (so a logout in one run never
// touches another's token), each driven by a controllable clock for 6 simulated minutes at the picker:
//   A  TV, board's own Switch button (#kiosk-switch)
//   B  TV, Me → Switch (#switch, the path that calls hub.signOut → /api/logout)
//   C  Kitchen iPad as Eli (adult), Me → Switch — the generic picker baseline (no TV board ever built)
//
//   node "audits/tools/phase2/PROF/verify-tv-switch-leaves-board-and-session-2.mjs"
//
// Evidence: audits/evidence/p2/PROF/verify-tv-switch-2.json and verify-tv-switch-2-picker-tv.png. Local rig only.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const log = (k, v) => console.log(k.padEnd(58), typeof v === 'string' ? v : JSON.stringify(v));
const MIN6 = 6 * 60000;
const result = {};

const L = await local({ variant: 'typical', clock: 'real' });
try {
  async function run(label, { device, profile, via }) {
    const nd = await L.newDevice({ name: 'Verify ' + label, profiles: [profile] });
    const d = await L.device({ device, profile, installClock: Date.now(), as: nd });
    const { page } = d;
    const reqs = [];
    page.on('request', r => { const u = new URL(r.url()); if (u.origin === L.api) reqs.push({ m: r.method(), p: u.pathname + (u.pathname.startsWith('/api/data/') ? '?' + (u.searchParams.get('scope')) : ''), pt: !!r.headers()['x-profile-token'] }); });
    await d.goto('#home');
    await page.waitForSelector(profile === 'tv' ? '#kiosk-switch' : '#view-home .hero', { timeout: 15000 });
    await d.ctx.clock.runFor(3000); await sleep(300);
    const token = await page.evaluate(() => hub.session && hub.session.token);
    // count what the hidden board does after we leave it: clock text writes and backdrop src swaps
    await page.evaluate(() => {
      window.__v = { clockWrites: 0, srcSwaps: 0 };
      const c = document.getElementById('clock'); if (c) new MutationObserver(m => { window.__v.clockWrites += m.length; }).observe(c, { childList: true, characterData: true, subtree: true });
      for (const i of document.querySelectorAll('.tv-bg-img')) new MutationObserver(() => { window.__v.srcSwaps++; }).observe(i, { attributes: true, attributeFilter: ['src'] });
    });
    if (via === 'board') await page.click('#kiosk-switch');
    else { await page.evaluate(() => { location.hash = '#me'; }); await d.ctx.clock.runFor(800); await sleep(300); await page.evaluate(() => document.getElementById('switch').click()); }
    await d.ctx.clock.runFor(1500); await sleep(500);
    const at0 = await page.evaluate(() => ({ picker: !document.getElementById('gate').hidden && !!document.getElementById('profiles'), shellHidden: document.getElementById('shell').hidden,
      tvConnected: !!(document.getElementById('tv') && document.getElementById('tv').isConnected), clock: (document.getElementById('clock') || {}).textContent || null,
      session: !!hub.session, lsSession: localStorage.getItem('hub.session'), docHidden: document.hidden, tvState: window.__tv ? window.__tv.state() : null }));
    const logoutCalls = reqs.filter(r => r.p === '/api/logout').length;
    const i0 = reqs.length; await page.evaluate(() => { window.__v.clockWrites = 0; window.__v.srcSwaps = 0; });
    for (let t = 0; t < MIN6; t += 10000) { await d.ctx.clock.runFor(10000); await sleep(60); }
    await sleep(800);
    const at1 = await page.evaluate(() => ({ clock: (document.getElementById('clock') || {}).textContent || null, v: window.__v, tvState: window.__tv ? window.__tv.state() : null, stillPicker: !document.getElementById('gate').hidden }));
    const byPath = reqs.slice(i0).reduce((m, r) => { const k = r.m + ' ' + r.p + (r.pt ? ' +profile' : ''); m[k] = (m[k] || 0) + 1; return m; }, {});
    const me = token ? await L.apiAs(null, '/api/me', { deviceToken: nd.device.token, profileToken: token }) : { status: 'no token' };
    const meOtherDevice = token ? await L.apiAs(null, '/api/me', { profileToken: token }) : { status: 'no token' };   // same token presented from the rig's Kitchen iPad
    const r = { label, via, logoutCallsOnSwitch: logoutCalls, at0, at1, apiCallsIn6MinAtPicker: byPath, totalApiCalls: reqs.length - i0,
      oldTokenOnOwnDevice: `${me.status} ${me.body && me.body.profile ? me.body.profile.id : (me.body && me.body.error) || ''}`,
      oldTokenFromAnotherDevice: `${meOtherDevice.status} ${meOtherDevice.body && meOtherDevice.body.profile ? meOtherDevice.body.profile.id : (meOtherDevice.body && meOtherDevice.body.error) || ''}` };
    if (label === 'A') await page.screenshot({ path: path.join(OUT, 'verify-tv-switch-2-picker-tv.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
    await d.close();
    result[label] = r;
    log(`${label} (${via}) picker shown / #tv still connected / session`, { picker: at0.picker, tvConnected: at0.tvConnected, session: at0.session, lsSession: at0.lsSession });
    log(`${label} /api/logout calls on Switch`, String(logoutCalls));
    log(`${label} hidden clock before → after 6 min`, `${at0.clock} → ${at1.clock}  (clock writes ${at1.v.clockWrites}, backdrop src swaps ${at1.v.srcSwaps})`);
    log(`${label} API calls in 6 min at the picker (${r.totalApiCalls})`, byPath);
    log(`${label} old profile token, own device / other device`, `${r.oldTokenOnOwnDevice} / ${r.oldTokenFromAnotherDevice}`);
    return r;
  }
  await run('A', { device: 'tv', profile: 'tv', via: 'board' });
  await run('B', { device: 'tv', profile: 'tv', via: 'me' });
  await run('C', { device: 'ipad-portrait', profile: 'eli', via: 'me' });
  fs.writeFileSync(path.join(OUT, 'verify-tv-switch-2.json'), JSON.stringify(result, null, 2));
  console.log('wrote audits/evidence/p2/PROF/verify-tv-switch-2.json');
} finally { await L.close(); }
