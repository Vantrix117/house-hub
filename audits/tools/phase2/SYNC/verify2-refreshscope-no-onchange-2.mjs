// Skeptic #2 for SYNC/refreshscope-no-onchange: does hub.js refreshScope() (apps/hub.js:190-195) swallow a change so the
// F260 iframe keeps painting stale state? Instrumented: every storage event, f260 fetch and onChange in the phone's
// shell and iframe is timestamped, so the timeline shows which path (storage event vs refreshScope) won.
//   node "audits/tools/phase2/SYNC/verify2-refreshscope-no-onchange-2.mjs" <scenario>
// scenarios:
//   probe       replica of skeptic #1's probe (both offline, phone ticks, iPad ticks, iPad back, phone back via the rig's
//               sequential per-frame 'online' dispatch)
//   online-sync same, but the phone's 'online' reaches shell and iframe in one task (as WebKit does for a real reconnect)
//   race        all online: iPad ticks a day; the phone's shell pulls and the iframe's pull starts while the shell's
//               f260 GET is in flight (the iframe's 30 s timer landing mid-pull). Repeated; plus controls.
//   consequence race until the iframe is stale, wait out a 30 s poll, then tick another day on the phone and read the server
//   control     the same follow-on after a shell-only pull (the storage event reaches the iframe and onChange fires)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
import { EVID, shot } from './_util.mjs';

const SC = process.argv[2] || 'race';
const ENGINE = process.argv[3] || 'webkit';                    // optional 2nd arg: chromium
const out = { scenario: SC, engine: ENGINE, at: new Date().toISOString() };
const save = () => fs.writeFileSync(path.join(EVID, `verify2-refreshscope-${SC}${ENGINE === 'webkit' ? '' : '-' + ENGINE}.json`), JSON.stringify(out, null, 2));

const INSTR = tag => {
  window.__v2 = window.__v2 || [];
  const push = o => window.__v2.push({ at: Date.now(), who: tag, ...o });
  if (tag === 'frame') hub.onChange(e => push({ ev: 'change', app: e.app, key: e.key, bulk: !!e.bulk }));
  if (tag === 'frame') hub.onSync(s => push({ ev: 'sync', key: s.state + '/' + s.pending + '/onLine=' + navigator.onLine }));
  addEventListener('storage', e => { if (e.key && /^hub\.(cache|queue)\.f260\./.test(e.key)) push({ ev: 'storage', key: e.key.split('.').slice(0, 2).join('.') }); });
  addEventListener('online', () => { push({ ev: 'online' }); const t = Date.now(); setTimeout(() => push({ ev: 'timer0-fired', key: 'after ' + (Date.now() - t) + 'ms' }), 0); });
  const of = window.fetch;
  window.fetch = function (u, o) {
    const s = String(u); const p = of.apply(this, arguments);
    const m = /\/api\/data\/f260(\/batch)?\?/.exec(s);
    if (m) {
      const kind = m[1] ? 'POST' : 'GET';
      push({ ev: 'fetch-start', kind });
      if (tag === 'shell' && kind === 'GET' && window.__armed) {                    // start the iframe's pull right behind ours
        window.__armed = false;
        const w = [...document.querySelectorAll('iframe')].map(f => f.contentWindow).find(w => { try { return w.location.pathname.endsWith('/apps/f260.html'); } catch { return false; } });
        if (w && w.hub) { push({ ev: 'iframe-pull-kicked' }); w.hub.pull(); }
      }
      p.then(() => push({ ev: 'fetch-end', kind }), () => push({ ev: 'fetch-fail', kind }));
    }
    return p;
  };
};

async function setup(L) {
  const ph = await L.newDevice({ name: 'Eli phone (verify2)', profiles: ['eli'] });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const fi = await ipad.openApp('f260', { wait: '#todayDone' });
  const fp = await phone.openApp('f260', { wait: '#todayDone' });
  await sleep(4000);
  await fp.evaluate(INSTR, 'frame');
  await phone.page.evaluate(INSTR, 'shell');
  return { ipad, phone, fi, fp };
}
const drain = async (phone, fp) => {
  const a = await phone.page.evaluate(() => (window.__v2 || []).splice(0));
  const b = await fp.evaluate(() => (window.__v2 || []).splice(0));
  const all = [...a, ...b].sort((x, y) => x.at - y.at); const t0 = all.length ? all[0].at : 0;
  return all.map(r => ({ ...r, at: r.at - t0 }));
};
const state = (fp, phone, id) => fp.evaluate(id => ({
  frameStore: !!(hub.get('f260.done') || {})[id],
  frameUi: !!document.querySelector('[data-day="' + id + '"]') && document.querySelector('[data-day="' + id + '"]').classList.contains('done'),
}), id).then(async s => ({ ...s, shellStore: await phone.page.evaluate(id => !!(hub.get('f260.done', { app: 'f260' }) || {})[id], id) }));
const serverDone = async L => { const r = await L.apiAs('eli', '/api/data/f260?scope=person'); const it = (r.body.items || []).find(i => i.key === 'f260.done'); return it ? it.value : {}; };
const freeDays = (fi, n, visible = false) => fi.evaluate(([n, visible]) => { const all = [...document.querySelectorAll('[data-day]')].filter(e => !e.classList.contains('done')); const vis = all.filter(e => e.offsetParent !== null).map(e => e.dataset.day); const far = all.map(e => e.dataset.day).filter(id => +id.split('-')[0] > 40); return (visible ? [...vis, ...far.filter(i => !vis.includes(i))] : far).slice(0, n); }, [n, visible]);
const ipadTick = async (fi, id) => { await fi.evaluate(id => document.querySelector('[data-day="' + id + '"] .mark').click(), id); await sleep(1200); };

const L = await local({ variant: 'typical', clock: 'real', engine: ENGINE });
try {
  const { ipad, phone, fi, fp } = await setup(L);

  if (SC === 'probe' || SC === 'online-sync') {
    const idPhone = await fp.evaluate(() => document.getElementById('todayDone').dataset.target);
    const idIpad = (await freeDays(fi, 1))[0];
    await drain(phone, fp);
    await phone.setOffline(true); await ipad.setOffline(true);
    await fp.click('#todayDone'); await sleep(1100);
    await fi.evaluate(id => document.querySelector('[data-day="' + id + '"] .mark').click(), idIpad);
    await sleep(500);
    await ipad.setOffline(false); await sleep(2500);
    await drain(phone, fp);                                   // timeline from here on is the phone's reconnect
    if (SC === 'probe') await phone.setOffline(false);
    else {
      // lift the route and clear the flag through the harness, but swallow its per-frame 'online' events; then fire
      // 'online' in the shell and the iframe inside one task, as WebKit does for every frame of a page on reconnect
      const block = () => { window.__blockOnline = true; addEventListener('online', e => { if (window.__blockOnline) e.stopImmediatePropagation(); }, true); };
      await phone.page.evaluate(block); await fp.evaluate(block);
      await phone.setOffline(false);
      await phone.page.evaluate(() => {
        const w = [...document.querySelectorAll('iframe')].map(f => f.contentWindow).find(w => { try { return w.location.pathname.endsWith('/apps/f260.html'); } catch { return false; } });
        window.__blockOnline = false; w.__blockOnline = false;
        dispatchEvent(new Event('online')); w.dispatchEvent(new w.Event('online'));
      });
    }
    await sleep(4000);
    out.ids = { idPhone, idIpad };
    out.timeline = await drain(phone, fp);
    out.phone = { own: await state(fp, phone, idPhone), ipads: await state(fp, phone, idIpad) };
    out.server = await serverDone(L).then(d => ({ [idPhone]: !!d[idPhone], [idIpad]: !!d[idIpad] }));
    await sleep(35000);
    out.phoneAfter35s = { own: await state(fp, phone, idPhone), ipads: await state(fp, phone, idIpad) };
    out.timelineAfter = (await drain(phone, fp)).filter(r => r.ev !== 'fetch-start' && r.ev !== 'fetch-end');
  }

  if (SC === 'race' || SC === 'consequence' || SC === 'control') {
    const ids = await freeDays(fi, 14, SC !== 'race'); out.candidateIds = ids.slice();
    out.trials = [];
    const modes = SC === 'race'
      ? ['race', 'race', 'race', 'race', 'shell-only', 'shell-only', 'frame-only', 'race', 'race', 'race']
      : SC === 'control' ? ['shell-only'] : ['race', 'race', 'race', 'race', 'race', 'race'];
    for (const mode of modes) {
      const id = ids.shift();
      await drain(phone, fp);
      await ipadTick(fi, id);
      const srv = !!(await serverDone(L))[id];
      if (mode === 'race') await phone.page.evaluate(() => { window.__armed = true; hub.pull(); });
      if (mode === 'shell-only') await phone.page.evaluate(() => hub.pull());
      if (mode === 'frame-only') await fp.evaluate(() => hub.pull());
      await sleep(2500);
      const st = await state(fp, phone, id);
      const tl = await drain(phone, fp);
      const trial = { mode, id, serverHasIt: srv, ...st, stale: st.frameStore && !st.frameUi, changesInFrame: tl.filter(r => r.ev === 'change').length, timeline: tl };
      out.trials.push(trial); save();
      console.log(mode, id, JSON.stringify({ srv, ...st, changes: trial.changesInFrame }), tl.map(r => `${r.at}:${r.who}:${r.ev}${r.kind ? '/' + r.kind : ''}${r.key ? '/' + r.key : ''}`).join(' '));
      if ((SC === 'consequence' && trial.stale) || SC === 'control') {
        out.staleId = id;
        await fp.evaluate(id => document.querySelector('[data-day="' + id + '"]').scrollIntoView({ block: 'center' }), id);
        await fi.evaluate(id => document.querySelector('[data-day="' + id + '"]').scrollIntoView({ block: 'center' }), id);
        out.shotPhoneStale = await shot(phone.page, `verify2-refreshscope-${SC}-phone.png`);
        out.shotIpad = await shot(ipad.page, `verify2-refreshscope-${SC}-ipad-ticked.png`);
        await sleep(35000);                                   // both windows' 30 s polls run; nothing else changes
        out.after35s = { ...(await state(fp, phone, id)), changesInFrame: (await drain(phone, fp)).filter(r => r.ev === 'change').length };
        // the phone ticks a different day through its UI; F260 saves its in-memory done map
        const other = ids.shift();
        await fp.evaluate(id => document.querySelector('[data-day="' + id + '"] .mark').click(), other);
        await sleep(3000);
        const d = await serverDone(L);
        out.afterPhoneTick = { phoneTicked: other, serverHasPhoneTick: !!d[other], serverStillHasIpadTick: !!d[id] };
        await ipad.page.evaluate(() => hub.pull()); await fi.evaluate(() => hub.pull()); await sleep(2500);
        out.ipadAfter = await fi.evaluate(id => ({ store: !!(hub.get('f260.done') || {})[id], ui: document.querySelector('[data-day="' + id + '"]').classList.contains('done') }), id);
        await fi.evaluate(id => document.querySelector('[data-day="' + id + '"]').scrollIntoView({ block: 'center' }), id);
        out.shotIpadAfter = await shot(ipad.page, `verify2-refreshscope-${SC}-ipad-after-phone-tick.png`);
        break;
      }
    }
    out.summary = Object.fromEntries(['race', 'shell-only', 'frame-only'].map(m => [m, out.trials.filter(t => t.mode === m).map(t => t.stale ? 'STALE' : 'ok').join(',')]));
  }
  out.logs = { phone: phone.logs.filter(l => /error/i.test(l)).slice(0, 10), ipad: ipad.logs.filter(l => /error/i.test(l)).slice(0, 10) };
  save();
  console.log(JSON.stringify({ ...out, trials: undefined, timeline: undefined }, null, 1));
  if (out.timeline) console.log(out.timeline.map(r => `${r.at}:${r.who}:${r.ev}${r.kind ? '/' + r.kind : ''}${r.key ? '/' + r.key : ''}`).join('\n'));
} finally { await L.close(); }
