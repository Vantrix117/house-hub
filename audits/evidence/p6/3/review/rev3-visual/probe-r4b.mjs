const { local, sleep } = await import('file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs');
const OUT = process.argv[2];
const log = (...a) => console.log(...a);
for (const variant of ['overflow']) {
  const L = await local({ variant, clock: 'demo', engine: 'webkit' });
  try {
    for (const [dev, mode, size] of [['ipad-landscape', 'light', null], ['ipad-landscape', 'dark', 'xxl'], ['iphone-pwa', 'light', null], ['iphone-pwa', 'dark', 'xxl'], ['ipad-portrait', 'light', 'l'], ['desktop', 'dark', null], ['desktop', 'light', 'xxl']]) {
      const extra = size ? { 'hub.prefs': { textSize: size } } : null;
      const d = await L.device({ device: dev, mode, profile: 'eli', localStorage: extra });
      const f = await d.openApp('prayer', { wait: '#todayLine' }); await sleep(1600); if (size) { await f.evaluate(s => { try { hub.setTextSize(s); } catch (e) {} document.documentElement.setAttribute('data-text-size', s); }, size); await sleep(800); }
      const g = await f.evaluate(() => {
        const dt = document.getElementById('todayDate'), h = document.getElementById('todayLine'), st = document.getElementById('todayStrip'), nav = document.querySelector('nav').getBoundingClientRect();
        const rows = [...document.querySelectorAll('#todayList li.row')].filter(r => r.getBoundingClientRect().bottom <= nav.top).length;
        const clipped = [...document.querySelectorAll('#todayStrip > span, #todayActions button, .hdr *')].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow !== 'ellipsis').map(e => (e.id || e.className || e.tagName) + ':' + e.textContent.trim().slice(0, 20));
        const r = e => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
        return { ts: document.documentElement.getAttribute('data-text-size'), date: dt.textContent, dateTitle: dt.getAttribute('title'), dateEllipsis: dt.scrollWidth > dt.clientWidth, dateBox: r(dt), head: h.innerText, headBox: r(h), strip: r(st), stripOverflow: st.scrollWidth > st.clientWidth + 1, rowsAbove: rows, hscroll: document.documentElement.scrollWidth > innerWidth, clipped };
      });
      log(variant, dev, mode, size || '-', JSON.stringify(g));
      await d.shot(`${OUT}/today-${variant}-${dev}-${mode}-${size || 'm'}.png`);
      await d.close();
    }
    if (false) {
      for (const [kid, dev, mode] of [['ezra', 'iphone-pwa', 'light'], ['ezra', 'ipad-portrait', 'dark'], ['kiara', 'iphone-pwa', 'dark'], ['kiara', 'ipad-portrait', 'light']]) {
        const d = await L.device({ device: dev, mode, profile: kid });
        const f = await d.openApp('prayer', { wait: '#todayLine' }); await sleep(1500);
        const g = await f.evaluate(() => [...document.querySelectorAll('.kid')].slice(0, 3).map(k => { const b = k.querySelector('.prayed'); return { done: k.classList.contains('done'), text: b.innerText.trim(), aria: b.getAttribute('aria-label'), svgs: [...b.querySelectorAll('svg')].map(s => s.getAttribute('aria-hidden')), bg: getComputedStyle(b).backgroundColor, h: Math.round(b.getBoundingClientRect().height) }; }));
        log('KID', kid, dev, mode, JSON.stringify(g));
        await d.shot(`${OUT}/kid-${kid}-${dev}-${mode}.png`);
        await d.close();
      }
      // finished Today + List chevrons open/shut + Record answered group
      const d = await L.device({ device: 'iphone-pwa', mode: 'dark', profile: 'eli' });
      const f = await d.openApp('prayer', { wait: '#todayLine' }); await sleep(1500);
      await f.evaluate(() => { for (const p of todaySet()) if (!doneToday(p)) setPrayed(p, true); renderAllScreens(); }); await sleep(600);
      log('DONE', JSON.stringify(await f.evaluate(() => ({ text: todayLine.innerText, html: todayLine.innerHTML.slice(0, 120), label: todayLine.textContent }))));
      await d.shot(`${OUT}/done-iphone-dark.png`);
      await f.evaluate(() => go('all')); await sleep(400);
      await f.click('#allList details.cat > summary'); await sleep(400);
      log('CHEV', JSON.stringify(await f.evaluate(() => [...document.querySelectorAll('#allList details.cat')].slice(0, 3).map(d => ({ open: d.open, t: getComputedStyle(d.querySelector('summary > .chev')).transform, aria: d.querySelector('summary > .chev').getAttribute('aria-hidden') })))));
      await d.shot(`${OUT}/list-chev-iphone-dark.png`);
      await d.close();
    }
  } catch (e) { console.log('ERR', String(e).slice(0, 300)); }
  await L.close();
}
