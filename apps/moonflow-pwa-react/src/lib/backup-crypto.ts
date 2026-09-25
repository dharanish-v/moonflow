// src/lib/backup-crypto.ts — passphrase-encrypted backups (T46). An export
// file travels (AirDrop, iCloud Drive, WhatsApp); a plaintext one is a full
// record of someone's cycle history for anyone who finds it.
//
// AES-256-GCM (authenticated: tampering is detected), key from PBKDF2-SHA256
// with a random salt. The envelope is plain JSON, so the format is
// self-describing and future builds can always read today's files.

export const BACKUP_KDF_ITERATIONS = 600_000;
const FORMAT = 'moonflow-encrypted-backup';

interface Envelope {
  format: typeof FORMAT;
  version: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

const toB64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBackup(json: string, passphrase: string, iterations: number = BACKUP_KDF_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(json)));
  const envelope: Envelope = {
    format: FORMAT,
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations,
    salt: toB64(salt),
    iv: toB64(iv),
    ciphertext: toB64(ciphertext),
  };
  return JSON.stringify(envelope, null, 2);
}

function parseEnvelope(text: string): Envelope | null {
  try {
    const obj = JSON.parse(text) as Partial<Envelope>;
    return obj && obj.format === FORMAT && obj.version === 1 ? (obj as Envelope) : null;
  } catch {
    return null;
  }
}

export function isEncryptedBackup(text: string): boolean {
  return parseEnvelope(text) !== null;
}

export type DecryptResult = { ok: true; json: string } | { ok: false; error: string };

export async function decryptBackup(text: string, passphrase: string): Promise<DecryptResult> {
  const env = parseEnvelope(text);
  if (!env) return { ok: false, error: "That isn't an encrypted backup." };
  try {
    const key = await deriveKey(passphrase, fromB64(env.salt), env.iterations);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(env.iv) as BufferSource }, key, fromB64(env.ciphertext) as BufferSource);
    return { ok: true, json: new TextDecoder().decode(plain) };
  } catch {
    // GCM can't tell a wrong key from a tampered file; the wrong key is far likelier.
    return { ok: false, error: 'Wrong passphrase.' };
  }
}
