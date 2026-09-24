// CHAT 05 — exactly what family data leaves the house on a chat message: the system prompt verbatim (adult, kid,
// guest), the history window, and what each read tool's result carries. Park-day variant so locations exist.
//   node "audits/tools/phase2/CHAT/05-privacy.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local } from '../../lib/local.mjs';
import { chat, toolCall, history, save, short, ROOT } from './lib.mjs';

const out = {};
let L = await local({ variant: 'park', clock: 'demo' });
try {
  // 1. system prompts + history window
  for (const pid of ['eli', 'ezra', 'guest-grandmajo']) {
    await L.anthropicLog({ clear: true }); await L.anthropic([{ text: 'ok' }]);
    const h = await history(L, pid);
    await chat(L, pid, 'hello');
    const b = (await L.anthropicLog())[0].body;
    out['request_' + pid] = {
      model: b.model, max_tokens: b.max_tokens, thinking: b.thinking, output_config: b.output_config, toolCount: b.tools.length,
      system: b.system,
      messagesSent: b.messages.length, rolesSent: b.messages.map(m => m.role).join(','),
      historyRowsShownInChatTab: h.messages.length,
      historyRowsOlderThan36h: h.messages.filter(m => m.created_at < Date.parse('2026-09-22T08:40:00-04:00') - 36 * 3600000).length,
      firstMessageSent: short(b.messages[0].content, 120),
    };
    console.log(`\n=== ${pid}: ${b.messages.length} messages sent upstream (Chat tab shows ${h.messages.length} rows) ===\n${b.system}`);
  }

  // 2. what read tools return (the tool_result content the Worker sends upstream)
  const reads = [
    ['eli', 'get_data', { app_id: 'prayer', scope: 'person' }],
    ['eli', 'get_data', { app_id: 'prayer', scope: 'family' }],
    ['eli', 'where_is_family', {}],
    ['eli', 'get_data', { app_id: 'dollywood-live', scope: 'family' }],
    ['eli', 'get_data', { app_id: 'f260', scope: 'person' }],
    ['eli', 'get_data', { app_id: 'hub', scope: 'person' }],
    ['eli', 'get_data', { app_id: 'hub', scope: 'family' }],
    ['eli', 'finish_leftover', { name: 'zzz' }],
    ['eli', 'mark_prayed', { list: 'private', prayer_id: 'zzz' }],
    ['ezra', 'get_data', { app_id: 'dollywood-live', scope: 'family' }],
  ];
  out.toolResults = [];
  for (const [pid, name, input] of reads) {
    const r = await toolCall(L, pid, name, input);
    const c = (r.toolResult && r.toolResult.content) || '';
    const phones = (c.match(/555-01\d\d/g) || []).length;
    const coords = (c.match(/"x":\s*-?\d+/g) || []).length;
    const rec = { as: pid, tool: name, input, chars: c.length, phoneNumbers: phones, coordinatePairs: coords, keys: (c.match(/"key":"([^"]+)"/g) || []).map(k => k.slice(7, -1)).slice(0, 40), excerpt: short(c, 400) };
    out.toolResults.push(rec);
    console.log(`\n--- ${pid} ${name} ${JSON.stringify(input)}: ${c.length} chars, ${phones} phone numbers, ${coords} x/y positions\n${short(c, 500)}`);
  }

  // 3. one full request as logged (the second upstream call of a where_is_family turn), for the report
  await L.anthropicLog({ clear: true });
  await L.anthropic([{ tools: [{ name: 'where_is_family', input: {} }] }, { text: 'Mae was at Till & Harvest 4 minutes ago.' }]);
  await chat(L, 'eli', 'where is everyone?');
  const full = (await L.anthropicLog())[1].body;
  out.exampleRequest = { ...full, tools: full.tools.map(t => t.name), messages: full.messages.map(m => ({ role: m.role, content: typeof m.content === 'string' ? short(m.content, 200) : m.content })) };
} finally { await L.close(); }

// 4. expired guests still named in every system prompt (overflow: Cousin Theodore's stay ended yesterday)
L = await local({ variant: 'overflow', clock: 'demo' });
try {
  await L.anthropicLog({ clear: true }); await L.anthropic([{ text: 'ok' }]);
  await chat(L, 'christian', 'hello');
  const sys = (await L.anthropicLog())[0].body.system;
  const profiles = (await L.apiAs('eli', '/api/profiles')).body;
  const listed = (profiles.profiles || profiles).map(p => p.name);
  out.expiredGuest = { householdLine: sys.split('\n').find(l => l.startsWith('Household:')), inSystemPrompt: sys.includes('Cousin Theodore'), inProfilePicker: listed.includes('Cousin Theodore') };
  console.log('\nexpired guest:', JSON.stringify(out.expiredGuest));
} finally { await L.close(); }

// 5. the API key: never in a client-visible file (static site) — grep the files GitHub Pages serves
const files = ['index.html', 'sw.js', 'apps.json', 'manifest.webmanifest', ...fs.readdirSync(path.join(ROOT, 'apps')).map(f => 'apps/' + f)].filter(f => fs.existsSync(path.join(ROOT, f)) && fs.statSync(path.join(ROOT, f)).isFile());
const hits = [];
for (const f of files) { const t = fs.readFileSync(path.join(ROOT, f), 'utf8'); for (const re of [/sk-ant-[A-Za-z0-9_-]{6,}/, /x-api-key/i, /ANTHROPIC_API_KEY/]) if (re.test(t)) hits.push(f + ' ~ ' + re); }
const gi = fs.existsSync(path.join(ROOT, '.gitignore')) ? fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8') : '';
const wgi = fs.existsSync(path.join(ROOT, 'worker/.gitignore')) ? fs.readFileSync(path.join(ROOT, 'worker/.gitignore'), 'utf8') : '';
out.keyStatic = { filesScanned: files.length, hits, devVarsIgnored: /\.dev\.vars/.test(gi + '\n' + wgi) };
console.log('\nstatic key scan:', JSON.stringify(out.keyStatic));
console.log('evidence:', save('05-privacy.json', out));
