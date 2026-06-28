# Railway Backend Start Fix

## Root cause

Railway started the backend with `npm start`, which runs `node dist/index.js`, but the deployed image did not contain `backend/dist/index.js`. The backend TypeScript build step had not been enforced in Railway configuration before startup.

## Current Railway behavior

The logs show Railway is starting the backend package from `/app/backend`:

```text
> one-os-backend@0.0.1 start
> node dist/index.js
```

Startup then fails because `/app/backend/dist/index.js` is missing.

## Chosen deployment strategy

Use the repository's intended compiled production runtime:

1. Build TypeScript inside `backend/` with `npm run build`.
2. Start the compiled Hono backend with `npm start`, which runs `node dist/index.js`.

This matches `backend/package.json` and `backend/tsconfig.json` without adding dependencies or changing runtime application code.

## Files changed

- `railway.json`
- `docs/RAILWAY_BACKEND_START_FIX.md`

## Local verification

- `cd backend && npm run build`: passed when run through `cmd.exe /c` because this PowerShell version does not support `&&`.
- Expected entrypoint exists after build: `backend/dist/index.js`.
- `cd backend && npm start`: passed when run through `cmd.exe /c`; the server began listening on `http://localhost:3001`.
- Local health check returned `status: "running"` from `http://127.0.0.1:3001/health`.
- The local verification server was stopped after the check.

## Railway configuration required

Railway should use the repository root as the service root so it reads `railway.json`.

The configured build command is:

```text
cd backend && npm ci --include=dev && npm run build
```

The configured start command is:

```text
cd backend && npm start
```

The health check path is:

```text
/health
```

If Railway is manually configured with `backend/` as the service root instead, use equivalent backend-relative commands:

```text
npm ci --include=dev && npm run build
npm start
```

## Rollback plan

Remove `railway.json` or revert to the previous Railway service settings, then redeploy the previous known-good commit. If rollback is needed, verify `/health` after Railway completes the deployment.
