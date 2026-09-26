// UX-DOLLYWOOD-6 skeptic s1: tick Mark done offline on the iPhone. Is anything on screen (app or shell) different from an
// online tick? Where is the shell's sync dot while the viewer is open? Then the consequence the person cannot see: a
// second device ticks online while the first is still offline, and the first reconnects. What does the server keep?
//   node audits/tools/phase5/ux-verify/UX-DOLLYWOOD-6/s1-offline.mjs
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p5/ux-verify/UX-DOLLYWOOD-6/s1');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const server = async (L) => { const r = await L.apiAs('eli', '/api/data/dollywood?scope=person&since=0'); const it = (r.body.items || []).find(i => i.key === 'progress'); const v = it && it.value; return { ticks: v ? Object.values(v).filter(Boolean).length : 0, keys: v ? Object.keys(v).filter(k => v[k]) : [] }; };
const waitCount = f => f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
const snap = async (d, f) => ({
  app: await f.evaluate(() => ({ count: document.getElementById('b-count').textContent, done: (document.getElementById('b-done') || {}).textContent, text: document.body.innerText })),
  shell: await d.page.evaluate(() => { const dot = document.getElementById('syncdot'), r = dot.getBoundingClientRect(), v = document.getElementById('viewer'), vr = v.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { dotClass: dot.className, dotRect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], viewerOn: v.classList.contains('on'), viewerRect: [Math.round(vr.left), Math.round(vr.top), Math.round(vr.width), Math.round(vr.height)], viewerZ: getComputedStyle(v).zIndex, dotCoveredByViewer: !!(top && v.contains(top)) || top === v,
      viewerTopbarText: (document.querySelector('#viewer header, #viewer .topbar, #viewer .vbar') || v).innerText.split('\n').slice(0, 4).join(' | '), toast: (document.querySelector('.toast') || {}).textContent || null }; }),
});
const words = t => (t.match(/offline|not synced|pending|queued|waiting|will sync|saved on this/gi) || []);
const CLOCK = process.argv[2] || 'real';
const L = await local({ variant: 'typical', engine: 'webkit', clock: CLOCK });
log('clock', CLOCK);
try {
  const seed = await server(L); log('seed', { ticks: seed.ticks });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const fp = await phone.openApp('dollywood', { wait: '#b-count' }); await waitCount(fp); await sleep(800);
  // online tick first (control), then untick it back online so the server is unchanged
  const onl0 = await snap(phone, fp);
  await fp.evaluate(() => document.getElementById('b-done').click()); await sleep(1500);
  const onl1 = await snap(phone, fp);
  log('online.tick', { before: onl0.app.count, after: onl1.app.count, words: words(onl1.app.text), shell: onl1.shell, sync: await fp.evaluate(() => ({ ...hub.sync })) });
  await phone.page.screenshot({ path: path.join(EV, 'iphone-online-tick-' + CLOCK + '.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  // go back to the step and untick it online
  await fp.evaluate(() => { document.getElementById('b-prev').click(); }); await sleep(300);
  await fp.evaluate(() => document.getElementById('b-done').click()); await sleep(1500);
  log('online.untickRestored', await server(L));
  // offline tick
  await phone.setOffline(true); await sleep(500);
  await fp.evaluate(() => document.getElementById('b-done').click()); await sleep(1500);
  const off1 = await snap(phone, fp);
  const offTicked = await fp.evaluate(() => Object.keys(doneMap).filter(k => doneMap[k]));
  log('offline.tick', { count: off1.app.count, words: words(off1.app.text), shell: off1.shell, sync: await fp.evaluate(() => ({ ...hub.sync })) });
  await phone.page.screenshot({ path: path.join(EV, 'iphone-offline-tick-' + CLOCK + '.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  // while the phone is offline, the same person ticks a different step on another device (desktop), online
  await sleep(1200);
  const pc = await L.device({ device: 'desktop', profile: 'eli', fixedTime: false });
  const fc = await pc.openApp('dollywood', { wait: '#b-count' }); await waitCount(fc); await sleep(800);
  const pcBefore = await fc.evaluate(() => document.getElementById('b-count').textContent);
  await fc.evaluate(() => { selectSection(D.steps.find(s => s.section !== 'entrance').section, false); curIdx = stepsOf(curSec).findIndex(s => !doneMap[s.id]); renderStep(); }); await sleep(300);
  await fc.evaluate(() => document.getElementById('b-done').click()); await sleep(1500);
  log('pc.tickWhilePhoneOffline', { pcEntranceCountSeen: pcBefore, server: await server(L) });
  await pc.close();
  // phone reconnects
  await phone.setOffline(false); await sleep(500);
  await fp.evaluate(() => hub.pull && hub.pull()); await sleep(3000);
  const s = await server(L);
  log('phone.reconnect', { server: s, phoneTickKept: offTicked.every(k => s.keys.includes(k)), phoneCount: await fp.evaluate(() => document.getElementById('b-count').textContent), sync: await fp.evaluate(() => ({ ...hub.sync })) });
  await phone.close();
} finally {
  fs.writeFileSync(path.join(EV, 'offline-' + CLOCK + '.json'), JSON.stringify(out, null, 1));
  await L.close();
}
