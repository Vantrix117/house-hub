// Skeptic #1 (verify2) for SYNC "refreshscope-no-onchange": does hub.js refreshScope() swallow a change the app is never told about?
//   node "audits/tools/phase2/SYNC/verify2-refreshscope-no-onchange-1.mjs"            baseline (repo hub.js), long wait
//   node "audits/tools/phase2/SYNC/verify2-refreshscope-no-onchange-1.mjs" --cf       counterfactual: overlay hub.js whose refreshScope
//                                                                                    fires a bulk onChange when the re-read differs
//   --runs N (default 1)   --wait S (seconds to watch after reconnect, default 70: past two 30 s polls)   --engine chromium
// Scenario (same as the b2probe): Eli's phone and the iPad both offline; the phone ticks Today "Done", the iPad ticks another day;
// the iPad reconnects first, then the phone. The phone's F260 frame is instrumented: every read of the f260 cache/queue key
// (with the calling hub.js function from the stack), every storage event on it, every /api/data fetch, every onChange.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
import { ROOT, EVID, writeEvidence } from './_util.mjs';

const argv = process.argv.slice(2);
const CF = argv.includes('--cf');
const RUNS = +(argv[argv.indexOf('--runs') + 1] || 0) || 1;
const WAIT = +(argv[argv.indexOf('--wait') + 1] || 0) || 70;
const ENGINE = argv.includes('--engine') ? argv[argv.indexOf('--engine') + 1] : 'webkit';

let overlay;
if (CF) {
  // Build the counterfactual overlay from the repo's hub.js (read only): refreshScope() emits a bulk change when the store it
  // re-reads differs from the one it replaces. Nothing else changes.
  const src = fs.readFileSync(path.join(ROOT, 'apps', 'hub.js'), 'utf8');
  const from = "    if (c && c.items) store[ch] = c;\n";
  if (!src.includes(from)) throw new Error('refreshScope anchor not found');
  const to = "    if (c && c.items) { const sig = it => JSON.stringify(Object.keys(it).sort().map(k => [k, it[k].t, it[k].v])); const before = sig((store[ch] || {}).items || {}); store[ch] = c;\n" +
    "      if (sig(c.items) !== before) for (const cb of listeners.change) { try { cb({ app, scope, key: null, value: null, updated_at: 0, remote: true, bulk: true, cf: 'refreshScope' }); } catch (e) { console.error(e); } } }\n";
  const dir = path.join(ROOT, 'audits', 'tools', 'phase2', 'SYNC', 'overlay-verify2-refreshscope', 'apps');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'hub.js'), src.replace(from, to));
  overlay = 'audits/tools/phase2/SYNC/overlay-verify2-refreshscope';
}

const instrument = ([id, T0, who]) => {
  const T = () => Date.now() - T0;                       // one wall-clock base for the shell and the frame
  window.__tr = [];
  const push = o => window.__tr.push({ t: T(), who, ...o });
  const CK = 'hub.cache.f260.person.eli', QK = 'hub.queue.f260.person.eli';
  const hasTick = raw => { try { const o = JSON.parse(raw); const it = o && o.items && o.items['f260.done']; return { tick: !!(it && it.v && it.v[id]), rowT: it && it.t }; } catch { return null; } };
  const og = Storage.prototype.getItem;
  Storage.prototype.getItem = function (k) {
    const v = og.call(this, k);
    if (k === CK || k === QK) {
      const fn = (new Error().stack || '').split('\n').slice(1, 4).map(s => (s.split('@')[0] || '?')).filter(Boolean).join('<');
      push({ ev: 'read', k: k === CK ? 'cache' : 'queue', ...(k === CK ? hasTick(v) : { keys: Object.keys(JSON.parse(v || '{}')) }), fn });
    }
    return v;
  };
  addEventListener('storage', ev => { if (ev.key === CK) push({ ev: 'storage(cache)', ...hasTick(ev.newValue), storeTickAfterHandler: !!(hub.get('f260.done') || {})[id] }); if (ev.key === QK) push({ ev: 'storage(queue)', keys: Object.keys(JSON.parse(ev.newValue || '{}')) }); });
  const of = window.fetch;
  window.fetch = async function (u, o) {
    const p = String(u).replace(/^https?:\/\/[^/]+/, '').slice(0, 70); const m = (o && o.method) || 'GET';
    push({ ev: 'fetch>', m, p });
    const r = await of.apply(this, arguments);
    push({ ev: 'fetch<', m, p, status: r.status });
    return r;
  };
  hub.onChange(e => push({ ev: 'onChange', key: e.key, bulk: !!e.bulk, cf: e.cf || null }));
  hub.onSync(s => push({ ev: 'sync', state: s.state, pending: s.pending }));
};

const results = [];
for (let run = 1; run <= RUNS; run++) {
  const L = await local({ variant: 'typical', clock: 'real', engine: ENGINE, ...(overlay ? { overlay } : {}) });
  try {
    const ph = await L.newDevice({ name: 'Eli phone (verify2)', profiles: ['eli'] });
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    const fi = await ipad.openApp('f260', { wait: '#todayDone' });
    const fp = await phone.openApp('f260', { wait: '#todayDone' });
    await sleep(4000);
    const idPhone = await fp.evaluate(() => document.getElementById('todayDone').dataset.target);
    const idIpad = await fi.evaluate(p => { const d = [...document.querySelectorAll('[data-day]')].find(e => e.dataset.day !== p && !e.classList.contains('done') && e.querySelector('.mark')); return d && d.dataset.day; }, idPhone);
    const T0 = Date.now();
    await fp.evaluate(instrument, [idPhone, T0, 'frame']);
    await phone.page.evaluate(instrument, [idPhone, T0, 'shell']);
    const overlayActive = await fp.evaluate(async () => (await (await fetch('hub.js', { cache: 'no-store' })).text()).includes("cf: 'refreshScope'"));
    const before = await L.apiAs('eli', '/api/data/f260?scope=person&key=f260.done');
    await phone.setOffline(true); await ipad.setOffline(true);
    await fp.click('#todayDone'); await sleep(1100);
    await fi.evaluate(id => document.querySelector('[data-day="' + id + '"] .mark').click(), idIpad);
    await sleep(500);
    const offlineState = await fp.evaluate(id => ({ store: !!(hub.get('f260.done') || {})[id], ui: document.querySelector('[data-day="' + id + '"]').classList.contains('done') }), idPhone);
    await fp.evaluate(T0 => window.__tr.push({ t: Date.now() - T0, ev: '--- iPad reconnects ---' }), T0);
    await ipad.setOffline(false); await sleep(2500);
    await fp.evaluate(T0 => window.__tr.push({ t: Date.now() - T0, ev: '--- phone reconnects ---' }), T0);
    await phone.setOffline(false);
    const probe = async () => fp.evaluate(([id, other]) => ({
      store: !!(hub.get('f260.done') || {})[id], ui: document.querySelector('[data-day="' + id + '"]').classList.contains('done'),
      storeOther: !!(hub.get('f260.done') || {})[other], uiOther: document.querySelector('[data-day="' + other + '"]').classList.contains('done'),
      sync: hub.sync.state, busy: !!document.querySelector('.modal.on, .sheet.on'),
    }), [idPhone, idIpad]);
    await sleep(4000);
    const at4s = await probe();
    const server = await L.apiAs('eli', '/api/data/f260?scope=person&key=f260.done');
    const srvItem = server.body && (server.body.item || server.body);
    const serverTick = !!(srvItem && srvItem.value && srvItem.value[idPhone]);
    const serverOther = !!(srvItem && srvItem.value && srvItem.value[idIpad]);
    const trace = [...await fp.evaluate(() => window.__tr), ...await phone.page.evaluate(() => window.__tr)].sort((a, b) => a.t - b.t);
    let later = null;
    if (run === 1 && WAIT > 4) { await sleep((WAIT - 4) * 1000); later = await probe(); }
    const tag = (CF ? 'cf' : 'base') + (ENGINE === 'webkit' ? '' : '-' + ENGINE) + '-run' + run;
    const pngPath = path.join(EVID, `verify2-refreshscope-${tag}-phone.png`);
    await phone.page.screenshot({ path: pngPath, scale: 'css', animations: 'disabled', caret: 'hide' });
    const traceTail = await fp.evaluate(() => window.__tr.slice(-14));
    // Follow-on: the phone, still painting its stale map, ticks one more (untouched) day. F260 saves its whole in-memory `done`
    // map (apps/f260.html save(K.done, done)). Does the iPad's tick survive on the server?
    const idNext = await fp.evaluate(ex => { const d = [...document.querySelectorAll('[data-day]')].find(e => !ex.includes(e.dataset.day) && !e.classList.contains('done') && e.querySelector('.mark')); if (!d) return null; d.querySelector('.mark').click(); return d.dataset.day; }, [idPhone, idIpad]);
    await sleep(3000);
    const s2 = await L.apiAs('eli', '/api/data/f260?scope=person&key=f260.done');
    const s2Item = s2.body && (s2.body.item || s2.body);
    const followOn = { idNext, server: { phoneTick: !!(s2Item && s2Item.value && s2Item.value[idPhone]), ipadTick: !!(s2Item && s2Item.value && s2Item.value[idIpad]), nextTick: !!(s2Item && s2Item.value && s2Item.value[idNext]) } };
    const png2 = path.join(EVID, `verify2-refreshscope-${tag}-phone-after-next-tick.png`);
    await phone.page.screenshot({ path: png2, scale: 'css', animations: 'disabled', caret: 'hide' });
    const changesAfterReconnect = trace.slice(trace.findIndex(x => x.ev === '--- phone reconnects ---')).filter(x => x.ev === 'onChange' && x.who === 'frame');
    const r = { run, overlay: !!overlay, overlayActive, idPhone, idIpad, serverBefore: before.status, offlineState, at4s, serverTick, serverOther, later, afterSeconds: later ? WAIT : null, changesAfterReconnect, followOn, trace, traceTailAtEnd: traceTail, png: path.relative(ROOT, pngPath).split(path.sep).join('/'), logs: phone.logs.filter(l => /error/i.test(l)).slice(0, 10) };
    results.push(r);
    console.log(`run ${run} ${CF ? '(counterfactual)' : '(baseline)'}: overlayActive=${overlayActive} ids phone=${idPhone} ipad=${idIpad}`);
    console.log('  offline:', JSON.stringify(offlineState));
    console.log('  4 s after phone reconnect:', JSON.stringify(at4s), 'server has phone tick:', serverTick, 'server has iPad tick:', serverOther);
    if (later) console.log(`  ${WAIT} s after:`, JSON.stringify(later));
    console.log('  follow-on tick on the phone:', JSON.stringify(followOn));
    console.log('  onChange in frame after phone reconnect:', JSON.stringify(changesAfterReconnect));
    console.log('  trace from iPad reconnect:');
    for (const x of trace.slice(trace.findIndex(x => x.ev === '--- iPad reconnects ---'))) console.log('    ' + JSON.stringify(x));
  } finally { await L.close(); }
}
const ev = writeEvidence(`verify2-refreshscope-no-onchange-1${CF ? '-cf' : ''}${ENGINE === 'webkit' ? '' : '-' + ENGINE}.json`, { cmd: 'node audits/tools/phase2/SYNC/verify2-refreshscope-no-onchange-1.mjs ' + argv.join(' '), results });
console.log('evidence:', ev);
