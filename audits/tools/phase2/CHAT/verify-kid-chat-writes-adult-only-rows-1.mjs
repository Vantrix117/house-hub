// Skeptic #1 for finding "kid-chat-writes-adult-only-rows" (audit Phase 2, CHAT). Independent of 02-kid.mjs.
// Signed in as Ezra (kid) on the rig's local instance, a scripted upstream (the Anthropic mock) asks the Worker's chat
// loop for set_data calls on park-map rows the kid UI never writes, then checks the server state as Eli.
// Controls: the same kid's finish_leftover (refused by KID_TOOLS), the rally route (adult-only server-side), and the
// raw /api/data PUT with the kid's own token (to see whether chat adds a capability or only a path).
// Finally an adult iPhone opens the park map to see whether the kid-written meeting point is what the family sees.
//   node "audits/tools/phase2/CHAT/verify-kid-chat-writes-adult-only-rows-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'CHAT');
fs.mkdirSync(EVID, { recursive: true });

const APPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps.map(a => ({ id: a.id, name: a.name, scope: a.scope, visibleTo: a.visibleTo }));   // as index.html sends it
const sse = t => String(t).split('\n\n').filter(Boolean).map(c => { let e = 'message', d = null; for (const l of c.split('\n')) { if (l.startsWith('event:')) e = l.slice(6).trim(); else if (l.startsWith('data:')) { try { d = JSON.parse(l.slice(5)); } catch { d = l.slice(5); } } } return { e, d }; });

const L = await local({ variant: 'park', clock: 'real' });
const out = { runAt: new Date().toISOString(), steps: [] };
const note = (k, v) => { out.steps.push({ k, v }); console.log(k.padEnd(52), JSON.stringify(v).slice(0, 700)); };
const get = async (pid, app, scope, key) => (await L.apiAs(pid, `/api/data/${app}?scope=${scope}&key=${encodeURIComponent(key)}`)).body.item;
const tool = async (pid, name, input, message) => {
  await L.anthropicLog({ clear: true });
  await L.anthropic([{ tools: [{ name, input }] }, { text: 'Okay!' }]);
  const r = await L.apiAs(pid, '/api/chat', { method: 'POST', body: { message, apps: APPS } });
  const ev = sse(typeof r.body === 'string' ? r.body : '');
  const t = (ev.find(x => x.e === 'tool') || {}).d || null;
  const log = await L.anthropicLog();
  const second = log[1] && log[1].body; const last = second && second.messages[second.messages.length - 1];
  const tr = last && Array.isArray(last.content) ? last.content.find(b => b.type === 'tool_result') : null;
  return { http: r.status, ok: t && t.ok, chip: t && t.chip, toolResult: tr && tr.content, system: log[0] && log[0].body.system };
};
try {
  const me = await L.apiAs('ezra', '/api/me');
  note('ezra /api/me kind', me.body.profile && me.body.profile.kind);

  // What the model could learn first: kids may get_data on the park map (canUse), so the meet row's shape is discoverable.
  const peek = await tool('ezra', 'get_data', { app_id: 'dollywood-live', scope: 'family', key: 'meet' }, 'where is the meeting point?');
  note('kid get_data dollywood-live meet', { ok: peek.ok, result: String(peek.toolResult).slice(0, 160) });
  note('kid system prompt: map/fridge hint present', { neverChange: /Never change data in apps this child cannot open/.test(peek.system), grownUpMap: /the family map\) will refuse for a child/.test(peek.system) });

  const before = { meet: await get('eli', 'dollywood-live', 'family', 'meet'), kiara: await get('eli', 'dollywood-live', 'family', 'kidshare:kiara'), loc: await get('eli', 'dollywood-live', 'family', 'loc:eli'), h: await get('eli', 'dollywood-live', 'family', 'kid:ezra') };
  note('before (as eli)', { meet: before.meet && before.meet.value && before.meet.value.name, kiaraBeacon: before.kiara && before.kiara.value, eliLoc: before.loc && before.loc.value && [before.loc.value.x, before.loc.value.y], ezraHeight: before.h && before.h.value && before.h.value.height_in });

  const now = Date.now();
  const w = [
    ['meet', { x: 300, y: 300, name: 'Candy shop (Ezra)', note: 'kid set this', by: 'ezra', byName: 'Ezra', at: now }, 'move the meeting place to the candy shop'],
    ['kidshare:kiara', true, 'turn on kiara beacon'],
    ['loc:eli', { ...(before.loc ? before.loc.value : {}), x: 5, y: 5, t: now }, 'put daddy at the corner'],
    ['kid:ezra', { height_in: 60, at: now, by: 'ezra' }, 'I am 60 inches tall'],
  ];
  for (const [key, value, msg] of w) {
    const r = await tool('ezra', 'set_data', { app_id: 'dollywood-live', scope: 'family', key, value }, msg);
    note(`kid chat set_data dollywood-live ${key}`, { http: r.http, ok: r.ok, chip: r.chip, result: r.toolResult });
  }
  const after = { meet: await get('eli', 'dollywood-live', 'family', 'meet'), kiara: await get('eli', 'dollywood-live', 'family', 'kidshare:kiara'), loc: await get('eli', 'dollywood-live', 'family', 'loc:eli'), h: await get('eli', 'dollywood-live', 'family', 'kid:ezra') };
  note('after (as eli)', { meet: after.meet.value && after.meet.value.name, kiaraBeacon: after.kiara && after.kiara.value, eliLoc: after.loc.value && [after.loc.value.x, after.loc.value.y], ezraHeight: after.h.value && after.h.value.height_in });

  // Leftovers: finish_leftover refused for kids, but set_data null does the same thing.
  const items = (await L.apiAs('eli', '/api/data/leftovers?scope=family')).body.items.filter(x => x.value);
  const [a, b] = items;
  const fin = await tool('ezra', 'finish_leftover', { item_id: a.value.id }, 'we ate it');
  note('kid chat finish_leftover (control)', { ok: fin.ok, result: fin.toolResult, stillThere: !!(await get('eli', 'leftovers', 'family', a.key)).value });
  const tomb = await tool('ezra', 'set_data', { app_id: 'leftovers', scope: 'family', key: b.key, value: null }, 'throw away the ' + b.value.name);
  note('kid chat set_data leftovers null', { ok: tomb.ok, chip: tomb.chip, tombstoned: (await get('eli', 'leftovers', 'family', b.key)).value === null });

  // Controls that bound the claim.
  const rally = await L.apiAs('ezra', '/api/dollywood/rally', { method: 'POST', body: { name: 'Candy', x: 10, y: 10 } });
  note('kid POST /api/dollywood/rally (control)', { status: rally.status, error: rally.body && rally.body.error });
  const raw = await L.apiAs('ezra', '/api/data/dollywood-live/kidshare%3Akiara?scope=family', { method: 'PUT', body: { value: false, updated_at: Date.now() } });
  note('kid raw PUT /api/data kidshare:kiara (control)', { status: raw.status, applied: raw.body && raw.body.applied });
  const pr = await tool('ezra', 'set_data', { app_id: 'prayer', scope: 'family', key: 'x', value: 1 }, 'x');
  note('kid chat set_data prayer (visibleTo app, control)', { ok: pr.ok, result: pr.toolResult });
  const feedAll = (await L.apiAs('eli', '/api/activity?limit=100')).body.activity; const feed = { newest: feedAll.slice(0, 3).map(x => `${x.name}: ${x.text} @${new Date(x.created_at).toISOString()}`), ezraViaChat: feedAll.filter(x => x.profile_id === 'ezra' && /via chat/.test(x.text)).map(x => `${x.text} @${new Date(x.created_at).toISOString()}`) };
  note('family feed (as eli)', feed);

  // Re-write the kid's meeting point last (the raw PUT above only touched kidshare), then what an adult's park map shows.
  const phone = await L.device({ device: 'iphone-pwa', profile: 'christian', fixedTime: false });
  await phone.goto('#home');
  const f = await phone.openApp('dollywood-live');
  await sleep(2500);
  const txt = await f.evaluate(() => document.body.innerText);
  note('adult (Mae) park map mentions kid meet name', { shown: /Candy shop \(Ezra\)/.test(txt), wildwood: /The Wildwood Tree/.test(txt) });
  await phone.page.screenshot({ path: path.join(EVID, 'verify-kid-meet-on-adult-map-iphone-light.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  const p = path.join(EVID, 'verify-kid-chat-writes-adult-only-rows-1.json');
  fs.writeFileSync(p, JSON.stringify(out, null, 2));
  console.log('\nsaved', path.relative(ROOT, p));
} catch (e) { console.error(e); process.exitCode = 1; }
finally { await L.close(); }
