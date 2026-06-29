# Business Pulse Restaurant Snapshot Implementation

## Scope

This slice adds a backend-only, read-only Restaurant Business Pulse snapshot endpoint:

```text
GET /api/restaurant/business-pulse/snapshot
```

It does not add a frontend Q panel, chat, AI model calls, provider adapters, API keys, environment variables, drafts, approvals, invoice creation, customer creation, task creation, PDF export, charts, external messages, or autonomous actions.

## Security model

The endpoint is protected by the existing Restaurant route authentication middleware. It derives tenant identity only from the verified JWT/session context and does not trust any frontend-provided `businessId`, tenant ID, workspace ID, route path, query string, request body, or resource ID.

The response exposes aggregate counts, safe display names, safe enum values, and structured operational priorities. It does not expose raw database IDs.

## Tenant isolation enforcement

Every tenant-owned query is filtered by the JWT-derived `businessId`.

`restaurantOrderItems` are queried only after parent `restaurantOrders` have been selected with the verified `businessId`. The endpoint does not accept any resource ID from the request and therefore cannot use a foreign order ID as tenant scope.

The endpoint ignores malicious query parameters such as `businessId`, `tenantId`, `workspaceId`, and foreign `orderId`; tenant scope remains the authenticated business.

## Route and response contract

Route:

```text
GET /api/restaurant/business-pulse/snapshot
```

Response fields:

- `generatedAt`
- `openOrderCount`
- `unpaidOrderCount`
- `delayedKdsTicketCount`
- `oldestDelayedKdsDurationMinutes`
- `tablePaymentAttentionCount`
- `todaySalesSummary`
- `topSellingMenuItems`
- `priorities`

Safe enum groups:

- Priority type: `kds_delay`, `unpaid_orders`, `table_attention`, `sales_summary`, `top_items`
- Urgency: `info`, `attention`, `urgent`
- Evidence type: `kds`, `orders`, `tables`, `payments`, `menu_items`, `sales`

A strict internal validator checks the snapshot shape before the response is returned.

## Data sources and query rules

Data sources:

- `restaurantOrders`
- `restaurantOrderItems`, only through tenant-scoped parent orders
- `kdsTickets`
- `restaurantPayments`
- `auditLogs` for safe snapshot-view audit events

Query rules:

- Orders are scoped by `restaurantOrders.businessId`.
- Payments are scoped by `restaurantPayments.businessId` and already-scoped order IDs.
- KDS tickets are scoped by `kdsTickets.businessId`.
- Order items are scoped indirectly through already-scoped order IDs.
- No request-provided resource ID is used for tenant scoping.
- SQL/internal errors are not exposed to callers.

## Empty and stale data behavior

Empty Restaurant tenants receive valid safe JSON with zero counts, zero sales, empty top-selling items, and an informational sales summary priority.

The snapshot includes `generatedAt` and each priority includes `dataFreshnessTimestamp`. The endpoint does not invent insights when data is absent.

## Audit behavior

Successful snapshot views write `Q_BUSINESS_PULSE_SNAPSHOT_VIEWED` using the existing tenant-scoped audit helper. Audit details include only safe counts and generated timestamp. Failed snapshot generation returns a generic safe error and does not leak implementation details.

## Tests added

Added backend verification script:

```text
npm run verify:business-pulse
```

It verifies:

- Business A cannot receive Business B data.
- Business B cannot receive Business A data.
- Foreign Restaurant resource IDs in query parameters do not affect tenant scope or leak data.
- Unauthenticated access is rejected.
- Empty Restaurant tenant returns valid safe JSON.
- Snapshot audit records are written under the authenticated business only.

## Commands and results

- `npm run build`: passed.
- `npm run lint`: passed.
- `cd backend && npm run build`: passed.
- `cd backend && npm run verify:tenant-identity`: initial sandboxed run failed with database/network `EACCES`; rerun with approved database access passed.
- `cd backend && npm run verify:restaurant`: passed with approved database access.
- `cd backend && npm run verify:business-pulse`: passed with approved database access.

## Known limitations

This slice does not include model-provider abstraction, chat, frontend Q panel, draft generation, approval flows, external dispatch, charts, PDF export, or autonomous actions.

Top-selling items are based on same-day tenant-scoped Restaurant order items loaded through scoped parent orders. Customer-level and staff-level analytics are intentionally excluded.

## Next safe implementation slice

Add the model-provider abstraction behind the same tenant-scoped snapshot contract, with strict JSON validation and no provider database or internal API access.
