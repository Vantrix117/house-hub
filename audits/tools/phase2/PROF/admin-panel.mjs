// PROF (audit Phase 2), brief item 8: the admin panel as Eli on the Kitchen iPad. What the Edit sheet sends and offers,
// what the server would accept that the UI cannot reach (sort order, a guest's end date), and what "Reset PIN" on the
// admin's own row does (driven through the UI, accepting the native confirm()). Local rig only.
//
//   node "audits/tools/phase2/PROF/admin-panel.mjs"
//
// Evidence: audits/evidence/p2/PROF/admin-*.png and the printed observations.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const shot = async (d, name) => { const f = path.join(OUT, name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f); };
const log = (k, v) => console.log(k.padEnd(52), typeof v === 'string' ? v : JSON.stringify(v));
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false }); const { page } = d;
  const dialogs = []; page.on('dialog', dl => { dialogs.push(dl.message()); dl.accept(); });
  const sent = []; page.on('request', r => { if (r.url().includes('/api/admin/profiles/') && r.method() === 'PUT') sent.push(r.postDataJSON()); });
  await d.goto('#me'); await page.waitForSelector('#admin-body .admin-people', { timeout: 15000 });
  log('admin rows (name → buttons)', await page.evaluate(() => [...document.querySelectorAll('#admin-body .admin-people li')].map(li => li.querySelector('.row-title').textContent + ' → ' + [...li.querySelectorAll('button')].map(b => b.textContent).join('/'))));
  log('household add/remove controls in the panel', await page.evaluate(() => [...document.querySelectorAll('#admin-body button')].map(b => b.textContent).filter(t => /add|new person|delete|remove/i.test(t))));
  log('admin transfer / sort / guest end-date controls', await page.evaluate(() => ({ admin: !!document.querySelector('#admin-body [data-make-admin], #admin-body input[name=is_admin]'), sort: !!document.querySelector('#admin-body [data-sort], #admin-body [draggable=true]'), expiry: !!document.querySelector('#admin-body input[type=date]') })));

  // Edit Grandma Jo (a guest): what the Kind select offers, and what Save does with "Kid"
  await page.click('#admin-body [data-edit="guest-grandmajo"]'); await page.waitForSelector('#pform');
  log('guest Edit sheet: fields / Kind options', await page.evaluate(() => ({ fields: [...document.querySelectorAll('#pform .label')].map(l => l.textContent), kind: [...document.querySelectorAll('#pkind option')].map(o => o.textContent), kindDisabled: document.getElementById('pkind').disabled, swatchLabels: [...document.querySelectorAll('#swatches .swatch')].slice(0, 3).map(s => s.getAttribute('aria-label')) })));
  await page.selectOption('#pkind', 'kid'); await page.click('#pform button[type=submit]'); await sleep(800);
  log('guest → Kid, Save →', JSON.stringify(await page.textContent('#pmsg')) + ' | sent ' + JSON.stringify(sent.at(-1)));
  await shot(d, 'admin-edit-guest-kind.png');
  await page.keyboard.press('Escape'); await sleep(400);

  // what the server accepts that the sheet never sends
  const so = await L.apiAs('eli', '/api/admin/profiles/tv', { method: 'PUT', body: { sort_order: 0 } });
  const ex = await L.apiAs('eli', '/api/admin/profiles/guest-grandmajo', { method: 'PUT', body: { expires_at: Date.now() + 14 * 86400000 } });
  log('server: PUT sort_order / guest expires_at', `${so.status} sort_order=${so.body.profile && so.body.profile.sort_order} / ${ex.status} expires_at=${ex.body.profile && new Date(ex.body.profile.expires_at).toISOString().slice(0, 10)}`);
  const adm = await L.apiAs('eli', '/api/admin/profiles/christian', { method: 'PUT', body: { is_admin: true } });
  log('server: PUT is_admin on Mae', `${adm.status} is_admin=${adm.body.profile && adm.body.profile.is_admin}`);

  // Reset PIN on the admin's own row, through the UI
  await d.goto('#me'); await page.waitForSelector('#admin-body [data-resetpin="eli"]');
  await page.click('#admin-body [data-resetpin="eli"]'); await sleep(2500);
  log('own-row Reset PIN: confirm() text', dialogs.at(-1));
  log('own-row Reset PIN: what the iPad shows next', await page.evaluate(() => ({ gate: !document.getElementById('gate').hidden, session: !!hub.session, eliCard: (document.querySelector('#profiles .pcard[data-id="eli"] .psub') || {}).textContent || null, msg: (document.getElementById('pickmsg') || {}).textContent || null })));
  await shot(d, 'admin-after-own-reset.png');
  const claim = await L.apiAs(null, '/api/profiles/eli/pin', { method: 'POST', body: { pin: '5555' }, profileToken: null });
  log('then any paired device (no profile) claims Eli', `${claim.status} ${claim.body.profile ? 'is_admin=' + claim.body.profile.is_admin : claim.body.error}`);
  log('native dialogs seen', dialogs);
  await d.close();
} finally { await L.close(); }
