// Skeptic #1 for CHAT finding "finish-leftover-wrong-item" (worker/src/chat.js:263-282).
// Independent of 07-loose-match.mjs: talks to /api/chat directly with the scripted upstream, and compares the fridge
// BY ROW KEY (not by name) before and after, reads the raw row after the call (is the old item recoverable?), the
// feed line, and runs controls (exact name, id, an unrelated word, an all-words paraphrase).
//   node "audits/tools/phase2/CHAT/verify-finish-leftover-wrong-item-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local } from '../../lib/local.mjs';
import { ROOT } from '../../lib/local.mjs';

const apps = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps.map(a => ({ id: a.id, name: a.name, scope: a.scope, visibleTo: a.visibleTo }));
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'CHAT');
fs.mkdirSync(EVID, { recursive: true });

const L = await local({ variant: 'typical', clock: 'real' });
const out = [];
const live = async () => {
  const r = await L.apiAs('eli', '/api/data/leftovers?scope=family');
  return Object.fromEntries(r.body.items.filter(x => x.value).map(x => [x.key, x.value]));
};
try {
  const cases = [
    { said: 'chicken noodle soup' }, { said: 'sweet tea' }, { said: 'meatball sub' }, { said: 'pancake batter' },
    // controls
    { said: 'Chicken alfredo', control: 'exact name' }, { said: 'yogurt', control: 'unrelated word' },
    { said: 'the alfredo', control: 'paraphrase of a real item' }, { said: 'pot pie', control: 'two items share a word' },
  ];
  for (const c of cases) {
    await L.reset('typical');
    const before = await live();
    await L.anthropicLog({ clear: true });
    await L.anthropic([{ tools: [{ name: 'finish_leftover', input: { name: c.said } }] }, { text: 'OK.' }]);
    const r = await L.apiAs('eli', '/api/chat', { method: 'POST', body: { message: `we finished the ${c.said}`, apps } });
    const toolEv = String(r.body).split('\n\n').filter(b => b.startsWith('event: tool')).map(b => JSON.parse(b.split('\n').find(l => l.startsWith('data:')).slice(5)))[0] || {};
    const log = await L.anthropicLog();
    const second = log[1] && log[1].body; const last = second && second.messages[second.messages.length - 1];
    const tr = last && Array.isArray(last.content) ? last.content.find(b => b.type === 'tool_result') : null;
    const after = await live();
    const removedKeys = Object.keys(before).filter(k => !(k in after));
    const removed = removedKeys.map(k => ({ key: k, was: before[k] }));
    // what the server still holds for the removed row
    const raw = [];
    for (const k of removedKeys) { const g = await L.apiAs('eli', `/api/data/leftovers?scope=family&key=${encodeURIComponent(k)}`); raw.push({ key: k, serverNow: g.body.item }); }
    const feed = (await L.apiAs('eli', '/api/activity?limit=1')).body;
    const row = { said: c.said, control: c.control || null, chip: toolEv.chip || null, ok: toolEv.ok, toolResultToModel: tr ? tr.content : null,
      removed, serverRowAfter: raw, feedTop: JSON.stringify(feed).slice(0, 200), fridgeBefore: Object.values(before).map(v => v.name) };
    out.push(row);
    console.log(`"${c.said}"${c.control ? ' [control: ' + c.control + ']' : ''} -> chip=${JSON.stringify(row.chip)} ok=${row.ok}`);
    console.log(`    removed=${JSON.stringify(removed.map(x => x.was.name + ' (' + x.key + ', logged ' + x.was.dateLogged + ')'))}`);
    console.log(`    tool_result to model=${String(row.toolResultToModel).slice(0, 150)}`);
    if (raw.length) console.log(`    server row after=${JSON.stringify(raw[0].serverNow)}`);
  }
  const f = path.join(EVID, 'verify-finish-leftover-wrong-item-1.json');
  fs.writeFileSync(f, JSON.stringify(out, null, 2));
  console.log('evidence:', path.relative(ROOT, f).replace(/\\/g, '/'));
} finally { await L.close(); }
