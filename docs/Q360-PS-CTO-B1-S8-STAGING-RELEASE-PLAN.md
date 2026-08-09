# Q360-PS-CTO-B1-S8 — RC1 Staging Release Plan

**Purpose:** Prepare the staging release plan for CTO approval.  
**Status:** READ-ONLY documentation. No merge, push, deploy, migration, infrastructure change, or code modification performed.  
**Worktree:** `D:/VS CODE App/Q360/.worktrees/q360-rc1-clean`  
**Branch:** `rc/q360-rc1-clean`  
**Prepared:** 2026-08-08  
**Reference:** `docs/Q360-PS-CTO-B1-S7-RC1-PR-PACKAGE.md`

---

## 1. Release Objective

RC1 is the controlled staging release for the Q360 platform foundation.

**Goal:** Deploy a stable, verified backend and frontend that provide:

- Health (`/health`) and readiness (`/readyz`) probes.
- A deterministic, additive migration baseline (`0000`–`0004`).
- Shared business foundations: Customers, Quotes, Products, Inventory.
- Authentication, tenant isolation, authorization, and audit logging.

**What RC1 is not:** A feature-expansion release. Commercial Core, Q Executive/Founder Panel expansion, and Q Brain new features are explicitly excluded.

**Success criteria for staging:**

- All builds pass in CI.
- Migrations apply cleanly to a staging database.
- `/health` and `/readyz` return success.
- Shared-module verification scripts pass.
- Restaurant smoke tests do not introduce new failures.
- No 5xx errors attributed to RC1 changes during the monitoring window.

---

## 2. Ownership

| Role | Owner | Status |
|------|-------|--------|
| PR merge | Platform/Release Engineer | **CTO decision required** |
| Deployment execution | DevOps / Release Engineer | **CTO decision required** |
| Database migration execution | Database Engineer / SRE | **CTO decision required** |
| Rollback decision | CTO or designated incident commander | **CTO decision required** |
| Verification lead | QA / Platform Engineer | **CTO decision required** |
| Monitoring / observability | SRE | **CTO decision required** |

---

## 3. Deployment Targets

### 3.1 Frontend

| Property | Value |
|----------|-------|
| Platform | Vercel |
| Project ID / name | **Unknown — CTO decision required** |
| Branch to deploy | `rc/q360-rc1-clean` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variables | To be supplied by deployment owner |

### 3.2 Backend

| Property | Value |
|----------|-------|
| Platform | Railway |
| Service name | **Unknown — CTO decision required** |
| Branch to deploy | `rc/q360-rc1-clean` |
| Build command | `cd backend && npm ci --include=dev && npm run build` |
| Start command | `cd backend && npm start` |
| Healthcheck path | `/health` |
| Readiness path | `/readyz` (monitor separately) |
| Environment variables | `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`, `POSTGRES_SSL`, etc. |

### 3.3 Database

| Property | Value |
|----------|-------|
| Engine | PostgreSQL |
| Host | **Unknown — CTO decision required** |
| Database name | **Unknown — CTO decision required** |
| SSL mode | As required by provider |

---

## 4. Database Procedure

### 4.1 Before migration

1. **Backup required.** Take a full database snapshot before any migration. Confirm the snapshot is restorable.
2. **Migration review.** A second engineer must review:
   - `backend/drizzle/0000_wave0_initial.sql`
   - `backend/drizzle/0001_restaurant_partial_index_adoption.sql`
   - `backend/drizzle/0002_sudden_lionheart.sql`
   - `backend/drizzle/0003_small_stone_men.sql`
   - `backend/drizzle/0004_inventory_core_m2.sql`
3. **Duplicate barcode check.** Because `0003` drops the global `products_barcode_unique` constraint, verify no duplicate barcodes exist across the same business before applying `0003`.
4. **Downtime window.** Schedule a short maintenance window if the target database is large.

### 4.2 Migration execution

Run only the committed, non-interactive migration command:

```bash
cd backend
Q360_STAGING_DATABASE_GUARD=true \
Q360_DATABASE_HOST_ALLOWLIST=<staging-host> \
DATABASE_URL=<staging-database-url> \
npm run migrate:wave0
```

**Rules:**

- Use `migrate:wave0` only.
- Do **not** use `drizzle-kit push` or `db:push` in staging.
- Do **not** run `drizzle-kit generate` against the staging database.
- The backend application must not mutate schema at runtime.

### 4.3 After migration

1. Verify `drizzle.__drizzle_migrations` contains entries `0000`–`0004`.
2. Verify `q360_baseline_provenance` is populated.
3. Start the backend service.
4. Poll `/health` until it returns `200 OK`.
5. Poll `/readyz` until it returns `200 OK` with `ok: true`.

---

## 5. Verification Sequence

Execute the following checks after deployment. Record results.

| Step | Check | Command / Endpoint | Expected Result |
|------|-------|--------------------|-----------------|
| 1 | Health | `GET /health` | `200 OK`, `status: "ok"` |
| 2 | Readiness | `GET /readyz` | `200 OK`, `ok: true` |
| 3 | Login / OTP | `POST /api/auth/otp/send` + `POST /api/auth/otp/verify` | Receive valid JWT |
| 4 | Tenant isolation | `GET /api/customers` with JWT from Step 3 | Returns only records for the user's business |
| 5 | Shared Customers | Run `npm run verify:customers` against staging | Pass |
| 6 | Shared Quotes | Run `npm run verify:quotes` against staging | Pass |
| 7 | Shared Products | Run `npm run verify:products` against staging | Pass |
| 8 | Shared Inventory | Run `npm run verify:inventory-procurement` and `verify:stock-movement-service` against staging | Pass |
| 9 | Restaurant smoke test | Manual or `verify:restaurant-setup` | No new failures compared to baseline |
| 10 | POS / KDS checks | Manual smoke test | Orders flow without 5xx |
| 11 | Payment checks | Manual smoke test | Existing payment behavior unchanged |
| 12 | Frontend build | Vercel deployment succeeds | Build passes, routes load |
| 13 | Frontend navigation | Manual check of `/app/customers`, `/app/quotes`, `/app/products`, `/app/inventory` | No broken imports or 5xx from backend |

---

## 6. Monitoring Window

### 6.1 Observation period

| Environment | Duration |
|-------------|----------|
| Staging | Minimum 24 hours after successful `/readyz` |

### 6.2 Logs and metrics to monitor

| Signal | What to watch |
|--------|---------------|
| Backend logs | 5xx errors, readiness failures, auth errors, database connection errors |
| Railway metrics | CPU, memory, deploy healthcheck failures |
| Vercel logs | Build errors, client-side errors, failed API calls |
| Database logs | Long-running queries, lock waits, migration errors |
| Audit logs | Unexpected `UPDATE_STOCK`, `CREATE_CUSTOMER`, etc., across tenants |

### 6.3 Rollback triggers

Rollback immediately if any of the following occur:

- `/readyz` fails for more than 5 minutes after deployment.
- Any RC1 migration fails to apply or leaves the database in an inconsistent state.
- Shared-module verification scripts fail in staging.
- New 5xx errors appear that correlate with RC1 routes (`/api/customers`, `/api/quotes`, `/api/products`, `/api/inventory`).
- Cross-tenant data leakage is detected.
- Restaurant POS/KDS/payments behavior degrades compared to the pre-RC1 baseline.

---

## 7. Rollback Plan

### 7.1 Application rollback

1. Stop traffic to the RC1 deployment.
2. Redeploy the previous stable deployment (based on `origin/main`, commit `a76870e`).
3. Confirm `/health` and `/readyz` return success on the rolled-back version.

### 7.2 Database rollback

- RC1 migrations are additive; no tables or columns are dropped.
- Migration `0003` drops the global `products_barcode_unique` constraint. This operation cannot be automatically reversed.
- Options:
  1. **Restore from pre-migration backup** (preferred).
  2. **Manual repair** (only if no backup exists and all products still have unique barcodes):
     - Re-add `NOT NULL` to `products.barcode` if all rows have values.
     - Re-add the global `products_barcode_unique` constraint.

### 7.3 Database safety

- Do not run `db:push` or any schema mutation command outside `migrate:wave0`.
- Keep the pre-migration backup until staging is promoted or rollback is complete.
- Document any manual repair steps taken.

---

## 8. CTO Approval Checklist

- [ ] **Approve PR merge** — `rc/q360-rc1-clean` into `origin/main`.
- [ ] **Approve staging deployment target** — Confirm Vercel project, Railway service, and database.
- [ ] **Approve ownership assignments** — Name merge owner, deployment owner, migration owner, rollback owner.
- [ ] **Approve migration execution** — Authorize `migrate:wave0` against the staging database after backup.
- [ ] **Approve verification sequence** — Confirm Step 5 checks must all pass.
- [ ] **Approve monitoring window** — Confirm 24-hour staging observation.
- [ ] **Approve rollback triggers** — Confirm conditions that require immediate rollback.
- [ ] **Approve production path later** — Staging promotion to production is a separate approval.

---

**No deployment, merge, migration, or infrastructure change has been performed.**

**End of plan.**
