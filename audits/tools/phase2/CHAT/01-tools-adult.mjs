// CHAT 01 — every writing tool run by a scripted upstream as adults (and a guest), on the local rig.
// Reports: what each tool changed on the server, whether anything is confirmed first, whether an undo path exists,
// what set_data lets the model overwrite, and whether get_data returns the journal vault when asked by key.
//   node "audits/tools/phase2/CHAT/01-tools-adult.mjs"
import { local } from '../../lib/local.mjs';
import { toolCall, data, put, save, short, registryApps } from './lib.mjs';

// clock 'real': the demo clock advances 1 ms per real second, so two writes in one run share a timestamp and the second loses LWW
const L = await local({ variant: 'typical', clock: 'real' });
const out = { runAt: new Date().toISOString(), steps: [] };
const step = (name, o) => { out.steps.push({ name, ...o }); console.log(`\n## ${name}\n` + Object.entries(o).map(([k, v]) => `  ${k}: ${short(v, 260)}`).join('\n')); };
try {
  const toolNames = (await (async () => { await L.anthropicLog({ clear: true }); await L.anthropic([{ text: 'hi' }]); await (await import('./lib.mjs')).chat(L, 'eli', 'hi'); return (await L.anthropicLog())[0].body.tools.map(t => t.name); })());
  step('tools offered to the model', { tools: toolNames, undoLikeTools: toolNames.filter(n => /undo|remove|delete|reopen|unmark|restore/.test(n)) });

  // 1. add_list_item leftovers + reminders
  let r = await toolCall(L, 'eli', 'add_list_item', { app_id: 'leftovers', item: { name: 'Audit soup', size: 'Small' } });
  const lo = (await data(L, 'eli', 'leftovers', 'family')).filter(x => x.value && x.value.name === 'Audit soup');
  step('add_list_item leftovers', { chip: r.chip, ok: r.ok, upstreamCalls: r.upstreamCalls, serverRow: lo.map(x => x.value) });
  r = await toolCall(L, 'eli', 'add_list_item', { app_id: 'reminders', item: { text: 'Audit reminder: bins out' } });
  step('add_list_item reminders', { chip: r.chip, ok: r.ok, serverRows: (await data(L, 'eli', 'reminders', 'family')).filter(x => x.value && /Audit reminder/.test(x.value.text)).map(x => x.value) });

  // 2. add_prayer private + family
  r = await toolCall(L, 'eli', 'add_prayer', { list: 'private', text: 'Audit private request', for: 'Sam' });
  step('add_prayer private', { chip: r.chip, ok: r.ok, toolResultSentUpstream: r.toolResult });
  r = await toolCall(L, 'eli', 'add_prayer', { list: 'family', text: 'Audit family request' });
  step('add_prayer family', { chip: r.chip, ok: r.ok });

  // 3. mark_prayed on an existing family request by title
  const fam = (await data(L, 'eli', 'prayer', 'family')).filter(x => x.key.startsWith('prayer:') && x.value && x.value.status === 'active');
  const target = fam[0].value;
  r = await toolCall(L, 'eli', 'mark_prayed', { list: 'family', prayer_id: target.title });
  const after = await data(L, 'eli', 'prayer', 'family', 'prayer:' + target.id);
  step('mark_prayed family (by title)', { title: target.title, chip: r.chip, prayedByAfter: after.prayedBy, lastPrayedAt: after.lastPrayedAt });

  // 4. answer_prayer on the private request just added
  r = await toolCall(L, 'eli', 'answer_prayer', { list: 'private', prayer_id: 'Audit private request', note: 'Sam is fine' });
  const priv = (await data(L, 'eli', 'prayer', 'person')).find(x => x.value && x.value.title === 'Audit private request');
  step('answer_prayer private', { chip: r.chip, statusAfter: priv.value.status, answeredAt: priv.value.answeredAt });

  // 5. finish_leftover: loose name matching, tombstone, no restore
  const items = (await data(L, 'eli', 'leftovers', 'family')).filter(x => x.value);
  step('fridge before finish', { items: items.map(x => `${x.value.name} (${x.value.dateLogged})`) });
  r = await toolCall(L, 'eli', 'finish_leftover', { name: 'rice' });
  step('finish_leftover name "rice" (loose match)', { chip: r.chip, ok: r.ok, toolResult: r.toolResult });
  const victim = items.find(x => /chili/i.test(x.value.name)) || items[0];
  r = await toolCall(L, 'eli', 'finish_leftover', { name: victim.value.name.split(' ').slice(-1)[0] });
  const row = (await data(L, 'eli', 'leftovers', 'family')).find(x => x.key === victim.key);
  step('finish_leftover by one word of the name', { word: victim.value.name.split(' ').slice(-1)[0], chip: r.chip, ok: r.ok, rowAfter: row, toolResult: r.toolResult });

  // 6. toggle_f260_reading: a "mark as read" on a reading that is already ticked UNticks it
  const done0 = await data(L, 'eli', 'f260', 'person', 'f260.done');
  const sum0 = await data(L, 'eli', 'f260', 'person', 'f260.summary');
  const week = sum0.week; const tickedIdx = [0, 1, 2, 3, 4].find(d => done0[`${week}-${d}`]);
  r = await toolCall(L, 'eli', 'toggle_f260_reading', { week, day: tickedIdx + 1 }, { message: `I read week ${week} day ${tickedIdx + 1}, tick it off` });
  const done1 = await data(L, 'eli', 'f260', 'person', 'f260.done');
  const sum1 = await data(L, 'eli', 'f260', 'person', 'f260.summary');
  step('toggle_f260_reading on an already-ticked day ("tick it off")', { key: `${week}-${tickedIdx}`, before: !!done0[`${week}-${tickedIdx}`], after: !!done1[`${week}-${tickedIdx}`], chip: r.chip, toolResult: r.toolResult, summaryWeekDone: `${sum0.weekDone} -> ${sum1.weekDone}`, summaryReadToday: `${sum0.readToday} -> ${sum1.readToday}` });

  // 7. set_data: overwrite any key of a visible app — wipe F260 progress with one call
  const nDone = Object.keys(done1).length;
  r = await toolCall(L, 'eli', 'set_data', { app_id: 'f260', scope: 'person', key: 'f260.done', value: {} });
  step('set_data f260.done = {} (whole reading history)', { readingsBefore: nDone, readingsAfter: Object.keys(await data(L, 'eli', 'f260', 'person', 'f260.done')).length, chip: r.chip });

  // 8. set_data on family rows other people own
  const albums = (await data(L, 'christian', 'hub', 'family')).filter(x => x.key.startsWith('album:') && x.value);
  const notMae = albums.find(x => x.value.by !== 'christian');
  const del = await L.apiAs('christian', `/api/album/${notMae.value.id}`, { method: 'DELETE' });
  r = await toolCall(L, 'christian', 'set_data', { app_id: 'hub', scope: 'family', key: notMae.key, value: null });
  step("Mae removes someone else's album photo", { photoBy: notMae.value.by, albumRouteDelete: `${del.status} ${del.body.error || ''}`, chatSetDataChip: r.chip, rowAfter: (await data(L, 'eli', 'hub', 'family', notMae.key)) === null ? 'null (tombstoned)' : 'still there' });

  const stars0 = await data(L, 'christian', 'kidverse', 'family', 'stars:ezra');
  r = await toolCall(L, 'christian', 'set_data', { app_id: 'kidverse', scope: 'family', key: 'stars:ezra', value: { ...(stars0 || {}), count: 7, total: 99 } });
  const stars1 = await data(L, 'eli', 'kidverse', 'family', 'stars:ezra');
  step("Mae overwrites Ezra's star mirror (CLAUDE.md: the kid's Kid Verse is the only writer)", { before: stars0 && { count: stars0.count, total: stars0.total }, after: { count: stars1.count, total: stars1.total }, chip: r.chip });

  r = await toolCall(L, 'guest-grandmajo', 'set_data', { app_id: 'kidverse', scope: 'family', key: 'stars:kiara', value: { count: 0, total: 0, week: 'x' } });
  step('guest (Grandma Jo) writes a kid star mirror via chat', { chip: r.chip, ok: r.ok, after: await data(L, 'eli', 'kidverse', 'family', 'stars:kiara') });

  const rally1 = await L.apiAs('christian', '/api/dollywood/rally', { method: 'POST', body: { name: 'Rally A', x: 800, y: 800 } });
  const rally2 = await L.apiAs('christian', '/api/dollywood/rally', { method: 'POST', body: { name: 'Rally B', x: 800, y: 800 } });
  const g1 = await toolCall(L, 'guest-grandmajo', 'set_data', { app_id: 'dollywood-live', scope: 'family', key: 'meet', value: { x: 1, y: 1, name: 'Guest meet 1', by: 'guest-grandmajo', at: Date.now() } });
  const g2 = await toolCall(L, 'guest-grandmajo', 'set_data', { app_id: 'dollywood-live', scope: 'family', key: 'meet', value: { x: 2, y: 2, name: 'Guest meet 2', by: 'guest-grandmajo', at: Date.now() } });
  const guestRally = await L.apiAs('guest-grandmajo', '/api/dollywood/rally', { method: 'POST', body: { name: 'G', x: 1, y: 1 } });
  step('meeting point: rally route rules vs chat set_data', { rallyRoute1: rally1.status, rallyRoute2WithinAMinute: `${rally2.status} ${rally2.body.error || ''}`, guestRallyRoute: `${guestRally.status} ${guestRally.body.error || ''}`, guestChatSetMeet1: g1.chip, guestChatSetMeet2: g2.chip, meetNow: (await data(L, 'eli', 'dollywood-live', 'family', 'meet')).name });

  // 9. keys and scopes the data API refuses
  r = await toolCall(L, 'eli', 'set_data', { app_id: 'tally', scope: 'person', key: 'bad key with spaces & symbols!', value: 1 });
  const apiBad = await put(L, 'eli', 'tally', 'person', 'bad key with spaces & symbols!', 1);
  step('set_data with a key /api/data rejects', { chatChip: r.chip, apiPut: `${apiBad.status} ${apiBad.body.error}` });
  r = await toolCall(L, 'eli', 'set_data', { app_id: 'tally', scope: 'house', key: 'x', value: 1 });
  step('set_data with scope outside the enum', { chip: r.chip, ok: r.ok, toolResult: r.toolResult });

  // 10. the journal vault: listing hides it, get_data by key returns it; set_data refuses it
  const fakeVault = { v: 2, iv: 'AUDIT-IV', ct: 'AUDIT-CIPHERTEXT-' + 'x'.repeat(40), pass: { salt: 'AUDIT-SALT', iter: 310000, wrapped: 'AUDIT-WRAPPED-DEK' } };
  await put(L, 'eli', 'f260', 'person', 'f260.journal.vault', fakeVault);
  const list = await toolCall(L, 'eli', 'get_data', { app_id: 'f260', scope: 'person' });
  const byKey = await toolCall(L, 'eli', 'get_data', { app_id: 'f260', scope: 'person', key: 'f260.journal.vault' });
  const setV = await toolCall(L, 'eli', 'set_data', { app_id: 'f260', scope: 'person', key: 'f260.journal.vault', value: null });
  step('journal vault', { listingIncludesVault: /journal\.vault/.test(list.toolResult.content), getByKeyReturned: short(byKey.toolResult.content, 200), getByKeyContainsCiphertext: /AUDIT-CIPHERTEXT/.test(byKey.toolResult.content), setDataRefused: setV.toolResult.content });

  // 10b. what the family feed (Home, TV board) says about these chat writes
  const feedRows = (await L.apiAs('eli', '/api/activity?limit=40')).body.activity.filter(a => /via chat/.test(a.text)).map(a => `${a.name}: ${a.text}`);
  step('family feed lines written by chat tools', { lines: feedRows.slice(0, 14) });

  // 11. anything confirmed before it happens? count upstream calls between the user message and the write
  step('confirmation', { note: 'Every write above happened inside the first POST /api/chat, in the same upstream round-trip the model asked for it (upstreamCalls=2: tool_use, then the final text). No confirm event exists in the SSE protocol (worker/src/chat.js:4-9).' });

  console.log('\nevidence:', save('01-tools-adult.json', out));
} finally { await L.close(); }
