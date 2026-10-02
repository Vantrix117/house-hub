// round 8: the judge's layout (go full row, +1/Reset second row), the notify offer, in-app Reset Undo, quiet unseen dial
import { local, sleep } from './wr8/audits/tools/lib/local.mjs';
import fs from 'node:fs';
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'real' });
const clearAll = f => f.evaluate(async () => { for (const r of hub.timers.list({ stale: true })) { try { await hub.timers.clear(r.id, r.startedAt); } catch {} } });
const M = () => {
  const r = s => { const e = document.querySelector(s); if (!e || e.hidden || getComputedStyle(e).display === 'none' || getComputedStyle(e).visibility === 'hidden') return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
  const t = document.getElementById('hub-toast'); const tr = t && !t.hidden ? t.getBoundingClientRect() : null;
  const ov = (a) => { if (!tr || !a) return false; return a[0] < tr.right && tr.left < a[0] + a[2] && a[1] < tr.bottom && tr.top < a[1] + a[3]; };
  const go = r('#go'), p1 = r('#plus1'), rs = r('#reset');
  const d = document.getElementById('dial'), cs = getComputedStyle(d);
  return { vh: innerHeight, iw: innerWidth, dial: r('#dial'), go, p1, rs, list: r('#list'), offer: r('#notify-offer'), x: r('#notify-offer-no'), pre: r('#presets'), toast: tr ? [Math.round(tr.left), Math.round(tr.top), Math.round(tr.width), Math.round(tr.height)] : null, toastOver: ['go', 'p1', 'rs'].filter((k, i) => ov([go, p1, rs][i])), goTxt: document.querySelector('#go .lbl').textContent, st: document.getElementById('tstate').innerText.trim(), anim: cs.animationName, shadow: cs.boxShadow.slice(0, 40), wash: getComputedStyle(document.body).backgroundImage.slice(0, 30), sw: document.documentElement.scrollWidth > innerWidth };
};
const f1 = o => `dial ${o.dial} go ${o.go}(${o.goTxt}) +1 ${o.p1} reset ${o.rs} list ${o.list} offer ${o.offer}${o.x ? ' X ' + o.x[2] + 'x' + o.x[3] : ''} pre ${o.pre && o.pre[1]}${o.toast ? ' toast ' + o.toast + (o.toastOver.length ? ' OVER ' + o.toastOver : '') : ''}${o.go && o.go[1] + o.go[3] > o.vh ? ' GO-BELOW-FOLD' : ''}${o.sw ? ' HSCROLL' : ''}`;
for (const prof of (process.argv[3] ? process.argv[3].split(',') : ['mom', 'ezra'])) for (const xxl of [false, true]) for (const [dev, w, h] of [['iphone-pwa', 375, 667], ['iphone-pwa', 390, 844], ['ipad-portrait', 820, 1180], ['ipad-landscape', 1180, 820], ['desktop', 1440, 900]]) {
  const d = await L.device({ device: dev, profile: prof, fixedTime: false });
  await d.ctx.addInitScript(() => { try { if (!('Notification' in window) || Notification.permission !== 'default') { window.Notification = function () {}; Notification.permission = 'default'; Notification.requestPermission = async () => 'denied'; } localStorage.removeItem('hub.timer.notifyAsked'); } catch {} });
  await d.page.setViewportSize({ width: w, height: h });
  const f = await d.openApp('timer');
  await f.waitForFunction(() => window.__timer && __timer.isLive(), null, { timeout: 15000 }).catch(() => {});
  if (xxl) { await d.page.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl')); await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl')); }
  await clearAll(f); await sleep(500);
  const tag = `${prof}-${xxl ? 'xxl' : 'std'}-${w}`, s = {};
  s.idle = await f.evaluate(M); await d.shot(`${OUT}/${tag}-idle.png`);
  await f.click('#go'); await sleep(600); s.run = await f.evaluate(M); await d.shot(`${OUT}/${tag}-run.png`);
  if (s.run.x) { await f.evaluate(() => document.getElementById('notify-offer-no').click()); await sleep(400); s.offerGone = await f.evaluate(M); }
  if (prof !== 'ezra') { await f.click('#add', { timeout: 3000 }).catch(() => {}); await sleep(400); s.newOpen = await f.evaluate(M); await d.shot(`${OUT}/${tag}-new.png`); await f.evaluate(() => { const b = document.querySelector('#list .tm'); if (b) b.click(); }); await sleep(400); s.newClosed = await f.evaluate(M); }
  await f.click('#reset', { timeout: 3000 }).catch(() => {}); await sleep(500); s.reset = await f.evaluate(M); await d.shot(`${OUT}/${tag}-reset.png`);
  await clearAll(f); await f.evaluate(() => hub.timers.start({ total: 1500, label: 'Tea' })); await sleep(2700); s.ring = await f.evaluate(M);
  await f.click('#go'); await sleep(600); s.stopped = await f.evaluate(M);
  await clearAll(f); await sleep(300);
  await f.evaluate(() => { const n = hub.serverNow(); hub.timers.put({ id: 'b' + Math.round(n), label: 'Bread', total: 600000, startedAt: n - 780000, endAt: n - 180000 }, { fresh: true }); });
  await sleep(1500); s.unseen = await f.evaluate(M); await d.shot(`${OUT}/${tag}-unseen.png`);
  await f.click('#go'); await sleep(600); s.ok = await f.evaluate(M);
  await clearAll(f);
  const keys = Object.keys(s).filter(k => s[k] && s[k].go);
  console.log(`\n${tag}  go-top ${[...new Set(keys.map(k => s[k].go[1]))].join('/')}  go-w ${[...new Set(keys.map(k => s[k].go[2]))].join('/')}  dial ${[...new Set(keys.map(k => s[k].dial && s[k].dial[2]))].join('/')}  list-top ${[...new Set(keys.filter(k => s[k].list).map(k => s[k].list[1]))].join('/')}`);
  for (const k of keys) console.log('  ', k.padEnd(10), f1(s[k]));
  console.log('   unseen dial: anim', s.unseen.anim, '| shadow', s.unseen.shadow, '| wash', s.unseen.wash, '|| ring dial: anim', s.ring.anim, '| wash', s.ring.wash);
  await d.close();
}
await L.close();
