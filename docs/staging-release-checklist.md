# Staging release checklist

## Supabase

1. Link the Supabase CLI to project `cpdoneetiacfjfwjdiqv`.
2. Confirm the local migration directory contains the remote versions:
   `20261009201701`, `20261009201833`, `20261026165415`, `20261026165422`.
3. Apply `supabase/migrations/20261028150000_modules_attendance_content.sql`.
4. Verify RLS is enabled on `training_sessions`, `qr_challenges`,
   `content_items`, and `support_contacts`.
5. Create test Auth users and matching `public.users` profiles with roles
   `admin`, `facilitator`, and `student`.

The API uses `SUPABASE_SERVICE_ROLE_KEY` server-side. The web app only receives
`VITE_SUPABASE_ANON_KEY`; never copy the service-role key into Vercel.

## Render API

Required secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `CORS_ORIGIN=https://darajanetizens.cc.cd`
- `PUBLIC_BASE_URL=https://darajanetizens.cc.cd`
- `JITSI_DOMAIN=meet.jit.si`
- `REDIS_URL` when Redis is connected

Verify:

```bash
curl https://api.darajanetizens.cc.cd/api/health
```

## Vercel web app

Required public variables:

- `VITE_API_BASE_URL=https://api.darajanetizens.cc.cd`
- `VITE_JITSI_DOMAIN=meet.jit.si`
- `VITE_SUPABASE_URL=https://cpdoneetiacfjfwjdiqv.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<public-anon-key>`

Verify login, role routing, QR check-in, scanner permission fallback, Jitsi
launch, learning content, and wellness contacts on both a desktop and a mobile
viewport.

## Release gate

Run from the repository root:

```bash
npm ci
npm run build
npm run lint
npm test
```

Do not promote the deployment until the migration verification and authenticated
smoke tests pass.
