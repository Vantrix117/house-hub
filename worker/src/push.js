// Web Push from a Worker with nothing but WebCrypto:
//   RFC 8291 message encryption (aes128gcm) + RFC 8292 VAPID (ES256 JWT).
// Verified against the RFC 8291 Appendix A test vector by scripts/test-push.mjs.

const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
const concat = (...arrs) => { const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0)); let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; } return out; };

async function hkdf(salt, ikm, info, bits) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bits));
}

/**
 * Encrypts `payload` (string) for a PushSubscription's keys. Returns { body, headers }.
 * `test` lets the known-answer test inject the salt and the sender key pair.
 */
export async function encrypt(payload, keys, test = null) {
  const uaPublic = unb64u(keys.p256dh);                     // 65 bytes, uncompressed point
  const authSecret = unb64u(keys.auth);                     // 16 bytes
  const asKeys = test ? test.asKeys : await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));

  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 256);
  const salt = test ? test.salt : crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 128);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 96);

  const plain = concat(enc.encode(payload), new Uint8Array([2]));   // 0x02 = last record delimiter
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, plain));

  const rs = 4096;
  const header = concat(salt, new Uint8Array([rs >>> 24, (rs >>> 16) & 255, (rs >>> 8) & 255, rs & 255]), new Uint8Array([asPublic.length]), asPublic);
  return { body: concat(header, cipher), headers: { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream' } };
}

/** VAPID Authorization header for one push endpoint. privateKey/publicKey are the base64url strings web-push generates. */
export async function vapidHeader(endpoint, { publicKey, privateKey, subject }) {
  const pub = unb64u(publicKey);
  const jwk = { kty: 'EC', crv: 'P-256', x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d: privateKey, ext: true };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const aud = new URL(endpoint).origin;
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(head + '.' + claims)));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${publicKey}`;
}

/**
 * Sends one notification. subscription is the browser's PushSubscription JSON.
 * Resolves { ok, status, gone } — gone=true means the subscription is dead and should be deleted.
 */
export async function sendPush(subscription, payloadObj, vapid, { ttl = 86400, urgency = 'normal' } = {}) {
  const { body, headers } = await encrypt(JSON.stringify(payloadObj), subscription.keys);
  const auth = await vapidHeader(subscription.endpoint, vapid);
  let r;
  try {
    r = await fetch(subscription.endpoint, { method: 'POST', headers: { ...headers, Authorization: auth, TTL: String(ttl), Urgency: urgency }, body });
  } catch (e) {
    return { ok: false, status: 0, gone: false, error: String(e && e.message || e) };
  }
  return { ok: r.status >= 200 && r.status < 300, status: r.status, gone: r.status === 404 || r.status === 410, error: r.ok ? null : (await r.text()).slice(0, 200) };
}
