# Restaurant Phase 1 Order Journey Implementation

## Scope

Implemented Phase 1 order journey hardening for Restaurant POS, Kitchen, delivery/collection, payment, visible order numbers, cash change behavior, and Restaurant UI wording from Billing to Orders & Payments.

## Live failure root causes

Kitchen Ready: KDS rows displayed UUID-derived fragments and did not expose the tenant-scoped visible order number. The ready flow now returns refreshed server state and duplicate ready calls are idempotent.

Payment: Orders list rows did not expose visible order numbers, so staff saw UUID fragments. Payment rules also needed explicit service/payment separation for dine-in, takeaway pay-first, and takeaway pay-later.

## Order state model

UUID remains the internal primary key. Restaurant rows now use explicit `order_type`, `service_status`, `payment_status`, and `payment_timing`; legacy `status` remains a compatibility summary.

Dine-in must be delivered before payment. Takeaway pay-first can be paid before kitchen/service completion. Takeaway pay-later must be collected before payment.

## Visible order-number design

Added nullable `visible_order_number` and `order_number_date` to `restaurant_orders`.

Display format is `#1`, `#2`, `#3`. Numbering is scoped by `business_id` and UTC calendar date string. A partial unique index enforces `(business_id, order_number_date, visible_order_number)` uniqueness when present.

Order creation takes a PostgreSQL transaction advisory lock on `(businessId, orderNumberDate)` before reading max number and inserting, preventing concurrent duplicate visible numbers. Historical rows without numbers display `Order pending number`.

## Role and tenant enforcement

All Restaurant transitions derive tenant from JWT context and query by `businessId`.

Kitchen can mark valid tickets ready. Waiter can deliver dine-in. Cashier can collect takeaway and record payments. Manager, owner, and admin retain broader operational access. Waiter and kitchen payment attempts remain blocked.

## Cash payment and change behavior

Cash payment UI shows the total, accepts cash received, calculates local change due, supports exact payment, and disables confirmation when cash received is below total.

Card, manual, and mobile payment methods do not require cash received input.

## UI wording changes

Restaurant visible wording now uses `Orders & Payments` instead of `Billing` in the app title label, restaurant manifest navigation, and the order/payment page heading.

## Files changed

- `backend/src/db/schema.ts`
- `backend/src/db/restaurantServiceFlowMigration.ts`
- `backend/src/routes/restaurant.ts`
- `backend/src/scripts/verify_restaurant_service_flow.ts`
- `src/api/restaurant.api.ts`
- `src/App.tsx`
- `src/modules/commerce/restaurant/manifest.ts`
- `src/modules/commerce/restaurant/views/BillingView.tsx`
- `src/modules/commerce/restaurant/views/KitchenView.tsx`
- `src/modules/commerce/restaurant/views/PosView.tsx`
- `docs/RESTAURANT_PHASE_1_ORDER_JOURNEY_AUDIT.md`
- `docs/RESTAURANT_PHASE_1_ORDER_JOURNEY_IMPLEMENTATION.md`

## Tests added

Expanded `backend/src/scripts/verify_restaurant_service_flow.ts` for kitchen ready success, duplicate ready, kitchen cannot pay, waiter dine-in delivery, cashier takeaway collection, dine-in payment, takeaway pay-first, takeaway pay-later, duplicate payment rejection, cross-tenant transition rejection, sequential visible daily numbers, cross-tenant number isolation, concurrent number uniqueness, and KDS payment-detail hiding.

Frontend build coverage verifies the cash change UI TypeScript path.

## Commands and results

Staging guard markers confirmed from `backend/.env.staging`: `Q360_DATABASE_ENV=staging` and `Q360_DATABASE_NAME=q360-staging`.

Passed: `cd backend; DOTENV_CONFIG_PATH=.env.staging npm run db:push`.

Passed: `cd backend; DOTENV_CONFIG_PATH=.env.staging npm run verify:tenant-identity`.

Passed: `cd backend; DOTENV_CONFIG_PATH=.env.staging npm run verify:restaurant`.

Passed after verifier and concurrency fixes: `cd backend; DOTENV_CONFIG_PATH=.env.staging npm run verify:restaurant-service-flow`.

Passed: `npm run build`.

Passed: `npm run lint`.

Passed: `cd backend && npm run build`.

## Remaining limitations

No inventory deductions, purchases/expenses, staff scheduling, reports, discounts, refunds, split bills, legal invoice numbering, receipt printing, online ordering, delivery integrations, offline sync, AI/chat, or new workspace modules were implemented.

No browser/live-beta test was run, per safety instruction.

## Next safe slice

Deploy the staging-verified backend and frontend changes to the intended environment, then run a single controlled browser validation for dine-in, takeaway pay-first, and takeaway pay-later using staging or approved beta data only.
