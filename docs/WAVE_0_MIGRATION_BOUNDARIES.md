# Wave 0 Disposable Migration Rehearsal Boundaries

Task ID: Q360-PS-M6-S3

## Purpose

Wave 0 establishes the minimum migration safety foundation for Q360 before any production-bound schema change is approved. It is a rehearsal, not a deployment. It proves that schema migrations can be prepared, fingerprinted, executed, verified, and rolled back in a controlled, non-interactive, disposable environment.

## In Scope

- Defining the Wave 0 migration boundary and safety gates.
- Replacing interactive `drizzle-kit push` with a guarded, non-interactive migration handler.
- Adopting the existing Restaurant partial unique indexes as canonical database invariants.
- Capturing a deterministic schema fingerprint before and after the rehearsal.
- Producing a migration manifest template with required audit fields.
- Defining a `/readyz` readiness contract that goes beyond the existing `/health` liveness check.
- Executing the rehearsal against a disposable database only.
- Proving a safe failure or rollback path.
- Documenting the Supabase Vault restore limitation separately.

## Out of Scope

- Production database access or mutation.
- Staging database writes (the staging environment may be read from only for backup artifact verification).
- Railway, Vercel, or any other deployment.
- Interactive `db:push`.
- Destructive SQL, truncation, or broad data reset.
- New features unrelated to migration safety.
- Branch cleanup or repository restructuring.
- Credential disclosure.

## Protected Areas

The following areas must not be modified by Wave 0:

- OTP authentication flow and logic.
- Tenant identity model and isolation guarantees.
- Restaurant lifecycle semantics (states, transitions, ordering rules).
- Payments processing and records.
- Kitchen Display System (KDS) behavior.
- Deployment safety configuration (CORS, guards, environment handling).

## Environment Identity Gates

Before any Wave 0 command runs, the following checks must pass:

1. Current branch is `clean/q360-core-m1-r5` and worktree is `D:/VS CODE App/Q360/.worktrees/q360-core-m1-r5`.
2. No production credentials are configured in `.env`, `backend/.env`, or process environment.
3. The staging backup artifact path is confirmed; if no artifact is present, the rehearsal is limited to a disposable local database and the gap is recorded.
4. If environment identity is unclear, stop immediately.

## Allowed Targets

| Target | Allowed Use |
|--------|-------------|
| Disposable local PostgreSQL database | Full rehearsal: restore, migrate, fingerprint, verify, rollback, destroy. |
| Staging backup artifact | Read-only verification of path/checksum; no live staging connection required. |
| Production database | None. |
| Staging database runtime | None (no writes). |

## Decision Gates

1. **Pre-rehearsal**: Confirm environment identity, backup artifact, and disposable target.
2. **Pre-migration**: Capture before fingerprint and backup checksum.
3. **Migration**: Run guarded non-interactive migration only after fingerprint is captured.
4. **Post-migration**: Capture after fingerprint, run verification, record results.
5. **Rollback**: Prove rollback path and capture rollback evidence.
6. **Approval**: Migration manifest is reviewed and marked approved or rejected.

## Rollback Rule

If any step fails, the disposable database is the only thing that may be rolled back or destroyed. No rollback command may target production, staging, or any unknown database.
