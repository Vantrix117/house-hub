import { local, sleep } from './wt/audits/tools/lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
for (const dev of ['desktop', 'ipad-portrait']) {
  const d = await L.device({ device: dev, profile: 'eli' });
  await d.goto('#home');
  await d.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull, null, { timeout: 8000 }).catch(() => {});
  await sleep(800);
  const r = await d.page.evaluate(() => {
    const t = document.querySelector('#tabbar .tab[data-tab="me"]'); if (!t) return 'no tab';
    const b = t.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2;
    const at = document.elementFromPoint(x, y);
    const desc = e => e ? (e.tagName + '#' + e.id + '.' + [...e.classList].join('.')) : null;
    return { rect: [b.left, b.top, b.width, b.height].map(Math.round), at: desc(at), atParent: desc(at && at.closest('[id]')), pill: !document.querySelector('#timer-pill').hidden, pillRect: (() => { const p = document.querySelector('#timer-pill').getBoundingClientRect(); return [p.left, p.top, p.width, p.height].map(Math.round); })(), vis: getComputedStyle(t).visibility, disp: getComputedStyle(t).display, inner: innerWidth };
  });
  console.log(dev, JSON.stringify(r));
  await d.page.locator('#tabbar .tab[data-tab="me"]').click({ timeout: 5000, trial: true }).then(() => console.log('click ok'), e => console.log('click fail', e.message.split('\n').slice(0, 12).join(' | ')));
  await d.shot(`${process.argv[2]}/notif-${dev}.png`);
  console.log(d.logs.filter(l => /error/i.test(l)).slice(0, 5).join('\n'));
}
await L.close();
