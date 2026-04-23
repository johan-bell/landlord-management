import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { requestContext } from './common/request-context';

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

const dsn = process.env.SENTRY_DSN?.trim();
if (dsn) {
    void import('@sentry/node').then((Sentry) => {
        Sentry.init({
            dsn,
            environment: process.env.NODE_ENV ?? 'development',
            tracesSampleRate: 0.05,
        });
    });
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
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    app.use(helmet());
    app.use((req: Request, res: Response, next: NextFunction) => {
        const headerId = req.headers['x-request-id'];
        const id =
            typeof headerId === 'string' && headerId.trim().length > 0
                ? headerId.trim()
                : randomUUID();
        res.setHeader('x-request-id', id);
        requestContext.run({ requestId: id }, () => next());
    });
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
        }),
    );
    app.useGlobalFilters(new PrismaExceptionFilter());
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
