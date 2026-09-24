// Skeptic #2 for "xss-row-id": a family prayer row whose value.id carries markup runs script inside Prayer.
// Independent of xss-id.mjs: different writer (a seeded guest, falling back to Ezra), different engine by default
// (Chromium; ENGINE=webkit to switch), different payload (it records only the *lengths* of hub.session / hub.device,
// never the values), and it also checks what the thrown save() does to a tick on an ordinary family row.
// Run: node "audits/tools/phase3/prayer/verify-xss-row-id-2.mjs" -> audits/evidence/p3/prayer/verify-xss-row-id-2.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const ENGINE = process.env.ENGINE || 'chromium';
const L = await local({ variant: 'typical', clock: 'real', engine: ENGINE });
const res = { engine: ENGINE };
const count = f => f.evaluate(() => ({ runs: window.__v2 || 0, sessionLen: window.__v2s ?? null, deviceLen: window.__v2d ?? null,
  liveNodes: document.querySelectorAll('img[onerror]').length }));
try {
  const payload = 'vv2"><img src="x:" onerror="window.__v2=(window.__v2||0)+1;window.__v2s=(localStorage.getItem(\'hub.session\')||\'\').length;window.__v2d=(localStorage.getItem(\'hub.device\')||\'\').length"><i x="';
  const value = { id: payload, title: 'Safe travels for the cousins', for: '', phone: '', detail: '', category: 'Family', cadence: 'daily',
    days: [], status: 'active', createdAt: '2026-09-10', lastPrayedAt: null, answeredAt: null, answerNote: null, updates: [],
    sharedFrom: null, prayedBy: {}, updatedAt: new Date().toISOString() };
  const body = { items: [{ key: 'prayer:vv2', value, updated_at: Date.now() }] };
  for (const writer of ['guest-grandmajo', 'ezra']) {
    let w; try { w = await L.apiAs(writer, '/api/data/prayer/batch?scope=family', { method: 'POST', body }); } catch (e) { w = { status: 'threw', body: String(e) }; }
    res.write = { writer, status: w.status, applied: w.body && w.body.results && w.body.results[0] && w.body.results[0].applied };
    console.log('write as', writer, '->', w.status, JSON.stringify(res.write));
    if (w.status === 200) break;
  }

  // 1. Kiara (kid): Prayer opens straight on the family list.
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'kiara', fixedTime: false });
    const f = await d.openApp('prayer', { wait: '#todayLine' }); await sleep(2500);
    res.kiara = await count(f);
    res.kiara.pageErrors = d.logs.filter(l => l.startsWith('pageerror')).map(l => l.slice(0, 100));
    console.log('kiara on open:', JSON.stringify(res.kiara));
    await d.close();
  }

  // 2. Eli (admin): personal list first, then Family, then a tick on an ordinary family row.
  {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const f = await d.openApp('prayer', { wait: '#todayLine' }); await sleep(2500);
    res.eli = { onOpen: await count(f) };
    await f.click('#listSwitch [data-list="shared"]'); await sleep(1200);
    res.eli.afterFamilyTap = await count(f);
    res.eli.afterFamilyTap.errors = d.logs.filter(l => l.startsWith('pageerror')).map(l => l.slice(0, 100));
    res.eli.afterFamilyTap.headerPressed = await f.evaluate(() => document.querySelector('#listSwitch [aria-pressed="true"]').dataset.list);
    await f.click('nav [data-go="today"]'); await sleep(1200);
    res.eli.afterNavToday = await count(f);
    const order = await f.evaluate(() => D.lists.shared.prayers.map(p => p.id.slice(0, 6)));
    res.eli.familyOrder = order;
    // An ordinary family row, tick it
    const target = await f.evaluate(() => { const p = D.lists.shared.prayers.find(p => /^[A-Za-z0-9_-]+$/.test(p.id) && p.lastPrayedAt !== TODAY && p.status === 'active'); return p && { id: p.id, title: p.title }; });
    res.eli.tickTarget = target;
    const errsBefore = d.logs.filter(l => l.startsWith('pageerror')).length;
    if (target) {
      await f.evaluate(id => { const b = document.querySelector('[data-pray="' + id + '"]'); b && b.click(); }, target.id); await sleep(1500);
      res.eli.tick = await f.evaluate(id => ({ modelLastPrayedAt: (D.lists.shared.prayers.find(p => p.id === id) || {}).lastPrayedAt, TODAY,
        buttonPressed: (document.querySelector('[data-pray="' + id + '"]') || {}).getAttribute?.('aria-pressed') }), target.id);
      res.eli.tick.newErrors = d.logs.filter(l => l.startsWith('pageerror')).slice(errsBefore).map(l => l.slice(0, 100));
      await sleep(4000);                                   // let hub.js flush
      const srv = await L.apiAs('eli', '/api/data/prayer?scope=family');
      const items = (srv.body && (srv.body.items || srv.body.rows || srv.body)) || [];
      const row = Array.isArray(items) ? items.find(r => r.key === 'prayer:' + target.id) : null;
      res.eli.tick.serverLastPrayedAt = row ? row.value && row.value.lastPrayedAt : '(row not found; body keys: ' + Object.keys(srv.body || {}).join(',') + ')';
      const crafted = Array.isArray(items) ? items.find(r => r.key === 'prayer:vv2') : null;
      res.eli.tick.serverCraftedRow = crafted ? (crafted.value == null ? 'tombstone' : 'present, id starts ' + String(crafted.value.id).slice(0, 8)) : 'absent from GET';
      res.eli.tick.serverHasMarkupKey = Array.isArray(items) ? items.some(r => /[<>"]/.test(r.key)) : null;
    }
    console.log('eli:', JSON.stringify(res.eli));
    await d.close();
  }
  // 3. Kiara again, on a fresh device, after Eli's ordinary save.
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'kiara', fixedTime: false });
    const f = await d.openApp('prayer', { wait: '#todayLine' }); await sleep(2500);
    res.kiaraAfterEliSave = await count(f);
    console.log('kiara after Eli saved:', JSON.stringify(res.kiaraAfterEliSave));
    await d.close();
  }
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/verify-xss-row-id-2.json`, JSON.stringify(res, null, 1)); await L.close(); }
