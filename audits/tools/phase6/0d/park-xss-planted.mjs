// Batch 0d, P3-DOLLYWOOD-LIVE-01: a forced check. The Phase 3 scripts plant the payload as a guest NAME, which the Worker
// now refuses ("Names cannot contain < or >"), so they stop before the park map ever renders it. This one goes round the
// name check the way an attacker would: a guest with an ordinary name writes their own loc:<id> row straight to the
// data API with the payload in value.name / value.emoji / value.color, and a household adult writes the payload into the
// meeting point's name and note and a kid's height row. Eli then opens the map, the Family pane and the guest's card.
// Pass = nothing runs (top.XS never set), no live <img onerror>, the payload shows as text.
// Run: node "audits/tools/phase6/0d/park-xss-planted.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, openMap } from '../../phase3/dollywood-live/_lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p6/0d/park-xss-planted');
fs.mkdirSync(OUT, { recursive: true });
const PAYLOAD = '<img src=x onerror=top.XS=localStorage>';
const out = { payload: PAYLOAD };
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
try {
  const add = await L.apiAs('mom', '/api/profiles', { method: 'POST', body: { name: 'Visitor Vee' } });
  const gid = add.body.profile.id; out.guest = gid;
  out.nameCheck = (await L.apiAs('mom', '/api/profiles', { method: 'POST', body: { name: PAYLOAD } })).status;   // the Worker's own refusal
  const gdev = await L.newDevice({ name: 'Guest phone', profiles: [gid] });   // the guest signs in on their own phone
  const now = Date.now();
  const w = async (who, key, value) => (await L.apiAs(who, `/api/data/dollywood-live/${encodeURIComponent(key)}?scope=family`, { method: 'PUT', body: { value, updated_at: now }, ...(who === gid ? { deviceToken: gdev.device.token, profileToken: gdev.sessions[gid] } : {}) })).status;
  out.planted = {
    guestLoc: await w(gid, 'loc:' + gid, { x: 800, y: 850, acc: 6, t: now, name: PAYLOAD, emoji: PAYLOAD, color: 'red;background:url(x)' }),
    meet: await w('mom', 'meet', { x: 820, y: 860, name: PAYLOAD, note: PAYLOAD, by: 'mom', byName: PAYLOAD, at: now }),
    kidHeight: await w('mom', 'kid:ezra', { h: PAYLOAD, name: PAYLOAD }),
  };
  const eli = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await eli.goto('#home'); await sleep(1500);
  const ef = await openMap(eli, { settle: 2500 });
  out.cspMeta = await ef.evaluate(() => { const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]'); return m ? m.getAttribute('content').slice(0, 80) + '…' : null; });
  await ef.click('#lv-family'); await sleep(1500);
  out.familyPane = await ef.evaluate(id => ({ rowText: (document.querySelector(`#fam-list [data-f="${id}"]`) || {}).textContent || null, liveImgOnerror: document.querySelectorAll('img[onerror]').length }), gid);
  await eli.page.screenshot({ path: path.join(OUT, 'eli-family-pane-ipad.png'), scale: 'css', animations: 'disabled' });
  const row = await ef.$(`#fam-list [data-f="${gid}"]`);
  if (row) { await row.click(); await sleep(1200); }
  out.cardShown = !!row;
  await eli.page.screenshot({ path: path.join(OUT, 'eli-guest-card-ipad.png'), scale: 'css', animations: 'disabled' });
  out.afterCard = await ef.evaluate(() => ({ liveImgOnerror: document.querySelectorAll('img[onerror]').length, bodyHasPayloadText: document.body.innerText.includes('<img src=x onerror') }));
  out.executed = await eli.page.evaluate(() => !!window.XS);
  out.pass = !out.executed && out.familyPane.liveImgOnerror === 0 && out.afterCard.liveImgOnerror === 0 && out.nameCheck === 400;
} catch (e) {
  out.error = String(e && e.stack || e);
} finally {
  await L.close();
}
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(out, null, 1));
process.exit(out.pass ? 0 : 1);
