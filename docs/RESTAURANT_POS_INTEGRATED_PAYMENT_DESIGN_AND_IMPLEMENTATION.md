# Restaurant POS Integrated Payment Design and Implementation

## Scope

Implemented only the Restaurant POS pay-now takeaway flow. Existing dine-in, takeaway pay-later, collection-time payment, cancellation, Kitchen, receipts, refunds, split bills, discounts, inventory, staff, purchases, expenses, QR menu, delivery, AI/chat, tenant identity, authentication, staging guard, and existing audit behavior remain out of scope.

## Current POS flow

POS creates restaurant orders through `POST /api/restaurant/orders`. The backend resolves `businessId` from the JWT, prices items from menu rows, creates one order, creates order items, creates one Kitchen ticket, marks dine-in tables occupied, and returns the server order with a visible order number.

## Pay-now takeaway flow

Takeaway POS can call `POST /api/restaurant/orders/pay-now` with menu items, payment method, optional cash received, and an idempotency key. The backend creates the order, payment, and Kitchen ticket in one transaction and returns the refreshed order, safe payment summary, Kitchen ticket state, visible order number, and `sent_to_kitchen`.

## Pay-later takeaway flow

Takeaway Pay later continues to use `POST /api/restaurant/orders` with `pay_after_service`. It creates an unpaid order and Kitchen ticket. Payment remains available later in Orders & Payments only after the valid collection stage.

## Dine-in restriction

The POS forces dine-in orders to Pay later. The backend also rejects crafted dine-in pay-now requests through both the integrated pay-now endpoint and the standard order creation endpoint when `payment_timing` is `pay_before_service`.

## Transaction and idempotency design

Integrated pay-now uses the existing `(business_id, idempotency_key)` unique index on `restaurant_orders`. A duplicate submit with the same key returns the existing completed pay-now result instead of creating another order, payment, or Kitchen ticket. The transaction canonicalizes menu items, assigns the daily visible order number under the existing advisory lock, inserts the order, inserts order items, inserts one completed payment, and inserts one Kitchen ticket.

## Role and tenant enforcement

All writes use the JWT-derived `businessId`; frontend tenant or business input is ignored. The integrated payment route uses existing payment roles, so waiters and Kitchen users cannot record payment. Cross-tenant menu items are rejected because menu rows are looked up under the JWT tenant. Kitchen payload helpers still omit payment status, payments, and totals.

## Cash received and change behavior

POS shows Cash received only for Cash pay-now. It calculates Change due and blocks submit when received cash is below the order total. The backend independently validates cash received, supports exact cash, stores the payment amount as the order total, and returns cash received/change due in the payment summary without adding new payment table columns.

## API and UI changes

Added `POST /api/restaurant/orders/pay-now` and `restaurantApi.createPayNowTakeawayOrder`. POS now shows Pay now/Pay later only for takeaway, forces Pay later for table orders, shows Cash/Card/Manual for pay-now, changes the submit label to Pay & Send to Kitchen, clears the cart on success, displays the visible order number, and refreshes POS menu/table state.

## Files changed

- `backend/src/routes/restaurant.ts`
- `backend/src/scripts/verify_restaurant_service_flow.ts`
- `src/api/restaurant.api.ts`
- `src/modules/commerce/restaurant/views/PosView.tsx`
- `docs/RESTAURANT_POS_INTEGRATED_PAYMENT_DESIGN_AND_IMPLEMENTATION.md`

## Tests added

Updated `verify:restaurant-service-flow` for cashier takeaway cash/card/manual pay-now, cash change and short-cash rejection, exact one order/payment/Kitchen ticket per submit, duplicate retry protection, takeaway pay-later staying unpaid, dine-in pay-now rejection, waiter/Kitchen payment denial, cross-tenant rejection, visible order number, cancellation, and Kitchen-ready regression coverage.

## Commands and results

Confirmed `backend/.env.staging` exists without printing environment values. Ran the requested checks with `DOTENV_CONFIG_PATH=.env.staging`:

- `cd backend; npm run verify:tenant-identity` - passed after approved staging database access.
- `cd backend; npm run verify:restaurant` - passed.
- `cd backend; npm run verify:restaurant-service-flow` - passed after fixing verifier assertions for the new integrated orders.
- `npm run build` - passed.
- `npm run lint` - passed.
- `cd backend; npm run build` - passed.

## Remaining limitations

Integrated pay-now does not add receipt, refund, discount, split-bill, legal invoice, or payment-provider processing. Cash received and change due are returned for cashier confirmation but not persisted as separate payment columns.

## Next safe slice

Orders & Payments can later show a clearer distinction between already-paid pay-now takeaway orders and pay-later orders awaiting collection-time payment.
