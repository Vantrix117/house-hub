// SEC finaliser (audit Phase 2): does P2-SEC-01's PIN brute force need hand-made API requests, or does the shipped UI
// alone give more than 5 guesses per 15 minutes? Each "window" below is a fresh browser context with no hub data — the
// same thing as a new private window in Safari. In each one the attacker only uses the shipped screens: type the pairing
// code on the pairing screen, tap Eli on the picker, tap PINs on the keypad. No dev tools, no fetch, no script in the page.
// Rig setup only: the rig's PINs are random per run, so Eli's PIN is set to a known value through the admin reset +
// first-PIN routes before the attack (the attacker never sees it). Local rig only; the pairing code is a throwaway.
//
//   node "audits/tools/phase2/SEC/ui-route-multi-pair.mjs"
//
// Evidence: audits/evidence/p2/SEC/ui-route-multi-pair.json and ui-route-multi-pair-*.png (1× css scale).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/SEC');
fs.mkdirSync(OUT, { recursive: true });
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');
const shot = async (d, name) => { const f = path.join(OUT, name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return rel(f); };
const CODE = 'rig-throwaway-5519';
const PIN = '4821';
const WRONG = ['0000', '1111', '2222', '3333', '5555', '6666', '7777', '8888', '9999', '1212', '3434', '5656', '7878', '9090', '1357'];
const out = { script: 'audits/tools/phase2/SEC/ui-route-multi-pair.mjs', engine: 'webkit', device: 'iphone-safari', windows: [] };

const L = await local({ variant: 'typical', clock: 'real' });
try {
  await L.setPairingCode(CODE);
  // rig setup: give Eli a known PIN (admin self-reset, then the first-PIN route from the rig's Kitchen iPad)
  const reset = await L.apiAs('eli', '/api/admin/profiles/eli/reset-pin', { method: 'POST', body: {} });
  const create = await L.apiAs(null, '/api/profiles/eli/pin', { method: 'POST', body: { pin: PIN } });
  const adminTok = create.body.profile_token;
  const devices = async () => (await L.apiAs(null, '/api/admin/usage', { profileToken: adminTok })).body.devices.length;
  out.setup = { reset_status: reset.status, create_pin_status: create.status, devices_before: await devices() };

  let w = 0, guesses = 0;
  const typePin = async (page, pin) => { for (const ch of pin) await page.click(`#pad button[data-d="${ch}"]`); };
  const tryPin = async (page, pin) => {
    await typePin(page, pin);
    const resp = page.waitForResponse(r => r.url().endsWith('/api/login'), { timeout: 15000 });
    await page.click('#pingo');
    const r = await resp; await sleep(250);
    const shell = await page.evaluate(() => !document.getElementById('shell').hidden);
    return { pin: pin === PIN ? 'correct' : pin, http: r.status(), message: shell ? '(signed in)' : await page.textContent('#pinmsg') };
  };
  const plan = [
    { wrong: 6, correct: false },   // window 1: 5 wrong, then a 6th → locked on this "device"
    { wrong: 5, correct: false },   // window 2: a fresh window gets 5 more
    { wrong: 4, correct: true },    // window 3: 4 more wrong, then the right PIN
  ];
  for (const step of plan) {
    w++;
    const d = await L.device({ device: 'iphone-safari', profile: 'unpaired', fixedTime: false });
    const { page } = d;
    await d.goto(''); await page.waitForSelector('#pairform');
    const storedBefore = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.') && k !== 'hub.api'));
    await page.fill('#paircode', CODE); await page.click('#pairform button[type=submit]');
    await page.waitForSelector('#profiles .pcard[data-id="eli"]', { timeout: 15000 });
    const dev = await page.evaluate(() => JSON.parse(localStorage.getItem('hub.device')).id);
    await page.click('#profiles .pcard[data-id="eli"]'); await page.waitForSelector('#pad');
    const tries = [];
    for (let i = 0; i < step.wrong; i++) { tries.push(await tryPin(page, WRONG[guesses % WRONG.length])); guesses++; }
    const rec = { window: w, hub_keys_before_pairing: storedBefore, paired_via_ui_device_id: dev, tries };
    if (w === 1) rec.screenshot_locked = await shot(d, 'ui-route-multi-pair-window1-locked.png');
    if (step.correct) {
      rec.tries.push(await tryPin(page, PIN));
      await page.waitForFunction(() => window.hub && hub.profile, null, { timeout: 15000 });
      rec.signed_in_as = await page.evaluate(() => ({ id: hub.profile.id, isAdmin: hub.profile.isAdmin }));
      await page.click('.tab[data-tab="me"]'); await page.waitForSelector('#admin-body');
      await page.waitForFunction(() => !document.querySelector('#admin-body .skeleton'), null, { timeout: 15000 }).catch(() => {});
      rec.admin_route_from_page = await page.evaluate(async () => { try { const r = await hub.request('/api/admin/usage'); return { ok: true, devices: (r.devices || []).length }; } catch (e) { return { ok: false, error: e.error || e.message }; } });
      rec.admin_card_text = (await page.textContent('#admin-body')).replace(/\s+/g, ' ').trim().slice(0, 200);
      rec.screenshot_admin = await shot(d, 'ui-route-multi-pair-window3-admin.png');
    }
    out.windows.push(rec);
    await d.close();
  }
  const all = out.windows.flatMap(x => x.tries);
  out.summary = {
    windows: w,
    guesses_submitted: all.length,
    reached_verification_401: all.filter(t => t.http === 401).length,
    blocked_429: all.filter(t => t.http === 429).length,
    signed_in_200: all.filter(t => t.http === 200).length,
    devices_after: await devices(),
  };
  fs.writeFileSync(path.join(OUT, 'ui-route-multi-pair.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
} finally { await L.close(); }
