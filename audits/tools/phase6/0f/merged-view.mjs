// Batch 0f: a Node preload for the Phase 3 reproduction scripts of this batch (same idea as ../0e/merged-view.mjs).
//   NODE_OPTIONS="--import=file:///…/audits/tools/phase6/0f/merged-view.mjs" node <script>
// Since this batch Kid Verse keeps one row per star / reset / applied parent action / badge / heard day in the kid's person
// scope and writes the derived stars object and story to the family mirrors stars:<kid> / story:<kid>; Tally keeps
// count:<device> rows on a reset epoch. The scripts read the old person rows `stars`, `story` and `count`. This wraps fetch
// in the script's own process so a GET of those person keys answers with what the apps now show: Kid Verse's derived
// mirrors (written by the kid's device from the rows) and Tally's summed count. Every other request is left alone.
const orig = globalThis.fetch;
const who = new Map();
async function profileOf(origin, headers) {
  const h = new Headers(headers || {}); const t = h.get('X-Profile-Token'); if (!t) return null;
  if (who.has(t)) return who.get(t);
  const r = await orig(origin + '/api/me', { headers }); const j = await r.json().catch(() => null);
  const id = j && j.profile ? j.profile.id : null; who.set(t, id); return id;
}
function tallySum(items) {
  const by = new Map(items.map(r => [r.key, r]));
  const reset = by.get('reset'); const ep = reset && reset.value && typeof reset.value === 'object' && reset.value.epoch ? String(reset.value.epoch) : null;
  let sum = ep ? 0 : Math.max(0, Number(by.get('count') && by.get('count').value) || 0), t = by.get('count') ? by.get('count').updated_at : 0, any = !!by.get('count');
  for (const r of items) if (r.key.startsWith('count:') && r.value && typeof r.value === 'object' && (r.value.epoch || null) === ep) { sum += Math.floor(Number(r.value.n) || 0); t = Math.max(t, r.updated_at); any = true; }
  return any ? { key: 'count', value: Math.max(0, sum), updated_at: t } : null;
}
globalThis.fetch = async (input, init = {}) => {
  const url = String(input && input.url ? input.url : input);
  const method = (init.method || (input && input.method) || 'GET').toUpperCase();
  const m = /^(https?:\/\/[^/]+)\/api\/data\/(kidverse|tally)\?(.*)$/.exec(url);
  const res = await orig(input, init);
  if (!m || method !== 'GET' || !res.ok) return res;
  const [, origin, app, qs] = m; const q = new URLSearchParams(qs);
  if ((q.get('scope') || 'person') !== 'person' || q.get('since') || q.get('prefix')) return res;
  const body = await res.clone().json().catch(() => null); if (!body) return res;
  const subst = new Map();
  if (app === 'kidverse') {
    const pid = await profileOf(origin, init.headers); if (!pid) return res;
    const fam = ((await (await orig(`${origin}/api/data/kidverse?scope=family`, { headers: init.headers })).json().catch(() => ({}))).items) || [];
    for (const [key, mirror] of [['stars', 'stars:' + pid], ['story', 'story:' + pid]]) { const r = fam.find(x => x.key === mirror); if (r && r.value != null) subst.set(key, { key, value: r.value, updated_at: r.updated_at }); }
  } else {
    const all = Array.isArray(body.items) && !q.get('key') ? body.items : ((await (await orig(`${origin}/api/data/tally?scope=person`, { headers: init.headers })).json().catch(() => ({}))).items) || [];
    const c = tallySum(all); if (c) subst.set('count', c);
  }
  if (q.get('key')) { const k = q.get('key'); if (subst.has(k)) body.item = subst.get(k); }
  else if (Array.isArray(body.items)) {
    const seen = new Set();
    body.items = body.items.map(r => { if (subst.has(r.key)) { seen.add(r.key); return subst.get(r.key); } return r; });
    for (const [k, r] of subst) if (!seen.has(k)) body.items.push(r);
  }
  const headers = new Headers(res.headers); headers.delete('content-length');
  return new Response(JSON.stringify(body), { status: res.status, headers });
};
