// Batch 0h check for apps/leftovers.html: what the Phase 3 scripts cannot see now that a ✓ finishes its item after six
// seconds (with Undo) instead of at once.
//   A  a double tap on one ✓: that card turns "Finished" with an Undo in the same place (every card keeps its position and
//      height, while finishing and after); after six seconds only that item
//      is gone from the house list, the next item stays, and it is listed under "Recently finished".
//   B  a ✓ then Undo on the toast: nothing leaves the house list.
//   C  Put back from "Recently finished": the item is back with its size and date, and no longer listed as finished.
//   D  leaving the app before the six seconds are up (its frame closes, as the hub's Back does) still finishes the item.
//   E  a kid: no ✓, no add bar, no Hearth block, a food picture on each card; the house refuses a kid's tombstone.
//   F  a change from another device while a finger is down: the card under it stays the same one, before and after the
//      finger lifts; the item finished elsewhere stays in its place, marked Finished.
//   G  an item added on another device waits behind the "1 new" pill; Show lays the list out with it.
//   H  "Recently finished" never moves under a finger: an item finished on another device is added at the end.
// Run from the repo root: node audits/tools/phase6/0h/larder-check.mjs -> audits/evidence/p6/0h/larder-check.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p6/0h';
fs.mkdirSync(OUT, { recursive: true });
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v).slice(0, 500)); };
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const serverItems = async () => ((await L.apiAs('eli', '/api/data/leftovers?scope=family')).body.items || []).filter(r => r.value);
const names = rows => rows.filter(r => r.key.startsWith('item:')).map(r => r.value.name).sort();
async function larder(profile, device = 'iphone-pwa') {
  const d = await L.device({ device, profile, fixedTime: false });
  const f = await d.openApp('leftovers', { wait: '#tally' });
  await f.waitForFunction(() => /in the fridge/.test(document.getElementById('tally').textContent), null, { timeout: 15000 });
  await sleep(800);
  return { d, f };
}
const boxes = f => f.evaluate(() => [...document.querySelectorAll('.item')].map(c => { const r = c.getBoundingClientRect(); return c.dataset.id + '@' + Math.round(r.top + scrollY) + '+' + Math.round(r.height); }));
const cardNames = f => f.evaluate(() => [...document.querySelectorAll('.item')].map(c => ({ name: c.querySelector('.nm').textContent, finishing: c.classList.contains('finishing') })));
const pass = {};
try {
  // ── A ──
  let { d, f } = await larder('eli');
  const before = names(await serverItems());
  const target = await f.evaluate(() => document.querySelectorAll('.item')[1].querySelector('.nm').textContent);
  const next = await f.evaluate(() => document.querySelectorAll('.item')[2].querySelector('.nm').textContent);
  const box = await f.evaluate(() => { const b = document.querySelectorAll('.item')[1].querySelector('.done').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  const fr = await f.frameElement(); const off = await fr.boundingBox();
  const boxBefore = await boxes(f);
  await d.page.mouse.click(off.x + box.x, off.y + box.y); await sleep(120); await d.page.mouse.click(off.x + box.x, off.y + box.y);
  await sleep(400);
  const during = await cardNames(f); const boxDuring = await boxes(f);
  const toast = await f.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; });
  await d.shot(OUT + '/larder-finishing-iphone.png');
  const midServer = names(await serverItems());
  await sleep(6500); await f.evaluate(() => hub.flush && hub.flush()); await sleep(800);
  const after = names(await serverItems());
  const boxAfter = await boxes(f);
  const doneList = await f.evaluate(() => document.getElementById('donelist').textContent);
  await f.evaluate(() => { const x = document.querySelector('#donelist details'); if (x) { x.open = true; x.scrollIntoView({ block: 'center' }); } }); await sleep(300);
  await d.shot(OUT + '/larder-recently-finished-iphone.png');
  log('A', { target, next, during: during.filter(c => c.finishing).map(c => c.name), toast, midServerHasTarget: midServer.includes(target), afterHasTarget: after.includes(target), afterHasNext: after.includes(next), sameBoxes: JSON.stringify(boxBefore) === JSON.stringify(boxDuring) && JSON.stringify(boxBefore) === JSON.stringify(boxAfter), boxBefore, boxAfter, removed: before.filter(n => !after.includes(n)), doneList });
  pass.A = JSON.stringify(boxBefore) === JSON.stringify(boxDuring) && JSON.stringify(boxBefore) === JSON.stringify(boxAfter) && during.filter(c => c.finishing).map(c => c.name).join() === target && midServer.includes(target) && !after.includes(target) && after.includes(next)
    && before.filter(n => !after.includes(n)).length === 1 && /Recently finished/.test(doneList) && doneList.includes(target);

  // ── B ──
  const bTarget = await f.evaluate(() => document.querySelectorAll('.item')[0].querySelector('.nm').textContent);
  await f.evaluate(() => document.querySelectorAll('.item')[0].querySelector('.done').click()); await sleep(400);
  await f.evaluate(() => document.querySelector('#hub-toast .toast-act').click()); await sleep(7000);
  await f.evaluate(() => hub.flush && hub.flush()); await sleep(600);
  const bAfter = names(await serverItems());
  log('B', { target: bTarget, stillThere: bAfter.includes(bTarget), card: (await cardNames(f)).find(c => c.name === bTarget) });
  pass.B = bAfter.includes(bTarget);

  // ── C ──
  await f.evaluate(() => { const d = document.querySelector('#donelist details'); if (d) d.open = true; }); await sleep(200);
  await f.evaluate(() => document.querySelector('#donelist .putback').click()); await sleep(600);
  await f.evaluate(() => hub.flush && hub.flush()); await sleep(800);
  const cRows = await serverItems(); const back = cRows.find(r => r.key.startsWith('item:') && r.value.name === target);
  const cDone = await f.evaluate(() => document.getElementById('donelist').textContent);
  log('C', { back: back && back.value, stillListedAsFinished: cDone.includes(target) });
  pass.C = !!back && !!back.value.size && !!back.value.dateLogged && !cDone.includes(target);   // the finished row stays (hidden while the item is back; cleared after 7 days)

  // ── D ── tap, then leave the page at once
  const dTarget = await f.evaluate(() => document.querySelectorAll('.item')[0].querySelector('.nm').textContent);
  await f.evaluate(() => document.querySelectorAll('.item')[0].querySelector('.done').click()); await sleep(300);
  // leave the app the way the hub's Back does: the app frame goes away (its pagehide runs), the shell stays
  log('D.frames', await d.page.evaluate(() => [...document.querySelectorAll('iframe')].map(f => f.src.split('/').pop())));
  await d.page.evaluate(() => { for (const fr of document.querySelectorAll('iframe')) if (/leftovers/.test(fr.src)) fr.remove(); }); await sleep(2500);
  const dAfter = names(await serverItems());
  log('D', { target: dTarget, goneAfterLeaving: !dAfter.includes(dTarget) });
  await d.close();
  const re = await larder('eli'); d = re.d; f = re.f;
  await f.evaluate(() => hub.flush && hub.flush()); await sleep(1500);
  const dAfter2 = names(await serverItems());
  log('D.afterReopen', { gone: !dAfter2.includes(dTarget) });
  pass.D = !dAfter2.includes(dTarget);

  // ── F ── a finger down on a card while another device finishes the card above it
  const fItems = await f.evaluate(() => [...document.querySelectorAll('.item')].map(c => ({ id: c.dataset.id, name: c.querySelector('.nm').textContent })));
  const under = fItems[2], above = fItems[1];
  const b2 = await f.evaluate(id => { const b = document.querySelector(`.item[data-id="${id}"] .done`).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, under.id);
  const off2 = await (await f.frameElement()).boundingBox();
  await d.page.mouse.move(off2.x + b2.x, off2.y + b2.y); await d.page.mouse.down();
  await L.apiAs('mom', `/api/data/leftovers/item:${above.id}?scope=family`, { method: 'DELETE' });
  await f.evaluate(() => hub.pull()); await sleep(1200);
  const whileDown = await f.evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); const c = el && el.closest('.item'); return c ? c.querySelector('.nm').textContent : null; }, b2);
  await d.page.mouse.up(); await sleep(900);
  const afterUp = await f.evaluate(() => [...document.querySelectorAll('.item')].map(c => c.querySelector('.nm').textContent + (c.classList.contains('gone') ? ' (gone)' : '')));
  log('F', { under: under.name, aboveFinishedElsewhere: above.name, cardUnderFingerWhileDown: whileDown, finishingAfterUp: (await cardNames(f)).filter(c => c.finishing).map(c => c.name), listAfterUp: afterUp });
  const underAfterUp = await f.evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); const c = el && el.closest('.item'); return c ? c.querySelector('.nm').textContent : null; }, b2);
  log('F.underAfterUp', underAfterUp);
  pass.F = whileDown === under.name && underAfterUp === under.name && afterUp.includes(above.name + ' (gone)');
  await sleep(800); await f.evaluate(() => { for (const b of document.querySelectorAll('.item.finishing .undo')) b.click(); }); await sleep(300);

  // ── G ── an item added on another device waits behind the pill; Show lays the list out with it
  const gBefore = await f.evaluate(() => [...document.querySelectorAll('.item')].map(c => c.dataset.id));
  await L.apiAs('mom', '/api/data/leftovers/item:g0h-new?scope=family', { method: 'PUT', body: { value: { id: 'g0h-new', name: 'Check G lasagna', size: 'Large', dateLogged: '2026-09-20', by: 'mom', byName: 'Elizabeth' }, updated_at: Date.now() } });
  await f.evaluate(() => hub.pull()); await sleep(1200);
  const gMid = await f.evaluate(() => ({ ids: [...document.querySelectorAll('.item')].map(c => c.dataset.id), pill: document.getElementById('newpill').hidden ? null : document.getElementById('newpill').textContent }));
  await f.click('#newpill'); await sleep(500);
  const gAfter = await f.evaluate(() => ({ names: [...document.querySelectorAll('.item')].map(c => c.querySelector('.nm').textContent), pillHidden: document.getElementById('newpill').hidden }));
  log('G', { unchangedUntilShow: JSON.stringify(gMid.ids) === JSON.stringify(gBefore), pill: gMid.pill, after: gAfter });
  pass.G = JSON.stringify(gMid.ids) === JSON.stringify(gBefore) && /1 new/.test(gMid.pill || '') && gAfter.names.includes('Check G lasagna') && gAfter.pillHidden;
  // ── H ── Recently finished never moves under a finger: another device finishes an item while the list is open
  await f.evaluate(() => { const x = document.querySelector('#donelist details'); if (x) x.open = true; }); await sleep(200);
  const rowBoxes = () => f.evaluate(() => [...document.querySelectorAll('#donelist .row')].map(r => { const b = r.getBoundingClientRect(); return r.dataset.id + '@' + Math.round(b.top + scrollY) + '+' + Math.round(b.height); }));
  const rowsBefore = await rowBoxes();
  const victim = (await serverItems()).find(r => r.key.startsWith('item:') && r.value.name !== 'Check G lasagna');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  await L.apiAs('mom', '/api/data/leftovers/' + victim.key + '?scope=family', { method: 'DELETE' });
  await L.apiAs('mom', '/api/data/leftovers/finished:' + victim.value.id + '?scope=family', { method: 'PUT', body: { value: { id: victim.value.id, name: victim.value.name, size: victim.value.size, dateLogged: victim.value.dateLogged, finishedAt: today, finishedBy: 'mom', finishedByName: 'Elizabeth' }, updated_at: Date.now() } });
  await f.evaluate(() => hub.pull()); await sleep(1200);
  const rowsAfter = await rowBoxes();
  // and the first row's item is put back on another device: that row turns "Back" in place, every row keeps its box
  const backId = rowsAfter[0].split('@')[0];
  const fin = (await serverItems()).find(r => r.key === 'finished:' + backId);
  await L.apiAs('mom', '/api/data/leftovers/item:' + backId + '?scope=family', { method: 'PUT', body: { value: { id: backId, name: fin.value.name, size: fin.value.size, dateLogged: fin.value.dateLogged }, updated_at: Date.now() } });
  await f.evaluate(() => hub.pull()); await sleep(1200);
  const rowsBack = await rowBoxes();
  const firstTag = await f.evaluate(id => { const r = document.querySelector('#donelist .row[data-id="' + id + '"]'); return r ? r.querySelector('.putback').textContent : null; }, backId);
  log('H', { rowsBefore, rowsAfter, finishedElsewhere: victim.value.name, rowsBack, firstTag });
  pass.H = rowsBefore.length > 0 && rowsBefore.every((r, i) => rowsAfter[i] === r) && rowsAfter.length === rowsBefore.length + 1 && rowsAfter[rowsAfter.length - 1].startsWith(victim.value.id + '@')
    && JSON.stringify(rowsBack) === JSON.stringify(rowsAfter) && /Back/.test(firstTag || '');

  await d.close();

  // ── E ── a kid
  const k = await larder('ezra', 'ipad-portrait');
  const kv = await k.f.evaluate(() => ({ kind: document.documentElement.dataset.kind, checks: document.querySelectorAll('.item .done').length,
    addBar: getComputedStyle(document.getElementById('add')).display, hearth: getComputedStyle(document.querySelector('.hearth')).display,
    pics: [...document.querySelectorAll('.item .pic')].filter(p => getComputedStyle(p).display !== 'none').length, cards: document.querySelectorAll('.item').length,
    meta: document.querySelector('.item .meta') && document.querySelector('.item .meta').textContent }));
  await k.d.shot(OUT + '/larder-kid-ipad.png');
  const firstId = (await serverItems()).find(r => r.key.startsWith('item:')).key;
  const tomb = await L.apiAs('ezra', `/api/data/leftovers/${firstId}?scope=family`, { method: 'DELETE' });
  log('E', { ...kv, kidTombstoneStatus: tomb.status, kidTombstoneError: tomb.body && tomb.body.error });
  pass.E = kv.kind === 'kid' && kv.checks === 0 && kv.addBar === 'none' && kv.hearth === 'none' && kv.pics === kv.cards && kv.cards > 0 && tomb.status === 403;
  await k.d.close();
} catch (e) { log('error', String(e && e.stack || e)); }
finally { await L.close(); }
res.pass = pass;
console.log('PASS', JSON.stringify(pass));
fs.writeFileSync(OUT + '/larder-check.json', JSON.stringify(res, null, 1));
