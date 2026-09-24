// Skeptic #2 for finding "visibleto-not-server-enforced" (SEC). Independent re-run on a fresh local instance.
// Question: does anything server-side stop a kid from using an app that apps.json's visibleTo hides from them?
// The investigator's runtime probes used prayer (whose visibleTo INCLUDES ezra) and 'reminders' (not an apps.json app),
// so this script targets the apps that visibleTo really hides from kids (derived from apps.json, today: f260, dollywood).
// Run:  node "audits/tools/phase2/SEC/verify-visibleto-not-server-enforced-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/SEC/verify-visibleto-not-server-enforced-2.json');
const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8'));
const KID = 'ezra';
const hidden = reg.apps.filter(a => a.visibleTo && !a.visibleTo.includes(KID)).map(a => a.id);
const appsAsShellSends = reg.apps.map(a => ({ id: a.id, name: a.name, scope: a.scope, visibleTo: a.visibleTo }));   // index.html:1494

const parseSSE = t => String(t).split('\n\n').filter(c => c.trim()).map(c => {
  let event = 'message', data = null;
  for (const l of c.split('\n')) { if (l.startsWith('event:')) event = l.slice(6).trim(); else if (l.startsWith('data:')) { try { data = JSON.parse(l.slice(5)); } catch { data = l.slice(5); } } }
  return { event, data };
});

const L = await local({ variant: 'typical', clock: 'real' });
const out = { kid: KID, appsHiddenFromKidByVisibleTo: hidden };
try {
  const now = () => Date.now();
  const s = r => ({ status: r.status, error: r.body && r.body.error, applied: r.body && r.body.applied, items: r.body && Array.isArray(r.body.items) ? r.body.items.length : undefined });

  // 1. what already exists server-side under the kid-hidden app ids (as the admin): is there any family-scope data to leak?
  out.existingRows = {};
  for (const app of hidden) {
    out.existingRows[app] = {
      family_as_eli: (await L.apiAs('eli', `/api/data/${app}?scope=family`)).body.items?.length,
      person_as_eli: (await L.apiAs('eli', `/api/data/${app}?scope=person`)).body.items?.length,
    };
  }

  // 2. the kid, over the raw data API, on each kid-hidden app
  out.kidRawApi = {};
  for (const app of hidden) {
    const r = {};
    r.get_family = s(await L.apiAs(KID, `/api/data/${app}?scope=family`));
    r.get_person = s(await L.apiAs(KID, `/api/data/${app}?scope=person`));
    r.put_person = s(await L.apiAs(KID, `/api/data/${app}/skeptic2-probe?scope=person`, { method: 'PUT', body: { value: { by: KID }, updated_at: now() } }));
    r.put_family = s(await L.apiAs(KID, `/api/data/${app}/skeptic2-probe?scope=family`, { method: 'PUT', body: { value: { by: KID }, updated_at: now() } }));
    r.batch_family = s(await L.apiAs(KID, `/api/data/${app}/batch?scope=family`, { method: 'POST', body: { items: [{ key: 'skeptic2-batch', value: { by: KID }, updated_at: now() }] } }));
    // does the adult see the kid's family-scope row under the adults-only app id? does the kid's person write land in Eli's scope?
    const eliFam = await L.apiAs('eli', `/api/data/${app}?scope=family&key=skeptic2-probe`);
    const eliPer = await L.apiAs('eli', `/api/data/${app}?scope=person&key=skeptic2-probe`);
    r.eli_sees_kid_family_row = !!(eliFam.body.item && eliFam.body.item.value && eliFam.body.item.value.by === KID);
    r.eli_person_scope_touched = !!(eliPer.body.item && eliPer.body.item.value);
    out.kidRawApi[app] = r;
  }
  // kid person reads are keyed to the kid: Eli's F260 rows stay invisible to Ezra
  out.personBoundary = {
    f260_person_rows_eli: (await L.apiAs('eli', '/api/data/f260?scope=person')).body.items?.length,
    f260_person_rows_as_ezra: (await L.apiAs(KID, '/api/data/f260?scope=person')).body.items?.length,
  };

  // 3. controls: the gates that DO exist server-side
  out.controls = {
    kiosk_put_family: s(await L.apiAs('tv', '/api/data/f260/skeptic2-tv?scope=family', { method: 'PUT', body: { value: 1, updated_at: now() } })),
    no_profile_put: s(await L.apiAs(null, '/api/data/f260/skeptic2-np?scope=family', { method: 'PUT', body: { value: 1, updated_at: now() } })),
    no_profile_get_family: s(await L.apiAs(null, '/api/data/leftovers?scope=family')),
  };

  // 4. chat: the only server-side visibleTo check (chat.js:118-119,158,166,174) uses the apps list the CLIENT posts (chat.js:395)
  const chatAs = async (apps) => {
    await L.anthropicLog({ clear: true });
    await L.anthropic([{ tools: [{ name: 'get_data', input: { app_id: 'f260', scope: 'person' } }] }, { text: 'ok' }]);
    const r = await L.apiAs(KID, '/api/chat', { method: 'POST', body: { message: 'what is in f260', apps } });
    const ev = typeof r.body === 'string' ? parseSSE(r.body).filter(e => e.event === 'tool').map(e => e.data) : [];
    const log = await L.anthropicLog();
    const second = log[1] && log[1].body;
    let tr = null;
    if (second) { const last = second.messages[second.messages.length - 1]; const b = Array.isArray(last.content) ? last.content.find(x => x.type === 'tool_result') : null; tr = b ? b.content : null; }
    return { status: r.status, toolEvent: ev[0] || null, toolResultSentUpstream: tr };
  };
  out.chat = {
    real_apps_list: await chatAs(appsAsShellSends),
    crafted_apps_list_no_visibleTo: await chatAs(appsAsShellSends.map(({ visibleTo, ...a }) => a)),
  };
} finally {
  await L.close();
}
console.log(JSON.stringify(out, null, 1));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
