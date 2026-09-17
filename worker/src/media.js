/**
 * Media storage: profile photos and the family album.
 *
 * Uses the R2 bucket when the MEDIA binding exists (wrangler.toml [[r2_buckets]]); otherwise the bytes
 * live in the D1 `media` table. Both keep the same keys, so switching to R2 later is just the binding
 * plus a one-off copy. Keys are unguessable (a random token in the path) because GET /api/media/* is
 * public: <img> tags cannot send the device token, and the browser caches each key forever.
 */
import { HttpError } from './auth.js';

export const MAX_SM = 80 * 1024;     // 256 px square, JPEG
export const MAX_LG = 420 * 1024;    // 1024 px, JPEG

export function decodeImage(b64, max, what) {
  if (typeof b64 !== 'string' || !b64) throw new HttpError(400, 'bad_image', `${what} is missing.`);
  const raw = b64.replace(/^data:[^,]*,/, '');
  let bytes;
  try { bytes = Uint8Array.from(atob(raw), ch => ch.charCodeAt(0)); } catch { throw new HttpError(400, 'bad_image', `${what} is not base64.`); }
  if (bytes.length > max) throw new HttpError(413, 'image_too_large', `${what} is too big (${Math.round(bytes.length / 1024)} KB).`);
  if (!(bytes[0] === 0xFF && bytes[1] === 0xD8)) throw new HttpError(400, 'bad_image', `${what} must be a JPEG.`);
  return bytes;
}

export async function putMedia(env, key, bytes, mime = 'image/jpeg') {
  if (env.MEDIA) { await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: mime } }); return; }
  await env.DB.prepare('INSERT OR REPLACE INTO media (key, mime, bytes, size, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(key, mime, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), bytes.length, Date.now()).run();
}

/** Returns { bytes: ArrayBuffer, mime } or null. */
export async function getMedia(env, key) {
  if (env.MEDIA) { const o = await env.MEDIA.get(key); return o ? { bytes: await o.arrayBuffer(), mime: (o.httpMetadata && o.httpMetadata.contentType) || 'image/jpeg' } : null; }
  const r = await env.DB.prepare('SELECT mime, bytes FROM media WHERE key = ?').bind(key).first();
  if (!r) return null;
  const b = r.bytes instanceof ArrayBuffer ? r.bytes : Array.isArray(r.bytes) ? Uint8Array.from(r.bytes).buffer : r.bytes;
  return { bytes: b, mime: r.mime || 'image/jpeg' };
}

export async function deletePrefix(env, prefix) {
  if (env.MEDIA) { const l = await env.MEDIA.list({ prefix }); if (l.objects.length) await env.MEDIA.delete(l.objects.map(o => o.key)); return; }
  await env.DB.prepare("DELETE FROM media WHERE key LIKE ? ESCAPE '\\'").bind(prefix.replace(/[%_\\]/g, ch => '\\' + ch) + '%').run();
}

/** The two URLs (relative to the API origin) for a profile's photo, or null. */
export const photoUrls = (id, token) => token ? { sm: `/api/media/photos/${id}/${token}-256.jpg`, lg: `/api/media/photos/${id}/${token}-1024.jpg` } : null;
