// (a) The trainer card's reserved height (apps/verses.html:33-35 min-height 448 / kid 520 / 380 at ≥560 px) versus its
//     content before Show: the empty band between the last button and the card's bottom edge, per device and audience.
// (b) A quick double tap on "Got it" on the iPad (three rating columns become two Show/Read-aloud columns on the next card,
//     apps/verses.html:49): where does the second tap land? Ratings stay on the device (batch aborted).
// (c) Transitions on the card when the next verse replaces the rated one (computed transition/animation on #trainer, #ref).
import { local, DEMO, sleep } from '../../lib/local.mjs';
import { openVerses, state, save, shot } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = { band: [] };
const band = f => f.evaluate(() => { const c = document.getElementById('trainer').getBoundingClientRect(); const kids = [...document.getElementById('trainer').children].filter(e => !e.hidden && e.getBoundingClientRect().height > 0); const last = Math.max(...kids.map(e => e.getBoundingClientRect().bottom)); const pad = parseFloat(getComputedStyle(document.getElementById('trainer')).paddingBottom); return { cardH: Math.round(c.height), emptyBand: Math.round(c.bottom - last - pad), minH: getComputedStyle(document.getElementById('trainer')).minHeight }; });
try {
  for (const [device, profile] of [['iphone-pwa', 'eli'], ['iphone-pwa', 'ezra'], ['ipad-portrait', 'eli'], ['ipad-portrait', 'ezra'], ['desktop', 'eli']]) {
    const d = await L.device({ device, profile, installClock: DEMO });
    const f = await openVerses(d);
    const before = await band(f);
    await f.click('#show'); await sleep(200);
    const after = await band(f);
    out.band.push({ device, profile, beforeShow: before, afterShow: after });
    await d.close();
  }
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO });
  await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
  const f = await openVerses(d);
  out.transitions = await f.evaluate(() => ['#trainer', '#ref', '#act-rate', '#act-show', '.ds .actions .btn'].map(s => { const e = document.querySelector(s); const cs = getComputedStyle(e); return { s, transition: cs.transition.slice(0, 120), animation: cs.animationName }; }));
  await f.click('#show'); await sleep(200);
  const box = await f.evaluate(() => { const r = document.querySelector('[data-rate="got"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const frameOff = await d.page.evaluate(() => { const r = document.querySelector('iframe').getBoundingClientRect(); return { x: r.x, y: r.y }; });
  const before = await state(f);
  await d.page.mouse.click(frameOff.x + box.x, frameOff.y + box.y);
  await sleep(90);
  await d.page.mouse.click(frameOff.x + box.x, frameOff.y + box.y);
  await sleep(300);
  const after = await state(f);
  out.doubleTap = { first: before.ref, nowOnCard: after.ref, secondTapRevealedNext: await f.evaluate(() => !document.getElementById('act-rate').hidden), hint: after.hint };
  out.doubleTapShot = await shot(d.page, 'double-tap-ipad.png');
  console.log(JSON.stringify(out, null, 1));
  save('layout.json', out);
} finally { await L.close(); }
