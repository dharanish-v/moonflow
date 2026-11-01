// VAPID (RFC 8292) JWT signing for the PocketBase JS hooks runtime (goja):
// no WebCrypto, no TextEncoder, so plain BigInt P-256 from @noble/curves and
// hand-rolled base64url. Deterministic signatures (RFC 6979), no randomness.
import { p256 } from '@noble/curves/nist.js';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function b64url(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}

function fromB64url(s) {
  const bytes = [];
  let buf = 0, bits = 0;
  for (const ch of s) {
    buf = (buf << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buf >> bits) & 255);
    }
  }
  return new Uint8Array(bytes);
}

// JWT headers and claims here are ASCII (URLs, numbers, mailto:).
function ascii(str) {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c > 127) throw new Error('non-ASCII in JWT');
    out[i] = c;
  }
  return out;
}

/** The VAPID public key (65-byte uncompressed point, base64url) for a
 * private key — the `k=` part of the Authorization header. */
export function vapidPublicKey(privateKey) {
  return b64url(p256.getPublicKey(fromB64url(privateKey), false));
}

/** privateKey: base64url of the 32-byte P-256 secret (the "d" of a JWK). */
export function vapidJwt(privateKey, audience, subject, expiresAt) {
  const header = b64url(ascii(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(ascii(JSON.stringify({ aud: audience, exp: expiresAt, sub: subject })));
  const input = `${header}.${claims}`;
  const sig = p256.sign(ascii(input), fromB64url(privateKey), { extraEntropy: false });
  return `${input}.${b64url(sig)}`;
}
