<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Codebase overview

A mobile-first web app for **finding a running partner**. Runners set the time
windows, distance, pace range, and rough location where they're free to run; the
app's (still-to-be-built) matching system pairs them up and produces confirmed
runs. Built on **Next.js 16** (App Router, React 19, Server Components + Server
Actions), **Tailwind CSS v4**, **TypeScript** (strict), and the built-in
**`node:sqlite`** module for storage. Package manager is **pnpm**; the app ships
as a standalone Docker image.

> Heed the Next.js rules above — this is Next 16, with renamed/changed APIs (e.g.
> middleware is now `proxy.ts`). Check `node_modules/next/dist/docs/` before
> writing framework code.

## Layout

```
app/                 App Router routes, layouts, and colocated UI
  layout.tsx           Root layout: fonts, global styles, persistent BottomNav
  page.tsx             Home — the user's next confirmed run (RunCard)
  globals.css          Tailwind v4 entrypoint + theme
  login/               Email-first sign-in / one-step signup flow
    page.tsx, auth-form.tsx, actions.ts, state.ts
  profile/             View & edit profile (name, DOB, gender, pace)
    page.tsx, profile-form.tsx, actions.ts
  calendar/            "My Schedule" — the user's availability slots
    page.tsx, add-availability.tsx, actions.ts
    [id]/edit/page.tsx   Edit a slot (placeholder, not yet implemented)
  admin/               Open, access-control-free user list + impersonation
    page.tsx, actions.ts
  components/          Shared client/server UI
    bottom-nav.tsx       Fixed bottom tab bar (Profile / Home / Calendar)
    run-card.tsx, run-map.tsx
    availability-card.tsx, range-slider.tsx
    map-location-picker.tsx + map-location-picker-impl.tsx  (Leaflet)
lib/                 Server-only data layer (each file is `import "server-only"`)
  db.ts                SQLite connection (lazy, cached, WAL, FKs on)
  schema.ts            Table DDL, migrations, `User` type
  users.ts             User CRUD + cookie session helpers + auth guards
  runs.ts              Confirmed runs + participants
  availability.ts      Availability slots CRUD
  gender.ts            Gender enum/labels — shared with client, no server-only
proxy.ts             Edge auth gate (Next 16's renamed middleware)
next.config.ts       standalone output; allowed remote image hosts
Dockerfile           Multi-stage pnpm build → minimal node runner
.github/workflows/ci.yml   Lint → Build → Docker push → deploy webhook
```

## How the pieces fit

**Data layer (`lib/`).** Every `lib/*.ts` file except `gender.ts` starts with
`import "server-only"` so it can never be bundled to the client. `db.ts` opens a
single lazily-created SQLite connection (cached on `globalThis` in dev to survive
hot reloads; lazy so `next build`'s 9 worker processes don't race on the file).
`schema.ts` defines all tables with `CREATE TABLE IF NOT EXISTS` and runs
idempotent column migrations on every connect. Query modules (`users`, `runs`,
`availability`) map snake_case rows to camelCase domain types.

**Tables.** `users`, `runs`, `run_participants` (join table, run ↔ users), and
`availability` (a user's free-to-run windows). Foreign keys cascade on delete.
Pace is stored as **seconds per kilometre** throughout; the UI collects it as a
5k time and as a min–max range, converting at the edges.

**Auth & sessions.** Intentionally lightweight — single-tenant, no passwords. A
`session` cookie holds the user id; `lib/users.ts` exposes `getCurrentUser`
(memoised per request), `requireUser` (redirects to `/login`), and
`requireCompleteUser` (also redirects users who haven't finished onboarding).
`proxy.ts` is the edge gate: it enforces optional **HTTP Basic Auth** (with an
optional QR-code bypass-key cookie) and optimistically redirects sessionless
visitors to `/login`. `/admin` is deliberately public so access can be recovered
by impersonating any account — never put real secrets behind it.

**Onboarding gate.** Pages call `requireCompleteUser`; users missing
`date_of_birth` / `gender` / `preferred_pace_seconds` (legacy rows, since those
columns were added by migration as nullable) are bounced to `/login`, which
doubles as the finish-your-profile screen.

**UI conventions.** Pages are async Server Components marked
`export const dynamic = "force-dynamic"` (they read cookies / the DB per
request). Mutations are **Server Actions** in colocated `actions.ts` files,
validated server-side, then `revalidatePath` or `redirect`. Interactive bits
(`"use client"`) — forms via `useActionState`, modals, the Leaflet map picker —
live in sibling files. Imports use the `@/*` path alias (→ repo root). Inline SVG
icon components rather than an icon dependency.

**Maps.** `run-map.tsx` embeds OpenStreetMap via a keyless iframe (preview +
expand modal). `map-location-picker.tsx` is a `dynamic(..., { ssr: false })`
wrapper around a Leaflet implementation, because Leaflet touches `window` at
import time.

## Commands

- `pnpm dev` — dev server (Turbopack) at http://localhost:3000
- `pnpm build` / `pnpm start` — production build / serve
- `pnpm lint` — ESLint (flat config, `eslint.config.mjs`)

No test suite yet. CI runs lint + build on every PR to `master`, and on push to
`master` builds and pushes the Docker image then pings a deploy webhook.

## Environment variables

- `DATABASE_PATH` — SQLite file location (default `./data/app.db`)
- `BASIC_AUTH_USERNAME` / `BASIC_AUTH_PASSWORD` — enable the Basic Auth gate (both unset = open)
- `BASIC_AUTH_BYPASS_KEY` (+ optional `BASIC_AUTH_BYPASS_PARAM` / `_COOKIE` / `_MAX_AGE`) — QR-code access bypass
