// Batch 8 helper for the -8 copies of the Phase 3 "thresholds disagree" scripts (P3-LEFTOVERS-02).
// WHY COPIES: audits/tools/phase3/leftovers/{thresholds,verify-thresholds-disagree-1,-2}.mjs read the red banner as
// document.getElementById('alert'), an id an earlier batch removed, so they crash on the pre-batch code before measuring
// anything. These copies measure the same claim -- the Larder, Home's fridge card, the Apps badge and the 8 am push agree
// on which food needs eating and in what words -- against today's markup (the banner is `.alert`, found by class), on the
// pre-batch archive and on the final code alike. The rule they hold every surface to is the household's (decision, batch 8):
// without a use-by 0-3 days fresh, 4-6 "eat soon", 7+ "use it up".
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
export { local, sleep, ROOT };
export const EV8 = path.join(ROOT, 'audits', 'evidence', 'p6', '8'); fs.mkdirSync(EV8, { recursive: true });
export const TODAY = '2026-09-22';   // the rig's demo date (New York)
export const levelOf = days => days === Infinity ? 'old' : days >= 7 ? 'old' : days >= 4 ? 'soon' : 'fresh';
export const daysSince = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? Math.max(0, Math.round((Date.parse(TODAY + 'T00:00:00Z') - Date.parse(d + 'T00:00:00Z')) / 86400000)) : Infinity;
let pass = 0, fail = 0; export const out = {};
export const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x).slice(0, 600)); } out[n] = { pass: !!c, ...(x === undefined ? {} : { got: x }) }; };
export const finish = name => { fs.writeFileSync(path.join(EV8, name + '.json'), JSON.stringify(out, null, 1)); console.log(`\n${pass} passed, ${fail} failed -> audits/evidence/p6/8/${name}.json`); process.exit(fail ? 1 : 0); };
const toneLevel = { urgent: 'old', warn: 'soon', fresh: 'fresh' };
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Seed an empty fridge with one dish per age (days), logged as Eli. */
export async function seedAges(L, ages) {
  const items = ages.map(a => { const id = 'thr' + a; return { key: 'item:' + id, value: { id, name: 'Age' + a + ' dish', size: 'Medium', dateLogged: new Date(Date.parse(TODAY + 'T00:00:00Z') - a * 86400000).toISOString().slice(0, 10), by: 'eli', byName: 'Eli' } }; });
  const w = await L.apiAs('eli', '/api/data/leftovers/batch?scope=family', { method: 'POST', body: { items } });
  return { status: w.status, items: items.map(i => i.value) };
}
/** The live rows on the server as a profile. */
export async function serverItems(L, as = 'eli') {
  const r = await L.apiAs(as, '/api/data/leftovers?scope=family');
  return ((r.body && (r.body.items || r.body.rows)) || []).filter(x => x.value && /^item:/.test(x.key)).map(x => x.value);
}

/** Read every surface for one device and profile. */
export async function surfaces(L, { device, profile }) {
  const d = await L.device({ device, profile });
  await d.goto('#home'); await sleep(2500);
  const home = await d.page.evaluate(() => {
    const c = [...document.querySelectorAll('.gcard')].find(c => /In the fridge/.test(c.textContent));
    return c ? { big: c.querySelector('.gbig').textContent.trim(), rows: [...c.querySelectorAll('.fresh > div')].map(r => ({ name: r.querySelector('.fl span').textContent.trim(), right: r.querySelector('.fl span:last-child').textContent.trim(), stale: r.classList.contains('stale') })) } : null;
  });
  await d.goto('#apps'); await sleep(1500);
  const badge = await d.page.evaluate(() => { const b = document.querySelector('.tile[data-id="leftovers"] .badge'); return b ? { n: +b.textContent, aria: b.getAttribute('aria-label') } : { n: 0, aria: null }; });
  const f = await d.openApp('leftovers');
  await f.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0, null, { timeout: 15000 });
  await sleep(800);
  const larder = await f.evaluate(() => {
    const a = document.querySelector('.alert');
    return {
      banner: a ? a.textContent.replace(/\s+/g, ' ').trim() : null,
      headings: [...document.querySelectorAll('.group h2')].map(h => h.textContent.replace(/\s+/g, ' ').trim()),
      cards: [...document.querySelectorAll('.item')].map(c => ({ name: c.querySelector('.nm').textContent, days: c.dataset.days === 'unknown' ? null : +c.dataset.days, tone: c.dataset.tone, chip: c.querySelector('.status').textContent.trim() })),
    };
  });
  const m = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'morning' } });
  return { d, home, badge, larder, push: m.body || {}, pushStatus: m.status };
}

/** The agreement checks, for the items the server holds. */
export function agree(s, items, label = '') {
  const want = items.map(i => ({ name: i.name, days: daysSince(i.dateLogged), level: levelOf(daysSince(i.dateLogged)) })).sort((a, b) => b.days - a.days);
  const due = want.filter(w => w.level !== 'fresh'), old = want.filter(w => w.level === 'old');
  const nm = x => String(x).replace(/\s*\(.*$/, '').trim();
  const larderLevel = Object.fromEntries(s.larder.cards.map(c => [c.name, toneLevel[c.tone]]));
  ok(want.every(w => larderLevel[w.name] === w.level), label + 'the Larder groups every item by the rule (fresh 0-3, eat soon 4-6, use it up 7+)', { want: want.map(w => w.name + ':' + w.level), got: larderLevel });
  const homeNames = s.home ? s.home.rows.map(r => r.name) : [];
  ok(JSON.stringify(homeNames) === JSON.stringify(due.slice(0, 3).map(w => w.name)), label + 'Home lists the most urgent items needing food eaten (up to 3), the same ones', { home: homeNames, want: due.slice(0, 3).map(w => w.name) });
  ok(!!s.home && s.home.rows.every(r => r.stale === ((want.find(w => w.name === r.name) || {}).level === 'old')), label + 'Home marks exactly the "use it up" ones', s.home && s.home.rows);
  ok(s.badge.n === due.length, label + 'the Apps badge counts what needs eating (' + due.length + ')', s.badge);
  const pushNames = (s.push.due || []).map(nm).sort();
  ok(JSON.stringify(pushNames) === JSON.stringify(due.map(w => w.name).sort()), label + 'the 8 am push names the same items (eat soon from 4 days, not 5)', { push: pushNames, want: due.map(w => w.name).sort() });
  ok(old.length ? !!(s.larder.banner && s.larder.banner.includes(old[0].name)) : !s.larder.banner, label + 'the red banner appears only with a "use it up" item' + (old.length ? ' and names the oldest' : ''), s.larder.banner);
  // the words
  ok(s.larder.headings.some(h => /Use it up/.test(h)) === (old.length > 0) && s.larder.headings.some(h => /Eat soon/.test(h)) === (due.length > old.length) && !s.larder.headings.some(h => /Aging/.test(h)), label + 'the Larder\'s group headings are "Use it up" / "Eat soon" (not "Aging")', s.larder.headings);
  ok(!old.length || !!(s.home && /use it up/i.test(s.home.big)), label + 'Home says "use it up" for the old ones', s.home && s.home.big);
  const body = String(s.push.body || '');
  ok(old.length === 0 || new RegExp('Use it up: .*' + esc(old[0].name)).test(body), label + 'the push body says "Use it up: <name> (N days)"', body || '(the job reports no body)');
  ok((due.length === old.length) || /Eat soon: /.test(body), label + 'the push body says "Eat soon: ..." for the 4-6 day ones', body || '(the job reports no body)');
}
