// round 7: the measured tab bar / pill band. Home and Chat scrolled to the bottom: nothing under the pill or the tab bar;
// the pill never over the tab bar; with no timer the old margins; TV and kitchen untouched. Usage: node r7-shell.mjs <wr7|head> <out>
const tree = process.argv[2], OUT = process.argv[3];
const { local, sleep } = await import(`./${tree}/audits/tools/lib/local.mjs`);
const L = await local({ variant: 'typical', clock: 'real' });
const meas = (tabName) => {
  const r = s => { const e = document.querySelector(s); if (!e || e.hidden || getComputedStyle(e).display === 'none') return null; const b = e.getBoundingClientRect(); return b.height ? [Math.round(b.top), Math.round(b.bottom)] : null; };
  const v = document.getElementById('views'); const tab = r('#tabbar'), pill = r('#timer-pill');
  // the lowest visible content in the active view (text, buttons, inputs), after scrolling to the bottom
  const view = document.getElementById('view-' + tabName) || v;
  let low = 0, lowEl = '';
  for (const e of view.querySelectorAll('button, input, textarea, p, li, h2, .bubble, .msg, a')) { const b = e.getBoundingClientRect(); if (!b.height || getComputedStyle(e).visibility === 'hidden') continue; if (b.bottom > low && b.top < innerHeight) { low = Math.round(b.bottom); lowEl = (e.id || e.className || e.tagName).toString().slice(0, 24); } }
  const comp = r('#chat-form, .chat-form, form.composer, #chatform');
  return { vh: innerHeight, tab, pill, low, lowEl, comp, viewsBottom: Math.round(v.getBoundingClientRect().bottom), mb: getComputedStyle(v).marginBottom, size: document.documentElement.dataset.textSize || 'm' };
};
for (const prof of ['mom', 'ezra']) for (const xxl of [false, true]) for (const [dev, w, h] of [['iphone-pwa', 375, 667], ['iphone-pwa', 390, 844], ['ipad-portrait', 820, 1180]]) for (const withTimer of [false, true]) {
  const d = await L.device({ device: dev, profile: prof, fixedTime: false });
  await d.page.setViewportSize({ width: w, height: h });
  await d.goto('#home');
  await d.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull, null, { timeout: 10000 }).catch(() => {});
  if (xxl) await d.page.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl'));
  await d.page.evaluate(async () => { const T = hub.timers; if (T) for (const r of T.list({ stale: true })) { try { await T.clear(r.id, r.startedAt); } catch {} } });
  if (withTimer) await d.page.evaluate(() => hub.timers ? hub.timers.start({ total: 900000, label: 'Soup' }) : hub.set('timer.active', { endAt: Date.now() + 900000, total: 900, startedAt: Date.now() }, { app: 'timer', scope: 'person' }));
  await sleep(1500);
  const out = {};
  for (const tab of ['home', 'chat']) {
    if (tab === 'chat' && prof === 'ezra') { await d.page.evaluate(() => { location.hash = '#chat'; }); } else if (tab === 'chat') await d.page.evaluate(() => { location.hash = '#chat'; });
    await sleep(900);
    await d.page.evaluate(() => { const v = document.getElementById('views'); v.scrollTop = v.scrollHeight; const c = document.querySelector('.chat-log, #chat-log'); if (c) c.scrollTop = c.scrollHeight; });
    await sleep(500);
    const m = await d.page.evaluate(meas, tab);
    const issues = [];
    if (m.pill && m.tab && m.pill[1] > m.tab[0] + 1) issues.push(`pill over tabbar ${m.pill[1]}>${m.tab[0]}`);
    if (m.pill && m.low > m.pill[0] + 1 && tab === 'home') issues.push(`content under pill ${m.lowEl} ${m.low}>${m.pill[0]}`);
    if (m.tab && m.low > m.tab[0] + 1) issues.push(`content under tabbar ${m.lowEl} ${m.low}>${m.tab[0]}`);
    if (m.pill && m.comp && m.comp[1] > m.pill[0] + 1 && m.comp[0] < m.pill[1]) issues.push(`composer x pill ${JSON.stringify(m.comp)} vs ${JSON.stringify(m.pill)}`);
    out[tab] = { m, issues };
    await d.shot(`${OUT}/shell-${tree}-${prof}-${xxl ? 'xxl' : 'std'}-${w}-${withTimer ? 't' : 'n'}-${tab}.png`);
    await d.page.evaluate(() => { location.hash = '#home'; });
  }
  console.log(tree, prof, xxl ? 'xxl' : 'std', w, withTimer ? 'timer' : 'none', '| home', `tab ${out.home.m.tab} pill ${out.home.m.pill} low ${out.home.m.low}(${out.home.m.lowEl}) mb ${out.home.m.mb}`, out.home.issues.join('; ') || 'ok', '| chat', `pill ${out.chat.m.pill} comp ${out.chat.m.comp} mb ${out.chat.m.mb}`, out.chat.issues.join('; ') || 'ok');
  await d.page.evaluate(async () => { const T = hub.timers; if (T) for (const r of T.list({ stale: true })) { try { await T.clear(r.id, r.startedAt); } catch {} } });
  await d.close();
}
await L.close();
