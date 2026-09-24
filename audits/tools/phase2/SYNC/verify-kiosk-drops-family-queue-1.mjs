// Skeptic #1 for SYNC finding "kiosk-drops-family-queue" — independent reproduction.
//   node "audits/tools/phase2/SYNC/verify-kiosk-drops-family-queue-1.mjs"
// On the rig's Kitchen iPad as Eli: go offline, add a Home reminder (family scope), Me -> Switch, come back online while
// the picker is up, then sign in as the next person. Case 'tv' (kiosk) vs control case 'ezra' (kid).
// Records: every POST /api/data/reminders/batch response, every hub.onSync transition, the family queue before/after,
// whether the server has the row (read through a separate device as Mom), whether the iPad's own cache still shows it,
// and the server again after another 35 s (one more poll/flush cycle).
import { local, sleep } from '../../lib/local.mjs';
import { waitFor, shot, writeEvidence } from './_util.mjs';

const out = {};
const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's', ...a);
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const reader = await L.newDevice({ name: 'Verify reader', profiles: ['mom'] });
  const serverHas = async text => {
    const r = await L.apiAs(null, '/api/data/reminders?scope=family', { deviceToken: reader.device.token, profileToken: reader.sessions.mom });
    return r.body.items.some(i => i.value && i.value.text === text);
  };
  const feedHas = async text => {
    const r = await L.apiAs(null, '/api/activity?limit=100', { deviceToken: reader.device.token, profileToken: reader.sessions.mom });
    return (r.body.activity || []).filter(a => a.text.includes(text)).map(a => a.profile_id + ': ' + a.text.slice(0, 40));
  };
  const qLen = async d => Object.keys((await d.hub()).queue['hub.queue.reminders.family'] || {}).length;

  for (const next of ['tv', 'ezra']) {
    const o = out[next] = {};
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await ipad.goto('#home');
    await waitFor(() => ipad.page.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 });
    await ipad.page.evaluate(() => { window.__sync = []; hub.onSync(s => window.__sync.push(s.state + (s.lastError ? ':' + s.lastError : '') + ' p' + s.pending)); });
    const batches = [];
    ipad.page.on('response', async r => { if (/\/api\/data\/reminders\/batch/.test(r.url())) batches.push({ status: r.status(), body: (await r.text().catch(() => '')).slice(0, 90) }); });

    await ipad.setOffline(true);
    const text = `Verify offline reminder before ${next} ${Date.now()}`;
    await ipad.page.fill('#remtext', text); await ipad.page.press('#remtext', 'Enter');
    await sleep(600);
    o.queuedAfterAdd = await qLen(ipad);
    o.syncAfterAdd = (await ipad.hub()).sync.state;
    await ipad.page.evaluate(() => { location.hash = '#me'; }); await sleep(400);
    await ipad.page.click('#switch');
    await ipad.page.waitForSelector(`.pcard[data-id="${next}"]`, { timeout: 10000 });
    await ipad.setOffline(false);
    await sleep(2000);
    o.queueOnPicker = await qLen(ipad);
    o.serverWhilePicker = await serverHas(text);
    await ipad.page.click(`.pcard[data-id="${next}"]`);
    await waitFor(() => ipad.page.evaluate(n => hub.profile && hub.profile.id === n && hub.sync.lastPull > 0, next), { timeout: 15000 });
    await sleep(2500);
    const h = await ipad.hub();
    o.signedInAs = h.profile;
    o.batchResponses = batches.slice();
    o.queueAfter = await qLen(ipad);
    o.syncAfter = h.sync;
    o.syncTransitions = await ipad.page.evaluate(() => window.__sync.slice(-8));
    o.serverHasAfterSignIn = await serverHas(text);
    o.ipadCacheStillHasIt = await ipad.page.evaluate(t => hub.list('item:', { app: 'reminders', scope: 'family' }).some(r => r.value.text === t), text);
    o.visibleOnScreen = await ipad.page.evaluate(t => document.body.innerText.includes(t), text);
    o.feedLineOnServer = await feedHas(text);
    o.activityQueueOnDevice = await ipad.page.evaluate(() => JSON.parse(localStorage.getItem('hub.activityQueue') || '[]').map(a => a.text.slice(0, 40)));
    o.shot = await shot(ipad.page, `verify-kdfq1-ipad-after-${next}.png`);
    o.visibleWhere = await ipad.page.evaluate(t => {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { const e = n.parentElement; if (n.nodeValue.includes(t) && e.getClientRects().length) { e.scrollIntoView({ block: 'center' }); const sec = e.closest('section,.card'); return (sec && (sec.getAttribute('aria-label') || sec.className)) || e.tagName; } }
      return null;
    }, text);
    if (o.visibleWhere) { await sleep(400); o.shotReminder = await shot(ipad.page, `verify-kdfq1-ipad-after-${next}-reminder.png`); }
    log(`[${next}] feed line on server: ${JSON.stringify(o.feedLineOnServer)}; activity queue on device: ${JSON.stringify(o.activityQueueOnDevice)}`);
    log(`[${next}] queued ${o.queuedAfterAdd} (sync ${o.syncAfterAdd}); on the picker, online: queue ${o.queueOnPicker}, server has it ${o.serverWhilePicker}`);
    log(`[${next}] signed in as ${o.signedInAs}; batch responses ${JSON.stringify(o.batchResponses)}`);
    log(`[${next}] queue left ${o.queueAfter}; sync ${JSON.stringify(o.syncAfter)}; transitions ${JSON.stringify(o.syncTransitions)}`);
    log(`[${next}] server has it: ${o.serverHasAfterSignIn}; iPad cache still lists it: ${o.ipadCacheStillHasIt}; text visible on screen: ${o.visibleOnScreen} (${o.visibleWhere})`);
    if (next === 'tv') {
      await sleep(35000);                               // another 30 s poll + any retry
      o.serverHasAfter35s = await serverHas(text);
      o.queueAfter35s = await qLen(ipad);
      o.batchResponsesAfter35s = batches.length;
      log(`[tv] +35 s: server has it ${o.serverHasAfter35s}; queue ${o.queueAfter35s}; batch POSTs so far ${o.batchResponsesAfter35s}`);
    }
    await ipad.close();
  }
  log('evidence', writeEvidence('verify-kiosk-drops-family-queue-1.json', out));
} finally { await L.close(); }
