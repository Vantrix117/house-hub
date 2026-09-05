/**
 * Shared backend for the Larder Ledger app.
 *
 * Cloudflare Worker + D1. Endpoints (all JSON, all CORS-open):
 *   GET    /items       -> { items: [...] }
 *   POST   /items       -> add one; body { id?, name, size, dateLogged }
 *   DELETE /items/<id>  -> remove one
 *
 * Every mutation returns the full list, so the client resyncs in one round trip.
 * Setup lives in worker/README.md.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS },
  });

async function listAll(env) {
  const { results } = await env.DB
    .prepare('SELECT id, name, size, dateLogged FROM leftovers ORDER BY dateLogged ASC, name ASC')
    .all();
  return results || [];
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const parts = new URL(request.url).pathname.split('/').filter(Boolean);
    if (parts[0] !== 'items') return json({ error: 'Not found' }, 404);

    if (!env.DB) return json({ error: 'D1 binding "DB" is missing — check the Worker settings.' }, 500);

    try {
      if (request.method === 'GET') {
        return json({ items: await listAll(env) });
      }

      if (request.method === 'POST' && parts.length === 1) {
        let body;
        try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

        const name = String(body.name ?? '').trim().slice(0, 100);
        const size = String(body.size ?? '').trim().slice(0, 40);
        const dateLogged = String(body.dateLogged ?? '').slice(0, 10);
        if (!name) return json({ error: 'Name is required' }, 400);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateLogged)) return json({ error: 'dateLogged must be YYYY-MM-DD' }, 400);

        // Honour a client-supplied id so the optimistic row and the stored row match.
        const raw = String(body.id ?? '').trim();
        const id = /^[A-Za-z0-9._-]{1,64}$/.test(raw) ? raw : crypto.randomUUID();

        await env.DB
          .prepare('INSERT OR REPLACE INTO leftovers (id, name, size, dateLogged) VALUES (?, ?, ?, ?)')
          .bind(id, name, size, dateLogged)
          .run();

        return json({ items: await listAll(env) }, 201);
      }

      if (request.method === 'DELETE' && parts.length === 2) {
        await env.DB.prepare('DELETE FROM leftovers WHERE id = ?').bind(parts[1]).run();
        return json({ items: await listAll(env) });
      }
    } catch (err) {
      return json({ error: 'Server error: ' + (err && err.message ? err.message : String(err)) }, 500);
    }

    return json({ error: 'Not found' }, 404);
  },
};
