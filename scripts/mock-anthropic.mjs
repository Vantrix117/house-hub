#!/usr/bin/env node
// A stand-in for api.anthropic.com for local runs of /api/chat (no key needed). Streams the same SSE
// shapes the real Messages API does. Picks a tool from the last user message so every tool can be
// exercised; after tool results it replies with a short confirmation.
//   node scripts/mock-anthropic.mjs [port=8791]      then in worker/.dev.vars: ANTHROPIC_BASE_URL="http://127.0.0.1:8791"
// Batch 2b triggers: "think it over then list apps" streams a signed thinking block before the tool call and, after the
// tool result, answers "THINKING KEPT" only if that block came back whole (P2-CHAT-11); "the upstream fails now" answers
// HTTP 500 (P2-CHAT-10: the message must not count); "hang for a while" sends nothing for 60 s (P2-CHAT-05: the Worker
// gives up first — 45 s, or CHAT_TIMEOUT_MS). Batch 6: "set a timer for 12 minutes for the pasta" (also "… 1 minute and 30
// seconds") calls start_timer.
import http from 'node:http';
const port = +(process.argv[2] || 8791);

function pick(text) {
  const t = text.toLowerCase();
  if (/log (.+) in the fridge on (.+)/.test(t)) { const m = t.match(/log (.+) in the fridge on (.+)/); return { name: 'add_list_item', input: { app_id: 'leftovers', item: { name: cap(m[1]), dateLogged: m[2] } } }; }
  // batch 6 (IMP-TIMER-I2): "set a timer for 12 minutes for the pasta" → start_timer { minutes: 12, label: 'Pasta' }
  if (/(?:set|start) a timer for ([\d.]+) minutes?(?: and (\d+) seconds?)?(?: for (?:the )?(.+))?/.test(t)) { const m = t.match(/(?:set|start) a timer for ([\d.]+) minutes?(?: and (\d+) seconds?)?(?: for (?:the )?(.+))?/); return { name: 'start_timer', input: { minutes: +m[1], ...(m[2] ? { seconds: +m[2] } : {}), ...(m[3] ? { label: cap(m[3]) } : {}) } }; }
  if (/which apps|list apps/.test(t)) return { name: 'list_apps', input: {} };
  if (/what.*fridge|in the fridge/.test(t)) return { name: 'get_data', input: { app_id: 'leftovers', scope: 'family' } };
  if (/add (.+) to (the )?(leftovers|fridge)/.test(t)) return { name: 'add_list_item', input: { app_id: 'leftovers', item: { name: cap(t.match(/add (.+?) to (the )?(leftovers|fridge)/)[1]), size: 'Small' } } };
  if (/remind/.test(t)) return { name: 'add_list_item', input: { app_id: 'reminders', item: { text: cap(t.replace(/^.*remind (everyone |us |me )?(to |about )?/, '')) } } };
  if (/week (\d+) day (\d+)/.test(t)) { const m = t.match(/week (\d+) day (\d+)/); return { name: 'set_f260_reading', input: { week: +m[1], day: +m[2], done: !/untick|uncheck|didn'?t read/.test(t) } }; }
  if (/change the prayer app|adult-only/.test(t)) return { name: 'set_data', input: { app_id: 'prayer', scope: 'person', key: 'label', value: 'hacked' } };
  // round 2 (roadmap 14)
  if (/finished (the )?(.+?) (from|in) the fridge|we ate (the )?(.+)/.test(t)) { const m = t.match(/finished (?:the )?(.+?) (?:from|in) the fridge/) || t.match(/we ate (?:the )?(.+)/); return { name: 'finish_leftover', input: { name: cap(m[1]) } }; }
  if (/where is everyone|where's everyone|where is the family|where is everybody/.test(t)) return { name: 'where_is_family', input: {} };
  if (/where am i in (my )?(f260|reading)|reading status|f260 status/.test(t)) return { name: 'f260_status', input: {} };
  if (/today'?s verse|memory verse|bible verse/.test(t)) return { name: 'read_todays_verse', input: {} };
  if (/(was|got|is) answered/.test(t)) { const m = t.match(/^(?:the )?(?:prayer (?:for |about )?)?(.+?) (?:was|got|is) answered(?: on the family list)?(?:[:,-]\s*(.+))?$/); return { name: 'answer_prayer', input: { list: /family/.test(t) ? 'family' : 'private', prayer_id: cap(m ? m[1] : t), ...(m && m[2] ? { note: cap(m[2]) } : {}) } }; }
  if (/^i prayed for (.+)/.test(t)) return { name: 'mark_prayed', input: { list: /family/.test(t) ? 'family' : 'private', prayer_id: cap(t.match(/^i prayed for (.+?)( on the family list| today)*$/)[1]) } };
  if (/pray/.test(t)) return { name: 'add_prayer', input: { list: /family/.test(t) ? 'family' : 'private', text: cap(t.replace(/^.*pray(er)? (for |that )?/, '').replace(/ on the family list/, '')) } };
  if (/what'?s my tally/.test(t)) return { name: 'get_data', input: { app_id: 'tally', scope: 'person', key: 'count' } };
  if (/set my tally to (\S+)/.test(t)) { const w = t.match(/set my tally to (\S+)/)[1]; return { name: 'set_data', input: { app_id: 'tally', scope: 'person', key: 'count', value: /^-?[\d.]+(e\+?\d+)?$/.test(w) ? +w : w } }; }   // batch 11: -13, 12.5, 1000000 and "twelve" reach the tool as they are
  return null;
}
const cap = s => s.trim().replace(/[.!?]$/, '').replace(/^\w/, c => c.toUpperCase());

http.createServer((req, res) => {
  let body = ''; req.on('data', d => body += d).on('end', () => {
    let r; try { r = JSON.parse(body || '{}'); } catch { r = {}; }
    if (!Array.isArray(r.messages) || !r.messages.length) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'messages is required' } })); return; }   // a stray probe must not crash the mock
    const last = r.messages[r.messages.length - 1];
    const said = typeof last.content === 'string' ? last.content.toLowerCase() : '';
    if (/the upstream fails now/.test(said)) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'mock outage' } })); console.log('REQ -> 500 (asked to fail)'); return; }
    if (/hang for a while/.test(said)) { console.log('REQ -> hanging 60 s'); const h = setTimeout(() => { try { res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.end(); } catch {} }, 60000); req.on('close', () => clearTimeout(h)); res.on('close', () => clearTimeout(h)); return; }
    const events = [];
    const push = (type, obj) => events.push(`event: ${type}\ndata: ${JSON.stringify({ type, ...obj })}\n\n`);
    push('message_start', { message: { id: 'msg_mock', type: 'message', role: 'assistant', model: r.model, content: [], usage: { input_tokens: 120, output_tokens: 0 } } });
    let stop = 'end_turn';
    const afterTool = Array.isArray(last.content) && last.content.some(b => b.type === 'tool_result');
    if (afterTool) {
      const tr = last.content.find(b => b.type === 'tool_result');
      const prev = r.messages[r.messages.length - 2];
      const th = prev && Array.isArray(prev.content) ? prev.content.find(b => b.type === 'thinking') : null;
      const thought = th ? (th.signature === 'mock-signature-2b' && th.thinking === 'Listing the apps first.' && prev.content[0] === th ? 'THINKING KEPT. ' : 'THINKING CHANGED. ') : '';
      const wanted = prev && Array.isArray(prev.content) && prev.content.some(b => b.type === 'tool_use' && b.id && b.id.startsWith('toolu_think'));
      const text = (wanted && !th ? 'THINKING DROPPED. ' : thought) + (tr.is_error ? `Sorry, that didn't work: ${tr.content}` : 'Done — ' + tr.content.slice(0, 120));
      push('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
      for (const w of text.split(/(?<= )/)) push('content_block_delta', { index: 0, delta: { type: 'text_delta', text: w } });
      push('content_block_stop', { index: 0 });
    } else {
      const tool = pick(typeof last.content === 'string' ? last.content : '');
      if (/think it over then list apps/.test(said)) {
        push('content_block_start', { index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } });
        push('content_block_delta', { index: 0, delta: { type: 'thinking_delta', thinking: 'Listing the apps ' } });
        push('content_block_delta', { index: 0, delta: { type: 'thinking_delta', thinking: 'first.' } });
        push('content_block_delta', { index: 0, delta: { type: 'signature_delta', signature: 'mock-signature-2b' } });
        push('content_block_stop', { index: 0 });
        push('content_block_start', { index: 1, content_block: { type: 'tool_use', id: 'toolu_think' + Math.random().toString(36).slice(2, 8), name: 'list_apps', input: {} } });
        push('content_block_delta', { index: 1, delta: { type: 'input_json_delta', partial_json: '{}' } });
        push('content_block_stop', { index: 1 });
        stop = 'tool_use';
      } else if (tool) {
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
