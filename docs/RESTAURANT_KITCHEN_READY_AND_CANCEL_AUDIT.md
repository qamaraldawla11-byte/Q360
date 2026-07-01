# Restaurant Kitchen Ready And Cancel Audit

Date: 2026-07-01

## KitchenView action handler

Verified from code: `src/modules/commerce/restaurant/views/KitchenView.tsx` uses `markDone(ticket.id)` from the KDS ticket card. The action calls `restaurantApi.updateKdsStatus(ticketId, 'done')`.

Verified from code: the UI now removes the ticket from local state only after the server returns the refreshed ticket, and then leaves polling to refresh the full queue. On server rejection it displays the backend error if available and refreshes KDS.

## Frontend API request

Verified from code: `restaurantApi.updateKdsStatus` sends:

- path: `/restaurant/kds/:id/status`
- method: `PATCH`
- payload: `{ status: 'done' }`
- ID source: `KdsTicket.id` from `GET /restaurant/kds`, not the internal order UUID.

## Backend Kitchen-ready route

Verified from code: `PATCH /api/restaurant/kds/:id/status` requires kitchen, manager, owner, or admin role; loads the KDS ticket by `ticket.id` and JWT-derived `businessId`; loads the linked order by `ticket.orderId` and same `businessId`; rejects cancelled orders; rejects invalid service transitions; updates KDS, order service status, and item statuses; audits the ready action; and returns a refreshed KDS ticket payload with sanitized order details.

## Role validation

Verified from code: kitchen, manager, owner, and admin can mark ready. Kitchen cannot pay and cannot cancel. Unknown or missing roles are rejected by existing role checks.

## Ticket state validation

Verified from code: only `{ status: 'done' }` is accepted from kitchen. Cancelled tickets are rejected. Duplicate done tickets with ready orders return refreshed current state.

## Linked order state validation

Verified from code: orders can be marked ready only from `pending` or `in_kitchen`. Cancelled orders cannot be readied. Delivered, collected, paid, closed, or otherwise invalid transitions are rejected.

## Response shape

Verified from code: the KDS ready route now returns the same payment-free shape used by the KDS list: ticket fields, `tableLabel`, and `order` with display number, table id, order type, service status, timestamps, and items. It does not include payment fields, payment actions, or totals.

## Stale UI IDs/state

Verified from code: stale UI can produce a 404 if the ticket no longer exists for the tenant, or a 409 if the linked order is no longer in a readyable state. The UI now refreshes after such failures and shows the server reason.

Assumption pending live log: the deployed “Unable to mark this ticket as done.” message could come from stale UI state, a deployed backend revision that predates the refreshed KDS response, or a schema/runtime mismatch. Without the live HTTP status/body or Railway logs, the exact live root cause is not proven.

## Deployed schema/migration differences

Verified from code: staging verification passes with the current schema guard. The route depends on service-flow columns being present or added by `ensureRestaurantServiceFlowSchema`.

Assumption pending live log: if the live Railway service did not run the current backend revision or its database does not have the service-flow/cancellation columns, live behavior could differ from staging. This needs live deployment status plus sanitized Railway request logs to prove.

## Evidence classification

- Verified from code: request path/method/payload, role checks, tenant checks, KDS ready validation, refreshed response shape, KDS payment-field hiding, cancellation rules.
- Verified from staging: existing and extended `verify:restaurant-service-flow` covers valid ready, duplicate ready, cancelled-order ready rejection, role restrictions, and existing dine-in/takeaway journeys.
- Verified from live response/log: only the user-reported browser message text is available in this thread.
- Assumption pending live log: exact live Kitchen Ready root cause.
