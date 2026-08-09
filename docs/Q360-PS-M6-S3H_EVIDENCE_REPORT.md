# Q360-PS-M6-S3H — Wave 0 Live-Staging Migration Execution Report

**Task ID:** Q360-PS-M6-S3H  
**Operator:** Kimi Code CLI (automated controlled execution)  
**Report generated:** 2026-08-01T14:57:00Z  
**Repository branch:** `clean/q360-core-m1-r5`  
**Repository commit:** `f90ae61862c853df9952b66fdb8d52f696ba30aa`  
**Staging project reference:** `hctlrpegcaeyowukiwvw`  
**Approvals:** CTO authorization — APPROVED WITH CONDITIONS  

---

## 1. Founder Brief

Executed the approved S3F Wave 0 baseline-and-forward migration sequence against the verified Supabase staging environment. The migration was additive only, used only committed deterministic migrations, preserved all application-row counts and relationships, and converged the live staging catalog to the approved 0000 + 0001 semantic target. The Drizzle migration journal now contains the expected 0000 and 0001 hashes, baseline provenance is recorded, and the canonical Restaurant partial-unique indexes are present and correct.

The HTTP `/health` endpoint returned 200. The `/readyz` endpoint returned 503 because the hard-coded 5-second readiness timeout is shorter than the ~10 seconds required to run all 27 sequential checks over the live Supabase staging connection. When the same readiness logic is invoked directly with adequate time, all 27 checks pass. This is a readiness-latency deviation, not a migration-safety failure.

**Final verdict: PARTIAL** — migration and data preservation PASS; `/readyz` HTTP contract not met under the current timeout.

---

## 2. Verified Staging Identity

| Check | Result |
|-------|--------|
| `Q360_DATABASE_ENV` | `staging` |
| `Q360_DATABASE_NAME` | `q360-staging` |
| DATABASE_URL contains project ref `hctlrpegcaeyowukiwvw` | PASS |
| Current database | `postgres` |
| PostgreSQL server version | 17.6 |
| Active other client backends | 0 |

No concurrent database writer or deployment was detected.

---

## 3. Repository and Migration Checksums

| Item | SHA-256 | Status |
|------|---------|--------|
| `backend/drizzle/0000_wave0_initial.sql` | `d8cac93e7bd29363c1e0f859019d7212f24dd11d697ca811c904096c72196c1d` | MATCH (approved) |
| `backend/drizzle/0001_restaurant_partial_index_adoption.sql` | `83814fc5f22a667aec49e45a1aef33144afef2b37ede5f15a92bfa50bae982e8` | MATCH (approved) |
| `backend/drizzle-baseline/0001_staging_reconcile.sql` | `58baa0b40fe663c52653ed866d841a4cc8590eb7171a8c739bafb8f3300bcaba` | MATCH (approved manifest) |
| `backend/drizzle/meta/_journal.json` | `0c7d02479d9e306d61cdfed8af09be444360960ea5d7cec15ed75c511b67ed0f` | Captured |
| `backend/drizzle/meta/0000_snapshot.json` | `33a254d9fb24fb7e93fbb79d5321e3174dd2340534b429320e5888ca78235944` | Captured |
| `backend/drizzle/meta/0001_snapshot.json` | `5f4d1efd94acac10ce609a4156f4659343fb753527048a58ade9204c703ba050` | Captured |

Git status after execution: only `backend/.tmp/` (disposable evidence scripts) is untracked. No unauthorized source changes.

---

## 4. Backup Evidence

| Item | Value |
|------|-------|
| Approved encrypted backup | `C:\Q360-Secure\Backups\Staging\q360-staging-hctlrpegcaeyowukiwvw-20260731-153953.dump.age` |
| Verified SHA-256 | `62357315dc3598be43ec83db780744180312def16625cd48821a8a2f501ad8da` |
| Plaintext backup left behind | None |
| Fresh pre-migration backup created | No — staging row counts matched the approved backup exactly and the journal was empty, indicating no post-backup changes. |

---

## 5. Before/After Fingerprints

| Phase | Fingerprint file | SHA-256 |
|-------|------------------|---------|
| Before | `backend/migration-manifests/2026-08-01T14-49-54-525Z-f90ae618-f54d9d17-before.json` | `sha256:acc93d0320b645b1033b0fde204177395ba10b48cd30478bb415488fe68f1d92` |
| After | `backend/migration-manifests/2026-08-01T14-49-54-525Z-f90ae618-f54d9d17-after.json` | `sha256:b0945fc9e83d1f52a3fa0e560d89a4d69d0f84931552431ca02b409b73f0cf1e` |

**Structural diff (schema_fingerprint):**
- Added tables: 19
- Removed tables: 0
- Added columns on existing tables: 21
- Added indexes on existing tables: 1 (`businesses_public_code_unique`)

No tables or columns were removed. The raw after-fingerprint hash differs from the S3F disposable Track A/B hashes only because the literal `CREATE INDEX` definition includes `IF NOT EXISTS` for indexes created by migration 0001; the normalized catalog comparison proves semantic equality.

---

## 6. Migration Journal Result

`drizzle.__drizzle_migrations` after execution:

| idx | hash (truncated) | tag | created_at |
|-----|------------------|-----|------------|
| 0 | `d8cac93e...` | `0000_wave0_initial` | `1785544124981` |
| 1 | `83814fc5...` | `0001_restaurant_partial_index_adoption` | `1785572873655` |

Both hashes and `created_at` values match the approved S3F journal exactly.

---

## 7. Data Preservation Evidence

Before and after row counts are identical:

| Table | Before | After |
|-------|--------|-------|
| audit_logs | 1329 | 1329 |
| businesses | 11 | 11 |
| inventory_items | 5 | 5 |
| kds_tickets | 45 | 45 |
| menu_categories | 19 | 19 |
| menu_items | 35 | 35 |
| orders | 0 | 0 |
| otp_codes | 18 | 18 |
| products | 5 | 5 |
| restaurant_menus | 10 | 10 |
| restaurant_order_items | 48 | 48 |
| restaurant_orders | 67 | 67 |
| restaurant_payments | 12 | 12 |
| restaurant_tables | 36 | 36 |
| suppliers | 3 | 3 |
| system_settings | 0 | 0 |
| users | 14 | 14 |
| quote_items | did not exist | 0 |

All critical relationship checks returned zero orphans both before and after:
- `orphan_restaurant_order_items`: 0
- `orphan_kds_tickets`: 0
- `orphan_restaurant_payments`: 0
- `orphan_menu_items_category`: 0
- `restaurant_orders_without_business`: 0

---

## 8. Restaurant Invariant Verification

| Index | Status | Definition |
|-------|--------|------------|
| `restaurant_orders_business_idempotency_key_idx` | Present, unique, btree, predicate exact | `CREATE UNIQUE INDEX restaurant_orders_business_idempotency_key_idx ON public.restaurant_orders USING btree (business_id, idempotency_key) WHERE (idempotency_key IS NOT NULL)` |
| `restaurant_orders_business_daily_visible_number_idx` | Present, unique, btree, predicate exact | `CREATE UNIQUE INDEX restaurant_orders_business_daily_visible_number_idx ON public.restaurant_orders USING btree (business_id, order_number_date, visible_order_number) WHERE ((visible_order_number IS NOT NULL) AND (order_number_date IS NOT NULL))` |

Semantic catalog comparison against `0000_snapshot.json` + `0001_snapshot.json`: **ok: true, diffs: 0**. Baseline provenance table `public.q360_baseline_provenance` contains a row.

---

## 9. /health and /readyz Results

| Endpoint | HTTP status | Body/status | Notes |
|----------|-------------|-------------|-------|
| `GET /health` | 200 | `{"status":"running",...}` | PASS |
| `GET /readyz` | 503 | `{"status":"not_ready","error":"readiness check timed out"}` | FAIL under current 5 s timeout |

Direct invocation of `performReadinessChecks` against the same staging database:
- Elapsed: ~10 s
- Result: `ok: true`
- All 27 checks passed, including database, journal hashes, critical tables/columns, both Restaurant indexes, and baseline provenance.

**Deviation:** the hard-coded 5-second timeout in `backend/src/index.ts` is insufficient for the live Supabase staging round-trip latency. The migration readiness itself is confirmed; the HTTP contract is not.

---

## 10. Warnings / Deviations

1. **`/readyz` timeout (medium).** The endpoint returns 503 on staging because 27 sequential catalog/journal queries take ~10 s. The underlying checks pass when given adequate time. A follow-up change is needed to make the timeout configurable or the checks parallel/cached.
2. **Raw fingerprint hash divergence (low, expected).** The after-fingerprint SHA-256 differs from the S3F disposable Track A/B hashes because `schema_fingerprint.ts` records the literal index definition string. The normalized catalog comparison shows semantic equality.
3. **No fresh pre-migration backup created.** Staging row counts matched the approved backup exactly and the migration journal was empty, so no post-backup changes were evident.

---

## 11. Final Verdict

**PARTIAL**

- Migration execution: **PASS**
- Schema convergence to 0000 + 0001 target: **PASS**
- Data preservation: **PASS**
- Restaurant invariant verification: **PASS**
- `/health`: **PASS**
- `/readyz` HTTP 200: **FAIL** (readiness logic passes, but 5 s timeout causes 503)

---

## 12. Compliance Confirmation

- **Production untouched** — no production database, Railway, or Vercel access.
- **Railway/Vercel untouched** — no deploys, env changes, or platform mutations.
- **Wave 1 not started** — only the approved Wave 0 baseline-and-forward sequence was executed.
- **No cleanup beyond approved disposable artifacts** — temporary evidence scripts remain in `backend/.tmp/`; no plaintext backup or secret file was created or left in the worktree.
- **Forbidden operations not performed** — no `db:push`, `drizzle-kit push`, data backfills, `DELETE`/`TRUNCATE`, feature changes, Restaurant lifecycle/payment/KDS changes, merges, or pushes.

---

*End of report.*
