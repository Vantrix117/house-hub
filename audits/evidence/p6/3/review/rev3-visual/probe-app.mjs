// rev3-visual: interactive checks the capture does not cover
const { local, sleep } = await import('file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs');
const OUT = process.argv[2];
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const log = (...a) => console.log(...a);
const ready = f => f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0 && !/Loading|Getting/.test(document.getElementById('todayLine').textContent));
const step = async (name, fn) => { try { await fn(); } catch (e) { log('ERR', name, String(e).slice(0, 300)); } };
try {
  // 1. Kitchen view on iPad landscape (family list): column breaks, scroll height, headers orphaned
  await step('kitchen', async () => {
    for (const [dev, mode, prof] of [['ipad-landscape', 'light', 'eli'], ['ipad-portrait', 'dark', 'eli']]) {
      const d = await L.device({ device: dev, mode, profile: prof });
      const f = await d.openApp('prayer', { wait: '#todayLine' }); await ready(f); await sleep(500);
      await f.evaluate(() => { D.activeList = 'shared'; renderAllScreens(); openKitchen(); }); await sleep(800);
      const g = await f.evaluate(() => { const k = document.getElementById('kitchen'); const kids = [...document.querySelectorAll('#kitchen .k-cols > *')];
        const out = []; for (let i = 0; i < kids.length; i++) if (kids[i].classList.contains('k-cat')) { const a = kids[i].getBoundingClientRect(), b = kids[i + 1] && kids[i + 1].getBoundingClientRect(); out.push({ cat: kids[i].textContent, x: Math.round(a.left), y: Math.round(a.top), nextX: b && Math.round(b.left), nextY: b && Math.round(b.top) }); }
        return { scrollH: k.scrollHeight, clientH: k.clientHeight, cols: getComputedStyle(document.querySelector('#kitchen .k-cols') || document.body).columnCount, orphans: out.filter(o => o.nextX !== undefined && o.nextX !== o.x), cats: out.map(o => o.cat + '@' + o.x + ',' + o.y), itemFs: getComputedStyle(document.querySelector('#kitchen .k-item')).fontSize, h1Fs: getComputedStyle(document.querySelector('#kitchen h1')).fontSize,
          frameTop: (window.frameElement ? window.frameElement.getBoundingClientRect().top : null), shellBar: parent.document.getElementById('viewer') ? parent.document.getElementById('viewer').className : null, closeBox: (r => [Math.round(r.width), Math.round(r.height)])(document.getElementById('kitchenShut').getBoundingClientRect()) }; });
      log('KITCHEN', dev, mode, JSON.stringify(g));
      await f.evaluate(() => { const k = document.getElementById('kitchen'); k.scrollTop = k.scrollHeight; }); await sleep(300);
      await d.shot(`${OUT}/kitchen-bottom-${dev}-${mode}.png`);
      // Escape closes and brings the bar back
      await f.focus('body').catch(() => {}); await d.page.keyboard.press('Escape'); await sleep(400);
      log('KITCHEN esc', JSON.stringify(await f.evaluate(() => ({ on: document.getElementById('kitchen').classList.contains('on'), viewer: parent.document.getElementById('viewer').className, viewerOpen: parent.location.hash }))));
      await d.close();
    }
  });
  // 2. Kid cards: Ezra and Kiara, light + dark, iPad portrait + iPhone, before and after a tap
  await step('kid', async () => {
    for (const [kid, dev, mode] of [['ezra', 'ipad-portrait', 'light'], ['kiara', 'ipad-portrait', 'dark'], ['ezra', 'iphone-pwa', 'dark'], ['kiara', 'iphone-pwa', 'light']]) {
      const d = await L.device({ device: dev, mode, profile: kid });
      const f = await d.openApp('prayer', { wait: '#todayLine' }); await ready(f); await sleep(800);
      const first = await f.evaluate(() => { const b = document.querySelector('.kid:not(.done) .prayed'); return b && b.dataset.kpray; });
      if (first) { await f.click(`[data-kpray="${first}"]`); await sleep(1500); }
      const g = await f.evaluate(() => [...document.querySelectorAll('.kid')].slice(0, 4).map(k => { const b = k.querySelector('.prayed'), r = b.getBoundingClientRect(); return { done: k.classList.contains('done'), label: b.innerText.replace(/\s+/g, ' '), w: Math.round(r.width), h: Math.round(r.height), bg: getComputedStyle(b).backgroundColor, color: getComputedStyle(b).color }; }));
      log('KID', kid, dev, mode, JSON.stringify(g));
      // the toast for a kid (bottom placement)
      const t = await f.evaluate(() => { const t = document.getElementById('hub-toast'); return t ? { text: t.innerText, rect: (r => [Math.round(r.top), Math.round(r.bottom)])(t.getBoundingClientRect()), vh: innerHeight } : null; });
      log('KID toast', JSON.stringify(t));
      await d.shot(`${OUT}/kid-${kid}-${dev}-${mode}.png`);
      await d.close();
    }
  });
  // 3. Add: Tab to Category and How often; is the focused field hidden under the pinned button / nav?
  await step('add-focus', async () => {
    for (const dev of ['iphone-pwa', 'desktop']) {
      const d = await L.device({ device: dev, mode: 'light', profile: 'eli' });
      const f = await d.openApp('prayer', { wait: '#todayLine' }); await ready(f); await sleep(400);
      await f.evaluate(() => go('add')); await sleep(400);
      await f.focus('#f-phone');
      const res = [];
      for (let i = 0; i < 4; i++) {
        await d.page.keyboard.press('Tab'); await sleep(250);
        res.push(await f.evaluate(() => { const a = document.activeElement, r = a.getBoundingClientRect(), s = document.getElementById('f-save').getBoundingClientRect(), n = document.querySelector('nav').getBoundingClientRect();
          const cover = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, Math.min(s.top, n.top)));
          return { el: a.id || a.tagName + '.' + a.className + ':' + (a.textContent || '').trim().slice(0, 12), top: Math.round(r.top), bottom: Math.round(r.bottom), saveTop: Math.round(s.top), navTop: Math.round(n.top), coveredPx: Math.round(cover), h: Math.round(r.height) }; }));
      }
      log('ADD focus', dev, JSON.stringify(res));
      await d.shot(`${OUT}/add-focus-${dev}.png`);
      await d.close();
    }
  });
  // 4. Toast + Undo after Mark answered, iPhone: size, placement vs + and nav
  await step('toast', async () => {
    for (const [dev, mode] of [['iphone-pwa', 'light'], ['ipad-landscape', 'dark']]) {
      const d = await L.device({ device: dev, mode, profile: 'eli' });
      const f = await d.openApp('prayer', { wait: '#todayLine' }); await ready(f); await sleep(400);
      const id = await f.evaluate(() => document.querySelector('#todayList [data-open]').dataset.open);
      await f.click(`#todayList [data-open="${id}"]`); await sleep(500);
      await f.click('#sheet [data-answer]'); await sleep(400);
      const inp = await f.$('#askIn'); if (inp) await inp.fill('Test answer');
      await f.click('#askSave'); await sleep(700);
      const g = await f.evaluate(() => { const t = document.getElementById('hub-toast'); if (!t) return null; const r = t.getBoundingClientRect(), b = t.querySelector('button'), br = b && b.getBoundingClientRect(), fab = document.querySelector('.fab').getBoundingClientRect(), nav = document.querySelector('nav').getBoundingClientRect();
        return { text: t.innerText.replace(/\s+/g, ' '), toast: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], btn: br && [Math.round(br.width), Math.round(br.height)], fab: [Math.round(fab.left), Math.round(fab.top), Math.round(fab.bottom)], navTop: Math.round(nav.top), fabVisible: getComputedStyle(document.querySelector('.fab')).display, screen: document.querySelector('.screen.on').id }; });
      log('TOAST', dev, mode, JSON.stringify(g));
      await d.shot(`${OUT}/toast-${dev}-${mode}.png`);
      await f.click('#hub-toast button'); await sleep(600);
      log('UNDO', JSON.stringify(await f.evaluate(id => ({ status: D.lists.personal.prayers.concat(D.lists.shared.prayers).find(p => p.id === id).status }), id)));
      await d.close();
    }
  });
  // 5. Pray now in the hub on the iPad landscape and the iPhone: bar hidden, Close size, Escape, then Escape again
  await step('pray', async () => {
    for (const [dev, mode] of [['ipad-landscape', 'dark'], ['iphone-pwa', 'light']]) {
      const d = await L.device({ device: dev, mode, profile: 'eli' });
      const f = await d.openApp('prayer', { wait: '#todayLine' }); await ready(f); await sleep(400);
      await f.evaluate(() => { D.activeList = 'shared'; renderAllScreens(); });
      await f.click('#startPray'); await sleep(700);
      const g = await f.evaluate(() => { const c = document.getElementById('prayShut').getBoundingClientRect(); return { frameTop: Math.round(window.frameElement.getBoundingClientRect().top), viewer: parent.document.getElementById('viewer').className, close: [Math.round(c.width), Math.round(c.height), Math.round(c.top)], asker: !document.getElementById('prayAsker').hidden, table: document.getElementById('prayTable').innerText }; });
      log('PRAY', dev, mode, JSON.stringify(g));
      await d.shot(`${OUT}/pray-family-${dev}-${mode}.png`);
      await d.page.keyboard.press('Escape'); await sleep(500);
      const g2 = await f.evaluate(() => ({ prayOn: document.getElementById('pray').classList.contains('on'), viewer: parent.document.getElementById('viewer').className, hash: parent.location.hash }));
      log('PRAY after Esc', JSON.stringify(g2));
      await d.close();
    }
  });
  // 6. Kitchen device: Pray now with "Around the table"
  await step('table', async () => {
    const d = await L.device({ device: 'ipad-landscape', mode: 'light', profile: 'kitchen' });
    await d.goto(''); await sleep(2500);
    const f = await d.openApp('prayer', { wait: '#todayLine' }).catch(() => null);
    if (!f) { log('no kitchen prayer frame'); await d.close(); return; }
    await ready(f); await sleep(600);
    await f.click('#startPray'); await sleep(900);
    await d.shot(`${OUT}/table-whosheet.png`);
    const face = await d.page.$('.hub-ask button[data-id], .hub-ask [data-pick], .sheet button.face, .who-sheet button');
    log('who sheet buttons', await d.page.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent && /Eli|Ezra|Mae/.test(b.innerText)).map(b => b.innerText.replace(/\s+/g, ' ')).slice(0, 8)));
    const btn = await d.page.$$('button');
    for (const b of btn) { const t = (await b.innerText().catch(() => '')) || ''; if (/^\s*\S*\s*Eli\s*$/.test(t) || /\bEli\b/.test(t)) { await b.click().catch(() => {}); break; } }
    await sleep(900);
    await d.shot(`${OUT}/table-pray.png`);
    log('TABLE', JSON.stringify(await f.evaluate(() => ({ on: document.getElementById('pray').classList.contains('on'), table: document.getElementById('prayTable').innerText.replace(/\s+/g, ' '), faces: [...document.querySelectorAll('#prayTable .tface')].map(b => [b.getAttribute('aria-pressed'), Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height)]) }))));
    await d.close();
  });
} catch (e) { console.log('ERR', e); }
await L.close();
