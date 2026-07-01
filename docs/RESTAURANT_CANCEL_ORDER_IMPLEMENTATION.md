# Restaurant Cancel Order Implementation

## Scope

Added a conservative Restaurant Cancel Order workflow as a state transition. No deletion, refunds, voids, discounts, split bills, receipts, inventory, scheduling, delivery integration, AI, QR menu, purchases, expenses, or new workspace modules were added.

## Kitchen Ready root-cause findings

The exact live root cause is not proven without live HTTP response details or Railway logs. Code inspection found that Kitchen Ready should return a refreshed payment-free KDS shape and that stale UI state can produce real server rejections. The implementation now returns refreshed KDS state from the ready endpoint, removes successful tickets from local UI state from that response, refreshes after failures, and shows backend error text only for genuine server failures.

## Cancel state model

Cancellation is persisted on `restaurant_orders` with `status: cancelled`, `service_status: cancelled`, `cancellation_reason`, `cancelled_by`, and `cancelled_at`. Existing order rows stay in history. Paid, closed, and already-cancelled orders cannot be cancelled.

## Permission matrix

- Waiter: can cancel only same-tenant pending dine-in orders they created.
- Cashier: can cancel pending takeaway orders before kitchen preparation.
- Manager: can cancel valid unpaid non-closed orders.
- Owner: can cancel valid unpaid non-closed orders.
- Admin: can cancel valid unpaid non-closed orders.
- Kitchen: cannot cancel.
- Unknown or missing role: rejected.

Backend permissions are authoritative; UI visibility is only a convenience.

## Tenant and audit enforcement

All cancellation lookup and mutation queries include JWT-derived `businessId`. Cross-tenant cancellation returns not found. Cancellation writes an existing audit log event `RESTAURANT_ORDER_CANCELLED` with actor user id, tenant id, reason, order id, visible order number, timestamp, and previous service/payment state.

## Table and Kitchen ticket behavior

Cancelled dine-in orders release their occupied table through same-tenant table update. Linked KDS tickets become `cancelled` with `completedAt`, are removed from active KDS, and cannot be marked ready.

Cancelled orders cannot be readied, delivered, collected, or paid.

## UI flow

Orders & Payments shows `Cancel Order` only for locally valid role/state combinations. It requires confirmation and a non-empty reason prompt, submits to the backend cancel endpoint, and replaces local state from the returned server order. Cancelled rows display `Cancelled`, reason, and cancelling actor where available. Kitchen remains payment-free and has no cancel action.

## Files changed

- `backend/src/db/schema.ts`
- `backend/src/db/restaurantServiceFlowMigration.ts`
- `backend/src/routes/restaurant.ts`
- `backend/src/scripts/verify_restaurant_service_flow.ts`
- `src/api/restaurant.api.ts`
- `src/modules/commerce/restaurant/views/BillingView.tsx`
- `src/modules/commerce/restaurant/views/KitchenView.tsx`
- `docs/RESTAURANT_KITCHEN_READY_AND_CANCEL_AUDIT.md`
- `docs/RESTAURANT_CANCEL_ORDER_IMPLEMENTATION.md`

## Tests added

Extended `backend/src/scripts/verify_restaurant_service_flow.ts` for cashier takeaway cancellation, waiter-created dine-in cancellation and table release, cancelled-order ready/deliver/pay rejection, paid-order cancellation rejection, kitchen cancellation rejection, cross-tenant cancellation rejection, tenant-scoped audit record, existing dine-in lifecycle, takeaway pay-first, takeaway pay-later, payment restrictions, and visible order numbers.

## Commands and results

Staging guard markers confirmed from `backend/.env.staging`: `Q360_DATABASE_ENV=staging` and `Q360_DATABASE_NAME=q360-staging`.

Passed after sandbox network approval: `cd backend; DOTENV_CONFIG_PATH=.env.staging npm run verify:tenant-identity`.

Passed: `cd backend; DOTENV_CONFIG_PATH=.env.staging npm run verify:restaurant`.

Passed after stabilizing verifier token reuse: `cd backend; DOTENV_CONFIG_PATH=.env.staging npm run verify:restaurant-service-flow`.

Passed: `npm run build`.

Passed: `npm run lint`.

Passed: `cd backend; npm run build`.

## Remaining limitations

No refund or void flow exists for paid orders. Waiter cancellation is intentionally narrow because there is no table/order assignment model beyond `createdBy`. Historical orders without cancellation fields remain readable but do not gain retroactive cancellation metadata.

## Next safe slice

After staging verification passes, inspect sanitized live Railway logs for the exact Kitchen Ready HTTP status/body and run controlled live validation only after deployment status is fully confirmed.
