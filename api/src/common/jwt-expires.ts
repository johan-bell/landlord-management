import type { ConfigService } from '@nestjs/config';

/** Parses JWT_ACCESS_EXPIRES env (e.g. `15m`, `900`, `1h`) to seconds for @nestjs/jwt. */
export function accessExpiresSeconds(config: ConfigService): number {
    const raw = config.get<string>('JWT_ACCESS_EXPIRES', '15m').trim();
    if (/^\d+$/.test(raw)) {
        return parseInt(raw, 10);
    }
    if (raw.endsWith('m')) {
        return parseInt(raw.slice(0, -1), 10) * 60;
    }
    if (raw.endsWith('h')) {
        return parseInt(raw.slice(0, -1), 10) * 3600;
    }
    if (raw.endsWith('d')) {
        return parseInt(raw.slice(0, -1), 10) * 86400;
    }
    return 900;
}
