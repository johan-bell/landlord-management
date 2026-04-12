import { ConfigService } from '@nestjs/config';

const DEV_FALLBACK = 'dev-insecure-change-me';

/** Empty or missing JWT_SECRET in .env would break passport-jwt; use dev fallback only then. */
export function resolveJwtSecret(config: ConfigService): string {
  const raw = config.get<string>('JWT_SECRET');
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed.length > 0 ? trimmed : DEV_FALLBACK;
}
