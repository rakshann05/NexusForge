import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min, MinLength, validateSync } from 'class-validator';

export enum NodeEnvironment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

// Minimum entropy for signing secrets. 32 characters keeps HS256 keys from
// being trivially brute-forced while remaining easy to generate locally.
const MIN_SECRET_LENGTH = 32;

/**
 * Typed, validated view of the API's environment. Anything required for the
 * server to run safely is validated here so the process fails fast at boot
 * instead of misbehaving at request time. Frontend-only variables are accepted
 * but optional so the API does not refuse to start without them.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @Matches(/^postgres(ql)?:\/\/.+/, { message: 'DATABASE_URL must be a postgres:// connection string' })
  DATABASE_URL!: string;

  @IsString()
  @MinLength(MIN_SECRET_LENGTH, { message: `JWT_ACCESS_SECRET must be at least ${MIN_SECRET_LENGTH} characters` })
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(MIN_SECRET_LENGTH, { message: `JWT_REFRESH_SECRET must be at least ${MIN_SECRET_LENGTH} characters` })
  JWT_REFRESH_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_TTL: string = '15m';

  @IsOptional()
  @IsString()
  JWT_REFRESH_TTL: string = '7d';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  API_PORT: number = 4000;

  @IsOptional()
  @IsString()
  CORS_ORIGIN: string = 'http://localhost:3000';

  // Reserved for cache/queues/realtime scaling; not required to boot.
  @IsOptional()
  @IsString()
  REDIS_URL?: string;

  // Consumed by the Next.js frontend; validated for shape when present.
  @IsOptional()
  @IsString()
  NEXT_PUBLIC_API_URL?: string;
}

const PLACEHOLDER = /replace-with|changeme|example|your-secret/i;

/**
 * Validation callback wired into ConfigModule.forRoot({ validate }). Throws a
 * single aggregated error describing every misconfigured variable. In
 * production it additionally refuses placeholder secrets and refuses reuse of
 * the same value for both JWT secrets. Secret values are never included in the
 * error output.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false, whitelist: false });
  const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));

  if (validated.NODE_ENV === NodeEnvironment.Production) {
    if (PLACEHOLDER.test(validated.JWT_ACCESS_SECRET ?? '') || PLACEHOLDER.test(validated.JWT_REFRESH_SECRET ?? '')) {
      messages.push('JWT secrets must be replaced with real random values in production');
    }
    if (validated.JWT_ACCESS_SECRET && validated.JWT_ACCESS_SECRET === validated.JWT_REFRESH_SECRET) {
      messages.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different in production');
    }
  }

  if (messages.length > 0) {
    throw new Error(`Invalid environment configuration:\n - ${messages.join('\n - ')}`);
  }
  return validated;
}
