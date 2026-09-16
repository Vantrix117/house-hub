#!/usr/bin/env node
// A stand-in for api.anthropic.com for local runs of /api/chat (no key needed). Streams the same SSE
// shapes the real Messages API does. Picks a tool from the last user message so every tool can be
// exercised; after tool results it replies with a short confirmation.
//   node scripts/mock-anthropic.mjs [port=8791]      then in worker/.dev.vars: ANTHROPIC_BASE_URL="http://127.0.0.1:8791"
import http from 'node:http';
const port = +(process.argv[2] || 8791);

function pick(text) {
  const t = text.toLowerCase();
  if (/which apps|list apps/.test(t)) return { name: 'list_apps', input: {} };
  if (/what.*fridge|in the fridge/.test(t)) return { name: 'get_data', input: { app_id: 'leftovers', scope: 'family' } };
  if (/add (.+) to (the )?(leftovers|fridge)/.test(t)) return { name: 'add_list_item', input: { app_id: 'leftovers', item: { name: cap(t.match(/add (.+?) to (the )?(leftovers|fridge)/)[1]), size: 'Small' } } };
  if (/remind/.test(t)) return { name: 'add_list_item', input: { app_id: 'reminders', item: { text: cap(t.replace(/^.*remind (everyone |us |me )?(to |about )?/, '')) } } };
  if (/week (\d+) day (\d+)/.test(t)) { const m = t.match(/week (\d+) day (\d+)/); return { name: 'toggle_f260_reading', input: { week: +m[1], day: +m[2] } }; }
  if (/pray/.test(t)) return { name: 'add_prayer', input: { list: /family/.test(t) ? 'family' : 'private', text: cap(t.replace(/^.*pray(er)? (for |that )?/, '').replace(/ on the family list/, '')) } };
  if (/set my tally to (\d+)/.test(t)) return { name: 'set_data', input: { app_id: 'tally', scope: 'person', key: 'count', value: +t.match(/set my tally to (\d+)/)[1] } };
  if (/change the prayer app|adult-only/.test(t)) return { name: 'set_data', input: { app_id: 'prayer', scope: 'person', key: 'label', value: 'hacked' } };
  return null;
}
const cap = s => s.trim().replace(/[.!?]$/, '').replace(/^\w/, c => c.toUpperCase());

http.createServer((req, res) => {
  let body = ''; req.on('data', d => body += d).on('end', () => {
    const r = JSON.parse(body || '{}');
    const last = r.messages[r.messages.length - 1];
    const events = [];
    const push = (type, obj) => events.push(`event: ${type}\ndata: ${JSON.stringify({ type, ...obj })}\n\n`);
    push('message_start', { message: { id: 'msg_mock', type: 'message', role: 'assistant', model: r.model, content: [], usage: { input_tokens: 120, output_tokens: 0 } } });
    let stop = 'end_turn';
    const afterTool = Array.isArray(last.content) && last.content.some(b => b.type === 'tool_result');
    if (afterTool) {
      const tr = last.content.find(b => b.type === 'tool_result');
      const text = tr.is_error ? `Sorry, that didn't work: ${tr.content}` : 'Done — ' + tr.content.slice(0, 120);
      push('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
      for (const w of text.split(/(?<= )/)) push('content_block_delta', { index: 0, delta: { type: 'text_delta', text: w } });
      push('content_block_stop', { index: 0 });
    } else {
      const tool = pick(typeof last.content === 'string' ? last.content : '');
      if (tool) {
        push('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
        push('content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'On it. ' } });
        push('content_block_stop', { index: 0 });
        push('content_block_start', { index: 1, content_block: { type: 'tool_use', id: 'toolu_' + Math.random().toString(36).slice(2, 8), name: tool.name, input: {} } });
        const json = JSON.stringify(tool.input);
        for (let i = 0; i < json.length; i += 7) push('content_block_delta', { index: 1, delta: { type: 'input_json_delta', partial_json: json.slice(i, i + 7) } });
        push('content_block_stop', { index: 1 });
        stop = 'tool_use';
      } else {
        push('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
        for (const w of `(mock) You said: ${last.content}. System prompt mentions ${/young child/.test(r.system) ? 'a KID' : 'an adult'}.`.split(/(?<= )/)) push('content_block_delta', { index: 0, delta: { type: 'text_delta', text: w } });
        push('content_block_stop', { index: 0 });
      }
    }
    push('message_delta', { delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 40 } });
    push('message_stop', {});
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    let i = 0; const tick = () => { if (i < events.length) { res.write(events[i++]); setTimeout(tick, 15); } else res.end(); }; tick();
    console.log(`REQ model=${r.model} max_tokens=${r.max_tokens} tools=${(r.tools || []).length} msgs=${r.messages.length} -> ${stop}${afterTool ? ' (after tool_result)' : ''}`);
  });
}).listen(port, () => console.log('mock anthropic on ' + port));
