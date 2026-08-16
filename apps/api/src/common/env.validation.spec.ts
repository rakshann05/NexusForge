import { validateEnv } from './env.validation';

const base = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db?schema=public',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

describe('validateEnv', () => {
  it('accepts a valid configuration and applies defaults', () => {
    const result = validateEnv({ ...base });
    expect(result.API_PORT).toBe(4000);
    expect(result.CORS_ORIGIN).toBe('http://localhost:3000');
    expect(result.JWT_ACCESS_TTL).toBe('15m');
  });

  it('coerces API_PORT from a string', () => {
    const result = validateEnv({ ...base, API_PORT: '8080' });
    expect(result.API_PORT).toBe(8080);
  });

  it('rejects a missing database url', () => {
    const { DATABASE_URL, ...withoutDb } = base;
    void DATABASE_URL;
    expect(() => validateEnv(withoutDb)).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-postgres database url', () => {
    expect(() => validateEnv({ ...base, DATABASE_URL: 'mysql://localhost/db' })).toThrow(/DATABASE_URL/);
  });

  it('rejects secrets shorter than the minimum length', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'too-short' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects placeholder secrets in production', () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'replace-with-a-long-random-access-secret-value',
        JWT_REFRESH_SECRET: 'replace-with-a-long-random-refresh-secret-value',
      }),
    ).toThrow(/production/);
  });

  it('rejects identical access and refresh secrets in production', () => {
    const secret = 'c'.repeat(40);
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'production', JWT_ACCESS_SECRET: secret, JWT_REFRESH_SECRET: secret }),
    ).toThrow(/different/);
  });

  it('allows the same-length distinct secrets in production', () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'x'.repeat(40),
        JWT_REFRESH_SECRET: 'y'.repeat(40),
      }),
    ).not.toThrow();
  });
});
