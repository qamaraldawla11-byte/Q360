# Restaurant Completion Plan

## 1. Current verified Restaurant capabilities

Repository evidence reviewed: `src/api/restaurant.api.ts`, `backend/src/routes/restaurant.ts`, `backend/src/services/restaurantDomain.ts`, `backend/src/db/schema.ts`, `src/modules/commerce/restaurant/views/*`, `src/modules/commerce/restaurant/manifest.ts`, `tests/e2e/03-restaurant-loop.spec.ts`, and backend Restaurant verification scripts.

| Area | Current classification | Evidence and limits |
| --- | --- | --- |
| menu | persistent/backend-connected; partial; verified by script/test | `restaurant_menus`, `menu_categories`, and `menu_items` exist in `backend/src/db/schema.ts`. `backend/src/routes/restaurant.ts` exposes `GET /menu`, `POST /menu/categories`, and `POST /menu/items`. `MenuView` creates categories/items and POS consumes available items. It is partial because there is no full edit/delete/reorder/image workflow and availability is displayed but not managed in the current UI. |
| tables | persistent/backend-connected; partial; verified by script/test | `restaurant_tables` exists. `FloorView` creates tables and cycles status through the API. POS assigns only available tables. Order/payment flows update table state. It is partial because the floor plan is simple status tiles, not a full layout/reservation/cleaning workflow. |
| POS | persistent/backend-connected; partial; verified by script/test | `PosView` loads menu/tables, builds a cart, creates dine-in or takeaway orders, supports pay-now takeaway, sends orders to KDS, and uses idempotency keys. It is partial because it is optimized for basic order entry only and does not expose full order search, item modifiers, discounts, taxes, split checks, or saved customers. |
| cashier/payment | persistent/backend-connected; partial; verified by script/test | `BillingView` lists orders, filters service/payment/paid states, records payments through `POST /orders/:id/payments`, supports cash received/change UI, and prevents early/duplicate payment through backend checks. It is partial because payment status clarity is spread across tabs/status labels and there is no dedicated daily cashier closeout. |
| KDS | persistent/backend-connected; partial; verified by script/test | `KitchenView` polls `GET /kds`, renders tickets, and marks tickets ready with `PATCH /kds/:id/status`. Backend syncs ticket/order/item statuses. It is partial because only "mark ready" is exposed; there is no kitchen station routing, bump history, or prep analytics beyond dashboard averages. |
| order history | persistent/backend-connected; partial; risky to expose | `GET /restaurant/orders` returns tenant-scoped orders with items and payments. `BillingView` shows today's order/payment operational list. It is risky to expose as "history" because there is no dedicated searchable history UI, export, date filter, refund flow, or reconciliation view. |
| reports/dashboard | persistent/backend-connected; frontend-only; partial | `DashboardView` uses `GET /dashboard` for today's revenue, active orders, average prep time, and live diners. `backend/src/routes/restaurant.ts` also has `GET /business-pulse/snapshot`. `ReportsView` is frontend-only cards with no report data. Current reporting is useful for a live snapshot, not a practical daily report. |
| inventory | mock-only in Restaurant UI; persistent/backend-connected elsewhere; risky to expose as Restaurant inventory | `InventoryView` contains hard-coded low-stock data. Shared `backend/src/routes/inventory.ts` and `inventory_items` exist and are tenant-scoped, but the Restaurant inventory screen does not use them. Exposing the current Restaurant screen as real inventory would overclaim. |
| employees/team | mock-only in Restaurant UI; partial elsewhere; risky to expose | `StaffView` uses hard-coded staff. `users` and admin user routes exist, but Restaurant has no tenant-safe staff management surface for real restaurant operators. Admin user management is platform/admin oriented and includes known deferred migration guards. |
| shifts/duties | mock-only; risky to expose | `StaffView` displays static shift labels. No dedicated shift or duty table/routes were found in `backend/src/db/schema.ts` or Restaurant API. Do not present as real scheduling. |
| audit logs | persistent/backend-connected; partial | `audit_logs` exists, Restaurant routes call `logAudit` for key actions, and admin exposes `/admin/audit-logs`. Restaurant operators do not have a Restaurant-local audit log UI. Treat as backend operational evidence, not a Restaurant beta feature. |
| mobile usability | partial; risky to expose | `SmeLayout` has mobile sidebar behavior, and Restaurant views use responsive grids in places. POS and Billing use wide multi-column/table layouts that need browser checks on phones. Founder-assisted mobile use should be limited to supervised testing until POS/Billing/KDS are verified on target devices. |

## 2. Protected flows that must not break

- Tenant identity: JWT `businessId` must remain the stable tenant key. `primaryWorkspace` must remain a route value such as `/app/restaurant`, not a tenant identity. Keep `backend/src/utils/tenant.ts`, `backend/src/middleware/auth.ts`, auth issuance, and tenant filtering behavior unchanged.
- POS order creation: `POST /api/restaurant/orders` and `POST /api/restaurant/orders/pay-now` must continue creating tenant-scoped orders, order items, daily visible order numbers, idempotency behavior, table occupancy for dine-in, KDS tickets, and audit logs.
- KDS lifecycle: orders must continue moving from POS to KDS, kitchen ready, delivered/collected, then payment where applicable. KDS cancellation and duplicate-ready behavior must remain guarded.
- Payment persistence: completed payments must continue writing `restaurant_payments`, updating `restaurant_orders.paymentStatus`, and returning payments with orders.
- Duplicate payment protection: repeat payment attempts must continue returning conflict status and must not create extra `restaurant_payments` rows.
- Table release: dine-in table status must remain occupied after order creation/ready/delivered and become available only after valid payment, or after valid cancellation where applicable.
- Restaurant verification scripts: preserve `backend` scripts `verify:restaurant`, `verify:restaurant-service-flow`, `verify:restaurant-setup`, and `verify:tenant-identity`. These are the strongest current guardrails around the Restaurant lifecycle.

## 3. Small restaurant owner/operator mode

For early beta, POS and cashier should be kept separate but easier to navigate.

This is the safest practical approach because the verified flow already separates order creation (`PosView` and order routes), kitchen readiness (`KitchenView` and KDS routes), and payment (`BillingView` and payment routes). Combining POS and cashier into one new screen would touch the protected lifecycle and increase regression risk around payment timing, table release, and duplicate payment protection.

The owner/operator should be supported by navigation and state clarity rather than a rewrite: keep `POS / Dining` for taking orders, keep `Orders & Payments` for delivery/collection and payment, and make the two screens link each other more clearly in a later UI-only milestone. The existing backend already allows a legacy onboarded restaurant owner to perform waiter, kitchen, and cashier actions through `isLegacyRestaurantOwnerCompatible`, so the early beta workflow can be one person using the existing screens.

## 4. Missing features for practical Restaurant beta

| Feature | Build now or later | Database impact | API impact | Risk level | Smallest safe implementation |
| --- | --- | --- | --- | --- | --- |
| daily report | build now | none | preferably none at first; reuse `GET /restaurant/orders` and existing dashboard data | low | Add a Restaurant daily report UI that computes today's gross paid sales, completed payment count, unpaid orders, cancelled orders, and top items from existing orders/payments already returned by the Restaurant API. Do not add schema or reporting routes for the first pass. |
| order history | build now, but narrow | none | none | low to medium | Add date/status filters to an existing Restaurant order list using `GET /restaurant/orders`. Keep it read-only. Avoid refunds, edits, exports, and cross-day accounting until after beta feedback. |
| payment status clarity | build now | none | none | low | Improve labels and grouping in `BillingView` or a daily report so each order clearly shows service status, payment status, payment method if present, paid time, and unpaid reason. Do not change payment rules. |
| inventory/stock basics | later | none if reusing `inventory_items`; otherwise avoid | can reuse existing `/api/inventory` | medium | Replace static Restaurant inventory with the existing shared tenant inventory list only after confirming shared inventory semantics fit restaurant ingredients. Start with read-only low-stock basics and manual stock adjustment; no recipe depletion. |
| employee basics | later | likely none if reusing `users`, but risky because admin user flows are not restaurant-local | likely needs a small tenant-scoped user/team API or carefully scoped existing admin API | medium to high | Do not ship fake staff cards. Later, show current account/user role basics read-only, then add invite/manage only after tenant-safe role design is verified. |
| shift/duty basics | later | likely requires new persistence, so out of current no-schema scope | likely requires new API | high | Do not build now. For beta, use free-text operational notes outside Q360 or defer. A real shift/duty feature needs schema and route design, which is explicitly out of scope here. |

## 5. Recommended phased build order

1. Daily Restaurant report from existing order/payment data only.
2. Read-only practical order history filters inside the current Orders & Payments area.
3. Payment status clarity pass on existing Billing/Report surfaces.
4. Replace static Restaurant inventory with shared inventory read-only/stock basics, only if shared inventory data is already suitable for the test restaurant.
5. Minimal team basics, read-only first; defer shifts/duties until schema/API work is allowed.

## 6. Acceptance criteria per milestone

Milestone 1: Daily Restaurant report

- Pass if the owner can see today's paid sales, completed payments, unpaid orders, cancelled orders, and top sold items using existing persisted Restaurant data.
- Pass if refreshing the page preserves the same report values from backend data.
- Pass if no schema, route, payment, KDS, tenant identity, auth, or deployment file changes are needed.
- Fail if report cards use mock numbers or imply payroll, tax filing, refunds, or full accounting.

Milestone 2: Order history filters

- Pass if the owner can filter existing orders by clear operational states such as unpaid, paid, cancelled, ready for service, and completed.
- Pass if each row shows order number, table/takeaway, created time, total, service status, payment status, and payment method when available.
- Fail if orders can be edited after payment, if paid orders can be cancelled, or if tenant-scoped order visibility changes.

Milestone 3: Payment status clarity

- Pass if every visible order has unambiguous service and payment states.
- Pass if pay-now takeaway, pay-later takeaway, and dine-in pay-after-service remain understandable to a single owner/operator.
- Fail if UI wording encourages payment before valid delivery/collection or hides duplicate-payment conflicts.

Milestone 4: Inventory basics

- Pass if static Restaurant inventory data is removed or clearly replaced by tenant-scoped shared inventory.
- Pass if the first version supports only list, low-stock status, and manual adjustment using existing inventory capabilities.
- Fail if recipe depletion, purchasing, costing, or menu ingredient automation is introduced before beta evidence justifies it.

Milestone 5: Team basics

- Pass if no fake employees or fake shifts remain in the Restaurant UI.
- Pass if any team display is tenant-safe and read-only unless real role-management behavior is verified.
- Fail if staff scheduling, payroll, attendance, or duty assignment is presented without persistence and authorization.

## 7. Regression testing checklist

- Run `npm run build`.
- Run `npm run lint`.
- Run `cd backend && npm run build`.
- Run `cd backend && npm run verify:tenant-identity` when database/network access is available.
- Run `cd backend && npm run verify:restaurant`.
- Run `cd backend && npm run verify:restaurant-service-flow`.
- Run `cd backend && npm run verify:restaurant-setup` if setup/menu/table behavior is touched.
- Run `npm run test:e2e -- tests/e2e/03-restaurant-loop.spec.ts` for the browser POS -> Kitchen -> Delivered -> Payment loop.
- Browser-check Restaurant on desktop: menu setup, table creation, POS order creation, kitchen mark ready, billing mark delivered/collected, payment completion, and table release.
- Browser-check mobile-sized viewport for founder-assisted use: sidebar navigation, POS cart visibility, KDS ticket actions, and Billing table/action usability.
- Confirm no run uses `db:push` or migrations for these no-schema milestones.

## 8. Final recommendation

The single safest next Restaurant implementation task is: build a read-only Daily Restaurant Report inside the existing Restaurant Reports area using already persisted Restaurant orders/payments returned by existing APIs.

This is small, reversible, easy to verify, and valuable for founder-assisted testing. It avoids broad refactors, payroll, fake employee/shift screens, ERP complexity, schema changes, route changes, payment changes, KDS changes, tenant identity changes, auth changes, and deployment changes while protecting the verified Restaurant lifecycle.
