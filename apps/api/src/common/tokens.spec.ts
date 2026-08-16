import { createHash } from 'crypto';
import { hashRefreshToken, safeEqualHex } from './tokens';

describe('refresh token hashing', () => {
  it('produces a deterministic sha-256 hex digest', () => {
    expect(hashRefreshToken('token-abc')).toBe(createHash('sha256').update('token-abc').digest('hex'));
    expect(hashRefreshToken('token-abc')).toBe(hashRefreshToken('token-abc'));
  });

  it('distinguishes tokens that share their first 72 bytes (the bcrypt truncation bug)', () => {
    // bcrypt only hashes the first 72 bytes, so these two long, JWT-like tokens
    // would collide under bcrypt. SHA-256 hashes the whole token, so they must
    // produce different digests.
    const prefix = 'a'.repeat(72);
    const tokenA = `${prefix}.signature-one`;
    const tokenB = `${prefix}.signature-two`;
    expect(tokenA.slice(0, 72)).toBe(tokenB.slice(0, 72));
    expect(hashRefreshToken(tokenA)).not.toBe(hashRefreshToken(tokenB));
  });

  it('compares equal-length digests in constant time and rejects mismatches', () => {
    const a = hashRefreshToken('same');
    expect(safeEqualHex(a, hashRefreshToken('same'))).toBe(true);
    expect(safeEqualHex(a, hashRefreshToken('different'))).toBe(false);
  });

  it('returns false for malformed or differing-length input instead of throwing', () => {
    expect(safeEqualHex('abcd', 'ab')).toBe(false);
    expect(safeEqualHex('', hashRefreshToken('x'))).toBe(false);
  });
});
