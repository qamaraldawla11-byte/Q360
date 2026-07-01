# Restaurant Phase 1 Order Journey Audit

Date: 2026-07-01

## Current POS create-order flow

Verified from code: `PosView.handleCheckout` posts `table_id`, `order_type`, `payment_timing`, `idempotency_key`, and line items through `restaurantApi.createOrder` to `POST /api/restaurant/orders`.

Verified from code: the backend derives `businessId` from the JWT, validates same-tenant tables and menu items, creates `restaurant_orders`, `restaurant_order_items`, and one KDS ticket in one transaction, occupies dine-in tables, and returns the refreshed order.

Verified from staging test: `verify:restaurant-service-flow` confirms owner, legacy restaurant owner, waiter, and cashier-takeaway creation paths, duplicate idempotency-key create safety, and cross-tenant create rejection.

## Current Kitchen mark-ready flow

Verified from code: `KitchenView.markDone` calls `PATCH /api/restaurant/kds/:id/status` with `{ "status": "done" }`.

Verified from code: the backend allows kitchen, manager, owner, and admin roles; loads the ticket and linked order by JWT tenant; rejects invalid state jumps; marks ticket done; marks order service `ready`; marks items `done`; and returns refreshed KDS ticket state.

Verified from staging test: kitchen mark-ready succeeds and duplicate ready is safe.

## Current delivery/collection flow

Verified from code: `BillingView.markDelivered` calls `POST /api/restaurant/orders/:id/deliver`.

Verified from code: dine-in orders require waiter, manager, owner, or admin and move `ready -> delivered`. Takeaway orders require cashier, manager, owner, or admin and move `ready -> collected`. The endpoint reloads and returns the refreshed order state.

Verified from staging test: waiter delivers dine-in, cashier collects takeaway, waiter takeaway collection is blocked, cross-tenant delivery is rejected.

## Current payment flow

Verified from code: `BillingView.markPaid` calls `POST /api/restaurant/orders/:id/payments` with a method and exact order amount.

Verified from code: cashier, manager, owner, and admin can pay; waiter and kitchen are blocked. Duplicate completed payment is blocked. Dine-in must be delivered before payment. Takeaway pay-first can be paid before kitchen work; takeaway pay-later must be collected first.

Verified from staging test: dine-in payment sequence, takeaway pay-first, takeaway pay-later, waiter/kitchen payment rejection, and duplicate payment rejection pass.

## Current frontend-to-backend API calls

- POS: `GET /restaurant/menu`, `GET /restaurant/tables`, `POST /restaurant/orders`, then `GET /restaurant/tables`.
- Kitchen: `GET /restaurant/kds`, `PATCH /restaurant/kds/:id/status`.
- Orders & Payments: `GET /restaurant/orders`, `GET /restaurant/tables`, `POST /restaurant/orders/:id/deliver`, `POST /restaurant/orders/:id/payments`.
- Floor: `GET /restaurant/tables`, `POST /restaurant/tables`, `PATCH /restaurant/tables/:id/status`.

## Exact live failure causes for Kitchen Ready and Payment

Kitchen Ready root cause: Verified from code and staging test. KDS list items displayed UUID fragments because the KDS payload exposed `orderId` but not a staff-facing order number. The ready action also needed idempotent handling and returned server state so stale UI retries did not become user-facing failure noise.

Payment root cause: Verified from code and staging test. The Orders list endpoint did not return a staff-facing display number, so UI rows fell back to UUID fragments. Payment also needed explicit service/payment rules: dine-in must be delivered before payment, takeaway pay-first may be paid before kitchen, takeaway pay-later must be collected first, and duplicate payment must remain blocked.

Live browser evidence classification: the user-reported deployed failures are Verified from browser/API response by report, while the precise causes above are Verified from code and Verified from staging test. Live logs were not used, so any deployment-specific runtime mismatch remains Assumption pending live logs.

## Current role restrictions

- POS create: waiter, manager, owner, admin; cashier can create takeaway only; legacy onboarded restaurant owner remains supported.
- Kitchen ready: kitchen, manager, owner, admin.
- Dine-in delivery: waiter, manager, owner, admin.
- Takeaway collection: cashier, manager, owner, admin.
- Payment: cashier, manager, owner, admin.
- Waiter and kitchen payment attempts remain blocked.

## Current order state model

The internal primary key remains the UUID `restaurant_orders.id`.

Phase 1 state is explicit:

- `order_type`: `dine_in` or `takeaway`.
- `service_status`: `pending`, `in_kitchen`, `ready`, `delivered`, `collected`, `closed`, or `cancelled`.
- `payment_status`: `unpaid`, `paid`, or `refunded`.
- `payment_timing`: `pay_before_service` or `pay_after_service`.
- `status`: retained as a legacy compatibility summary.

Visible order numbers are `#n`, scoped by business and calendar day.

## Proposed Phase 1 journey

Dine-in: POS -> Kitchen -> Ready -> Delivered -> Payment -> Closed/Table available.

Takeaway pay-first: POS -> Payment -> Kitchen -> Ready -> Collected -> Closed.

Takeaway pay-later: POS -> Kitchen -> Ready -> Collected -> Payment -> Closed.

Kitchen sees kitchen work only. Cashier sees collection/payment work. Waiter sees dine-in delivery/table work. Owner/manager/admin retain operational overview.
