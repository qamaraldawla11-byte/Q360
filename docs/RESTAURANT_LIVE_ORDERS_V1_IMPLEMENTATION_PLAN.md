# Restaurant Live Orders V1 Implementation Plan

## Goal

Create one operational Live Orders screen for one-worker restaurants that shows the current active service queue and exposes the next safe action for each order by role.

This is a future implementation plan only. V1 should reuse existing order states, backend transition logic, permissions, and API actions wherever possible. It should not create a separate workflow engine.

## Target user

Primary user: a one-worker restaurant operator who moves between POS, kitchen readiness, collection/delivery, and payment without wanting to jump across Kitchen and Orders & Payments screens.

Secondary users:

- Owner/manager: needs an operational overview of active orders and allowed actions.
- Waiter: needs service actions for dine-in orders without cashier-only payment controls.
- Cashier: needs takeaway collection/payment actions without kitchen-only readiness controls.
- Kitchen: can mark orders ready but must not see payment details.

## Current reusable foundations

Reusable frontend foundations:

- `src/api/restaurant.api.ts` already exposes `getOrders(active)`, `updateKdsStatus`, `markDelivered`, and `completePayment`.
- `src/modules/commerce/restaurant/views/KitchenView.tsx` already renders active KDS tickets and uses `updateKdsStatus(ticketId, 'done')` for Mark Ready.
- `src/modules/commerce/restaurant/views/BillingView.tsx` already loads orders/tables, calculates payment eligibility, marks delivered/collected through `markDelivered`, and records payment through `completePayment`.
- `src/modules/commerce/restaurant/manifest.ts` and `src/views/routes.tsx` are the likely places to add a Live Orders navigation item and route later.

Reusable backend foundations:

- `backend/src/services/restaurantDomain.ts` contains action and transition rules.
- `backend/src/routes/restaurant.ts` already exposes active order listing, KDS status update, delivery/collection action, payment action, and cancellation action.
- `GET /api/restaurant/orders?status=active` already returns today's active orders with items and payments.
- `GET /api/restaurant/kds` already returns Kitchen-safe active ticket payloads without payment details.
- `authMiddleware` derives `businessId` from JWT and rejects invalid workspace-route tenant identity.

## Active queue rules

The Live Orders V1 active queue should show orders that require operational attention and hide completed terminal states.

Example queue behavior:

- Pending order -> Mark Ready.
- Ready takeaway -> Mark Collected.
- Ready dine-in -> Mark Delivered.
- Collected/delivered unpaid -> Take Payment.
- Paid, closed, cancelled -> hidden from active queue.

State rules:

- Include `pending`, `in_kitchen`, `ready`, `delivered`, `served`, and `collected` only when they still need service/payment attention.
- Hide paid, closed, and cancelled orders from the default active queue.
- Treat dine-in `delivered` and takeaway `collected` as payment-needed only when `paymentStatus === 'unpaid'`.
- Pay-now takeaway should remain visible through kitchen readiness and collection, then disappear after collected/closed according to existing backend state behavior.
- Use existing `orderType`, `serviceStatus`, `paymentStatus`, and `paymentTiming`; do not invent a parallel status model.

## Order action rules

V1 must call existing APIs and let the backend enforce transitions.

- Pending/in-kitchen order: Mark Ready through the existing KDS status path if a ticket id is available.
- Ready takeaway: Mark Collected through `restaurantApi.markDelivered(order.id)`, which maps takeaway to collection server-side.
- Ready dine-in: Mark Delivered through `restaurantApi.markDelivered(order.id)`.
- Collected takeaway unpaid: Take Payment through `restaurantApi.completePayment(order.id, payload)`.
- Delivered dine-in unpaid: Take Payment through `restaurantApi.completePayment(order.id, payload)`.
- Paid, closed, cancelled: no action in active queue.

Do not duplicate backend transition logic. Frontend action visibility can mirror known rules for UX, but backend remains authoritative.

## Product flow

1. User opens Live Orders.
2. Screen loads active orders and, if needed for pending tickets, active KDS tickets.
3. Orders appear as a single queue grouped or sorted by urgency: pending/in kitchen first, ready next, payment-needed next, oldest first inside each group.
4. Each row/card shows order number, table/takeaway label, age, item summary, service state, and the next role-allowed action.
5. User taps one action.
6. Button enters pending state for that order only.
7. On success, the order is updated in place or removed if it no longer belongs in the active queue.
8. On failure, show a concise error and refresh active data from the server.

## Role behavior

Kitchen:

- Can see kitchen-safe pending/in-kitchen/ready operational information.
- Can mark pending/in-kitchen orders ready.
- Must not see payment details, totals, payment controls, or payment status beyond what is needed for kitchen work.

Waiter:

- Can see relevant dine-in service orders.
- Can mark ready dine-in orders delivered when backend permits.
- Must not receive cashier-only payment actions.

Cashier:

- Can see takeaway operational/payment queue.
- Can mark ready takeaway orders collected when backend permits.
- Can take payment when backend permits.
- Should not receive kitchen-only Mark Ready actions unless the existing backend role rules allow it.

Owner/manager/admin:

- Can see the relevant operational overview.
- Can access combined next actions allowed by current backend permissions.

Legacy owner-compatible user:

- Preserve existing compatibility rules in `restaurantDomain.ts`.

## API reuse and possible additions

Prefer existing APIs:

- `GET /api/restaurant/orders?status=active`
- `GET /api/restaurant/kds`
- `PATCH /api/restaurant/kds/:id/status`
- `POST /api/restaurant/orders/:id/deliver`
- `POST /api/restaurant/orders/:id/payments`

Possible additions only if existing APIs cannot safely support the screen:

- A tenant-scoped `GET /api/restaurant/live-orders` endpoint that returns active orders plus each order's KDS ticket id and a role-filtered next action list.
- A lightweight `GET /api/restaurant/live-orders/changes?since=...` endpoint only if measurement shows polling the full queue is too expensive.

Recommended V1 stance:

- Start by reusing existing APIs if the UI can join active orders and KDS tickets safely client-side.
- Add a backend live-orders read endpoint only if missing ticket ids, role-filtered actions, or payment-hidden kitchen payloads make client-side composition unsafe or too expensive.

## Frontend impact

Files likely to change later:

- Add `src/modules/commerce/restaurant/views/LiveOrdersView.tsx`.
- Update `src/views/routes.tsx` to lazy-load and route the screen.
- Update `src/modules/commerce/restaurant/manifest.ts` to add a Live Orders navigation item.
- Extend `src/api/restaurant.api.ts` only if a new live-orders endpoint is added or if KDS/order types need a shared combined type.
- Reuse action and payment UI patterns from `BillingView.tsx` and readiness patterns from `KitchenView.tsx`.

UI behavior:

- Use one dense operational screen, not a landing page.
- Show loading state for first load and per-order action pending state.
- Keep error state recoverable with retry/refresh.
- Avoid exposing payment UI to kitchen role.

## Database impact

Preferred V1 database impact: none.

The current tables already contain the needed data:

- `restaurant_orders`
- `restaurant_order_items`
- `kds_tickets`
- `restaurant_payments`
- `restaurant_tables`

Potential future database/index work should be based on measured query performance, not required for V1 planning.

## Tenant and security requirements

- All data must remain scoped by JWT-derived `businessId` on the backend.
- Do not accept business id from the client for Live Orders queries or actions.
- Reuse `authMiddleware` and `canPerformRestaurantAction`.
- Do not duplicate permission decisions only in the frontend.
- Kitchen payload must not include payment details, payments, totals, or cashier-only actions.
- Waiter role must not receive cashier-only payment actions.
- Cashier role must not receive kitchen-only actions unless backend permissions explicitly allow it.
- Owner/manager/admin can receive the relevant operational overview according to existing permissions.

## Performance considerations

Verified current constraints:

- Kitchen currently polls every 5 seconds.
- `GET /restaurant/kds` has N+1 query behavior.
- `GET /restaurant/orders?status=active` batches order items and payments more efficiently than KDS ticket hydration.

V1 refresh approach:

- Load immediately on mount.
- Refresh on page focus and after every successful action.
- Use a modest polling interval only while the screen is visible.
- Avoid polling multiple endpoints at high frequency if one endpoint can safely provide the queue.
- Consider short burst refresh after POS creates an order, using same-tab navigation state or a browser broadcast event, before adding server push.
- Do not over-poll just to mask missing invalidation.

Needs measurement first:

- Whether V1 should use existing `orders?status=active` plus `kds`, or a single optimized live-orders endpoint.
- Whether a 5 second interval is acceptable for Live Orders, or whether focus/action-triggered refresh plus shorter temporary polling is better.

## Empty, loading, and error states

Loading:

- Show skeleton or compact loading rows while fetching initial active queue.
- Keep existing data visible during background refresh.

Empty:

- Show a calm empty state when no active orders require action.
- Do not show paid/closed/cancelled orders in the active queue just to fill space.

Error:

- Show a concise error message with retry.
- For action errors, keep the order visible and refresh from the server.
- If the backend rejects an action because state changed, reload and show the current authoritative state.

## What V1 excludes

- No separate workflow engine.
- No duplicated backend transition logic.
- No new payment provider integration.
- No database schema changes unless later proven necessary.
- No server push/WebSocket requirement for V1.
- No kitchen display replacement unless explicitly chosen after V1 validation.
- No historical reporting or analytics.
- No cross-tenant overview.
- No staging/live data mutation during planning.

## Acceptance criteria

- Live Orders shows active operational orders for the current tenant only.
- Pending/in-kitchen orders can be marked ready by roles allowed by the backend.
- Ready takeaway orders can be marked collected by roles allowed by the backend.
- Ready dine-in orders can be marked delivered by roles allowed by the backend.
- Collected/delivered unpaid orders can be paid by roles allowed by the backend.
- Paid, closed, and cancelled orders are hidden from the active queue.
- Kitchen role does not see payment details or payment actions.
- Waiter role does not see cashier-only actions.
- Owner/manager/admin receive an appropriate operational overview.
- Existing backend APIs and transition validation remain authoritative.
- V1 works without database changes unless later measurement proves otherwise.
- Refresh does not create excessive polling and does not leave stale UI after actions.

## Testing plan

Read-only/planning test expectations for future implementation:

- Unit or component tests for action visibility by order state and role.
- Backend tests only if a new live-orders endpoint is added.
- Permission regression coverage for kitchen payment hiding and waiter/cashier action separation.
- Tenant-scope test confirming users cannot see another business's queue.
- Manual flow checks for takeaway pay-later, takeaway pay-now, and dine-in workflows.
- Build and lint after implementation.

Do not run destructive verification scripts against staging/live data.

## Smallest implementation sequence

1. Add a `LiveOrdersView` that reads active orders and active KDS tickets with existing APIs.
2. Map KDS ticket ids to pending/in-kitchen orders for Mark Ready.
3. Render the active queue with one next action per order based on existing state fields and current role.
4. Wire Mark Ready, Mark Collected/Delivered, and Take Payment to existing API methods.
5. Refresh after successful actions and on focus; keep polling modest while visible.
6. Add route and manifest entry.
7. Verify role hiding for kitchen/waiter/cashier/manager/owner/admin.
8. Measure request count and latency; only then decide whether a single optimized live-orders endpoint is necessary.
