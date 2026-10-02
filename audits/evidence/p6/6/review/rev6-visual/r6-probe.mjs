// round 6: the redesigned Timer screen (jumps, fold, truncation, kid targets, focus) and the Home Undo toast vs the pill
import { local, sleep } from './wr6/audits/tools/lib/local.mjs';
import fs from 'node:fs';
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const ONLY = (process.argv[3] || 'app,focus,toast').split(',');
const L = await local({ variant: 'typical', clock: 'real' });
const clearAll = f => f.evaluate(async () => { for (const r of hub.timers.list({ stale: true })) { try { await hub.timers.clear(r.id, r.startedAt); } catch {} } });
const M = () => {
  const r = s => { const e = document.querySelector(s); if (!e || e.hidden || getComputedStyle(e).display === 'none') return null; const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom), Math.round(b.height)]; };
  const cut = s => { const e = document.querySelector(s); if (!e) return null; const x = e.querySelector('span') || e; return x.scrollWidth > x.clientWidth + 1 || e.scrollWidth > e.clientWidth + 1; };
  const iw = document.documentElement.clientWidth;
  const wide = [...document.querySelectorAll('main *')].filter(e => { const b = e.getBoundingClientRect(); return b.width && getComputedStyle(e).visibility !== 'hidden' && (b.right > iw + 0.5 || b.left < -0.5); }).map(e => e.id || e.className).slice(0, 4);
  const small = document.documentElement.dataset.kind === 'kid' ? [...document.querySelectorAll('main button, main input')].filter(b => b.offsetParent && getComputedStyle(b).visibility !== 'hidden').map(b => { const x = b.getBoundingClientRect(); return [b.id || b.dataset.s || b.dataset.r || b.textContent.trim().slice(0, 12), Math.round(x.width), Math.round(x.height)]; }).filter(([, w, h]) => w < 64 || h < 64) : [];
  return { dial: r('#dial'), go: r('#go'), list: r('#list'), pre: r('#presets'), goTxt: document.querySelector('#go .lbl').textContent, st: document.getElementById('tstate').innerText.trim(), stCut: cut('#tstate'), vh: innerHeight, sw: document.documentElement.scrollWidth > iw, wide, small };
};
const fmt = o => `dial ${o.dial} go ${o.go}(${o.goTxt}) list ${o.list} pre ${o.pre} st "${o.st}"${o.stCut ? ' CUT' : ''}${o.go && o.go[1] > o.vh ? ' BELOW-FOLD' : ''}${o.sw ? ' HSCROLL' : ''}${o.wide.length ? ' WIDE ' + o.wide : ''}${o.small.length ? ' SMALL ' + JSON.stringify(o.small) : ''}`;
if (ONLY.includes('app')) for (const prof of ['mom', 'ezra']) for (const xxl of [false, true]) for (const [dev, w, h] of [['iphone-pwa', 375, 667], ['iphone-pwa', 390, 844], ['ipad-portrait', 820, 1180], ['ipad-landscape', 1180, 820], ['desktop', 1440, 900]]) {
  const d = await L.device({ device: dev, profile: prof, fixedTime: false });
  await d.page.setViewportSize({ width: w, height: h });
  const f = await d.openApp('timer');
  await f.waitForFunction(() => window.__timer && __timer.isLive(), null, { timeout: 15000 }).catch(() => {});
  if (xxl) { await d.page.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl')); await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl')); }
  await clearAll(f); await sleep(500);
  const tag = `${prof}-${xxl ? 'xxl' : 'std'}-${w}`, s = {};
  s.idle = await f.evaluate(M); await d.shot(`${OUT}/${tag}-idle.png`);
  await f.click('#go'); await sleep(500); s.run = await f.evaluate(M); await d.shot(`${OUT}/${tag}-run.png`);
  if (prof !== 'ezra') {
    await f.click('#add', { timeout: 3000 }).catch(e => { s.addErr = e.message.slice(0, 50); }); await sleep(400); s.newOpen = await f.evaluate(M); await d.shot(`${OUT}/${tag}-new.png`);
    await f.click('#list .tm', { timeout: 3000 }).catch(e => { s.tmErr = e.message.slice(0, 50); }); await sleep(400); s.newClosed = await f.evaluate(M);
  }
  await f.click('#go'); await sleep(400); s.paused = await f.evaluate(M);
  await f.click('#go'); await sleep(300);
  await clearAll(f); await f.evaluate(() => hub.timers.start({ total: 1500, label: 'Tea' })); await sleep(2700); s.ring = await f.evaluate(M); await d.shot(`${OUT}/${tag}-ring.png`);
  await f.click('#go'); await sleep(600); s.stopped = await f.evaluate(M);
  await clearAll(f); await sleep(300);
  await f.evaluate(() => { const n = hub.serverNow(); hub.timers.put({ id: 'b' + Math.round(n), label: 'Bread', total: 600000, startedAt: n - 780000, endAt: n - 180000 }, { fresh: true }); });
  await sleep(1200); s.unseen = await f.evaluate(M); await d.shot(`${OUT}/${tag}-unseen.png`);
  await f.click('#go'); await sleep(600); s.ok = await f.evaluate(M);
  await clearAll(f);
  const keys = Object.keys(s).filter(k => s[k] && s[k].go);
  const goTops = [...new Set(keys.map(k => s[k].go[0]))], dials = [...new Set(keys.map(k => s[k].dial && s[k].dial[2]))];
  console.log(`\n${tag}  go-top ${goTops.join('/')}  dial-h ${dials.join('/')}${s.addErr ? ' addErr ' + s.addErr : ''}${s.tmErr ? ' tmErr ' + s.tmErr : ''}`);
  for (const k of keys) console.log('  ', k.padEnd(9), fmt(s[k]));
  await d.close();
}
if (ONLY.includes('focus')) {
  const d = await L.device({ device: 'desktop', profile: 'mom', fixedTime: false });
  const f = await d.openApp('timer');
  await f.waitForFunction(() => window.__timer && __timer.isLive(), null, { timeout: 15000 });
  await clearAll(f); await sleep(400);
  const tab = async (n, from) => { await f.focus(from); const seq = []; for (let i = 0; i < n; i++) { seq.push(await f.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return 'body'; const cs = getComputedStyle(a); const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none'; return `${a.id || a.dataset.s || a.dataset.sound || a.tagName}${a.hasAttribute('aria-expanded') ? '[exp=' + a.getAttribute('aria-expanded') + ']' : ''}${ring ? '' : ' NO-RING'}`; })); await d.page.keyboard.press('Tab'); } return seq.join(' > '); };
  console.log('\nfocus idle   ', await tab(16, '#go'));
  await f.click('#tsettings-btn'); await sleep(200);
  console.log('focus gear   ', await tab(8, '#tsettings-btn'));
  await f.click('#tsettings-btn'); await f.click('#custom-btn'); await sleep(200);
  console.log('focus custom ', await tab(10, '#custom-btn'));
  await f.click('#custom-btn'); await f.click('#go'); await sleep(400);
  console.log('focus running', await tab(6, '#go'));
  await f.click('#add'); await sleep(300);
  console.log('focus new    ', await tab(8, '#go'), '| active after New timer:', await f.evaluate(() => document.activeElement.dataset.s || document.activeElement.id));
  await clearAll(f); await d.close();
}
if (ONLY.includes('toast')) for (const [dev, w, h] of [['iphone-pwa', 375, 667], ['iphone-pwa', 390, 844], ['ipad-portrait', 820, 1180], ['ipad-landscape', 1180, 820]]) {
  const d = await L.device({ device: dev, profile: 'mom', fixedTime: false });
  await d.page.setViewportSize({ width: w, height: h });
  await d.goto('#home');
  await d.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull, null, { timeout: 10000 }).catch(() => {});
  await clearAll(d.page); await sleep(400);
  await d.page.evaluate(() => { hub.timers.start({ total: 900000, label: 'Soup' }); hub.timers.start({ total: 1500, label: 'Tea' }); });
  await sleep(2800);
  await d.page.evaluate(() => { const c = document.getElementById('home-timer'); if (c) c.scrollIntoView({ block: 'center' }); });
  await sleep(300);
  await d.page.click('#home-timer [data-timer-act="reset"]', { timeout: 4000 }).catch(e => console.log('reset click', e.message.slice(0, 60)));
  await sleep(500);
  const r = await d.page.evaluate(() => { const rect = e => { if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return b.width ? [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] : null; };
    const p = document.getElementById('timer-pill'), t = document.getElementById('hub-toast'), pr = rect(p), tr = rect(t);
    const ov = pr && tr && pr[0] < tr[2] && tr[0] < pr[2] && pr[1] < tr[3] && tr[1] < pr[3];
    const st = p.querySelector('.tp-stop'); let hit = null; if (st && !st.hidden && getComputedStyle(st).display !== 'none') { const b = st.getBoundingClientRect(); const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); hit = el ? (p.contains(el) ? 'pill' : el.closest('#hub-toast') ? 'TOAST' : el.tagName) : null; }
    return { pill: pr, pillText: p.hidden ? null : p.innerText.replace(/\s+/g, ' '), toast: tr, toastText: t && !t.hidden ? t.innerText.replace(/\s+/g, ' ') : null, overlap: ov, stopHit: hit }; });
  console.log('toast', w, JSON.stringify(r));
  await d.shot(`${OUT}/toast-${w}.png`);
  await clearAll(d.page); await d.close();
}
await L.close();
