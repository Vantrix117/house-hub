// Skeptic #1 for SYNC finding "switch-race-bounces-next-person".
//   node "audits/tools/phase2/SYNC/verify-switch-race-bounces-next-person-1.mjs"
// Independent of e6: the Kitchen iPad (Eli) is on Me. A pull is started (hub.pull(), what the 30 s poll / visibilitychange do);
// the FIRST /api/data GET it sends is held for DELAY ms before it is forwarded to the Worker (a request stuck on weak Wi-Fi),
// carrying whatever X-Profile-Token the page put on it. Meanwhile Me → Switch → Ezra (kid, opens on tap).
// Every /api/ request is logged with which person's token it carried and the status it got back.
// Runs twice: delay 4000 ms (the claim) and delay 0 ms (control: same flow, normal network).
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, shot, writeEvidence } from './_util.mjs';

async function run(delay) {
  const r = { delay };
  const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
  try {
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await ipad.goto('#me');
    await waitFor(() => ipad.page.evaluate(() => hub.sync.lastPull > 0 && !!document.getElementById('switch')), { timeout: 15000 });
    const tokens = await ipad.page.evaluate(() => ({ eli: hub.session && hub.session.token }));
    const who = t => !t ? 'none' : t === tokens.eli ? 'ELI' : t === tokens.ezra ? 'EZRA' : 'other';
    const t0 = Date.now();
    const net = [];
    ipad.page.on('response', async res => {
      const u = res.url(); if (!u.includes('/api/')) return;
      const h = res.request().headers();
      net.push({ t: Date.now() - t0, method: res.request().method(), path: u.replace(/^https?:\/\/[^/]+/, ''), token: h['x-profile-token'] || null, status: res.status() });
    });
    let armed = true, held = null;
    await ipad.ctx.route(/\/api\/data\//, async route => {
      if (!(armed && route.request().method() === 'GET')) return route.continue().catch(() => {});
      armed = false;
      held = { path: route.request().url().replace(/^https?:\/\/[^/]+/, ''), token: route.request().headers()['x-profile-token'] || null, sentAt: Date.now() - t0 };
      await sleep(delay);
      held.forwardedAt = Date.now() - t0;
      return route.continue().catch(() => {});
    });
    await ipad.page.evaluate(() => { hub.pull(); });                         // the poll / wake pull
    await sleep(300);
    await ipad.page.click('#switch');                                          // Me → Switch
    await ipad.page.waitForSelector('.pcard[data-id="ezra"]', { timeout: 10000 });
    await ipad.page.click('.pcard[data-id="ezra"]');                           // Ezra taps his face
    const inAt = await waitFor(() => ipad.page.evaluate(() => hub.profile && hub.profile.id === 'ezra' && hub.session.token), { timeout: 10000 });
    tokens.ezra = inAt || null;
    r.ezraSignedInAt = Date.now() - t0;
    await sleep(6000);
    r.after = await ipad.page.evaluate(() => ({
      profile: hub.profile && hub.profile.id,
      sessionInStorage: (() => { try { const s = JSON.parse(localStorage.getItem('hub.session')); return s && s.profile && s.profile.id; } catch { return null; } })(),
      pickerShown: !document.getElementById('gate').hidden,
      pickMsg: (document.getElementById('pickmsg') || {}).textContent || null,
    }));
    r.held = held && { ...held, token: who(held.token) };
    r.net = net.map(n => ({ ...n, token: who(n.token) }));
    r.stale401 = r.net.filter(n => n.status === 401);
    r.shot = await shot(ipad.page, `verify-switch-race-1-delay${delay}.png`);
    log(`[delay ${delay} ms] held ${r.held && r.held.path} (token ${r.held && r.held.token}) sent t=${r.held && r.held.sentAt} forwarded t=${r.held && r.held.forwardedAt}; Ezra signed in t=${r.ezraSignedInAt}`);
    log(`[delay ${delay} ms] 401s: ${JSON.stringify(r.stale401)}`);
    log(`[delay ${delay} ms] 6 s later: profile=${r.after.profile} storedSession=${r.after.sessionInStorage} picker=${r.after.pickerShown} msg=${JSON.stringify(r.after.pickMsg)}  shot ${r.shot}`);
  } finally { await L.close(); }
  return r;
}
const out = { claim: await run(4000), control: await run(0) };
log('evidence', writeEvidence('verify-switch-race-bounces-next-person-1.json', out));
