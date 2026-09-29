// Batch 0i check: what the Phase 2/3 scripts cannot see about chat writes after this batch.
//   A  a write that loses last-write-wins: finish_leftover on an item whose row carries a stamp 25 s ahead -> "Not saved"
//      (a red chip, no ✓), the item still in the fridge, no feed line
//   B  a lost second write rolls back the first: "set my tally to 7" when count:chat is stamped ahead -> the new epoch
//      (reset) is put back, and the chip says "Not saved"
//   C  Undo: finish_leftover, then POST /api/chat/undo with the chip's token -> the item is back, the finished row gone,
//      the feed says "Undid"; the same token a second time, and Ezra's use of Eli's token, are refused
//   D  Undo of a family prayer tick removes only Eli's tick; if Mom ticked the same request since, nothing is undone
//   G  all or nothing: Mom ticked the request after Eli's chat tick -> Eli's Undo changes nothing, prayerDays keeps today
//   H  a private prayer's Undo puts a feed line that does not name it
//   E  on screen: the chip shows Undo; tapping it puts the item back and the chip says so (screenshots)
//   F  the Larder: an item with an unreadable date shows "Check date" among the oldest, a future date reads as today; the
//      house refuses both (bad_date)
// Run from the repo root: node audits/tools/phase6/0i/chat-check.mjs -> audits/evidence/p6/0i/chat-check.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
import { chat, toolCall, feed } from '../../phase2/CHAT/lib.mjs';
const OUT = 'audits/evidence/p6/0i';
fs.mkdirSync(OUT, { recursive: true });
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v).slice(0, 500)); };
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const get = async (pid, app, scope, key) => { const r = await L.apiAs(pid, `/api/data/${app}?scope=${scope}&key=${encodeURIComponent(key)}`); return r.body && r.body.item; };
const scripted = async (pid, name, input, message = 'please ' + name) => { await L.anthropic([{ tools: [{ name, input }] }, { text: 'Done.' }]); return chat(L, pid, message); };
const undo = (pid, token) => L.apiAs(pid, '/api/chat/undo', { method: 'POST', body: { token } });
const pass = {};
try {
  const items = ((await L.apiAs('eli', '/api/data/leftovers?scope=family')).body.items || []).filter(r => r.key.startsWith('item:') && r.value);
  // ── A ──
  const a = items[0];
  const ahead = await L.apiAs('eli', `/api/data/leftovers/${a.key}?scope=family`, { method: 'PUT', body: { value: a.value, updated_at: Date.now() + 25000 } });
  const rA = await toolCall(L, 'eli', 'finish_leftover', { item_id: a.value.id });
  const stillA = await get('eli', 'leftovers', 'family', a.key);
  const fA = ((await feed(L, 'eli', 10)).activity || []).map(x => x.text);
  log('A', { putStatus: ahead.status, ok: rA.ok, chip: rA.chip, result: rA.toolResult, stillThere: !!(stillA && stillA.value), feedHasFinish: fA.some(t => t.includes('Finished ' + a.value.name)) });
  pass.A = rA.ok === false && /Not saved/.test(rA.chip || '') && /Not saved/.test(rA.toolResult && rA.toolResult.content || '') && !!(stillA && stillA.value) && !fA.some(t => t.includes('Finished ' + a.value.name));

  // ── B ── two rows, the second beaten: the tally's new epoch (reset) is put back when count:chat loses
  const resetBefore = await get('eli', 'tally', 'person', 'reset');
  await L.apiAs('eli', '/api/data/tally/count:chat?scope=person', { method: 'PUT', body: { value: { n: 1, epoch: 'old' }, updated_at: Date.now() + 25000 } });
  const rB = await toolCall(L, 'eli', 'set_data', { app_id: 'tally', scope: 'person', key: 'count', value: 7 });
  const resetAfter = await get('eli', 'tally', 'person', 'reset');
  log('B', { ok: rB.ok, chip: rB.chip, result: rB.toolResult, resetBefore: resetBefore && resetBefore.value, resetAfter: resetAfter && resetAfter.value });
  pass.B = rB.ok === false && /Not saved/.test(rB.chip || '') && JSON.stringify(resetBefore && resetBefore.value || null) === JSON.stringify(resetAfter && resetAfter.value || null);

  // ── C ──
  const c = items[1];
  const rC = await scripted('eli', 'finish_leftover', { item_id: c.value.id });
  const tokC = rC.tools[0] && rC.tools[0].undo;
  const goneC = await get('eli', 'leftovers', 'family', c.key);
  const u1 = await undo('eli', tokC);
  const backC = await get('eli', 'leftovers', 'family', c.key);
  const finC = await get('eli', 'leftovers', 'family', 'finished:' + c.value.id);
  const u2 = await undo('eli', tokC);
  const rC2 = await scripted('eli', 'finish_leftover', { item_id: c.value.id });
  const u3 = await undo('ezra', rC2.tools[0] && rC2.tools[0].undo);
  const fC = ((await feed(L, 'eli', 10)).activity || []).map(x => x.text);
  log('C', { chip: rC.tools[0] && rC.tools[0].chip, token: !!tokC, removedFirst: !(goneC && goneC.value), undo: u1.body, backAfterUndo: !!(backC && backC.value), finishedRowAfterUndo: !!(finC && finC.value), again: u2.status + ' ' + (u2.body && u2.body.error), otherPerson: u3.status + ' ' + (u3.body && u3.body.error), feedUndid: fC.find(t => /^Undid/.test(t)) || null });
  pass.C = !!tokC && !(goneC && goneC.value) && u1.body && u1.body.ok && !!(backC && backC.value) && !(finC && finC.value) && u2.status === 410 && u3.status === 410 && fC.some(t => /^Undid: Finished/.test(t));

  // ── D ──
  const pid = 'chkd' + Date.now().toString(36);
  const prow = { id: pid, title: 'Check D: the drive', for: '', phone: '', detail: '', category: 'Family', cadence: 'daily', days: [], status: 'active', createdAt: today(), lastPrayedAt: null, answeredAt: null, answerNote: null, updates: [], sharedFrom: null, prayedBy: {}, by: 'mom', updatedAt: new Date().toISOString() };
  await L.apiAs('mom', `/api/data/prayer/prayer:${pid}?scope=family`, { method: 'PUT', body: { value: prow, updated_at: Date.now() } });
  const rD = await scripted('eli', 'mark_prayed', { list: 'family', prayer_id: pid });
  const afterTick = (await get('eli', 'prayer', 'family', 'prayer:' + pid)).value.prayedBy[today()] || [];
  const uD = await undo('eli', rD.tools[0] && rD.tools[0].undo);
  const afterUndo = (await get('eli', 'prayer', 'family', 'prayer:' + pid)).value.prayedBy[today()] || [];
  // D2: Mom ticks the same request after Eli's chat tick; Eli's Undo then leaves the row alone
  const rD2 = await scripted('eli', 'mark_prayed', { list: 'family', prayer_id: pid });
  const cur = (await get('mom', 'prayer', 'family', 'prayer:' + pid)).value;
  const momTick = { ...cur, prayedBy: { ...cur.prayedBy, [today()]: [...(cur.prayedBy[today()] || []), 'mom'] }, updatedAt: new Date().toISOString() };
  await L.apiAs('mom', `/api/data/prayer/prayer:${pid}?scope=family`, { method: 'PUT', body: { value: momTick, updated_at: Date.now() } });
  const uD2 = await undo('eli', rD2.tools[0] && rD2.tools[0].undo);
  const afterD2 = (await get('eli', 'prayer', 'family', 'prayer:' + pid)).value.prayedBy[today()] || [];
  log('D', { afterTick, undo: uD.body, afterUndo, changedSince: uD2.body, afterD2 });
  pass.D = afterTick.includes('eli') && uD.body && uD.body.ok && !afterUndo.includes('eli') && uD2.body && uD2.body.ok === false && afterD2.includes('eli') && afterD2.includes('mom');

  // ── G ── all or nothing: Eli's chat tick adds today to prayerDays; Mom then ticks the same request; Eli's Undo changes nothing
  const gid = 'chkg' + Date.now().toString(36);
  await L.apiAs('mom', '/api/data/prayer/prayer:' + gid + '?scope=family', { method: 'PUT', body: { value: { ...prow, id: gid, title: 'Check G: the recital' }, updated_at: Date.now() } });
  const daysBefore = (await get('eli', 'prayer', 'family', 'prayerDays') || {}).value || [];
  if (daysBefore.includes(today())) await L.apiAs('eli', '/api/data/prayer/prayerDays?scope=family', { method: 'PUT', body: { value: daysBefore.filter(x => x !== today()), updated_at: Date.now() } });
  const rG = await scripted('eli', 'mark_prayed', { list: 'family', prayer_id: gid });
  const curG = (await get('mom', 'prayer', 'family', 'prayer:' + gid)).value;
  await L.apiAs('mom', '/api/data/prayer/prayer:' + gid + '?scope=family', { method: 'PUT', body: { value: { ...curG, prayedBy: { ...curG.prayedBy, [today()]: [...(curG.prayedBy[today()] || []), 'mom'] } }, updated_at: Date.now() } });
  const uG = await undo('eli', rG.tools[0] && rG.tools[0].undo);
  const daysG = (await get('eli', 'prayer', 'family', 'prayerDays')).value || [];
  log('G', { undo: uG.body, prayerDaysKeepsToday: daysG.includes(today()) });
  pass.G = uG.body && uG.body.ok === false && daysG.includes(today());

  // ── H ── a private prayer's Undo never names it on the feed
  const rH = await scripted('eli', 'add_prayer', { list: 'private', text: 'Check H secret worry' });
  const uH = await undo('eli', rH.tools[0] && rH.tools[0].undo);
  const fH = ((await feed(L, 'eli', 10)).activity || []).map(x => x.text);
  log('H', { undo: uH.body, feed: fH.slice(0, 3) });
  pass.H = uH.body && uH.body.ok && !fH.some(t => /Check H secret/.test(t)) && fH.some(t => /^Undid: Added a private prayer request/.test(t));

  // ── E ── on screen
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await d.goto('#chat'); await sleep(1500);
  await L.anthropic([{ tools: [{ name: 'add_list_item', input: { app_id: 'leftovers', item: { name: 'Check E soup', size: 'Small' } } }] }, { text: 'Added it.' }]);
  await d.page.fill('#chat-in', 'add check e soup to the fridge'); await d.page.click('#chat-send');
  await d.page.waitForSelector('.chip .chip-undo', { timeout: 15000 }); await sleep(500);
  await d.shot(OUT + '/chat-undo-chip-iphone.png');
  const beforeE = ((await L.apiAs('eli', '/api/data/leftovers?scope=family')).body.items || []).some(r => r.value && r.value.name === 'Check E soup');
  await d.page.click('.chip .chip-undo'); await sleep(1500);
  const chipText = await d.page.evaluate(() => [...document.querySelectorAll('.msg .chip')].pop().textContent);
  await d.shot(OUT + '/chat-undone-chip-iphone.png');
  const afterE = ((await L.apiAs('eli', '/api/data/leftovers?scope=family')).body.items || []).some(r => r.value && r.value.name === 'Check E soup');
  log('E', { beforeE, chipText, afterE });
  pass.E = beforeE && !afterE && /Undone/.test(chipText);
  await d.close();

  // ── F ── the Larder's dates
  const bad = await L.apiAs('eli', '/api/data/leftovers/item:chkf1?scope=family', { method: 'PUT', body: { value: { id: 'chkf1', name: 'Check F word date', size: 'Small', dateLogged: 'yesterday' }, updated_at: Date.now() } });
  const fut = await L.apiAs('eli', '/api/data/leftovers/item:chkf2?scope=family', { method: 'PUT', body: { value: { id: 'chkf2', name: 'Check F future', size: 'Small', dateLogged: '2099-01-01' }, updated_at: Date.now() } });
  const lar = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const f = await lar.openApp('leftovers', { wait: '#tally' });
  await f.waitForFunction(() => /in the fridge/.test(document.getElementById('tally').textContent), null, { timeout: 15000 }); await sleep(800);
  await lar.setOffline(true);                                            // an older row, as a device may still hold one
  await f.evaluate(() => { hub.set('item:chkf3', { id: 'chkf3', name: 'Check F old row', size: 'Small', dateLogged: 'last tuesday' }); hub.set('item:chkf4', { id: 'chkf4', name: 'Check F future row', size: 'Small', dateLogged: '2099-01-01' }); window.__larder.render(); });
  await sleep(400);
  const cards = await f.evaluate(() => [...document.querySelectorAll('.item')].map(c => ({ name: c.querySelector('.nm').textContent, chip: c.querySelector('.status').textContent, meta: c.querySelector('.meta').textContent, group: c.closest('.group').dataset.tone })));
  await f.evaluate(() => document.querySelector('.item').scrollIntoView({ block: 'start' }));
  await lar.shot(OUT + '/larder-check-date-iphone.png');
  const old = cards.find(x => x.name === 'Check F old row'), future = cards.find(x => x.name === 'Check F future row');
  log('F', { badStatus: bad.status + ' ' + (bad.body && bad.body.error), futureStatus: fut.status + ' ' + (fut.body && fut.body.error), old, future });
  pass.F = bad.status === 403 && fut.status === 403 && old && old.chip === 'Check date' && old.group === 'urgent' && /date unknown/.test(old.meta) && future && /0d ago/.test(future.meta) && future.group === 'fresh';
  await lar.close();
} catch (e) { log('error', String(e && e.stack || e)); }
finally { await L.close(); }
res.pass = pass;
console.log('PASS', JSON.stringify(pass));
fs.writeFileSync(OUT + '/chat-check.json', JSON.stringify(res, null, 1));
