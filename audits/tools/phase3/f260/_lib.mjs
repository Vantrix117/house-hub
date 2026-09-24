// Phase 3 F260 helpers (read-only use of the shared harness). Evidence goes to audits/evidence/p3/f260/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export { local, sleep, DEMO } from '../../lib/local.mjs';
import { sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..', '..', '..');
export const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'f260');
fs.mkdirSync(EVID, { recursive: true });
export const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');
export function save(name, obj) { const f = path.join(EVID, name); fs.writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj, null, 1)); return rel(f); }
/** 1x CSS-scale screenshot of a page (or the page holding a frame). */
export async function shot(page, name, opts = {}) { const f = path.join(EVID, name); await page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide', ...opts }); return rel(f); }

/** Server rows for a profile's app scope, as { key: value }. */
export async function rows(L, pid, app = 'f260', scope = 'person') {
  const r = await L.apiAs(pid, `/api/data/${app}?scope=${scope}`);
  const out = {}; for (const it of (r.body.items || [])) out[it.key] = it.value; return out;
}
export async function rowMeta(L, pid, key, app = 'f260', scope = 'person') {
  const r = await L.apiAs(pid, `/api/data/${app}?scope=${scope}&key=${encodeURIComponent(key)}`); return r.body.item;
}
/** PUT a row as a profile with an explicit updated_at (default: the server's own now, read from a GET). */
export async function put(L, pid, key, value, { app = 'f260', scope = 'person', at } = {}) {
  if (at == null) { const g = await L.apiAs(pid, `/api/data/${app}?scope=${scope}&key=__none__`); at = g.body.now; }
  return L.apiAs(pid, `/api/data/${app}/${encodeURIComponent(key)}?scope=${scope}`, { method: 'PUT', body: { value, updated_at: at } });
}
/** Text of selectors inside a frame/page. */
export async function texts(f, sels) { return f.evaluate(ss => Object.fromEntries(ss.map(s => { const e = document.querySelector(s); return [s, e ? (e.hidden ? '(hidden) ' : '') + e.textContent.replace(/\s+/g, ' ').trim() : null]; })), sels); }
/** Wait until the F260 frame has painted its Today card. */
export async function ready(f) { await f.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim().length > 0; }, null, { timeout: 15000 }); await sleep(300); }
/** Count of POSTs/PUTs to the data API seen on a page, keyed by path. */
export function watchWrites(page) {
  const seen = [];
  page.on('request', r => { const u = r.url(); if (/\/api\/data\//.test(u) && r.method() !== 'GET') { let b = null; try { b = r.postDataJSON(); } catch {} seen.push({ t: Date.now(), method: r.method(), path: u.replace(/^https?:\/\/[^/]+/, ''), keys: b && b.items ? b.items.map(i => i.key) : (b ? ['(single)'] : []) }); } });
  return seen;
}
