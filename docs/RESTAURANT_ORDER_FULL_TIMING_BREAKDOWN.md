# Restaurant Order Full Timing Breakdown

## Purpose

`POST /api/restaurant/orders` still has live latency that is not explained by the original timing fields. This change adds safe structured timing around awaited operations in the normal Restaurant order-create route so the next live run can identify which segment still dominates.

## Scope

This is instrumentation only. It does not change schema, request validation, tenant isolation, auth, visible order numbering, idempotency, payments, KDS, table lifecycle, response shape, frontend behavior, or deployment configuration.

## Safe logging rules

The timing log keeps the existing `correlationId` and logs only operation names and durations in milliseconds. It does not log request bodies, menu item ids, order ids, business ids, payment amounts, connection strings, secrets, or database hosts.

## Timing fields added

- `requestParsingDurationMs`: JSON body parsing.
- `idempotencyLookupDurationMs`: existing-order lookup when an idempotency key is present.
- `transactionStartDelayDurationMs`: time from calling `db.transaction(...)` until the transaction callback begins.
- `transactionDurationMs`: total awaited `db.transaction(...)` duration.
- `transactionCallbackDurationMs`: time spent inside the transaction callback.
- `transactionCommitFinalizationDurationMs`: transaction duration not accounted for by callback start delay and callback body time.
- `tableValidationDurationMs`: dine-in table lookup when applicable.
- `menuValidationQueryDurationMs`: tenant-scoped batched menu item validation query.
- `orderNumberAllocationDurationMs`: advisory lock plus visible-order-number query.
- `orderNumberLockDurationMs`: advisory transaction lock query.
- `orderNumberQueryDurationMs`: visible order number allocation query.
- `orderInsertDurationMs`: `restaurant_orders` insert.
- `orderItemInsertDurationMs`: `restaurant_order_items` insert.
- `kdsInsertDurationMs`: `kds_tickets` insert.
- `tableUpdateDurationMs`: dine-in table occupancy update when applicable.
- `auditLogInsertDurationMs`: post-transaction audit insert wrapper.
- `responseOrderRefetchDurationMs`: response hydration order refetch.
- `responseItemsRefetchDurationMs`: response hydration order-items refetch.
- `responsePaymentsRefetchDurationMs`: response hydration payments refetch.

Existing timing fields remain:

- `requestDurationMs`
- `authorizationDurationMs`
- `orderWriteDurationMs`
- `kdsWriteDurationMs`
- `responsePreparationDurationMs`

`paymentInsertDurationMs` remains a safe timing field in the shared timing type for payment-writing routes, but normal `POST /api/restaurant/orders` does not create a payment.

## Interpretation notes

`transactionCommitFinalizationDurationMs` is derived from measured transaction total minus transaction start delay and transaction callback body duration. It is an approximation of driver/database transaction finalization after the callback resolves.

For takeaway orders, `tableValidationDurationMs` and `tableUpdateDurationMs` should remain `0` because no table lookup or table status update runs.

For requests without an idempotency key, `idempotencyLookupDurationMs` should remain `0` because no idempotency lookup runs.

## Live timing test

Use the POS flow or API client to create one one-item takeaway order against the live production-beta backend. Include a unique `X-Q360-Correlation-Id` header and an idempotency key. Capture the single structured timing log whose `correlationId` matches that header.

Compare:

- `requestDurationMs`
- Sum of the original fields
- Sum of the new per-operation fields
- Any remaining gap between `requestDurationMs` and measured route operations

The next optimization should target the largest confirmed measured field, not a plausible infrastructure cause.

## Verification

- `npm run build`: passed.
- `npm run lint`: passed.
- `cd backend && npm run build`: passed.
- `cd backend && npm run verify:restaurant`: passed with temporary process markers `Q360_DATABASE_ENV=staging` and `Q360_DATABASE_NAME=q360-staging`. The first sandboxed run reached the staging guard and failed to connect with `EACCES`; the escalated rerun completed successfully against the existing Q360-beta database.
