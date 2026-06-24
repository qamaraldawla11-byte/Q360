# One OS Production Deployment Guide

## Backend: Railway + Supabase Postgres

Set these variables on the Railway backend service:

```env
NODE_ENV=production
JWT_SECRET=<generate-64-char-random-string>
CORS_ORIGINS=https://your-vercel-app.vercel.app

DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
POSTGRES_SSL=true
POSTGRES_POOL_SIZE=10

SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>

RESEND_API_KEY=<resend-api-key>
EMAIL_FROM=Q360 <no-reply@send.q360.app>
```

Railway supplies `PORT`; do not hard-code it in production unless Railway requires an override.

Recommended Railway settings:

```yaml
Root Directory: repository root
Build Command: cd backend && npm ci --include=dev && npm run build && npm prune --omit=dev
Start Command: cd backend && npm start
Health Check Path: /health
```

## Supabase Schema

Run these from `backend/` after `DATABASE_URL` points to Supabase:

```bash
npm run db:push
npm run db:seed
npm run verify:restaurant
```

`db:push` creates/updates tables from `src/db/schema.ts`. `db:seed` inserts the admin/demo inventory and restaurant data idempotently.

## Frontend: Vercel

Set these variables on the Vercel frontend project:

```env
VITE_API_BASE_URL=https://your-railway-domain.up.railway.app/api
VITE_SIMULATION_MODE=false
```

Build settings:

```yaml
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

## Backups

One OS no longer stores production data in a SQLite file. Use Supabase Postgres backups, point-in-time recovery, or `pg_dump` against `DATABASE_URL`.

## Launch Checks

- `npm run build` passes from the repository root.
- `npm run lint` passes from the repository root.
- `npm run build` passes from `backend/`.
- `npm run db:push` succeeds against Supabase.
- `npm run db:seed` succeeds against Supabase.
- `npm run verify:restaurant` succeeds against Supabase.
- `GET /health` returns `status: "running"` from Railway.
- Vercel app can login and call Railway without CORS errors.
