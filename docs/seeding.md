# Database migrations and seeding

This project uses **Prisma** with PostgreSQL. The API lives in `api/`; all commands below assume you run them from **`api/`** unless noted.

---

## Prerequisites

1. **PostgreSQL** is running and reachable at the URL in `api/.env` (`DATABASE_URL`).
   - Local Docker: from the repo root, `npm run db:up` starts Postgres (`postgres` / `postgres`, database `landlord` on port `5432`). See [`docker-compose.yml`](../docker-compose.yml).
2. **`api/.env`** exists with a valid `DATABASE_URL` (copy from `api/.env.example` and adjust).

---

## What gets seeded

The seed script (`api/prisma/seed.ts`) loads JSON fixtures from `api/prisma/seed-data/` (see `manifest.json` for load order and notes). It creates demo **organizations**, **staff users**, **memberships**, **properties**, **units**, **renters**, **leases**, **payments**, links a **tenant user** to one renter, and ensures a **platform administrator** user exists.

**Development and demos only.** Do not rely on these passwords outside local/dev environments.

### Demo accounts (after `prisma db seed`)

| App      | Email                         | Password           | Notes                                     |
| -------- | ----------------------------- | ------------------ | ----------------------------------------- |
| Admin    | `owner@demo.landlord.local`   | `DemoLandlord123!` | Org **Owner** (e.g. Douala Rentals Demo)  |
| Admin    | `manager@demo.landlord.local` | `DemoLandlord123!` | Org **Manager**                           |
| Platform | `platform@landlord.local`     | `PlatformDev123!`  | `isPlatformAdmin` — **not** the org Owner |
| Tenant   | `jean.mbarga@example.com`     | `DemoTenant123!`   | Linked to seeded renter Jean Mbarga       |

The seed run also prints these lines to the console.

---

## Typical workflows

### New machine or empty database (apply migrations, then seed)

From `api/`:

```bash
npx prisma migrate deploy
npx prisma db seed
```

Use this when you already have a database but no tables yet (e.g. first clone, or new DB name).

### Full reset (drops all data — development only)

**Warning:** This **destroys every table and row** in the database pointed to by `DATABASE_URL`. Use only on **local/dev** databases, never production.

From `api/`:

```bash
npx prisma migrate reset --force
```

This drops the schema, reapplies all migrations from `api/prisma/migrations/`, and runs the seed command configured in `api/prisma.config.ts`.

If the seed step does not run or fails, run:

```bash
npx prisma db seed
```

From the repo root you can use:

```bash
npm run db:reset
```

(equivalent to `npm run db:reset` in `api/` — see root `package.json`.)

### Create a new migration after schema changes

From `api/`:

```bash
npx prisma migrate dev --name describe_your_change
```

---

## Files and configuration

| Path                          | Role                                                            |
| ----------------------------- | --------------------------------------------------------------- |
| `api/prisma/schema.prisma`    | Data model                                                      |
| `api/prisma/migrations/`      | SQL migrations (source of truth for schema history)             |
| `api/prisma.config.ts`        | Prisma config, including **seed command**: `tsx prisma/seed.ts` |
| `api/prisma/seed.ts`          | Seed implementation                                             |
| `api/prisma/seed-data/*.json` | Fixture data (IDs use `seed_` prefix)                           |

New migrations (e.g. tenant signup requests) are applied with `npx prisma migrate deploy` from `api/`.

---

## Troubleshooting

- **`DATABASE_URL` is not set** — Create `api/.env` with a valid URL; the seed script exits early if it cannot read it.
- **Connection refused** — Start Postgres (`npm run db:up` at repo root) or fix host/port/credentials.
- **`migrate deploy` fails** — Ensure the database exists and the user can create objects; for a corrupted dev DB, prefer **`migrate reset`** (dev only) or recreate the empty database and run `migrate deploy` again.
