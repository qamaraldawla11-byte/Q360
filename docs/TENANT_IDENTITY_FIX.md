# Tenant Identity Fix

## Root cause

`primaryWorkspace` is a frontend navigation value, but JWT issuance used it as `businessId`. After onboarding, `primaryWorkspace` becomes a route such as `/app/restaurant`, so a later login could issue a JWT whose tenant identity was a route path instead of a backend business ID.

## Data model decision

`users.business_id` is the stable backend tenant pointer. `users.primary_workspace` remains the frontend workspace route. Existing stable business IDs are reused when present; new users receive a stable business record before onboarding, and onboarding updates that business record instead of changing the tenant identity.

## Files changed

- `backend/src/db/schema.ts`
- `backend/src/db/seed.ts`
- `backend/src/middleware/auth.ts`
- `backend/src/routes/auth.ts`
- `backend/src/routes/user.ts`
- `backend/src/utils/tenant.ts`
- `backend/src/scripts/verify_tenant_identity.ts`
- `backend/package.json`
- `docs/TENANT_IDENTITY_FIX.md`

## API and JWT behavior

Profile responses continue to expose `primaryWorkspace` as a route value such as `/app/restaurant`. JWT `businessId` is issued from `users.business_id` or a legacy stable business ID, never from `/app/...`. The auth middleware rejects signed tokens that contain a workspace route in `businessId`.

## Verification added

`cd backend && npm run verify:tenant-identity` verifies against a configured Postgres database that a Restaurant user can onboard, keep `/app/restaurant` as the workspace route, create or load Restaurant data under a stable business ID, log out, log back in, receive the same stable JWT `businessId`, and still load the same menu item, table, and order.

## Commands run and results

- `npm run build` from the repository root: passed.
- `npm run lint` from the repository root: passed.
- `cd backend && npm run build`: passed when run through `cmd.exe /c` because this PowerShell version does not support `&&`.
- `cd backend && npm run verify:tenant-identity`: passed with approved database/network access.
- `cd backend && npm run verify:otp`: passed with approved database/network access.
- `cd backend && npm run verify:restaurant`: passed with approved database/network access.

## Known limitations

Legacy users with no stored `business_id` are repaired to the existing `biz_main` tenant on login. `primary_workspace` is not used as a tenant fallback. This fix does not add multi-business switching, new roles, payments, Pharmacy persistence, audit-log expansion, monitoring, or deployment changes.
