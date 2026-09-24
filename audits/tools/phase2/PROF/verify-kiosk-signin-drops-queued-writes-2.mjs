// PROF skeptic #2 for finding "kiosk-signin-drops-queued-writes": an adult's offline family writes are queued on the shared
// iPad; the adult taps Me → Switch; the iPad reconnects at the picker; someone taps Downstairs TV (kiosk). Does the kiosk's
// first flush drop the adult's queue? Control: the same flow but the next person is Ezra (a kid, a writer).
// Local rig only (typical seed, real clock), fresh instance, driven through the UI.
//
//   node "audits/tools/phase2/PROF/verify-kiosk-signin-drops-queued-writes-2.mjs"
//
// Evidence: audits/evidence/p2/PROF/verify2-kiosk-*.png (1x css) and verify2-kiosk-drops-queue.json.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const shot = async (d, name) => { const f = path.join(OUT, name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f).replace(/\\/g, '/'); };
const R = {};
const log = (k, v) => { R[k] = v; console.log(k.padEnd(62), typeof v === 'string' ? v : JSON.stringify(v)); };

const L = await local({ variant: 'typical', clock: 'real' });
try {
  const writer = L.S.sessions.christian ? 'christian' : 'eli';
  log('0. offline writer (a preloaded adult session on the rig iPad)', writer);

  async function run(tag, nextId) {
    const d = await L.device({ device: 'ipad-portrait', profile: writer, fixedTime: false });
    const { page } = d;
    const posts = [];
    page.on('response', async r => {
      const u = new URL(r.url());
      if (u.origin !== L.api || r.request().method() !== 'POST') return;
      if (!/\/batch$|\/api\/activity$|\/api\/logout$|\/api\/login$/.test(u.pathname)) return;
      let body = ''; try { body = (await r.text()).replace(/"profile_token":"[^"]*"/, '"profile_token":"(redacted)"').slice(0, 160); } catch {}
      posts.push({ path: u.pathname + u.search, status: r.status(), body });
    });
    await d.goto('#home');
    await page.waitForFunction(() => !document.getElementById('shell').hidden && window.hub && hub.sync.lastPull > 0, null, { timeout: 20000 });

    // offline: add a reminder through the Home UI, and a fridge item via the SDK the Larder app uses (family scope)
    await d.setOffline(true);
    const text = `${tag} offline: dentist 3pm ${Date.now()}`;
    await page.fill('#remtext', text); await page.press('#remtext', 'Enter'); await sleep(400);
    const fridge = `${tag}-fridge-${Date.now()}`;
    await page.evaluate(k => hub.set('item:' + k, { id: k, name: 'Soup ' + k, addedAt: Date.now() }, { app: 'leftovers', scope: 'family' }), fridge);
    await sleep(300);
    const q0 = await page.evaluate(() => ({ rem: Object.keys(JSON.parse(localStorage.getItem('hub.queue.reminders.family') || '{}')).length, left: Object.keys(JSON.parse(localStorage.getItem('hub.queue.leftovers.family') || '{}')).length, act: (JSON.parse(localStorage.getItem('hub.activityQueue') || '[]')).map(a => a.text), sync: { ...hub.sync } }));
    log(`${tag} 1. queued offline (reminders / leftovers / activity)`, q0);

    // Me → Switch (still offline), then the iPad comes back online at the picker
    await page.click('.tab[data-tab="me"]'); await page.waitForSelector('#switch'); await page.click('#switch');
    await page.waitForSelector(`#profiles .pcard[data-id="${nextId}"]`, { timeout: 15000 });
    await d.setOffline(false); await sleep(1500);
    const atPicker = (((await L.apiAs('eli', '/api/data/reminders?scope=family')).body.items) || []).some(i => i.value && i.value.text === text);
    log(`${tag} 2. online at the picker for 1.5 s: reminder on server?`, String(atPicker));
    // record every sync-state change from here on (listeners survive hub.reset())
    await page.evaluate(() => { window.__syncLog = []; hub.onSync(s => window.__syncLog.push({ state: s.state, pending: s.pending, lastError: s.lastError })); });
    const tapAt = posts.length;
    await page.click(`#profiles .pcard[data-id="${nextId}"]`);
    await page.waitForFunction(i => !document.getElementById('shell').hidden && window.hub && hub.profile && hub.profile.id === i, nextId, { timeout: 15000 });
    await sleep(4000);
    const st = await page.evaluate(() => ({ profile: hub.profile.id, kind: hub.profile.kind, sync: { ...hub.sync }, syncLog: window.__syncLog,
      queues: { rem: JSON.parse(localStorage.getItem('hub.queue.reminders.family') || 'null'), left: JSON.parse(localStorage.getItem('hub.queue.leftovers.family') || 'null') },
      act: (JSON.parse(localStorage.getItem('hub.activityQueue') || '[]')).map(a => a.text),
      dot: (() => { const e = document.querySelector('#syncdot, .syncdot, [data-sync]'); return e ? (e.className + ' ' + (e.getAttribute('title') || e.getAttribute('aria-label') || '')) : null; })(),
      toast: (() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; })() }));
    log(`${tag} 3. after ${nextId} signed in (4 s): profile / sync`, { profile: st.profile, kind: st.kind, sync: st.sync });
    log(`${tag} 3. sync-state changes seen by hub.onSync`, st.syncLog);
    log(`${tag} 3. POSTs to the API after the card tap (status, body)`, posts.slice(tapAt));
    log(`${tag} 3. localStorage family queues now`, st.queues);
    log(`${tag} 3. activity queue now`, st.act);
    log(`${tag} 3. sync dot / visible toast`, { dot: st.dot, toast: st.toast });
    const rem = (((await L.apiAs('eli', '/api/data/reminders?scope=family')).body.items) || []).find(i => i.value && i.value.text === text);
    const left = (await L.apiAs('eli', `/api/data/leftovers?scope=family&key=item:${fridge}`)).body.item;
    log(`${tag} 4. server: reminder landed?`, rem ? `yes (byName=${rem.value.byName})` : 'NO');
    log(`${tag} 4. server: fridge item landed?`, left && left.value ? 'yes' : 'NO');
    R[tag + '.shot'] = await shot(d, `verify2-kiosk-${tag}-after-${nextId}.png`);
    return { d, page, text };
  }

  // A. next person = Downstairs TV (kiosk)
  const A = await run('A', 'tv');
  // A'. then someone switches the display to Ezra and Ezra does something that writes a feed line: whose name does the adult's queued line get?
  await A.page.click('#kiosk-switch'); await A.page.waitForSelector('#profiles .pcard[data-id="ezra"]', { timeout: 15000 });
  await A.page.click('#profiles .pcard[data-id="ezra"]');
  await A.page.waitForFunction(() => !document.getElementById('shell').hidden && window.hub && hub.profile && hub.profile.id === 'ezra', null, { timeout: 15000 });
  await sleep(1500);
  await A.page.evaluate(() => hub.activity('Ezra ping (verify2)'));
  await sleep(1500);
  const feed = (await L.apiAs('eli', '/api/activity?limit=50')).body.activity.filter(a => a.text.includes(A.text) || a.text.includes('Ezra ping (verify2)')).map(a => `${a.profile_id} (${a.name}): ${a.text}`);
  log("A' 5. feed after Ezra's next hub.activity (newest first)", feed);
  const remLater = (((await L.apiAs('eli', '/api/data/reminders?scope=family')).body.items) || []).some(i => i.value && i.value.text === A.text);
  log("A' 5. server: reminder landed after a writer signed in?", String(remLater));
  await A.d.close();

  // B. control: next person = Ezra (kid, a writer)
  const B = await run('B', 'ezra');
  await B.d.close();

  fs.writeFileSync(path.join(OUT, 'verify2-kiosk-drops-queue.json'), JSON.stringify(R, null, 1));
  console.log('evidence: audits/evidence/p2/PROF/verify2-kiosk-drops-queue.json');
} finally { await L.close(); }
