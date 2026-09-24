// Skeptic #2 for finding "media-public-forever": are photo URLs public, and can a household member revoke one?
// Also: can a media URL leak through a Referer when the hub opens an external link (the finding's failure scenario)?
// Run:  node "audits/tools/phase2/SEC/verify-media-public-forever-2.mjs"
// Local rig only (no production). Writes audits/evidence/p2/SEC/verify-media-public-forever-2.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/SEC/verify-media-public-forever-2.json');
const jpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0xFF, 0xD9]).toString('base64');
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
try {
  // bare GET with no tokens, no Origin — what a stranger holding the URL would do
  const anon = async rel => { const r = await fetch(L.api + rel); await r.arrayBuffer(); return { status: r.status, cache_control: r.headers.get('cache-control'), acao: r.headers.get('access-control-allow-origin') }; };

  // 1. profile photo: upload → public → replace → old URL → remove → URL
  const up1 = await L.apiAs('eli', '/api/profiles/eli/photo', { method: 'PUT', body: { sm: jpeg, lg: jpeg } });
  const url1 = up1.body.profile && up1.body.profile.photo && up1.body.profile.photo.sm;
  out.profile_upload = { status: up1.status, url_shape: url1 && url1.replace(/\/[\w-]+-256/, '/<token>-256'), token_chars: url1 && url1.match(/\/([\w-]+)-256/)[1].length };
  out.profile_anon_get = await anon(url1);
  out.profile_wrong_token = await anon(url1.replace(/\/[\w-]+-256/, '/AAAAAAAAAAAA-256'));
  const up2 = await L.apiAs('eli', '/api/profiles/eli/photo', { method: 'PUT', body: { sm: jpeg, lg: jpeg } });
  const url2 = up2.body.profile.photo.sm;
  await sleep(300);   // deletePrefix of the old token runs in waitUntil (worker/src/index.js:349)
  out.after_replace = { old_url: await anon(url1), new_url: await anon(url2), token_changed: url1 !== url2 };
  const del = await L.apiAs('eli', '/api/profiles/eli/photo', { method: 'DELETE' });
  out.after_remove_photo = { delete_status: del.status, url: await anon(url2) };

  // 2. album photo: add → public → delete → URL
  const al = await L.apiAs('eli', '/api/album', { method: 'POST', body: { sm: jpeg, lg: jpeg, caption: 'skeptic probe' } });
  const aurl = al.body.photo && al.body.photo.lg;
  out.album_anon_get = await anon(aurl);
  const adel = await L.apiAs('eli', '/api/album/' + al.body.photo.id, { method: 'DELETE' });
  out.album_after_delete = { delete_status: adel.status, url: await anon(aurl) };

  // 3. Referer: the hub shell showing a photo opens an external link — what Referer does the third party get?
  const up3 = await L.apiAs('eli', '/api/profiles/eli/photo', { method: 'PUT', body: { sm: jpeg, lg: jpeg } });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const seen = [];
  await d.ctx.route('https://thirdparty.example/**', r => { seen.push({ url: r.request().url(), referer: r.request().headers()['referer'] || null }); r.fulfill({ status: 200, contentType: 'text/html', body: '<p>ok</p>' }); });
  await d.goto('#me');
  await sleep(1500);
  const shellUrl = d.page.url();
  const imgs = await d.page.evaluate(() => [...document.querySelectorAll('img')].map(i => i.src).filter(s => s.includes('/api/media/')).length);
  // same-tab navigation and a new-tab link (target=_blank rel=noopener, like the apps' external links)
  await d.page.evaluate(() => { const a = document.createElement('a'); a.href = 'https://thirdparty.example/newtab'; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); });
  await sleep(800);
  await d.page.evaluate(() => { location.href = 'https://thirdparty.example/sametab'; });
  await sleep(800);
  out.referer = { shell_url: shellUrl.replace(/:\d+/, ':<port>'), media_imgs_on_page: imgs, third_party_requests: seen.map(s => ({ url: s.url, referer: s.referer && s.referer.replace(/:\d+/, ':<port>'), contains_media_url: !!(s.referer && s.referer.includes('/api/media/')) })) };
  out.profile_photo_for_referer_test = up3.status;
} finally {
  await L.close();
}
console.log(JSON.stringify(out, null, 1));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
