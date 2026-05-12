# Design brief — Landlord Management (admin · tenant · platform)

This document is a **redesign brief** for the three Vue SPAs in this repo. It is written so it can be pasted directly into an AI design tool (Google Stitch, v0, Galileo, Figma Make…) screen-by-screen.

Every screen below reuses the **exact placeholder copy, field labels, CTAs, and empty states** already present in the codebase, so generated mockups drop into the existing components without rewriting product strings. The redesign should respect the data each view binds to today (see file references) — it is a **visual** refresh, not a functional one.

> Sources of truth:
> - Admin: `admin/src/**` (layout `admin/src/layouts/AdminLayout.vue`)
> - Tenant: `tenant/src/**` (single screen `tenant/src/views/TenantHomeView.vue`)
> - Platform: `platform/src/**` (shell `platform/src/components/PlatformShell.vue`)
> - Project overview: `README.md`

---

## 1. Shared principles

These apply to all three apps unless a section overrides them.

### 1.1 Product positioning

- **Audience:** small-to-mid landlords and property agencies (mainly XAF-denominated portfolios — see `formatMoney(..., 'XAF')` on the admin dashboard).
- **Tone:** calm, operational, trustworthy. Not "fintech-flashy". Closer to Linear / Stripe Dashboard than to a consumer app.
- **Three personas, three skins:**
  - **Admin** (landlord staff) — dense, multi-org, sidebar-driven.
  - **Tenant** (renter) — single-column, mobile-first, friendly.
  - **Platform** (SaaS operator) — top-nav console, fleet-wide read view.

### 1.2 Design tokens (already in CSS, keep them)

| Token | Admin | Tenant | Platform |
|---|---|---|---|
| Primary brand | `emerald-600 → teal-600` linear gradient | `teal-600 → emerald-600` linear gradient | `indigo-600 → violet-600` linear gradient |
| Logo monogram | `LM` (emerald/teal box) | `LM` (teal/emerald box) | `LM` (indigo/violet box) |
| Accent / success | `emerald-500` | `teal-500` | `emerald-500` |
| Warning | `amber-300/400/500` | `amber-300/400/500` | `amber-300` |
| Danger | `red-500/600` / `rose-400` | `red-500/600` | `rose-400` / `red-500` |
| Surface | `white` on slate gradient | `white/90` glassy card (`.tenant-card`) | `white/85` |
| Text | `slate-900` / `slate-600` / `slate-500` | `slate-900` / `slate-600` | `slate-900` / `slate-600` |
| Sidebar / "console" surface | `slate-900 → slate-950` gradient | (none — no sidebar) | (none — top nav only) |
| Body font | `Plus Jakarta Sans` | `DM Sans` | `Plus Jakarta Sans` |
| Border radius | `xl` (12px) for inputs, `2xl` (16px) for cards | `xl` for inputs, `3xl` (24px) for cards | `xl` for inputs, `2xl` for cards |
| Background | radial emerald + sky gradients on `slate-50` | radial teal + sky gradients on `slate-50` (dark mode supported) | `slate-50 → indigo-50 → slate-100` linear |

Tailwind is the implementation layer. **Keep the existing utility class shapes** (`rounded-2xl`, `bg-linear-to-r from-emerald-600 to-teal-600`, `ring-1 ring-white/10`, etc.) so the redesign can swap into Vue templates with minimal churn.

### 1.3 Common UI elements (reused everywhere)

- **Card:** `rounded-2xl border border-slate-200/80 bg-white shadow-sm` (admin / platform) or `.tenant-card` glassy variant (tenant).
- **KPI tile:** label (`text-xs uppercase tracking-wide text-slate-500`), value (`text-2xl/3xl font-bold tabular-nums`), one-line hint, soft gradient blob top-right.
- **Status pill:** `rounded-full px-2 py-0.5 text-xs font-medium` with semantic colour pairs (`bg-emerald-100 text-emerald-800`, `bg-red-100 text-red-800`, `bg-amber-100 text-amber-900`, `bg-blue-100 text-blue-800`).
- **Primary button:** gradient pill, `text-sm font-semibold text-white`, soft brand shadow, disabled @ 50% opacity.
- **Empty state:** centered title + one-line guidance + single primary CTA (component: `admin/src/components/EmptyState.vue`).
- **Toasts:** see `ToastNotifications.vue` in admin & platform.

### 1.4 i18n + dark mode

- All three apps ship **English + French**. The redesign must accommodate ~30% longer French strings without breaking layout (especially nav labels and pill copy).
- Only the **tenant** app has a dark mode today (`@custom-variant dark`). Designs for tenant should include both light and dark.

---

## 2. Admin app (landlord staff)

Brand: emerald/teal · sidebar console · multi-organization.

### 2.1 Layout shell — `AdminLayout.vue`

**Structure (do not change):**

- Fixed left sidebar — collapsible (16-wide collapsed → 72-wide expanded). State persisted in `localStorage` as `lm_sidebar_collapsed`.
- Sticky top header (h-16) — page title (from `route.meta.title`), org selector, profile menu.
- Main content: `mx-auto max-w-7xl p-4 sm:p-6 lg:p-8`.

**Sidebar copy (verbatim):**

- Header: `Console` (kicker) / `Landlord Admin` (title) / logo monogram `LM`.
- Footer: `Language` selector · `Property & rent operations` · `v0.1 · local dev`.
- Nav items (order matters, icons from `@heroicons/vue/24/outline`):
  1. `Overview` (Squares2X2Icon) → `/`
  2. `Properties` (BuildingOffice2Icon) → `/properties`
  3. `Renters` (UsersIcon) → `/renters`
  4. `Tenant signups` (ClockIcon) → `/tenant-signups`
  5. `Leases` (DocumentTextIcon) → `/leases`
  6. `Payments` (WalletIcon) → `/payments`
  7. `Receipts` (ClipboardDocumentCheckIcon) → `/receipts`
  8. `Team` (UserGroupIcon) → `/team` *(OWNER/MANAGER only)*
  9. `Audit log` (ClipboardDocumentListIcon) → `/audit-log` *(OWNER/MANAGER only)*
  10. `Support` (LifebuoyIcon) → `/support`

**Header copy:**

- Subtitle under page title: `Portfolio, renters & rent collection`.
- Org selector placeholder: `Select organization` (or `Loading…`).
- Profile menu shows: email, current org name, org role label + hint, sign-out.

**Redesign goals:**

- Keep the dark sidebar identity but explore: pinned-favourites at the top, a compact org switcher in the sidebar itself (avoid the user having to glance to the top-right), and a global ⌘K command palette in the header.
- Active nav item: emerald-tinted left rail accent + white text.

### 2.2 Dashboard / Overview — `DashboardView.vue`

**Sections in order:**

1. **Create organization** card
   - Title: `Create organization`
   - Body: `Each organization is an isolated portfolio (your SaaS tenant). Add one for each landlord or agency you manage.`
   - Input label: `Organization name` · placeholder: `e.g. Douala Rentals`
   - Primary CTA: `Create` (states: `Creating…`).

2. **Tenant self-signup** card (when org selected)
   - Kicker: `Tenant self-signup`
   - Body: `Share the sign-up code (letters and numbers) with renters so they can request access in the tenant app. The internal ID still works for advanced cases.`
   - Fields: `Sign-up code` (mono, with `Copy`) · `Organization ID` (mono, with `Copy`)
   - Toast: `Sign-up code copied` / `Organization ID copied` / `Could not copy`.

3. **No-org banner** (when none selected)
   - `Select an organization above` · `Overview metrics appear after you pick a portfolio from the header menu.` (amber tone).

4. **Getting started** onboarding card (when `completionPercent < 100`)
   - Title: `Getting started` · sub: `{n}% complete · finish these steps to run a clean demo or go live.`
   - Optional alert: `{n} tenant signup(s) waiting — visit Renters to approve.`
   - Each step is a row with a circular check, label, description, and an `Open` link to its route.

5. **Exports** card (OWNER/MANAGER)
   - Title: `Exports` · sub: `Download a UTF-8 rent roll for spreadsheets or audits.`
   - CTA: `Rent roll (CSV)` (states: `Preparing…`).

6. **Portfolio snapshot** — 4-up KPI grid:
   - `Properties` — count · `Buildings & sites` · violet→purple blob
   - `Units` — count · `{occupied} occupied · {vacant} vacant` · emerald→teal blob
   - `Renters` — count · `Active profiles` · sky→blue blob
   - `Leases` — count · `Recorded agreements` · amber→orange blob

7. **Occupancy** progress bar (when `unitCount > 0`)
   - Subtitle: `Portfolio load — {occupied} of {total} units occupied.`

8. **Portfolio analytics** — dark slate-900 panel with 4 KPIs:
   - `Vacancy rate` (% + 1.5px bar; colour ramps emerald/amber/red on ≤15 / ≤30 / >30) — hint: `Healthy occupancy` / `Moderate vacancy` / `High vacancy`.
   - `Collection (30d)` — `On track` / `Needs attention` / `Critical` / `No charges yet`.
   - `Overdue charges` — `All current` / `1 payment past due` / `{n} payments past due`.
   - `Rent roll (30d)` — `{paid} / {due}` in XAF, % collected.
   - Below: **Arrears aging** stacked bars: `0–30 days` (amber), `31–60 days` (orange), `61–90 days` (red), `91+ days` (dark red).

**Redesign goals:** improve the visual hierarchy of the analytics block (right now everything sits inside one dark slab), let the onboarding card auto-dismiss when complete, and elevate the rent-roll export so it's reachable without scrolling past KPIs.

### 2.3 Other admin screens (placeholders to honour)

For each view, keep the title shown in `route.meta.title` and the verbs/CTAs already used.

| View | Page title | Key placeholders / patterns |
|---|---|---|
| `PropertiesView.vue` | `Properties` | Paginated table (`page`, `limit`, `search`); add-property modal; row → `properties/:id/units`. |
| `PropertyUnitsView.vue` | `Property units` | Breadcrumb back to Properties; per-unit electricity (`PREPAID_EXTERNAL` / `METERED_KWH`) + water (`NONE` / `METERED_M3`) settings with kWh/m³ prices. |
| `RentersView.vue` | `Renters` | Paginated search list; add-renter form with optional **`initialPassword`** (min 8) and **"Copy tenant registration link"** when no password. |
| `TenantSignupsView.vue` | `Tenant signups` | Two queues (pending / processed); `Approve` opens unit-assignment + lease-terms modal; `Reject` with reason. |
| `LeasesView.vue` | `Leases` | Paginated; lease create accepts optional **`prepaidMonths`** (0–60) generating PAID payments from first rent due ≥ start. |
| `PaymentsView.vue` | `Payments` | Filter by status (`PAID`, `UNPAID`, `OVERDUE`, `PENDING_VERIFICATION`); mark paid; row drawer with proof image. |
| `ReceiptsView.vue` | `Receipt verification` | Queue of `PENDING_VERIFICATION`; preview proof + `Approve` / `Reject` + rejection note input. |
| `TeamView.vue` | `Team` | Members table (`OWNER` / `MANAGER` / `STAFF`); invitations list (`Pending` / `Accepted` / `Revoked`); `Invite by email` form. |
| `SupportRequestsView.vue` | `Support` | Compose new ticket (subject, category `MAINTENANCE` / `BILLING` / `GENERAL` / `OTHER`, urgency `LOW` / `NORMAL` / `HIGH`); list with status pills (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`). |
| `AuditLogView.vue` | `Audit log` | Reverse-chronological event stream; filter by actor + entity type; mono timestamps. |

### 2.4 Admin — Stitch-ready prompt

> Design a desktop SaaS console called **Landlord Admin**. Use the existing identity: deep slate sidebar (gradient `slate-900 → slate-950`) with emerald/teal accents (`emerald-500`/`teal-600`), white content surface on a soft emerald-tinted slate background, `Plus Jakarta Sans`, and `2xl` rounded cards. The sidebar is collapsible and contains the nav items in §2.1. Build screens for: (1) **Overview** with the four KPI cards (`Properties`, `Units`, `Renters`, `Leases`), an onboarding checklist, a `Tenant self-signup` code card with copy buttons, and a dark "Portfolio analytics" panel containing vacancy rate, 30-day collection rate, overdue charges, 30-day rent roll, and a horizontal arrears-aging bar chart with buckets `0–30 / 31–60 / 61–90 / 91+ days`; (2) **Renters** paginated search table with an add-renter drawer that can set an initial portal password OR generate a tenant registration link; (3) **Receipt verification** queue showing payment proofs with `Approve` / `Reject` actions and a rejection-note input; (4) **Team** members list with role pills and an invitations sub-section. Keep all copy and CTAs verbatim from §2.2–2.3.

---

## 3. Tenant app (renter portal)

Brand: teal/emerald · single mobile-first page · tabbed sections · dark mode supported.

### 3.1 Shell

- **No sidebar.** The whole signed-in experience lives at `/` (`TenantHomeView.vue`) with a sticky glassy header.
- Container width: `max-w-2xl` (mobile-first), grows to `lg:max-w-3xl`.
- Background: `tenant-auth-screen` gradient on auth pages, soft teal/sky gradient on the home page.

**Header — verbatim:**

- Left: `TenantMark` (LM monogram) + organization name as subtitle.
- Right: `TenantHeaderMenu` (popover) containing:
  - Sign out
  - Change password
  - Contact support
  - Language switcher (English / French)
  - Dark mode toggle

### 3.2 Auth screens

All auth screens use `.tenant-card` (rounded-3xl, glassy white, soft slate shadow) centered in `tenant-auth-screen`.

#### Login — `TenantLoginView.vue`

- Title: `Welcome back` (`login.title`)
- Subtitle: `Sign in to view your lease, rent schedule, and messages from your landlord.` (`login.subtitle`)
- Fields: `Email`, `Password` (both via `.tenant-input`).
- Primary CTA: `Sign in` (states: `Signing in…`).
- Error block: rounded red banner inside the card.
- Below form: `Forgot password?` (underline link).
- Footer: `First time here? Create your account` (teal underline link to `/register`).

#### Register — `TenantRegisterView.vue`

Two paths in a single screen:

- **New signup:** organization **ID** *or* **slug** + your full name → goes into pending queue.
- **Existing renter:** `Renter ID` or invite link (`?token=...`).
- After submit: redirect to the home with the **"Waiting for landlord approval"** state.

#### Forgot / Reset password

Standard one-input flows. Copy is conservative: `Enter the email on your tenant account and we'll send a reset link.`

### 3.3 Home — three account states

The home is one page that renders one of three states based on `GET /tenant/me`.

#### A. `status: 'pending'`

Amber card, role=status:

- Heading: `Waiting for landlord approval`
- Body: `{server message}`
- Hint: `You can leave this page open or sign out and return later — we'll show your lease here once your landlord assigns your unit.`

Below it, a `Your details` card showing the name, email, phone the renter submitted.

#### B. `status: 'rejected'`

Red card:

- Heading: `Registration not approved`
- Body: `{server message}`

#### C. `status: 'active'` — main app

Three components stacked:

1. **Profile card** — avatar (initials, teal gradient), kicker `Your profile`, name, email, phone.
2. **Tab bar** — segmented pill `Overview` / `Leases` / `Support` (badge dot on Support when open/in-progress tickets > 0).
3. **Tab content** (see below).

### 3.4 Tabs

#### 3.4.1 Overview

- **What's due next** card (emerald gradient when something is due, plain when not):
  - Kicker: `What's due next`
  - Headline: `{rent or utility label} · {money}`
  - Sub: `{place / property label}`
  - Sub-sub: `Due {date}`
  - Status badge for proof state (see §3.4.4).
- **Quick links** to the Leases tab (`View all leases`).
- A compact **Lease snippets** preview: property name, unit label, start date, "open-ended" or end date, monthly rent.

#### 3.4.2 Leases

For each lease row, render a card containing:

- Property name + unit label (`unit.label`).
- Period: `start → end` or `start · open-ended`.
- Monthly rent: `money(rentAmount, currency)` + `Due day {n}` annotation.
- Sub-sections:
  - **Rent payments** — chronological list, status pill, `Upload receipt` action when unpaid.
  - **Utilities** — only when `electricityBilling !== 'PREPAID_EXTERNAL'` *or* `waterBilling !== 'NONE'`:
    - Group by year/month (`utilityPeriodLabel`).
    - Show `previousIndex → currentIndex` and computed `consumption` (kWh / m³).
    - Price per unit (`moneyPerKwh`).
    - Same status + upload flow as rent.

#### 3.4.3 Support

- **Tickets list** — most-recent first. Each row: subject, category chip, urgency chip, status pill, created date. Tap to expand: full message, resolution note if `CLOSED`.
- **Inline new-ticket button** — opens `TenantModal` with: `Subject`, `Message`, `Category` (`MAINTENANCE` / `BILLING` / `GENERAL` / `OTHER`), `Urgency` (`LOW` / `NORMAL` / `HIGH`).
- Empty state: `No tickets yet — open one above if you need help.`

#### 3.4.4 Status pill copy (verbatim)

Rent / utility proof labels (`rentProofLabel`):

- `PAID` → `Paid` (emerald)
- `PENDING_VERIFICATION` → `Receipt sent — waiting for landlord` (blue)
- `REJECTED` → `Receipt rejected — upload again` (red)
- Otherwise → `Unpaid` (slate)

### 3.5 Tenant — Stitch-ready prompt

> Design a calm, mobile-first renter portal called the **Tenant app**. Use `DM Sans`, a glassy white card style (`.tenant-card`: `rounded-3xl`, soft slate shadow), a soft teal+sky radial background, and a teal-to-emerald gradient as the primary brand (`teal-600 → emerald-600`). Support **light and dark** mode (dark uses `slate-900` background with the same teal accents). Build: (1) **Login** card with title `Welcome back`, subtitle `Sign in to view your lease, rent schedule, and messages from your landlord.`, email + password inputs, primary `Sign in` button, footer links `Forgot password?` and `First time here? Create your account`; (2) **Registration** with two paths — sign up by organization ID/slug + full name, OR claim by renter ID / invite token; (3) **Home — waiting for approval** amber card with the heading `Waiting for landlord approval` and a `Your details` summary below; (4) **Home — active**: profile card (avatar with initials), a three-tab pill bar `Overview / Leases / Support` (the Support tab can show a numeric badge), an emerald "What's due next" card showing the next rent or utility charge with amount, place, due date, and a status pill (`Paid`, `Receipt sent — waiting for landlord`, `Receipt rejected — upload again`, `Unpaid`), a lease list with electricity/water meter readings (`previousIndex → currentIndex`, consumption, price per kWh / m³), and a support tab listing tickets with category and urgency chips plus a `New ticket` button opening a modal. Keep all copy from §3.2–3.4 verbatim.

---

## 4. Platform app (SaaS operator console)

Brand: indigo/violet · top-nav console · cross-tenant read-mostly view.

### 4.1 Shell — `PlatformShell.vue`

- Sticky top header (`max-w-6xl` container, glassy white).
- Left: `LM` monogram (indigo→violet gradient) + kicker `Platform` / sub `Operator console`.
- Center nav: `Organizations` and `Support` (active pill: `bg-indigo-600 text-white`).
- Right: language selector, signed-in email, `Sign out` button.
- Main: `mx-auto max-w-6xl px-4 py-8 sm:px-8`.

### 4.2 Organizations — `OrganizationsView.vue`

**Page header:**

- Title: `Organizations`
- Sub: `Search, open an organization, suspend access, or bootstrap a new org (you become the first owner).`
- Primary CTA (top-right): `New organization`

**Fleet health** dark panel (`bg-slate-900`):

- Header: `Fleet health` kicker · `Snapshot {timestamp}`.
- Six tiles (left → right): `Open tickets` (linked to `/support` via `Queue →`), `Pending signups`, `Orgs, no properties`, `Subs past due`, `Active leases`, `Stripe customers`.
- Tile colour rules: amber when `> 0` for ops counts; emerald for the positive revenue signals; rose for `Subs past due > 0`.

**Stats row** (3-up cards):

- `Total` (slate), `Active` (emerald), `Suspended` (red).

**Toolbar:**

- Search input — placeholder: `Search by name, slug, or ID…`
- `Refresh` link button.

**Table columns:** `Name` (with `slug` sub-line and an amber **`Empty portfolio`** badge if `!suspendedAt && properties==0`), `Open` (View link), `Support` (`Tickets` link to `/support?organizationId=…`), `Status` (`Active` / `Suspended` pill), `Subscription` (pill: `active` emerald, `trialing` blue, `past_due` red, `canceled`/none slate), `Counts` (`{m} members · {p} props · {r} renters`), `Suspended` timestamp, Action (`Suspend` / `Unsuspend`).

**Empty states:**

- With search query: `No organizations match your search.`
- No data: `No organizations yet.`

**New-organization modal:**

- Title: `New organization`
- Body: `Creates the org and adds your platform account as Owner. Use for demos or when onboarding a customer; you can invite their staff afterward.`
- Fields: `Name` (required), `Slug (optional)` placeholder `acme-rentals`.
- Buttons: `Cancel`, `Create` (states: `Creating…`).

### 4.3 Support queue — `SupportRequestsView.vue`

- Two-pane layout: filters/list (left) + detail drawer (right).
- Filters: org dropdown, status (`OPEN` / `IN_PROGRESS` / `RESOLVED` / `CLOSED`), urgency, category.
- Each row: subject, org name, category + urgency chips, status pill, age.
- Detail: full message, history, reply box, `Mark in progress` / `Resolve` / `Close` actions, resolution-note input.

### 4.4 Org detail — `PlatformOrgLayout.vue` + `views/platform-org/*`

- Header: `← All organizations` breadcrumb + bold org name.
- Sub-nav (`PlatformOrgNav.vue`) tab strip: `Overview`, `Team`, `Properties`, `Renters`, `Leases`, `Payments`, `Signups`, `Audit log`, `Support`.
- Each sub-view is **read-only** (no edit buttons) — it's a diagnostic mirror of admin screens for that org. Keep the same column layout as admin's equivalent so operators can swap mental models.
- `Overview` mirrors admin Dashboard KPIs + an extra row of platform diagnostics (subscription status, Stripe customer ID, suspension timeline).

### 4.5 Auth screens — `PlatformLoginView.vue` / `PlatformForgotPasswordView.vue` / `PlatformResetPasswordView.vue`

- Same card style as admin login but with the indigo brand.
- Login title: `Platform sign in` · sub: `Operator console for landlord-management.`
- Forgot/reset use the same conservative copy as admin: one input, one CTA.

### 4.6 Platform — Stitch-ready prompt

> Design a top-nav SaaS operator console called the **Platform app**. Use `Plus Jakarta Sans`, indigo-to-violet gradient brand (`indigo-600 → violet-600`), white glassy header on a soft indigo-tinted slate background, and `2xl` rounded cards. Build: (1) a sticky **header** with an `LM` monogram, kicker `Platform / Operator console`, two nav pills `Organizations` and `Support`, a language switcher, the signed-in email, and a `Sign out` button; (2) **Organizations** screen with a dark `bg-slate-900` "Fleet health" panel containing six diagnostic tiles (`Open tickets`, `Pending signups`, `Orgs, no properties`, `Subs past due`, `Active leases`, `Stripe customers`), then three stats cards (`Total` / `Active` / `Suspended`), a search bar (`Search by name, slug, or ID…`), and a data table with columns Name (with slug sub-line and an amber `Empty portfolio` chip when applicable), Open, Support, Status (`Active`/`Suspended` pill), Subscription (`active`/`trialing`/`past_due`/`canceled` pills), Counts (`{m} members · {p} props · {r} renters`), Suspended timestamp, Action (`Suspend`/`Unsuspend`); (3) a `New organization` modal with title `New organization`, the body text from §4.2, a required `Name`, an optional `Slug` (placeholder `acme-rentals`), and `Cancel`/`Create` buttons; (4) an **Org detail** layout with a breadcrumb `← All organizations`, an org-name title, and a tab strip `Overview / Team / Properties / Renters / Leases / Payments / Signups / Audit log / Support`, each rendering read-only mirrors of the admin screens. Keep all copy from §4.2–4.5 verbatim.

---

## 5. Cross-cutting redesign goals

Independent of the per-app sections above, the redesign should land these improvements:

1. **Consistent tabular data style.** Today admin/platform tables look slightly different. Standardise on: zebra-free, `divide-y divide-slate-100`, hover `bg-slate-50/50`, header `bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500`, cells `px-4 py-3`.
2. **Status pill palette.** A single mapping of state → colour pair used across rent, utility, payment, subscription, support, signup, suspension. Document the mapping in a `pill.md` or a `lib/pills.ts` once finalised.
3. **Empty-state component.** `EmptyState.vue` already exists in admin — extend tenant + platform to use the same primitive (title, one-line subtitle, optional icon, optional single CTA).
4. **Responsive breakpoints.** Admin must stay usable from 1024px laptops; tenant must be flawless from 360px upward; platform is desktop-first.
5. **Accessibility.** Maintain visible focus rings (`focus:ring-2 focus:ring-{brand}-500/20`), keep AA contrast on dark slate panels, and preserve `role="status"` / `role="alert"` regions that already exist on the tenant Home pending/rejected cards.
6. **Loading skeletons.** All three apps already show animated skeleton bars (`animate-pulse bg-slate-100/200`). Keep that pattern; standardise sizes per content type (KPI tile / table row / card).

---

## 6. Deliverables checklist for the redesign

When the redesign returns from Stitch (or any other tool), expect one Figma file per app with the following frames:

- **Admin (12 frames):** Login · Register · Forgot password · Reset password · Invite accept · Dashboard (no org / org selected) · Properties · Property units · Renters · Tenant signups · Leases · Payments · Receipts · Team · Support · Audit log. (Plus mobile-collapsed sidebar state.)
- **Tenant (8 frames):** Login · Register · Forgot password · Reset password · Home pending · Home rejected · Home active (Overview / Leases / Support tabs) · New support ticket modal. Each in **light + dark**.
- **Platform (8 frames):** Login · Forgot password · Reset password · Organizations (with Fleet health) · New organization modal · Support queue · Org detail Overview · Org detail Properties (representative read-only mirror).

Each frame must keep the **exact copy** from this brief so the front-end swap is purely a CSS / markup pass.
