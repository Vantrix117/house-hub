// rev5-core round 5: the in-card result line #rated with Undo.
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const L = await local({ variant: 'empty', clock: 'real' });
const put = (who, app, key, value, scope = 'person', updated_at = Date.now()) => L.apiAs(who, `/api/data/${app}/${encodeURIComponent(key)}?scope=${scope}`, { method: 'PUT', body: { value, updated_at } });
const get = async (who, app, key, scope = 'person') => { const r = await L.apiAs(who, `/api/data/${app}?scope=${scope}`); const it = (r.body.items || []).find(i => i.key === key); return it ? it.value : undefined; };
const st = p => p.evaluate(() => { const l = document.getElementById('rated'), ub = document.getElementById('rated-undo'), t = document.getElementById('hub-toast');
  return { host: l.parentElement.id, armed: l.classList.contains('armed'), faded: l.classList.contains('faded'), text: document.getElementById('rated-text').textContent, undoShown: !ub.hidden && ub.getClientRects().length > 0, undoH: Math.round(ub.getBoundingClientRect().height),
    focus: document.activeElement && (document.activeElement.id || document.activeElement.dataset.rate || document.activeElement.tagName), cur: verses.current(), toast: t && !t.hidden ? t.textContent.trim() : null }; });
const out = {};
try {
  for (const id of ['1-0', '1-1']) await put('eli', 'f260', 'mem:' + id, true);
  const A = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const p = A.page;
  await p.goto(L.site + '/apps/verses.html');
  await p.waitForFunction(() => window.verses && hub.isLoaded('verses', 'person') && hub.isLoaded('f260', 'person') && verses.current(), null, { timeout: 20000 });
  const first = await p.evaluate(() => verses.current());
  await p.click('#show'); await p.click('#act-rate [data-rate=got]'); await sleep(600);
  out.a_afterRate = await st(p);
  await p.click('#rated-undo'); await sleep(1500);
  out.a_afterUndo = await st(p);
  out.a_rowServer = (await get('eli', 'f260', 'recall:' + first)) ?? null;
  // b: rate both -> the line moves to #done; Undo there
  await p.click('#act-rate [data-rate=got]'); await sleep(700);
  await p.click('#show'); await p.click('#act-rate [data-rate=almost]'); await sleep(700);
  out.b_done = await st(p);
  await p.click('#rated-undo'); await sleep(1500);
  out.b_afterUndoFromDone = await st(p);
  // c: rate it again, then "Practise one anyway" from done: the line follows to the trainer
  await p.click('#act-rate [data-rate=almost]'); await sleep(700);
  await p.click('#again'); await sleep(600);
  out.c_practiseAnyway = await st(p);
  // d: focus on Undo, let the line end -> focus goes to a control, not body; U afterwards does nothing
  await p.focus('#rated-undo');
  await sleep(10600);
  out.d_afterFade = await st(p);
  const before = await p.evaluate(() => JSON.stringify(hub.list('recall:', { app: 'f260', scope: 'person' }).map(r => r.value.box)));
  await p.keyboard.press('u'); await sleep(500);
  out.d_UafterFade = before === await p.evaluate(() => JSON.stringify(hub.list('recall:', { app: 'f260', scope: 'person' }).map(r => r.value.box)));
  // e: U while a confirm sheet is open -> no undo; then U after it closes works
  if (await p.$eval('#show', e => !e.hidden).catch(() => false)) await p.click('#show');
  await p.click('#act-rate [data-rate=not]'); await sleep(700);
  const rowRated = await p.evaluate(() => JSON.stringify(hub.list('recall:', { app: 'f260', scope: 'person' }).map(r => r.value.t)));
  p.evaluate(() => { window.__c = hub.confirm('Test sheet', { title: 'Test' }); });
  await sleep(300);
  await p.keyboard.press('u'); await sleep(500);
  out.e_UduringConfirm_noUndo = rowRated === await p.evaluate(() => JSON.stringify(hub.list('recall:', { app: 'f260', scope: 'person' }).map(r => r.value.t)));
  await p.keyboard.press('Escape'); await sleep(300);
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press('u'); await sleep(1500);
  out.e_UafterConfirm_undone = rowRated !== await p.evaluate(() => JSON.stringify(hub.list('recall:', { app: 'f260', scope: 'person' }).map(r => r.value.t)));
  out.e_state = await st(p);
  await A.close();

  // f: a kid
  await put('eli', 'kidverse', 'week', { week: 3 }, 'family');
  const K = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
  await K.page.goto(L.site + '/apps/verses.html');
  await K.page.waitForFunction(() => window.verses && hub.isLoaded('verses', 'person') && hub.isLoaded('f260', 'person') && hub.isLoaded('kidverse', 'family') && verses.current(), null, { timeout: 20000 });
  await K.page.click('#show'); await K.page.click('#act-rate [data-rate=got]'); await sleep(700);
  out.f_kid = await st(K.page);
  const kid = out.f_kid;
  await K.page.click('#rated-undo'); await sleep(1500);
  out.f_kidAfterUndo = await st(K.page);
  out.f_kidRow = (await get('ezra', 'f260', 'recall:3-0')) ?? null;
  await K.close();

  // g: the kiosk opens Verses standalone: no line, no Undo
  const T = await L.device({ device: 'ipad-landscape', profile: 'tv', fixedTime: false });
  await T.page.goto(L.site + '/apps/verses.html'); await sleep(3000);
  out.g_tv = await T.page.evaluate(() => ({ rate: window.verses ? verses.rate('got') : null, armed: document.getElementById('rated').classList.contains('armed') }));
  await T.close();
} catch (e) { console.error(e); }
console.log(JSON.stringify(out, null, 1));
await L.close();
