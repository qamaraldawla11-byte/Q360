# Q360 `/readyz` Readiness Contract

## Purpose

`/readyz` is the Kubernetes-style readiness probe for the Q360 backend. It returns HTTP 200 only when the process is able to serve traffic against a database that has reached the approved migration baseline. `/health` remains a liveness-only endpoint.

## Endpoint

- `GET /readyz`
- No authentication required.
- Response contains no credentials, connection strings, or hostnames.

## Success criteria

`/readyz` returns HTTP 200 with `status: ready` only when **all** of the following checks pass:

1. **Database connectivity** – a `SELECT 1` round-trip succeeds.
2. **Migration journal exists** – `drizzle.__drizzle_migrations` exists and contains rows.
3. **Migration 0000 hash is correct** – the journal contains a row whose hash matches the SHA-256 of `backend/drizzle/0000_wave0_initial.sql`.
4. **Migration 0001 is present** – the journal contains a row whose hash matches the SHA-256 of `backend/drizzle/0001_restaurant_partial_index_adoption.sql`.
5. **Critical tables exist** – `users`, `businesses`, `audit_logs`, `staff_invitations`, `staff_members`, `business_modules`, `customers`, `quotes`, `quote_items`, `restaurant_orders`, `restaurant_payments`, `kds_tickets`, `orders`, `products`, `inventory_items`, `stock_movements`.
6. **Critical columns exist** – `businesses.public_code`, `users.module_access`, `restaurant_orders.idempotency_key`, `restaurant_orders.visible_order_number`, `restaurant_orders.order_number_date`, `inventory_items.product_id`, `stock_movements.operation_id`, `stock_movements.movement_type`, `stock_movements.source_module`.
7. **Canonical partial unique indexes exist with exact predicates**:
   - `restaurant_orders_business_idempotency_key_idx` on `(business_id, idempotency_key) WHERE idempotency_key IS NOT NULL`
   - `restaurant_orders_business_daily_visible_number_idx` on `(business_id, order_number_date, visible_order_number) WHERE visible_order_number IS NOT NULL AND order_number_date IS NOT NULL`
   - `inventory_items_product_id_idx` on `inventory_items(product_id)`
   - `stock_movements_business_operation_item_uidx` on `(business_id, operation_id, inventory_item_id) WHERE operation_id IS NOT NULL`
8. **Baseline provenance exists** – `public.q360_baseline_provenance` has at least one row.

## Failure behavior

If any check fails, `/readyz` returns HTTP 503 with `status: not_ready`, a `timestamp`, `responseMs`, and a `checks` array. Each check reports `pass` or `fail`; failing checks include a sanitized `error` string. The response never includes the database URL, password, or other secrets.

## Implementation

The readiness logic lives in `backend/src/services/readiness.ts` and is wired to `/readyz` in `backend/src/index.ts`. It compares the live PostgreSQL catalog against the committed 0000 and 0001 Drizzle snapshots using `backend/src/services/baseline_catalog.ts`.
