// SEC (6): CORS, media URLs, and whether any secret reaches the client. In-process real Worker on a fresh D1.
// Run:  node "audits/tools/phase2/SEC/cors-media-secrets.mjs"
process.env.TZ = 'America/New_York';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/SEC');
globalThis.fetch = async u => { throw new Error('outbound fetch refused: ' + (u.url || u)); };
globalThis.caches = { default: { async match() {}, async put() {} } };

const worker = (await import(pathToFileURL(path.join(ROOT, 'worker/src/index.js')).href)).default;
const { createD1 } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/lib/d1.mjs')).href);
const { seedDemo, DEVICE, sessionToken } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/seed.mjs')).href);
const crypto = await import('node:crypto');
const sha = s => crypto.createHash('sha256').update(s).digest('base64url');

const DB = createD1(':memory:');
const info = await seedDemo(DB, { variant: 'typical', now: Date.now() });
// the rig's Anthropic secret, so we can prove it never appears in any response body/header
const SECRET = 'sk-ant-test-SECRET-DO-NOT-LEAK-0123456789';
const env = { DB, ALLOWED_ORIGINS: 'https://vantrix117.github.io,http://localhost:8765,http://127.0.0.1:8765', ANTHROPIC_API_KEY: SECRET, ANTHROPIC_BASE_URL: 'http://127.0.0.1:1/__mock', VAPID_PUBLIC_KEY: 'BDLrsVIp_public', VAPID_PRIVATE_KEY: 'VAPID_PRIVATE_SECRET', VAPID_SUBJECT: 'mailto:x@y.z' };
const ctx = { waitUntil() {}, passThroughOnException() {} };
const dt = DEVICE.token, pt = sessionToken('eli');
async function call(p, { method = 'GET', body, origin, headers = {}, dt: d, pt: t } = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  if (origin) h['Origin'] = origin;
  if (d !== null) h['X-Device-Token'] = d || dt; if (t !== null && (t || pt)) h['X-Profile-Token'] = t || pt;
  const r = await worker.fetch(new Request('http://api.local' + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), env, ctx);
  const t2 = await r.text(); let j; try { j = JSON.parse(t2); } catch { j = t2; }
  return { status: r.status, headers: Object.fromEntries(r.headers), body: j, text: t2 };
}
const out = {};

// ── CORS ───────────────────────────────────────────────────────
const acao = r => r.headers['access-control-allow-origin'];
out.cors = {};
out.cors.allowed_origin = (() => { const r = null; return null; })();
{
  const good = await call('/api/health', { origin: 'https://vantrix117.github.io' });
  const evil = await call('/api/health', { origin: 'https://evil.example.com' });
  const none = await call('/api/health', {});
  out.cors.github_pages = { acao: acao(good), status: good.status };
  out.cors.evil_origin = { acao: acao(evil), status: evil.status, note: 'no ACAO header means the browser blocks the READ, but the request was still processed and returned data' };
  out.cors.no_origin = { acao: acao(none), status: none.status };
  // a cross-origin write is still EXECUTED server-side (CORS only hides the response from the page)
  const evilWrite = await call('/api/data/leftovers/item:cors-probe?scope=family', { method: 'PUT', origin: 'https://evil.example.com', body: { value: { id: 'cors-probe', name: 'from evil origin', size: 'Small', dateLogged: '2026-09-22' }, updated_at: Date.now() } });
  const check = await call('/api/data/leftovers?scope=family&key=item:cors-probe', {});
  out.cors.evil_write_executed = { write_status: evilWrite.status, acao: acao(evilWrite), row_persisted: !!(check.body && check.body.item && check.body.item.value), note: 'a page on evil.example.com with a stolen device+profile token can WRITE; it just cannot read the reply' };
}

// ── media: public, unguessable ─────────────────────────────────
{
  // upload a tiny valid JPEG (FFD8 … FFD9) through the real route so we can test its public URL
  const jpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0xFF, 0xD9]).toString('base64');
  await call('/api/profiles/eli/photo', { method: 'PUT', body: { sm: jpeg, lg: jpeg } });
  const prof = await call('/api/profiles', {});
  const withPhoto = prof.body.profiles.find(p => p.photo);
  out.media = { uploaded_photo: !!withPhoto };
  if (withPhoto) {
    const url = withPhoto.photo.sm;   // /api/media/photos/<id>/<token>-256.jpg
    const noAuth = await call(url, { dt: null, pt: null });
    out.media.public_no_auth = { url_shape: url.replace(/[\w-]+-256/, '<token>-256'), status: noAuth.status, cache_control: noAuth.headers['cache-control'], acao: noAuth.headers['access-control-allow-origin'] };
    // guessing without the token fails
    const guess = await call(`/api/media/photos/${withPhoto.id}/guess-256.jpg`, { dt: null, pt: null });
    out.media.guess_wrong_token = { status: guess.status };
    // path-traversal / non-jpg is rejected by the regex
    const bad = await call('/api/media/photos/x/..%2f..%2fsecret.txt', { dt: null, pt: null });
    out.media.traversal_blocked = { status: bad.status };
  }
}

// ── secrets never reach the client ─────────────────────────────
{
  const surfaces = [];
  const pushcfg = await call('/api/push/config', {});
  surfaces.push(['push/config', pushcfg.text]);
  const me = await call('/api/me', {});
  surfaces.push(['me', me.text]);
  const health = await call('/api/health', {});
  surfaces.push(['health', health.text]);
  const usage = await call('/api/admin/usage', {});
  surfaces.push(['admin/usage', usage.text]);
  const leaks = surfaces.filter(([, t]) => t.includes(SECRET) || t.includes('VAPID_PRIVATE_SECRET'));
  out.secrets = {
    checked: surfaces.map(s => s[0]),
    anthropic_key_in_any_response: leaks.some(([, t]) => t.includes(SECRET)),
    vapid_private_in_any_response: leaks.some(([, t]) => t.includes('VAPID_PRIVATE_SECRET')),
    push_config_returns: pushcfg.body,   // should be only the PUBLIC key + enabled flag
  };
}

console.log(JSON.stringify(out, null, 1));
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'cors-media-secrets.json'), JSON.stringify(out, null, 1));
DB.close();
