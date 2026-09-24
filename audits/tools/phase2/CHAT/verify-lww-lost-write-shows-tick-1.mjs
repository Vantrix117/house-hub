// Skeptic #1 for CHAT finding "lww-lost-write-shows-tick": a chat tool write that loses last-write-wins still shows a
// ✓ chip, tells the model it worked and posts a feed line. Independent of 03-cap.mjs.
//   node "audits/tools/phase2/CHAT/verify-lww-lost-write-shows-tick-1.mjs"
// A. control: toggle_f260_reading with no clock skew is applied.
// B. the finding's own precondition via the raw API (f260.done stamped +120 s, which putOne accepts up to +5 min).
// C. the same precondition produced by the REAL client: Eli's phone clock runs 2 min fast; F260 is reopened on a slow
//    link (its data pull held for 8 s, so hub.skew is still 0) and he taps Done; then he asks chat (on the phone's Chat
//    tab) to tick another day. Screenshot of the chat bubble; server + the F260 frame's own view afterwards.
// D. finish_leftover on an item whose row carries a +60 s stamp: chip "✓ Finished …", item still in the fridge list.
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
import { toolCall, data, save, feed, EVID } from './lib.mjs';

const out = {};
const raw = async (L, pid, app, scope, key) => (await L.apiAs(pid, `/api/data/${app}?scope=${scope}&key=${encodeURIComponent(key)}`)).body.item;
const feedLine = async (L, needle) => { const a = ((await feed(L, 'eli', 100)).activity || []); const i = a.findIndex(x => x.text.includes(needle)); return i < 0 ? null : { text: a[i].text, by: a[i].profile_id, createdAgoMs: Date.now() - a[i].created_at, rank: i }; };
const unticked = (done, week, skip = []) => { for (let w = week; w >= 1; w--) for (let d = 0; d < 5; d++) { const k = `${w}-${d}`; if (!done[k] && !skip.includes(k)) return { week: w, day: d + 1, key: k }; } return null; };

const L = await local({ variant: 'typical', clock: 'real' });
try {
  // ── A. control ──────────────────────────────────────────────
  let doneRow = await raw(L, 'eli', 'f260', 'person', 'f260.done');
  let sum = await data(L, 'eli', 'f260', 'person', 'f260.summary');
  const tA = unticked(doneRow.value, sum.week);
  const rA = await toolCall(L, 'eli', 'toggle_f260_reading', { week: tA.week, day: tA.day });
  let after = await raw(L, 'eli', 'f260', 'person', 'f260.done');
  out.A_control = { target: tA.key, rowStampAheadOfNowMs: doneRow.updated_at - Date.now(), chip: rA.chip, ok: rA.ok, toolResult: rA.toolResult, serverHasIt: !!after.value[tA.key] };
  console.log('A control (no skew):', JSON.stringify(out.A_control));

  // ── B. raw-API precondition (+120 s stamp) ───────────────────
  doneRow = await raw(L, 'eli', 'f260', 'person', 'f260.done');
  const put = await L.apiAs('eli', '/api/data/f260/f260.done?scope=person', { method: 'PUT', body: { value: doneRow.value, updated_at: Date.now() + 120000 } });
  sum = await data(L, 'eli', 'f260', 'person', 'f260.summary');
  const tB = unticked(doneRow.value, sum.week);
  const sumBefore = await data(L, 'eli', 'f260', 'person', 'f260.summary');
  const rB = await toolCall(L, 'eli', 'toggle_f260_reading', { week: tB.week, day: tB.day });
  after = await raw(L, 'eli', 'f260', 'person', 'f260.done');
  const sumAfter = await data(L, 'eli', 'f260', 'person', 'f260.summary');
  const logAfter = await data(L, 'eli', 'f260', 'person', 'f260.log');

  out.B_rawSkew = {
    putStatus: put.status, putApplied: put.body && put.body.applied, rowStampAheadOfNowMs: after.updated_at - Date.now(),
    target: tB.key, chip: rB.chip, ok: rB.ok, toolResult: rB.toolResult, finalText: rB.text,
    serverHasIt: !!after.value[tB.key], serverDoneCount: Object.keys(after.value).length,
    summaryBefore: { week: sumBefore.week, weekDone: sumBefore.weekDone, total: sumBefore.total, readToday: sumBefore.readToday },
    summaryAfter: { week: sumAfter.week, weekDone: sumAfter.weekDone, total: sumAfter.total, readToday: sumAfter.readToday },
    logHasToday: logAfter && Object.keys(logAfter).sort().slice(-1)[0],
    feedLine: await feedLine(L, `week ${tB.week} day ${tB.day} (via chat)`),
  };
  console.log('B raw-API skew:', JSON.stringify(out.B_rawSkew, null, 1));

  // ── C. the real client produces the stamp ────────────────────
  await L.reset('typical');
  await sleep(200);
  const SKEW = 120000;
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: Date.now() + SKEW });
  let f = await phone.openApp('f260', { wait: '#todayDone' });
  await sleep(2500);                                                     // first open: full pull, warm cache
  const clockAhead = await f.evaluate(() => Date.now()) - Date.now();
  let holdGets = true;
  await phone.ctx.route(u => u.href.startsWith(L.api + '/api/data/'), async (route, req) => { if (holdGets && req.method() === 'GET') await sleep(8000); await route.continue().catch(() => {}); });
  await phone.page.reload({ waitUntil: 'load' });                        // reopen on a slow link: new hub.js instance, skew 0
  let t0 = Date.now(); while (!phone.frame('f260') && Date.now() - t0 < 10000) await sleep(100);
  f = phone.frame('f260'); await f.waitForSelector('#todayDone', { timeout: 10000 });
  const skewBeforeTap = await f.evaluate(() => hub.skew);
  const target = await f.evaluate(() => document.getElementById('todayDone').dataset.target);
  const doneBeforeTap = (await raw(L, 'eli', 'f260', 'person', 'f260.done')).value;
  await f.click('#todayDone');
  await sleep(1500);                                                     // hub.js flushes after 250 ms (POST, not held)
  const rowAfterTap = await raw(L, 'eli', 'f260', 'person', 'f260.done');
  const tappedKeys = Object.keys(rowAfterTap.value).filter(k => !doneBeforeTap[k]);
  holdGets = false;
  const sumC = await data(L, 'eli', 'f260', 'person', 'f260.summary');
  const tC = unticked(rowAfterTap.value, sumC.week);
  // Eli then asks chat on the same phone to tick another day
  await L.anthropic([{ tools: [{ name: 'toggle_f260_reading', input: { week: tC.week, day: tC.day } }] }, { text: `Done — week ${tC.week} day ${tC.day} is checked off.` }]);
  await phone.goto('#chat');
  await phone.page.waitForFunction(() => document.querySelector('#chat-log') && !document.querySelector('#chat-log .skeleton') && document.querySelector('#chat-log').children.length > 0, null, { timeout: 15000 });
  await phone.page.fill('#chat-in', `I also read week ${tC.week} day ${tC.day}, tick it off`); await phone.page.press('#chat-in', 'Enter');
  await phone.page.waitForFunction(() => !document.querySelector('#chat-log .typing'), null, { timeout: 30000 });
  await sleep(300);
  const bubble = await phone.page.evaluate(() => { const r = [...document.querySelectorAll('#chat-log .mrow')].slice(-1)[0]; return { text: r.querySelector('.msg').innerText.trim(), chips: [...r.querySelectorAll('.chip')].map(c => c.className + ' | ' + c.textContent) }; });
  const shotC = path.join(EVID, 'verify-lww-lost-write-chat-iphone-light.png');
  await phone.page.screenshot({ path: shotC, scale: 'css', animations: 'disabled', caret: 'hide' });
  const rowAfterChat = await raw(L, 'eli', 'f260', 'person', 'f260.done');
  // the F260 app on the phone after a fresh open + pull
  f = await phone.openApp('f260', { wait: '#todayDone' }); await sleep(3000);
  const appView = await f.evaluate(k => { const d = hub.get('f260.done', { default: {} }); return { hasChatDay: !!d[k], skew: hub.skew }; }, tC.key);
  out.C_realClient = {
    phoneClockAheadMs: clockAhead, skewWhenTapped: skewBeforeTap, doneButtonTarget: target, tappedKeys,
    rowStampAheadOfNowAfterTapMs: rowAfterTap.updated_at - Date.now(),
    chatTarget: tC.key, chatBubble: bubble, shot: 'audits/evidence/p2/CHAT/' + path.basename(shotC),
    serverHasChatDay: !!rowAfterChat.value[tC.key], serverHasTappedDay: tappedKeys.every(k => rowAfterChat.value[k]),
    f260AppAfterPull: appView, feedLine: await feedLine(L, `week ${tC.week} day ${tC.day} (via chat)`),
    summaryAfterChat: (({ week, weekDone, total }) => ({ week, weekDone, total }))(await data(L, 'eli', 'f260', 'person', 'f260.summary')), serverDoneCount: Object.keys(rowAfterChat.value).length,
  };
  console.log('C real client:', JSON.stringify(out.C_realClient, null, 1));
  await phone.close();

  // ── D. finish_leftover loses to a +60 s stamp ────────────────
  await L.reset('typical');
  const items = (await L.apiAs('eli', '/api/data/leftovers?scope=family')).body.items.filter(r => r.value && r.key.startsWith('item:'));
  const it = items[0];
  await L.apiAs('christian', `/api/data/leftovers/${encodeURIComponent(it.key)}?scope=family`, { method: 'PUT', body: { value: it.value, updated_at: Date.now() + 60000 } });
  const rD = await toolCall(L, 'eli', 'finish_leftover', { item_id: it.value.id });
  const rowD = await raw(L, 'eli', 'leftovers', 'family', it.key);
  out.D_finishLeftover = { item: it.value.name, chip: rD.chip, ok: rD.ok, toolResult: rD.toolResult, stillLiveOnServer: !!(rowD && rowD.value), feedLine: await feedLine(L, `Finished ${it.value.name} from the fridge (via chat)`) };
  console.log('D finish_leftover:', JSON.stringify(out.D_finishLeftover));
} finally { await L.close(); }
console.log('evidence:', save('verify-lww-lost-write-shows-tick-1.json', out));
