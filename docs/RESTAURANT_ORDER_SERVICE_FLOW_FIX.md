# Restaurant Order Service Flow Fix

## Root cause

Restaurant orders used one legacy `status` value for kitchen/service/payment/closure. That made pay-before-service impossible, made takeaway collection ambiguous, and made table release depend on a payment-like status instead of explicit service and payment conditions. POS also lacked an idempotency key, so a failed browser submission could be retried as a duplicate order.

## Dine-in workflow

Implemented explicit `orderType: dine_in`, `serviceStatus`, `paymentStatus`, and `paymentTiming`.

Expected path: table available -> create pending order -> table occupied -> KDS ready -> waiter delivered -> cashier paid -> table available.

Dine-in table release now requires both service delivery and payment. If payment happens before service for a dine-in order, the table remains occupied until delivery.

## Takeaway workflow

Implemented explicit `orderType: takeaway` with no table requirement.

Pay-before-service path: no table -> create pending order -> cashier payment paid -> KDS ready -> waiter handed over/collected -> legacy summary closed.

Pay-after-service path: no table -> create pending order -> KDS ready -> collected -> cashier payment paid -> legacy summary closed.

## Payment timing rules

`pay_before_service` allows cashier payment before kitchen/service completion, without removing the order from kitchen flow.

`pay_after_service` requires dine-in delivery or takeaway collection before cashier payment.

Duplicate completed payments are still rejected.

## Status transition rules

Kitchen can move only pending or in-kitchen service to ready.

Waiter/service can move only ready dine-in orders to delivered and ready takeaway orders to collected.

Cashier payment does not create service completion. It only updates payment state and derives the legacy summary status.

Invalid jumps are rejected with HTTP 409.

## Tenant and role enforcement

Every route derives `businessId` from the JWT/session context. Order, ticket, payment, and table transitions query by JWT-derived `businessId`.

Waiter roles can create orders and mark service delivery/collection. Kitchen roles can mark KDS tickets ready. Cashier roles can record payments. Kitchen and waiter roles cannot record payments.

## Files changed

- `backend/src/db/schema.ts`
- `backend/src/db/restaurantServiceFlowMigration.ts`
- `backend/src/routes/restaurant.ts`
- `backend/src/scripts/verify_restaurant_service_flow.ts`
- `backend/package.json`
- `src/api/restaurant.api.ts`
- `src/modules/commerce/restaurant/views/PosView.tsx`
- `src/modules/commerce/restaurant/views/BillingView.tsx`
- `docs/RESTAURANT_ORDER_SERVICE_FLOW_AUDIT.md`
- `docs/RESTAURANT_ORDER_SERVICE_FLOW_FIX.md`

## Tests added

Added `backend/src/scripts/verify_restaurant_service_flow.ts` and `npm run verify:restaurant-service-flow`.

The script covers dine-in lifecycle, takeaway pay-before-service, takeaway pay-after-service, invalid transition rejection, cross-tenant rejection, duplicate create retry protection, table release rules, waiter/kitchen payment rejection, and cashier tenant scope.

## Commands and results

Passed: `npm run build`

Passed: `npm run lint`

Passed: `cd backend && npm run build`

Blocked locally: `cd backend && npm run verify:tenant-identity`, `verify:restaurant`, `verify:business-pulse`, `verify:restaurant-setup`, and `verify:restaurant-service-flow` all require Postgres access. Sandboxed runs failed with `EACCES`; escalation was rejected because the configured database could not be proven isolated and the verification scripts mutate fixture data.

## Remaining limitations

Legacy `restaurant_orders.status` remains as a compatibility summary for existing UI and reports. New rows receive explicit service/payment/order-type/payment-timing fields; old rows are normalized at read time rather than rewritten in place.

No inventory deduction, receipt/PDF, split bills, refunds, offline queue, staff scheduling, reports, settings, or payment hardware integration was added.

## Next safe slice

Run the database-backed verification suite against an explicitly isolated staging/test database, then deploy the service-flow schema columns and retry live browser POS -> Kitchen -> Billing checks for one dine-in order and two takeaway timing variants.
