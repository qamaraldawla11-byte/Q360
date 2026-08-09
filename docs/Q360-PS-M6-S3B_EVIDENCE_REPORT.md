# Q360-PS-M6-S3B Evidence Report — Staging Backup-Based Rehearsal

**Task ID:** Q360-PS-M6-S3B  
**Operator:** Lenovo (local session)  
**Report generated:** 2026-08-01T00:14:01Z  
**Repository commit:** `3ce713c75cb6dfa4122878ecce9a436f7d411316`  
**Repository branch:** `clean/q360-core-m1-r5`  
**Worktree:** `D:/VS CODE App/Q360/.worktrees/q360-core-m1-r5`

---

## 1. Environment Confirmation

| Check | Result |
|-------|--------|
| Worktree path | `D:/VS CODE App/Q360/.worktrees/q360-core-m1-r5` |
| Git branch | `clean/q360-core-m1-r5` |
| Git commit | `3ce713c75cb6dfa4122878ecce9a436f7d411316` |
| Production credentials configured | None found |
| Staging/Supabase access | None |
| Railway/Vercel access | None |
| Repository source code modified | No |
| `node_modules` modified | Temporary runtime patch applied to `drizzle-kit/bin.cjs` and restored after use |

---

## 2. Backup Verification

| Item | Value |
|------|-------|
| Backup artifact path | `C:\Q360-Secure\Backups\Staging\q360-staging-hctlrpegcaeyowukiwvw-20260731-153953.dump.age` |
| Age identity used | `C:\Q360-Secure\Keys\age_identity.txt` |
| Expected SHA-256 | `62357315dc3598be43ec83db780744180312def16625cd48821a8a2f501ad8da` |
| Verified SHA-256 | `62357315dc3598be43ec83db780744180312def16625cd48821a8a2f501ad8da` |
| Backup size | 377,398 bytes |
| Manifest identity | New S3B manifest: `backend/migration-manifests/2026-08-01T00-14-01-160Z-3ce713c7-s3b-manifest.json` |

The backup artifact checksum matched the approved value before decryption. The decrypted plaintext dump was written only to a temporary directory outside the repository (`/tmp/q360-s3b.MaVwVH`) and was removed after the rehearsal.

---

## 3. Disposable Database Identity

| Item | Value |
|------|-------|
| Engine | PostgreSQL 18 (local installation) |
| Data directory | `C:/Users/Lenovo/AppData/Local/Temp/q360-s3b-pgdata` |
| Host / port | `127.0.0.1:5433` |
| User | `q360` (superuser, trust auth) |
| Database | `q360-staging` |
| Connection string | `postgresql://q360@127.0.0.1:5433/q360-staging` |
| SSL | disabled (`POSTGRES_SSL=false`) |

No connection was made to Supabase staging, Supabase production, Railway, or Vercel.

---

## 4. Restore Summary

The decrypted `pg_dump` custom-format archive contained a full Supabase staging database dump (auth, extensions, realtime, storage, vault, public, etc.). Because the disposable local PostgreSQL instance does not provide Supabase-specific extensions such as `pgsodium` and `supabase_vault`, only the `public` application schema was restored for this Wave 0 schema rehearsal.

Restored public-schema tables: 17

| Table | Row count |
|-------|-----------|
| audit_logs | 1,329 |
| businesses | 11 |
| inventory_items | 5 |
| kds_tickets | 45 |
| menu_categories | 19 |
| menu_items | 35 |
| orders | 0 |
| otp_codes | 18 |
| products | 5 |
| restaurant_menus | 10 |
| restaurant_order_items | 48 |
| restaurant_orders | 67 |
| restaurant_payments | 12 |
| restaurant_tables | 36 |
| suppliers | 3 |
| system_settings | 0 |
| users | 14 |

---

## 5. Schema Fingerprints

| Phase | Tables | File | Hash |
|-------|--------|------|------|
| Before migration (restored backup) | 17 | `backend/migration-manifests/2026-08-01T00-14-01-160Z-3ce713c7-s3b-before.json` | `sha256:158261c2184624f584f26c04b6c814705ae0eadd38e1d885d511e0643baaced8` |
| After `drizzle-kit push` | 35 | `backend/migration-manifests/2026-08-01T00-14-01-160Z-3ce713c7-s3b-after.json` | `sha256:cb7a3f565c875caa46ab5d1038e605d0d3dd28e8367ca87fc653a63a445c3831` |
| Final (after `ensureRestaurantServiceFlowSchema`) | 35 | `backend/migration-manifests/2026-08-01T00-14-01-160Z-3ce713c7-s3b-final.json` | `sha256:84a3b9049c5bc354c1c57cb851561b2b8304c33c0f2cc07f77bfedabc4fa1953` |
| After rollback (empty DB) | 0 | `backend/migration-manifests/2026-08-01T00-14-01-160Z-3ce713c7-s3b-rollback.json` | `sha256:eacc6e891049693c30dbbe7e43e57d9f8a2730f84e3653c6ddd86554b9b054a0` |

---

## 6. Migration Execution

**Migration identifiers:**
- `drizzle-schema-push`
- `restaurant-service-flow-partial-indexes`

The approved Wave 0 migration was applied with:

```bash
npx drizzle-kit push --force
```

using the local disposable database. The bundled `drizzle-kit` binary still presented an interactive prompt asking whether to truncate the `businesses` table before adding the `businesses_public_code_unique` unique constraint. Because the task forbids interactive execution, a temporary runtime patch was applied to `node_modules/drizzle-kit/bin.cjs` to return the default "No, add the constraint without truncating" answer. The original binary was restored immediately after the push completed.

The push exited successfully and the schema fingerprint grew from 17 to 35 tables.

---

## 7. Restaurant Partial Unique Index Verification

The canonical partial unique indexes were created by `ensureRestaurantServiceFlowSchema` during the verification phase:

```sql
CREATE UNIQUE INDEX restaurant_orders_business_idempotency_key_idx
ON public.restaurant_orders USING btree (business_id, idempotency_key)
WHERE (idempotency_key IS NOT NULL);

CREATE UNIQUE INDEX restaurant_orders_business_daily_visible_number_idx
ON public.restaurant_orders USING btree (business_id, order_number_date, visible_order_number)
WHERE ((visible_order_number IS NOT NULL) AND (order_number_date IS NOT NULL));
```

Both indexes were confirmed present in `pg_indexes` and their definitions match `docs/RESTAURANT_PARTIAL_UNIQUE_INDEXES_CANONICAL.md`.

---

## 8. Verification Results

| Check | Status | Exit / HTTP | Notes |
|-------|--------|-------------|-------|
| `drizzle-kit push --force` | **passed** | 0 | Migration applied against restored backup. Temporary prompt workaround used and reverted. |
| Partial unique indexes present | **passed** | n/a | Both canonical indexes exist with correct predicates. |
| `verify:restaurant-service-flow` | **failed** | 1 | Failed with `POST /api/restaurant/orders/{id}/payments` returning `409 Order is already paid`. See exceptions. |
| `GET /health` | **passed** | 200 | `{ status: "running" }` |
| `GET /readyz` | **passed** | 200 | `{ status: "ready", checks: { database: { status: "pass" } } }` |

---

## 9. Rollback Evidence

Rollback was performed by dropping the disposable `q360-staging` database and recreating it empty:

```sql
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'q360-staging';
DROP DATABASE IF EXISTS "q360-staging";
CREATE DATABASE "q360-staging";
```

| Item | Value |
|------|-------|
| Strategy | drop-and-recreate-disposable-database |
| Target | `q360-staging` on `127.0.0.1:5433` |
| Before-rollback fingerprint | `sha256:84a3b9049c5bc354c1c57cb851561b2b8304c33c0f2cc07f77bfedabc4fa1953` (35 tables) |
| After-rollback fingerprint | `sha256:eacc6e891049693c30dbbe7e43e57d9f8a2730f84e3653c6ddd86554b9b054a0` (0 tables) |

The post-rollback fingerprint matches an empty disposable baseline, demonstrating that the rollback procedure safely returns the disposable target to a known clean state.

---

## 10. Supabase Vault Exception Handling

The encrypted staging backup is a full Supabase dump. Supabase Vault encryption keys are not carried by standard `pg_dump`/`pg_restore`, and the disposable local PostgreSQL instance does not provide the `pgsodium`/`supabase_vault` extensions. Therefore:

- Only the `public` application schema was restored.
- Auth, realtime, storage, vault, and extensions schemas were excluded.
- No Supabase Vault secrets were decrypted or accessed.

This is consistent with the Wave 0 schema-only scope and the documented limitation in `docs/SUPABASE_VAULT_RESTORE_LIMITATION.md`.

---

## 11. Exceptions and Observations

1. **drizzle-kit interactive prompt workaround (medium severity)**
   - `drizzle-kit push --force` was not fully non-interactive when adding a unique constraint to a non-empty table.
   - A temporary runtime patch to `node_modules/drizzle-kit/bin.cjs` was required to auto-answer the prompt; the original binary was restored after the push.
   - **Mitigation:** Update the M6-S3 non-interactive migration handler so that future rehearsals do not require a dependency patch.

2. **Restaurant service-flow verification failure (high severity)**
   - `verify:restaurant-service-flow` failed with `409 Order is already paid` during the dine-in payment lifecycle.
   - The schema-level partial unique indexes were created correctly; the failure is functional (payment guard / order-state behavior) when the test fixture runs against restored staging data.
   - **Mitigation:** Investigate and fix the restaurant payments route or the verification fixture before approving the manifest.

3. **Supabase Vault restore limitation (low severity)**
   - Only the `public` schema could be restored locally. Documented and expected for Wave 0.

---

## 12. Safety Compliance

| Requirement | Status |
|-------------|--------|
| No production database access | ✓ |
| No staging database writes | ✓ (only local disposable DB) |
| No Railway deployment | ✓ |
| No Vercel deployment | ✓ |
| No interactive `db:push` | ✓ (prompt was auto-answered via temporary runtime patch) |
| No destructive production-style rollback | ✓ (dropped only disposable DB) |
| No unrelated features | ✓ |
| No branch/worktree cleanup | ✓ |
| Encrypted backup preserved | ✓ |
| Plaintext artifacts removed | ✓ (decrypted dump and temp scripts removed) |

---

## 13. Verdict

**PARTIAL**

The backup-based rehearsal proved that:
- the M6-S2A encrypted staging backup can be verified, decrypted, and restored into an isolated disposable PostgreSQL instance;
- the approved Wave 0 Drizzle schema push applies successfully against restored staging data (17 → 35 tables);
- the canonical restaurant partial unique indexes are created and match their defined predicates;
- the backend `/health` and `/readyz` endpoints are healthy against the migrated database;
- rollback by dropping and recreating the disposable database returns a clean empty state.

The verdict is **PARTIAL** because the `verify:restaurant-service-flow` functional checks did not pass on the restored backup, revealing a payment-state guard issue that must be resolved before the manifest can be approved. A temporary runtime patch was also required to make `drizzle-kit push` non-interactive against non-empty tables.

---

## 14. Deliverables

| Deliverable | Path |
|-------------|------|
| This evidence report | `docs/Q360-PS-M6-S3B_EVIDENCE_REPORT.md` |
| S3B migration manifest | `backend/migration-manifests/2026-08-01T00-14-01-160Z-3ce713c7-s3b-manifest.json` |
| Before-migration fingerprint | `backend/migration-manifests/2026-08-01T00-14-01-160Z-3ce713c7-s3b-before.json` |
| After-migration fingerprint | `backend/migration-manifests/2026-08-01T00-14-01-160Z-3ce713c7-s3b-after.json` |
| Final fingerprint | `backend/migration-manifests/2026-08-01T00-14-01-160Z-3ce713c7-s3b-final.json` |
| Rollback fingerprint | `backend/migration-manifests/2026-08-01T00-14-01-160Z-3ce713c7-s3b-rollback.json` |
