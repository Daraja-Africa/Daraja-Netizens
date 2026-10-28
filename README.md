# Daraja Netizens

Daraja Netizens is a Jitsi-first enterprise video conferencing platform designed for secure meetings, attendance monitoring, and telemetry collection. The project is structured as a small monorepo so the web app and API can evolve independently while sharing the same product architecture.

## Architecture overview

- Web app: React + Vite SPA for meeting entry, room launch, attendee check-in, and embedded Jitsi conference UI.
- API: Express + TypeScript service that issues short-lived JWTs for room access and ingests attendance telemetry.
- Persistence: Supabase Cloud provides PostgreSQL and strict deny-by-default RLS; Redis is reserved for burst telemetry buffering.
- Deployment: Vercel hosts the web app, Render hosts the API, and `meet.jit.si` provides the conference infrastructure.

## Quick start

1. Install dependencies:
   npm install
2. Start the API:
   npm run dev:api
3. Start the web app:
   npm run dev:web
4. Open the local app at http://localhost:5173

## Environment configuration

- Copy `apps/api/.env.example` to `apps/api/.env`
- Copy `apps/web/.env.example` to `apps/web/.env`

The web app expects the API origin and Jitsi domain to be configured for local dev.
The API uses `SUPABASE_SERVICE_ROLE_KEY` for server-side database access. This key
must never be added to `apps/web/.env` or exposed to the browser. RLS is enabled
with no public policies, so direct browser access is denied by default.

## Local infrastructure

- `docker-compose.yml` starts the local Postgres and Redis dependencies.
- `infra/jitsi/docker-compose.yml` is retained as an optional self-hosted deployment reference and is not required by the current staging/production topology.
- `supabase/migrations/20261026165415_init_daraja_schema.sql` defines the initial schema for users, meetings, attendance, and telemetry.
- `supabase/migrations/20261026165422_enable_deny_by_default_rls.sql` enables deny-by-default RLS for the application tables.
- The API reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `apps/api/.env` and exposes `/api/v1/dashboard/summary` for the host dashboard.

## Local staging checkpoint

This is the safe first staging target before public DNS, VPS, TLS, or managed Redis:

1. Start local dependencies:
   `docker compose up -d postgres redis`
2. Apply the migrations to the staging Supabase project using the Supabase CLI, or apply both SQL files from the Supabase dashboard SQL editor.
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `apps/api/.env`.
4. Start the services:
   `npm run dev`
5. Verify `http://localhost:4000/api/health`, launch a room at `http://localhost:5173`, and confirm attendance and dashboard requests.

Do not use the local development JWT fallback in production. The current
deployment uses `meet.jit.si`; configure `JITSI_DOMAIN=meet.jit.si` consistently
in Render and Vercel until a dedicated Jitsi provider is selected.

## Vercel and Render deployment

The repository includes `vercel.json` and `render.yaml` for the current
architecture:

- Vercel builds `apps/web` and serves `apps/web/dist` with an SPA fallback.
- Render builds and runs `apps/api`, exposes `/api/health` as its health check,
  and generates `JWT_SECRET`.
- Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `REDIS_URL` as Render
  secrets. Never add the service-role key to Vercel.
- Set Vercel `VITE_API_BASE_URL` to
  `https://api.darajanetizens.cc.cd` and `VITE_JITSI_DOMAIN` to `meet.jit.si`.
- Set Vercel `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the
  Supabase Auth login flow. The anonymous key is safe for the browser; never
  expose `SUPABASE_SERVICE_ROLE_KEY` to Vercel.
- Set Render `CORS_ORIGIN` to `https://darajanetizens.cc.cd`.

The `7-of-8` training and `4-of-6` stipend quotas require a participant
eligibility data model and are not represented in the current initial schema;
they should be added as a separate migration before enabling payout decisions.

## Module 1 frontend and API

The role workspace now supports:

- Supabase Auth login with facilitator/admin versus student navigation.
- Facilitator progress cards for physical sessions, online sessions, attendance,
  training progress, and stipend progress.
- Short-lived one-time QR challenge generation and server-side redemption.
- Admin scanner mode with a secure manual token fallback; camera decoding can be
  added without changing the redemption API.
- Jitsi training-room launch with presence telemetry and attendance updates.
- Student learning content and configurable wellness support contacts.

Apply `supabase/migrations/20261028150000_modules_attendance_content.sql` before
using the new database-backed module endpoints. Configure
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel for the login flow.

## Current MVP scope

- Meeting room creation and token generation
- Frontend room launcher with embedded Jitsi iframe
- Attendance telemetry event endpoint and summary model
- Security basics for short-lived JWTs and room validation
- Host dashboard with meeting status, attendance totals, and presence minutes

## Production follow-up

- Add PostgreSQL schemas for users, meetings, attendance, and telemetry
- Connect Redis Streams for buffered high-frequency telemetry events
- Add a managed Redis connection for burst telemetry buffering
- Add Prometheus metrics and session quality telemetry
- Package the PWA for Android via Bubblewrap/TWA
