# Q360-PS-M6-S3C Evidence Report — Wave 0 Non-Interactive Migration Hardening

**Task ID:** Q360-PS-M6-S3C  
**Operator:** Lenovo (local session)  
**Report generated:** 2026-08-01T00:40:00Z  
**Repository commit:** `8dab95f761df5e11564ea515e45a0a6c95688608`  
**Repository branch:** `clean/q360-core-m1-r5`  
**Worktree:** `D:/VS CODE App/Q360/.worktrees/q360-core-m1-r5`

---

## 1. Founder Brief

Wave 0 migration safety is now hardened against interactive prompts. The previous S3B rehearsal proved the schema could be pushed to a disposable PostgreSQL instance, but only by temporarily patching `drizzle-kit` to auto-answer a prompt that appeared when adding a unique constraint to a non-empty table. S3C removes that workaround by replacing `drizzle-kit push --force` with committed, versioned SQL migrations applied via `drizzle-kit migrate`, which is deterministic and never prompts. The canonical Restaurant partial unique indexes are still ensured idempotently after migration. Two consecutive runs against a clean disposable database prove the mechanism reaches the approved target schema on first application and is a no-op on second application. `/health` and `/readyz` both pass against the migrated database.

---

## 2. Exact Cause of Interactivity

`drizzle-kit push --force` is documented as non-interactive, but it still emits an interactive confirmation when it needs to add a `UNIQUE` constraint to a table that already contains rows. In the S3B rehearsal, the push attempted to add:

```sql
ALTER TABLE businesses ADD CONSTRAINT businesses_public_code_unique UNIQUE (public_code);
```

against a restored staging backup where `businesses` already had 11 rows. Drizzle Kit paused and asked whether to truncate the table before adding the constraint. The default answer ("No, add the constraint without truncating") was the safe choice, but the prompt itself blocked fully non-interactive execution and required a temporary runtime patch to `node_modules/drizzle-kit/bin.cjs`.

Root cause: `drizzle-kit push` computes a live diff and tries to protect the operator from data-loss scenarios; the `--force` flag does not suppress the unique-constraint truncation prompt.

---

## 3. Files Changed

| Path | Change | Purpose |
|------|--------|---------|
| `backend/drizzle/0000_wave0_initial.sql` | Added | Committed initial Wave 0 migration generated from `backend/src/db/schema.ts`. |
| `backend/drizzle/meta/_journal.json` | Added | Drizzle migration journal tracking the committed migration. |
| `backend/drizzle/meta/0000_snapshot.json` | Added | Drizzle schema snapshot for the committed migration. |
| `backend/src/scripts/migrate_noninteractive.ts` | Modified | Replaced `npx drizzle-kit push --force` with `npx drizzle-kit migrate`; added deterministic idempotent step to ensure canonical Restaurant partial unique indexes. |
| `backend/package.json` | Modified | Renamed script `db:push:staging` to `db:migrate:staging` to reflect the committed-migration design. |

No unrelated files were modified. The S3B state (`backend/src/index.ts`, helper scripts, docs, `.gitignore`) is preserved and committed together with the S3C changes.

---

## 4. Deterministic Migration Design

1. **Source of truth:** `backend/src/db/schema.ts` remains the authoritative Wave 0 schema.
2. **Generate committed migrations:** `drizzle-kit generate` produces `backend/drizzle/0000_wave0_initial.sql` and the `meta/` journal from the schema.
3. **Apply deterministically:** `drizzle-kit migrate` reads the committed SQL files and the journal table (`__drizzle_migrations`) and applies only unapplied migrations. It executes SQL directly and never prompts.
4. **Ensure canonical indexes:** After migration, `ensureRestaurantServiceFlowSchema()` from `backend/src/db/restaurantServiceFlowMigration.ts` idempotently creates the two canonical partial unique indexes on `restaurant_orders`.
5. **Fail-closed environment guard:** The script still requires `Q360_DATABASE_ENV=staging` and `Q360_DATABASE_NAME=q360-staging` before running.
6. **Evidence capture:** Before and after schema fingerprints are captured and written to `backend/migration-manifests/` along with a migration manifest.

This design eliminates the unique-constraint prompt because the committed SQL is executed as-is; if a unique constraint cannot be added due to duplicate data, the migration fails with a clear PostgreSQL error and a non-zero exit code instead of hanging on a prompt.

---

## 5. First-Run Result

Target: disposable PostgreSQL 18 on `127.0.0.1:5434`, database `q360-staging`, SSL disabled.

| Item | Value |
|------|-------|
| Command | `npx tsx src/scripts/migrate_noninteractive.ts` |
| Migration command executed | `npx drizzle-kit migrate` |
| Exit code | 0 |
| Tables before | 0 |
| Tables after | 35 |
| Before fingerprint | `migration-manifests/2026-08-01T00-32-10-901Z-3ce713c7-02eefa23-before.json` |
| After fingerprint | `migration-manifests/2026-08-01T00-32-10-901Z-3ce713c7-02eefa23-after.json` |
| Before hash | `sha256:ae250dfb8621ea298ef34b506073502beb95a92d65f7dd1dad191d354edaa5b3` |
| After hash | `sha256:c7a084ecacae10d1a39d5e8842068b82e31aedd8058267b5599c1c72e7e0df57` |
| Manifest | `backend/migration-manifests/2026-08-01T00-32-10-901Z-3ce713c7-02eefa23-manifest.json` |
| Status | passed |

The first run created all 35 approved Wave 0 tables, plus the Drizzle `drizzle` schema and `__drizzle_migrations` journal table. No destructive SQL was executed.

---

## 6. Second-Run Result

Target: same disposable database, immediately after the first run.

| Item | Value |
|------|-------|
| Command | `npx tsx src/scripts/migrate_noninteractive.ts` |
| Migration command executed | `npx drizzle-kit migrate` |
| Exit code | 0 |
| Tables before | 35 |
| Tables after | 35 |
| Before fingerprint | `migration-manifests/2026-08-01T00-33-39-446Z-3ce713c7-35e1ccd9-before.json` |
| After fingerprint | `migration-manifests/2026-08-01T00-33-39-446Z-3ce713c7-35e1ccd9-after.json` |
| Before hash | `sha256:6ed04f334c8f66804b915e88585e05978c4e3406c095ffb61e8f24a184947811` |
| After hash | `sha256:1a53cbfdaff82d40f5df6bc59bf944ad09168e0b86f521b5e6c8268a89a2456a` |
| Manifest | `backend/migration-manifests/2026-08-01T00-33-39-446Z-3ce713c7-35e1ccd9-manifest.json` |
| Status | passed |

`drizzle-kit migrate` reported:

```
schema "drizzle" already exists, skipping
relation "__drizzle_migrations" already exists, skipping
[✓] migrations applied successfully!
```

The before/after fingerprints differ only by their `generatedAt` timestamps. With `generatedAt` normalized, the structural diff is empty, proving no schema work remained.

---

## 7. Schema Fingerprint and Index Evidence

### Schema fingerprint summary

| Phase | Tables | Indexes | Fingerprint file |
|-------|--------|---------|------------------|
| Run 1 before | 0 | 0 | `...02eefa23-before.json` |
| Run 1 after | 35 | 31 | `...02eefa23-after.json` |
| Run 2 before | 35 | 31 | `...35e1ccd9-before.json` |
| Run 2 after | 35 | 31 | `...35e1ccd9-after.json` |

Tables created on run 1:

- `audit_logs`
- `business_assets`
- `business_modules`
- `businesses`
- `customers`
- `inventory_items`
- `kds_tickets`
- `menu_categories`
- `menu_item_assets`
- `menu_items`
- `orders`
- `otp_codes`
- `products`
- `purchase_expense_records`
- `purchase_orders`
- `q_assistant_conversations`
- `q_assistant_drafts`
- `q_assistant_messages`
- `q_business_memories`
- `q_guest_briefs`
- `q_usage_events`
- `quote_items`
- `quotes`
- `restaurant_bookings`
- `restaurant_menus`
- `restaurant_order_items`
- `restaurant_orders`
- `restaurant_payments`
- `restaurant_tables`
- `staff_invitations`
- `staff_members`
- `stock_movements`
- `suppliers`
- `system_settings`
- `users`

### Restaurant partial unique indexes

Both canonical indexes are present and match `docs/RESTAURANT_PARTIAL_UNIQUE_INDEXES_CANONICAL.md`:

```sql
CREATE UNIQUE INDEX restaurant_orders_business_idempotency_key_idx
ON public.restaurant_orders USING btree (business_id, idempotency_key)
WHERE (idempotency_key IS NOT NULL);

CREATE UNIQUE INDEX restaurant_orders_business_daily_visible_number_idx
ON public.restaurant_orders USING btree (business_id, order_number_date, visible_order_number)
WHERE ((visible_order_number IS NOT NULL) AND (order_number_date IS NOT NULL));
```

### No destructive SQL

A review of `backend/drizzle/0000_wave0_initial.sql` found no `DROP`, `TRUNCATE`, `DELETE`, or column-dropping `ALTER` statements.

---

## 8. /health and /readyz Results

The backend was started against the migrated disposable database on port 3002.

### GET /health

```json
{
  "name": "Q360 Backend API",
  "version": "0.0.1",
  "status": "running",
  "timestamp": "2026-08-01T00:37:56.750Z"
}
```

- HTTP status: 200

### GET /readyz

```json
{
  "status": "ready",
  "timestamp": "2026-08-01T00:37:56.857Z",
  "checks": {
    "database": {
      "status": "pass",
      "responseMs": 67
    }
  }
}
```

- HTTP status: 200

---

## 9. Cleanup Evidence

| Item | Action | Status |
|------|--------|--------|
| Disposable PostgreSQL server | Stopped with `pg_ctl stop -m fast` | ✓ |
| Disposable data directory | Removed `C:/Users/Lenovo/AppData/Local/Temp/q360-s3c-pgdata.zou9Ap` | ✓ |
| Backend `.env` | Removed `backend/.env` | ✓ |
| Temporary log files | Removed `/tmp/q360-s3c-run1.log`, `/tmp/q360-s3c-run2.log`, `/tmp/q360-s3c-server.log` | ✓ |
| Backend server process | Killed after /health and /readyz checks | ✓ |
| Migration evidence | Kept in `backend/migration-manifests/` (gitignored) | ✓ |

No staging, production, Railway, or Vercel artifacts remain.

---

## 10. Git-State Evidence

```bash
$ git status --short
# no output
```

```bash
$ git rev-parse HEAD
8dab95f761df5e11564ea515e45a0a6c95688608
```

```bash
$ git log --oneline -3
8dab95f feat(migration): Q360-PS-M6-S3C Wave 0 non-interactive migration hardening
3ce713c feat(core-m1): shared customers and quotes module entitlement
5e68d70 Merge pull request #14 from qamaraldawla11-byte/fix/e2e-ds4-selector-refresh
```

The working tree is clean. The S3C changes are committed locally. No push or merge was performed.

---

## 11. Risks or Limitations

1. **Empty-database rehearsal only.** S3C ran against a clean disposable PostgreSQL instance, not a restored staging backup. The non-interactive mechanism is designed to be safe against populated databases (it fails with a SQL error instead of prompting), but that path was not exercised with real staging data in this wave.
2. **Restaurant indexes remain runtime-enforced.** The two canonical partial unique indexes are applied by `ensureRestaurantServiceFlowSchema()` after `drizzle-kit migrate`. They are not part of the committed Drizzle schema or the generated migration. Future schema changes could inadvertently omit them if the runtime guard is removed.
3. **Data-dependent failures on production-like restores.** If a restored database contains duplicate `businesses.public_code`, `users.email`, `products.barcode`, or other constrained values, `drizzle-kit migrate` will fail with a clear PostgreSQL unique-violation error. This is the correct fail-closed behavior, but it requires data cleanup before migration.
4. **No rollback evidence recorded.** The migration manifest records no rollback execution. Rollback for this rehearsal remains "drop and recreate the disposable database," which is acceptable for Wave 0 but should be expanded in S3D if a staging backup-based rehearsal is performed.

---

## 12. Verdict: PASS

- The interactive Wave 0 migration path is replaced by a committed, deterministic, non-interactive mechanism.
- First run reached the approved target schema (0 → 35 tables) with exit code 0.
- Second run proved idempotency (35 → 35 tables, no structural diff) with exit code 0.
- Both canonical Restaurant partial unique indexes are present and correct.
- `/health` and `/readyz` pass against the migrated database.
- No destructive SQL is present in the committed migration.
- Cleanup completed; only intentional committed changes remain in the repository.

The verdict is **PASS** with the limitations noted above.

---

## 13. Recommended S3D Scope

1. **Backup-based rehearsal.** Restore the approved encrypted staging backup into a disposable PostgreSQL instance and apply the committed S3C migrations (`npx drizzle-kit migrate`) without any runtime patch. Confirm the migration succeeds or fails with a documented, non-interactive error.
2. **Rollback evidence.** Extend `migrate_noninteractive.ts` to optionally execute and fingerprint the disposable-database rollback, producing a `rollbackEvidence` block in the manifest.
3. **Restaurant index migration.** Consider moving the two canonical partial unique indexes from the runtime guard into the Drizzle schema (`schema.ts`) so they are generated into the committed migration and verified by the standard migration journal.
4. **Restaurant lifecycle verification (out-of-scope for Wave 0).** Separately investigate and resolve the `verify:restaurant-service-flow` payment-state issue observed in S3B before approving any production-bound manifest.
