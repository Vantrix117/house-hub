// A first open on a brand-new device (nothing cached) over a slow network: every GET /api/data/* is delayed 9 s.
// hub.ready stops waiting after 6 s (apps/hub.js:336-337) and Verses renders from the empty cache.
//   adult: what Eli sees at ~7 s, and the summary row queued by render() → writeSummary() (apps/verses.html:239-245, 356).
//   kid:   Ezra first rates both of the family week's verses on the Kitchen iPad (online). Then, on a new phone with the slow
//          network, the family week is not there yet, so familyWeek() falls back to week 1 (apps/verses.html:217) and the card
//          shows Genesis 1:27. He rates it; the write {...recall()} of an empty map (294-298) replaces his real f260.recall row.
import { local, DEMO, sleep } from '../../lib/local.mjs';
import { openVerses, state, rate, serverRow, save, shot, waitQueueEmpty } from './_lib.mjs';
const WHO = process.argv[2] || 'adult';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = { who: WHO };
const slow = d => d.ctx.route(u => /\/api\/data\/[^/]+$/.test(u.pathname) && d.slow, async r => { await sleep(9000); await r.continue().catch(() => {}); });
try {
  const pid = WHO === 'kid' ? 'ezra' : 'eli';
  if (WHO === 'kid') {
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: DEMO });
    const f = await openVerses(ipad);
    out.ipadFirst = (await state(f)).who;
    await rate(f, 'got'); await rate(f, 'got');
    await waitQueueEmpty(ipad);
    out.recallBefore = (await serverRow(L, 'ezra', 'f260', 'f260.recall')).value;
    out.logBefore = (await serverRow(L, 'ezra', 'verses', 'log')).value;
    await ipad.close();
  } else {
    out.summaryBefore = (await serverRow(L, 'eli', 'verses', 'summary')).value;
  }
  const ph = await L.newDevice({ name: 'New phone', profiles: [pid] });
  const phone = await L.device({ device: 'iphone-pwa', profile: pid, installClock: DEMO, as: ph });
  phone.slow = true; await slow(phone);
  const t0 = Date.now();
  const f = await phone.openApp('verses');
  await f.waitForSelector('#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])', { timeout: 15000 });
  out.renderedAtMs = Date.now() - t0;
  out.stalled = await state(f);
  out.queuedSummary = await phone.page.evaluate(() => { const q = JSON.parse(localStorage.getItem('hub.queue.verses.person.' + JSON.parse(localStorage.getItem('hub.session')).profile.id) || '{}'); return q.summary ? q.summary.value : null; });
  out.shot = await shot(phone.page, `stalled-load-${WHO}-iphone.png`);
  await sleep(1200); out.serverSummaryAtStall = (await serverRow(L, pid, 'verses', 'summary'));
  if (WHO === 'kid') { await rate(f, 'got'); out.ratedAtMs = Date.now() - t0; }
  await sleep(14000);                                // the delayed pulls and the flush land
  await waitQueueEmpty(phone, 20000); await sleep(2000);
  out.afterLoad = await state(f);
  if (WHO === 'kid') {
    out.recallAfter = (await serverRow(L, 'ezra', 'f260', 'f260.recall')).value;
    out.logAfter = (await serverRow(L, 'ezra', 'verses', 'log')).value;
    const ipad2 = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: DEMO });
    const f2 = await openVerses(ipad2);
    out.ipadAfter = await state(f2);
    out.shotIpad = await shot(ipad2.page, 'stalled-load-kid-ipad-after.png');
  } else {
    out.summaryAfter = (await serverRow(L, 'eli', 'verses', 'summary'));
  }
  console.log(JSON.stringify(out, null, 1));
  save(`stalled-load-${WHO}.json`, out);
} finally { await L.close(); }
