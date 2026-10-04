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

// ── a parent's recorded voice (batch 7, IMP-KIDVERSE-I2) ─────────────────────────────────────────────────────
// Stored in the same place as photos but NOT served like them: GET /api/media/* is public, a voice is family audio and
// is only ever served by GET /api/kidverse/voice/:week/:id, which needs a signed-in session (index.js). The key is
// voice/<week>/<random>, so the media route's pattern (photos|album, .jpg) can never reach it.
export const MAX_VOICE_BYTES = 1024 * 1024;   // 1 MB
export const MAX_VOICE_MS = 90 * 1000;        // 90 seconds
export const VOICE_TYPES = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg'];

/** The base type of a Content-Type header ("audio/webm;codecs=opus" → "audio/webm"), or null when it is not an allowed one. */
export function voiceType(header) {
  const base = String(header || '').split(';')[0].trim().toLowerCase();
  return VOICE_TYPES.includes(base) ? base : null;
}

/** Do the first bytes look like the container the Content-Type claims? (a text file called audio/webm is refused) */
export function sniffVoice(bytes, mime) {
  const b = bytes, at = (i, s) => s.split('').every((ch, k) => b[i + k] === ch.charCodeAt(0));
  if (mime === 'audio/webm') return b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3;   // EBML header
  if (mime === 'audio/ogg') return at(0, 'OggS');
  if (mime === 'audio/mpeg') return at(0, 'ID3') || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0);        // ID3 tag or an MPEG frame sync
  if (mime === 'audio/mp4') return ['ftyp', 'styp', 'moov', 'moof', 'free', 'skip', 'wide', 'mdat'].some(t => at(4, t));
  return false;
}

/** Reads a request body up to `max` bytes; one byte more is a 413 and the rest is never read. */
export async function readCapped(request, max, what = 'The recording') {
  const declared = +request.headers.get('Content-Length');
  if (Number.isFinite(declared) && declared > max) throw new HttpError(413, 'too_large', `${what} is too big (${Math.round(declared / 1024)} KB; the limit is ${Math.round(max / 1024)} KB).`);
  if (!request.body) throw new HttpError(400, 'empty', `${what} is empty.`);
  const reader = request.body.getReader(), chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) { try { await reader.cancel(); } catch {} throw new HttpError(413, 'too_large', `${what} is too big (the limit is ${Math.round(max / 1024)} KB).`); }
    chunks.push(value);
  }
  if (!total) throw new HttpError(400, 'empty', `${what} is empty.`);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

/** Deletes one object by its exact key. */
export async function deleteMedia(env, key) {
  if (env.MEDIA) { await env.MEDIA.delete(key); return; }
  await env.DB.prepare('DELETE FROM media WHERE key = ?').bind(key).run();
}

/** Deletes everything under `prefix` except `keepKey` and anything newer than `olderThan` ms (an upload still finishing). */
export async function sweepMedia(env, prefix, keepKey, olderThan) {
  if (env.MEDIA) {
    const l = await env.MEDIA.list({ prefix });
    const old = l.objects.filter(o => o.key !== keepKey && o.uploaded && +o.uploaded < olderThan).map(o => o.key);
    if (old.length) await env.MEDIA.delete(old);
    return;
  }
  await env.DB.prepare("DELETE FROM media WHERE key LIKE ? ESCAPE '\\' AND key != ? AND created_at < ?")
    .bind(prefix.replace(/[%_\\]/g, ch => '\\' + ch) + '%', keepKey || '', olderThan).run();
}
