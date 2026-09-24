// Skeptic #2 for SYNC finding "switch-race-bounces-next-person" — independent reproduction.
//   node "audits/tools/phase2/SYNC/verify-switch-race-bounces-next-person-2.mjs"
// Claim: a request the iPad sent with Eli's profile token before Me → Switch, if it reaches the Worker only after Switch's
// POST /api/logout deleted Eli's session, comes back 401 profile_session_invalid; hub.request → handleAuthLoss
// (apps/hub.js:142, 147-155) then clears whatever session is current — Ezra's, who has just tapped his face — and the shell
// (index.html:771) shows the picker again with "Please choose your profile again."
// Differences from the investigator's e6: the pull is started by a plain hub.pull() (the 30 s poll's call, apps/hub.js:342),
// not a faked visibilitychange; the held request is the first /api/data GET carrying Eli's token, whatever channel it is;
// it is released on a signal (after Ezra is signed in, or earlier for the control), not after a fixed 4 s.
//   R  = held until Ezra is signed in, then released              → expect: Ezra bounced to the picker (the claim)
//   C0 = no request held (control)                                 → expect: Ezra stays signed in
//   C1 = held only until the picker is showing, released before Ezra taps → shows how long the stall must be for the bug to bite
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, shot, writeEvidence } from './_util.mjs';

async function run(mode) {
  const r = { mode, net: [] };
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const eliToken = L.S.sessions.eli.token;
    const t0 = Date.now(); const at = () => ((Date.now() - t0) / 1000).toFixed(2) + 's';
    ipad.page.on('response', res => {
      const u = res.url(); if (!u.includes('/api/')) return;
      const pt = res.request().headers()['x-profile-token'];
      r.net.push(`${at()} ${res.status()} ${res.request().method()} ${u.replace(/^https?:\/\/[^/]+/, '')} token=${pt ? (pt === eliToken ? 'ELI' : 'other') : '-'}`);
    });
    await ipad.goto('#me');
    await waitFor(() => ipad.page.evaluate(() => hub.sync.lastPull > 0 && hub.profile && hub.profile.id === 'eli'), { timeout: 15000 });
    await ipad.page.waitForSelector('#switch', { timeout: 10000 });
    await sleep(1500);                                      // let the boot pull and Home/Me requests settle

    let release; const gate = new Promise(res => { release = res; });
    let held = null;
    if (mode !== 'C0') {
      await ipad.ctx.route(/\/api\/data\/[^/?]+\?/, async route => {
        const req = route.request();
        if (held || req.method() !== 'GET' || req.headers()['x-profile-token'] !== eliToken) return route.continue().catch(() => {});
        held = { url: req.url().replace(/^https?:\/\/[^/]+/, ''), heldAt: at() };
        await gate; held.releasedAt = at();
        return route.continue().catch(() => {});
      });
    }
    r.net.push(`${at()} -- hub.pull() (the 30 s poll's call)`);
    await ipad.page.evaluate(() => { hub.pull(); });
    if (mode !== 'C0') await waitFor(() => held, { timeout: 5000 });
    r.held = held && { url: held.url, heldAt: held.heldAt };
    await sleep(200);
    r.net.push(`${at()} -- tap Me → Switch`);
    await ipad.page.click('#switch');
    await ipad.page.waitForSelector('.pcard[data-id="ezra"]', { timeout: 10000 });
    r.net.push(`${at()} -- picker showing`);
    if (mode === 'C1') { release(); await sleep(1500); r.net.push(`${at()} -- (C1) held request released while the picker is up`); await ipad.page.waitForSelector('.pcard[data-id="ezra"]', { timeout: 10000 }); r.pickMsgBeforeTap = await ipad.page.evaluate(() => (document.getElementById('pickmsg') || {}).textContent || ''); }
    await sleep(800);                                       // a child finds his face
    r.net.push(`${at()} -- Ezra taps his face`);
    await ipad.page.click('.pcard[data-id="ezra"]');
    r.ezraSignedIn = !!(await waitFor(() => ipad.page.evaluate(() => hub.profile && hub.profile.id === 'ezra'), { timeout: 10000 }));
    r.net.push(`${at()} -- hub.profile is ezra: ${r.ezraSignedIn}`);
    if (mode === 'R') { release(); r.net.push(`${at()} -- (R) held request released`); }
    await sleep(3000);
    r.after = await ipad.page.evaluate(() => ({
      profile: hub.profile && hub.profile.id,
      sessionInStorage: (() => { try { const s = JSON.parse(localStorage.getItem('hub.session')); return s && s.profile && s.profile.id; } catch { return 'err'; } })(),
      onPicker: !document.getElementById('gate').hidden,
      pickMsg: (document.getElementById('pickmsg') || {}).textContent || null,
      sync: { state: hub.sync.state, lastError: hub.sync.lastError },
    }));
    r.shot = await shot(ipad.page, `verify-switch-race-2-${mode}-ipad.png`);
    if (r.after.onPicker) {                                  // can he get back in with one more tap?
      await ipad.page.click('.pcard[data-id="ezra"]');
      r.retapSignedIn = !!(await waitFor(() => ipad.page.evaluate(() => hub.profile && hub.profile.id === 'ezra' && document.getElementById('gate').hidden), { timeout: 10000 }));
      await sleep(1500);
      r.retapStillEzra = await ipad.page.evaluate(() => !!hub.profile && hub.profile.id === 'ezra');
    }
    log(`[${mode}] held ${JSON.stringify(r.held)}; Ezra signed in ${r.ezraSignedIn}; 3 s later: ${JSON.stringify(r.after)}${r.pickMsgBeforeTap !== undefined ? '; picker message before tap: ' + JSON.stringify(r.pickMsgBeforeTap) : ''}${r.retapSignedIn !== undefined ? '; one more tap signs him in: ' + r.retapSignedIn + ' (still Ezra 1.5 s later: ' + r.retapStillEzra + ')' : ''}`);
    for (const l of r.net) log('   ', l);
  } finally { await L.close(); }
  return r;
}

const out = {};
for (const m of ['R', 'C0', 'C1']) out[m] = await run(m);
log('evidence', writeEvidence('verify-switch-race-bounces-next-person-2.json', out));
