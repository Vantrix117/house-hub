// Skeptic #1 for "Pill and meeting-bar ellipsis cuts off the location-denied instructions and the meeting note on iPhone".
// Measures #loc-sec/#loc-acc (pill) and #meet-name/#meet-meta (meeting bar): text, scrollWidth vs clientWidth, lines,
// on iPhone (430), iPhone Safari (430) and iPad portrait (820), adult + kid, denied / idle / designed-denied (updLoc) states.
// Run: node "audits/tools/phase3/dollywood-live/verify-vis-pill-and-meeting-bar-ellipsis-cuts-off-the-locat-1-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EV = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'dollywood-live');
const PRE = 'verify-vis-pill-and-meeting-bar-ellipsis-cuts-off-the-locat-1-1';
fs.mkdirSync(EV, { recursive: true });
const shot = (d, n, clip) => d.page.screenshot({ path: path.join(EV, `${PRE}-${n}.png`), scale: 'css', animations: 'disabled', caret: 'hide', ...(clip ? { clip } : {}) });

const measure = f => f.evaluate(() => {
  const m = id => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    return { text: e.textContent, visible: !e.closest('[hidden]') && r.width > 0, scrollW: e.scrollWidth, clientW: e.clientWidth, truncated: e.scrollWidth > e.clientWidth + 1,
      whiteSpace: cs.whiteSpace, textOverflow: cs.textOverflow, title: e.getAttribute('title') }; };
  const act = document.getElementById('lv-act');
  return { vw: innerWidth, pillState: document.getElementById('lv-pill').dataset.state, pillW: Math.round(document.getElementById('lv-pill').getBoundingClientRect().width),
    sec: m('loc-sec'), acc: m('loc-acc'), act: act.hidden ? null : act.textContent, meetName: m('meet-name'), meetMeta: m('meet-meta'),
    pillTitle: document.getElementById('lv-pill').getAttribute('title'), pillOnclick: typeof document.getElementById('lv-pill').onclick };
});

async function open(L, device, profile) {
  const d = await L.device({ device, profile, fixedTime: false });
  await d.goto('#home'); await sleep(1200);
  const f = await d.openApp('dollywood-live');
  await f.waitForSelector('#lv-pill[data-state]', { timeout: 20000 });
  await sleep(1500);
  return { d, f };
}

const out = {};
let L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const [dev, prof] of [['iphone-pwa', 'eli'], ['iphone-safari', 'eli'], ['ipad-portrait', 'eli'], ['iphone-pwa', 'ezra']]) {
    const key = `${dev}-${prof}`;
    const { d, f } = await open(L, dev, prof);
    const r = { initial: await measure(f) };
    // geolocation is NOT granted: tapping Find me makes WebKit reject watchPosition with code 1 (the error handler at :1404-1405)
    await f.click('#loc-btn').catch(e => { r.clickErr = String(e).slice(0, 120); });
    await sleep(2500);
    r.denied = await measure(f);
    if (dev === 'iphone-pwa' && prof === 'eli') await shot(d, 'denied-eli-iphone');
    // wait for any later updLoc (the designed denied state at :1267, with the Set my spot action)
    await sleep(8000);
    r.deniedLater = await measure(f);
    // force the designed denied state (the next updLoc call does this)
    await f.evaluate(() => updLoc()); await sleep(300);
    r.deniedUpdLoc = await measure(f);
    if (dev === 'iphone-pwa' && prof === 'eli') await shot(d, 'denied-updloc-eli-iphone');
    out[key] = r;
    await d.close();
  }
} finally { await L.close(); }

// overflow: the seeded meet row carries a long note (only writable through POST /api/dollywood/rally by hand: the app's
// setMeet/rally calls never pass a note, :1589-1592)
// clock 'real': loadMeet (:1579) drops a meet row older than 2 h by Date.now(), so the seed must be relative to now
L = await local({ variant: 'overflow', clock: 'real', engine: 'webkit' });
try {
  for (const dev of ['iphone-pwa', 'ipad-portrait']) {
    const { d, f } = await open(L, dev, 'eli');
    const r = { meet: await measure(f) };
    // the in-app strings meet-meta can hold (rally() at :1589): measure them in place on the real bar
    for (const [k, s] of [['rallyOk', 'Rallied 3 — set by you just now'], ['rallyFail', 'Set here (push failed — they will see it on their next sync)'],
      ['noNote', '6 min walk · set by Mae 18 min ago']]) {
      r[k] = await f.evaluate(s => { const e = document.getElementById('meet-meta'); e.textContent = s; return { text: s, scrollW: e.scrollWidth, clientW: e.clientWidth, truncated: e.scrollWidth > e.clientWidth + 1 }; }, s);
    }
    await f.evaluate(() => renderMeet());
    await shot(d, `meet-overflow-${dev}`, dev === 'ipad-portrait' ? { x: 0, y: 0, width: 820, height: 240 } : undefined);
    out[`overflow-${dev}`] = r;
    await d.close();
  }
} finally { await L.close(); }

// kid mode: in 'park' Ezra's beacon is on (seed/dollywood-live.mjs), so he can locate and hit the denied state
L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
try {
  const { d, f } = await open(L, 'iphone-pwa', 'ezra');
  const r = { initial: await measure(f) };
  await f.click('#loc-btn').catch(e => { r.clickErr = String(e).slice(0, 120); });
  await sleep(2500);
  r.denied = await measure(f);
  await shot(d, 'denied-ezra-park-iphone');
  out['park-iphone-pwa-ezra'] = r;
  await d.close();
} finally { await L.close(); }

fs.writeFileSync(path.join(EV, `${PRE}.json`), JSON.stringify(out, null, 2));
const brief = o => o && `${o.truncated ? 'TRUNC' : 'fits '} ${o.scrollW}/${o.clientW} "${o.text}"`;
for (const [k, r] of Object.entries(out)) {
  console.log('==', k);
  for (const [s, m] of Object.entries(r)) {
    if (m && m.acc) console.log(`  ${s}: state=${m.pillState} act=${m.act} pillW=${m.pillW}\n    sec ${brief(m.sec)}\n    acc ${brief(m.acc)}${m.meetName && m.meetName.visible ? `\n    meetName ${brief(m.meetName)}\n    meetMeta ${brief(m.meetMeta)}` : ''}`);
    else if (m && m.text) console.log(`  ${s}: ${brief(m)}`);
  }
}
console.log('wrote', path.join('audits/evidence/p3/dollywood-live', `${PRE}.json`));
