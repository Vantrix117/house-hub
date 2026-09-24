// Skeptic #1 for SEC finding "visibleto-not-server-enforced": is visibleTo only a UI filter, with no per-profile app gate
// on the data API? Uses ONLY app ids whose apps.json visibleTo EXCLUDES the kid (f260, dollywood), so a 200 here is a
// genuine visibleTo bypass (the investigator's prayer/reminders probes are not: prayer lists the kids, reminders is not
// an apps.json app). Also checks whether chat's "server-side" visibleTo re-check trusts the client-sent apps list.
// Run:  node "audits/tools/phase2/SEC/verify-visibleto-not-server-enforced-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT } from '../../lib/local.mjs';

const APPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps;
const vis = id => (APPS.find(a => a.id === id) || {}).visibleTo;
const out = { visibleTo: { f260: vis('f260'), dollywood: vis('dollywood'), prayer: vis('prayer') } };
out.kid_excluded = { f260: !vis('f260').includes('ezra'), dollywood: !vis('dollywood').includes('ezra') };

const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  const now = () => Date.now();
  // 1. Kid reads/writes his OWN person scope of adult-only apps
  out.ezra_get_f260_person = await L.apiAs('ezra', '/api/data/f260?scope=person').then(r => ({ status: r.status, items: r.body.items && r.body.items.length }));
  out.ezra_put_f260_person = await L.apiAs('ezra', '/api/data/f260/probe?scope=person', { method: 'PUT', body: { value: { by: 'ezra' }, updated_at: now() } }).then(r => ({ status: r.status, applied: r.body.applied, error: r.body.error }));
  out.ezra_put_dollywood_person = await L.apiAs('ezra', '/api/data/dollywood/probe?scope=person', { method: 'PUT', body: { value: { by: 'ezra' }, updated_at: now() } }).then(r => ({ status: r.status, applied: r.body.applied, error: r.body.error }));

  // 2. Does any adult-only app hold FAMILY-scope rows today? (the only place a kid could read others' data)
  out.family_rows_today = {
    f260: await L.apiAs('eli', '/api/data/f260?scope=family').then(r => r.body.items.length),
    dollywood: await L.apiAs('eli', '/api/data/dollywood?scope=family').then(r => r.body.items.length),
  };

  // 3. The failure scenario, with a real adult-only app id: an adult stores a family-scope row under f260,
  //    the kid lists f260 family scope over the raw API.
  await L.apiAs('eli', '/api/data/f260/adults-only-note?scope=family', { method: 'PUT', body: { value: { text: 'grown-ups only' }, updated_at: now() } });
  out.ezra_reads_adult_family_row = await L.apiAs('ezra', '/api/data/f260?scope=family').then(r => ({ status: r.status, items: (r.body.items || []).map(i => ({ key: i.key, value: i.value })) }));
  out.ezra_overwrites_adult_family_row = await L.apiAs('ezra', '/api/data/f260/adults-only-note?scope=family', { method: 'PUT', body: { value: { text: 'kid was here' }, updated_at: now() + 1000 } }).then(r => ({ status: r.status, applied: r.body.applied }));
  out.eli_sees_after = await L.apiAs('eli', '/api/data/f260?scope=family&key=adults-only-note').then(r => r.body.item && r.body.item.value);
  //    an app id that is not in apps.json at all is accepted too (the Worker never consults apps.json)
  out.ezra_put_unknown_app = await L.apiAs('ezra', '/api/data/budget/item:1?scope=family', { method: 'PUT', body: { value: { amt: 1 }, updated_at: now() } }).then(r => ({ status: r.status, applied: r.body.applied }));

  // 4. The real boundary: person scope is keyed to the caller. Eli's own f260 person rows vs what Ezra gets.
  const eliKeys = await L.apiAs('eli', '/api/data/f260?scope=person').then(r => r.body.items.map(i => i.key));
  const ezraKeys = await L.apiAs('ezra', '/api/data/f260?scope=person').then(r => r.body.items.map(i => i.key));
  out.person_scope_isolated = { eli_rows: eliKeys.length, ezra_rows: ezraKeys, ezra_sees_eli_row: eliKeys.some(k => ezraKeys.includes(k) && k !== 'probe') };

  // 5. Guests: the server only widens visibleTo for chat; the data API has no gate for them either
  const S = L.S; const guest = Object.keys(S.info.sessions).find(k => k.startsWith('guest-'));
  if (guest) out.guest_reads_f260_family = await L.apiAs(guest, '/api/data/f260?scope=family').then(r => ({ guest, status: r.status, items: (r.body.items || []).length }));

  // 6. Chat: the kid guard (chat.js:174) uses the apps list the CLIENT sends. Same scripted tool call, two apps lists.
  const chatAs = async apps => {
    await L.anthropic([{ tools: [{ name: 'set_data', input: { app_id: 'f260', scope: 'person', key: 'chatprobe', value: { apps: apps[0].visibleTo ? 'honest' : 'forged' } } }] }, { text: 'ok' }]);
    await L.anthropicLog({ clear: true });
    const r = await L.apiAs('ezra', '/api/chat', { method: 'POST', body: { message: 'save it', apps } });
    const log = await L.anthropicLog();
    const toolResult = JSON.stringify(log.map(e => (e.body.messages || []).flatMap(m => Array.isArray(m.content) ? m.content.filter(b => b.type === 'tool_result') : [])).flat()).slice(0, 300);
    const row = await L.apiAs('ezra', '/api/data/f260?scope=person&key=chatprobe').then(x => x.body.item && x.body.item.value);
    return { status: r.status, toolResult, row };
  };
  out.chat_honest_apps = await chatAs([{ id: 'f260', name: 'F260', scope: 'person', visibleTo: vis('f260') }]);
  await L.apiAs('ezra', '/api/data/f260/chatprobe?scope=person', { method: 'DELETE' });
  out.chat_forged_apps = await chatAs([{ id: 'f260', name: 'F260', scope: 'person' }]);
} finally {
  await L.close();
}
console.log(JSON.stringify(out, null, 1));
const dir = path.join(ROOT, 'audits/evidence/p2/SEC');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'verify-visibleto-not-server-enforced-1.json'), JSON.stringify(out, null, 1));
