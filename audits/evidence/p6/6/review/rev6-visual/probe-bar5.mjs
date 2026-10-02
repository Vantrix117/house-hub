// round 4: the viewer bar title at kid XXL 375 — HEAD vs batch 6, with and without a running timer, in the Timer and in Tally
// node probe-bar.mjs <tree dir name: head | wr4> <out dir>
const tree = process.argv[2], OUT = process.argv[3], SIZE = process.argv[4] || 'xxl';
const { local, sleep } = await import(`./${tree}/audits/tools/lib/local.mjs`);
const L = await local({ variant: 'typical', clock: 'real' });
const bar = () => { const r = s => { const e = document.querySelector(s); if (!e || e.hidden || getComputedStyle(e).display === 'none') return null; const b = e.getBoundingClientRect(); return Math.round(b.left) + '+' + Math.round(b.width); };
  const lab = document.getElementById('pill-label'); const ed = s => { const e = document.querySelector(s); if (!e || e.hidden || getComputedStyle(e).display === 'none') return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)]; }; const offs = ['#pill-home','#pill-name','#pill-timer','#pill-reload'].filter(s => { const x = ed(s); return x && (x[0] < 0 || x[1] > innerWidth); }); return { offs, size: document.documentElement.getAttribute('data-text-size'), title: lab.textContent, cut: lab.scrollWidth > lab.clientWidth + 1, label: r('#pill-label'), name: r('#pill-name'), back: r('#pill-home'), chip: r('#pill-timer'), sync: r('#pill-sync'), reload: r('#pill-reload') }; };
for (const prof of ['ezra', 'mom']) for (const w of [375, 390]) for (const app of ['timer', 'tally']) for (const withTimer of [false, true]) {
  const d = await L.device({ device: 'iphone-pwa', profile: prof, fixedTime: false });
  await d.page.setViewportSize({ width: w, height: 667 });
  await d.goto('#home');
  await d.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull, null, { timeout: 10000 }).catch(() => {});
  await d.page.evaluate(s => { try { hub.setTextSize(s); } catch (e) {} }, SIZE);
  await d.page.evaluate(() => { const o = { app: 'timer', scope: 'person' }; if (hub.timers) { for (const r of hub.timers.list({ stale: true })) hub.timers.clear(r.id, r.startedAt); } else if (hub.has && hub.has('timer.active', o)) hub.remove('timer.active', o); });
  if (withTimer) await d.page.evaluate(() => { if (hub.timers) hub.timers.start({ total: 600000, label: '' }); else hub.set('timer.active', { endAt: Date.now() + 600000, total: 600, startedAt: Date.now() }, { app: 'timer', scope: 'person' }); });
  await sleep(600);
  await d.openApp(app); await sleep(1500);
  const r = await d.page.evaluate(bar);
  console.log(tree, SIZE, prof, w, app, withTimer ? 'timer' : 'none', JSON.stringify(r));
  if (prof === 'ezra' && w === 375) await d.page.screenshot({ path: `${OUT}/bar-${tree}-${SIZE}-${app}-${withTimer ? 'timer' : 'none'}.png`, clip: { x: 0, y: 0, width: w, height: 60 } });
  await d.page.evaluate(() => { try { hub.setTextSize('m'); } catch (e) {} const o = { app: 'timer', scope: 'person' }; if (hub.timers) { for (const r of hub.timers.list({ stale: true })) hub.timers.clear(r.id, r.startedAt); } else if (hub.has && hub.has('timer.active', o)) hub.remove('timer.active', o); });
  await sleep(300);
  await d.close();
}
await L.close();
