# OTP Railway Node Runtime Fix

## Root cause

Railway was running the backend on the Nixpacks default Node runtime, and the live logs show that runtime produced `ReferenceError: crypto is not defined` while `POST /api/auth/verify` was generating the JWT session token.

The backend uses Hono `4.12.25` for JWT signing. Hono's JWT implementation calls the global Web Crypto API through `crypto.subtle.importKey` during `sign()`. On the affected Railway Node 18 runtime, that global `crypto` binding was not available, so valid OTP verification reached `generateToken()` and failed before the JWT response could be returned.

## Railway runtime decision

Railway should use Node 20 or newer for this service. The repository now includes explicit Nixpacks setup configuration so Railway installs `nodejs_20` instead of relying on its default runtime selection.

No backend crypto polyfill was added because local Node 20+ verification showed Web Crypto is already available, and the current failure is caused by the deployed runtime missing the global Web Crypto binding expected by Hono.

## Files changed

- `nixpacks.toml`
- `backend/package.json`
- `backend/src/scripts/verify_jwt_init.ts`
- `docs/OTP_RAILWAY_NODE_RUNTIME_FIX.md`

## Why Node 20+ is required

Hono JWT signing depends on Web Crypto: its signing path imports a key with `crypto.subtle.importKey` and then signs with `crypto.subtle.sign`.

Node 20+ provides the global Web Crypto API used by Hono in this backend. The local check on Node `v24.15.0` confirms `globalThis.crypto` and `globalThis.crypto.subtle` are present without app-side initialization.

## Local verification

Run these from the repository root:

```bash
cd backend && node --version
cd backend && npm run build
cd backend && npm run verify:jwt-init
cd backend && npm start
```

`npm run verify:jwt-init` exercises the backend `generateToken()` path directly with a local test payload and verifies the token with Hono. It does not request or deliver an OTP, does not require SMTP, and does not use a real OTP value.

## Railway deployment verification steps

1. Redeploy the Railway service from the updated repository.
2. Confirm the build logs show Nixpacks installing Node 20.
3. Confirm the backend starts and `/health` returns successfully.
4. Request a fresh OTP in the deployed app.
5. Submit the fresh OTP and confirm `POST /api/auth/verify` returns `200` with a JWT session token.
6. Confirm Railway logs no longer show `ReferenceError: crypto is not defined` from Hono JWT signing.

## Rollback plan

Revert `nixpacks.toml`, `backend/package.json`, `backend/src/scripts/verify_jwt_init.ts`, and this document, then redeploy the previous known-good Railway revision. If rollback is needed, verify `/health` and OTP login behavior after the rollback deployment completes.
