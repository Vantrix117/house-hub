// rev3-visual: interactive checks the capture does not cover
const { local, sleep } = await import('file:///C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/base3/audits/tools/lib/local.mjs');
const OUT = process.argv[2];
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const log = (...a) => console.log(...a);
const ready = f => f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0 && !/Loading|Getting/.test(document.getElementById('todayLine').textContent));
const step = async (name, fn) => { try { await fn(); } catch (e) { log('ERR', name, String(e).slice(0, 300)); } };
try {
  // 1. Kitchen view on iPad landscape (family list): column breaks, scroll height, headers orphaned
  // 2. Kid cards: Ezra and Kiara, light + dark, iPad portrait + iPhone, before and after a tap
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
  } catch (e) { console.log('ERR', e); }
await L.close();
