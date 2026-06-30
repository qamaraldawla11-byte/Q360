# Restaurant POS Role Permission Fix

## Root Cause

Live POS order creation was rejected with `403 Forbidden` because some existing beta Restaurant business owners still have the legacy `users.role = user` value created during OTP signup. The Restaurant order route allowed `waiter`, `manager`, `owner`, and `admin`, but onboarding did not promote the first SME Restaurant user from the generic signup role to `owner`.

## Fix

`POST /api/restaurant/orders` now keeps the existing operational allow-list and adds one narrow compatibility path for legacy Restaurant owners:

- JWT tenant identity is still derived from the authenticated token.
- The compatibility lookup requires the authenticated `userId` and JWT `businessId` to match the same row in `users`.
- The row must be an onboarded SME Restaurant workspace with `primaryWorkspace = /app/restaurant`.
- Unknown roles, missing roles, kitchen users, and cross-tenant payloads remain rejected.

The intended POS creation roles are:

- `owner`
- `admin`
- `manager`
- `waiter`
- `cashier` for takeaway orders only
- legacy onboarded Restaurant owner rows with `role = user`

`cashier` remains blocked from dine-in table order creation. `kitchen` remains unable to create or pay orders.

## Frontend

The POS checkout toast now shows `You do not have permission to create orders` for HTTP 403 responses instead of the generic order-send failure.

## Regression Coverage

`backend/src/scripts/verify_restaurant_service_flow.ts` now verifies:

- legacy owner creates a POS order successfully;
- owner creates a POS order successfully;
- waiter creates a POS order successfully;
- cashier creates a takeaway order successfully;
- cashier dine-in order creation is rejected;
- kitchen create is rejected;
- unknown and missing roles are rejected;
- waiter, cashier, and legacy-user cross-tenant create attempts are rejected;
- existing lifecycle and payment role checks remain intact.

## Beta Data Remediation

No destructive data change is required for the compatibility path after deployment. For long-term cleanup, the exact safe remediation is to update only confirmed onboarded Restaurant business-owner rows from `role = user` to `role = owner`, scoped by the specific beta user email or user id and verified `business_id`.
