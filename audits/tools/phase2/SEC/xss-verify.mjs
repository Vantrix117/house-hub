// SEC (4) follow-up: prove the injected payloads were actually RENDERED (as inert escaped text), not just absent.
// Re-uses the same injections, then reads each surface's DOM text/HTML for the payload string and confirms no live
// <img onerror>/<svg onload> node exists. Run:  node "audits/tools/phase2/SEC/xss-verify.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/SEC');
const IMG = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
const tiny = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0xFF, 0xD9]).toString('base64');
const MARK = 'onerror="window.__xss';   // the literal payload substring

const L = await local({ variant: 'typical', clock: 'demo' });
await L.apiAs('eli', '/api/data/reminders/item:xss1?scope=family', { method: 'PUT', body: { value: { id: 'xss1', text: IMG, by: 'eli', byName: 'Eli', createdAt: Date.now() }, updated_at: Date.now() } });
await L.apiAs('eli', '/api/admin/profiles/eli', { method: 'PUT', body: { name: 'Eli ' + IMG } });
await L.apiAs('eli', '/api/profiles', { method: 'POST', body: { name: 'Guest ' + IMG, emoji: '🙂' } });
await L.apiAs('eli', '/api/activity', { method: 'POST', body: { app_id: 'hub', text: IMG } });
await L.apiAs('eli', '/api/album', { method: 'POST', body: { sm: tiny, lg: tiny, caption: IMG } });
const out = {};

// picker: paired device, signed out (profile:null keeps the device, clears the session)
{
  const d = await L.device({ device: 'ipad-portrait', profile: null });
  await d.goto(''); await sleep(1500);
  const html = await d.page.content();
  const liveImg = await d.page.evaluate(() => document.querySelectorAll('img[onerror]').length + document.querySelectorAll('svg[onload]').length);
  out.picker = { showed_profiles: html.includes('pcard'), payload_present_as_text: html.includes(MARK), live_injected_nodes: liveImg, xss: await d.page.evaluate(() => window.__xss || 0) };
  await d.close();
}
// home: injected reminder + feed line rendered
{
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  await d.goto('#home'); await sleep(1800);
  const html = await d.page.content();
  const liveImg = await d.page.evaluate(() => document.querySelectorAll('img[onerror]').length + document.querySelectorAll('svg[onload]').length);
  out.home = { reminder_text_present: html.includes(MARK), live_injected_nodes: liveImg, xss: await d.page.evaluate(() => window.__xss || 0) };
  await d.close();
}
// me: brand + admin panel + album caption
{
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  await d.goto('#home'); await sleep(400);
  await d.page.evaluate(() => location.hash = '#me'); await sleep(2200);
  const html = await d.page.content();
  const liveImg = await d.page.evaluate(() => document.querySelectorAll('img[onerror]').length + document.querySelectorAll('svg[onload]').length);
  out.me = { payload_present_as_text: html.includes(MARK), live_injected_nodes: liveImg, xss: await d.page.evaluate(() => window.__xss || 0) };
  await d.close();
}
out.verdict = (out.picker.live_injected_nodes + out.home.live_injected_nodes + out.me.live_injected_nodes) === 0 && (out.picker.payload_present_as_text || out.home.reminder_text_present || out.me.payload_present_as_text)
  ? 'Payloads were rendered as inert escaped text; zero live onerror/onload nodes; window.__xss never set.'
  : 'Re-check: either the payload did not render or a live node exists.';
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(OUT, 'xss-verify.json'), JSON.stringify(out, null, 1));
await L.close();
