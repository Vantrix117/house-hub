// Skeptic #1 for finding "cross-origin-write-executes": does a PUT from a non-allow-listed Origin really commit?
// Three views of the same write (PUT /api/data/leftovers/item:<k>?scope=family as Eli, with valid tokens):
//   A. raw Node fetch with a forged Origin header (what the investigator's in-process call did) — not a browser;
//   B. a real browser page on a NON-allow-listed origin (http://127.0.0.1:<site port>; the rig allow-lists only
//      http://localhost:<site port>) holding the tokens, in WebKit and Chromium — cors mode and no-cors mode;
//   C. control: the same fetch from the allow-listed origin (http://localhost:<site port>) — must succeed.
// Ground truth for "did it commit" = the server row, read back with L.apiAs.
// Run:  node "audits/tools/phase2/SEC/verify-cross-origin-write-executes-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/SEC');
const out = {};

for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'real', engine });
  const r = (out[engine] = {});
  try {
    const dt = L.S.info.device.token, pt = L.S.info.sessions.eli;
    const allowed = L.site;                                   // http://localhost:<port>  (ALLOWED_ORIGINS in lib/server.mjs)
    const evil = L.site.replace('//localhost:', '//127.0.0.1:'); // same files, different origin, NOT allow-listed
    r.origins = { allowed, evil, api: L.api };
    const persisted = async k => { const g = await L.apiAs('eli', `/api/data/leftovers?scope=family&key=item:${k}`); return !!(g.body && g.body.item && g.body.item.value); };
    const val = k => ({ id: k, name: 'probe ' + k, size: 'Small', dateLogged: '2026-09-22' });

    // A. raw, non-browser: forged Origin, no preflight (only once is enough, but cheap)
    {
      const k = `xo-raw-${engine}`;
      const pre = await fetch(`${L.api}/api/data/leftovers/item:${k}?scope=family`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example.com', 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type,x-device-token,x-profile-token' } });
      const put = await fetch(`${L.api}/api/data/leftovers/item:${k}?scope=family`, { method: 'PUT', headers: { Origin: 'https://evil.example.com', 'Content-Type': 'application/json', 'X-Device-Token': dt, 'X-Profile-Token': pt }, body: JSON.stringify({ value: val(k), updated_at: Date.now() }) });
      r.A_raw_forged_origin = {
        preflight: { status: pre.status, acao: pre.headers.get('access-control-allow-origin'), acah: pre.headers.get('access-control-allow-headers') },
        put: { status: put.status, acao: put.headers.get('access-control-allow-origin') },
        row_persisted: await persisted(k),
      };
    }

    // B + C. real browser pages
    const ctx = await L.browser.newContext();
    const page = await ctx.newPage();
    const consoleLines = [];
    page.on('console', m => consoleLines.push(`${m.type()}: ${m.text()}`.slice(0, 300)));
    const reqs = [];
    page.on('request', q => { if (q.url().startsWith(L.api)) reqs.push(`${q.method()} ${q.url().replace(L.api, '')}`); });
    const attempt = (k, mode) => page.evaluate(async ({ api, k, dt, pt, mode, v }) => {
      const url = `${api}/api/data/leftovers/item:${k}?scope=family`;
      const init = mode === 'no-cors'
        ? { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json', 'X-Device-Token': dt, 'X-Profile-Token': pt }, body: JSON.stringify({ items: [{ key: 'item:' + k, value: v, updated_at: Date.now() }] }) }
        : { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Device-Token': dt, 'X-Profile-Token': pt }, body: JSON.stringify({ value: v, updated_at: Date.now() }) };
      const target = mode === 'no-cors' ? `${api}/api/data/leftovers/batch?scope=family` : url;
      try { const res = await fetch(target, init); let body = null; try { body = await res.text(); } catch {} return { origin: location.origin, ok: true, status: res.status, type: res.type, body: body && body.slice(0, 200) }; }
      catch (e) { return { origin: location.origin, ok: false, error: String(e && e.message || e) }; }
    }, { api: L.api, k, dt, pt, mode, v: val(k) });

    // B. non-allow-listed origin
    await page.goto(evil + '/apps.json');
    {
      const k = `xo-evil-cors-${engine}`;
      const res = await attempt(k, 'cors');
      await new Promise(s => setTimeout(s, 500));
      r.B_browser_evil_origin_cors = { fetch: res, row_persisted: await persisted(k) };
    }
    {
      const k = `xo-evil-nocors-${engine}`;
      const res = await attempt(k, 'no-cors');
      await new Promise(s => setTimeout(s, 500));
      r.B_browser_evil_origin_nocors = { fetch: res, row_persisted: await persisted(k), note: 'no-cors drops the X-*-Token headers (not CORS-safelisted), so the server sees no tokens' };
    }
    // C. control: allow-listed origin, identical code
    await page.goto(allowed + '/apps.json');
    {
      const k = `xo-allowed-cors-${engine}`;
      const res = await attempt(k, 'cors');
      r.C_browser_allowed_origin_cors = { fetch: res, row_persisted: await persisted(k) };
    }
    r.browser_requests_seen = reqs;
    r.console = consoleLines.filter(l => /CORS|Origin|Access-Control|blocked|Fetch API|Failed/i.test(l)).slice(0, 6);
    await ctx.close();
  } finally {
    await L.close();
  }
}

console.log(JSON.stringify(out, null, 1));
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'verify-cross-origin-write-executes-1.json'), JSON.stringify(out, null, 1));
