// Skeptic #1 for SEC finding "media-public-forever": are photo/album URLs public, immutable and unrevocable?
// Checks the headers, then whether the owner CAN revoke (replace / delete), and whether revoking a device or
// signing out revokes media. Runs on the rig's local instance only (real worker/src on in-memory SQLite).
// Run:  node "audits/tools/phase2/SEC/verify-media-public-forever-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/SEC/verify-media-public-forever-1.json');
const L = await local({ variant: 'typical', clock: 'real' });
const out = {};
try {
  // a tiny valid JPEG (FFD8 … FFD9): decodeImage only checks the SOI marker and size
  const jpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, 0x4A, 0x46, 0x49, 0x46, 0, 1, 0xFF, 0xD9]).toString('base64');
  // raw GET with NO device/profile token and a hostile Origin — what any stranger holding the URL gets
  const bare = async (u, origin) => { const r = await fetch(L.api + u, { headers: origin ? { Origin: origin } : {} }); const b = Buffer.from(await r.arrayBuffer()); return { status: r.status, cache_control: r.headers.get('cache-control'), acao: r.headers.get('access-control-allow-origin'), bytes: b.length }; };

  // 1. profile photo: upload through the real route
  const up1 = await L.apiAs('eli', '/api/profiles/eli/photo', { method: 'PUT', body: { sm: jpeg, lg: jpeg } });
  const p1 = up1.body.profile && up1.body.profile.photo;
  out.profile_photo = { upload_status: up1.status, urls: p1 };
  const tok1 = p1.sm.match(/\/([\w-]+)-256\.jpg$/)[1];
  out.profile_photo.token_len_chars = tok1.length;            // randomId() = 9 random bytes → 12 base64url chars = 72 bits
  out.profile_photo.no_auth_evil_origin_sm = await bare(p1.sm, 'https://evil.example.com');
  out.profile_photo.no_auth_no_origin_lg = await bare(p1.lg);
  out.profile_photo.wrong_token = await bare(`/api/media/photos/eli/AAAAAAAAAAAA-256.jpg`);
  out.profile_photo.traversal = await bare('/api/media/photos/x/..%2f..%2fsecret.txt');

  // 2. replace the photo → does the OLD url stop working?
  const up2 = await L.apiAs('eli', '/api/profiles/eli/photo', { method: 'PUT', body: { sm: jpeg, lg: jpeg } });
  const p2 = up2.body.profile.photo;
  await sleep(200);
  out.replace = { new_differs: p2.sm !== p1.sm, old_sm_after_replace: await bare(p1.sm), old_lg_after_replace: await bare(p1.lg), new_sm: await bare(p2.sm) };

  // 3. remove the photo → does the url stop working?
  const del = await L.apiAs('eli', '/api/profiles/eli/photo', { method: 'DELETE' });
  out.remove_profile_photo = { status: del.status, sm_after_delete: await bare(p2.sm), lg_after_delete: await bare(p2.lg) };

  // 4. album photo: public too; does deleting it revoke?
  const al = await L.apiAs('eli', '/api/album', { method: 'POST', body: { sm: jpeg, lg: jpeg, caption: 'probe' } });
  const a = al.body.photo;
  out.album = { post_status: al.status, urls: { sm: a.sm, lg: a.lg }, no_auth_lg: await bare(a.lg, 'https://evil.example.com') };

  // 5. revoke a DEVICE (admin unpair) that already knew the album url: its API access dies, the media url does not
  const ph = await L.newDevice({ name: 'Lost phone', profiles: ['eli'] });
  const seen = await L.apiAs('eli', '/api/data/hub?scope=family', { deviceToken: ph.device.token, profileToken: ph.sessions.eli });
  const knewUrl = JSON.stringify(seen.body).includes(a.lg);
  const unpair = await L.apiAs('eli', '/api/admin/devices/' + ph.device.id, { method: 'DELETE' });
  const after = await L.apiAs('eli', '/api/data/hub?scope=family', { deviceToken: ph.device.token, profileToken: ph.sessions.eli });
  out.unpaired_device = { lost_phone_had_album_url_in_sync: knewUrl, unpair_status: unpair.status, lost_phone_api_after_unpair: after.status, album_lg_still_fetchable_without_auth: await bare(a.lg) };

  // 6. the owner deletes the album photo → revoked for everyone (server side)
  const ad = await L.apiAs('eli', '/api/album/' + a.id, { method: 'DELETE' });
  await sleep(100);
  out.album_delete = { status: ad.status, sm_after_delete: await bare(a.sm), lg_after_delete: await bare(a.lg) };
} catch (e) {
  out.error = String(e && e.stack || e);
} finally {
  await L.close();
}
console.log(JSON.stringify(out, null, 1));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
