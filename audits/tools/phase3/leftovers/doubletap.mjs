// Double-tap on a ✓ ("Mark used up"): does the second tap land on the NEXT card's ✓ and remove a second item?
// Typical seed, demo clock, Eli on the iPhone PWA (430x932, touch) and the iPad portrait.
// Arms: A = two touch taps 180 ms apart on Sunday pot roast's ✓ (first of three Fresh cards);
//       B = mouse dblclick on the same ✓ (iPad); C = two touch taps 180 ms apart on Beef and bean chili's ✓ (first Aging card).
import { local, sleep, openLarder, cards, serverItems, save, shot } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
async function arm(name, device, target, how) {
  await L.reset('typical');
  const d = await L.device({ device, profile: 'eli' });
  const f = await openLarder(d);
  const before = (await cards(f)).map(c => c.name);
  const btn = await f.$(`.item:has(.nm:text-is("${target}")) .done`);
  const box = await btn.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const nextBefore = await f.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); const c = el && el.closest('.item'); return c ? c.querySelector('.nm').textContent : null; }, [x - (await f.frameElement().then(e => e.boundingBox())).x, y - (await f.frameElement().then(e => e.boundingBox())).y]);
  if (how === 'touch') { await d.page.touchscreen.tap(x, y); await sleep(180); await d.page.touchscreen.tap(x, y); }
  else await d.page.mouse.dblclick(x, y);
  await sleep(1500);
  const after = (await cards(f)).map(c => c.name);
  await sleep(2500);   // let the queue flush
  const srv = (await serverItems(L)).map(i => i.name);
  const feed = (await L.apiAs('eli', '/api/activity')).body;
  const feedLines = JSON.stringify(feed).match(/Finished the [^"]+/g) || [];
  const s = await shot(d.page, `doubletap-${name}-${device}.png`);
  out[name] = { device, how, target, tapPoint: { x: Math.round(x), y: Math.round(y) }, underFingerBefore: nextBefore, before, afterUI: after, removedUI: before.filter(n => !after.includes(n)), serverLive: srv, removedOnServer: before.filter(n => !srv.includes(n)), finishedFeedLines: feedLines, undoUi: await f.evaluate(() => !!document.querySelector('[class*=undo], .toast')), shot: s };
  console.log(name, JSON.stringify({ removedUI: out[name].removedUI, removedOnServer: out[name].removedOnServer, finishedFeedLines: feedLines, undoUi: out[name].undoUi }));
  await d.close();
}
try {
  await arm('A-touch-fresh', 'iphone-pwa', 'Sunday pot roast', 'touch');
  await arm('B-dblclick-fresh', 'ipad-portrait', 'Sunday pot roast', 'dblclick');
  await arm('C-touch-aging', 'iphone-pwa', 'Beef and bean chili', 'touch');
  console.log('saved', save('doubletap.json', out));
} finally { await L.close(); }
