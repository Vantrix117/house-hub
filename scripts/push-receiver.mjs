#!/usr/bin/env node
// A stand-in push service for local testing. Prints a fake PushSubscription on start, then for every
// push the Worker sends: verifies the VAPID JWT, decrypts the aes128gcm body with the subscription's
// private key, and prints the plaintext. Responds 201 (or 410 for /push/gone to test cleanup).
//   node scripts/push-receiver.mjs [port=8790]
import http from 'node:http';
import { webcrypto as crypto } from 'node:crypto';

const port = +(process.argv[2] || 8790);
const b64u = b => Buffer.from(b).toString('base64url');
const unb64u = s => new Uint8Array(Buffer.from(s, 'base64url'));
const enc = new TextEncoder();
const concat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
const hkdf = async (salt, ikm, info, bits) => new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), bits));

const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey));
const auth = crypto.getRandomValues(new Uint8Array(16));
const subscription = { endpoint: `http://127.0.0.1:${port}/push/1`, keys: { p256dh: b64u(uaPublic), auth: b64u(auth) } };
console.log('SUBSCRIPTION ' + JSON.stringify(subscription));

async function decrypt(body) {
  const salt = body.slice(0, 16), rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0), idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen), cipher = body.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 256);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 128);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 96);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, cipher));
  const end = plain.lastIndexOf(2);
  return { rs, text: new TextDecoder().decode(plain.slice(0, end)) };
}
async function verifyVapid(header) {
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(header || ''); if (!m) return { ok: false, why: 'no vapid header' };
  const [h, c, s] = m[1].split('.'); const pub = unb64u(m[2]);
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)) }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unb64u(s), enc.encode(h + '.' + c));
  const claims = JSON.parse(Buffer.from(c, 'base64url').toString());
  return { ok: ok && claims.aud === `http://127.0.0.1:${port}` && claims.exp > Date.now() / 1000, claims };
}

let n = 0;
http.createServer((req, res) => {
  const chunks = [];
  req.on('data', d => chunks.push(d)).on('end', async () => {
    const body = new Uint8Array(Buffer.concat(chunks));
    if (req.url === '/push/gone') { res.writeHead(410); res.end(); console.log('PUSH -> 410 (dead subscription)'); return; }
    try {
      const v = await verifyVapid(req.headers.authorization);
      const d = await decrypt(body);
      console.log(`PUSH #${++n} vapid=${v.ok ? 'valid' : 'INVALID'} ttl=${req.headers.ttl} urgency=${req.headers.urgency} enc=${req.headers['content-encoding']} payload=${d.text}`);
      res.writeHead(201); res.end();
    } catch (e) { console.log('PUSH #' + (++n) + ' FAILED to decrypt/verify: ' + e.message); res.writeHead(400); res.end(); }
  });
}).listen(port, () => console.log('receiver listening on ' + port));
