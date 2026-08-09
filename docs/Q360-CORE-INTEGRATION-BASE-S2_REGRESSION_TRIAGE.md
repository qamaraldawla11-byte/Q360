# Q360-CORE-INTEGRATION-BASE-S2 — Regression Triage

## Scope

This document records the S2 verification correction and the three protected regressions observed during S2 verification. No product code outside `backend/src/scripts/verify_customers.ts` was modified for S2.

---

## 1. Corrected Assertion — Customers Shared-Module Listing

### File

`backend/src/scripts/verify_customers.ts`

### Old assertion (lines 402–407)

```typescript
const sharedList = await requestWithToken<{ modules: { moduleKey: string; enabled: boolean }[] }>(ownerAToken, '/api/business/modules?workspace=shared');
assertStatus(sharedList.response.status, 200, 'Shared module listing must succeed');
const sharedKeys = sharedList.body.modules.map(module => module.moduleKey);
if (sharedKeys.filter(key => key === 'customers').length !== 1 || sharedKeys.filter(key => key === 'quotes').length !== 1 || sharedKeys.length !== 2) {
    throw new Error(`Shared listing must contain customers and quotes exactly once; got ${sharedKeys.join(',')}`);
}
```

### New assertion

```typescript
const sharedList = await requestWithToken<{ modules: { moduleKey: string; enabled: boolean }[] }>(ownerAToken, '/api/business/modules?workspace=shared');
assertStatus(sharedList.response.status, 200, 'Shared module listing must succeed');
const sharedKeys = sharedList.body.modules.map(module => module.moduleKey);
const expectedSharedKeys = ['customers', 'quotes', 'products'];
const sharedKeyCounts = new Map<string, number>();
for (const key of sharedKeys) {
    sharedKeyCounts.set(key, (sharedKeyCounts.get(key) ?? 0) + 1);
}
const missing = expectedSharedKeys.filter(key => sharedKeyCounts.get(key) !== 1);
const duplicates = [...sharedKeyCounts.entries()].filter(([, count]) => count > 1).map(([key]) => key);
const unexpected = sharedKeys.filter(key => !expectedSharedKeys.includes(key));
if (missing.length > 0 || duplicates.length > 0 || unexpected.length > 0) {
    throw new Error(`Shared listing must contain exactly customers, quotes, products once each; got [${sharedKeys.join(',')}]; missing=[${missing.join(',')}], duplicates=[${duplicates.join(',')}], unexpected=[${unexpected.join(',')}]`);
}
```

### Verification behavior

- All three expected keys (`customers`, `quotes`, `products`) must be present.
- Each expected key must appear exactly once (`count === 1`).
- Any unexpected key or any duplicate (expected or otherwise) triggers failure.
- Failure output lists the actual keys, missing keys, duplicates, and unexpected keys.

### Result

`npm run verify:customers` passed after the correction.

---

## 2. Authorized Verification Results

| Command | Exit code | Result |
|---|---|---|
| `npm run build` (backend) | 0 | PASS |
| `npm run verify:customers` | 0 | PASS |
| `npm run verify:quotes` | 0 | PASS |
| `npm run verify:products` | 0 | PASS |
| `npm run verify:business-modules` | 0 | PASS |
| `npm run build` (root) | 0 | PASS |

All commands were executed against a disposable localhost PostgreSQL 18 cluster on port 5434. The existing migration journal `0000`–`0003` was applied with `npx drizzle-kit migrate`. No `db:push` and no new migrations were generated.

---

## 3. Protected Failure Triage

The three failures below were **not fixed**. The relevant product files (`backend/src/routes/restaurant.ts`, `backend/src/services/restaurantDomain.ts`, `backend/src/middleware/auth.ts`, `backend/src/services/businessOwnership.ts`) and the three verification scripts are byte-identical between S2 HEAD and `origin/main`, so the failures pre-exist the S1/S2 integration.

### A. `verify:restaurant`

**Observation:** `waiterPaymentStatus` and `kitchenPaymentStatus` were `409`; the script expected `403`.

**Analysis:**

- Route: `POST /api/restaurant/orders/:id/payments` (`backend/src/routes/restaurant.ts:2852`).
- The route first calls `canPerformRestaurantAction(actor, 'record_payment')`, which allows only `cashier`, `manager`, `owner`, `admin`, or legacy owner (`backend/src/services/restaurantDomain.ts:182`).
- The verification fixture creates the test user with `role = 'admin'` in the `users` table (`backend/src/scripts/verify_restaurant_core.ts:125`).
- `authMiddleware` resolves the effective role via `resolveEffectiveBusinessRole`, using the database role (`admin`) instead of the JWT-claimed `waiter`/`kitchen` role (`backend/src/middleware/auth.ts:70–95` and `backend/src/services/businessOwnership.ts:21`).
- Because the effective role is `admin`, authorization passes and the request reaches the business-state validation, which returns `409` (`Order must be delivered before payment`).

**Classification:** The expectation of `403` is stale/fixture-defective, not a product authorization defect. The product behavior is consistent: DB role overrides token claim, and the payment route validates state after authorization.

**Ownership:** Restaurant RBAC / verification-fixture milestone.

### B. `verify:restaurant-service-flow`

**Observation:** Waiter payment after delivery returned `201`; the script expected rejection (`403`).

**Analysis:**

- Route: `POST /api/restaurant/orders/:id/payments` (`backend/src/routes/restaurant.ts:2852`).
- Roles tested: `waiter` and `kitchen` in the JWT, but the fixture DB user is `admin` (`backend/src/scripts/verify_restaurant_service_flow.ts` fixtures).
- Same effective-role resolution path as Failure A: DB `admin` overrides token claim, so `canPerformRestaurantAction(actor, 'record_payment')` returns `true`.
- After delivery, the order is in a payable state, so the payment succeeds (`201`) instead of being rejected for role.

**Classification:** Pre-existing fixture defect. The script expects role-based rejection, but the fixture does not create users with the claimed roles.

**Ownership:** Restaurant service-flow / RBAC milestone.

### C. `verify:business-pulse`

**Observation:** Manager Q draft approval returned `200`; the script expected `403`.

**Analysis:**

- Route: `POST /api/restaurant/business-pulse/drafts/:id/decision` (`backend/src/routes/restaurant.ts:1419`).
- Authorization: `canReviewQDraft(actor)` requires `owner`, `admin`, or legacy owner (`backend/src/routes/restaurant.ts:848`).
- Fixture DB role: `admin` (`backend/src/scripts/verify_business_pulse_snapshot.ts:168`).
- JWT claimed role: `manager` (`backend/src/scripts/verify_business_pulse_snapshot.ts:416`).
- Effective-role resolution uses the DB `admin` role, so `canReviewQDraft` passes and approval returns `200`.

**Classification:** Fixture defect, not a product defect. The DB role correctly overrides the token claim per the current effective-role implementation.

**Ownership:** Business Pulse / role-resolution fixture milestone.

---

## 4. Protected-Area Proof

No changes were made to:

- Customers product behavior (only the verification assertion was updated).
- Quotes safety/lifecycle.
- Products backend or frontend.
- Migrations `0000`–`0003`.
- Module entitlement implementation (`backend/src/services/restaurantModulePolicies.ts`, `backend/src/services/businessModules.ts`).
- OTP/JWT/tenant identity (`backend/src/middleware/auth.ts`, `backend/src/services/businessOwnership.ts`).
- Restaurant routes or domain logic (`backend/src/routes/restaurant.ts`, `backend/src/services/restaurantDomain.ts`).
- Payments or KDS logic.
- Business Pulse implementation.
- Railway/Vercel/Supabase configuration.
- Q Brain integration files.
- Inventory implementation.

---

## 5. Disposal

The disposable PostgreSQL cluster was stopped and removed, and the temporary credentials file was deleted after verification completed. No cloud, staging, or production databases were accessed.
