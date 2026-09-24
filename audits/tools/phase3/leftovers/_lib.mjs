// Phase 3 Larder helpers (read-only use of the harness). Every script in this folder imports these.
import fs from 'node:fs';
import path from 'node:path';
export { local, sleep, DEMO } from '../../lib/local.mjs';

export const EVID = path.resolve('audits/evidence/p3/leftovers');
fs.mkdirSync(EVID, { recursive: true });
export const save = (name, obj) => { const f = path.join(EVID, name); fs.writeFileSync(f, JSON.stringify(obj, null, 1)); return 'audits/evidence/p3/leftovers/' + name; };
export const shot = async (pageOrFrame, name, opts = {}) => {
  const page = pageOrFrame.page ? pageOrFrame.page() : pageOrFrame;
  const f = path.join(EVID, name);
  await page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide', ...opts });
  return 'audits/evidence/p3/leftovers/' + name;
};

/** Open the Larder inside the shell viewer (#leftovers) and wait until it has rendered. */
export async function openLarder(d) {
  const f = await d.openApp('leftovers');
  await f.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0, null, { timeout: 15000 });
  return f;
}

/** Live rows on the server as a profile. */
export async function serverItems(L, as = 'eli') {
  const r = await L.apiAs(as, '/api/data/leftovers?scope=family');
  const rows = (r.body.items || r.body.rows || r.body.data || []);
  return rows.filter(x => x.value).map(x => ({ key: x.key, name: x.value.name, dateLogged: x.value.dateLogged }));
}

/** Put one item row (as the app would write it) through the real API. */
export async function putItem(L, as, item) {
  const body = { value: item, updated_at: Date.now() };
  return L.apiAs(as, '/api/data/leftovers/' + encodeURIComponent('item:' + item.id) + '?scope=family', { method: 'PUT', body });
}

/** Cards currently drawn by the app: name, days, tone, meta text, chip text. */
export async function cards(f) {
  return f.evaluate(() => [...document.querySelectorAll('.item')].map(c => ({
    id: c.dataset.id, name: c.querySelector('.nm').textContent, days: c.dataset.days, tone: c.dataset.tone,
    meta: c.querySelector('.meta').textContent, chip: c.querySelector('.status').textContent,
    group: c.closest('.group') && c.closest('.group').dataset.tone,
  })));
}
