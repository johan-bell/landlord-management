# Landlord Management

Monorepo for a **multi-tenant landlord operations** product: organizations (landlords), properties, units, renters, leases, and payments—plus a **renter-facing portal** and a **platform operator console** for the SaaS owner.

> **Note:** This README describes **what is implemented today**. Update it whenever you add, change, or remove features so it stays accurate.

---

## Architecture (high level)

- **One** NestJS **API** (PostgreSQL via Prisma).
- **Three** separate Vue **SPA** frontends (they do not call each other; each talks to the API only).

A diagram is kept in [`docs/architecture.drawio`](docs/architecture.drawio) (open with [diagrams.net](https://app.diagrams.net)).

---

## Repository layout

| Path | Role |
|------|------|
| `api/` | NestJS backend, Prisma schema & migrations, seed script |
| `admin/` | Landlord staff UI (portfolio, org-scoped data) |
| `tenant/` | Renter portal (profile + leases) |
| `platform/` | SaaS operator UI (cross-tenant org management) |
| `docs/` | Diagrams and other project docs |

---

## Current features

### Backend (`api/`)

- **Health:** `GET /`, `GET /health`.
- **Auth (JWT):**
  - `POST /auth/register`, `POST /auth/login` — staff users (`typ: staff`) for landlord workflows; users with `isPlatformAdmin` get `typ: platform`.
  - Org-scoped routes require membership; **suspended** organizations are blocked for staff (platform can bypass where implemented).
- **Organizations:** create/list (staff), per-org read/update/summary for members (`/organizations/...`).
- **Domain (per organization):** CRUD-style APIs for **properties**, **units**, **renters**, **leases**, **payments** under `organizations/:orgId/...` (all protected by JWT + org membership).
- **Tenant portal API:** `POST /tenant/auth/register`, `POST /tenant/auth/login`; `GET /tenant/me`, `GET /tenant/leases` (JWT `typ: tenant`, linked renter profile).
- **Platform API:** `GET /platform/organizations`, `PATCH /platform/organizations/:orgId/suspend` (JWT `typ: platform` + platform admin).
- **Billing (optional):** `POST /billing/organizations/:orgId/checkout` — Stripe Checkout session when `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` are set; otherwise the endpoint responds with a configuration error.
- **Data model:** organizations (incl. suspension, subscription-related fields for Stripe), users, org membership, renters (optional link to login user), leases, payments, etc. See `api/prisma/schema.prisma`.

### Admin app (`admin/`)

- Register / login as **landlord staff**; JWT stored for API calls.
- **Organization** selector; screens for **overview**, **properties**, **units** (per property), **renters**, **leases**, **payments** (aligned with org-scoped API).

### Tenant app (`tenant/`)

- **Register** (claim renter profile with renter id + matching email) and **login**.
- Signed-in **home**: profile (`/tenant/me`) and **leases** list with basic payment info (`/tenant/leases`).

### Platform app (`platform/`)

- Login with a **platform administrator** account (not landlord or renter users).
- **Organizations** table: list orgs; **suspend / unsuspend** via platform API.

---

## Prerequisites

- **Node.js** (LTS recommended) and **npm**
- **PostgreSQL** (local or Docker; `docker compose` is available at repo root for Postgres—see `db:up` below)

---

## Environment (API)

Create `api/.env` (start from `api/.env.example`). Commonly:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL URL (`postgresql://USER:PASSWORD@host:port/db`). Must be real credentials — if you copied `.env.example` with placeholders like `USER:PASSWORD`, Postgres will reject the connection. Local Docker Compose in this repo uses user `postgres`, password `postgres`, database `landlord`. |
| `PORT` | API port (default `3000`) |
| `JWT_SECRET` | Secret for signing JWTs |
| `CORS_ORIGIN` | JSON array of allowed browser origins, e.g. `["http://localhost:5173","http://localhost:5174"]` (in `.env`, quote the value: `'["http://localhost:5173"]'`). **If unset, invalid JSON, or empty, cross-origin browser requests are blocked.** |
| `STRIPE_SECRET_KEY` | Optional; enables Stripe Checkout |
| `STRIPE_PRICE_ID` | Optional; Stripe price for subscriptions |

Each frontend may use `VITE_API_URL` (e.g. `/api` behind the Vite dev proxy, or a full API URL).

---

## Database & seed

```bash
# Start Postgres (if using bundled compose)
npm run db:up

cd api
npx prisma migrate deploy
npx prisma db seed
```

Seeded demo users are printed at the end of the seed script (landlord, platform operator, tenant). **Use only in development.**

---

## Scripts (repo root)

| Script | Description |
|--------|-------------|
| `npm run dev:api` | API dev server (`api/`) |
| `npm run dev:admin` | Admin UI (`admin/`) |
| `npm run dev:tenant` | Tenant UI (`tenant/`) |
| `npm run dev:platform` | Platform UI (`platform/`) |
| `npm run build` | Build API + all three frontends |
| `npm run db:up` | Start PostgreSQL via Docker Compose |

Typical local dev: run API plus whichever UIs you need; point frontends at the API (Vite proxy to port **3000** is the usual setup).

---

## License

Private / unlicensed unless you add a license file.
