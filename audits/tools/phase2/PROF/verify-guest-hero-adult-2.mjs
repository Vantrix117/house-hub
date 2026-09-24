// Skeptic #2 for "guest-hero-adult": does a guest's Me hero kicker read "Adult" (index.html:1249)?
// Independent of the seed: an adult adds a brand-new guest through the real POST /api/profiles (PIN-less, 7-day expiry),
// a signed-out iPhone taps that guest on the real picker, opens Me and reads the hero kicker. Controls: the seeded
// Grandma Jo (typical), a household adult (David) and the admin (Eli), plus what the picker/admin label the same guest.
//   node "audits/tools/phase2/PROF/verify-guest-hero-adult-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits', 'evidence', 'p2', 'PROF');
fs.mkdirSync(OUT, { recursive: true });
const out = { claim: 'guest Me hero kicker reads Adult', runs: [] };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  // 1. A fresh guest, created the way Me → Add a guest does it
  const made = await L.apiAs('mom', '/api/profiles', { method: 'POST', body: { name: 'Uncle Verify', emoji: '🎩', color: '#5B6FA8', expires_at: DEMO + 7 * 86400000 } });
  console.log('POST /api/profiles as mom →', made.status, JSON.stringify(made.body.profile && { id: made.body.profile.id, kind: made.body.profile.kind, is_guest: made.body.profile.is_guest, has_pin: made.body.profile.has_pin, expires_at: made.body.profile.expires_at }));
  const gid = made.body.profile.id;
  await L.sessions();   // refresh the profile list the device is seeded with

  async function viaPicker(pid, label) {
    const d = await L.device({ device: 'iphone-pwa', profile: null });   // paired, signed out → picker
    await d.goto('');
    await d.page.waitForSelector(`#profiles .pcard[data-id="${pid}"]`, { timeout: 15000 });
    const psub = await d.page.$eval(`#profiles .pcard[data-id="${pid}"] .psub`, e => e.textContent.trim());
    await d.page.click(`#profiles .pcard[data-id="${pid}"]`);
    await d.page.waitForSelector('.tab[data-tab="me"]', { state: 'visible', timeout: 15000 });
    await d.page.click('.tab[data-tab="me"]');
    await d.page.waitForSelector('#view-me .me-hero .hero-kicker', { timeout: 15000 });
    await sleep(600);
    const r = await d.page.evaluate(() => ({
      kicker: document.querySelector('#view-me .me-hero .hero-kicker').textContent.trim(),
      title: document.querySelector('#view-me .me-hero .hero-title').textContent.trim(),
      kind: hub.profile && hub.profile.kind,
      sessionIsGuest: !!(hub.session && hub.session.profile && hub.session.profile.is_guest),
      sessionExpires: hub.session && hub.session.profile && hub.session.profile.expires_at,
      guestsCard: !!document.querySelector('#guests'), rewardsCard: !!document.querySelector('#rewards'),
      photoBtnDisabled: document.querySelector('#photo-btn').disabled,
    }));
    const shot = path.join(OUT, `verify-guest-hero-adult-2-${label}-iphone-pwa.png`); await d.page.screenshot({ path: shot, scale: 'css', animations: 'disabled', caret: 'hide' });
    await d.close();
    const row = { label, pid, pickerSub: psub, ...r, shot: path.relative(ROOT, shot).replace(/\\/g, '/') };
    console.log(JSON.stringify(row));
    out.runs.push(row);
  }

  await viaPicker(gid, 'fresh-guest');
  await viaPicker('guest-grandmajo', 'seeded-grandmajo');
  // controls: signed in directly (these adults have PINs; the picker path is not the point here)
  for (const pid of ['dad', 'eli']) {
    const d = await L.device({ device: 'iphone-pwa', profile: pid });
    await d.goto('#me');
    await d.page.waitForSelector('#view-me .me-hero .hero-kicker', { timeout: 15000 });
    const kicker = await d.page.$eval('#view-me .me-hero .hero-kicker', e => e.textContent.trim());
    console.log(JSON.stringify({ label: 'control-' + pid, kicker }));
    out.runs.push({ label: 'control-' + pid, kicker });
    await d.close();
  }
  // How the admin panel labels the same guest (index.html:1594-1595)
  const adm = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  await adm.goto('#me');
  await adm.page.waitForSelector('#admin-body .row', { timeout: 15000 }).catch(() => {});
  const adminSub = await adm.page.evaluate(id => { const b = document.querySelector(`#admin-body [data-edit="${id}"]`); const row = b && b.closest('.row'); const s = row && row.querySelector('.row-sub'); return s ? s.textContent.trim() : null; }, gid);
  console.log(JSON.stringify({ label: 'admin-panel-sub-for-fresh-guest', adminSub }));
  out.adminSub = adminSub;
  await adm.close();
  fs.writeFileSync(path.join(OUT, 'verify-guest-hero-adult-2.json'), JSON.stringify(out, null, 2));
} finally {
  await L.close();
}
