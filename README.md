# Daraja Netizens

Daraja Netizens is a Jitsi-first enterprise video conferencing platform designed for secure meetings, attendance monitoring, and telemetry collection. The project is structured as a small monorepo so the web app and API can evolve independently while sharing the same product architecture.

## Architecture overview

- Web app: React + Vite SPA for meeting entry, room launch, attendee check-in, and embedded Jitsi conference UI.
- API: Express + TypeScript service that issues short-lived JWTs for room access and ingests attendance telemetry.
- Persistence: PostgreSQL and Redis are represented in the project design and are ready to be wired to the service boundary.
- Deployment: self-hosted Jitsi, TURN/STUN, and observability tooling are called out for the production environment.

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

## Local infrastructure

- `docker-compose.yml` starts the local Postgres and Redis dependencies.
- `infra/jitsi/docker-compose.yml` seeds the self-hosted Jitsi deployment stack for Prosody, Jicofo, JVB, and TURN.
- `supabase/migrations/20261009_init.sql` defines the initial schema for users, meetings, attendance, and telemetry.
- The API reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` from `apps/api/.env` and exposes `/api/v1/dashboard/summary` for the host dashboard.

## Current MVP scope

- Meeting room creation and token generation
- Frontend room launcher with embedded Jitsi iframe
- Attendance telemetry event endpoint and summary model
- Security basics for short-lived JWTs and room validation
- Host dashboard with meeting status, attendance totals, and presence minutes

## Production follow-up

- Add PostgreSQL schemas for users, meetings, attendance, and telemetry
- Connect Redis Streams for buffered high-frequency telemetry events
- Deploy Jitsi Prosody + Jicofo + JVB + TURN behind TLS
- Add Prometheus metrics and session quality telemetry
- Package the PWA for Android via Bubblewrap/TWA
