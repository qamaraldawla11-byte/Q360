# Restaurant Live Usability Audit

Date: 2026-06-29

This audit reflects the authenticated Restaurant workspace as implemented in code after live-browser usability findings. It does not hide unfinished surfaces.

## Dashboard

Classification: Backend-connected but incomplete

- Frontend: `src/modules/commerce/restaurant/views/DashboardView.tsx`
- Backend route/schema: `GET /api/restaurant/dashboard`; `restaurant_orders`, `restaurant_tables`, `restaurant_payments`, `kds_tickets`
- Real API clicks: page load calls a real API; the `View Reports` button has no navigation handler
- Persistence after refresh/re-login: dashboard values persist only through underlying persisted orders, payments, tables, and KDS tickets
- Tenant-scoped: yes, route reads JWT-derived `businessId`
- Visible contrast issue: the live activity white panel uses inherited dark-theme text and can be unreadable
- Notes: metrics are real, but the activity feed is static copy and the reports button is non-functional

## POS / Dining

Classification: Fully persistent and usable; Backend-connected but incomplete

- Frontend: `src/modules/commerce/restaurant/views/PosView.tsx`
- Backend route/schema: `GET /api/restaurant/menu`, `GET /api/restaurant/tables`, `POST /api/restaurant/orders`; `menu_categories`, `menu_items`, `restaurant_tables`, `restaurant_orders`, `restaurant_order_items`, `kds_tickets`
- Real API clicks: category selection is local; item clicks are local cart actions; `Send to Kitchen` calls a real API
- Persistence after refresh/re-login: created orders, table status changes, KDS tickets, menu items, and tables persist through backend rows
- Tenant-scoped: yes, all Restaurant API calls use JWT-derived `businessId`
- Visible contrast issue: fixed in touched POS cards/cart/select surfaces
- Notes: the essential order-to-kitchen flow is real; table assignment depends on setup data from Menu Architect and Floor / Tables

## Kitchen

Classification: Fully persistent and usable; Backend-connected but incomplete

- Frontend: `src/modules/commerce/restaurant/views/KitchenView.tsx`
- Backend route/schema: `GET /api/restaurant/kds`, `PATCH /api/restaurant/kds/:id/status`; `kds_tickets`, `restaurant_orders`, `restaurant_order_items`, `restaurant_tables`
- Real API clicks: `Mark as Done` calls a real API and updates order/item state
- Persistence after refresh/re-login: yes, KDS ticket and order state persist
- Tenant-scoped: yes, route reads JWT-derived `businessId`
- Visible contrast issue: some white ticket surfaces can inherit light text in dark theme
- Notes: KDS supports done state only from the UI; it is enough for the current POS/payment verification flow

## Menu Architect

Classification: Fully persistent and usable; Backend-connected but incomplete

- Frontend: `src/modules/commerce/restaurant/views/MenuView.tsx`
- Backend route/schema: `GET /api/restaurant/menu`, `POST /api/restaurant/menu/categories`, `POST /api/restaurant/menu/items`; `restaurant_menus`, `menu_categories`, `menu_items`
- Real API clicks: create category and create menu item call real APIs; search/category filtering is local
- Persistence after refresh/re-login: yes, categories and menu items persist in backend rows
- Tenant-scoped: yes, create/list uses JWT-derived `businessId`; cross-tenant category use returns not found
- Visible contrast issue: fixed in touched category, form, item, and empty-state surfaces
- Notes: create/list setup is real; reorder, images, availability editing, and advanced menu settings are not implemented

## Floor / Tables

Classification: Fully persistent and usable; Backend-connected but incomplete

- Frontend: `src/modules/commerce/restaurant/views/FloorView.tsx`
- Backend route/schema: `GET /api/restaurant/tables`, `POST /api/restaurant/tables`, `PATCH /api/restaurant/tables/:id/status`; `restaurant_tables`
- Real API clicks: create table and status-cycle clicks call real APIs
- Persistence after refresh/re-login: yes, table rows and statuses persist
- Tenant-scoped: yes, create/list/update use JWT-derived `businessId`
- Visible contrast issue: fixed in touched table setup and table grid surfaces
- Notes: advanced layout editing and drag-and-drop are intentionally not implemented

## Inventory

Classification: Mock-only; Visual-only / non-functional; Unsafe to show beta users

- Frontend: `src/modules/commerce/restaurant/views/InventoryView.tsx`
- Backend route/schema: no Restaurant inventory route; static hard-coded array only
- Real API clicks: no real API calls
- Persistence after refresh/re-login: no, displayed values are static mock data
- Tenant-scoped: no Restaurant tenant-scoped inventory implementation here
- Visible contrast issue: yes, white cards/tables can inherit unreadable text in dark theme
- Notes: not fixed in this slice

## Billing

Classification: Fully persistent and usable; Backend-connected but incomplete

- Frontend: `src/modules/commerce/restaurant/views/BillingView.tsx`
- Backend route/schema: `GET /api/restaurant/orders`, `GET /api/restaurant/tables`, `POST /api/restaurant/orders/:id/payments`; `restaurant_orders`, `restaurant_order_items`, `restaurant_payments`, `restaurant_tables`
- Real API clicks: tabs are local filters; payment method select is local; `Mark as Paid` calls a real API
- Persistence after refresh/re-login: yes, paid order, payment row, and table release persist
- Tenant-scoped: yes, routes read JWT-derived `businessId`
- Visible contrast issue: fixed in the existing billing table/select surfaces only
- Notes: payment is real for ready orders; no invoices, refunds UI, exports, or advanced billing reports

## Staff

Classification: Mock-only; Visual-only / non-functional; Unsafe to show beta users

- Frontend: `src/modules/commerce/restaurant/views/StaffView.tsx`
- Backend route/schema: none
- Real API clicks: no create/edit buttons or API calls
- Persistence after refresh/re-login: no, displayed staff are hard-coded
- Tenant-scoped: no
- Visible contrast issue: yes, white cards can inherit unreadable text in dark theme
- Notes: not fixed in this slice

## Reports

Classification: Visual-only / non-functional; Unsafe to show beta users

- Frontend: `src/modules/commerce/restaurant/views/ReportsView.tsx`
- Backend route/schema: no reports route connected to this page
- Real API clicks: report cards have hover behavior only and no API calls
- Persistence after refresh/re-login: no report data exists on this page
- Tenant-scoped: no page-level data calls
- Visible contrast issue: yes, white cards can inherit unreadable text in dark theme
- Notes: not fixed in this slice

## Settings

Classification: Visual-only / non-functional; Unsafe to show beta users

- Frontend: `src/modules/commerce/restaurant/views/SettingsView.tsx`
- Backend route/schema: no Restaurant settings route connected to this page
- Real API clicks: cards are cursor-styled but have no click handlers or API calls
- Persistence after refresh/re-login: no
- Tenant-scoped: no page-level data calls
- Visible contrast issue: yes, white cards can inherit unreadable text in dark theme
- Notes: not fixed in this slice

## Agent entry point

Classification: Frontend-only; Visual-only / non-functional; Unsafe to show beta users

- Frontend: `src/layouts/SmeLayout.tsx`, `src/modules/public/AiView.tsx`
- Backend route/schema: no Restaurant agent route connected from this entry point
- Real API clicks: sidebar `Agent` navigates to `/ai`; it does not call a Restaurant API or start a tenant-scoped agent workflow
- Persistence after refresh/re-login: no Restaurant agent state is persisted from this entry point
- Tenant-scoped: no
- Visible contrast issue: not the same white-card issue as Restaurant setup pages
- Notes: not fixed in this slice
