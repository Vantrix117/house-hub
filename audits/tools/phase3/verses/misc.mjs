// Smaller checks, one run:
//  (a) the 104 references in Verses' REFS (apps/verses.html:178-192) against F260's PLAN[].m (apps/f260.html), and what
//      sayRef() speaks for each (apps/verses.html:260-265);
//  (b) keyboard: with focus on "Read aloud", Enter reveals instead of reading (the document keydown handler, 373-378,
//      calls preventDefault on Enter before the button's click);
//  (c) a guest (Grandma Jo) opens Verses; the TV (kiosk) opens apps/verses.html by URL;
//  (d) "Practise one anyway" as Elizabeth: pill, stats and Due-today list afterwards (lead);
//  (e) Eli's overflow household: pill and long queue.
import fs from 'node:fs';
import { local, DEMO, sleep } from '../../lib/local.mjs';
import { openVerses, state, save, shot } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
try {
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO });
  const v = await openVerses(ipad);
  const refs = await v.evaluate(() => window.verses.REFS);
  out.sayRef = await v.evaluate(() => window.verses.REFS.flat().map(r => [r, window.verses.sayRef(r)]));
  out.sayRefUnparsed = out.sayRef.filter(([r, s]) => r === s);
  // PLAN is a const inside F260's hub.ready() closure, so read it from the file (apps/f260.html:788 onward)
  const src = fs.readFileSync('apps/f260.html', 'utf8');
  const plan = [...src.slice(src.indexOf('const PLAN = [')).matchAll(/\{ w: (\d+),[^\n]*?m: (\[[^\]]*\])/g)].slice(0, 52).map(x => JSON.parse(x[2]));
  out.refsMatchPlan = JSON.stringify(plan) === JSON.stringify(refs);
  out.refsDiff = plan.flatMap((m, w) => m.map((r, i) => r !== refs[w][i] ? { week: w + 1, i, f260: r, verses: refs[w][i] } : null)).filter(Boolean);
  out.oddRefs = refs.flat().filter(r => /^Psalm 1:1-7$|^Jeremiah 1:15$/.test(r));
  // (b)
  const v2 = await openVerses(ipad);
  await v2.evaluate(() => { window.__spoke = 0; try { speechSynthesis.speak = () => { window.__spoke++; }; } catch {} });
  await v2.focus('#say'); await ipad.page.keyboard.press('Enter'); await sleep(300);
  out.enterOnReadAloud = await v2.evaluate(() => ({ revealed: !document.getElementById('act-rate').hidden, spoke: window.__spoke, focused: document.activeElement && document.activeElement.id }));
  await ipad.close();
  // (c) guest and TV
  const g = await L.device({ device: 'iphone-pwa', profile: 'guest-grandmajo', installClock: DEMO }).catch(e => null);
  if (g) {
    await g.goto('#apps'); await sleep(1500);
    out.guestSeesTile = await g.page.locator('.tile[data-id="verses"]').count();
    const gf = await openVerses(g);
    out.guest = await state(gf);
    out.guestShot = await shot(g.page, 'guest-iphone.png');
    await g.close();
  } else out.guest = 'no guest session in the rig';
  const tv = await L.device({ device: 'tv', profile: 'tv', installClock: DEMO });
  await tv.page.goto(L.site + '/apps/verses.html'); await sleep(2500);
  out.tv = await tv.page.evaluate(() => ({ url: location.pathname, trainer: !document.getElementById('trainer').hidden, empty: !document.getElementById('empty').hidden, done: !document.getElementById('done').hidden, who: document.getElementById('who').textContent, hint: document.getElementById('hint').textContent }));
  out.tvShot = await shot(tv.page, 'tv-standalone.png');
  await tv.close();
  // (d) Practise one anyway
  const mom = await L.device({ device: 'iphone-pwa', profile: 'mom', installClock: DEMO });
  await mom.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
  const mf = await openVerses(mom);
  out.momBefore = await state(mf);
  await mf.click('#again'); await sleep(300);
  out.momAfterAnyway = await state(mf);
  await mf.evaluate(() => document.getElementById('queue').scrollIntoView()); await sleep(200);
  out.momShot = await shot(mom.page, 'practise-anyway-queue-iphone.png');
  await mom.close();
  // (e) overflow
  await L.reset('overflow');
  const ov = await L.device({ device: 'iphone-pwa', profile: 'ezra', installClock: DEMO });
  const of = await openVerses(ov);
  out.overflowKid = await state(of);
  out.overflowKidPill = await of.evaluate(() => { const r = document.getElementById('who').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, text: document.getElementById('who').textContent }; });
  out.overflowShot = await shot(ov.page, 'overflow-kid-iphone.png');
  console.log(JSON.stringify({ ...out, sayRef: out.sayRef.filter((x, i) => i % 13 === 0) }, null, 1));
  save('misc.json', out);
} finally { await L.close(); }
