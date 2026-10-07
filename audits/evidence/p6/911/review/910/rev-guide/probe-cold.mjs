// R-guide round 5: cold open through the viewer (iPad portrait, first pull held 2.5 s) when the person's first unfinished step is NOT
// in the default section: does the step card change height when the pull lands (the card is now sized per section)?
import { local, sleep } from 'file:///C:/Users/ex_bo/hub-audit/audits/tools/lib/local.mjs';
const variant = process.argv[2] || 'typical';
const L = await local({ variant, engine: 'chromium' });
try {
  for (const dev of ['ipad-portrait', 'ipad-landscape']) {
    const d = await L.device({ device: dev, profile: 'eli', fixedTime: false });
    await d.ctx.route(L.api + '/api/**', async r => { const hold = r.request().method() === 'GET' && /\/api\/data\//.test(r.request().url()); await sleep(hold ? 2500 : 150); r.continue().catch(() => {}); });
    await d.ctx.addInitScript(() => {
      if (!/apps\/dollywood\.html/.test(location.href)) return;
      window.__s = []; window.__cls = 0;
      try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch {}
      const iv = setInterval(() => { const b = document.getElementById('b-now'), l = document.getElementById('b-list'), t = document.querySelector('[data-tab]');
        if (b) window.__s.push([Math.round(performance.now()), typeof curSec !== 'undefined' ? curSec : '?', b.offsetHeight, l ? Math.round(l.getBoundingClientRect().top + scrollY) : null, t ? Math.round(t.getBoundingClientRect().top + scrollY) : null]); }, 100);
      setTimeout(() => clearInterval(iv), 9000);
    });
    await d.page.goto(L.site + '/index.html#dollywood', { waitUntil: 'commit' });
    await sleep(9500);
    const f = d.page.frames().find(x => x.url().includes('/apps/dollywood.html'));
    const r = await f.evaluate(() => { const S = window.__s; const ch = []; for (let i = 1; i < S.length; i++) if (S[i][1] !== S[i - 1][1] || S[i][2] !== S[i - 1][2] || S[i][3] !== S[i - 1][3]) ch.push(S[i - 1], S[i]);
      return { first: S[0], last: S[S.length - 1], changes: ch.slice(0, 8), cls: +window.__cls.toFixed(4) }; });
    console.log(variant, dev, JSON.stringify(r));
    await d.close();
  }
} finally { await L.close(); }
