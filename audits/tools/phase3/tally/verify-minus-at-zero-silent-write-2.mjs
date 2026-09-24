// Skeptic #2 for "minus-at-zero-silent-write" (Tally). Independent, minimal re-run.
//   S  one device (Eli, iPhone PWA, inside the shell viewer): Reset, then tap − three times at 0.
//      Records every POST /api/data/tally/batch (value + updated_at), the server row before/after, the button's
//      disabled/aria state, and whether any toast/aria-live feedback appears.
//   X  context for the "widens the lost-increment window" clause: two devices of Eli, both showing 0 after a pull;
//      the phone taps + x5 (flushed); the iPad (stale, still showing 0) taps − once — a tap that looks like a no-op.
//      Does the server row go 5 -> 0?
// Run: node "audits/tools/phase3/tally/verify-minus-at-zero-silent-write-2.mjs"   (and CLOCK=real node ... for the -realclock.json)
//   -> audits/evidence/p3/tally/verify-minus-at-zero-silent-write-2.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally/verify-minus-at-zero-silent-write-2' + (process.env.CLOCK === 'real' ? '-realclock' : '') + '.json';
const CLOCK = process.env.CLOCK || 'demo';   // CLOCK=real: server stamps on the real clock (the demo clock is slowed, so cross-device skew orders writes oddly)
const L = await local({ variant: 'typical', clock: CLOCK, engine: 'webkit' });
const res = {};
const server = async () => { const r = await L.apiAs('eli', '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? { value: it.value, updated_at: it.updated_at } : null; };
const shown = f => f.evaluate(() => document.getElementById('n').textContent);
const ready = f => f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 10000 });
try {
  { // S
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    let posts = [];
    d.page.on('request', r => { if (r.method() === 'POST' && r.url().includes('/api/data/tally/batch')) posts.push(r.postDataJSON()); });
    const f = await d.openApp('tally'); await ready(f);
    await f.locator('#reset').click(); await sleep(1000);
    const before = await server();
    posts = [];
    const toasts = [];
    for (let i = 0; i < 3; i++) {
      await f.locator('#minus').click(); await sleep(700);
      toasts.push(await d.page.evaluate(() => [...document.querySelectorAll('[role=status],[aria-live],.toast')].map(e => e.textContent.trim()).filter(Boolean)));
    }
    const after = await server();
    const btn = await f.evaluate(() => { const b = document.getElementById('minus'); return { disabled: b.disabled, ariaDisabled: b.getAttribute('aria-disabled'), opacity: getComputedStyle(b).opacity }; });
    const frameLive = await f.evaluate(() => [...document.querySelectorAll('[role=status],[aria-live],.toast')].map(e => e.textContent.trim()));
    res.S = { display: await shown(f), serverBefore: before, serverAfter: after, posts: posts.length,
      items: posts.map(p => p.items.map(i => ({ key: i.key, value: i.value, updated_at: i.updated_at }))),
      rowRestamped: !!(before && after && after.updated_at > before.updated_at), minusButton: btn, shellFeedback: toasts, frameFeedback: frameLive };
    console.log('S', JSON.stringify(res.S));
    await d.close();
  }
  { // X
    const ph = await L.newDevice({ name: 'Verify2 phone', profiles: ['eli'] });
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    const ipadNet = [];
    ipad.page.on('response', async r => { if (r.url().includes('/api/data/tally')) { let body = null; try { body = await r.json(); } catch {} ipadNet.push({ method: r.request().method(), url: r.url().split('/api/')[1], sent: r.request().method() === 'POST' ? r.request().postDataJSON() : undefined, status: r.status(), body }); } });
    const fi = await ipad.openApp('tally'); await ready(fi);
    const fp = await phone.openApp('tally'); await ready(fp);
    await fp.locator('#reset').click(); await sleep(1200);
    await fi.evaluate(() => hub.pull()); await sleep(500);
    const start = { server: await server(), ipad: await shown(fi), phone: await shown(fp) };
    for (let i = 0; i < 5; i++) await fp.locator('#plus').click();
    await sleep(1500);
    const afterPhone = { server: await server(), ipadShows: await shown(fi) };
    const mark = ipadNet.length;
    const ipadLocal = await fi.evaluate(() => { try { return Object.keys(localStorage).filter(k => k.includes('tally')).map(k => [k, localStorage.getItem(k).slice(0, 300)]); } catch (e) { return String(e); } });
    await fi.locator('#minus').click(); await sleep(1500);
    const afterIpadMinus = await server();
    res.X_ipadLocalBeforeMinus = ipadLocal;
    res.X_ipadNetAfterMinus = ipadNet.slice(mark);
    res.X_ipadShowsAfterMinus = await shown(fi);
    res.X = { start, afterPhone, afterIpadMinus, phoneTapsLost: (afterPhone.server?.value ?? 0) - (afterIpadMinus?.value ?? 0) };
    console.log('X', JSON.stringify(res.X));
    await ipad.close(); await phone.close();
  }
} catch (e) { res.error = String(e && e.stack || e); console.error(e); }
finally {
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  await L.close();
}
