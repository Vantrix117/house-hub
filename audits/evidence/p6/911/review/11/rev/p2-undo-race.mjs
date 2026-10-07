// Reviewer probe 2: Reset + Undo across two devices WITHOUT a forced pull on the device that undoes (real life: the
// 30 s poll has not come round inside the 10 s toast). Case A: B taps + twice after the reset. Case B: B resets again.
import { local, sleep } from '../../hub-audit/audits/tools/lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const srv = async () => (await L.apiAs('eli', '/api/data/tally?scope=person')).body.items.map(i => i.key + '=' + JSON.stringify(i.value)).join('  ');
const shown = f => f.evaluate(() => document.getElementById('n').textContent);
try {
  const nd = await L.newDevice({ name: 'Rig phone B', profiles: ['eli'] });
  const A = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const B = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: nd });
  for (const kase of ['B taps +2 between reset and Undo', 'B resets again before Undo']) {
    const fa = await A.openApp('tally', { wait: '#plus' }); const fb = await B.openApp('tally', { wait: '#plus' });
    await fa.waitForFunction(() => !document.getElementById('n').classList.contains('skeleton')); await fb.waitForFunction(() => !document.getElementById('n').classList.contains('skeleton'));
    await sleep(1000);
    console.log(`\n## ${kase}\nstart A=${await shown(fa)} B=${await shown(fb)}`);
    await fa.locator('#reset').click(); await fa.evaluate(() => hub.flush());
    await fb.evaluate(() => hub.pull()); await sleep(300);
    console.log('after reset on A: A=', await shown(fa), 'B=', await shown(fb));
    if (kase.startsWith('B taps')) { await fb.locator('#plus').click(); await fb.locator('#plus').click(); }
    else { await fb.locator('#plus').click(); await fb.locator('#reset').click(); }
    await fb.evaluate(() => hub.flush()); await sleep(300);
    console.log('server before Undo:', await srv());
    // A has NOT pulled since its own reset (2-3 s ago); press the toast's Undo now
    const lastPullAgo = await fa.evaluate(() => Date.now() - hub.sync.lastPull);
    await fa.locator('#hub-toast .toast-act').click().catch(async () => { await A.page.locator('#hub-toast .toast-act').click(); });
    await sleep(300);
    const t = await fa.evaluate(() => { const t = document.getElementById('hub-toast'); return t ? t.textContent : ''; }).catch(() => '') || await A.page.evaluate(() => { const t = document.getElementById('hub-toast'); return t ? t.textContent : ''; });
    await fa.evaluate(() => hub.flush()); await fa.evaluate(() => hub.pull()); await fb.evaluate(() => hub.pull()); await sleep(500);
    console.log(`A last pulled ${lastPullAgo} ms before Undo; toast after Undo: "${t.trim()}"`);
    console.log('after Undo + sync: A=', await shown(fa), 'B=', await shown(fb));
    console.log('server after:', await srv());
  }
} finally { await L.close(); }
