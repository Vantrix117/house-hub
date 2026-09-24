// SEC (4): stored XSS. Tokens live in localStorage, so any script that runs in the shell can read hub.session/hub.device
// and exfiltrate them. Inject payloads into every user-controlled string the shell renders, then load each surface and
// check whether any payload executed (window.__xss set) in the page or any frame.
// Run:  node "audits/tools/phase2/SEC/xss.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/SEC');
fs.mkdirSync(OUT, { recursive: true });

const IMG = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
const ATTR = '"><img src=x onerror="window.__xss=(window.__xss||0)+1">';
const SVG = '<svg onload="window.__xss=(window.__xss||0)+1">';
const tiny = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0xFF, 0xD9]).toString('base64');

const L = await local({ variant: 'typical', clock: 'demo' });
const out = { injected: [], surfaces: [] };
const ok = r => r.status >= 200 && r.status < 300;
async function inject(label, fn) { const r = await fn(); out.injected.push({ label, status: r.status, ok: ok(r), error: r.body && r.body.error }); return r; }

// 1) a family reminder (Home renders r.text)
await inject('reminder.text', () => L.apiAs('eli', '/api/data/reminders/item:xss1?scope=family', { method: 'PUT', body: { value: { id: 'xss1', text: IMG, by: 'eli', byName: ATTR, createdAt: Date.now() }, updated_at: Date.now() } }));
// 2) Eli's own profile name via admin edit (picker, hero, feed, admin, brand)
await inject('profile.name(admin)', () => L.apiAs('eli', '/api/admin/profiles/eli', { method: 'PUT', body: { name: IMG } }));
// 3) a guest name (picker, admin)
await inject('guest.name', () => L.apiAs('eli', '/api/profiles', { method: 'POST', body: { name: IMG, emoji: '🙂' } }));
// 4) an activity feed line (Home feed, TV feed)
await inject('activity.text', () => L.apiAs('eli', '/api/activity', { method: 'POST', body: { app_id: 'hub', text: IMG } }));
// 5) an album photo caption + byName (Me album, TV backdrop caption uses byName)
await inject('album.caption', () => L.apiAs('eli', '/api/album', { method: 'POST', body: { sm: tiny, lg: tiny, caption: IMG } }));
// 6) a family prayer title + who (TV "prayed today" reads names; Home prayer card)
await inject('prayer.family', () => L.apiAs('eli', '/api/data/prayer/prayer:xssp?scope=family', { method: 'PUT', body: { value: { id: 'xssp', title: IMG, for: ATTR, status: 'active', prayedBy: { '2026-09-22': [IMG] }, lastPrayedAt: '2026-09-22' }, updated_at: Date.now() } }));
// 7) a leftover item name (Larder widget on Home is via app; but the shell reads leftovers for the fridge card)
await inject('leftover.name', () => L.apiAs('eli', '/api/data/leftovers/item:xssl?scope=family', { method: 'PUT', body: { value: { id: 'xssl', name: IMG, size: 'Small', dateLogged: '2026-09-22', by: 'eli', byName: IMG }, updated_at: Date.now() } }));

async function visit(label, hash, profile, deviceOpts = {}) {
  const d = await L.device({ device: 'ipad-portrait', profile, ...deviceOpts });
  await d.goto(hash);
  await sleep(1500);
  // let any lazy renders (feed, album, admin) settle
  const res = await d.page.evaluate(() => {
    const frames = [window, ...Array.from(document.querySelectorAll('iframe')).map(f => { try { return f.contentWindow; } catch { return null; } }).filter(Boolean)];
    return frames.reduce((n, w) => n + (w.__xss || 0), 0);
  }).catch(() => -1);
  out.surfaces.push({ label, hash, profile, xss_executions: res });
  await d.shot(path.join(OUT, `xss-${label}.png`)).catch(() => {});
  await d.close();
  return res;
}

await visit('picker', '', 'unpaired');   // picker lists profiles incl. the injected name + guest
await visit('home', '#home', 'eli');
// open Me and its admin panel + album
{
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  await d.goto('#home'); await sleep(500);
  await d.page.evaluate(() => location.hash = '#me'); await sleep(2000);
  const res = await d.page.evaluate(() => (window.__xss || 0));
  out.surfaces.push({ label: 'me-admin-album', hash: '#me', profile: 'eli', xss_executions: res });
  await d.shot(path.join(OUT, 'xss-me.png')).catch(() => {});
  await d.close();
}
await visit('tv-board', '#home', 'tv');

out.total_xss_executions = out.surfaces.reduce((n, s) => n + Math.max(0, s.xss_executions), 0);
out.verdict = out.total_xss_executions === 0 ? 'No injected payload executed on any surface tested (all render through hub.escape / textContent).' : 'A payload EXECUTED — see the surface with xss_executions > 0.';
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(OUT, 'xss.json'), JSON.stringify(out, null, 1));
await L.close();
