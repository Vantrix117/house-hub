// rev3-visual round 2: the round-1 items
const { local, sleep } = await import('file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs');
const OUT = process.argv[2];
const L = await local({ variant: process.argv[3] || 'typical', clock: 'demo', engine: 'webkit' });
const log = (...a) => console.log(...a);
const ready = f => f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0 && !/Loading|Getting/.test(document.getElementById('todayLine').textContent));
const step = async (name, fn) => { try { await fn(); } catch (e) { log('ERR', name, String(e).slice(0, 300)); } };
try {
  // add-focus: tab from Their number through Category and the chips, then shift-tab back up; nothing covered
  await step('add-focus', async () => {
    for (const dev of ['iphone-pwa', 'ipad-portrait', 'ipad-landscape', 'desktop']) {
      const d = await L.device({ device: dev, mode: 'light', profile: 'eli' });
      const f = await d.openApp('prayer', { wait: '#todayLine' }); await ready(f); await sleep(400);
      await f.evaluate(() => go('add')); await sleep(400);
      await f.focus('#f-phone');
      const res = [];
      const m = () => f.evaluate(() => { const a = document.activeElement, r = a.getBoundingClientRect(), s = document.getElementById('f-save').getBoundingClientRect(), n = document.querySelector('nav').getBoundingClientRect();
        const top = Math.min(s.top, n.top), cover = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, top));
        return (a.id || (a.textContent || '').trim().slice(0, 10)) + ':' + Math.round(cover) + '/' + Math.round(r.height); });
      for (let i = 0; i < 7; i++) { await d.page.keyboard.press('Tab'); await sleep(250); res.push(await m()); }
      log('ADD focus', dev, JSON.stringify(res));
      await d.close();
    }
  });
  // Enter flow on the Add form
  await step('enter', async () => {
    const d = await L.device({ device: 'desktop', mode: 'light', profile: 'eli' });
    const f = await d.openApp('prayer', { wait: '#todayLine' }); await ready(f); await sleep(400);
    await f.evaluate(() => go('add')); await sleep(300);
    const n0 = await f.evaluate(() => L().prayers.length);
    await f.click('#f-title'); await d.page.keyboard.type('Round two request'); await d.page.keyboard.press('Enter'); await sleep(200);
    const a1 = await f.evaluate(() => document.activeElement.id);
    await d.page.keyboard.type('Someone'); await d.page.keyboard.press('Enter'); await sleep(200);
    const a2 = await f.evaluate(() => document.activeElement.id);
    await d.page.keyboard.type('line one'); await d.page.keyboard.press('Enter'); await d.page.keyboard.type('line two'); await sleep(200);
    const det = await f.evaluate(() => document.getElementById('f-detail') ? document.getElementById('f-detail').value : document.activeElement.value);
    const n1 = await f.evaluate(() => L().prayers.length);
    await d.page.keyboard.press('Control+Enter'); await sleep(600);
    const n2 = await f.evaluate(() => ({ n: L().prayers.length, screen: document.querySelector('.screen.on').id }));
    // empty title + Enter: no save, error
    await f.evaluate(() => go('add')); await sleep(300);
    await f.click('#f-phone'); await d.page.keyboard.type('5551234'); await d.page.keyboard.press('Enter'); await sleep(400);
    const n3 = await f.evaluate(() => ({ n: L().prayers.length, err: document.getElementById('f-titleErr').textContent, screen: document.querySelector('.screen.on').id }));
    log('ENTER', JSON.stringify({ n0, afterTitle: a1, afterFor: a2, detail: det, beforeCtrlEnter: n1, afterCtrlEnter: n2, phoneEnterEmptyTitle: n3 }));
    await d.close();
  });
  // Kitchen: grouping and reading order, both orientations, both schemes
  await step('kitchen', async () => {
    for (const [dev, mode] of [['ipad-landscape', 'light'], ['ipad-landscape', 'dark'], ['ipad-portrait', 'dark'], ['desktop', 'light'], ['iphone-pwa', 'dark']]) {
      const d = await L.device({ device: dev, mode, profile: 'eli' });
      const f = await d.openApp('prayer', { wait: '#todayLine' }); await ready(f); await sleep(400);
      for (const list of ['shared', 'personal']) {
        await f.evaluate(l => { D.activeList = l; renderAllScreens(); openKitchen(); }, list); await sleep(700);
        const g = await f.evaluate(() => { const gs = [...document.querySelectorAll('#kitchen .k-group')];
          const orphan = gs.filter(g => { const h = g.querySelector('.k-cat').getBoundingClientRect(), i = g.querySelector('.k-item').getBoundingClientRect(); return Math.abs(h.left - i.left) > 2 || i.top < h.top; }).length;
          const pos = gs.map(g => { const r = g.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; });
          let order = true; for (let i = 1; i < pos.length; i++) if (pos[i][1] < pos[i - 1][1] - 1 && !(pos[i][1] === pos[i - 1][1])) order = false;
          const k = document.getElementById('kitchen');
          return { groups: gs.length, orphan, pos: pos.slice(0, 6), rowByRow: order, cols: new Set(pos.map(p => p[0])).size, scrollH: k.scrollHeight, h: k.clientHeight, itemFs: getComputedStyle(document.querySelector('#kitchen .k-item')).fontSize, overflowX: k.scrollWidth > k.clientWidth }; });
        log('KITCHEN', dev, mode, list, JSON.stringify(g));
        await d.shot(`${OUT}/r2-kitchen-${dev}-${mode}-${list}.png`);
        await f.evaluate(() => { const k = document.getElementById('kitchen'); k.scrollTop = k.scrollHeight; }); await sleep(200);
        await d.shot(`${OUT}/r2-kitchen-${dev}-${mode}-${list}-bottom.png`);
        await f.evaluate(() => document.getElementById('kitchenShut').click()); await sleep(300);
      }
      await d.close();
    }
  });
  // Finished Today: no repeated streak; and the edit form's discard confirm
  await step('done', async () => {
    const d = await L.device({ device: 'iphone-pwa', mode: 'dark', profile: 'eli' });
    const f = await d.openApp('prayer', { wait: '#todayLine' }); await ready(f); await sleep(400);
    await f.evaluate(() => { for (const p of todaySet()) if (!doneToday(p)) setPrayed(p, true); renderAllScreens(); }); await sleep(800);
    log('DONE', JSON.stringify(await f.evaluate(() => ({ line: todayLine.textContent, strip: todayStrip.innerText.replace(/\s+/g, ' '), cheer: cheer.textContent, pray: !startPray.hidden, toast: (document.getElementById('hub-toast') || {}).innerText || null }))));
    await d.shot(`${OUT}/r2-done-iphone-dark.png`);
    // edit + Escape
    const id = await f.evaluate(() => document.querySelector('#todayList [data-open]').dataset.open);
    await f.click(`#todayList [data-open="${id}"]`); await sleep(400);
    await f.click('#sheet [data-edit]'); await sleep(400);
    await d.page.keyboard.press('Escape'); await sleep(400);
    const e1 = await f.evaluate(() => ({ sheet: document.getElementById('sheet').classList.contains('on'), confirm: !!document.querySelector('.hub-ask') }));
    await f.click(`#todayList [data-open="${id}"]`).catch(() => {}); await sleep(400);
    await f.click('#sheet [data-edit]').catch(() => {}); await sleep(300);
    await f.fill('#e-title', 'Changed title'); await d.page.keyboard.press('Escape'); await sleep(500);
    const e2 = await f.evaluate(() => ({ sheet: document.getElementById('sheet').classList.contains('on'), confirm: document.querySelector('.hub-ask') ? document.querySelector('.hub-ask').innerText.replace(/\s+/g, ' ') : null }));
    await d.shot(`${OUT}/r2-discard-iphone-dark.png`);
    await d.page.keyboard.press('Escape'); await sleep(400);
    const e3 = await f.evaluate(() => ({ sheet: document.getElementById('sheet').classList.contains('on'), confirm: !!document.querySelector('.hub-ask'), title: (document.getElementById('e-title') || {}).value }));
    log('EDIT esc', JSON.stringify({ unchanged: e1, changed: e2, escOnConfirm: e3 }));
    await d.close();
  });
} catch (e) { console.log('ERR', e); }
await L.close();
