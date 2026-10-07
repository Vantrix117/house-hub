// Batch 8, Worker D: the Larder's logic, the shared rule and the words, on the local rig. Claims:
//  A. ONE RULE (P3-LEFTOVERS-02): hub.larder.fresh (apps/hub.js) and its Worker twin (worker/src/larder.js) agree field by field over one
//     table (ages 0..12, unreadable dates, every use-by from 3 days past to 6 ahead, with and without an old log date), and the table
//     matches the household's rule written out independently (fresh 0-3, eat soon 4-6, use it up 7+; with a use-by: use it up from
//     the day, eat soon in the two days before it).
//  B. FOUR PLACES (P3-LEFTOVERS-02, GAP-LEFTOVERS-1, IMP-LEFTOVERS-I1): the Larder's groups, Home's fridge card, the Apps badge and the forced
//     8 am push name the same food in the same words, for a fridge with a use-by and a "some left" item in it.
//  C. THE APP: an empty Log says what is missing and focuses the field (UX-LEFTOVERS-5); Log toasts and brings the new card above the bar
//     (UX-LEFTOVERS-6); tapping a card opens the edit sheet with the full name, Save keeps who logged it, adds editedBy / editedAt and posts no
//     feed line (GAP-LEFTOVERS-1, P3-LEFTOVERS-11), an empty name is refused there too, Enter saves and Escape closes; a use-by moves the
//     card between groups; Copy the list is neutral and, when the clipboard is refused, shows the text selected in a box with Select and
//     copy (and Share where the device has it) (P3-LEFTOVERS-10, UX-LEFTOVERS-4); the red banner names the oldest and a tap scrolls to it and
//     highlights it (UX-LEFTOVERS-9); a failed pull says it in plain words with a Retry that pulls (UX-LEFTOVERS-8); a swipe reveals Some
//     left / Finish, a full swipe finishes through the check button's own six-second Undo path, a vertical drag is only a scroll, and
//     Some left puts portion: 'some' on the row, shows on the card and Undo takes it back (IMP-LEFTOVERS-I1); a kid and the TV can do none of it.
//   node "audits/tools/phase6/8/larder-a-8.mjs"      -> audits/evidence/p6/8/larder-a-8.json (+ PNGs)
import path from 'node:path';
import { local, sleep, ROOT, EV8, ok, out, finish, TODAY } from './_thr8.mjs';
import { fresh as wFresh, due as wDue, pushBody as wPushBody } from '../../../../worker/src/larder.js';

const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const nyDate = t => { const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(t)); const g = x => p.find(y => y.type === x).value; return `${g('year')}-${g('month')}-${g('day')}`; };
const norm = f => JSON.stringify({ ...f, days: f.days === Infinity ? 'inf' : f.days, score: f.score === Infinity ? 'inf' : f.score });
// the household's rule, written out once more, independent of both implementations
const spec = (it, today) => {
  const isDay = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) && !isNaN(Date.parse(v + 'T12:00:00Z')) && new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v;
  const dd = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
  if (isDay(it.useBy)) { const left = dd(today, it.useBy); return left <= 0 ? 'old' : left <= 2 ? 'soon' : 'fresh'; }
  if (!isDay(it.dateLogged)) return 'old';
  const age = Math.max(0, dd(it.dateLogged, today)); return age >= 7 ? 'old' : age >= 4 ? 'soon' : 'fresh';
};
const specScore = (it, today) => { const dd = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); return /^\d{4}-\d{2}-\d{2}$/.test(String(it.useBy)) ? 7 - dd(today, it.useBy) : /^\d{4}-\d{2}-\d{2}$/.test(String(it.dateLogged)) ? Math.max(0, dd(it.dateLogged, today)) : Infinity; };
const toneLevel = { urgent: 'old', warn: 'soon', fresh: 'fresh' };
const row = (id, name, dateLogged, extra = {}) => ({ id, name, size: 'Medium', dateLogged, by: 'eli', byName: 'Eli', ...extra });
const put = (L, as, items) => L.apiAs(as, '/api/data/leftovers/batch?scope=family', { method: 'POST', body: { items: items.map(v => ({ key: 'item:' + v.id, value: v, updated_at: Date.now() })) } });
const serverRow = async (L, id) => { const r = await L.apiAs('eli', '/api/data/leftovers?scope=family'); const x = ((r.body && (r.body.items || r.body.rows)) || []).find(i => i.key === 'item:' + id); return x ? x.value : null; };
const feed = async L => ((await L.apiAs('eli', '/api/activity?limit=100')).body.activity || []);
const until = async (read, pred, ms = 8000) => { const t0 = Date.now(); let v; for (;;) { v = await read(); if (pred(v)) return v; if (Date.now() - t0 > ms) return v; await sleep(200); } };
const flush = p => p.evaluate(async () => { for (let i = 0; i < 40; i++) { try { await hub.flush(); } catch {} if (!hub.sync.pending) return true; await new Promise(r => setTimeout(r, 200)); } return false; });
const pageUrl = L => L.site + '/apps/leftovers.html';
async function openLarder(d, L) {
  await d.page.goto(pageUrl(L));
  await d.page.waitForFunction(() => window.__larder && hub.profile && hub.sync && hub.sync.lastPull > 0 && document.getElementById('tally').textContent.length > 0, null, { timeout: 20000 });
  await sleep(500);
}

// ═══ A and B: the rule and the four places, on the demo clock (the date the seeded fridge is relative to) ═══
let L = await local({ variant: 'empty', clock: 'demo' });
try {
  console.log('\n## A. one rule: hub.larder.fresh (browser) and worker/src/larder.js agree over one table');
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  await openLarder(d, L);
  const table = [];
  for (let a = 0; a <= 12; a++) table.push({ dateLogged: addDays(TODAY, -a) });
  for (const bad of ['yesterday', '', undefined, '2026-02-30', 'soon', '26-09-22']) table.push({ dateLogged: bad });
  table.push({ dateLogged: addDays(TODAY, 2) });                                  // a future date reads as today
  for (const age of [0, 3, 9, 20]) for (let u = -3; u <= 6; u++) table.push({ dateLogged: addDays(TODAY, -age), useBy: addDays(TODAY, u) });
  table.push({ dateLogged: addDays(TODAY, -2), useBy: 'someday' }, { dateLogged: 'yesterday', useBy: addDays(TODAY, 4) });
  const browser = await d.page.evaluate(({ table, today }) => table.map(it => { const f = hub.larder.fresh(it, today); return { ...f, days: f.days === Infinity ? 'inf' : f.days, score: f.score === Infinity ? 'inf' : f.score }; }), { table, today: TODAY });
  const worker = table.map(it => JSON.parse(norm(wFresh(it, TODAY))));
  const diff = table.map((it, i) => ({ it, b: browser[i], w: worker[i] })).filter(x => JSON.stringify(x.b) !== JSON.stringify(x.w));
  ok(table.length > 50 && !diff.length, 'the browser rule and the Worker twin return the same level, days, daysLeft, label, age, when, short and score for all ' + table.length + ' rows', diff.slice(0, 3));
  const wrong = table.map((it, i) => ({ it, got: browser[i].level, want: spec(it, TODAY) })).filter(x => x.got !== x.want);
  ok(!wrong.length, 'and both match the household\'s rule written out independently (fresh 0-3 / eat soon 4-6 / use it up 7+; a use-by: use it up from the day, eat soon in the two days before; an unreadable date: check it)', wrong.slice(0, 3));
  const edge = a => browser[a].level + ':' + browser[a].label;
  ok(['fresh:Fresh', 'fresh:Fresh', 'fresh:Fresh', 'fresh:Fresh', 'soon:Eat soon', 'soon:Eat soon', 'soon:Eat soon', 'old:Use it up'].every((w, a) => edge(a) === w), 'the edges: 3 days Fresh, 4 Eat soon, 6 Eat soon, 7 Use it up', [0, 3, 4, 6, 7].map(edge));
  const unk = browser[13];
  ok(unk.level === 'old' && unk.label === 'Check date' && unk.when === 'check the date', 'an unreadable date is "Check date": use it up', unk);
  const ub = u => browser.find((b, i) => table[i].useBy === addDays(TODAY, u) && table[i].dateLogged === addDays(TODAY, -9));
  ok(ub(3).level === 'fresh' && ub(2).level === 'soon' && ub(1).level === 'soon' && ub(0).level === 'old' && ub(-1).level === 'old', 'a 9-day-old dish with a use-by: fresh with 3 days left, eat soon at 2 and 1, use it up from the day (the use-by wins over the age)', [3, 2, 1, 0, -1].map(u => ub(u).level));
  ok(ub(1).when === 'use by tomorrow' && ub(0).when === 'use by today' && ub(-2).when === '2 days past use-by' && ub(4).when === 'use by in 4 days', 'the words after a name: "use by tomorrow", "use by today", "2 days past use-by", "use by in 4 days"', [1, 0, -2, 4].map(u => ub(u).when));
  const items = table.slice(0, 13).map((t, i) => ({ id: 'n' + i, name: 'N' + i, ...t }));
  const bd = await d.page.evaluate(({ items, today }) => hub.larder.due(items, today).due.map(x => x.it.name), { items, today: TODAY });
  ok(JSON.stringify(bd) === JSON.stringify(wDue(items, TODAY).due.map(x => x.it.name)) && JSON.stringify(bd) === JSON.stringify(['N12', 'N11', 'N10', 'N9', 'N8', 'N7', 'N6', 'N5', 'N4']), 'due() lists what needs eating most urgent first, the same order in both copies', bd);

  console.log('\n## B. four places: the Larder, Home, the Apps badge and the 8 am push, one fridge with a use-by and a "some left" item');
  const seeds = [
    row('b3', 'Age3 dish', addDays(TODAY, -3)), row('b4', 'Age4 dish', addDays(TODAY, -4)), row('b7', 'Age7 dish', addDays(TODAY, -7)),
    row('bc', 'Chili', addDays(TODAY, -9), { useBy: addDays(TODAY, 5) }),               // 9 days old, use-by in 5: fresh
    row('bp', 'Pie', addDays(TODAY, -1), { useBy: addDays(TODAY, 2) }),                 // eat soon
    row('bu', 'Curry', addDays(TODAY, -1), { useBy: addDays(TODAY, -1) }),              // past its use-by: use it up
    row('br', 'Rice', addDays(TODAY, -5), { portion: 'some' }),                         // eat soon, some left
  ];
  const w = await put(L, 'eli', seeds); ok(w.status === 200, 'seeded seven dishes through the real API (use-by and portion pass the Worker\'s rules)', w.status);
  const want = seeds.map(s => ({ ...s, level: spec(s, TODAY), score: specScore(s, TODAY) })).sort((a, b) => b.score - a.score);
  const needs = want.filter(x => x.level !== 'fresh'), olds = want.filter(x => x.level === 'old');
  const dh = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  await dh.goto('#home'); await sleep(2500);
  const home = await dh.page.evaluate(() => { const c = [...document.querySelectorAll('.gcard')].find(c => /In the fridge/.test(c.textContent)); return c ? { big: c.querySelector('.gbig').textContent.trim(), rows: [...c.querySelectorAll('.fresh > div')].map(r => ({ name: r.querySelector('.fl span').textContent.trim(), right: r.querySelector('.fl span:last-child').textContent.trim(), stale: r.classList.contains('stale') })) } : null; });
  await dh.goto('#apps'); await sleep(1500);
  const badge = await dh.page.evaluate(() => { const b = document.querySelector('.tile[data-id="leftovers"] .badge'); return b ? { n: +b.textContent, aria: b.getAttribute('aria-label') } : null; });
  const f = await dh.openApp('leftovers'); await f.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0, null, { timeout: 15000 }); await sleep(800);
  const larder = await f.evaluate(() => ({ banner: (document.querySelector('.alert') || {}).textContent, headings: [...document.querySelectorAll('.group h2')].map(h => h.firstChild.textContent.trim()),
    cards: [...document.querySelectorAll('.item')].map(c => ({ name: c.querySelector('.nm').textContent, tone: c.dataset.tone, chip: c.querySelector('.status').textContent.trim(), portion: !!c.querySelector('.portion') })) }));
  const push = (await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'morning' } })).body;
  const lvl = Object.fromEntries(larder.cards.map(c => [c.name, toneLevel[c.tone]]));
  ok(want.every(x => lvl[x.name] === x.level), 'the Larder groups all seven the same as the rule (Chili: fresh by its use-by; Pie and Rice: eat soon; Curry, Age7: use it up)', { got: lvl, want: want.map(x => x.name + ':' + x.level) });
  ok(JSON.stringify(larder.headings) === JSON.stringify(['Use it up', 'Eat soon', 'Fresh']), 'the group headings are Use it up / Eat soon / Fresh', larder.headings);
  ok(larder.cards.find(c => c.name === 'Rice').portion && larder.cards.find(c => c.name === 'Rice').chip === 'Eat soon', 'the some-left card keeps its words and counts like any other (Eat soon)', larder.cards.find(c => c.name === 'Rice'));
  ok(JSON.stringify(home.rows.map(r => r.name)) === JSON.stringify(needs.slice(0, 3).map(x => x.name)) && home.rows.every(r => r.stale === (want.find(x => x.name === r.name).level === 'old')), 'Home\'s card lists the three most urgent, the same ones, "use it up" ones marked', home.rows);
  ok(/use it up/.test(home.big) || /eat soon/.test(home.big), 'Home says it in the Larder\'s words ("use it up" / "eat soon", no "to eat this week")', home.big);
  ok(badge && badge.n === needs.length && /use up/.test(badge.aria), 'the Apps badge counts all ' + needs.length + ' and says "to eat soon or use up"', badge);
  const names = (push.due || []).map(x => x.replace(/ \(.*$/, '')).sort();
  ok(JSON.stringify(names) === JSON.stringify(needs.map(x => x.name).sort()), 'the 8 am push names the same ' + needs.length + ' (the 4-day dish included: the old 5+ rule is gone)', names);
  ok(push.body === wPushBody(seeds, TODAY) && /^Use it up: .*Curry.* · Eat soon: /.test(push.body || ''), 'the push body is "Use it up: … · Eat soon: …" in the same words', push.body);
  ok(larder.banner && larder.banner.includes('Curry') && /and 1 more/.test(larder.banner), 'the red banner names the most urgent ("Curry …") and counts the rest', larder.banner);
  await dh.page.screenshot({ path: path.join(EV8, 'larder-a-8-b-larder.png'), scale: 'css' });
} finally { await L.close(); }

// ═══ C: the app, on the real clock (a frozen clock would freeze the Undo guard) ═══
L = await local({ variant: 'empty', clock: 'real' });
try {
  const today = nyDate(Date.now()), ago = n => addDays(today, -n);
  console.log('\n## C. the app (iPhone, Eli)');
  const filler = [...Array(11)].map((_, i) => row('f' + i, 'Filler ' + i, ago(2 + (i % 3)))).concat([row('e1', 'Church potluck baked ziti with the extra cheese and breadcrumbs', ago(8)), row('e2', 'Chili', ago(9)), row('e3', 'Soup', ago(5))]);
  await put(L, 'eli', filler);
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await openLarder(d, L);
  const P = d.page;
  const q = (sel, fn) => P.$eval(sel, fn);

  // the banner (UX-LEFTOVERS-9)
  const banner = await P.evaluate(() => { const a = document.querySelector('.alert'); return a ? { tag: a.tagName, text: a.textContent.replace(/\s+/g, ' ').trim(), target: a.dataset.target } : null; });
  ok(banner && banner.tag === 'BUTTON' && /Chili is 9 days old/.test(banner.text) && /and 1 more/.test(banner.text), 'the red banner is a button that names the oldest: "Chili is 9 days old · and 1 more"', banner);
  await P.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await sleep(300);
  await P.click('.alert'); await sleep(900);
  const jumped = await P.evaluate(id => { const c = document.querySelector('.item[data-id="' + id + '"]'); const r = c.getBoundingClientRect(); return { hl: c.classList.contains('hl'), inView: r.top >= 0 && r.bottom <= innerHeight }; }, banner.target);
  ok(jumped.hl && jumped.inView, 'a tap scrolls to that card and highlights it (.hl, for 1.6 s)', jumped);
  await sleep(1800);
  ok(await P.evaluate(id => !document.querySelector('.item[data-id="' + id + '"]').classList.contains('hl'), banner.target), 'the highlight goes by itself');

  // an empty Log (UX-LEFTOVERS-5)
  await P.fill('#name', ''); await P.click('#add .log'); await sleep(200);
  const en = await P.evaluate(() => ({ shown: !document.getElementById('name-err').hidden, text: document.getElementById('name-err').textContent, focus: document.activeElement && document.activeElement.id, inv: document.getElementById('name').getAttribute('aria-invalid') }));
  ok(en.shown && en.text === 'Type what it is' && en.focus === 'name' && en.inv === 'true', 'Log with nothing typed says "Type what it is" under the field and focuses it', en);
  await P.type('#name', 'T'); await sleep(100);
  ok(await P.evaluate(() => document.getElementById('name-err').hidden), 'typing clears the message');
  await P.fill('#name', '');

  // Log: toast and the new card above the bar (UX-LEFTOVERS-6)
  await P.fill('#name', 'Taco soup'); await P.click('#add .log'); await sleep(700);
  const lg = await P.evaluate(() => { const t = document.getElementById('hub-toast'); const c = [...document.querySelectorAll('.item')].find(x => x.querySelector('.nm').textContent === 'Taco soup'); const r = c && c.getBoundingClientRect(), b = document.getElementById('add').getBoundingClientRect(); return { toast: t && !t.hidden ? t.textContent : null, found: !!c, bottom: r && Math.round(r.bottom), barTop: Math.round(b.top), top: r && Math.round(r.top) }; });
  ok(lg.toast && /Logged Taco soup/.test(lg.toast), 'after Log a toast says "Logged Taco soup"', lg.toast);
  ok(lg.found && lg.bottom <= lg.barTop && lg.top >= 0, 'and the new card is on screen above the add bar', lg);
  await flush(P);

  // the edit sheet (GAP-LEFTOVERS-1, P3-LEFTOVERS-11)
  console.log('\n## C2. edit');
  const longId = 'e1', before = await feed(L);
  const nmBox = await P.evaluate(() => { const c = document.querySelector('.item[data-id="e1"] .nm'); const lh = parseFloat(getComputedStyle(c).lineHeight) || 20; return { h: c.getBoundingClientRect().height, lh, clamp: getComputedStyle(c).webkitLineClamp }; });
  ok(nmBox.h > nmBox.lh * 1.4 && nmBox.h <= nmBox.lh * 2.6, 'a long name wraps to two lines on the card (P3-LEFTOVERS-11)', nmBox);
  await P.evaluate(id => document.querySelector('.item[data-id="' + id + '"]').scrollIntoView({ block: 'center' }), longId); await sleep(300);
  const bx = await P.$eval('.item[data-id="e1"] .info', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await P.mouse.click(bx.x, bx.y); await sleep(500);
  const sheet = await P.evaluate(() => ({ open: !document.getElementById('editwrap').hidden, name: document.getElementById('e-name').value, size: document.getElementById('e-size').value, date: document.getElementById('e-date').value, useby: document.getElementById('e-useby').value, focus: document.activeElement && document.activeElement.id }));
  ok(sheet.open && sheet.name.startsWith('Church potluck baked ziti with the extra cheese') && sheet.date === ago(8) && sheet.useby === '' && sheet.focus === 'e-name', 'tapping the card opens the edit sheet with the full name, the date logged, no use-by, the cursor in the name', sheet);
  await P.screenshot({ path: path.join(EV8, 'larder-a-8-edit-sheet.png'), scale: 'css' });
  await P.fill('#e-name', ''); await P.click('#e-save'); await sleep(200);
  ok(await P.evaluate(() => !document.getElementById('e-name-err').hidden && document.activeElement.id === 'e-name' && !document.getElementById('editwrap').hidden), 'an empty name in the sheet shows "Type what it is" and keeps it open with the field focused');
  await P.fill('#e-name', 'Baked ziti'); await P.selectOption('#e-size', 'Large'); await P.fill('#e-useby', addDays(today, 1));
  await P.keyboard.press('Enter'); await sleep(900);
  ok(await P.evaluate(() => document.getElementById('editwrap').hidden), 'Enter saves and closes the sheet');
  await flush(P);
  const r1 = await serverRow(L, longId);
  ok(r1 && r1.name === 'Baked ziti' && r1.size === 'Large' && r1.useBy === addDays(today, 1) && r1.by === 'eli' && r1.byName === 'Eli' && r1.editedBy === 'eli' && r1.editedByName === 'Eli' && typeof r1.editedAt === 'number' && r1.dateLogged === ago(8), 'the row keeps who logged it (by, byName), takes the new name, size and use-by, and gains editedBy / editedAt', r1);
  const card = await P.evaluate(() => { const c = document.querySelector('.item[data-id="e1"]'); return { level: c.dataset.level, chip: c.querySelector('.status').textContent.trim(), group: c.closest('.group').dataset.tone, meta: c.querySelector('.meta').textContent.trim(), nm: c.querySelector('.nm').textContent }; });
  ok(card.nm === 'Baked ziti' && card.level === 'soon' && card.chip === 'Eat soon' && card.group === 'warn' && /use by/.test(card.meta), 'a use-by tomorrow moves it from Use it up (8 days) to Eat soon, and the line says "use by …"', card);
  await sleep(500); const after = await feed(L);
  ok(after.length === before.length, 'an edit posts no feed line', { before: before.length, after: after.length });
  await P.evaluate(() => document.querySelector('.item[data-id="e1"] .info').scrollIntoView({ block: 'center' })); await sleep(200);
  const bx2 = await P.$eval('.item[data-id="e1"] .info', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await P.mouse.click(bx2.x, bx2.y); await sleep(400);
  await P.fill('#e-name', 'Should not save'); await P.keyboard.press('Escape'); await sleep(300);
  ok(await P.evaluate(() => document.getElementById('editwrap').hidden) && (await serverRow(L, longId)).name === 'Baked ziti' && await P.$eval('.item[data-id="e1"] .nm', e => e.textContent === 'Baked ziti'), 'Escape closes the sheet and saves nothing');
  // a second person fixes it: the logger stays
  const d2 = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false }); await openLarder(d2, L);
  await d2.page.evaluate(() => document.querySelector('.item[data-id="e3"] .info').scrollIntoView({ block: 'center' })); await sleep(200);
  const b3 = await d2.page.$eval('.item[data-id="e3"] .info', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await d2.page.mouse.click(b3.x, b3.y); await sleep(400); await d2.page.fill('#e-name', 'Tomato soup'); await d2.page.click('#e-save'); await sleep(500); await flush(d2.page);
  const r3 = await serverRow(L, 'e3');
  ok(r3 && r3.name === 'Tomato soup' && r3.by === 'eli' && r3.byName === 'Eli' && r3.editedBy === 'mom', 'Mom fixes Eli\'s item: it still says Eli logged it, and Mom edited it', r3);
  await d2.close();

  // Some left from the sheet and by swipe (IMP-LEFTOVERS-I1)
  console.log('\n## C3. swipe and some left');
  await P.evaluate(() => document.querySelector('.item[data-id="f1"]').scrollIntoView({ block: 'center' })); await sleep(300);
  const geo = id => P.$eval('.item[data-id="' + id + '"]', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const swipe = async (id, dx, dy = 0, steps = 8) => { const g = await geo(id); const x0 = g.x + g.w - 70, y0 = g.y + g.h / 2; await P.mouse.move(x0, y0); await P.mouse.down(); for (let i = 1; i <= steps; i++) await P.mouse.move(x0 + dx * i / steps, y0 + dy * i / steps); await P.mouse.up(); await sleep(450); };
  // vertical first: only a scroll
  const y0 = await P.evaluate(() => scrollY);
  { const g = await geo('f1'); await P.mouse.move(g.x + g.w - 70, g.y + g.h / 2); await P.mouse.down(); for (let i = 1; i <= 6; i++) await P.mouse.move(g.x + g.w - 70 - i * 1, g.y + g.h / 2 + i * 8); await P.mouse.up(); await sleep(300); }
  ok(await P.evaluate(() => !document.querySelector('.item.swipe-open') && !document.querySelector('.item.swiping') && !document.querySelector('.item.finishing')), 'a mostly vertical drag opens nothing and finishes nothing (the page\'s own scroll)');
  await P.evaluate(() => document.querySelector('.item[data-id="f1"]').scrollIntoView({ block: 'center' })); await sleep(300);
  await P.evaluate(() => { window.__ev = []; const c = document.querySelector('.item[data-id="f1"]'); for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) c.addEventListener(t, e => window.__ev.push(t + ':' + Math.round(e.clientX) + ',' + Math.round(e.clientY)), true); });
  { const g = await geo('f1'); console.log('   at', await P.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.id || '') + '.' + e.className + ' <' + e.tagName + ' in ' + (e.closest('.item') && e.closest('.item').dataset.id) + ' anc ' + (e.closest('[id]') && e.closest('[id]').id) + ' txt ' + e.textContent.slice(0, 40) + ' editwrap.hidden ' + document.getElementById('editwrap').hidden + ' scrollY ' + scrollY + ' vh ' + innerHeight + ' sw ' + document.documentElement.scrollWidth : 'none'; }, [g.x + g.w - 70, g.y + g.h / 2])); }
  await swipe('f1', -120);
  const o1 = await P.evaluate(() => { const c = document.querySelector('.item[data-id="f1"]'); const a = c.querySelector('.swipe-act'); return { open: c.classList.contains('swipe-open'), sx: c.style.getPropertyValue('--sx'), aria: a.getAttribute('aria-hidden'), fin: !!c.querySelector('.sw-fin'), some: !!c.querySelector('.sw-some'), finishing: c.classList.contains('finishing'), ev: (window.__ev || []).slice(0, 14), geo: JSON.stringify(c.getBoundingClientRect()) }; });
  ok(o1.open && o1.aria === 'false' && /^-\d+px$/.test(o1.sx) && o1.fin && o1.some && !o1.finishing, 'a trailing swipe reveals Some left and Finish (card .swipe-open, --sx set, nothing finished)', o1);
  await P.screenshot({ path: path.join(EV8, 'larder-a-8-swipe-open.png'), scale: 'css' });
  await P.click('.item[data-id="f1"] .sw-some'); await sleep(700); await flush(P);
  const some = await serverRow(L, 'f1');
  ok(some && some.portion === 'some' && some.editedBy === 'eli' && some.by === 'eli', 'Some left writes portion: "some" (and editedBy) on the row, keeping the logger', some);
  ok(await P.evaluate(() => { const c = document.querySelector('.item[data-id="f1"]'); return !!c.querySelector('.portion') && /Some left/.test(c.querySelector('.portion').textContent) && c.classList.contains('some') && !c.classList.contains('swipe-open'); }), 'the card shows the half-filled bar and the words "Some left", closed again');
  const tt = await P.evaluate(() => document.getElementById('hub-toast') && document.getElementById('hub-toast').textContent);
  ok(/Some left of the Filler 1/.test(tt || ''), 'and a toast says so, with Undo', tt);
  await P.evaluate(() => document.querySelector('#hub-toast .toast-act').click()); await sleep(600); await flush(P);
  ok(!(await serverRow(L, 'f1')).portion && await P.evaluate(() => !document.querySelector('.item[data-id="f1"] .portion')), 'Undo takes it back: the row has no portion again and the card is whole');
  // the edit sheet's toggle
  await P.evaluate(() => window.__larderEdit('f2')); await sleep(300); await P.click('#e-some'); ok(await P.getAttribute('#e-some', 'aria-checked') === 'true', 'the sheet\'s "Some left" switch turns on'); await P.click('#e-save'); await sleep(600); await flush(P);
  ok((await serverRow(L, 'f2')).portion === 'some', 'saving writes portion: "some"');
  // a full swipe finishes through the check button's path
  await P.evaluate(() => document.querySelector('.item[data-id="f3"]').scrollIntoView({ block: 'center' })); await sleep(300);
  await swipe('f3', -320, 0, 12);
  const fin = await P.evaluate(() => { const c = document.querySelector('.item[data-id="f3"]'); const t = document.getElementById('hub-toast'); return { finishing: c.classList.contains('finishing'), undo: !!c.querySelector('.undo'), status: c.querySelector('.status').textContent.trim(), toast: t && !t.hidden ? t.textContent : null }; });
  ok(fin.finishing && fin.undo && fin.status === 'Finished' && /Finished the Filler 3/.test(fin.toast || ''), 'a full swipe finishes it in place for six seconds with Undo and the same toast as the check button', fin);
  const pre = await serverRow(L, 'f3'); ok(!!pre, 'nothing is removed from the house list until the six seconds are up');
  await sleep(800); await P.click('.item[data-id="f3"] .undo').catch(() => {}); await sleep(900);
  ok(await P.evaluate(() => !document.querySelector('.item[data-id="f3"]').classList.contains('finishing')), 'Undo puts it back, as for the check button');
  // the check button still works the same way
  await P.evaluate(() => document.querySelector('.item[data-id="f4"] .done').click()); await sleep(500);
  ok(await P.evaluate(() => document.querySelector('.item[data-id="f4"]').classList.contains('finishing')), 'the check button still finishes in place');
  await sleep(800); await P.click('.item[data-id="f4"] .undo').catch(() => {}); await sleep(600);

  // sync error (UX-LEFTOVERS-8)
  console.log('\n## C4. sync error, copy');
  await P.route('**/api/data/**', r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"internal","message":"boom"}' }));
  await P.evaluate(() => hub.pull().catch(() => {})); await sleep(1500);
  const se = await P.evaluate(() => { const m = document.getElementById('mode'); return { shown: !m.hidden, text: document.getElementById('modetext').textContent, retry: !document.getElementById('retry').hidden, state: hub.sync.state }; });
  ok(se.shown && se.text === "Couldn't reach the house. Your changes are saved on this device." && !/internal/i.test(se.text) && se.retry, 'a failed pull says "Couldn\'t reach the house. Your changes are saved on this device." with a Retry, never a raw code', se);
  await P.unroute('**/api/data/**');
  await P.click('#retry'); await sleep(2000);
  ok(await P.evaluate(() => document.getElementById('mode').hidden), 'Retry pulls, and the line goes away once the house answers');

  // copy (UX-LEFTOVERS-4, P3-LEFTOVERS-10)
  const help = await P.textContent('#copyhelp'), btn = await P.textContent('#copy');
  ok(help.trim() === 'Paste it into a message, a note or Hearth.' && /Copy the list/.test(btn) && !/Claude|push my leftovers/i.test(await P.textContent('.hearth')), 'the copy block is neutral: "Copy the list" / "Paste it into a message, a note or Hearth." and does not mention Claude', { help, btn });
  ok(await P.evaluate(() => !!document.querySelector('#copy use[href$="#i-copy"]') && !document.querySelector('#copy use[href*="refresh"]')), 'the Copy button draws the copy icon from the sprite, not the refresh arrows');
  await P.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('refused')); document.execCommand = () => false; });
  await P.click('#copy'); await sleep(500);
  const cb = await P.evaluate(() => { const t = document.getElementById('copytext'); return { shown: !document.getElementById('copybox').hidden, ro: t.readOnly, sel: t.selectionEnd - t.selectionStart, len: t.value.length, starts: t.value.slice(0, 33), share: !document.getElementById('copyshare').hidden, btn: document.getElementById('copyselect').textContent, label: document.getElementById('copy').textContent.trim() }; });
  ok(cb.shown && cb.ro && cb.len > 20 && cb.sel === cb.len && /^Leftovers to eat soon or use up/.test(cb.starts), 'when the clipboard is refused the list appears, all selected, in a read-only box', cb);
  ok(cb.btn === 'Select and copy' && !cb.share, 'with "Select and copy", and no Share where the device has none', cb);
  await P.evaluate(() => { navigator.share = () => { window.__shared = 1; return Promise.resolve(); }; });
  await P.click('#copy'); await sleep(400);
  ok(await P.evaluate(() => !document.getElementById('copyshare').hidden), 'Share is offered where navigator.share exists');
  await P.click('#copyshare'); await sleep(200); ok(await P.evaluate(() => window.__shared === 1), 'and it shares the text');
  await P.evaluate(() => { navigator.clipboard.writeText = () => Promise.resolve(); });
  await sleep(2200);   // the earlier clicks' 2 s labels have gone
  await P.click('#copy'); await sleep(400);
  ok(await P.evaluate(() => document.getElementById('copybox').hidden && /Copied/.test(document.getElementById('copy').textContent)), 'a copy that works says Copied! and the box goes away');
  await P.screenshot({ path: path.join(EV8, 'larder-a-8-c-end.png'), scale: 'css' });

  // ── C6. review round 1 (Opus): P1 Undo as the last editor, P2 only what you changed, P8 a finished item stays finished, P6 focus after Save, P7 a tap closes an open swipe, N1 honest subtitles and the bar's score ──
  console.log('\n## C6. review round 1');
  const mom = (id, v) => L.apiAs('mom', '/api/data/leftovers/' + encodeURIComponent('item:' + id) + '?scope=family', { method: 'PUT', body: { value: v, updated_at: Date.now() } });
  const momDel = id => L.apiAs('mom', '/api/data/leftovers/' + encodeURIComponent('item:' + id) + '?scope=family', { method: 'DELETE' });
  await put(L, 'eli', [row('r1', 'Lasagna', ago(1)), row('r2', 'Alpha', ago(1)), row('r3', 'Casserole', ago(1)), row('r4', 'Gumbo', today, { useBy: today }), row('r5', 'Noodles', ago(1))]);
  await P.evaluate(() => hub.pull()); await sleep(800); await P.evaluate(() => __larder.render()); await sleep(300);
  // P1: Mom edited last; Eli marks Some left and Undoes: the house takes it (editedBy is Eli's own), and only the portion goes back
  { const m = await mom('r1', row('r1', 'Lasagna', ago(1), { editedBy: 'mom', editedByName: 'Elizabeth', editedAt: Date.now() - 5000 })); ok(m.status === 200, 'Mom edits Lasagna (editedBy mom)', m.status);
    await P.evaluate(() => hub.pull()); await sleep(600);
    await P.evaluate(() => __larder.setPortion('r1', true)); await sleep(600); await flush(P);
    const s1 = await serverRow(L, 'r1'); ok(s1.portion === 'some' && s1.editedBy === 'eli', 'Eli marks it Some left (the row now says Eli edited it)', s1);
    await P.evaluate(() => document.querySelector('#hub-toast .toast-act').click()); await sleep(700); await flush(P);
    const s2 = await serverRow(L, 'r1'), dev = await P.evaluate(() => ({ row: hub.get('item:r1'), whole: !document.querySelector('.item[data-id="r1"] .portion') }));
    ok(!s2.portion && s2.editedBy === 'eli' && !dev.row.portion && dev.whole, 'P1: Undo of Some left works after someone else edited last: the house holds the item whole again, the device agrees (it used to be refused)', { s2, dev });
    // and when it is Mom who has since renamed it, Undo takes back only the portion
    await P.evaluate(() => __larder.setPortion('r1', true)); await sleep(500); await flush(P);
    await mom('r1', { ...(await serverRow(L, 'r1')), name: 'Lasagna (big)', editedBy: 'mom', editedByName: 'Elizabeth', editedAt: Date.now() });
    await P.evaluate(() => hub.pull()); await sleep(600);
    await P.evaluate(() => document.querySelector('#hub-toast .toast-act') && document.querySelector('#hub-toast .toast-act').click()); await sleep(700); await flush(P);
    const s3 = await serverRow(L, 'r1'); ok(s3.name === 'Lasagna (big)' && !s3.portion, 'Undo after Mom renamed it takes back only the portion and keeps her name', s3); }
  // P2: Save writes only what changed since the sheet opened
  { await P.evaluate(() => window.__larderEdit('r2')); await sleep(400);
    await mom('r2', row('r2', 'Beta', ago(1), { editedBy: 'mom', editedByName: 'Elizabeth', editedAt: Date.now() }));
    await P.evaluate(() => hub.pull()); await sleep(600);
    await P.click('#e-save'); await sleep(900); await flush(P);
    const a = await serverRow(L, 'r2'); ok(a.name === 'Beta' && a.editedBy === 'mom', 'P2: an untouched Save after another device renamed it writes nothing (Beta stays, still edited by Mom)', a);
    await P.evaluate(() => window.__larderEdit('r2')); await sleep(400);
    await mom('r2', row('r2', 'Gamma', ago(1), { editedBy: 'mom', editedByName: 'Elizabeth', editedAt: Date.now() }));
    await P.evaluate(() => hub.pull()); await sleep(600);
    await P.selectOption('#e-size', 'Small'); await P.click('#e-save'); await sleep(1000); await flush(P);
    const b = await serverRow(L, 'r2'); ok(b.name === 'Gamma' && b.size === 'Small' && b.editedBy === 'eli', 'P2: changing only the size keeps the other device\'s new name (Gamma) and writes Small', b); }
  // P8: finished elsewhere while the sheet is open: not brought back
  { await P.evaluate(() => window.__larderEdit('r3')); await sleep(400);
    await momDel('r3'); await P.fill('#e-name', 'Casserole 2'); await P.click('#e-save'); await sleep(1500); await flush(P);
    const toastTxt = await P.evaluate(() => { const t = document.getElementById('hub-toast'); return t && t.textContent; });
    ok(!(await serverRow(L, 'r3')) && /finished on another device/.test(toastTxt || '') && !(await P.evaluate(() => hub.get('item:r3'))), 'P8: an item finished on another device while the sheet was open is not brought back; a toast says so', { toastTxt }); }
  // P6: keyboard Save returns the focus to the card
  { await P.evaluate(() => { document.querySelector('.item[data-id="r5"] .nm[role="button"]').scrollIntoView({ block: 'center' }); document.querySelector('.item[data-id="r5"] .nm[role="button"]').focus(); });
    await P.keyboard.press('Enter'); await sleep(400);
    ok(await P.evaluate(() => !document.getElementById('editwrap').hidden), 'Enter on a focused card opens the sheet');
    await P.keyboard.type(' x'); await P.keyboard.press('Enter'); await sleep(1500);
    const fo = await P.evaluate(() => { const a = document.activeElement; return { inCard: !!(a.closest && a.closest('.item[data-id="r5"]')), cls: a.className, role: a.getAttribute('role'), sheet: document.getElementById('editwrap').hidden }; });
    ok(fo.sheet && fo.inCard && fo.role === 'button', 'P6: after a keyboard Save the focus is on that card (its edit target), not lost to the page', fo); }
  // P7: a tap on a swiped-open card closes the swipe and opens no sheet
  { await P.evaluate(() => document.querySelector('.item[data-id="r5"]').scrollIntoView({ block: 'center' })); await sleep(300);
    await swipe('r5', -120);
    ok(await P.evaluate(() => document.querySelector('.item[data-id="r5"]').classList.contains('swipe-open')), 'a swipe opens the card (P7 set-up)');
    const g = await geo('r5'); await P.mouse.click(g.x + 60, g.y + g.h / 2); await sleep(700);
    const t7 = await P.evaluate(() => ({ open: document.querySelector('.item[data-id="r5"]').classList.contains('swipe-open'), sheet: !document.getElementById('editwrap').hidden }));
    ok(!t7.open && !t7.sheet, 'P7: tapping the face of an open card closes the swipe and does not open the edit sheet', t7);
    await P.mouse.click(g.x + 60, g.y + g.h / 2); await sleep(500);
    ok(await P.evaluate(() => !document.getElementById('editwrap').hidden), 'and the next tap opens it as usual'); await P.keyboard.press('Escape'); await sleep(300); }
  // N1: the group subtitles are true with a use-by; the bar follows the rule's score
  { await P.evaluate(() => __larder.render()); await sleep(400);
    const n1 = await P.evaluate(() => ({ subs: [...document.querySelectorAll('.group h2 small')].map(s => s.textContent), p: getComputedStyle(document.querySelector('.item[data-id="r4"] .bar')).getPropertyValue('--p'), pInline: document.querySelector('.item[data-id="r4"] .bar').style.getPropertyValue('--p'), grp: document.querySelector('.item[data-id="r4"]').closest('.group').dataset.tone }));
    ok(n1.subs.some(s => /use-by/.test(s)) && n1.subs.filter(s => /use-by/.test(s)).length >= 2, 'N1: the "Use it up" and "Eat soon" subtitles say they include a use-by', n1.subs);
    ok(n1.grp === 'urgent' && Math.abs(+n1.pInline - 0.7) < 0.001, 'N1: a dish logged today with a use-by of today sits in Use it up and its bar is at 7/10 (the rule\'s score, not its age)', n1); }

  // ── C7. confirmation round: R2 a remote edit never moves another card (one column at 390, two at 1440) ──
  console.log('\n## C7. a remote change never moves a card');
  for (const [w, h, label] of [[390, 844, '390, one column'], [1440, 900, '1440, two columns']]) {
    await P.setViewportSize({ width: w, height: h }); await sleep(500);
    await P.evaluate(() => hub.pull()); await sleep(600); await P.evaluate(() => { __larder.render(); window.scrollTo(0, 0); }); await sleep(400);
    const boxes = () => P.evaluate(() => Object.fromEntries([...document.querySelectorAll('.item')].map(c => { const r = c.getBoundingClientRect(); return [c.dataset.id, [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height)].join(',')]; })));
    const ids = await P.evaluate(() => [...document.querySelectorAll('.item:not(.finishing):not(.gone)')].map(c => c.dataset.id).filter(i => /^f\d/.test(i)));
    const [a, b] = ids.slice(2, 4);
    const before = await boxes();
    // a card's height is its tallest column: at 390 on WebKit the check/chip column (89 px) already out-tops a one-line name plus a two-line name, so a bare rename lands in place legitimately. The change to card a therefore also adds a use-by and a Some left (two more lines of text) so it certainly outgrows the card and must wait behind the pill.
    const sa = await serverRow(L, a), sb = await serverRow(L, b);
    await mom(a, { ...sa, useBy: addDays(today, 25), portion: 'some', name: 'A very long remote rename that is certain to need two lines on every card width here', editedBy: 'mom', editedByName: 'Elizabeth', editedAt: Date.now() });
    await mom(b, { ...sb, portion: 'some', editedBy: 'mom', editedByName: 'Elizabeth', editedAt: Date.now() });
    await P.evaluate(() => hub.pull()); await sleep(1200);
    const after = await boxes();
    const moved = Object.keys(before).filter(k => before[k] !== after[k]);
    ok(!moved.length && Object.keys(before).length === Object.keys(after).length, 'R2 (' + label + '): after a remote two-line rename and a remote Some left, no card moved or changed size (' + Object.keys(before).length + ' cards compared)', { moved: moved.map(k => k + ' ' + before[k] + ' -> ' + after[k]) });
    const pill = await P.evaluate(() => { const p = document.getElementById('newpill'); return { hidden: p.hidden, text: p.textContent }; });
    ok(!pill.hidden && /[12] new or changed/.test(pill.text), 'R2 (' + label + '): the change that would resize a card waits behind the Show pill ("' + pill.text + '"; a Some left that keeps the height of its card may land in place)', pill);
    await P.click('#newpill'); await sleep(600);
    const shown = await P.evaluate(([a, b]) => ({ a: document.querySelector('.item[data-id="' + a + '"] .nm').textContent, b: !!document.querySelector('.item[data-id="' + b + '"] .portion') }), [a, b]);
    ok(/A very long remote rename/.test(shown.a) && shown.b, 'R2 (' + label + '): Show lays the list out with the new name and the Some left', shown);
    await mom(a, { ...sa, editedBy: 'mom', editedByName: 'Elizabeth', editedAt: Date.now() }); await mom(b, { ...sb, editedBy: 'mom', editedByName: 'Elizabeth', editedAt: Date.now() });
    await P.evaluate(() => hub.pull()); await sleep(800); await P.evaluate(() => __larder.render()); await sleep(300);
  }
  await P.setViewportSize({ width: 430, height: 932 }); await sleep(300);
  // a finishing or finished state still replaces in place (same height), so a card finished elsewhere is marked Finished where it stands
  { await P.evaluate(() => { __larder.render(); window.scrollTo(0, 0); }); await sleep(300);
    const id = await P.evaluate(() => [...document.querySelectorAll('.item:not(.finishing):not(.gone)')].map(c => c.dataset.id).filter(i => /^f\d/.test(i))[3]);
    const before = await P.evaluate(() => [...document.querySelectorAll('.item')].map(c => Math.round(c.getBoundingClientRect().top + scrollY)));
    await momDel(id.replace(/^/, '')); await P.evaluate(() => hub.pull()); await sleep(1000);
    const after = await P.evaluate(() => ({ tops: [...document.querySelectorAll('.item')].map(c => Math.round(c.getBoundingClientRect().top + scrollY)), gone: !!document.querySelector('.item.gone') }));
    ok(after.gone && JSON.stringify(after.tops) === JSON.stringify(before), 'an item finished on another device is marked Finished where it stands and nothing moves (the 0h rule still holds)', { id }); }

  // a kid and the TV
  console.log('\n## C5. a kid and the TV');
  for (const [profile, label] of [['ezra', 'a kid'], ['tv', 'the TV']]) {
    const k = await L.device({ device: 'iphone-pwa', profile, fixedTime: false }); await openLarder(k, L);
    const kk = await k.page.evaluate(() => ({ done: document.querySelectorAll('.item .done').length, act: document.querySelectorAll('.swipe-act').length, info: document.querySelectorAll('.item .nm[role="button"]').length, touch: getComputedStyle(document.querySelector('.item')).touchAction }));
    ok(kk.done === 0 && kk.act === 0 && kk.info === 0, label + ': no check button, no swipe layer, no tappable card', kk);
    const g = await k.page.$eval('.item', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    await k.page.mouse.move(g.x + g.w - 70, g.y + g.h / 2); await k.page.mouse.down(); for (let i = 1; i <= 8; i++) await k.page.mouse.move(g.x + g.w - 70 - 40 * i, g.y + g.h / 2); await k.page.mouse.up(); await sleep(400);
    ok(await k.page.evaluate(() => !document.querySelector('.item.swipe-open') && !document.querySelector('.item.finishing') && document.getElementById('editwrap').hidden), label + ': dragging a card does nothing, and tapping it opens no sheet');
    await k.page.click('.item .info').catch(() => {}); await sleep(300);
    ok(await k.page.evaluate(() => document.getElementById('editwrap').hidden), label + ': no edit sheet');
    await k.close();
  }
} finally { await L.close(); }
finish('larder-a-8');
