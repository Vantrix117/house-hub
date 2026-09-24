// PROF skeptic #1: "Any paired device, with no one signed in, can claim an adult who has no PIN" (pin-claim-any-device).
// Independent reproduction on a fresh local instance (typical seed, real clock). Local rig only.
//
//   node "audits/tools/phase2/PROF/verify-pin-claim-any-device-1.mjs"
//
// A. UI: Ezra (kid) is signed in on the Kitchen iPad → Me → Switch → taps Mea (no PIN) → types 1111 twice → lands where?
// B. Mea later, on her own phone: create PIN via API and log in with her own choice via the UI.
// C. Admin resets David's PIN; on the TV (kiosk signed in, its own device token) someone presses Switch → David → 9999 twice.
// D. API-only: the endpoint ignores the profile token (kid token, no token, kiosk token), and a claimed profile answers 409.
// Evidence: audits/evidence/p2/PROF/verify-pin-claim-*.png + verify-pin-claim-any-device-1.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const R = {};
const log = (k, v) => { R[k] = v; console.log(k.padEnd(52), typeof v === 'string' ? v : JSON.stringify(v)); };
const shot = async (d, name) => { const f = path.join(OUT, name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f).replace(/\\/g, '/'); };
const typePin = async (page, pin) => { for (const k of pin) await page.click(`#pad [data-d="${k}"]`); await page.click('#pingo'); await sleep(400); };

const L = await local({ variant: 'typical', clock: 'real' });
try {
  const prof = await L.apiAs(null, '/api/profiles', { profileToken: null });
  const list = prof.body.profiles || prof.body;
  log('0. seed: adults and has_pin', Object.fromEntries(list.filter(p => p.kind === 'adult').map(p => [p.id, p.has_pin])));

  // ── A. a kid on the Kitchen iPad claims Mea through the UI ──
  { const d = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false }); const { page } = d;
    await d.goto('#me'); await page.waitForSelector('#switch', { timeout: 15000 });
    log('A1. signed in as', await page.evaluate(() => ({ id: hub.profile.id, kind: hub.profile.kind, htmlKind: document.documentElement.dataset.kind })));
    await page.click('#switch'); await page.waitForSelector('#profiles .pcard[data-id="niece"]', { timeout: 10000 });
    log('A2. Mea card label on picker', await page.textContent('#profiles .pcard[data-id="niece"] .psub'));
    await page.click('#profiles .pcard[data-id="niece"]'); await page.waitForSelector('#pad');
    log('A3. pad title / hint', `${await page.textContent('.pin-who h2')} / ${await page.textContent('#pinhint')}`);
    await typePin(page, '1111');
    log('A4. after first 1111 hint', await page.textContent('#pinhint'));
    await typePin(page, '1111');
    await page.waitForFunction(() => !document.getElementById('shell').hidden, null, { timeout: 10000 });
    await sleep(800);
    const who = await page.evaluate(() => ({ id: hub.profile.id, kind: hub.profile.kind, htmlKind: document.documentElement.dataset.kind || null, tabs: [...document.querySelectorAll('.tab')].map(t => t.dataset.tab) }));
    await page.evaluate(() => { location.hash = '#apps'; }); await sleep(800);
    who.apps = await page.evaluate(() => [...document.querySelectorAll('#grid .tile')].map(t => t.dataset.id));
    log('A5. after the kid typed 1111 twice, shell is', who);
    const me = await page.evaluate(async () => { const s = JSON.parse(localStorage.getItem('hub.session')); const dv = JSON.parse(localStorage.getItem('hub.device')); const api = JSON.parse(localStorage.getItem('hub.api'));
      const r = await fetch(api + '/api/me', { headers: { 'X-Device-Token': dv.token, 'X-Profile-Token': s.token } }); return { status: r.status, body: await r.json() }; });
    log('A6. server /api/me with the new session', `${me.status} ${JSON.stringify(me.body.profile && { id: me.body.profile.id, kind: me.body.profile.kind, has_pin: me.body.profile.has_pin })}`);
    R.shotA = await shot(d, 'verify-pin-claim-kid-as-mea-ipad.png');
    await d.close(); }

  // ── B. the real Mea, on her own newly paired phone ──
  { const mp = await L.newDevice({ name: "Mea's iPhone (rig)", profiles: [] });
    const r1 = await L.apiAs(null, '/api/profiles/niece/pin', { method: 'POST', body: { pin: '4321' }, deviceToken: mp.device.token, profileToken: null });
    log('B1. Mea creates her own PIN 4321 (API)', `${r1.status} ${r1.body.error}: ${r1.body.message}`);
    const d = await L.device({ device: 'iphone-pwa', profile: null, fixedTime: false, as: mp }); const { page } = d;
    await d.goto(''); await page.waitForSelector('#profiles .pcard[data-id="niece"]', { timeout: 15000 });
    log('B2. Mea card label on her phone', await page.textContent('#profiles .pcard[data-id="niece"] .psub'));
    await page.click('#profiles .pcard[data-id="niece"]'); await page.waitForSelector('#pad');
    log('B3. pad title / hint', `${await page.textContent('.pin-who h2')} / ${await page.textContent('#pinhint')}`);
    await typePin(page, '4321'); await sleep(600);
    log('B4. Mea types 4321 → message', await page.textContent('#pinmsg'));
    R.shotB = await shot(d, 'verify-pin-claim-mea-locked-out-iphone.png');
    await d.close(); }

  // ── C. admin resets David; someone at the TV presses Switch and claims him ──
  { const rs = await L.apiAs('eli', '/api/admin/profiles/dad/reset-pin', { method: 'POST', body: {} });
    log('C1. Eli resets David\'s PIN', `${rs.status} ${JSON.stringify(rs.body)}`);
    const tv = await L.newDevice({ name: 'Downstairs TV (rig)', profiles: ['tv'] });
    const d = await L.device({ device: 'tv', profile: 'tv', fixedTime: false, as: tv }); const { page } = d;
    await d.goto(''); await page.waitForSelector('#kiosk-switch', { timeout: 15000 });
    log('C2. TV signed in as', await page.evaluate(() => ({ id: hub.profile.id, kind: hub.profile.kind })));
    await page.click('#kiosk-switch'); await page.waitForSelector('#profiles .pcard[data-id="dad"]', { timeout: 10000 });
    log('C3. David card label on the TV picker', await page.textContent('#profiles .pcard[data-id="dad"] .psub'));
    await page.click('#profiles .pcard[data-id="dad"]'); await page.waitForSelector('#pad');
    await typePin(page, '9999'); await typePin(page, '9999');
    await page.waitForFunction(() => !document.getElementById('shell').hidden, null, { timeout: 10000 }); await sleep(600);
    log('C4. TV shell after 9999 twice', await page.evaluate(() => ({ id: hub.profile.id, kind: hub.profile.kind, device: JSON.parse(localStorage.getItem('hub.device')).name })));
    // what the claimer can now read of David's own (person-scope) data and chat history
    const priv = await page.evaluate(async () => { const s = JSON.parse(localStorage.getItem('hub.session')); const dv = JSON.parse(localStorage.getItem('hub.device')); const api = JSON.parse(localStorage.getItem('hub.api'));
      const h = { 'X-Device-Token': dv.token, 'X-Profile-Token': s.token }; const out = {};
      for (const app of ['hub', 'f260', 'prayer', 'verses', 'leftovers', 'kidverse']) { const r = await fetch(`${api}/api/data/${app}?scope=person`, { headers: h }); const j = await r.json(); out[app] = r.status === 200 ? (j.items || []).filter(i => !i.deleted).length : r.status; }
      const ch = await fetch(`${api}/api/chat/history`, { headers: h }); const cj = await ch.json(); out.chatHistory = ch.status === 200 ? (cj.messages || cj.history || cj.items || []).length : ch.status;
      return out; });
    log('C4b. David\'s person-scope rows / chat msgs readable from the TV', priv);
    R.shotC = await shot(d, 'verify-pin-claim-tv-as-david.png');
    await d.close();
    const dv = await L.apiAs(null, '/api/profiles/dad/pin', { method: 'POST', body: { pin: '1234' }, profileToken: null });
    log('C5. David then creates his PIN (Kitchen iPad token)', `${dv.status} ${dv.body.error}`); }

  // ── D. API: which credentials are needed? ──
  await L.apiAs('eli', '/api/admin/profiles/mom/reset-pin', { method: 'POST', body: {} });
  const noDev = await L.apiAs(null, '/api/profiles/mom/pin', { method: 'POST', body: { pin: '5555' }, deviceToken: null, profileToken: null });
  log('D1. no device token at all', `${noDev.status} ${noDev.body.error}`);
  // (the rig's own Ezra session was signed out by Switch in A, so use a fresh device with a live kid session)
  const kidDev = await L.newDevice({ name: "Ezra's tablet (rig)", profiles: ['ezra'] });
  const kidTok = await L.apiAs(null, '/api/profiles/mom/pin', { method: 'POST', body: { pin: '5555' }, deviceToken: kidDev.device.token, profileToken: kidDev.sessions.ezra });
  log('D2. device token + Ezra\'s (kid) profile token', `${kidTok.status} ${kidTok.body.error || ('→ ' + kidTok.body.profile.id + ' kind=' + kidTok.body.profile.kind)}`);
  const kidGuard = await L.apiAs(null, '/api/profiles/ezra/pin', { method: 'POST', body: { pin: '5555' }, profileToken: null });
  log('D3. PIN on a kid profile', `${kidGuard.status} ${kidGuard.body.error}`);
  const burst = []; for (let i = 0; i < 8; i++) burst.push((await L.apiAs(null, '/api/profiles/mom/pin', { method: 'POST', body: { pin: String(6000 + i) }, profileToken: null })).status);
  log('D4. 8 more create calls on the claimed profile', burst.join(','));

  fs.writeFileSync(path.join(OUT, 'verify-pin-claim-any-device-1.json'), JSON.stringify(R, null, 1));
} finally { await L.close(); }
