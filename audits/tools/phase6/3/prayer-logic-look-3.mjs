// Batch 3 (Worker A, the Prayer logic half): a look at the screens and flows this half changed, on the rig's typical seed.
// Eli on the iPhone PWA (light) and the iPad landscape (dark): Add names its list and switches it (P3-PRAYER-20); Settings
// is titled for its list and asks once before a Family change (UX-PRAYER-4, hub.confirm); Record → Answered search and
// years (GAP-PRAYER-2); a family request's detail sheet shows who asked and who prayed (UX-PRAYER-6); Paste capitalises
// (UX-PRAYER-11); Import offers a file (UX-PRAYER-12); a finished Today leads with "All prayed ✓" (UX-PRAYER-14).
// Run: node "audits/tools/phase6/3/prayer-logic-look-3.mjs" -> audits/evidence/p6/3/prayer-logic-look-3.json + PNGs
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p6/3';
fs.mkdirSync(OUT, { recursive: true });
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v).slice(0, 600)); };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const [device, mode] of [['iphone-pwa', 'light'], ['ipad-landscape', 'dark']]) {
    const t = device + '-' + mode;
    const d = await L.device({ device, mode, profile: 'eli' });
    const f = await d.openApp('prayer', { wait: '#todayLine' });
    await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 15000 }); await sleep(800);
    const shot = n => d.shot(`${OUT}/look-${n}-${t}.png`);
    // Add, on My list then on the Family list through its own switch
    await f.click('nav [data-go="add"]'); await sleep(400);
    log(t + ':addMine', await f.evaluate(() => ({ save: el('f-save').textContent, note: el('addListNote').textContent, pressed: [...document.querySelectorAll('#addListSwitch button')].map(b => b.textContent + ':' + b.getAttribute('aria-pressed')),
      saveVisible: (() => { const r = el('f-save').getBoundingClientRect(), n = document.querySelector('nav').getBoundingClientRect(); return r.bottom <= n.top + 1 && r.top >= 0; })() })));
    await shot('add-mine');
    await f.click('#addListSwitch [data-addlist="shared"]'); await sleep(400);
    log(t + ':addFamily', await f.evaluate(() => ({ save: el('f-save').textContent, note: el('addListNote').textContent, active: D.activeList })));
    await shot('add-family');
    // Settings on the Family list: the title, then the confirm before the first change
    await f.click('nav [data-go="more"]'); await sleep(400);
    log(t + ':settingsFamily', await f.evaluate(() => ({ title: el('moreTitle').textContent, note: el('moreListNote').textContent })));
    const before = await f.evaluate(() => PL().show.meter);
    await f.click('[data-show="meter"]'); await sleep(500);
    const conf = await f.evaluate(() => { const s = document.querySelector('.hub-ask'); return s ? s.innerText.replace(/\s+/g, ' ') : null; });
    await shot('settings-family-confirm');
    await f.click('.hub-ask .btn:not(.btn-primary)'); await sleep(300);    // Cancel
    const afterCancel = await f.evaluate(() => PL().show.meter);
    await f.click('[data-show="meter"]'); await sleep(400); await f.click('.hub-ask .btn-primary'); await sleep(400);
    const afterYes = await f.evaluate(() => PL().show.meter);
    await f.click('[data-show="meter"]'); await sleep(400);
    const secondAsks = await f.evaluate(() => !!document.querySelector('.hub-ask'));
    log(t + ':familyConfirm', { confirm: conf, meterBefore: before, afterCancel, afterYes, secondChangeAsksAgain: secondAsks, meterNow: await f.evaluate(() => PL().show.meter) });
    // Paste: capitalised titles
    await f.fill('#f-paste', 'Health Needs:\nSam - recovery after surgery\nThe Carters - settling in Kenya'); await f.click('#f-parse'); await sleep(300);
    log(t + ':paste', await f.evaluate(() => [...document.querySelectorAll('#parsed .pending .title')].map(x => x.textContent)));
    // Import: the file picker button
    await f.click('#f-import'); await sleep(300);
    log(t + ':import', await f.evaluate(() => ({ label: (document.querySelector('.ask label') || {}).textContent, pick: !!document.getElementById('f-importPick'), accept: el('f-importFile').accept })));
    await shot('import');
    await f.click('#askCancel'); await sleep(200);
    // Back to My list; Record → Answered: years and the search
    await f.click('nav [data-go="today"]'); await sleep(300); await f.click('#listSwitch [data-list="personal"]'); await sleep(400);
    await f.click('nav [data-go="answered"]'); await sleep(400);
    await f.evaluate(() => el('answeredList').scrollIntoView()); await sleep(200);
    log(t + ':answered', await f.evaluate(() => ({ years: [...document.querySelectorAll('#answeredList .ans-year')].map(h => h.textContent), rows: document.querySelectorAll('#answeredList .ans').length, searchShown: !el('f-ansSearch').hidden })));
    await shot('record-answered');
    await f.fill('#f-ansSearch', 'shoulder'); await sleep(300);
    log(t + ':answeredSearch', await f.evaluate(() => [...document.querySelectorAll('#answeredList .ans .what')].map(x => x.textContent)));
    await shot('record-search');
    await f.fill('#f-ansSearch', ''); await sleep(200);
    // Family detail sheet: who asked, who prayed today
    await f.click('nav [data-go="today"]'); await sleep(300); await f.click('#listSwitch [data-list="shared"]'); await sleep(500);
    await f.click('#todayList [data-open]'); await sleep(500);
    log(t + ':familySheet', await f.evaluate(() => (document.querySelector('#sheet .sheetwho') || {}).innerText));
    await shot('detail-family');
    await d.page.keyboard.press('Escape'); await sleep(300);
    // A finished Today (My list): every request prayed → "All prayed ✓", no Pray now, one cheer
    await f.click('#listSwitch [data-list="personal"]'); await sleep(400);
    await f.evaluate(() => { todaySet().forEach(p => { if(!doneToday(p)) setPrayed(p, true); }); renderAllScreens(); }); await sleep(400);
    log(t + ':done', await f.evaluate(() => ({ line: el('todayLine').textContent, drawnCheck: !!document.querySelector('#todayLine svg.hcheck'), prayNowShown: !el('startPray').hidden, cheer: el('cheer').textContent, order: [...document.querySelectorAll('#todayList .row')].map(r => r.classList.contains('done')) })));
    await d.page.evaluate(() => window.scrollTo(0, 0)); await shot('today-done');
    await d.close();
  }
} catch (e) { log('error', String(e.stack || e)); }
finally { fs.writeFileSync(`${OUT}/prayer-logic-look-3.json`, JSON.stringify(res, null, 1)); await L.close(); }
