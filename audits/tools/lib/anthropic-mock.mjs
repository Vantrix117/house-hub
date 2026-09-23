// A stand-in for the Anthropic Messages API, so the chat tab can be exercised without a key or the network.
// Streams one short text reply in the Messages SSE format that worker/src/chat.js parses.
export async function anthropicMock(request) {
  let body = {};
  try { body = await request.json(); } catch {}
  const last = (body.messages || []).filter(m => m.role === 'user').pop();
  const said = last ? (typeof last.content === 'string' ? last.content : (last.content || []).map(b => b.text || '').join(' ')) : '';
  const text = said ? 'This is the capture rig’s stand-in assistant. In the real hub I would look that up for you.' : 'Hello!';
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  const out = ev('message_start', { message: { id: 'msg_rig', role: 'assistant', content: [], usage: { input_tokens: 10, output_tokens: 1 } } })
    + ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })
    + ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text } })
    + ev('content_block_stop', { index: 0 })
    + ev('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 20 } })
    + ev('message_stop', {});
  return new Response(out, { headers: { 'Content-Type': 'text/event-stream' } });
}
