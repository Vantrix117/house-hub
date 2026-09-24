// Report patch (after the completeness critic): four small measurements the critic asked for.
//   1. Lead 01-leads.md:138 per device: after Log, is the new card on screen above the fixed add bar?
//      Same method as taps.mjs (card rect vs #add rect inside the frame, no scroll), on all five devices.
//   2. Lead 01-leads.md:148 byName facet: on the overflow seed, how many .meta lines wrap to 2+ lines, and whose?
//   3. CLAUDE.md step 6 (Enter/Escape): does Escape in #name do anything?
//   4. Focus after ✓ (keyboard): where does focus go after Enter on a focused ✓ (render() rebuilds the list)?
//   Also records the computed font sizes of #name, select#size and #date (iOS zooms on focus below 16 px).
// Typical seed (1, 3, 4) and overflow seed (2), demo clock, WebKit, Eli. Writes critic-followups.json.
import { local, sleep, save, shot, openLarder, serverItems } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = { newCard: {}, metaWrap: {}, keys: {} };
try {
  // 1. new card vs the add bar, per device
  for (const dev of ['iphone-pwa', 'iphone-safari', 'ipad-portrait', 'ipad-landscape', 'desktop']) {
    await L.reset('typical');
    const d = await L.device({ device: dev, profile: 'eli' });
    await d.goto('#home');
    const f = await openLarder(d);
    await sleep(800);
    await f.fill('#name', 'Taco soup'); await f.click('.log'); await sleep(1500);
    out.newCard[dev] = await f.evaluate(() => {
      const c = [...document.querySelectorAll('.item')].find(c => c.querySelector('.nm').textContent === 'Taco soup');
      const r = c.getBoundingClientRect(), bar = document.getElementById('add').getBoundingClientRect();
      return { cardTop: Math.round(r.top), cardBottom: Math.round(r.bottom), barTop: Math.round(bar.top), innerH: innerHeight, scrollY: Math.round(scrollY), visibleAboveBar: r.bottom <= bar.top && r.top >= 0 };
    });
    if (dev === 'iphone-safari' || dev === 'desktop') out.newCard[dev].shot = await shot(d.page, `critic-followups-logged-${dev}.png`);
    console.log('newCard', dev, JSON.stringify(out.newCard[dev]));
    await d.close();
  }

  // 3 + 4. Escape in the name field; focus after a keyboard ✓ (iPad portrait)
  await L.reset('typical');
  {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
    await d.goto('#home');
    const f = await openLarder(d);
    await sleep(800);
    out.fontPx = await f.evaluate(() => Object.fromEntries(['name', 'size', 'date'].map(id => [id, getComputedStyle(document.getElementById(id)).fontSize])));
    await f.fill('#name', 'Half-typed soup');
    await f.press('#name', 'Escape');
    out.keys.escape = await f.evaluate(() => ({ nameValue: document.getElementById('name').value, focused: document.activeElement && (document.activeElement.id || document.activeElement.tagName) }));
    await f.fill('#name', '');
    const firstName = await f.evaluate(() => document.querySelector('.item .nm').textContent);
    await f.focus('.item .done');
    out.keys.before = await f.evaluate(() => document.activeElement.getAttribute('aria-label'));
    await d.page.keyboard.press('Enter');
    await sleep(600);
    out.keys.afterDone = await f.evaluate(() => { const a = document.activeElement; return { tag: a && a.tagName, id: a && a.id, cls: a && a.className, isBody: a === document.body, ariaLabel: a && a.getAttribute && a.getAttribute('aria-label') }; });
    await sleep(3500);
    out.keys.removedFirst = !(await serverItems(L)).some(i => i.name === firstName);
    out.keys.firstName = firstName;
    console.log('fontPx', JSON.stringify(out.fontPx));
    console.log('keys', JSON.stringify(out.keys));
    await d.close();
  }

  // 2. byName wrap on the overflow seed
  await L.reset('overflow');
  for (const dev of ['iphone-pwa', 'ipad-portrait']) {
    const d = await L.device({ device: dev, profile: 'eli' });
    await d.goto('#home');
    const f = await openLarder(d);
    await sleep(800);
    out.metaWrap[dev] = await f.evaluate(() => {
      const rows = [...document.querySelectorAll('.item')].map(c => {
        const m = c.querySelector('.meta'); const lh = parseFloat(getComputedStyle(m).lineHeight) || 12.5 * 1.2;
        return { name: c.querySelector('.nm').textContent.slice(0, 40), meta: m.textContent, lines: Math.round(m.getBoundingClientRect().height / lh) };
      });
      const wrapped = rows.filter(r => r.lines > 1);
      return { cards: rows.length, wrapped: wrapped.length, examples: wrapped.slice(0, 6) };
    });
    console.log('metaWrap', dev, JSON.stringify({ cards: out.metaWrap[dev].cards, wrapped: out.metaWrap[dev].wrapped, ex: out.metaWrap[dev].examples.slice(0, 3) }));
    await d.close();
  }
  console.log('saved', save('critic-followups.json', out));
} finally { await L.close(); }
