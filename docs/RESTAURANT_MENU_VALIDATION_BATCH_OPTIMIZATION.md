# Restaurant Menu Validation Batch Optimization

## Problem

`POST /api/restaurant/orders` canonicalized duplicate order items first, then validated each distinct menu item with one awaited tenant-scoped `menu_items` query per distinct id inside the existing transaction.

That preserved correctness, but it made validation query count grow linearly with the number of distinct menu items. The performance audit identified this as the safest first measured optimization because these reads happen outside `orderWriteDurationMs` and before order, KDS, table, audit, and response hydration behavior.

## Existing behavior preserved

- Duplicate item IDs are still canonicalized with the existing `Map` flow.
- Quantities still accumulate by menu item id.
- Notes still follow the existing behavior: the latest non-empty note for a duplicate item wins, otherwise the prior note is kept.
- Missing item rejection remains `404` via `ITEM_NOT_FOUND`.
- Unavailable item rejection remains `409` via `ITEM_UNAVAILABLE`.
- Cross-tenant item IDs remain rejected because the batch query is still scoped by `businessId`.
- Order total still uses the stored menu item price read inside the transaction.
- Order writes, item writes, KDS creation, table status updates, idempotency, audit logging, and response hydration are unchanged.

## Implementation

Inside the existing `POST /api/restaurant/orders` transaction, the route now:

1. Builds the same normalized `requests` map from request items.
2. Creates `requestedMenuItemIds` from the normalized map keys.
3. Fetches all requested menu rows in one tenant-scoped `IN` query.
4. Builds an in-memory `Map` by menu item id.
5. Iterates the normalized `requests` entries in the original insertion order to preserve canonical response/write order.
6. Applies the same missing and unavailable checks before building `canonicalItems`.

No transaction boundary, write ordering, lifecycle operation, or response shape was changed.

## Files changed

- `backend/src/routes/restaurant.ts`
- `backend/src/scripts/verify_restaurant_core.ts`
- `docs/RESTAURANT_MENU_VALIDATION_BATCH_OPTIMIZATION.md`

## Query-count impact

For normal `POST /api/restaurant/orders` menu validation:

- Before: `N` tenant-scoped `menu_items` reads for `N` distinct requested menu item ids.
- After: `1` tenant-scoped `menu_items` read for all distinct requested menu item ids.

Examples:

- One item: `1 -> 1`.
- Three distinct items: `3 -> 1`.
- Duplicate item IDs canonicalized to one distinct id: `1 -> 1`.

## Timing instrumentation

No timing fields were changed. The existing timing schema is preserved.

This implementation reduces the known query count without adding new log fields. A future instrumentation-only change can add a narrow menu-validation timer if production evidence needs to separate menu validation from the remaining unmeasured route gap.

## Regression coverage

`backend/src/scripts/verify_restaurant_core.ts` now includes focused coverage for:

- One-item normal order.
- Multiple distinct item normal order.
- Duplicate menu item IDs canonicalized into one order item.
- Duplicate item idempotency replay returning the same order.
- Unavailable item rejection.
- Cross-tenant item rejection.
- Dine-in and takeaway behavior through existing core flow plus focused owner takeaway creation.
- One KDS ticket for an idempotent duplicate order.
- Pay-now lifecycle remains intact.
- Restaurant owner authorization for order creation.

Existing coverage in the same script continues to verify tenant isolation, KDS status transition, table lifecycle, payment permissions, dashboard state, and duplicate payment protection.

## Commands run and results

- `npm run build`: passed.
- `npm run lint`: passed.
- `cd backend && npm run build`: passed.
- `cd backend && npm run verify:restaurant`: blocked by the repository staging-database guard because `Q360_DATABASE_ENV=staging` is not set.
- `cd backend && npm run verify:tenant-identity`: blocked by the repository staging-database guard because `Q360_DATABASE_ENV=staging` is not set.

## Known limitations

This changes only normal `POST /api/restaurant/orders`. The similar pay-now menu validation loop remains intentionally unchanged because the requested optimization target was the normal order route.

The change reduces database round trips for multi-item normal orders, but it does not address remaining unmeasured latency candidates such as advisory lock/order-number allocation, transaction commit, audit insert, response refetches, middleware timing, or final response serialization.

## Recommended next performance step

Add narrow timing instrumentation around the remaining unmeasured route segments: idempotency lookup, table lookup, menu validation, advisory lock, visible order-number query, transaction commit, table update, audit insert, response refetch, and final response serialization boundary.
