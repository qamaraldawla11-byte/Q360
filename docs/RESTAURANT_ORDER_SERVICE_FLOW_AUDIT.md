# Restaurant Order Service Flow Audit

Date: 2026-06-29

## Current Real Order Lifecycle Before This Slice

Verified in code before implementation:

- `POST /api/restaurant/orders` created tenant-scoped Restaurant orders with status `pending`.
- Creating a table order set the same-tenant table to `occupied`.
- Creating a takeaway order used `tableId: null` and did not require a table.
- KDS completion through `PATCH /api/restaurant/kds/:id/status` with `done` changed the order to `ready` and order items to `done`.
- Payment through `POST /api/restaurant/orders/:id/payments` changed the order to `paid` and released the table to `available`.
- The generic order status route rejected direct `paid` status changes, but otherwise allowed any authenticated Restaurant user to set allowed order statuses.
- The schema and some Business Pulse logic still used the old `served` state.

Implemented lifecycle after this slice:

```text
pending -> ready -> delivered -> paid
```

Legacy `served` remains readable only for compatibility with existing rows and Business Pulse fixtures.

## Current Role Enforcement

Verified before implementation:

- Restaurant routes used JWT authentication and tenant context from `businessId`.
- Restaurant order, KDS, delivery, and payment workflow actions did not previously enforce the requested waiter / kitchen / cashier split.
- Several existing verification scripts used the legacy `admin` role.

Implemented in this slice:

- Waiter-role service actions: create orders and mark ready orders as delivered.
- Kitchen-role production action: mark KDS tickets done, which marks the order ready.
- Cashier / manager / owner payment action: record payment.
- The existing `admin` role is retained for regression compatibility with seeded verification flows.

## Current Table Release Logic

Verified before implementation:

- Table orders set the table to `occupied` at order creation.
- Tables became `available` only when payment completed.
- The old payment path could run from `ready` or `served`, so a table could be released before a real waiter delivery step.

Implemented in this slice:

- Tables remain `occupied` after `ready`.
- Tables remain `occupied` after `delivered`.
- Tables become `available` only after successful payment.
- Takeaway orders do not require or release a table.

## Gap Between Kitchen Ready And Payment

Verified before implementation:

- Kitchen could make an order `ready`.
- Billing could immediately record payment for `ready` orders.
- There was no real waiter/service handoff state between Kitchen Ready and Cashier Payment.

Implemented in this slice:

- A same-tenant ready order must be marked `delivered` before normal payment succeeds.
- Takeaway uses the same delivered state as a "handed over" equivalent.
- Billing now exposes a small Service queue for ready orders and a Payment queue for delivered orders.

## Touched UI Contrast Issue

Verified from the live browser finding and touched code:

- Kitchen item content was rendered on white cards without explicit foreground colors, so theme variables could make item text nearly invisible.

Implemented in this slice:

- Kitchen cards, quantity chips, item names, and notes now set explicit dark foreground colors on white/light surfaces.
- Billing status chips and service/payment action text use explicit readable colors in the touched table.

## Verified Versus Assumed Findings

Verified from repository inspection:

- Restaurant orders, tables, payments, menu, KDS, dashboard, tenant identity, Business Pulse, and setup verification scripts exist.
- Inventory and Staff Restaurant pages are visible code paths, but they are separate mock or unfinished surfaces and were not modified.
- Payment and table release behavior existed in `backend/src/routes/restaurant.ts`.

Assumed from supplied live browser findings:

- Inventory is visible but unreadable and unfinished.
- Staff is visible but mock-only and unreadable.

Explicitly not implemented:

- Inventory CRUD.
- Staff management or scheduling.
- Reports, Settings, AI providers, Business Pulse frontend, chat, Purchases & Expenses, Commerce, Pharmacy, Services, Projects, offline sync, PDF export, drag-and-drop floor editing, split bills, discounts, receipts, or payment hardware integrations.
