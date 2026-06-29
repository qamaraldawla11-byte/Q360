# Restaurant Setup Foundation Implementation

## Scope

Implemented the smallest safe Restaurant setup slice: create/list menu categories, create/list menu items under categories, and create/list simple restaurant tables. POS now reads those persisted menu items and available tables through the existing Restaurant APIs.

## Audit conclusion

The Restaurant workspace has a real POS/KDS/payment backbone, but several management pages remain visual-only or mock-only. The setup blocker was that categories and tables could be listed but not created from real tenant-scoped APIs.

## Pages intentionally not fixed

Staff, Settings, Reports, Inventory, Agent, advanced floor layout editing, menu reordering, menu images, availability editing, AI providers, Business Pulse frontend, chat, Commerce, Pharmacy, Services, Projects, offline sync, and PDF export were not built.

## Data model and tenant isolation

The slice reuses existing `restaurant_menus`, `menu_categories`, `menu_items`, and `restaurant_tables` tables. All create/list actions use the authenticated JWT-derived `businessId`; callers cannot create menu items under another tenant's category or read another tenant's setup rows.

## API routes and UI flow

Added `POST /api/restaurant/menu/categories` for creating a category under the tenant's active menu, creating a `Main Menu` row if needed.

Added `POST /api/restaurant/tables` for creating simple available tables with label and capacity.

Menu Architect now has inline forms for categories and menu items with loading, empty, success, and error states.

Floor / Tables now has an inline simple-table form with loading, empty, success, and error states. Drag-and-drop layout editing is intentionally absent.

POS continues to load `GET /api/restaurant/menu` and `GET /api/restaurant/tables`, so setup rows appear there after creation.

## Contrast fixes

Fixed contrast only on touched Restaurant setup/POS surfaces and the existing billing table/select surface. White panels now set dark text locally instead of inheriting the dark shell text color.

## Tests added

Added `backend/src/scripts/verify_restaurant_setup_foundation.ts` and `npm run verify:restaurant-setup`.

The verification covers:

- Restaurant A/B category, item, and table tenant isolation
- Persistence after simulated re-login
- New menu item visibility through the POS menu API
- New table visibility through the POS table API
- Cross-tenant menu item creation rejection when using another tenant's category

## Commands and results

- `npm run build`: passed; frontend TypeScript and Vite production build completed.
- `npm run lint`: passed with no ESLint output.
- `cd backend && npm run build`: passed; backend TypeScript build completed.
- `cd backend && npm run verify:tenant-identity`: passed; re-login retained `/app/restaurant` tenant identity and Restaurant menu item/table/order rows were stored under the JWT business id.
- `cd backend && npm run verify:restaurant`: passed; existing Restaurant POS order, KDS, payment, duplicate-payment protection, dashboard revenue, and table-release assertions passed.
- `cd backend && npm run verify:business-pulse`: passed; tenant-separated Business Pulse snapshots, unauthenticated rejection, ignored foreign-resource inputs, and audit records passed.
- `cd backend && npm run verify:restaurant-setup`: passed; Restaurant A/B category, item, and table isolation passed; cross-tenant item creation into another tenant's category returned not found; category/item/table persisted after simulated re-login and appeared through POS menu/table APIs.

## Remaining limitations

Dashboard activity feed is static. Kitchen UI is functional but minimal. Inventory, Staff, Reports, Settings, and Agent are not beta-ready. Floor layout editing is not implemented. Menu item editing, category reordering, images, item availability controls, taxes, invoices, refunds, exports, and advanced billing reports remain out of scope.

## Next recommended slice

Make incomplete Restaurant pages honest in navigation or add beta-safe disabled states, then implement menu item editing and availability toggles because they build directly on the now-persistent setup foundation.
