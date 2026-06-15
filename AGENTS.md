<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may
all differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Codebase Overview

A mobile-first web app for **finding a running partner**. Runners create
availability slots with date, time window, distance, pace range, and rough
location; the current dummy scheduler turns those slots into confirmed runs with
up to two random partners. Built on **Next.js 16.2.6** (App Router, React 19,
Server Components + Server Actions), **Tailwind CSS v4**, **TypeScript**
(strict), and the built-in **`node:sqlite`** module for storage. Package manager
is **pnpm**; the app ships as a standalone Docker image.

> Heed the Next.js rules above. This is Next 16, with renamed/changed APIs (for
> example middleware is now `proxy.ts`). Check `node_modules/next/dist/docs/`
> before writing framework code.

## Layout

```
app/                     App Router routes, layouts, and colocated UI
  layout.tsx             Root layout: fonts, global styles, persistent BottomNav
  page.tsx               Home - runs in the next 24 hours plus run follow-ups
  globals.css            Tailwind v4 entrypoint + theme/animation rules
  login/                 Email-first sign-in/signup and onboarding wizard
    page.tsx, onboarding-wizard.tsx, actions.ts, state.ts
  profile/               Profile, avatar upload/removal, running-vibe fields
    page.tsx, profile-form.tsx, avatar-form.tsx, actions.ts, profile-content.tsx
  schedule/              "My Schedule" availability list and add/delete modal
    page.tsx, add-availability.tsx, actions.ts
    [id]/edit/page.tsx   Placeholder edit page (updateAvailability exists in lib)
  admin/                 Public recovery/admin user list + impersonation/logout
    page.tsx, actions.ts
  api/runs/[runId]/events/route.ts
                           Node runtime SSE endpoint for live run message updates
  avatars/[userId]/route.ts
  run-photos/[runId]/route.ts
                           Local image-serving route handlers for uploads
  components/            Shared client/server UI
    bottom-nav.tsx, availability-card.tsx, range-slider.tsx
    map-location-picker.tsx + map-location-picker-impl.tsx  (Leaflet, no SSR)
    run-card.tsx, run-map.tsx, run-message-form.tsx, run-partners-live.tsx
    finish-run.tsx, run-photo-step.tsx, run-rating-step.tsx
    runner-modal.tsx, rating-badge.tsx, running-vibe-nudge.tsx
lib/                     Mostly server-only data/domain layer
  db.ts                  SQLite connection (lazy, cached, WAL, FKs on)
  schema.ts              Table DDL, migrations, `User` type
  users.ts               User CRUD + cookie session helpers + auth guards
  availability.ts        Availability CRUD plus seed/backfill hooks
  runs.ts                Dummy scheduler, run queries, messages, finish/unfinish
  ratings.ts             Partner rating validation/upsert and summaries
  avatars.ts             Avatar file persistence under the data directory
  run-photos.ts          Group-photo file persistence under the data directory
  realtime.ts            In-process pub/sub for run message SSE
  geocoding.ts           Nominatim reverse-geocoding with cache/rate limit
  matching.ts            Pure time helpers used by the scheduler
  profile-fields.ts      Pace/text validation shared by login/profile flows
  format-date.ts         Date/age helpers shared by server/client code
  gender.ts              Gender enum/labels shared with client code
backend_test/            Vitest backend tests and SQLite test harness
proxy.ts                 Edge auth gate (Next 16's renamed middleware)
next.config.ts           Standalone output, upload body limit, image patterns
Dockerfile               Multi-stage pnpm build -> minimal node runner
.github/workflows/ci.yml Lint -> Build -> Test -> Docker push/deploy on master
```

## How The Pieces Fit

**Data layer (`lib/`).** Most `lib/*.ts` files start with `import "server-only"`
so they cannot be bundled to the client. Shared pure helpers intentionally do
not: `gender.ts`, `format-date.ts`, `matching.ts`, and `profile-fields.ts`.
`db.ts` opens a single lazily-created SQLite connection, cached on `globalThis`
in development and opened lazily so `next build` workers do not race on the DB
file. `schema.ts` defines tables with `CREATE TABLE IF NOT EXISTS` and applies
idempotent column/table migrations on every connect. Query modules map
snake_case rows to camelCase domain types.

**Tables.** Current tables are `users`, `availability`, `runs`,
`run_participants`, and `run_ratings`. Foreign keys cascade on delete. Pace is
stored as **seconds per kilometre** throughout; the profile/onboarding UI
collects an optional conversational 5k time and availability collects a min/max
per-km pace range, converting at the edges.

**Auth & sessions.** Auth is intentionally lightweight: single-tenant, no
passwords. The `session` cookie holds the user id; `lib/users.ts` exposes
`getCurrentUser` (memoized per request), `requireUser`, and
`requireCompleteUser`. `proxy.ts` enforces optional HTTP Basic Auth (with an
optional QR-code bypass-key cookie) and redirects sessionless visitors to
`/login`. `/admin` is deliberately public so access can be recovered by
impersonating any account - never put real secrets behind it.

**Onboarding gate.** `/login` is both sign-in and signup. The wizard first
checks email: complete returning users are signed in and redirected home,
incomplete returning users resume onboarding, and new users continue through the
flow. Required profile fields are `name`, `date_of_birth`, and `gender`; optional
fields are avatar, conversational 5k time, `why_run`, `hobbies`, and
`interests`. Users missing required fields are bounced to `/login` by
`requireCompleteUser`. Preferred pace is optional and may be null.

**Scheduling and runs.** Creating an availability slot schedules one run from
that slot: the host's date, midpoint of the time window, distance, and reverse
geocoded location are copied to `runs`, then up to two random other users are
added as participants. If there are no partners, no run is created yet. A lazy
backfill (`ensureRunsBackfilled`) creates runs for legacy/seed slots that do not
already have one. Deleting an availability slot cascades to only the run linked
through `runs.availability_id`; updating support exists in `lib/availability.ts`
but the route UI is still a placeholder.

**Run lifecycle.** The home page shows all visible runs for the current user
that start within the next 24 hours. Participants can add/edit/clear a short
message; partner message updates are published through in-process pub/sub and
streamed over `/api/runs/[runId]/events` using SSE. Finishing a run hides it for
that participant. The first finisher is prompted to add a group photo, then
participants rate each partner from 1 to 5 stars. Ratings upsert into
`run_ratings` and feed profile/runner rating summaries.

**Uploads.** Avatars and run group photos are stored on disk beside the SQLite
database: `data/avatars` and `data/run-photos` by default, or beside
`DATABASE_PATH` when that env var is set. JPEG, PNG, and WebP are accepted up to
5 MB. `next.config.ts` raises the Server Action body limit to `5mb` and allows
local image URLs under `/avatars/**` and `/run-photos/**`; route handlers serve
the files with cache-busting query strings.

**UI conventions.** Pages that read cookies or DB data are async Server
Components marked `export const dynamic = "force-dynamic"`. Mutations are Server
Actions in colocated `actions.ts` files, validated server-side, then
`revalidatePath` or `redirect`. Interactive bits (`"use client"`) live in
sibling components and generally use `useActionState`. Imports use the `@/*`
path alias to the repo root. The app uses inline SVG icon components rather than
an icon dependency.

**Maps and geocoding.** `run-map.tsx` embeds OpenStreetMap via a keyless iframe
preview with an expand modal. `map-location-picker.tsx` is a
`dynamic(..., { ssr: false })` wrapper around the Leaflet implementation because
Leaflet touches `window` at import time. `lib/geocoding.ts` reverse-geocodes
meeting labels with Nominatim, a small in-memory cache, and a 1.1s request gap.

## Commands

- `pnpm dev` - dev server at http://localhost:3000
- `pnpm build` / `pnpm start` - production build / serve
- `pnpm lint` - ESLint flat config (`eslint.config.mjs`)
- `pnpm test` - Vitest backend suite in `backend_test/`

CI runs lint, build, and tests on PRs to `master`. On push to `master`, a deploy
job waits for those checks, builds/pushes the Docker image, then pings the deploy
webhook.

## Environment Variables

- `DATABASE_PATH` - SQLite file location (default `./data/app.db`); uploaded
  avatars/photos are stored beside this file.
- `BASIC_AUTH_USERNAME` / `BASIC_AUTH_PASSWORD` - enable the Basic Auth gate
  when both are set (both unset = open).
- `BASIC_AUTH_BYPASS_KEY` plus optional `BASIC_AUTH_BYPASS_PARAM`,
  `BASIC_AUTH_BYPASS_COOKIE`, and `BASIC_AUTH_BYPASS_MAX_AGE` - QR-code access
  bypass.
