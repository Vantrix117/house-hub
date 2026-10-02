// visual reviewer: the Timer app — overflow with the custom pad / list / replace prompt, kid targets, focus order, aria-live
import { local, sleep } from './wr3/audits/tools/lib/local.mjs';
import fs from 'node:fs';
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const ONLY = (process.argv[3] || 'over,focus,live').split(',');
const L = await local({ variant: 'typical', clock: 'real' });
const over = () => {
  const iw = document.documentElement.clientWidth, bad = [];
  for (const e of document.querySelectorAll('main *')) { const b = e.getBoundingClientRect(); if (!b.width || getComputedStyle(e).visibility === 'hidden') continue; if (b.right > iw + 0.5 || b.left < -0.5) bad.push((e.id || (e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className) || e.tagName) + ':' + Math.round(b.left) + '-' + Math.round(b.right)); }
  const clipped = [...document.querySelectorAll('main .btn, main button')].filter(b => b.offsetParent && (b.scrollWidth > b.clientWidth + 1)).map(b => (b.id || b.textContent.trim().slice(0, 20)) + ' ' + b.scrollWidth + '>' + b.clientWidth);
  return { iw, sw: document.documentElement.scrollWidth, bad: bad.slice(0, 8), clipped: clipped.slice(0, 8) };
};
const clearAll = f => f.evaluate(async () => { const T = hub.timers; for (const r of T.list({ stale: true })) { try { await T.clear(r.id, r.startedAt); } catch {} } });
const startTwo = async f => { await clearAll(f); await f.evaluate(() => { const T = hub.timers; T.start({ total: 4 * 3600000 + 5000, label: 'Slow-roasted pork shoulder for Sunday dinner' }); T.start({ total: 720000, label: 'Pasta' }); }); };
const live = f => f.waitForFunction(() => window.__timer && __timer.isLive(), null, { timeout: 15000 }).catch(() => {});
const res = {};
if (ONLY.includes('over')) for (const prof of ['mom', 'ezra']) for (const xxl of [false, true]) for (const [w, h] of [[375, 667], [390, 844], [820, 1180], [1180, 820], [1440, 900]]) {
  const d = await L.device({ device: w >= 1024 ? (w === 1180 ? 'ipad-landscape' : 'desktop') : w >= 800 ? 'ipad-portrait' : 'iphone-pwa', profile: prof, fixedTime: false, localStorage: xxl ? { 'hub.prefs': { textSize: 'xxl' } } : null });
  await d.page.setViewportSize({ width: w, height: h });
  const f = await d.openApp('timer'); await live(f);
  if (xxl) { await d.page.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl')); await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl')); }
  await startTwo(f); await sleep(800);
  const tag = `${prof}-${xxl ? 'xxl' : 'std'}-${w}`;
  const r = { list: await f.evaluate(over) };
  await d.shot(`${OUT}/app-${tag}-two.png`);
  if (prof !== 'ezra') { await f.click('#custom-btn', { timeout: 3000 }).catch(() => {}); await sleep(300); r.custom = await f.evaluate(over); await f.evaluate(() => document.getElementById('custom').scrollIntoView({ block: 'center' })); await d.shot(`${OUT}/app-${tag}-custom.png`); await f.click('#custom-btn', { timeout: 3000 }).catch(() => {}); }
  await f.click('[data-s="300"]', { timeout: 3000 }).catch(e => { r.presetErr = e.message.slice(0, 80); }); await sleep(300);
  r.ask = await f.evaluate(over); r.askText = await f.evaluate(() => document.getElementById('ask').hidden ? null : document.getElementById('ask').innerText.replace(/\s+/g, ' '));
  await f.evaluate(() => document.getElementById('ask').scrollIntoView({ block: 'center' }));
  await d.shot(`${OUT}/app-${tag}-ask.png`);
  if (prof === 'ezra') r.small = await f.evaluate(() => [...document.querySelectorAll('button, input, [role=button]')].filter(b => b.offsetParent && getComputedStyle(b).visibility !== 'hidden').map(b => { const x = b.getBoundingClientRect(); return [b.id || b.dataset.s || b.dataset.r || b.textContent.trim().slice(0, 14), Math.round(x.width), Math.round(x.height)]; }).filter(([, w, h]) => w < 64 || h < 64));
  res[tag] = r; console.log(tag, JSON.stringify(r));
  await clearAll(f); await sleep(300);
  await d.close();
}
if (ONLY.includes('focus')) {
  const d = await L.device({ device: 'desktop', profile: 'mom', fixedTime: false });
  const f = await d.openApp('timer'); await live(f);
  await startTwo(f); await sleep(600);
  await f.focus('#go'); const seq = [];
  for (let i = 0; i < 26; i++) {
    seq.push(await f.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return 'body'; const cs = getComputedStyle(a); const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none'; const nm = a.getAttribute('aria-label') || a.textContent.trim().replace(/\s+/g, ' ').slice(0, 24) || a.id; return `${a.id || a.tagName}${a.getAttribute('aria-pressed') ? '[p=' + a.getAttribute('aria-pressed') + ']' : ''}"${nm}"${ring ? '' : ' NO-RING'}`; }));
    await d.page.keyboard.press('Tab');
  }
  res.focus = seq; console.log('focus', seq.join(' > '));
  res.names = await f.evaluate(() => [...document.querySelectorAll('button[aria-label]')].filter(b => b.offsetParent).map(b => [b.id, b.getAttribute('aria-label'), b.innerText.trim()]));
  console.log('names', JSON.stringify(res.names));
  await clearAll(f); await d.close();
}
if (ONLY.includes('live')) {
  const d = await L.device({ device: 'ipad-portrait', profile: 'mom', fixedTime: false });
  const f = await d.openApp('timer'); await live(f);
  await clearAll(f); await sleep(500);
  await f.evaluate(() => { window.__said = []; const el = document.getElementById('live'); new MutationObserver(() => { const t = el.textContent; if (t) __said.push([Math.round(performance.now() / 100) / 10, t]); }).observe(el, { childList: true, characterData: true, subtree: true }); });
  await f.evaluate(() => { document.getElementById('custom-btn').click(); document.getElementById('cm').value = '1'; document.getElementById('cs').value = '13'; document.getElementById('cset').click(); });
  await sleep(300); await f.click('#go'); await sleep(76000);
  res.live = await f.evaluate(() => __said); console.log('live', JSON.stringify(res.live));
  await d.shot(`${OUT}/app-live-ended.png`);
  res.endedDom = await f.evaluate(() => ({ tstate: document.getElementById('tstate').innerText, tstateIcon: !!document.querySelector('#tstate svg use[href*="bell"]'), go: document.getElementById('go').innerText, anim: getComputedStyle(document.getElementById('dial')).animationName }));
  console.log('ended', JSON.stringify(res.endedDom));
  await clearAll(f); await d.close();
  const d2 = await L.device({ device: 'ipad-portrait', profile: 'mom', fixedTime: false, localStorage: { 'hub.prefs': { motion: 'reduce' } } });
  const f2 = await d2.openApp('timer'); await live(f2); await f2.evaluate(() => document.documentElement.setAttribute('data-motion', 'reduce'));
  await clearAll(f2); await f2.evaluate(() => hub.timers.start({ total: 1500, label: 'Bread' }));
  await sleep(2500);
  res.rm = await f2.evaluate(async () => { const d = document.getElementById('dial'); const s = []; for (let i = 0; i < 12; i++) { s.push(getComputedStyle(d).transform); await new Promise(r => setTimeout(r, 100)); } return { motion: document.documentElement.dataset.motion, transforms: [...new Set(s)], tstate: document.getElementById('tstate').innerText, opacity: getComputedStyle(document.getElementById('t')).opacity }; });
  console.log('reduce-motion', JSON.stringify(res.rm));
  await d2.shot(`${OUT}/app-rm-ringing.png`);
  await clearAll(f2); await d2.close();
}
fs.writeFileSync(`${OUT}/app-${ONLY.join('_')}.json`, JSON.stringify(res, null, 1));
await L.close();
