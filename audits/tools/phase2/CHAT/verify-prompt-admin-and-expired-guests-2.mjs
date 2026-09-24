// Skeptic #2 for "prompt-admin-and-expired-guests": what does the chat system prompt say about (a) the signed-in
// admin and (b) guests whose stay has ended? Independent of 05-privacy.mjs.
//   node "audits/tools/phase2/CHAT/verify-prompt-admin-and-expired-guests-2.mjs"
// Part A (overflow variant, demo clock): the seeded guest "Cousin Theodore" ended yesterday. Confirm the Worker itself
//   treats him as expired (hidden from a non-admin's GET /api/profiles, 403 guest_expired on login), then send one chat
//   message as Mom (adult), a current guest and Ezra (kid) and print the Household / Signed-in lines of each system prompt.
//   (Eli is at the daily cap in the overflow seed, so his prompt is taken in Part B.)
// Part B (typical variant): a guest added through the real POST /api/profiles, then ended by the admin's
//   PUT /api/admin/profiles/:id {expires_at: past}, the way the admin panel ends a stay; chat as Mom and as Eli (admin).
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, DEMO } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/CHAT');
fs.mkdirSync(OUT, { recursive: true });
const apps = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps;
const lines = sys => ({
  household: (sys.match(/^Household: .*$/m) || [''])[0],
  signedIn: (sys.match(/^Signed in now: .*$/m) || [''])[0],
});
async function promptAs(L, who, message = 'hello') {
  await L.anthropicLog({ clear: true });
  await L.anthropic([{ text: 'ok' }]);
  const r = await L.apiAs(who, '/api/chat', { method: 'POST', body: { message, apps } });
  const log = await L.anthropicLog();
  const sys = log[0] && log[0].body && log[0].body.system;
  const out = { status: r.status, ...(sys ? lines(sys) : { error: JSON.stringify(r.body).slice(0, 200) }) };
  console.log(`\n[${who}] chat ${r.status}\n  ${out.household || out.error}\n  ${out.signedIn || ''}`);
  return out;
}
const result = {};
const L = await local({ variant: 'overflow', clock: 'demo' });
try {
  // ── Part A ──
  const asMom = await L.apiAs('mom', '/api/profiles');
  const asEli = await L.apiAs('eli', '/api/profiles');
  const theoEli = asEli.body.profiles.find(p => p.id === 'guest-theo');
  const login = await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: 'guest-theo' } });
  result.theo = {
    inMomPicker: asMom.body.profiles.some(p => p.id === 'guest-theo'), inAdminList: !!theoEli,
    expiresAt: theoEli && new Date(theoEli.expires_at).toISOString(), login: login.status + ' ' + (login.body && login.body.error),
  };
  console.log('Cousin Theodore:', JSON.stringify(result.theo));
  result.overflow = {};
  for (const who of ['mom', 'guest-grandmajo', 'ezra']) result.overflow[who] = await promptAs(L, who);
  const got = Object.values(result.overflow).filter(p => p.household);
  result.theoInEverySentPrompt = got.length > 0 && got.every(p => /Cousin Theodore/.test(p.household));
  console.log('\nTheodore (expired) in every prompt that was sent (' + got.length + '):', result.theoInEverySentPrompt);

  // ── Part B ──
  await L.reset('typical');
  const add = await L.apiAs('mom', '/api/profiles', { method: 'POST', body: { name: 'Visiting Uncle Rob', emoji: '🎣', color: '#1F6FB2', expires_at: DEMO + 86400000 } });
  const gid = add.body && add.body.profile && add.body.profile.id;
  // the rig Worker runs on the demo clock (Tue 22 Sep 2026 08:40 NY), so "ended a minute ago" is DEMO - 60 s
  const end = await L.apiAs('eli', '/api/admin/profiles/' + gid, { method: 'PUT', body: { expires_at: DEMO - 60000 } });
  const pickMom = (await L.apiAs('mom', '/api/profiles')).body.profiles.some(p => p.id === gid);
  const momB = await promptAs(L, 'mom', 'who lives here?');
  result.typical = { added: add.status + ' ' + gid, ended: end.status, inMomPickerAfterEnd: pickMom, mom: momB, robInPrompt: /Visiting Uncle Rob/.test(momB.household) };
  console.log('\nPart B: guest ended by admin -> in Mom picker:', pickMom, '| name still in the prompt:', result.typical.robInPrompt);

  result.eli = await promptAs(L, 'eli');
  result.eliSignedInSaysAdmin = /\badmin\b/.test(result.eli.signedIn || '');
  result.eliHouseholdSaysAdmin = /Eli \(adult, admin\)/.test(result.eli.household || '');
  const me = await L.apiAs('eli', '/api/me');
  result.eliApiMe = me.body && me.body.profile && { is_admin: me.body.profile.is_admin, isAdmin: me.body.profile.isAdmin };
  console.log('\nEli signed-in line says admin:', result.eliSignedInSaysAdmin, '| household line says "Eli (adult, admin)":', result.eliHouseholdSaysAdmin, '| /api/me profile:', JSON.stringify(result.eliApiMe));
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-prompt-admin-and-expired-guests-2.json'), JSON.stringify(result, null, 1));
  await L.close();
}
