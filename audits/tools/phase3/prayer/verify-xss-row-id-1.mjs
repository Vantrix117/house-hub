// Skeptic #1 for "xss-row-id": stored XSS through a family prayer row's value.id, and whether that row breaks later saves.
// Independent re-run on a fresh local instance (no production, throwaway demo data).
// 1. As Ezra (kid) write ONE family row prayer:vx1 whose value.id carries an attribute-breaking payload.
//    The payload only bumps a counter and records the LENGTH of localStorage 'hub.session' (never the value).
// 2. Kiara (kid, iPad) opens Prayer: count executions; then taps "Prayed" on a genuine family card; does it reach the server?
// 3. Eli (admin, iPhone) opens Prayer, taps Family: page errors? repaint? count executions after a nav repaint;
//    then ticks a genuine family prayer; does it reach the server, and does the row show as ticked?
// 4. Control: same flow with a benign id (no payload) to show the tick does persist normally.
// Run: node "audits/tools/phase3/prayer/verify-xss-row-id-1.mjs" -> audits/evidence/p3/prayer/verify-xss-row-id-1.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const res = {};
const TODAY = (() => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); })();

async function run(label, id) {
  const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
  const r = res[label] = {};
  try {
    const value = { id, title: 'Verify row ' + label, for: '', phone: '', detail: '', category: 'Family', cadence: 'daily', days: [], status: 'active',
      createdAt: '2026-09-01', lastPrayedAt: null, answeredAt: null, answerNote: null, updates: [], sharedFrom: null, prayedBy: {}, updatedAt: new Date().toISOString() };
    const w = await L.apiAs('ezra', '/api/data/prayer/batch?scope=family', { method: 'POST', body: { items: [{ key: 'prayer:vx1', value, updated_at: Date.now() }] } });
    r.writeAsEzra = { status: w.status, applied: w.body && w.body.results && w.body.results[0] && w.body.results[0].applied };
    console.log(label, 'write as ezra ->', w.status, 'applied', r.writeAsEzra.applied);

    const server = async () => { const g = await L.apiAs('eli', '/api/data/prayer?scope=family'); return (g.body.items || g.body.rows || g.body || []); };
    const rowOf = (items, key) => (Array.isArray(items) ? items : Object.values(items)).find(x => x.key === key);

    // Kiara (kid)
    {
      const d = await L.device({ device: 'ipad-portrait', profile: 'kiara', fixedTime: false });
      const f = await d.openApp('prayer', { wait: '#todayLine' });
      await sleep(2500);
      const s = await f.evaluate(() => ({ exec: window.__vx || 0, sessLen: window.__vxLen ?? null,
        keys: hub.list('prayer:', { scope: 'family' }).map(r => r.key),
        kprayIds: [...document.querySelectorAll('[data-kpray]')].map(b => b.dataset.kpray.slice(0, 20)) }));
      r.kiaraOnOpen = s;
      // tap Prayed on the first genuine card
      const target = s.kprayIds.find(x => !x.startsWith('vx1'));
      d.logs.length = 0;
      if (target) await f.click(`[data-kpray="${target}"]`);
      await sleep(3500);
      const after = await f.evaluate(t => ({ pressed: document.querySelector(`[data-kpray="${t}"]`)?.getAttribute('aria-pressed'), sync: hub.sync.state }), target);
      const it = rowOf(await server(), 'prayer:' + target);
      r.kiaraTick = { target, uiPressed: after.pressed, sync: after.sync, serverLastPrayedAt: it && it.value && it.value.lastPrayedAt,
        serverPrayedByToday: it && it.value && it.value.prayedBy && it.value.prayedBy[TODAY], pageErrors: d.logs.filter(l => l.startsWith('pageerror')).map(l => l.slice(0, 120)) };
      console.log(label, 'kiara open:', JSON.stringify({ exec: s.exec, sessLen: s.sessLen, keyOrder: s.keys }), '\n  kiara tick:', JSON.stringify(r.kiaraTick));
      await d.close();
    }
    // Eli (admin)
    {
      const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
      const f = await d.openApp('prayer', { wait: '#todayLine' });
      await sleep(2500);
      r.eliOnOpen = await f.evaluate(() => ({ exec: window.__vx || 0 }));
      d.logs.length = 0;
      await f.click('#listSwitch [data-list="shared"]'); await sleep(1200);
      r.eliAfterFamilyTap = await f.evaluate(() => ({ exec: window.__vx || 0, activeList: D.activeList,
        pressedTab: document.querySelector('#listSwitch [aria-pressed="true"]').dataset.list }));
      r.eliAfterFamilyTap.pageErrors = d.logs.filter(l => l.startsWith('pageerror')).map(l => l.slice(0, 120));
      await f.click('nav [data-go="today"]'); await sleep(1000);
      r.eliAfterRepaint = await f.evaluate(() => ({ exec: window.__vx || 0, sessLen: window.__vxLen ?? null, liveOnerror: document.querySelectorAll('img[onerror]').length,
        prayIds: [...document.querySelectorAll('[data-pray]')].map(b => b.dataset.pray.slice(0, 20)) }));
      const target = r.eliAfterRepaint.prayIds.find(x => !x.startsWith('vx1'));
      d.logs.length = 0;
      if (target) await f.click(`[data-pray="${target}"]`);
      await sleep(3500);
      const ui = await f.evaluate(t => ({ pressed: document.querySelector(`[data-pray="${t}"]`)?.getAttribute('aria-pressed'), sync: hub.sync.state,
        localLastPrayedAt: (D.lists.shared.prayers.find(p => p.id === t) || {}).lastPrayedAt }), target);
      const it = rowOf(await server(), 'prayer:' + target);
      r.eliTick = { target, ...ui, serverLastPrayedAt: it && it.value && it.value.lastPrayedAt, pageErrors: d.logs.filter(l => l.startsWith('pageerror')).map(l => l.slice(0, 120)) };
      console.log(label, 'eli open:', JSON.stringify(r.eliOnOpen), '\n  after Family tap:', JSON.stringify(r.eliAfterFamilyTap), '\n  after nav repaint:', JSON.stringify({ ...r.eliAfterRepaint, prayIds: undefined }), '\n  eli tick:', JSON.stringify(r.eliTick));
      if (label === 'payload') await d.page.screenshot({ path: `${OUT}/verify-xss-row-id-1-eli-after-tick.png`, scale: 'css' }).catch(e => console.log('shot failed', String(e)));
      await d.close();
    }
  } catch (e) { console.error(e); r.error = String(e.stack || e); }
  finally { await L.close(); }
}

await run('payload', 'vx1"><img src="x:" onerror="window.__vx=(window.__vx||0)+1;window.__vxLen=(localStorage.getItem(\'hub.session\')||\'\').length"><i x="');
await run('control', 'vx1');
fs.writeFileSync(`${OUT}/verify-xss-row-id-1.json`, JSON.stringify({ today: TODAY, ...res }, null, 1));
console.log('wrote', `${OUT}/verify-xss-row-id-1.json`);
