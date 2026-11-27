import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * A Google refresh token is a long-lived credential to someone's mailbox, so it is
 * encrypted before it reaches the database rather than relying on disk encryption
 * alone: a dumped table, a leaked backup or a read-only SQL account then yields
 * ciphertext instead of the ability to send mail as that person.
 *
 * AES-256-GCM, fresh 96-bit IV per value, auth tag kept alongside - so tampering with
 * a stored row fails the decrypt instead of silently producing a different token.
 */
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

function key(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY is not set. Generate one with: ' +
        'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  const parsed = Buffer.from(raw, 'hex');
  if (parsed.length !== KEY_BYTES) {
    throw new Error(`TOKEN_ENCRYPTION_KEY must be ${KEY_BYTES * 2} hex characters`);
  }
  return parsed;
}

/** Returns "iv.tag.ciphertext", all base64url. */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString('base64url')).join('.');
}

export function decryptToken(packed: string): string {
  const [iv, tag, body] = packed.split('.');
  if (!iv || !tag || !body) throw new Error('stored token is malformed');

  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(body, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/** True when a usable key is configured, so callers can fail early with a clear message. */
export function encryptionConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}
