import { createHash, timingSafeEqual } from 'crypto';

/**
 * Deterministically hash a refresh token for at-rest storage.
 *
 * Refresh tokens are signed JWTs and are far longer than bcrypt's 72-byte
 * input limit, so bcrypt would silently hash only their first 72 bytes — which
 * for tokens of the same session differ only in the trailing signature, making
 * distinct tokens collide. SHA-256 covers the entire token and is fast to
 * verify. The stored hash is high-entropy (the token itself is the secret), so
 * a slow KDF is unnecessary here.
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time comparison of two hex-encoded digests of equal expected length. */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufferA = Buffer.from(a, 'hex');
  const bufferB = Buffer.from(b, 'hex');
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
