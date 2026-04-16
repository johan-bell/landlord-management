import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const envCandidates = [
    join(process.cwd(), '.env'),
    join(process.cwd(), 'api', '.env'),
];
for (const path of envCandidates) {
    if (existsSync(path)) {
        loadEnv({ path });
        break;
    }
}

const bootstrapLogger = new Logger('Bootstrap');

/**
 * `CORS_ORIGIN` must be a JSON array of origin strings, e.g.
 * `["http://localhost:5173","http://localhost:5174"]`.
 * If unset, invalid JSON, or not a non-empty string array, CORS is disabled (`false`).
 */
function corsOriginOption(): false | string[] {
    const raw = process.env.CORS_ORIGIN?.trim();
    if (!raw) {
        return false;
    }
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return false;
        }
        const origins = parsed.filter(
            (item): item is string =>
                typeof item === 'string' && item.length > 0,
        );
        return origins.length > 0 ? origins : false;
    } catch {
        return false;
    }
}

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
        }),
    );
    const corsOrigins = corsOriginOption();
    if (corsOrigins === false) {
        bootstrapLogger.warn(
            'CORS_ORIGIN missing or invalid: cross-origin browser requests are blocked. Set CORS_ORIGIN to a JSON array, e.g. ["http://localhost:5173","http://localhost:5174","http://localhost:5175"]',
        );
    } else {
        bootstrapLogger.log(`CORS allowlist: ${corsOrigins.join(', ')}`);
    }
    app.enableCors({
        origin: corsOrigins,
    });
    const port = Number(process.env.PORT ?? 3000);
    await app.listen(port);
    bootstrapLogger.log(
        `landlord-management-api listening on port ${port} (NODE_ENV=${process.env.NODE_ENV ?? 'undefined'})`,
    );
}
void bootstrap();
