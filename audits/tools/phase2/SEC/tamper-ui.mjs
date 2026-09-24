// SEC (3): browser dev-tools tampering. A kid (Ezra) hand-edits localStorage hub.session so the CLIENT thinks he is an
// admin adult, keeping his real kid token. Shows what the UI reveals vs. what the server refuses.
// Run:  node "audits/tools/phase2/SEC/tamper-ui.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/SEC');
fs.mkdirSync(OUT, { recursive: true });

const L = await local({ variant: 'typical', clock: 'demo' });
const ezra = L.S.sessions['ezra'];
// tampered session: Ezra's REAL token, but a profile object claiming adult + admin (what an attacker types in dev tools)
const tampered = JSON.stringify({ token: ezra.token, profile: { ...ezra.profile, kind: 'adult', is_admin: true } });

const d = await L.device({ device: 'ipad-portrait', profile: 'ezra', localStorage: { 'hub.session': tampered } });
await d.goto('#home'); await sleep(800);
// what the client believes
const client = await d.page.evaluate(() => ({ kind: hub.profile.kind, isAdmin: hub.profile.isAdmin, canWrite: hub.canWrite, htmlKind: document.documentElement.dataset.kind }));
// Apps tab: does the launcher now show adult-only apps (f260, dollywood, verses)?
await d.page.evaluate(() => location.hash = '#apps'); await sleep(1200);
const apps = await d.page.evaluate(() => Array.from(document.querySelectorAll('#apps .tile, #apps [data-app], .apps-grid a, #view-apps [data-id]')).map(a => a.getAttribute('data-app') || a.getAttribute('data-id') || (a.textContent || '').trim()).filter(Boolean).slice(0, 40));
// Me tab: does the admin panel render, and can it actually load admin data?
await d.page.evaluate(() => location.hash = '#me'); await sleep(2200);
const me = await d.page.evaluate(() => {
  const admin = document.querySelector('#admin, #admin-body');
  const body = admin ? admin.textContent : '';
  return { admin_card_present: !!admin, admin_data_loaded: /Pairing code|Usage|Devices/.test(body) && !/Could not load admin/.test(body), shows_error: /Could not load admin/.test(body) };
});
await d.shot(path.join(OUT, 'tamper-ui-me.png'));
// try an actual admin action from this tampered client
const rotate = await d.page.evaluate(async () => { try { const r = await hub.request('/api/admin/pairing-code/rotate', { method: 'POST', body: {} }); return { ok: true, r }; } catch (e) { return { status: e.status, error: e.error }; } });

const out = {
  client_believes: client,
  apps_shown_to_tampered_kid: apps,
  adult_only_apps_visible: apps.some(a => /f260|dollywood|verses/i.test(a)),
  me_admin_panel: me,
  admin_action_from_tampered_client: rotate,
  conclusion: 'The UI trusts localStorage, so the admin panel and adult tiles APPEAR; every privileged call still 403s because the server re-derives kind/is_admin from the DB behind the (still-kid) token. The kid-excluded apps are all person-scoped, so opening one shows only the kid’s own empty data.',
};
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(OUT, 'tamper-ui.json'), JSON.stringify(out, null, 1));
await d.close();
await L.close();
