// Batch 10 copy of audits/tools/phase2/PWA/verify3-rally-unreachable-1.mjs (P2-PWA-18, GAP-DOLLYWOOD-LIVE-1's sibling).
//   node "audits/tools/phase6/10/verify3-rally-unreachable-1-10.mjs"
// WHAT CHANGED AND WHY: the original proved that nothing in the UI could reach POST /api/dollywood/rally (rally() was defined and never
// called) and used rally() from the console as its positive control. Batch 10 gives the meeting bar a Rally button (#lv-rally, household
// adults) and removes the dead rally() function, so this copy asserts the opposite: the control exists, it asks first, and tapping it
// sends one request and the Worker writes the row and its own feed line. Step 7's positive control taps the button instead of calling
// rally(). Everything else (the scan, Meet here, the long press) is unchanged. Evidence: audits/evidence/p6/10/PWA.
// ORIGINAL HEADER (Phase 2):
// Claim: "Rally the family" (POST /api/dollywood/rally → "Meet at <name>" push to the other adults) cannot be triggered
// from any UI: rally() in apps/dollywood-live.html is defined but never called, and the Meet-here confirm tells the user
// to "Tap Rally afterwards" although no Rally control exists.
//
// Local rig only (variant 'park' = typical + a park day with a seeded meeting point). As Eli on an iPhone PWA:
//   1. open the park map; list every button / control in the app frame and the shell, look for anything named Rally/buzz;
//   2. the meet bar (seeded meeting point): which buttons it offers;
//   3. open a ride card from the sheet list, tap "Meet here", accept the confirm (record its text);
//   4. long-press the map (the other documented way to set a meeting point), accept that confirm;
//   5. after each: the meet bar's buttons again, and every /api/ request the page made (is /api/dollywood/rally ever hit?);
//   6. the server's family `meet` row and the activity feed (rally writes "Set a meeting point: …", the client
//      setMeet writes "Meeting point: …");
//   7. positive control: call rally() from the console — proves the request logger would have seen the call and that
//      the endpoint works; only the UI never reaches it.
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p6/10/PWA');
fs.mkdirSync(OUT, { recursive: true });
const TAG = 'verify3-rally-unreachable-1-10';
const out = { steps: {} };
const say = (t, o) => { console.log('\n== ' + t); if (o !== undefined) console.log(typeof o === 'string' ? o : JSON.stringify(o, null, 1)); };

const L = await local({ variant: 'park', clock: 'demo', engine: 'webkit', overlay: (process.argv.find(a => a.startsWith('overlay=')) || '').slice(8) || undefined });   // overlay=audits/tools/d-overlay serves a private build over the repo
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  const reqs = [], dialogs = [];
  d.page.on('request', r => { const u = r.url(); if (u.includes('/api/')) reqs.push({ method: r.method(), path: new URL(u).pathname + new URL(u).search }); });
  d.page.on('dialog', async dlg => { dialogs.push({ type: dlg.type(), message: dlg.message() }); await dlg.accept().catch(() => {}); });
  const shot = async name => { const f = path.join(OUT, `${TAG}-${name}.png`); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f).replace(/\\/g, '/'); };

  const f = await d.openApp('dollywood-live', { wait: '#lv-meet' });
  for (let i = 0; i < 60; i++) { const ok = await f.evaluate(() => !!(window.hub && hub.profile && typeof MEET !== 'undefined' && MEET)).catch(() => false); if (ok) break; await sleep(250); }
  await sleep(1500);

  // every control, visible or not, in the app frame and in the shell; anything mentioning rally / buzz
  const scan = fr => fr.evaluate(() => {
    const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('[hidden]'); };
    const ctl = [...document.querySelectorAll('button,[role=button],a,input,[onclick],[data-act],[data-action]')].map(e => ({ tag: e.tagName.toLowerCase(), id: e.id || null, text: (e.textContent || e.value || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 60), visible: vis(e) }));
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const textHits = []; let n; while ((n = walker.nextNode())) { if (n.parentElement && /script|style/i.test(n.parentElement.tagName)) continue; if (/rally|buzz/i.test(n.textContent)) textHits.push(n.textContent.trim().slice(0, 120)); }
    const attrHits = [...document.querySelectorAll('*')].filter(e => [...e.attributes].some(a => /rally|buzz/i.test(a.value) || /rally/i.test(a.name))).map(e => e.outerHTML.slice(0, 160));
    return { controls: ctl.length, rallyControls: ctl.filter(c => /rally|buzz/i.test(c.text + ' ' + (c.id || ''))), textHits, attrHits };
  });
  const meetBar = () => f.evaluate(() => { const b = document.getElementById('lv-meet'); return { hidden: b.hidden, name: document.getElementById('meet-name').textContent, meta: document.getElementById('meet-meta').textContent, buttons: [...b.querySelectorAll('button')].map(x => ({ id: x.id, text: x.textContent.trim(), hidden: x.hidden })) }; });
  const rallyReqs = () => reqs.filter(r => r.path.startsWith('/api/dollywood/rally'));

  out.steps.s1_open = {
    typeofRally: await f.evaluate(() => typeof rallyMeet),
    rallySource: await f.evaluate(() => String(rallyMeet).slice(0, 90)),
    kind: await f.evaluate(() => hub.profile.kind), canWrite: await f.evaluate(() => hub.canWrite),
    appFrame: await scan(f), shell: await scan(d.page),
    meetBar: await meetBar(),
    shot: await shot('a-meet-bar-seeded'),
  };
  say('1. park map open as Eli', out.steps.s1_open);

  // 3. open the sheet (tap its handle to "half"), open a ride card from the list, tap Meet here
  await f.click('#lv-handle'); await sleep(900);
  let items = await f.$$('#near-list .lv-item');
  if (!items.length) { await f.click('#near-mode-waits').catch(() => {}); await sleep(800); items = await f.$$('#near-list .lv-item'); }
  out.steps.s3_listItems = items.length;
  out.steps.s3_sheetShot = await shot('b0-sheet-half');
  if (!items.length) throw new Error('no list items to open a ride card');
  try { await items[0].click({ timeout: 5000 }); out.steps.s3_itemClick = 'pointer tap'; }
  catch { await items[0].evaluate(e => e.click()); out.steps.s3_itemClick = 'DOM click (tap target covered at this sheet height)'; }
  await sleep(1200);
  const card = await f.evaluate(() => ({ title: (document.querySelector('#pop h2') || {}).textContent, actions: [...document.querySelectorAll('#pop .pop-act button')].map(b => b.textContent.trim()) }));
  const cardShot = await shot('b-ride-card');
  const nD = dialogs.length, nR = reqs.length;
  const mb = await f.$('#pop .pop-act button:text-is("Meet here")');
  if (!mb) throw new Error('no Meet here button on the card');
  await mb.click(); await f.waitForSelector('#ask-ok', { timeout: 3000 }).then(() => f.click('#ask-ok')).catch(() => {}); await sleep(2500);   // the page's own confirm sheet (batch 1: no native dialogs)
  out.steps.s3_meetHere = {
    card, cardShot, dialogs: dialogs.slice(nD), newRequests: reqs.slice(nR),
    meetBar: await meetBar(), appFrame: await scan(f), rallyRequestsSoFar: rallyReqs(),
    shot: await shot('c-after-meet-here'),
  };
  say('3. ride card → Meet here → OK', out.steps.s3_meetHere);

  // 4. long-press the map (adults: 550 ms, no drag)
  const box = await f.$eval('#map', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height * 0.35 }; });
  const frameEl = await f.frameElement(); const fb = await frameEl.boundingBox();
  const nD2 = dialogs.length, nR2 = reqs.length;
  await d.page.mouse.move(fb.x + box.x, fb.y + box.y); await d.page.mouse.down(); await sleep(900); await d.page.mouse.up(); await f.waitForSelector('#ask-ok', { timeout: 3000 }).then(() => f.click('#ask-ok')).catch(() => {}); await sleep(2500);
  out.steps.s4_longPress = { dialogs: dialogs.slice(nD2), newRequests: reqs.slice(nR2), meetBar: await meetBar(), rallyRequestsSoFar: rallyReqs(), shot: await shot('d-after-long-press') };
  say('4. long-press on the map → OK', out.steps.s4_longPress);

  // 6. what the server holds
  await sleep(2000);
  const meetRow = await L.apiAs('eli', '/api/data/dollywood-live?scope=family&key=meet');
  const feed = await L.apiAs('eli', '/api/activity?limit=15');
  out.steps.s6_server = {
    meetRow: meetRow.body.item && { value: meetRow.body.item.value, updated_at: meetRow.body.item.updated_at },
    feed: (feed.body.activity || []).filter(a => /meet/i.test(a.text)).map(a => ({ who: a.profile_id, app: a.app_id, text: a.text })),
    allApiRequestsDuringUiSteps: reqs.map(r => r.method + ' ' + r.path.replace(/since=\d+/, 'since=…')).filter((v, i, a) => a.indexOf(v) === i),
    rallyRequestsFromUi: rallyReqs(),
  };
  say('6. server state after the UI steps', out.steps.s6_server);

  // 7. the control: tap Rally on the meeting bar, answer the page's own confirm sheet, watch the request and the server
  const nR3 = reqs.length;
  const statusP = d.page.waitForResponse(r => r.url().includes('/api/dollywood/rally'), { timeout: 15000 }).then(r => r.status()).catch(e => 'no response: ' + e.message);
  const bar7 = await f.evaluate(() => { const b = document.getElementById('lv-rally'); return b ? { hidden: b.hidden, text: b.textContent.trim() } : null; });
  await f.click('#lv-rally'); await f.waitForSelector('#ask-ok', { timeout: 5000 });
  const sheet7 = await f.evaluate(() => ({ title: document.getElementById('ask-t').textContent, body: document.getElementById('ask-b').textContent, ok: document.getElementById('ask-ok').textContent }));
  await f.click('#ask-ok');
  const st = await statusP; await sleep(800);
  const feed2 = await L.apiAs('eli', '/api/activity?limit=5');
  out.steps.s7_control = { bar7, sheet7, rallyRequests: reqs.slice(nR3).filter(r => r.path.startsWith('/api/dollywood/rally')), status: st, meetMeta: (await meetBar()).meta, feedTop: (feed2.body.activity || []).slice(0, 2).map(a => a.text) };
  say('7. Rally from the meeting bar', out.steps.s7_control);

  out.logs = d.logs.filter(l => !/favicon/.test(l)).slice(0, 30);
  out.verdictInputs = {
    rallyControlsInUi: out.steps.s1_open.appFrame.rallyControls.length + out.steps.s1_open.shell.rallyControls.length + out.steps.s3_meetHere.appFrame.rallyControls.length,
    rallyRequestsFromUi: out.steps.s6_server.rallyRequestsFromUi.length,
    rallyRequestsFromConsole: out.steps.s7_control.rallyRequests.length,
  };
  say('verdict inputs', out.verdictInputs);
  const v = out.verdictInputs;
  console.log(v.rallyControlsInUi >= 1 && v.rallyRequestsFromConsole === 1 && out.steps.s7_control.status === 200 ? '\nVERDICT: Rally is reachable from the UI (the finding is fixed)' : '\nVERDICT: Rally is NOT reachable / did not send exactly one request');
} finally {
  fs.writeFileSync(path.join(OUT, `${TAG}.json`), JSON.stringify(out, null, 1));
  await L.close();
}
