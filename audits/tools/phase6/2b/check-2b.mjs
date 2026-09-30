// Batch 2b shell check (run from the repo root): the chat Stop button (P2-CHAT-05), a tap on a notification meant for
// someone else (P2-PWA-03 follow-on), the Me cards (Notifications for adult / guest, Chat history, no card for kid/TV),
// the Admin usage note (P2-CHAT-13), and offline.html in every theme (P2-PWA-16) — WebKit and Chromium.
//   node check-2b.mjs <outdir> [webkit|chromium]
import fs from 'node:fs';
import path from 'node:path';
const OUT = process.argv[2]; const engine = process.argv[3] || 'webkit';
fs.mkdirSync(OUT, { recursive: true });
const { local, sleep } = await import(new URL('file:///' + process.cwd().replace(/\\/g, '/') + '/audits/tools/lib/local.mjs').href);
let pass = 0, fail = 0; const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x).slice(0, 400)); } };
const L = await local({ variant: 'typical', clock: 'real', engine });
try {
  if (!process.argv.includes('--offline-only')) {
  // 1. Stop while a reply is on its way
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await d.goto('#chat');
  await d.page.waitForFunction(() => document.querySelector('#chat-log') && !document.querySelector('#chat-log .skeleton') && document.querySelector('#chat-log').children.length > 0, null, { timeout: 15000 });
  ok(await d.page.$eval('#chat-stop', b => b.hidden), 'Stop is hidden while nothing is on its way');
  const used0 = (await L.apiAs('eli', '/api/chat/history')).body.used;
  await L.anthropic([{ hangMs: 20000, text: 'late' }]);
  await d.page.fill('#chat-in', 'What is for dinner?'); await d.page.press('#chat-in', 'Enter');
  await sleep(800);
  const busy = await d.page.evaluate(() => ({ stop: !document.querySelector('#chat-stop').hidden, send: !document.querySelector('#chat-send').hidden, label: document.querySelector('#chat-stop').getAttribute('aria-label'), r: document.querySelector('#chat-stop').getBoundingClientRect().width }));
  ok(busy.stop && !busy.send && busy.r >= 44, 'while waiting, Stop takes Send\'s place (≥ 44 px)', busy);
  await d.page.screenshot({ path: path.join(OUT, `chat-waiting-${engine}.png`) });
  await d.page.click('#chat-stop'); await sleep(600);
  const after = await d.page.evaluate(() => ({ stop: !document.querySelector('#chat-stop').hidden, send: !document.querySelector('#chat-send').hidden, err: [...document.querySelectorAll('#chat-log .msg.bot.err, #chat-log .msg.bot.stopped')].pop()?.innerText || null, input: document.querySelector('#chat-in').value }));
  ok(!after.stop && after.send && /Stopped/.test(after.err || '') && after.input === 'What is for dinner?', 'Stop ends the wait: Send is back, the message is back in the field, no Retry (the house may have acted)', after);
  await d.page.screenshot({ path: path.join(OUT, `chat-stopped-${engine}.png`) });
  await sleep(20000);
  const used1 = (await L.apiAs('eli', '/api/chat/history')).body.used;
  ok(used1 - used0 === 1, 'a Stop after the model was asked counts one message (review round 2)', { used0, used1 });

  // 2. a tap on a push meant for Eli while Mom is signed in on this device
  const m = await L.device({ device: 'ipad-portrait', profile: 'mom', fixedTime: false });
  await m.goto('#home'); await sleep(1200);
  await m.page.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { source: 'hubsw', type: 'open', url: location.origin + '/index.html#f260', to: 'eli' } })));
  await sleep(700);
  const tap = await m.page.evaluate(() => ({ hash: location.hash, frame: !!document.querySelector('#viewer:not([hidden]) iframe, iframe#frame[src*="f260"]'), toast: (document.getElementById('hub-toast') || {}).textContent || null }));
  ok(tap.hash === '#home' && /was for Eli/.test(tap.toast || ''), 'a notification meant for Eli opens nothing of his for Mom and says whose it was', tap);
  await m.page.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { source: 'hubsw', type: 'open', url: location.origin + '/index.html#prayer', to: 'mom' } })));
  await sleep(1200);
  ok(await m.page.evaluate(() => location.hash) === '#prayer', 'her own notification still opens its app', await m.page.evaluate(() => location.hash));

  // 3. Me cards
  for (const [pid, dev] of [['eli', 'ipad-portrait'], ['guest-grandmajo', 'iphone-pwa'], ['ezra', 'ipad-portrait'], ['tv', 'desktop']]) {
    const x = await L.device({ device: dev, profile: pid, fixedTime: false });
    await x.goto('#me'); await sleep(1500);
    const s = await x.page.evaluate(() => ({ notif: !!document.getElementById('notif'), prefs: [...document.querySelectorAll('#notif-prefs [data-pref]')].map(b => b.dataset.pref), pray: !!document.getElementById('notif-pray'), prayOpts: document.querySelectorAll('#notif-pray option').length, hist: !!document.getElementById('chat-hist'), usageNote: /New York days/.test((document.getElementById('admin-body') || {}).textContent || '') }));
    if (pid === 'eli') ok(s.notif && s.prefs.join() === 'leftovers,f260,behind,prayer,prayedfor,park' && s.pray && s.prayOpts === 37 && s.hist, 'Eli: every switch, the reminder-to-pray time (Off + 36 times), Chat history', s);
    if (pid === 'guest-grandmajo') ok(s.notif && !s.prefs.some(k => ['leftovers', 'prayer', 'park'].includes(k)) && s.hist, 'a guest: no household switches (fridge, new family prayers, park)', s);
    if (pid === 'ezra') ok(!s.notif && s.hist, 'a kid: no Notifications card, a Chat history card', s);
    if (pid === 'tv') ok(!s.notif && !s.hist, 'the TV: neither card', s);
    if (pid === 'eli') {
      await x.page.waitForSelector('#admin-body table.usage', { timeout: 20000 }).catch(() => {});
      ok(await x.page.evaluate(() => /New York days/.test(document.getElementById('admin-body').textContent)), 'Admin → Usage says the days are New York days');
      await x.page.evaluate(() => { document.getElementById('notif-prefs').hidden = false; document.getElementById('notif').scrollIntoView(); });
      await x.page.screenshot({ path: path.join(OUT, `me-notif-eli-${engine}.png`) });
      await x.page.evaluate(() => document.getElementById('chat-hist').scrollIntoView());
      await x.page.screenshot({ path: path.join(OUT, `me-chat-hist-eli-${engine}.png`) });
      // clear history through the confirm sheet
      await x.page.click('#chat-clear'); await sleep(500);
      const sheetBtn = await x.page.$('.sheet-backdrop button.btn-danger, .sheet-backdrop [data-ok]');
      if (sheetBtn) { await sheetBtn.click(); await sleep(1200); }
      const h = (await L.apiAs('eli', '/api/chat/history')).body;
      ok(h.messages.length === 0, 'Me → Clear my chat history empties the history (after the confirm sheet)', { n: h.messages.length, used: h.used });
    }
  }

  }
  // 4. offline.html in each palette (as sw.js serves it: with a <base> for the hub's folder)
  const o = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await o.page.goto(L.site + '/offline.html');
  for (const theme of ['hearth', 'midnight', 'parchment', 'graphite']) {
    await o.page.evaluate(t => localStorage.setItem('hub.theme', JSON.stringify(t)), theme);
    await o.page.reload(); await sleep(500);
    const v = await o.page.evaluate(() => { const cs = getComputedStyle(document.body), h = getComputedStyle(document.querySelector('h1')); return { theme: document.documentElement.dataset.theme, bg: cs.backgroundColor, h1: h.color, btn: document.getElementById('again').getBoundingClientRect().height, scrollX: document.documentElement.scrollWidth > innerWidth }; });
    ok(v.theme === theme && v.bg !== 'rgba(0, 0, 0, 0)' && v.btn >= 44 && !v.scrollX, `offline.html paints in ${theme} (tokens, a ≥ 44 px Try again, no side scroll)`, v);
    await o.page.screenshot({ path: path.join(OUT, `offline-${theme}-${engine}.png`) });
  }
} catch (e) { fail++; console.log('  ✗ crashed', e.stack || e); }
finally { await L.close(); }
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
