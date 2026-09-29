// Batch 0e: a Node preload for the Phase 2/3 reproduction scripts.
//   NODE_OPTIONS="--import=file:///…/audits/tools/phase6/0e/merged-view.mjs" node <script>
// Since this batch the apps keep maps one row per entry over the old whole-map row (hub.rowMap): F260 done:/mem:/log:/
// recall: over f260.done / f260.mem / f260.log / f260.recall, Verses rev:<date>:<id>:<device> counts over `log`, the build
// guide step:<id> over `progress`. The scripts read the old keys through the local API (L.apiAs → fetch). This wraps fetch
// in the script's own process so a GET of person data answers the old keys with the MERGED value — exactly what the apps
// show — and leaves every other request alone. The rig's server and the browsers are not touched.
const FOLDS = {
  f260: [['f260.done', 'done:'], ['f260.mem', 'mem:'], ['f260.log', 'log:'], ['f260.recall', 'recall:']],
  dollywood: [['progress', 'step:']],
};
function fold(app, items) {
  const byKey = new Map(items.map(r => [r.key, r]));
  const out = new Map();
  for (const [legacy, prefix] of FOLDS[app] || []) {
    const base = byKey.get(legacy); const v = base && base.value && typeof base.value === 'object' ? { ...base.value } : {};
    let t = base ? base.updated_at : 0, any = !!base;
    for (const r of items) if (r.key.startsWith(prefix) && r.value != null) { any = true; t = Math.max(t, r.updated_at); const id = r.key.slice(prefix.length); if (r.value === false) delete v[id]; else v[id] = r.value; }
    if (any) out.set(legacy, { key: legacy, value: v, updated_at: t });
  }
  if (app === 'verses') {
    const base = byKey.get('log'); const v = base && base.value && typeof base.value === 'object' ? { ...base.value } : {};
    let t = base ? base.updated_at : 0, any = !!base;
    for (const r of items) if (r.key.startsWith('rev:') && r.value != null) { any = true; t = Math.max(t, r.updated_at); const d = r.key.slice(4, 14); v[d] = (Number(v[d]) || 0) + (Number(r.value) || 0); }
    if (any) out.set('log', { key: 'log', value: v, updated_at: t });
  }
  return out;
}
const orig = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = String(input && input.url ? input.url : input);
  const method = (init.method || (input && input.method) || 'GET').toUpperCase();
  const m = /^(https?:\/\/[^/]+)\/api\/data\/(f260|verses|dollywood)\?(.*)$/.exec(url);
  const res = await orig(input, init);
  if (!m || method !== 'GET' || !res.ok) return res;
  const [, origin, app, qs] = m; const q = new URLSearchParams(qs);
  if ((q.get('scope') || 'person') !== 'person') return res;
  const body = await res.clone().json().catch(() => null); if (!body) return res;
  let items = body.items;
  if (!Array.isArray(items) || q.get('prefix') || q.get('since')) {
    const all = await orig(`${origin}/api/data/${app}?scope=person`, { headers: init.headers });
    items = ((await all.json().catch(() => ({}))).items) || [];
  }
  const merged = fold(app, items);
  if (q.get('key')) { const k = q.get('key'); if (merged.has(k)) body.item = merged.get(k); }
  else if (Array.isArray(body.items)) {
    const seen = new Set();
    body.items = body.items.map(r => { if (merged.has(r.key)) { seen.add(r.key); return merged.get(r.key); } return r; });
    if (!q.get('prefix') && !q.get('since')) for (const [k, r] of merged) if (!seen.has(k)) body.items.push(r);
  }
  const headers = new Headers(res.headers); headers.delete('content-length');
  return new Response(JSON.stringify(body), { status: res.status, headers });
};
