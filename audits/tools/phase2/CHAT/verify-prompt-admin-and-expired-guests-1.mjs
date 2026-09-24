// Skeptic #1 for CHAT finding "prompt-admin-and-expired-guests": is the signed-in admin really not marked admin in the
// chat system prompt, and are expired guests really named in it? Runs only against the rig's local instance.
//   node "audits/tools/phase2/CHAT/verify-prompt-admin-and-expired-guests-1.mjs"
import { local, DEMO } from '../../lib/local.mjs';
import { chat, save } from './lib.mjs';

const out = {};
const line = (sys, prefix) => sys.split('\n').find(l => l.startsWith(prefix)) || null;
async function systemFor(L, pid) {
  await L.anthropicLog({ clear: true }); await L.anthropic([{ text: 'ok' }]);
  const r = await chat(L, pid, 'hello');
  const log = await L.anthropicLog();
  if (!log.length) return { status: r.status, error: r.error || r.json || null, sys: null };
  return { status: r.status, sys: log[0].body.system };
}

// A. typical: the admin (Eli) signed in
let L = await local({ variant: 'typical', clock: 'demo' });
try {
  const me = (await L.apiAs('eli', '/api/me')).body;
  const eli = await systemFor(L, 'eli');
  out.A_admin = {
    apiMe_is_admin: me.profile && me.profile.is_admin,
    householdLine: line(eli.sys, 'Household:'),
    signedInLine: line(eli.sys, 'Signed in now:'),
  };
  console.log('A. /api/me is_admin =', out.A_admin.apiMe_is_admin);
  console.log('A.', out.A_admin.householdLine);
  console.log('A.', out.A_admin.signedInLine);

  // C. natural expiry in typical: Mae adds a guest who leaves in 1 hour, then the clock moves a day on
  const add = await L.apiAs('christian', '/api/profiles', { method: 'POST', body: { name: 'Visitor Vic', emoji: '🙂', expires_at: DEMO + 3600000 } });
  const vicId = add.body && add.body.profile && add.body.profile.id;
  const before = await systemFor(L, 'christian');
  await L.clock(new Date(DEMO + 26 * 3600000).toISOString());
  const pickerMae = (await L.apiAs('christian', '/api/profiles')).body.profiles.map(p => p.name);
  const loginVic = await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: vicId } });
  const afterMae = await systemFor(L, 'christian');
  const afterKid = await systemFor(L, 'ezra');
  out.C_naturalExpiry = {
    addStatus: add.status, vicId,
    inPromptBeforeExpiry: !!(before.sys && before.sys.includes('Visitor Vic')),
    afterExpiry_inMaePicker: pickerMae.includes('Visitor Vic'),
    afterExpiry_loginStatus: loginVic.status, afterExpiry_loginError: loginVic.body && loginVic.body.error,
    afterExpiry_inMaePrompt: !!(afterMae.sys && afterMae.sys.includes('Visitor Vic')),
    afterExpiry_inEzraPrompt: !!(afterKid.sys && afterKid.sys.includes('Visitor Vic')),
    afterExpiry_householdLine_Mae: afterMae.sys ? line(afterMae.sys, 'Household:') : afterMae,
  };
  console.log('C.', JSON.stringify(out.C_naturalExpiry, null, 1));
} finally { await L.close(); }

// B. overflow: Cousin Theodore's stay ended yesterday (seed/story.mjs GUESTS.overflow expires -1)
L = await local({ variant: 'overflow', clock: 'demo' });
try {
  const pickerMae = (await L.apiAs('christian', '/api/profiles')).body.profiles.map(p => p.name);
  const loginTheo = await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: 'guest-theo' } });
  const mae = await systemFor(L, 'christian');
  out.B_overflow = {
    theoInMaePicker: pickerMae.includes('Cousin Theodore'),
    theoLoginStatus: loginTheo.status, theoLoginError: loginTheo.body && loginTheo.body.error,
    theoInMaeSystemPrompt: !!(mae.sys && mae.sys.includes('Cousin Theodore')),
    kioskInMaeSystemPrompt: !!(mae.sys && /\(kiosk\)/.test(mae.sys)),
    householdLine: line(mae.sys, 'Household:'),
  };
  console.log('B.', JSON.stringify(out.B_overflow, null, 1));
} finally { await L.close(); }

console.log('evidence:', save('verify-prompt-admin-and-expired-guests-1.json', out));
