// The capture rig's local dev instance: one Node process that serves the repo as the site (like GitHub Pages)
// and runs the real Worker source (worker/src) against an in-memory SQLite D1 seeded with the demo household.
// Nothing here talks to production: the Worker's outbound fetch is stubbed (queue-times, Anthropic) and
// everything else it might reach is refused.
//
//   node audits/tools/lib/server.mjs --site-port 8795 --api-port 8796 [--variant typical] [--demo-time 2026-09-22T08:40:00-04:00]
//
// Rig-only endpoints on the API port (never part of the Worker):
//   POST /__rig/reset?variant=typical   rebuild the database from the seed and reset the demo clock
//   GET  /__rig/info                    tokens, profiles and URLs for the driver
process.env.TZ = 'America/New_York';

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..', '..');
const arg = (name, dflt) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : dflt; };

// ── demo clock: the Worker sees "now" = the demo time, restarted at every reset ─────────────
// It runs 1000× slower than real time (an hour of capturing moves it 3.6 s), so it keeps its order for last-write-wins
// and pull cursors but never drifts far enough from the browser's fixed clock to change a "5 min ago" label.
const RealDate = Date;
const DEMO_START = RealDate.parse(arg('demo-time', process.env.HUB_DEMO_TIME || '2026-09-22T08:40:00-04:00'));
let resetAt = RealDate.now();
const demoNow = () => DEMO_START + Math.floor((RealDate.now() - resetAt) / 1000);
class DemoDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(demoNow()); else super(...a); }
  static now() { return demoNow(); }
}
globalThis.Date = DemoDate;
const resetClock = () => { resetAt = RealDate.now(); };

// ── Workers runtime shims ─────────────────────────────────────────────────────
const cacheStore = new Map();
globalThis.caches = { default: {
  async match(req) { const hit = cacheStore.get(typeof req === 'string' ? req : req.url); return hit && hit.until > RealDate.now() ? hit.res.clone() : undefined; },
  async put(req, res) { cacheStore.set(typeof req === 'string' ? req : req.url, { res: res.clone(), until: RealDate.now() + 60000 }); },
} };

const SITE_PORT = +arg('site-port', process.env.HUB_SITE_PORT || 8795);
const API_PORT = +arg('api-port', process.env.HUB_API_PORT || 8796);
const SITE = `http://localhost:${SITE_PORT}`;
const API = `http://localhost:${API_PORT}`;

const realFetch = globalThis.fetch;
const { waitsFeed } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/seed/waits.mjs')).href);
const { anthropicMock } = await import(pathToFileURL(path.join(HERE, 'anthropic-mock.mjs')).href);
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.startsWith('https://queue-times.com/')) return new Response(JSON.stringify(waitsFeed(Date.now())), { headers: { 'Content-Type': 'application/json' } });
  if (url.startsWith(API + '/__mock/anthropic/')) return anthropicMock(new Request(input, init));
  throw new Error('capture rig: outbound fetch refused: ' + url);
};

const worker = (await import(pathToFileURL(path.join(ROOT, 'worker/src/index.js')).href)).default;
const { createD1 } = await import(pathToFileURL(path.join(HERE, 'd1.mjs')).href);
const { seedDemo } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/seed.mjs')).href);

let env = null, info = null;
async function reset(variant) {
  resetClock();
  cacheStore.clear();
  if (env) env.DB.close();
  const DB = createD1(':memory:');
  env = {
    DB,
    ALLOWED_ORIGINS: SITE,
    ANTHROPIC_API_KEY: 'capture-rig-mock',               // not a key: the Worker's Anthropic calls go to the local mock below
    ANTHROPIC_BASE_URL: API + '/__mock/anthropic',
  };
  info = await seedDemo(DB, { variant, now: DEMO_START, assets: arg('assets', process.env.HUB_AUDIT_ASSETS || '') });
  info = { ...info, variant, site: SITE, api: API, demoTime: new Date(DEMO_START).toISOString() };
  return info;
}
await reset(arg('variant', 'typical'));

// ── static site (the repo root, as GitHub Pages serves it) ────────────────────
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' };
const site = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, SITE).pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT) || file.includes(`${path.sep}.git${path.sep}`) || file.includes(`${path.sep}worker${path.sep}.`)) { res.writeHead(404); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ── API: Node request → Worker fetch(Request, env, ctx) → Node response ───────
const api = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const url = new URL(req.url, API);
  try {
    if (url.pathname.startsWith('/__rig/')) {
      if (url.pathname === '/__rig/reset' && req.method === 'POST') return send(res, 200, await reset(url.searchParams.get('variant') || 'typical'));
      if (url.pathname === '/__rig/info') return send(res, 200, info);
      return send(res, 404, { error: 'no such rig route' });
    }
    if (url.pathname.startsWith('/__mock/anthropic/')) return pipe(res, await anthropicMock(new Request(url, { method: req.method, headers: req.headers, body: body.length ? body : undefined })));
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (v != null) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    const request = new Request(url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) || !body.length ? undefined : body });
    const waits = [];
    const out = await worker.fetch(request, env, { waitUntil: p => waits.push(Promise.resolve(p).catch(e => console.error('waitUntil', e))), passThroughOnException() {} });
    await pipe(res, out);
    await Promise.all(waits);
  } catch (e) {
    console.error('rig api error', e);
    if (!res.headersSent) send(res, 500, { error: 'rig', message: String(e && e.message || e) });
  }
});
function send(res, status, obj) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
async function pipe(res, out) {
  const h = {}; out.headers.forEach((v, k) => { h[k] = v; });
  res.writeHead(out.status, h);
  if (!out.body) return res.end();
  const reader = out.body.getReader();
  while (true) { const { value, done } = await reader.read(); if (done) break; res.write(Buffer.from(value)); }
  res.end();
}

// Bound to loopback only, on both IPv4 and IPv6, because the browser may resolve "localhost" to either. The site must be
// reached as http://localhost:… — the shell registers its service worker only on https: or hostname localhost.
async function listenLoopback(server, port) {
  await new Promise((ok, fail) => server.once('error', fail).listen(port, '127.0.0.1', ok));
  const v6 = http.createServer((q, r) => server.emit('request', q, r));
  await new Promise(ok => v6.once('error', () => ok()).listen(port, '::1', ok));
}
await listenLoopback(site, SITE_PORT);
await listenLoopback(api, API_PORT);
console.log(JSON.stringify({ ready: true, site: SITE, api: API, demoTime: new Date(DEMO_START).toISOString() }));
