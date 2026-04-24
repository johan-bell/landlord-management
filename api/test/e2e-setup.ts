/**
 * E2E tests boot the full `AppModule` (real Prisma, config validation, guards).
 *
 * - Loads `api/.env` when present (does not override variables already set — e.g. in CI).
 * - Supplies safe defaults only when values are missing so `ConfigModule` + Joi pass locally.
 *
 * You still need a reachable Postgres matching `DATABASE_URL` (e.g. `docker compose up postgres`).
 * If you prefer not to run DB-backed checks in CI, run `npm test` (unit) only and skip `test:e2e`.
 */
import 'reflect-metadata';
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

const envFile = resolve(__dirname, '../.env');
if (existsSync(envFile)) {
    config({ path: envFile, override: false });
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    process.env.JWT_SECRET = 'e2e-default-jwt-secret-32-characters!';
}

if (!process.env.DATABASE_URL?.trim()) {
    process.env.DATABASE_URL =
        'postgresql://postgres:postgres@127.0.0.1:5432/landlord?schema=public';
}

process.env.NODE_ENV ??= 'test';
