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
| `docs/` | Diagrams and other project docs ([`docs/seeding.md`](docs/seeding.md) — migrations & seed) |

---

## Current features

### Backend (`api/`)

- **Health:** `GET /`, `GET /health`.
- **Auth (JWT):**
  - `POST /auth/register`, `POST /auth/login` — staff users (`typ: staff`) for landlord workflows; users with `isPlatformAdmin` get `typ: platform`.
  - Org-scoped routes require membership; **suspended** organizations are blocked for staff (platform can bypass where implemented).
- **Organizations:** create/list (staff), per-org read/update/summary for members (`/organizations/...`).
- **Org team & invitations:** list/update/remove members and roles; create/list/revoke email invitations (`/organizations/:orgId/members...`, `.../invitations...`). Public preview/accept: `GET /invitations/organization?token=`, `POST /invitations/organization/accept` (JWT staff).
- **Domain (per organization):** CRUD-style APIs for **properties**, **units**, **renters**, **leases**, **payments** under `organizations/:orgId/...` (all protected by JWT + org membership). List endpoints for **properties**, **units**, **renters**, and **leases** support **`page`**, **`limit`**, and **`search`** and return a paginated envelope `{ items, total, page, limit }`. Creating a **lease** accepts optional **`prepaidMonths`** (0–60): that many consecutive monthly **`Payment`** rows are created as **PAID** from the first rent due on/after the lease start (same schedule as **`dueDay`**).
- **Renter → tenant invite:** `POST .../renters/:renterId/tenant-invite` issues a token and a **`registerUrl`** (base URL from **`TENANT_PUBLIC_URL`** in `api/.env`, default `http://localhost:5174`).
- **Create renter with portal login:** `POST .../renters` accepts optional **`initialPassword`** (min 8 chars) together with **`email`** — creates a **User** linked to the renter so the tenant can sign in immediately; they can change the password in the tenant app.
- **Tenant portal API:** `POST /tenant/auth/register` — **claim** existing renter (`renterId` / `inviteToken`) **or** **request access** with `organizationId` and/or `organizationSlug` + `fullName` (creates a pending signup for admin approval). `POST /tenant/auth/login` returns `accountStatus`: `active` | `pending` | `rejected`. Public: `GET /tenant/invites/preview?token=`, `GET /tenant/organizations/preview?id=` or `slug=`. `POST /tenant/auth/change-password`; `GET /tenant/me` (includes `status` for pending/rejected), `GET /tenant/leases` (JWT `typ: tenant`).
- **Admin — pending tenant signups:** `GET/POST .../organizations/:orgId/tenant-signups` — list pending requests; **`POST .../:requestId/approve`** (assign `unitId`, lease terms) creates renter + lease and activates portal access; **`POST .../:requestId/reject`**. Any org member (`OWNER` / `MANAGER` / `STAFF`) may use these routes; team invitations and role changes remain owner/manager-only.
- **Platform API:** `GET /platform/organizations`, `GET /platform/organizations/:orgId` (read-only org detail + light diagnostics), `PATCH /platform/organizations/:orgId/suspend` (JWT `typ: platform` + platform admin).
- **Billing (optional):** `POST /billing/organizations/:orgId/checkout` — Stripe Checkout session when `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` are set; otherwise the endpoint responds with a configuration error.
- **Data model:** organizations (incl. suspension, subscription-related fields for Stripe), users, org membership, **organization invitations**, renters (optional link to login user, optional **invite token** for registration), leases, payments, etc. See `api/prisma/schema.prisma`.

### Admin app (`admin/`)

- Register / login as **landlord staff**; JWT stored for API calls.
- **Organization** selector; screens for **overview**, **properties**, **units** (per property), **renters**, **leases**, **payments** (aligned with org-scoped API).
- **Team:** manage members and pending invitations; invite by email (`/team`). **Accept org invite:** `/invite?token=...` (after login).
- **Tenant signups:** `/tenant-signups` — approve or reject self-serve tenant requests (assign unit + rent when approving).
- **Lists:** properties, renters, and leases support **pagination and search**; when adding a renter you can set an **initial portal password** (with email) or **copy tenant registration link** if they will self-register.

### Tenant app (`tenant/`)

- **Register** — **New signup:** organization **ID** or **slug** from the landlord + your name (waits for approval). **Renter ID** / **invite link** (`?token=...`) for existing profiles. **Home** shows a clear **waiting for approval** state until the landlord approves and assigns a unit.
- **Login**; signed-in **home**: profile, **leases**, and **change password**.

### Platform app (`platform/`)

- Login with a **platform administrator** account (not landlord or renter users).
- **Organizations** table: list orgs; open **detail** for read-only diagnostics; **suspend / unsuspend** via platform API.

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
| `TENANT_PUBLIC_URL` | Optional; base URL for renter registration links from `tenant-invite` (e.g. `http://localhost:5174`) |

Each frontend may use `VITE_API_URL` (e.g. `/api` behind the Vite dev proxy, or a full API URL).

---

## Database & seed

**Full guide:** [`docs/seeding.md`](docs/seeding.md) (migrations, demo accounts, reset vs deploy, troubleshooting).

Quick start:

```bash
# Start Postgres (if using bundled compose)
npm run db:up

cd api
npx prisma migrate deploy
npx prisma db seed
```

**Wipe local dev DB and reseed** (destroys all data — never on production):

```bash
cd api && npx prisma migrate reset --force
# or from repo root:
npm run db:reset
```

Seeded demo users are printed at the end of the seed script. **Use only in development.**

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
| `npm run db:reset` | **Dev only:** `prisma migrate reset --force` in `api/` (drops DB, migrates, seeds) |

Typical local dev: run API plus whichever UIs you need; point frontends at the API (Vite proxy to port **3000** is the usual setup).

---

## License

Private / unlicensed unless you add a license file.
