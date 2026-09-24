// Runtime checks for the Prayer leads in audits/01-leads.md:155-209 that can be observed in one page each.
// Demo clock (Tue 22 Sep 2026 08:40 New York), typical seed unless noted. Each check prints one line.
// Run: node "audits/tools/phase3/prayer/leads.mjs" -> audits/evidence/p3/prayer/leads.json (+ a few PNGs)
import fs from 'node:fs';
import { local, sleep, DEMO } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const log = (k, v) => { res[k] = v; console.log(k, '→', JSON.stringify(v)); };
async function app(profile, device = 'iphone-pwa', opts = {}) {
  const d = await L.device({ device, profile, ...opts });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 }); await sleep(600);
  return { d, f };
}
try {
  // ── Eli, personal list ────────────────────────────────────────────────────────────────────────────
  {
    const { d, f } = await app('eli');
    // lead 12: Needs attention overlap
    log('L12-needsAttention', await f.evaluate(() => { const r = reviewItems(); const ids = [...r.cold, ...r.silent, ...r.fresh].map(p => p.id); const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
      return { cold: r.cold.length, silent: r.silent.length, fresh: r.fresh.length, badge: ids.length, distinct: new Set(ids).size, inBoth: dup.map(id => D.lists.personal.prayers.find(p => p.id === id).title) }; }));
    // lead 17: category count vs Remove confirm
    await f.click('nav [data-go="more"]'); await sleep(300);
    const hn = await f.evaluate(() => { const row = [...document.querySelectorAll('.catrow')].find(r => r.textContent.includes('Health Needs')); return { rowText: row.textContent.replace(/\s+/g, ' ').trim(), idx: row.querySelector('[data-delcat]').dataset.delcat }; });
    await f.click(`[data-delcat="${hn.idx}"]`); await sleep(300);
    log('L17-categoryCount', { row: hn.rowText, confirm: await f.evaluate(() => document.querySelector('.ask .line').textContent) });
    await f.click('#askCancel'); await sleep(200);
    // lead 16: does Settings say which list it edits?
    log('L16-settingsNamesList', await f.evaluate(() => { const t = document.getElementById('s-more').textContent; return { mentionsMyList: /My list|Mine|private/i.test(t), mentionsFamily: /Family/i.test(t.replace(/Family and|"Family"/g, '')), headings: [...document.querySelectorAll('#s-more h1, #s-more h2')].map(h => h.textContent) }; }));
    // lead 24: paste parser case
    log('L24-paste', await f.evaluate(() => parsePaste('Health Needs:\nSam - recovery after surgery\nThe Carters - settling in Kenya', 'Personal').map(x => x.title + ' | for ' + x.for)));
    // lead 25: strip wrap on phone
    await f.click('nav [data-go="today"]'); await sleep(300);
    log('L25-stripWrap', await f.evaluate(() => [...document.querySelectorAll('#todayStrip > span')].map(s => s.textContent.trim() + ' @y' + Math.round(s.getBoundingClientRect().top))));
    // lead 15: row order = cache order (no sort)
    log('L15-rowOrder', await f.evaluate(() => ({ today: [...document.querySelectorAll('#todayList .mark')].map(m => m.dataset.pray + (m.getAttribute('aria-pressed') === 'true' ? '✓' : '')), cacheOrder: hub.list('prayer:', { scope: 'person' }).map(r => r.value.id).filter(id => todaySet().some(p => p.id === id)) })));
    // lead 22/23: calendar shape and details chevron
    await f.click('nav [data-go="answered"]'); await sleep(300);
    log('L22-calendar', await f.evaluate(() => { const cal = document.querySelector('.cal'), dow = document.querySelector('.dow'); const t = document.getElementById('record').textContent;
      return { dowAfterGrid: !!(cal.compareDocumentPosition(dow) & Node.DOCUMENT_POSITION_FOLLOWING), monthNameShown: /September|Sept/.test(t), emptyCellBg: getComputedStyle(cal.querySelector('span:not(.on):not(.blank)')).backgroundColor }; }));
    await f.click('nav [data-go="all"]'); await sleep(300);
    log('L23-detailsChevron', await f.evaluate(() => { const s = document.querySelector('#allList details.cat > summary'); return { listStyle: getComputedStyle(s).listStyleType, hasIcon: !!s.querySelector('svg'), text: s.textContent.replace(/\s+/g, ' ').trim() }; }));
    // lead 20: Mark answered lands at the top of the Record
    await f.click('nav [data-go="today"]'); await sleep(300);
    await f.evaluate(() => window.scrollTo(0, 400)); await sleep(200);
    await f.click('#todayList [data-open="p005"]'); await sleep(300);
    await f.click('[data-answer="p005"]'); await f.fill('#askIn', 'The group is growing.'); await f.click('#askSave'); await sleep(600);
    log('L20-markAnswered', await f.evaluate(() => { const el = [...document.querySelectorAll('#answeredList .ans')].find(a => a.textContent.includes('Our small group')); const r = el.getBoundingClientRect(); return { screen: document.querySelector('.screen.on').id, scrollY: scrollY, newAnswerTop: Math.round(r.top), viewport: innerHeight, belowFold: r.top > innerHeight, navTop: Math.round(document.querySelector('nav').getBoundingClientRect().top) }; }));
    await d.shot(`${OUT}/leads-mark-answered-iphone.png`);
    // two controls named More
    await f.click('nav [data-go="today"]'); await sleep(300);
    log('twoMores', await f.evaluate(() => ({ todayMore: document.getElementById('moreBtn').textContent.trim(), navMore: document.querySelector('nav [data-go="more"]').textContent.trim(), navMoreOpens: document.querySelector('#s-more h1').textContent })));
    await d.close();
  }
  // ── Family-side leads (Eli on Family) ─────────────────────────────────────────────────────────────
  {
    const { d, f } = await app('eli');
    await f.click('#listSwitch [data-list="shared"]'); await sleep(400);
    // lead 21: detail sheet of a family request
    await f.click('#todayList [data-open="s001"]'); await sleep(400);
    log('L21-familyDetail', await f.evaluate(() => { const t = document.getElementById('sheetInner').textContent; const rowT = document.querySelector('#todayList li.row .meta').textContent; return { sheetHasAsked: /asked/.test(t), sheetHasPrayedToday: /prayed today|Elizabeth|Ezra/.test(t), rowShowsAsker: /asked/.test(rowT) }; }));
    // lead 13: family delete confirm copy
    await f.click('[data-delete="s001"]'); await sleep(300);
    log('L13-deleteCopy', await f.evaluate(() => document.querySelector('.ask .line').textContent));
    await f.click('#askCancel'); await f.click('[data-shut]'); await sleep(300);
    await d.close();
  }
  // lead 5: Send to family list drops a weekly request's days (Eli's p006 "Pastor Tim and the church staff", weekly Sun/Tue/Thu)
  {
    const { d, f } = await app('eli');
    await f.click('#listSwitch [data-list="personal"]'); await sleep(300);   // the previous block left Eli on Family (activeList is saved)
    await f.click('nav [data-go="all"]'); await f.fill('#f-search', 'Pastor Tim'); await sleep(300);
    await f.click('#allList [data-open="p006"]'); await sleep(300);
    await f.click('[data-share="p006"]'); await f.click('#askSave'); await sleep(500);
    log('L5-shareWeekly', await f.evaluate(() => { const src = D.lists.personal.prayers.find(p => p.id === 'p006'); const c = D.lists.shared.prayers.find(p => p.sharedFrom === 'p006');
      D.activeList = 'shared'; const onToday = todaySet().some(p => p.id === c.id); D.activeList = 'personal';
      return { sourceDays: src.days, copy: { id: c.id, cadence: c.cadence, days: c.days }, familyPlanMode: D.lists.shared.plans.find(p => p.id === D.lists.shared.activePlan).mode, copyOnFamilyTodayOnTuesday: onToday, dow: DOW[new Date().getDay()] }; }));
    await d.close();
  }
  // lead 11: Mae — nothing scheduled, yet the gold streak cheer
  {
    const { d, f } = await app('christian');
    log('L11-unscheduledCheer', await f.evaluate(() => ({ headline: document.getElementById('todayLine').textContent, cheer: document.getElementById('cheer').textContent, strip: document.getElementById('todayStrip').textContent.replace(/\s+/g, ' '), set: todaySet().length })));
    await d.close();
  }
  // lead 9: kid card states (Kiara) and the kid headline
  {
    const { d, f } = await app('kiara', 'ipad-portrait');
    log('L9-kidCards', await f.evaluate(() => [...document.querySelectorAll('.kid')].slice(0, 4).map(k => { const b = k.querySelector('.prayed'); const cs = getComputedStyle(b);
      return { title: k.querySelector('.kt').textContent.slice(0, 24), done: k.classList.contains('done'), btnText: b.textContent.trim(), hasCheck: !!b.querySelector('svg'), btnBg: cs.backgroundColor, titleColor: getComputedStyle(k.querySelector('.kt')).color }; })));
    log('L9-kidHeader', await f.evaluate(() => ({ date: document.getElementById('todayDate').textContent, headline: document.getElementById('todayLine').textContent })));
    // tap Prayed on a done card: can a kid undo a mis-tap?
    const before = await f.evaluate(() => (D.lists.shared.prayers.find(p => p.id === 's002').prayedBy[TODAY] || []).slice());
    await f.click('[data-kpray="s002"]'); await sleep(300); await f.click('[data-kpray="s002"]'); await sleep(300);
    log('kidTapTwice', { before, afterTwoTaps: await f.evaluate(() => D.lists.shared.prayers.find(p => p.id === 's002').prayedBy[TODAY]) });
    await d.close();
  }
  // "…to pray through this morning." at 9 pm
  {
    const { d, f } = await app('eli', 'iphone-pwa', { fixedTime: DEMO + 12.5 * 3600e3 });
    log('eveningCopy', await f.evaluate(() => ({ now: new Date().toString().slice(0, 21), headline: document.getElementById('todayLine').textContent, dateLine: document.getElementById('todayDate').textContent })));
    await d.close();
  }
  // lead 6: taps before hub.ready throw (hold the family + person pulls on a brand-new device)
  {
    const ph = await L.newDevice({ name: 'Eli spare', profiles: ['eli'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', as: ph });
    await d.ctx.route(u => /\/api\/data\/prayer\?/.test(u.href), async r => { await sleep(4000); r.continue(); });
    await d.goto('#prayer'); let f; for (let i = 0; i < 60 && !(f = d.frame('prayer')); i++) await sleep(100);
    await f.waitForSelector('#listSwitch'); await sleep(400);
    await f.click('#listSwitch [data-list="shared"]').catch(() => {}); await sleep(200);
    await f.click('nav [data-go="answered"]').catch(() => {}); await sleep(300);
    log('L6-tapBeforeReady', { pageErrors: d.logs.filter(l => l.startsWith('pageerror')).map(l => l.slice(0, 120)), recordShowsFab: await f.evaluate(() => document.getElementById('fab').classList.contains('on')), screen: await f.evaluate(() => document.querySelector('.screen.on').id) });
    await d.close();
  }
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/leads.json`, JSON.stringify(res, null, 1)); await L.close(); }
