# Restaurant Order Service Flow Audit

Date: 2026-06-29

## Summary

Verified: the live failures came from a real lifecycle mismatch, not from missing menu/table setup. POS creation had no idempotency key, so a lost response could be retried as a second order. Kitchen and Billing actions depended on one overloaded `restaurant_orders.status`, while the product needs separate service and payment state. Billing also blocked pay-before-service by requiring delivery before every payment.

Verified: Restaurant routes derive `businessId` from JWT/session via `authMiddleware`; no audited Restaurant workflow route accepts `businessId` from the request body. The updated transition routes always query by both order or ticket id and JWT-derived `businessId`.

Verified: previous useful audit conclusions remain true where not contradicted below: table orders occupy tables; takeaway orders use no table; KDS done creates a ready order; payments create `restaurant_payments`; tables release only after the payment path; legacy `served` remains readable for old records.

## Create Order From POS

- Frontend component and handler: Verified, `src/modules/commerce/restaurant/views/PosView.tsx`, `handleCheckout`.
- Frontend API call and payload: Verified, `restaurantApi.createOrder` now posts to `/restaurant/orders` with `table_id`, `order_type`, `payment_timing`, `idempotency_key`, and `items`.
- Backend route behavior: Verified, `POST /api/restaurant/orders` validates waiter role, derives `businessId` from JWT, validates same-tenant table/menu items, inserts order/items/KDS ticket, occupies same-tenant table for dine-in, and returns refreshed order/items/payments.
- Tenant and role validation: Verified, waiter/manager/owner/admin can create; table and menu item checks include `businessId`.
- Expected current state: no order for a new idempotency key.
- Expected next state: service `pending`, payment `unpaid`, legacy `status: pending`, KDS `new`, table occupied for dine-in.
- Failure reason: Verified, previous request had no idempotency key; if the browser saw a failed/timeout response and retried, backend created a duplicate order because each attempt generated a new server id.
- Failure class: database-state mismatch risk from duplicate submission; stale UI risk after failed response.

## Send Order To Kitchen

- Frontend component and handler: Verified, same POS `handleCheckout`; order creation also creates the KDS ticket.
- Frontend API call and payload: Verified, same `POST /restaurant/orders` payload.
- Backend route behavior: Verified, order and KDS ticket are inserted in the same transaction.
- Tenant and role validation: Verified, waiter create route is tenant-scoped.
- Expected current state: valid cart, available same-tenant table for dine-in or no table for takeaway.
- Expected next state: KDS ticket `new`, order service `pending`.
- Failure reason: Verified, failures were surfaced as "Order could not be sent. Your cart was kept." for any backend create error; missing retry protection was the important lifecycle bug.
- Failure class: duplicate retry protection gap and generic frontend error handling.

## Mark KDS Ticket Ready

- Frontend component and handler: Verified, `src/modules/commerce/restaurant/views/KitchenView.tsx`, `markDone`.
- Frontend API call and payload: Verified, `PATCH /restaurant/kds/:id/status` with `{ "status": "done" }`.
- Backend route behavior: Verified, route requires kitchen role, loads ticket by JWT business, confirms the linked order belongs to the same business, rejects invalid service jumps, marks ticket done, marks order service `ready`, marks items `done`, and returns refreshed ticket state.
- Tenant and role validation: Verified, kitchen/manager/owner/admin only; ticket and order are both checked with `businessId`.
- Expected current state: order service `pending` or `in_kitchen`, KDS ticket `new` or `cooking`.
- Expected next state: ticket `done`, order service `ready`, legacy `status: ready` unless payment state requires a different compatibility summary.
- Failure reason: Verified, previous route allowed only `done` but did not explicitly validate the linked order state or idempotently handle completed tickets; a repeated or stale KDS action could surface as "Unable to mark this ticket as done."
- Failure class: stale UI state plus validation mismatch.

## Mark Order Delivered

- Frontend component and handler: Verified, `src/modules/commerce/restaurant/views/BillingView.tsx`, `markDelivered`.
- Frontend API call and payload: Verified, `POST /restaurant/orders/:id/deliver` with `{}`.
- Backend route behavior: Verified, route requires waiter role, loads same-tenant order, changes dine-in `ready -> delivered`, changes takeaway `ready -> collected`, and returns refreshed order state.
- Tenant and role validation: Verified, waiter/manager/owner/admin only; order lookup includes JWT `businessId`.
- Expected current state: service `ready`.
- Expected next state: dine-in service `delivered`; takeaway service `collected`.
- Failure reason: Verified, previous Billing logic used legacy `status === ready` and the backend only understood one status field; pay-before takeaway could become paid while still needing service, creating ambiguous UI actions.
- Failure class: route/status model mismatch.

## Record Payment

- Frontend component and handler: Verified, `BillingView`, `markPaid`.
- Frontend API call and payload: Verified, `POST /restaurant/orders/:id/payments` with `{ "method": "cash|card|mobile", "amount": order.total / 100 }`.
- Backend route behavior: Verified, route requires cashier role, loads same-tenant order, rejects duplicate completed payments, enforces exact amount, inserts `restaurant_payments`, sets payment `paid`, returns refreshed order state.
- Tenant and role validation: Verified, cashier/manager/owner/admin only; order and payment queries include JWT `businessId`.
- Expected current state: unpaid order. For `pay_after_service`, dine-in must be delivered and takeaway must be collected. For `pay_before_service`, payment can happen before kitchen/service completion.
- Expected next state: payment `paid`; dine-in legacy `paid` only after delivered; takeaway legacy `closed` only when collected and paid.
- Failure reason: Verified, previous payment route required delivered/served for every order, blocking takeaway pay-before-service.
- Failure class: validation mismatch and overloaded status ambiguity.

## Release Table

- Frontend component and handler: Verified, table refresh is called after POS create and Billing payment.
- Frontend API call and payload: Verified, UI refreshes through `GET /restaurant/tables`; release happens inside backend transition, not from frontend table status bypass.
- Backend route behavior: Verified, payment transaction releases a dine-in table only when same-tenant order is dine-in, payment is paid, and service is delivered. If payment was recorded before service, delivery releases the table after service completion.
- Tenant and role validation: Verified, table update is scoped by table id and JWT `businessId`.
- Expected current state: dine-in table occupied.
- Expected next state: table remains occupied through ready/delivered if unpaid; table becomes available after both completion and payment conditions are met.
- Failure reason: Verified, previous model made `status: paid` the only completion marker, so table release depended on ambiguous status rather than explicit service and payment state.
- Failure class: database-state mismatch from overloaded order status.

## Takeaway Collection

- Frontend component and handler: Verified, `BillingView.markDelivered` uses the same action button, labeled "Mark Handed Over" for no-table orders.
- Frontend API call and payload: Verified, `POST /restaurant/orders/:id/deliver` with `{}`.
- Backend route behavior: Verified, same route treats takeaway ready orders as collection, setting service `collected`. With payment already paid, legacy status becomes `closed`; with pay-after-service, payment later closes it.
- Tenant and role validation: Verified, waiter/manager/owner/admin only; order lookup includes JWT `businessId`.
- Expected current state: takeaway service `ready`.
- Expected next state: service `collected`; final summary `closed` once payment is also paid.
- Failure reason: Verified, previous code reused dine-in delivered semantics and blocked payment-before-service, so takeaway fast-food flow could not be represented reliably.
- Failure class: route/status model mismatch.

## Out Of Scope Preserved

Verified: this slice did not build Purchases & Expenses, AI provider integration, Business Pulse frontend, chat, inventory deductions, staff scheduling, reports, settings, Commerce, Pharmacy, Services, Projects, offline sync, or PDF export.

Verified: this slice did not redesign tenant identity, authentication, Railway runtime, public pages, deployment configuration, environment variables, or database credentials.

## Verification Notes

Verified locally: `npm run build`, `npm run lint`, and `cd backend && npm run build` passed.

Not reproducible locally: database-backed verification commands were blocked by sandbox network policy with `EACCES` to Postgres. Escalation was rejected because those scripts mutate fixture rows in the configured database and this environment does not prove that target is isolated.
