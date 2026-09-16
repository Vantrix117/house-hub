#!/usr/bin/env node
// Known-answer test for worker/src/push.js against RFC 8291 Appendix A, plus a VAPID header sanity check.
//   node scripts/test-push.mjs
import { webcrypto } from 'node:crypto';
globalThis.crypto ??= webcrypto;
const { encrypt, vapidHeader, unb64u } = await import('../worker/src/push.js');

const b64u = buf => Buffer.from(buf).toString('base64url');
let fail = 0;
const ok = (c, m, extra = '') => { console.log((c ? '  ✓ ' : '  ✗ ') + m, c ? '' : extra); if (!c) fail++; };

// RFC 8291 §5 / Appendix A
const V = {
  plaintext: 'When I grow up, I want to be a watermelon',
  uaPrivate: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  body: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};
console.log('## RFC 8291 Appendix A');
const asPub = unb64u(V.asPublic);
const asKeys = {
  privateKey: await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: b64u(asPub.slice(1, 33)), y: b64u(asPub.slice(33, 65)), d: V.asPrivate, ext: true }, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']),
  publicKey: await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, true, []),
};
const { body, headers } = await encrypt(V.plaintext, { p256dh: V.uaPublic, auth: V.auth }, { salt: unb64u(V.salt), asKeys });
ok(b64u(body) === V.body, 'ciphertext matches the RFC test vector byte for byte', '\n      got ' + b64u(body));
ok(headers['Content-Encoding'] === 'aes128gcm', 'Content-Encoding aes128gcm');

console.log('\n## VAPID');
const { execSync } = await import('node:child_process');
let keys;
try { keys = JSON.parse(execSync('node -e "console.log(JSON.stringify(require(\'web-push\').generateVAPIDKeys()))"', { encoding: 'utf8' })); }
catch { // web-push not on NODE_PATH: make a throwaway P-256 pair the same way
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  keys = { publicKey: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)), privateKey: jwk.d };
}
const h = await vapidHeader('https://fcm.googleapis.com/fcm/send/abc', { publicKey: keys.publicKey, privateKey: keys.privateKey, subject: 'mailto:test@example.com' });
const m = h.match(/^vapid t=([^,]+), k=(.+)$/);
ok(!!m, 'header has the vapid t=…, k=… shape');
const [hd, cl, sg] = m[1].split('.');
const claims = JSON.parse(Buffer.from(cl, 'base64url').toString());
ok(claims.aud === 'https://fcm.googleapis.com' && claims.sub === 'mailto:test@example.com' && claims.exp > Date.now() / 1000, 'claims: aud is the push service origin, sub, exp');
const pub = unb64u(keys.publicKey);
const verifyKey = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)) }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifyKey, unb64u(sg), new TextEncoder().encode(hd + '.' + cl));
ok(valid, 'ES256 signature verifies with the public key');
ok(m[2] === keys.publicKey, 'k= carries the public key');

console.log(fail ? `\n${fail} FAILED` : '\nall push checks passed');
process.exit(fail ? 1 : 0);
