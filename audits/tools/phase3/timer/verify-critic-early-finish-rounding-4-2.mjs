// Skeptic #2 for critic-early-finish-rounding-4: does the Kitchen timer reach 0:00 / done / beep before endAt, and does
// each digit change early, because step() rounds (apps/timer.html:108-109)? Unlike the investigator's script this uses
// the REAL browser clock (no installClock, no 50 ms stepping), so tick phase and timer lateness are what a device sees.
// A MutationObserver inside the page stamps every #t text change and the body 'done' class with Date.now().
// Part A: standalone apps/timer.html as Eli, 1 min preset -> Start, wait ~62 s, in WebKit and Chromium.
// Part B: the shell pill (index.html:815-821) with the app closed: a 6 s timer.active written via the shell's hub.set,
//         stamp every #timer-pill-time change and the moment the row is cleared.
// Run: node "audits/tools/phase3/timer/verify-critic-early-finish-rounding-4-2.mjs"
//   -> audits/evidence/p3/timer/verify-critic-early-finish-rounding-4-2.json
import { local, sleep } from '../../lib/local.mjs';
import { save, audioProbe } from './_util.mjs';

const out = { method: 'real browser clock; MutationObserver stamps in-page Date.now()' };

async function partA(engine) {
  const L = await local({ variant: 'typical', clock: 'real', engine });
  try {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    await audioProbe(d.ctx);
    const p = d.page;
    await p.goto(L.site + '/apps/timer.html', { waitUntil: 'load' });
    await p.waitForFunction(() => typeof document.getElementById('go').onclick === 'function', null, { timeout: 20000 });
    await p.click('[data-s="60"]');
    await p.evaluate(() => {
      const log = window.__log = [];
      const t = document.getElementById('t');
      new MutationObserver(() => log.push({ at: Date.now(), t: t.textContent })).observe(t, { childList: true, characterData: true, subtree: true });
      new MutationObserver(() => { if (document.body.classList.contains('done') && !window.__done) window.__done = { at: Date.now(), beeps: window.__audio ? window.__audio.osc : null }; })
        .observe(document.body, { attributes: true, attributeFilter: ['class'] });
    });
    await p.click('#go');
    const a = await p.evaluate(() => hub.get('timer.active'));
    await sleep(62500);
    const r = await p.evaluate(() => ({ log: window.__log, done: window.__done || null, t: document.getElementById('t').textContent }));
    const start = a.endAt - 60000;
    const firstAt = txt => { const e = r.log.find(x => x.t === txt); return e ? e.at - start : null; };
    const res = {
      engine, total: a.total,
      first59_msAfterStart: firstAt('0:59'),
      first58_msAfterStart: firstAt('0:58'),
      first0_01_msBeforeEnd: (() => { const e = r.log.find(x => x.t === '0:01'); return e ? a.endAt - e.at : null; })(),
      zero_msBeforeEnd: (() => { const e = r.log.find(x => x.t === '0:00'); return e ? a.endAt - e.at : null; })(),
      done_msBeforeEnd: r.done ? a.endAt - r.done.at : null,
      oscillatorStartsAtDone: r.done ? r.done.beeps : null,
      finalText: r.t,
      distinctChanges: r.log.filter((x, i, arr) => i === 0 || arr[i - 1].t !== x.t).length,
    };
    return res;
  } finally { await L.close(); }
}

async function partB() {
  const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
  try {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    const p = d.page;
    await p.goto(L.site + '/#home', { waitUntil: 'load' });
    await p.waitForFunction(() => window.hub && hub.profile, null, { timeout: 20000 });
    await sleep(1500);
    const a = await p.evaluate(() => {
      const log = window.__plog = [];
      const el = document.getElementById('timer-pill-time');
      new MutationObserver(() => log.push({ at: Date.now(), t: el.textContent })).observe(el, { childList: true, characterData: true, subtree: true });
      const pill = document.getElementById('timer-pill');
      if (pill) new MutationObserver(() => log.push({ at: Date.now(), hidden: pill.hidden })).observe(pill, { attributes: true, attributeFilter: ['hidden'] });
      const origRemove = hub.remove.bind(hub);
      hub.remove = (...x) => { if (x[0] === 'timer.active') window.__cleared = Date.now(); return origRemove(...x); };
      const now = Date.now();
      const v = { endAt: now + 6000, total: 6, startedAt: now };
      hub.set('timer.active', v, { app: 'timer', scope: 'person' });
      document.dispatchEvent(new Event('visibilitychange'));   // the shell's own re-render hook (index.html:826)
      return v;
    });
    await sleep(8500);
    const r = await p.evaluate(() => ({ log: window.__plog, cleared: window.__cleared || null }));
    return {
      endAt: a.endAt,
      changes: r.log.map(x => ({ msToEnd: a.endAt - x.at, ...(x.t != null ? { t: x.t } : { hidden: x.hidden }) })),
      cleared_msBeforeEnd: r.cleared ? a.endAt - r.cleared : null,
    };
  } finally { await L.close(); }
}

out.A = [];
for (const eng of ['webkit', 'chromium']) {
  try { out.A.push(await partA(eng)); } catch (e) { out.A.push({ engine: eng, error: String(e) }); }
  console.log('A', JSON.stringify(out.A.at(-1)));
}
try { out.B = await partB(); } catch (e) { out.B = { error: String(e) }; }
console.log('B', JSON.stringify(out.B));
console.log('saved', save('verify-critic-early-finish-rounding-4-2.json', out));
