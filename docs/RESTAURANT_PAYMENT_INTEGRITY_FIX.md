# Restaurant Payment Integrity Fix

## Root cause

Restaurant billing completed orders through the generic order-status endpoint. That made an order look paid and released its table without guaranteeing a persisted row in `restaurant_payments`.

## Payment flow decision

Billing now uses the existing payment endpoint as the authoritative completion path. The backend creates the completed payment row, marks the order paid, and releases the table in one transaction.

## Files changed

- `src/api/restaurant.api.ts`
- `src/modules/commerce/restaurant/views/BillingView.tsx`
- `backend/src/routes/restaurant.ts`
- `backend/src/scripts/verify_restaurant_core.ts`
- `tests/e2e/fixtures.ts`
- `tests/e2e/03-restaurant-loop.spec.ts`
- `docs/RESTAURANT_PAYMENT_INTEGRITY_FIX.md`

## Backend safeguards

The payment endpoint validates tenant-scoped order ownership, allowed methods, exact amount, payable order status, and existing completed payment rows. It repeats duplicate and status checks inside a transaction after locking the order row, then inserts the payment, marks the order paid, and releases the table. The generic status endpoint now rejects direct `paid` transitions with HTTP 409.

## Frontend behavior

Billing exposes the existing payment methods for ready orders and sends the selected method plus the order total to `/restaurant/orders/:id/payments`. It no longer calls the standalone status update to mark an order paid.

## Verification added

`verify:restaurant` now resets an isolated verification business, creates an order, completes KDS, pays through the payment endpoint, checks exactly one payment row, validates amount, method, timestamp, paid order status, released table, dashboard revenue, and duplicate-payment conflict behavior.

The mocked Playwright restaurant loop now verifies that billing calls the payment endpoint with the expected order ID, amount, and method before returning the mocked paid state.

## Commands run and results

- `npm run build` exited 0.
- `npm run lint` exited 0.
- `cd backend && npm run build` exited 0.
- `cd backend && npm run verify:restaurant` exited 1 in the sandbox because the seed step could not connect to the configured database: `AggregateError [EACCES]`.
- Rerunning `cd backend && npm run verify:restaurant` with unsandboxed database access was rejected by the approval reviewer because it mutates the configured external Postgres database, including seed data.
- First `npx playwright test tests/e2e/03-restaurant-loop.spec.ts --reporter=list` run reported `1 passed` but exited 1 after Playwright timed out during web-server teardown.
- After starting the local Vite dev server separately, `npx playwright test tests/e2e/03-restaurant-loop.spec.ts --reporter=list` exited 0 with `1 passed`.
- `npx playwright test --reporter=list` exited 0 with `5 passed`.

## Known limitations

The Playwright restaurant loop remains a mocked frontend-flow test and does not verify real database persistence. Real persistence is covered by `npm run verify:restaurant` against the configured backend database.
