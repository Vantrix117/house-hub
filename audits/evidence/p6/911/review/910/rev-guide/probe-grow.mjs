// R-guide review probe (temporary; deleted after the review): what grows below the map on a cold open in the viewer (iPad portrait, held pull)
import { local, sleep } from 'file:///C:/Users/ex_bo/hub-audit/audits/tools/lib/local.mjs';
const L = await local({ variant: 'typical', engine: 'chromium' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await d.ctx.route(L.api + '/api/**', async r => { const u = r.request().url(); const hold = r.request().method() === 'GET' && /\/api\/data\//.test(u); await sleep(hold ? 2500 : 150); r.continue().catch(() => {}); });
  await d.ctx.addInitScript(() => {
    if (!/apps\/dollywood\.html/.test(location.href)) return;
    const w = window; w.__g = [];
    const desc = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
    const iv = setInterval(() => { if (!document.body) return; const m = {};
      for (const el of document.querySelectorAll('body *')) { if (el.closest('svg') || el.closest('#view3d')) continue; const h = el.offsetHeight; if (h > 60) m[desc(el)] = h; }
      w.__g.push({ t: Math.round(performance.now()), m, sy: scrollY }); }, 100);
    setTimeout(() => clearInterval(iv), 9000);
  });
  await d.page.goto(L.site + '/index.html#dollywood', { waitUntil: 'commit' });
  await sleep(9500);
  const f = d.page.frames().find(x => x.url().includes('/apps/dollywood.html'));
  const r = await f.evaluate(() => { const S = window.__g; const first = S.find(s => Object.keys(s.m).length > 20) || S[0], last = S[S.length - 1]; const out = [];
    for (const k in last.m) if (first.m[k] != null && Math.abs(last.m[k] - first.m[k]) >= 20) out.push([k, first.m[k], last.m[k]]);
    for (const k in last.m) if (first.m[k] == null) out.push([k, 'new', last.m[k]]);
    // when did #b-list / tabs grow
    const tl = S.filter((s, i) => i % 5 === 0).map(s => [s.t, s.m['div#b-list.blist'], s.m['div#b-now.bnow'] || s.m['div#b-now.bnow.sk'], s.sy].join('/'));
    return { firstT: first.t, lastT: last.t, out: out.sort((a, b) => (typeof b[2] === 'number' ? b[2] - (+b[1] || 0) : 0) - (typeof a[2] === 'number' ? a[2] - (+a[1] || 0) : 0)).slice(0, 25), tl }; });
  console.log(JSON.stringify(r, null, 1));
  await d.close();
} finally { await L.close(); }
