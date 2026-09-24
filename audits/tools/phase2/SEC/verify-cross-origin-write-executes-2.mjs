// SEC skeptic #2 — "cross-origin-write-executes": does a write from a NON-allow-listed origin actually reach and commit on
// the server when it is sent by a BROWSER (the only client CORS applies to), or only when sent by a raw non-browser client?
// Run:  node "audits/tools/phase2/SEC/verify-cross-origin-write-executes-2.mjs"
//
// Method: the rig's local instance (real worker/src on in-memory SQLite). ALLOWED_ORIGINS there is exactly L.site
// (http://localhost:<sitePort>, lib/server.mjs:88). The "evil" page is http://127.0.0.1:<sitePort> — same files, a
// different origin that is NOT on the allow-list (no mixed content, no private-network-access differences). A tiny
// logging proxy sits in front of the API so we see every request that reaches the server (incl. CORS preflights) and
// whether the token headers arrived. Row persistence is checked afterwards through the API as Eli.
// Runs in both engines (Chromium = installed Chrome, WebKit = the rig's Safari stand-in).
process.env.TZ = 'America/New_York';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { local, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/SEC');
const result = { finding: 'cross-origin-write-executes', engines: {} };

function startProxy(target) {
  const log = [];
  const t = new URL(target);
  const srv = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      log.push({ method: req.method, path: req.url, origin: req.headers.origin || null,
        has_device_token: !!req.headers['x-device-token'], has_profile_token: !!req.headers['x-profile-token'],
        content_type: req.headers['content-type'] || null, acrm: req.headers['access-control-request-method'] || null,
        acrh: req.headers['access-control-request-headers'] || null });
      const up = http.request({ host: t.hostname === 'localhost' ? '127.0.0.1' : t.hostname, port: t.port, method: req.method, path: req.url, headers: { ...req.headers, host: t.host } }, r => {
        const entry = log[log.length - 1]; entry.status = r.statusCode; entry.acao = r.headers['access-control-allow-origin'] || null;
        res.writeHead(r.statusCode, r.headers); r.pipe(res);
      });
      up.on('error', e => { res.writeHead(502); res.end(String(e)); });
      up.end(Buffer.concat(chunks));
    });
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${srv.address().port}`, log, close: () => new Promise(r => srv.close(r)) })));
}

for (const engine of ['chromium', 'webkit']) {
  const L = await local({ variant: 'typical', clock: 'real', engine });
  const proxy = await startProxy(L.api);
  const r = {};
  try {
    const dt = L.S.info.device.token, pt = L.S.info.sessions.eli;
    const sitePort = new URL(L.site).port;
    const EVIL = `http://127.0.0.1:${sitePort}`;
    r.allowed_origin = L.site; r.evil_origin = EVIL;
    const row = async key => { const g = await L.apiAs('eli', `/api/data/leftovers?scope=family&key=${encodeURIComponent(key)}`); return !!(g.body && g.body.item && g.body.item.value); };

    const ctx = await L.browser.newContext();
    const page = await ctx.newPage();
    const runIn = async (origin, label, fn, args) => {
      await page.goto(origin + '/apps.json', { waitUntil: 'load' });
      const before = proxy.log.length;
      const res = await page.evaluate(fn, args).catch(e => ({ evalError: String(e) }));
      await new Promise(ok => setTimeout(ok, 300));
      return { label, page_origin: await page.evaluate(() => location.origin), fetch_result: res, server_saw: proxy.log.slice(before) };
    };

    // A. evil origin, PUT with valid tokens (exactly what the finding's failure scenario describes)
    const kA = 'item:xo-evil-put-' + engine;
    const A = await runIn(EVIL, 'A evil PUT with tokens', async ({ api, dt, pt, key }) => {
      try { const res = await fetch(api + '/api/data/leftovers/' + key + '?scope=family', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Device-Token': dt, 'X-Profile-Token': pt }, body: JSON.stringify({ value: { id: key, name: 'evil put', size: 'Small', dateLogged: '2026-09-22' }, updated_at: Date.now() }) }); return { status: res.status }; }
      catch (e) { return { threw: String(e) }; }
    }, { api: proxy.url, dt, pt, key: kA });
    A.row_persisted = await row(kA); r.A = A;

    // B. evil origin, POST batch with tokens (a POST, so a candidate "simple" method — but the token headers force a preflight)
    const kB = 'item:xo-evil-batch-' + engine;
    const B = await runIn(EVIL, 'B evil POST batch with tokens', async ({ api, dt, pt, key }) => {
      try { const res = await fetch(api + '/api/data/leftovers/batch?scope=family', { method: 'POST', headers: { 'Content-Type': 'text/plain', 'X-Device-Token': dt, 'X-Profile-Token': pt }, body: JSON.stringify({ items: [{ key, value: { id: key, name: 'evil batch' }, updated_at: Date.now() }] }) }); return { status: res.status }; }
      catch (e) { return { threw: String(e) }; }
    }, { api: proxy.url, dt, pt, key: kB });
    B.row_persisted = await row(kB); r.B = B;

    // C. evil origin, mode:'no-cors' POST (no preflight) — non-safelisted token headers are silently dropped by the browser
    const kC = 'item:xo-evil-nocors-' + engine;
    const C = await runIn(EVIL, 'C evil no-cors POST batch', async ({ api, dt, pt, key }) => {
      try { const res = await fetch(api + '/api/data/leftovers/batch?scope=family', { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain', 'X-Device-Token': dt, 'X-Profile-Token': pt }, body: JSON.stringify({ items: [{ key, value: { id: key, name: 'evil nocors' }, updated_at: Date.now() }] }) }); return { type: res.type, status: res.status }; }
      catch (e) { return { threw: String(e) }; }
    }, { api: proxy.url, dt, pt, key: kC });
    C.row_persisted = await row(kC); r.C = C;

    // D. evil origin, mode:'no-cors' PUT — PUT is not a no-cors method at all
    const D = await runIn(EVIL, 'D evil no-cors PUT', async ({ api, dt, pt }) => {
      try { const res = await fetch(api + '/api/data/leftovers/item:xo-d?scope=family', { method: 'PUT', mode: 'no-cors', headers: { 'X-Device-Token': dt, 'X-Profile-Token': pt }, body: '{}' }); return { type: res.type }; }
      catch (e) { return { threw: String(e) }; }
    }, { api: proxy.url, dt, pt });
    r.D = D;

    // E. CONTROL: identical PUT from the allow-listed origin — must succeed, proving the only variable is the origin
    const kE = 'item:xo-allowed-put-' + engine;
    const E = await runIn(L.site, 'E allowed-origin PUT with tokens (control)', async ({ api, dt, pt, key }) => {
      try { const res = await fetch(api + '/api/data/leftovers/' + key + '?scope=family', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Device-Token': dt, 'X-Profile-Token': pt }, body: JSON.stringify({ value: { id: key, name: 'allowed put', size: 'Small', dateLogged: '2026-09-22' }, updated_at: Date.now() }) }); return { status: res.status }; }
      catch (e) { return { threw: String(e) }; }
    }, { api: proxy.url, dt, pt, key: kE });
    E.row_persisted = await row(kE); r.E = E;

    // F. NON-BROWSER client (Node fetch) with a forged Origin: CORS does not apply — this is what the investigator measured
    const kF = 'item:xo-node-' + engine;
    const before = proxy.log.length;
    const fr = await fetch(proxy.url + '/api/data/leftovers/' + kF + '?scope=family', { method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example.com', 'X-Device-Token': dt, 'X-Profile-Token': pt }, body: JSON.stringify({ value: { id: kF, name: 'node' }, updated_at: Date.now() }) });
    r.F = { label: 'F Node fetch with forged Origin (not a browser)', status: fr.status, acao: fr.headers.get('access-control-allow-origin'), server_saw: proxy.log.slice(before), row_persisted: await row(kF) };

    // G. the narrow part that IS true: an UNAUTHENTICATED route reached by a preflight-free (no-cors, text/plain) POST is
    //    executed cross-origin — readJson ignores Content-Type (worker/src/index.js:42-44). /api/pair is the example.
    await L.setPairingCode('throwaway-xo-code');
    const G = await runIn(EVIL, 'G evil no-cors POST /api/pair (no tokens needed)', async ({ api }) => {
      try { const res = await fetch(api + '/api/pair', { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ code: 'wrong-guess', name: 'probe' }) }); return { type: res.type, status: res.status }; }
      catch (e) { return { threw: String(e) }; }
    }, { api: proxy.url });
    r.G = G;

    await ctx.close();
  } catch (e) { r.error = String(e && e.stack || e); }
  finally { await proxy.close(); await L.close(); }
  result.engines[engine] = r;
  const brief = k => r[k] && { fetch: r[k].fetch_result || { status: r[k].status }, server_saw: (r[k].server_saw || []).map(s => `${s.method} ${s.path.split('?')[0]} origin=${s.origin} dt=${s.has_device_token} pt=${s.has_profile_token} -> ${s.status} acao=${s.acao}`), row_persisted: r[k].row_persisted };
  console.log(`\n=== ${engine} ===`);
  for (const k of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) console.log(k, JSON.stringify(brief(k)));
  if (r.error) console.log('ERROR', r.error);
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'verify-cross-origin-write-executes-2.json'), JSON.stringify(result, null, 1));
console.log('\nwrote audits/evidence/p2/SEC/verify-cross-origin-write-executes-2.json');
