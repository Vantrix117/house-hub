// A stand-in for the Anthropic Messages API, so the chat tab can be exercised without a key or the network.
// It streams replies in the Messages SSE format that worker/src/chat.js parses.
//
// By default every call gets one short text reply (the capture rig relies on that). For experiments, the local server
// exposes the mock's state (lib/server.mjs → /__rig/anthropic):
//   - script: a queue of turns, one per upstream call. Each turn is
//       { text } | { tools: [{ name, input }] } | { text, tools } | { status, message } (an HTTP error) |
//       { streamError: 'message' } | { hangMs } (the upstream never answers, or answers after that many ms)
//   - log: every request body the Worker sent upstream — the system prompt, the tools, and the history with tool
//     results — which is how the audit sees exactly what family data leaves the house.
export function createAnthropicMock() {
  const state = { script: [], log: [] };
  let seq = 0;
  async function handle(request) {
    let body = {};
    try { body = await request.json(); } catch {}
    state.log.push({ n: state.log.length + 1, body });
    const turn = state.script.length ? state.script.shift() : null;
    if (turn && turn.hangMs) await new Promise(r => setTimeout(r, turn.hangMs));
    if (turn && turn.status) {
      return new Response(JSON.stringify({ type: 'error', error: { type: 'api_error', message: turn.message || 'mock upstream error' } }),
        { status: turn.status, headers: { 'Content-Type': 'application/json' } });
    }
    const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
    let out = ev('message_start', { message: { id: 'msg_rig_' + (++seq), role: 'assistant', content: [], usage: { input_tokens: 10, output_tokens: 1 } } });
    if (turn && turn.streamError) return new Response(out + ev('error', { error: { type: 'overloaded_error', message: turn.streamError } }), { headers: { 'Content-Type': 'text/event-stream' } });
    let index = 0;
    const last = (body.messages || []).filter(m => m.role === 'user').pop();
    const said = last ? (typeof last.content === 'string' ? last.content : (last.content || []).map(b => b.text || '').join(' ')) : '';
    const text = turn ? turn.text : (said ? 'This is the capture rig’s stand-in assistant. In the real hub I would look that up for you.' : 'Hello!');
    if (text) {
      out += ev('content_block_start', { index, content_block: { type: 'text', text: '' } })
        + ev('content_block_delta', { index, delta: { type: 'text_delta', text } })
        + ev('content_block_stop', { index });
      index++;
    }
    const tools = (turn && turn.tools) || [];
    for (const t of tools) {
      out += ev('content_block_start', { index, content_block: { type: 'tool_use', id: 'toolu_rig_' + (++seq), name: t.name, input: {} } })
        + ev('content_block_delta', { index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(t.input || {}) } })
        + ev('content_block_stop', { index });
      index++;
    }
    out += ev('message_delta', { delta: { stop_reason: tools.length ? 'tool_use' : 'end_turn' }, usage: { output_tokens: 20 } }) + ev('message_stop', {});
    return new Response(out, { headers: { 'Content-Type': 'text/event-stream' } });
  }
  return { handle, state };
}

// Back-compat for anything that imported the old single-function mock.
const shared = createAnthropicMock();
export const anthropicMock = request => shared.handle(request);
