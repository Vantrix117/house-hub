// Batch 5, Worker A: the Verses fixes the Phase 3 scripts do not reach, on the local rig (typical household, demo clock,
// WebKit — the iPhone's engine): the household verse text (GAP-VERSES-1) written on one device and read on another and by
// another person, refused for a kid; Undo by value and the card back revealed (UX-VERSES-2); the next interval on each
// rating and in the toast, Not yet → box 1 (GAP-VERSES-2, P3-VERSES-05); no box numbers on screen (UX-VERSES-9); a
// Coming up row practises that verse as practice, not due (IMP-VERSES-F6, P3-VERSES-08); the due count said once
// (UX-VERSES-8); the streak rule over the seeded rows (P3-VERSES-11); the kid paraphrase and picture buttons
// (UX-VERSES-1); the empty card's copy and Open F260 (GAP-VERSES-3, P3-VERSES-14). Every verse text here is a
// placeholder, never Scripture.
//   node "audits/tools/phase6/5/verses-a-5.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const ROOT = process.cwd();
const EV = path.join(ROOT, 'audits', 'evidence', 'p6', '5'); fs.mkdirSync(EV, { recursive: true });
let pass = 0, fail = 0; const out = {};
const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x).slice(0, 700)); } out[n] = { pass: !!c, ...(x === undefined ? {} : { got: x }) }; };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const shot = (d, n) => d.page.screenshot({ path: path.join(EV, 'verses-a-' + n + '.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
const flushed = async f => { const k = await f.evaluate(async () => { for (let i = 0; i < 80; i++) { try { await hub.flush(); } catch (e) {} if (!hub.sync.pending) return true; await new Promise(r => setTimeout(r, 250)); } return false; }); if (!k) throw new Error('the page did not send its writes in 20 s'); };
const until = async (read, pred, label, ms = 15000) => { const t0 = Date.now(); let v; for (;;) { v = await read(); if (pred(v)) return v; if (Date.now() - t0 > ms) { console.log('  … timed out waiting for', label); return v; } await sleep(300); } };
const txt = (f, s) => f.$eval(s, e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => null);
const vis = (f, s) => f.$eval(s, e => !e.hidden && !e.closest('[hidden]') && e.getClientRects().length > 0).catch(() => false);
const toast = f => f.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent.replace(/\s+/g, ' ').trim() : null; });
const row = async (who, app, key, scope = 'person') => ((await L.apiAs(who, `/api/data/${app}?scope=${scope}`)).body.items || []).find(r => r.key === key);
// speech: the rig's WebKit has no voice — a stub records what the app asks it to say
const stubSpeech = ctx => ctx.addInitScript(() => { window.__said = []; class U { constructor(t) { this.text = t; } } window.SpeechSynthesisUtterance = U; const ss = { speak(u) { window.__said.push(u.text); setTimeout(() => u.onend && u.onend(), 30); }, cancel() {}, getVoices() { return []; }, addEventListener() {} }; Object.defineProperty(window, 'speechSynthesis', { value: ss, configurable: true }); });
const open = async (device, profile) => { const d = await L.device({ device, profile }); await stubSpeech(d.ctx); const f = await d.openApp('verses'); await f.waitForSelector('#trainer:not([hidden]) #show:not([hidden]), #done:not([hidden]), #empty:not([hidden])', { timeout: 15000 }); await sleep(400); return { d, f }; };
const PLACE = 'Placeholder words typed into Verses by the audit rig - test text, not Scripture.';
try {
  await L.reset('typical');
  // ── Eli on the iPhone ─────────────────────────────────────────────────────────────────────────────────────────────
  console.log('\n## Eli, iPhone: the card, intervals, the toast, Undo (GAP-VERSES-2, P3-VERSES-05, UX-VERSES-2, -8, -9)');
  let { d, f } = await open('iphone-pwa', 'eli');
  const first = { ref: await txt(f, '#ref'), who: await txt(f, '#who'), chip: await txt(f, '#boxchip'), queueSub: await txt(f, '#queue-sub'), dueStat: await vis(f, '#st-due'), today: await txt(f, '#st-today') };
  ok(/\d+ to go/.test(first.who || '') && !first.dueStat && /^\d+ due\b/.test(first.queueSub || ''), 'the due count: the pill, and the list header (final rescore E: the pill scrolls away when the list is in view); no "due today" stat (UX-VERSES-8)', first);
  ok(!/\bBox\b|\bbox \d/.test(await f.evaluate(() => document.body.innerText)), 'no box numbers anywhere on the screen (UX-VERSES-9)', first.chip);
  const id0 = await f.evaluate(() => window.verses.currentId());
  const row0 = await f.evaluate(id => hub.get('recall:' + id, { app: 'f260', scope: 'person' }) || null, id0);
  const box0 = await f.evaluate(id => { const r = hub.rowMap('recall:', 'f260.recall', { app: 'f260', scope: 'person' })[id]; return r && r.box ? Math.min(5, Math.max(1, r.box)) : 1; }, id0);
  await f.click('#show'); await sleep(150);
  const nx = await f.$$eval('#act-rate [data-rate]', bs => Object.fromEntries(bs.map(b => [b.dataset.rate, (b.querySelector('.nx') || {}).textContent || ''])));
  const W = d => d === 1 ? 'tomorrow' : 'in ' + d + ' days', I = [1, 2, 4, 7, 14];
  ok(nx.not === 'tomorrow' && nx.almost === W(I[box0 - 1]) && nx.got === W(I[Math.min(5, box0 + 1) - 1]), 'each rating shows its next review (box ' + box0 + ' today)', nx);
  ok(await vis(f, '#say') && !(await vis(f, '#show')), 'Read aloud stays after Show (P3-VERSES-06)');
  await shot(d, 'revealed-iphone');
  await f.click('#act-rate [data-rate="not"]'); await sleep(200);
  // rescore 5: the result is a status line at the top of the card (no shared toast over the pill)
  const t1 = await f.evaluate(() => { const l = document.getElementById('rated'), u = document.getElementById('rated-undo'), p = document.getElementById('who').getBoundingClientRect(), t = document.getElementById('hub-toast'), lr = l.getBoundingClientRect();
    const over = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const others = [...document.querySelectorAll('#ref, #kick, #boxchip, .boxes .lbl, button')].filter(e => e !== u && !l.contains(e) && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').filter(e => over(lr, e.getBoundingClientRect())).map(e => e.id || e.className);
    return { text: document.getElementById('rated-text').textContent, host: l.parentElement.id, undo: !u.hidden && u.getClientRects().length > 0, undoH: Math.round(u.getBoundingClientRect().height), toast: !!(t && !t.hidden), pillCovered: over(lr, p), covers: others }; });
  ok(/^Not yet — .+\. Next review tomorrow\.$/.test(t1.text) && t1.host === 'trainer' && t1.undo && t1.undoH >= 44 && !t1.toast && !t1.pillCovered && !t1.covers.length, 'the Not yet line states the real next review with Undo, at the top of the card; no toast, and it covers no pill, reference, label or button (rescore 5, UX-VERSES-6)', t1);
  await shot(d, 'rated-line-iphone');
  await flushed(f);
  const srv1 = await until(() => row('eli', 'f260', 'recall:' + id0), r => r && r.value && r.value.box === 1, 'the rating on the server');
  ok(srv1 && srv1.value.box === 1 && srv1.value.streak === 0 && srv1.value.due > srv1.value.last, 'Not yet sends the verse back to box 1, due the next day', srv1 && srv1.value);
  await f.click('#rated-undo'); await sleep(400);
  ok(await f.evaluate(() => window.verses.currentId()) === id0 && await vis(f, '#act-rate') && !(await vis(f, '#show')), 'Undo: the card is back on the same verse, revealed');
  await flushed(f);
  const srv2 = await until(() => row('eli', 'f260', 'recall:' + id0), r => JSON.stringify(r ? r.value : null) === JSON.stringify(row0), 'the undo on the server');
  ok(JSON.stringify(srv2 ? srv2.value : null) === JSON.stringify(row0) || (row0 === null && (!srv2 || srv2.value == null)), 'Undo: the server row is the one from before, by value', { before: row0, after: srv2 && srv2.value });
  // ── F6 + P3-VERSES-08 ────────────────────────────────────────────────────────────────────────────────────────────
  console.log('\n## a Coming up row practises that verse, as practice (IMP-VERSES-F6, P3-VERSES-08)');
  const dueBefore = await f.evaluate(() => window.verses.dueIds().length);
  const laterId = await f.$eval('#later-list .qrow[data-id]', b => b.dataset.id).catch(() => null);
  const rowInfo = await f.$eval('#later-list .qrow[data-id]', b => ({ tag: b.tagName, label: b.getAttribute('aria-label'), h: Math.round(b.getBoundingClientRect().height), tab: b.tabIndex })).catch(() => null);
  ok(rowInfo && rowInfo.tag === 'BUTTON' && /^Practise /.test(rowInfo.label) && rowInfo.h >= 44 && rowInfo.tab === 0, 'a Coming up row is a 44 px button named "Practise <ref>", reachable by keyboard', rowInfo);
  if (laterId) {
    await f.click(`#later-list .qrow[data-id="${laterId}"]`); await sleep(300);
    const p = { cur: await f.evaluate(() => window.verses.currentId()), kick: await txt(f, '#kick'), who: await txt(f, '#who'), due: await f.evaluate(() => window.verses.dueIds().length) };
    ok(p.cur === laterId && /extra practice/.test(p.kick) && p.due === dueBefore && new RegExp('\\b' + dueBefore + ' to go').test(p.who), 'the tapped verse is on the card as extra practice; the pill and the due list keep the real due set', p);
    await shot(d, 'practice-iphone');
  }
  // ── the household text ───────────────────────────────────────────────────────────────────────────────────────────
  console.log('\n## the household verse text (GAP-VERSES-1)');
  // put a card without text on screen: the first trained verse with no text at all
  const bare = await f.evaluate(() => window.verses.trained().find(id => !window.verses.textOf(id)));
  ok(!!bare, 'Eli has a memorised verse with no text yet', bare);
  await f.evaluate(id => window.verses.practise(id), bare); await sleep(250);
  ok(await vis(f, '#addtext'), '"Add the verse text" on a card that has none');
  await f.click('#addtext'); await sleep(150);
  const note = await txt(f, '#text-note');
  await f.fill('#text-input', PLACE); await f.press('#text-input', 'Enter'); await sleep(250);
  const veil = await f.$eval('#text', e => ({ hidden: e.hidden, veiled: e.classList.contains('veiled'), aria: e.getAttribute('aria-hidden'), inert: e.hasAttribute('inert'), text: e.textContent }));
  ok(/Everyone in the house/.test(note || '') && !veil.hidden && veil.veiled && veil.aria === 'true' && veil.inert && veil.text === PLACE, 'saved; the card shows it veiled and hidden from screen readers; the editor said once that the house shares it', { note, veil });
  await shot(d, 'text-veiled-iphone');
  await flushed(f);
  const fam = await until(() => row('eli', 'verses', 'text:' + bare, 'family'), r => r && r.value && r.value.text === PLACE, 'the family row');
  ok(fam && fam.value.by === 'eli' && typeof fam.value.at === 'number', 'the family row text:' + bare + ' = { text, by: eli, at }', fam && fam.value);
  await d.close();
  // another device as Eli, and another person, see it
  ({ d, f } = await open('ipad-portrait', 'eli'));
  const onIpad = await until(() => f.evaluate(id => window.verses.textOf(id), bare), v => v === PLACE, 'the text on the iPad', 20000);
  ok(onIpad === PLACE, 'Eli\'s iPad has the household text after its pull', onIpad);
  await d.close();
  ({ d, f } = await open('iphone-pwa', 'christian'));
  ok(await until(() => f.evaluate(id => window.verses.textOf(id), bare), v => v === PLACE, 'the text for Mae', 20000) === PLACE, 'Mae\'s Verses reads the same household text');
  await d.close();
  const kidPut = await L.apiAs('ezra', '/api/data/verses/' + encodeURIComponent('text:' + bare) + '?scope=family', { method: 'PUT', body: { value: { text: 'x', by: 'ezra', at: 1 }, updated_at: Date.now() } });
  ok(kidPut.status === 403, 'a kid cannot write the household text (403)', kidPut.status + ' ' + JSON.stringify(kidPut.body).slice(0, 120));
  // ── the streak rule over the seeded rows ───────────────────────────────────────────────────────────────────────────
  console.log('\n## the day streak (P3-VERSES-11)');
  ({ d, f } = await open('iphone-pwa', 'eli'));
  const st = await f.evaluate(() => {
    const lg = {}; for (const r of hub.list('rev:')) { const k = r.key.slice(4, 14); lg[k] = (lg[k] || 0) + r.value; } const old = hub.get('log') || {}; for (const [k, v] of Object.entries(old)) lg[k] = (lg[k] || 0) + v;
    const today = hub.today(); let dd = lg[today] ? today : hub.addDays(today, -1), n = 0; while (lg[dd]) { n++; dd = hub.addDays(dd, -1); }   // the old rule: consecutive days
    const y = hub.addDays(today, -1), t3 = hub.addDays(today, -3);
    return { shown: document.getElementById('st-streak').textContent, rule: window.verses.dayStreak(), oldRule: n, pending: window.verses.streakOf({ [y]: 1 }), gap: window.verses.streakOf({ [y]: 1, [t3]: 1 }), summary: (hub.get('summary') || {}).streak };
  });
  ok(String(st.rule) === st.shown && st.rule >= st.oldRule && st.pending === 1, 'the streak on screen is the new rule (never below the old consecutive-days count); today is pending', st);
  out.streak = st;
  await d.close();
  // ── the kid card ────────────────────────────────────────────────────────────────────────────────────────────────
  console.log('\n## Ezra, iPhone: the paraphrase and the picture buttons (UX-VERSES-1)');
  ({ d, f } = await open('iphone-pwa', 'ezra'));
  const kid = { para: await vis(f, '#para') ? await txt(f, '#para') : null, cur: await f.evaluate(() => window.verses.currentId()) };
  kid.expected = await f.evaluate(id => window.verses.paraphraseOf(id), kid.cur);
  await f.click('#say'); await sleep(200);
  kid.said = await f.evaluate(() => window.__said.slice(-1)[0] || null);
  await f.click('#show'); await sleep(150);
  kid.pics = await f.$$eval('#act-rate [data-rate] .pic', ps => ps.map(p => ({ href: p.querySelector('use').getAttribute('href').split('#')[1], shown: getComputedStyle(p).display !== 'none', w: Math.round(p.getBoundingClientRect().width) })));
  kid.sizes = await f.$$eval('#act-rate [data-rate]', bs => bs.map(b => Math.round(Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height))));
  // UX-VERSES-1 follow-up: a kid practises only the verse Kid Verse teaches that week, so the card always has its words
  kid.trained = await f.evaluate(() => window.verses.trained());
  ok(kid.trained.length === 1 && kid.trained[0] === kid.cur && !!kid.expected && kid.para && kid.para.includes(kid.expected) && /paraphrase/i.test(kid.para) && kid.said && kid.said.endsWith(kid.expected), 'a kid practises one verse, the one Kid Verse teaches: its card shows the paraphrase, labelled, and Read aloud reads it', kid);
  ok(kid.pics.map(p => p.href).join() === 'i-rotate-ccw,i-circle-dashed,i-check' && kid.pics.every(p => p.shown && p.w >= 24) && kid.sizes.every(s => s >= 64), 'picture buttons: try-again, dashed circle, check (B, rescore 5 and final C), each ≥ 64 px', kid);
  await shot(d, 'kid-iphone');
  await d.close();
  // ── the result line keeps the reference whole (rescore 5 leftover) ────────────────────────────────────────────────
  console.log('\n## the result line\'s reference stays whole at 375 / 390, normal and XXL text');
  const whole = [];
  for (const [w, h] of [[375, 667], [390, 844]]) for (const xxl of [false, true]) {
    await L.reset('typical');
    const dd = await L.device({ device: 'iphone-pwa', profile: 'eli', ...(xxl ? { localStorage: { 'hub.prefs': { textSize: 'xxl' } } } : {}) });
    await dd.page.setViewportSize({ width: w, height: h });
    const ff = await dd.openApp('verses'); await ff.waitForSelector('#trainer:not([hidden]) #show:not([hidden])', { timeout: 15000 }); await sleep(400);
    if (xxl) { await ff.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl')); await sleep(150); }   // the person's row could reset the device mirror
    await ff.click('#show'); await sleep(150); await ff.click('#act-rate [data-rate="not"]'); await sleep(250);
    const m = await ff.evaluate(() => { const cv = document.querySelector('#rated-text .cv'), t = document.getElementById('rated-text'); return { size: document.documentElement.getAttribute('data-text-size'), cv: cv && cv.textContent, lines: cv ? cv.getClientRects().length : 0, text: t.textContent, sw: document.documentElement.scrollWidth, vw: innerWidth }; });
    whole.push({ w, xxl, ...m });
    if (w === 375 && xxl) await shot(dd, 'rated-line-375-xxl');
    await dd.close();
  }
  ok(whole.every(x => x.cv && /^\d+:\d+(-\d+)?[a-z]?$/.test(x.cv) && x.lines === 1 && x.sw <= x.vw + 1), 'the chapter:verse part of the reference is one unbroken piece in the line, no horizontal scroll', whole);
  // ── nothing due ──────────────────────────────────────────────────────────────────────────────────────────────────
  console.log('\n## nothing due, no reviews yet (UX-VERSES-4, P3-VERSES-11)');
  ({ d, f } = await open('ipad-portrait', 'mom'));
  const nd = { big: await txt(f, '#done-big'), who: await txt(f, '#who'), star: await f.$eval('#done .icon.star', e => getComputedStyle(e).display), sub: await txt(f, '#done-sub'), statsSub: await txt(f, '#stats-sub'), dueList: await vis(f, '#queue-list') };
  ok(nd.big === 'Nothing due today' && nd.star === 'none' && /nothing due$/.test(nd.who || '') && !/all done/.test(nd.who || '') && /keeps your streak/.test(nd.sub || '') && !nd.dueList, 'Elizabeth: "Nothing due today" with no star, the pill says "nothing due", the streak is kept and said once; no empty Due today list', nd);
  await shot(d, 'nothing-due-ipad');
  await d.close();
  // ── the empty card ───────────────────────────────────────────────────────────────────────────────────────────────
  console.log('\n## nothing to train (GAP-VERSES-3, P3-VERSES-14)');
  const nm = ((await L.apiAs('niece', '/api/data/f260?scope=person')).body.items || []).filter(r => (r.key === 'f260.mem' || r.key.startsWith('mem:')) && r.value != null);
  for (const r of nm) await L.apiAs('niece', '/api/data/f260/' + encodeURIComponent(r.key) + '?scope=person', { method: 'PUT', body: { value: r.key === 'f260.mem' ? {} : false, updated_at: Date.now() + 1000 } });
  ({ d, f } = await open('iphone-pwa', 'niece'));
  const empty = { shown: await vis(f, '#empty'), copy: await txt(f, '#empty p'), who: await txt(f, '#who'), button: await vis(f, '#open-f260') };
  ok(empty.shown && /you can review it here straight away/.test(empty.copy || '') && !/all done|nothing due/.test(empty.who || '') && empty.button, 'the empty card: "…straight away", an Open F260 button, and a pill that celebrates nothing', empty);
  await shot(d, 'empty-iphone');
  await f.click('#open-f260');
  const f260 = await until(async () => !!d.frame('f260'), v => v, 'F260 in the viewer', 10000);
  ok(f260, 'Open F260 opens F260 in the hub');
  await d.close();
} catch (e) { fail++; console.log('  ✗ crashed:', e.stack || e); out.crash = String(e.stack || e); }
finally { await L.close(); }
fs.writeFileSync(path.join(EV, 'verses-a-5.json'), JSON.stringify(out, null, 1));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
