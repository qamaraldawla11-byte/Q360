# Restaurant Authorization and Lifecycle Refactor

## Why this refactor was needed

Live Restaurant validation showed the same narrow legacy owner compatibility check being repeated across operational endpoints: order creation, pay-now takeaway, Kitchen Ready, delivery, collection, payment, and cancellation. Repeating the check made future changes risky because one endpoint could drift from the others.

## Previous duplicated permission pattern

`backend/src/routes/restaurant.ts` previously kept Restaurant role lists and legacy `role=user` compatibility logic inside the route file. Each handler combined route parsing with authorization and lifecycle checks, so the same conditions had to be copied for separate actions.

## New centralized authorization structure

`backend/src/services/restaurantDomain.ts` now owns the backend-internal Restaurant rules:

- `isLegacyRestaurantOwnerCompatible(actor)`
- `canPerformRestaurantAction(actor, action, order?)`
- `validateRestaurantOrderTransition(order, action, completedPayment?)`
- `getRestaurantNextAllowedActions(actor, order)`

Route handlers still perform request validation, JWT actor extraction, tenant-scoped lookups, database mutation, tenant-scoped audit logging, and existing-compatible responses.

## Legacy owner compatibility boundary

A `role=user` actor is treated as Restaurant owner-compatible only when all of these are true:

- JWT role is `user`.
- JWT `userId` matches the loaded user row.
- JWT-derived `businessId` matches the loaded user row.
- User row role is `user`.
- `userType` is `sme`.
- `segment` is `restaurant`.
- `onboardingCompleted` is `true`.
- `primaryWorkspace` is `/app/restaurant`.

Generic `role=user` actors remain blocked because they have no matching compatible user row. Cross-tenant legacy attempts remain blocked because the compatible row must match the JWT-derived tenant.

## Role/action matrix

| Action | Owner | Admin | Manager | Waiter | Cashier | Kitchen | Generic user | Legacy owner-compatible |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Create dine-in order | Allow | Allow | Allow | Allow | Deny | Deny | Deny | Allow |
| Create takeaway order | Allow | Allow | Allow | Allow | Allow | Deny | Deny | Allow |
| Pay-now takeaway order | Allow | Allow | Allow | Deny | Allow | Deny | Deny | Allow |
| Mark Ready | Allow | Allow | Allow | Deny | Deny | Allow | Deny | Allow |
| Mark Delivered | Allow | Allow | Allow | Allow | Deny | Deny | Deny | Allow |
| Mark Collected | Allow | Allow | Allow | Deny | Allow | Deny | Deny | Allow |
| Record Payment | Allow | Allow | Allow | Deny | Allow | Deny | Deny | Allow |
| Cancel dine-in pending order | Allow | Allow | Allow | Own pending only | Deny | Deny | Deny | Allow |
| Cancel takeaway pending order | Allow | Allow | Allow | Deny | Allow | Deny | Deny | Allow |

## Lifecycle transition matrix

| Action | Valid state | Blocked state |
| --- | --- | --- |
| Mark Ready | `pending` or `in_kitchen` | `ready`, `delivered`, `collected`, `closed`, `paid`, `cancelled` |
| Mark Delivered | Ready dine-in, unpaid | Non-ready, takeaway, paid-before-delivery, cancelled |
| Mark Collected | Ready takeaway | Non-ready, dine-in, cancelled |
| Record Payment | Pay-before takeaway before service, collected pay-after takeaway, delivered dine-in | Already paid, cancelled, pay-after before service completion |
| Cancel Order | Unpaid, not closed, not cancelled, role-specific boundary | Paid, closed, cancelled |

## Behavior intentionally unchanged

- Public API paths and response shapes are unchanged.
- Frontend-provided business IDs still do not grant access.
- Backend menu pricing remains canonical.
- Short cash is rejected.
- Payment idempotency and duplicate payment blocking remain in place.
- Duplicate pay-now retry still returns the original successful result where supported.
- KDS payloads still omit payment details.
- Cancellation remains a state transition and never deletes the order.
- Cancelled dine-in orders release their table.
- Paid dine-in orders release their table after valid payment.

## Prepared for future Live Orders

`getRestaurantNextAllowedActions(actor, order)` provides an internal next-action model for future Live Orders work. It is tested by the staging verifier but is not exposed through a new public API.

## Postponed

This refactor does not build Live Orders, QR ordering, refunds, discounts, receipts, delivery expansion, inventory expansion, or payments expansion.

## Tenant isolation

JWT-derived `businessId` remains authoritative. Route handlers continue to load Restaurant resources with `business_id = c.get('businessId')`, audit events use the same tenant context, and the legacy owner compatibility check only loads a user row matching both JWT `userId` and JWT-derived `businessId`.

## Running the staging verifier

Run only against isolated staging:

```powershell
cd backend
$env:DOTENV_CONFIG_PATH='.env.staging'

npm run verify:tenant-identity
npm run verify:restaurant
npm run verify:business-pulse
npm run verify:restaurant-setup
npm run verify:restaurant-service-flow

npm run build

cd ..
npm run lint
npm run build
```
