# Restaurant Order to Kitchen Performance Instrumentation

## Scope

This instrumentation measures the current Restaurant order-to-Kitchen path without changing workflows, authorization, tenant isolation, lifecycle rules, payment rules, database schema, Kitchen polling interval, UI behavior, user-facing messages, or existing API behavior.

The goal is to identify whether delay is coming from backend route work, database/query work, Kitchen polling cadence, or frontend render/state handling before any refresh optimization is attempted.

## Instrumented request paths

- POS standard order creation: `POST /api/restaurant/orders`.
- POS pay-now takeaway creation: `POST /api/restaurant/orders/pay-now`.
- Kitchen active-ticket loading: `GET /api/restaurant/kds`.
- POS frontend submit path in `src/modules/commerce/restaurant/views/PosView.tsx`.
- Kitchen frontend fetch/render path in `src/modules/commerce/restaurant/views/KitchenView.tsx`.

## Backend timing points

Backend logs are structured JSON emitted from `backend/src/routes/restaurant.ts`.

`POST /restaurant/orders`:

- Request timing starts at route handler entry.
- Correlation ID is read from `X-Q360-Correlation-Id` or generated safely.
- Authorization timing wraps the existing `restaurantActorFor` and `canPerformRestaurantAction` check.
- Order write timing wraps existing order and order-item inserts.
- KDS write timing wraps the existing KDS ticket insert.
- Response preparation timing wraps the existing `orderWithItems(...)` response hydration.
- Total request duration is logged immediately before the existing JSON response.

`POST /restaurant/orders/pay-now`:

- Request timing starts at route handler entry.
- Correlation ID is read from `X-Q360-Correlation-Id` or generated safely.
- Authorization timing wraps the existing `restaurantActorFor` and `canPerformRestaurantAction` check.
- Order write timing wraps existing order and order-item inserts.
- Payment write timing wraps the existing payment insert.
- KDS write timing wraps the existing KDS ticket insert.
- Response preparation timing wraps the existing `payNowOrderResponse(...)` response hydration.
- Total request duration is logged immediately before the existing JSON response.

`GET /restaurant/kds`:

- Request timing starts at route handler entry.
- A separate fetch correlation ID is read from `X-Q360-Correlation-Id` or generated safely.
- Query timing includes the active-ticket query and existing per-ticket order/items/table queries.
- Response preparation timing wraps the existing payload construction loop.
- Ticket count and total request duration are logged immediately before the existing JSON response.

## Frontend timing points

Frontend logs are development-only through `src/utils/performanceInstrumentation.ts`.

POS:

- `restaurant.pos.submit.start`: emitted before the existing submit request starts.
- `restaurant.pos.request.end`: emitted after `createOrder` or `createPayNowTakeawayOrder` resolves.
- `restaurant.pos.response.handled`: emitted after the existing response handling, including current menu/table reload and success/error state handling.

Kitchen:

- `restaurant.kitchen.fetch.start`: emitted before the existing `getKds` call.
- `restaurant.kitchen.fetch.end`: emitted after the existing `getKds` call resolves or fails.
- `restaurant.kitchen.state.render.updated`: emitted from a render effect after ticket state updates.

## Correlation ID design

- POS generates one safe correlation ID per order-submit attempt with `crypto.randomUUID()`.
- POS sends the ID to backend in `X-Q360-Correlation-Id`.
- Backend validates the header against a narrow safe character set and length before logging it.
- Backend generates a new UUID when the header is missing or unsafe.
- Kitchen fetches use separate `kds-fetch-*` correlation IDs.
- Kitchen correlation IDs are not treated as causal links to POS submissions because polling is independent.
- Correlation IDs are not persisted in the database and are not shown to users.

## Safe structured log shape

Sample backend log:

```json
{
  "route": "POST /restaurant/orders",
  "correlationId": "pos-order-00000000-0000-4000-8000-000000000000",
  "requestDurationMs": 42.15,
  "authorizationDurationMs": 1.48,
  "orderWriteDurationMs": 8.21,
  "kdsWriteDurationMs": 2.37,
  "responsePreparationDurationMs": 6.44,
  "orderType": "takeaway"
}
```

Allowed fields are limited to route, duration values, order type, KDS ticket count, and correlation ID.

## Sensitive data exclusions

Instrumentation must never log:

- JWTs.
- OTPs.
- `DATABASE_URL`.
- Database hostnames.
- Payment-sensitive values.
- Customer personal data.
- Full request bodies.
- Full order objects.
- Raw database results.
- Business ID, unless a future logging policy explicitly classifies it as safe.

## How to run a timing test

Local or isolated staging timing test:

1. Open the browser developer console.
2. Start the backend and frontend against the intended isolated environment.
3. Open Kitchen in one browser tab and leave it visible.
4. Open POS in another tab.
5. Create a takeaway pay-later order with `Send to Kitchen`.
6. Match the POS console `correlationId` to the backend structured log for `POST /restaurant/orders`.
7. Watch independent Kitchen `kds-fetch-*` logs and note which poll first contains the new ticket.
8. Repeat for takeaway pay-now using `Pay & Send to Kitchen`.
9. Repeat for dine-in pay-later if table state is available in the isolated environment.

Required verification commands for this implementation:

```powershell
cd backend
$env:DOTENV_CONFIG_PATH='.env.staging'
npm run verify:restaurant-service-flow
npm run build

cd ..
npm run lint
npm run build
```

## How to interpret results

- Backend route slow -> inspect authorization, transaction write path, response hydration, and query timings.
- KDS fetch slow -> inspect KDS query shape, indexes, connection behavior, active ticket count, and database latency.
- Backend fast but Kitchen appears late -> Kitchen polling cadence or refresh/invalidation is the likely delay.
- Kitchen fetch fast but render late -> inspect frontend state/render cost.
- POS request fast but POS success late -> inspect existing post-response menu/table reload.

The five-second Kitchen polling interval remains the strongest likely UI delay when backend order creation is fast but the ticket appears late.

## Likely delay patterns

- Backend order route is slow: high `requestDurationMs`, `orderWriteDurationMs`, `paymentWriteDurationMs`, or `responsePreparationDurationMs`.
- Database/KDS route is slow: high `queryDurationMs` on `GET /restaurant/kds`, especially with larger `kdsTicketCount`.
- Polling delay: POS backend log is fast, but Kitchen only shows the ticket on the next independent `kds-fetch-*` cycle.
- Frontend render delay: Kitchen `fetchDurationMs` is low, but `renderUpdateDurationMs` is high.
- POS handling delay: POS `requestDurationMs` is low, but POS `submitDurationMs` is much higher due to existing response handling and menu/table reload.

## What is intentionally not measured yet

- Database connection acquisition timing.
- Per-query database server execution plans.
- Railway cold-start timing.
- Supabase/Postgres region latency.
- Browser network waterfall beyond frontend request duration.
- Direct POS-to-Kitchen causal linkage.
- Production-user console timing.
- WebSocket/server-sent event behavior.
- Any Live Orders behavior.

## Safety constraints

- No workflow behavior changes.
- No authorization changes.
- No tenant-isolation changes.
- No lifecycle rule changes.
- No payment rule changes.
- No database schema changes.
- No Kitchen polling interval changes.
- No UI behavior or user-facing message changes.
- No staging/live data modification except isolated service-flow verification.
- No migrations, seeds, commits, pushes, deployments, browser tests, or destructive commands.

## Next optimization decision rules

- Backend route slow -> inspect query/write path and response hydration first.
- KDS fetch slow -> inspect query shape, indexes, active ticket count, and connection behavior.
- Backend fast but Kitchen appears late -> prioritize refresh/invalidation improvement without over-polling.
- Kitchen fetch fast but render late -> profile frontend state/render behavior.
- POS request fast but POS completion feels slow -> inspect post-response menu/table reload and local state handling.
