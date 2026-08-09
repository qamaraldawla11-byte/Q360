# Restaurant Partial Unique Indexes as Canonical Database Invariants

Task ID: Q360-PS-M6-S3

## Canonical Invariants

The following partial unique indexes on `restaurant_orders` are adopted as canonical database invariants. They are enforced by the database and must be preserved by any future migration that touches the `restaurant_orders` table.

### 1. Business-Scoped Idempotency Key

```sql
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_orders_business_idempotency_key_idx
ON restaurant_orders (business_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;
```

**Purpose**: Prevent duplicate order creation when a client retries a request with the same idempotency key within the same business tenant.

**Why partial**: Orders that do not include an idempotency key (legacy or non-retried creates) must not be constrained by this index. The invariant applies only when `idempotency_key IS NOT NULL`.

**Behavioral guarantee**: A duplicate submit with the same `(business_id, idempotency_key)` pair returns the existing order instead of creating a second order, payment, or Kitchen ticket.

### 2. Business Daily Visible Order Number

```sql
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_orders_business_daily_visible_number_idx
ON restaurant_orders (business_id, order_number_date, visible_order_number)
WHERE visible_order_number IS NOT NULL AND order_number_date IS NOT NULL;
```

**Purpose**: Enforce unique daily visible order numbers per business. This supports human-readable order numbering (for example, `#1`, `#2` per day) without collisions.

**Why partial**: Orders that do not yet have a visible order number (pre-allocation state or test fixtures) are not constrained. The invariant applies only when both `visible_order_number` and `order_number_date` are present.

**Behavioral guarantee**: Two orders in the same business on the same day cannot receive the same visible order number.

## Current Enforcement

The indexes are created by the runtime schema guard in `backend/src/db/restaurantServiceFlowMigration.ts` (`ensureRestaurantServiceFlowSchema`). They are `IF NOT EXISTS` and are safe to run idempotently.

## Migration Contract

Any future schema migration must:

1. Preserve both indexes exactly as defined above unless an explicit replacement invariant is approved.
2. Not change the partial `WHERE` clauses in a way that weakens uniqueness guarantees.
3. Not remove the supporting columns (`business_id`, `idempotency_key`, `order_number_date`, `visible_order_number`) without a replacement invariant.
4. Include the index definitions in the migration manifest and schema fingerprint diff.

## Verification

The `verify:restaurant-service-flow` script exercises the idempotency invariant. Wave 0 adds schema fingerprint capture so any change to these index definitions is visible in the before/after diff.

## Protected Status

These invariants are part of the Restaurant order lifecycle. They are therefore protected under the Wave 0 boundary: they may only be documented, preserved, or strengthened; they must not be weakened or removed without a separate lifecycle change request.
