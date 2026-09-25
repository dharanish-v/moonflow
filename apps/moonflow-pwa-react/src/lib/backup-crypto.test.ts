import { describe, expect, it } from 'vitest';
import { decryptBackup, encryptBackup, isEncryptedBackup } from './backup-crypto';

const FAST = 1000; // test-only; production uses BACKUP_KDF_ITERATIONS

describe('encrypted backups', () => {
  it('round-trips with the right passphrase', async () => {
    const sealed = await encryptBackup('{"entries":[]}', 'correct horse battery', FAST);
    expect(isEncryptedBackup(sealed)).toBe(true);
    expect(await decryptBackup(sealed, 'correct horse battery')).toEqual({ ok: true, json: '{"entries":[]}' });
  });

  it('contains no plaintext', async () => {
    const sealed = await encryptBackup('{"note":"very private"}', 'correct horse battery', FAST);
    expect(sealed).not.toContain('very private');
  });

  it('rejects a wrong passphrase without throwing', async () => {
    const sealed = await encryptBackup('{}', 'correct horse battery', FAST);
    expect(await decryptBackup(sealed, 'wrong')).toEqual({ ok: false, error: 'Wrong passphrase.' });
  });

  it('detects tampering (AES-GCM authentication)', async () => {
    const sealed = JSON.parse(await encryptBackup('{"a":1}', 'pw-pw-pw-pw', FAST));
    const bytes = atob(sealed.ciphertext);
    sealed.ciphertext = btoa(String.fromCharCode(bytes.charCodeAt(0) ^ 1) + bytes.slice(1));
    expect((await decryptBackup(JSON.stringify(sealed), 'pw-pw-pw-pw')).ok).toBe(false);
  });

  it('plain JSON exports are not mistaken for encrypted ones', () => {
    expect(isEncryptedBackup('{"entries":[],"settings":{}}')).toBe(false);
    expect(isEncryptedBackup('not json')).toBe(false);
  });
});
