// Does the signed-in person's colour (--accent, set by hub.js applyTheme at apps/hub.js:80) reach the Larder?
// Open the app standalone as Eli and as Mae on the iPad, collect every element's painted colours, and diff them.
// Also: glass layers (lib-vis glass()), radii nesting (radii()), the page's bottom band and overscroll, and the web-tell
// computed styles (tap highlight, user-select/callout on chrome, select appearance, focus ring on the name box).
import { local, save, shot, sleep } from './_lib.mjs';
import { install } from '../../phase2/VIS/lib-vis.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
const paint = () => [...document.querySelectorAll('body *')].filter(e => !e.closest('svg')).map((e, i) => {
  const s = getComputedStyle(e);
  return { i, tag: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''),
    v: [s.color, s.backgroundColor, s.borderTopColor, s.backgroundImage, s.boxShadow].join(' | ') };
});
try {
  for (const p of ['eli', 'christian']) {
    const d = await L.device({ device: 'ipad-portrait', profile: p });
    await d.page.goto(L.site + '/apps/leftovers.html', { waitUntil: 'load' });
    await d.page.waitForFunction(() => window.__larder && tally.textContent.length > 0);
    await sleep(300);
    out[p] = { accent: await d.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()), paint: await d.page.evaluate(paint) };
    if (p === 'eli') {
      await install(d.page);
      out.glass = await d.page.evaluate(() => __vis.glass());
      out.radii = await d.page.evaluate(() => __vis.radii());
      out.tells = await d.page.evaluate(() => {
        const g = (sel, props) => { const el = document.querySelector(sel); const s = getComputedStyle(el); return Object.fromEntries(props.map(p => [p, s.getPropertyValue(p) || s[p]])); };
        const nameBox = document.getElementById('name'); nameBox.focus();
        const focus = g('#name', ['outline-style', 'box-shadow', 'border-top-color']);
        nameBox.blur();
        return {
          body: g('body', ['-webkit-tap-highlight-color', 'touch-action', 'overscroll-behavior-y', '-webkit-user-select', '-webkit-touch-callout', 'background-color']),
          html: g('html', ['background-color', 'overscroll-behavior-y']),
          doneBtn: g('.done', ['-webkit-tap-highlight-color', '-webkit-user-select', 'transition-duration', 'transform']),
          chip: g('.status', ['-webkit-user-select']), h1: g('h1', ['-webkit-user-select']),
          select: g('#size', ['-webkit-appearance', 'appearance', 'background-color', 'background-image']),
          nameFocus: focus,
          pressRules: [...document.styleSheets].flatMap(ss => { try { return [...ss.cssRules].map(r => r.cssText).filter(t => /:active/.test(t) && /leftovers|\.log|\.done|\.copy/.test(t)); } catch { return []; } }).slice(0, 10),
          scrollbarChrome: getComputedStyle(document.documentElement).scrollbarWidth,
        };
      });
      out.shot = await shot(d.page, 'accent-eli-ipad.png', { clip: { x: 0, y: 1000, width: 820, height: 180 } });
    } else out.shotMae = await shot(d.page, 'accent-mae-ipad.png', { clip: { x: 0, y: 1000, width: 820, height: 180 } });
    await d.close();
  }
  const diff = out.eli.paint.filter((e, i) => out.christian.paint[i] && out.christian.paint[i].v !== e.v).map(e => ({ el: e.tag, eli: e.v.slice(0, 220), mae: out.christian.paint[e.i].v.slice(0, 220) }));
  const res = { accentEli: out.eli.accent, accentMae: out.christian.accent, elementsThatDiffer: diff, glass: out.glass, radii: out.radii, tells: out.tells, shots: [out.shot, out.shotMae] };
  console.log(JSON.stringify({ ...res, elementsThatDiffer: diff.map(d => d.el) }, null, 1));
  console.log('saved', save('accent-and-tells.json', res));
} finally { await L.close(); }
