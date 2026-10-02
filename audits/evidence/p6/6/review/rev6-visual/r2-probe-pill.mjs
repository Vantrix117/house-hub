// visual reviewer: the shell pill (multi-timer, ringing vs toast) at every width, adult and kid, default and XXL text
import { local, sleep } from './wr2/audits/tools/lib/local.mjs';
import fs from 'node:fs';
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'real' });
const W = [[375, 667], [390, 844], [820, 1180], [1024, 768], [1180, 820], [1440, 900]];
const measure = () => {
  const r = e => { if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return b.width ? [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] : null; };
  const p = document.querySelector('#timer-pill'), q = s => p.querySelector(s);
  const toast = document.getElementById('hub-toast');
  const ov = (a, b) => a && b && a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  const kids = [...p.children].filter(c => !c.hidden && getComputedStyle(c).display !== 'none').map(c => ({ c: c.className.baseVal ?? c.className, r: r(c) }));
  let overlaps = []; for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) if (ov(kids[i].r, kids[j].r)) overlaps.push(kids[i].c + '×' + kids[j].c);
  const pr = r(p);
  const outside = kids.filter(k => k.r && pr && (k.r[0] < pr[0] - 1 || k.r[2] > pr[2] + 1)).map(k => k.c);
  const tr = toast && !toast.hidden ? r(toast) : null;
  let stopHit = null; const st = q('.tp-stop'); if (st && !st.hidden && getComputedStyle(st).display !== 'none') { const b = st.getBoundingClientRect(); const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); stopHit = el ? (p.contains(el) ? 'pill' : (el.closest('#hub-toast') ? 'toast' : el.tagName + '#' + el.id)) : null; }
  return { vw: innerWidth, hidden: p.hidden, pill: pr, text: p.innerText.replace(/\s+/g, ' '), label: p.getAttribute('aria-label'), overlaps, outside, toast: tr, toastOverPill: ov(tr, pr), stopHit, scrollW: document.documentElement.scrollWidth, h: pr ? pr[3] - pr[1] : 0 };
};
const res = [];
for (const prof of ['mom', 'ezra']) for (const xxl of (process.argv[3] === 'xxl' ? [true] : [false, true])) for (const [w, h] of W) {
  const d = await L.device({ device: w >= 1024 ? 'desktop' : w >= 800 ? 'ipad-portrait' : 'iphone-pwa', profile: prof, fixedTime: false, localStorage: xxl ? { 'hub.prefs': { textSize: 'xxl' } } : null });
  await d.page.setViewportSize({ width: w, height: h });
  await d.goto('#home');
  await d.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull, null, { timeout: 10000 }).catch(() => {});
  if (xxl) await d.page.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl'));
  await sleep(500);
  // clear any seeded timers, then three: a long label 20 min, a 12 min pasta, and one that ends in 2 s
  await d.page.evaluate(async () => { for (const r of hub.timers.list({ stale: true })) { try { await hub.timers.clear(r.id, r.startedAt); } catch {} } });
  await sleep(600);
  await d.page.evaluate(() => { const T = hub.timers; T.start({ total: 1200000, label: 'Lasagna for the church potluck supper' }); T.start({ total: 720000, label: 'Pasta' }); T.start({ total: 2500, label: 'Tea' }); });
  await sleep(1200);
  const run = await d.page.evaluate(measure);
  await d.shot(`${OUT}/pill-${prof}-${xxl ? 'xxl' : 'std'}-${w}-running.png`);
  await sleep(3000);
  const ring = await d.page.evaluate(measure);
  await d.shot(`${OUT}/pill-${prof}-${xxl ? 'xxl' : 'std'}-${w}-ringing.png`);
  await sleep(8500);
  const after = await d.page.evaluate(measure);
  res.push({ prof, xxl, w, run, ring, after, errs: d.logs.filter(l => /pageerror|error:/.test(l)).slice(0, 3) });
  console.log(prof, xxl ? 'xxl' : 'std', w, JSON.stringify({ run: [run.text, run.h, run.overlaps, run.outside, run.scrollW], ring: [ring.text, ring.overlaps, ring.outside, 'toastOver', ring.toastOverPill, 'stopHit', ring.stopHit], after: [after.text, after.overlaps, after.outside, after.stopHit] }));
  await d.page.evaluate(async () => { for (const r of hub.timers.list({ stale: true })) { try { await hub.timers.clear(r.id, r.startedAt); } catch {} } });
  await sleep(400);
  await d.close();
}
fs.writeFileSync(`${OUT}/pill.json`, JSON.stringify(res, null, 1));
await L.close();
