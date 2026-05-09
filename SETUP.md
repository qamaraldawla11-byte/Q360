# One OS Setup

This guide describes local development setup for the current One OS repository.

## Required Tools

- Node.js 20 or newer recommended.
- npm.
- A terminal capable of running frontend and backend processes.

The backend `package.json` uses npm scripts with `tsx`. The older `backend/README.md` mentions Bun, but the current package scripts and lockfile indicate npm is the safer default for this repository.

## Environment Files

Use `.env.example` as the reference.

Frontend variables are read by Vite from the repository root:

```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_SIMULATION_MODE=false
```

Backend variables are read by `dotenv/config` when the backend process starts:

```env
NODE_ENV=development
PORT=3001
JWT_SECRET=replace-with-a-long-random-development-secret
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
BACKUP_DIR=./backups
BACKUP_RETENTION_DAYS=14
```

Important: the backend exits immediately if `JWT_SECRET` is missing.

## Install Dependencies

Frontend:

```bash
npm install
```

Backend:

```bash
cd backend
npm install
```

## Seed the Local Database

From `backend/`:

```bash
npm run db:seed
```

This creates local SQLite tables and seeds demo data for users, inventory, products, and suppliers.

Local database files are stored under:

```text
backend/data/
```

## Run Locally

Start the backend from `backend/`:

```bash
npm run dev
```

Start the frontend from the repository root:

```bash
npm run dev
```

Expected local URLs:

- Frontend: `http://localhost:5173`
- Backend health check: `http://localhost:3001`
- Backend API: `http://localhost:3001/api`

## Build

Frontend production build:

```bash
npm run build
```

Backend start command:

```bash
cd backend
npm run start
```

## Backup

From `backend/`:

```bash
npm run db:backup
npm run db:backup:list
```

Backups default to `backend/backups/` and retention defaults to 14 days.

## Local Login

The seed script creates an admin-style user:

```text
admin@one-os.io
```

The current login flow accepts an email address and creates a user if one does not already exist. This is suitable for internal development only and should be hardened before production.

## Troubleshooting

Backend exits on startup:
- Check that `JWT_SECRET` is set.
- Confirm the backend process is started from the intended working directory.

Frontend cannot reach API:
- Check `VITE_API_BASE_URL`.
- Confirm backend is running on `PORT`.
- Check `CORS_ORIGINS` if using a non-localhost frontend domain.

Admin features return migration errors:
- Some admin endpoints include guards for missing columns/tables.
- Align the database with `backend/src/db/schema.ts` and current migration scripts.

Database changes do not persist in cloud:
- Ensure the backend has persistent storage mounted for `backend/data/` if using SQLite.

## Deployment Notes

See `DEPLOYMENT.md` for the existing Vercel/Railway-oriented deployment guide. Before production launch, review:

- Persistent database storage.
- Database migrations.
- Secret management.
- CORS origins.
- Backup and restore procedure.
- Tenant isolation tests.
- Monitoring and logs.
