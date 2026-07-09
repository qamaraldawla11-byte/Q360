# Restaurant Stabilization Live Test Fix

## Files changed

- `src/modules/commerce/restaurant/manifest.ts`
- `src/modules/commerce/restaurant/views/ReportsView.tsx`
- `src/modules/commerce/restaurant/views/PosView.tsx`
- `src/modules/commerce/restaurant/views/MenuView.tsx`
- `src/modules/commerce/restaurant/views/InventoryView.tsx`
- `src/modules/commerce/restaurant/views/StaffView.tsx`
- `src/modules/core/SegmentsView.tsx`
- `docs/RESTAURANT_STABILIZATION_LIVE_TEST_FIX.md`

## Report issue found

The Daily Report endpoint already reads persisted Restaurant orders, order items, and payment rows scoped by the authenticated business and selected date. Backend verification already asserts today's total orders, paid orders, unpaid/open orders, paid revenue, dine-in count, takeaway count, and recent orders.

The live-test issue was primarily presentation: card values could be visually weak and less readable on mobile or themed surfaces, making correct numbers look unclear.

## Report fix

Daily Report cards now give the numeric values explicit high-contrast styling, larger tabular numerals, stable card height, and mobile-safe wrapping. The report continues to use only existing persisted Restaurant data.

## POS/category changes

POS now always shows the live-test filters: All, Food, Drinks, and Snacks. Items are grouped from existing persisted menu categories without changing menu schema or backend data.

## Menu label/UI changes

Restaurant navigation now labels Menu Architect as Menu. The Menu page copy is lighter and more practical for creating POS categories and priced items, with small mobile layout improvements.

## Inventory/Staff decision

Restaurant Inventory and Staff are static/preview-only today. They remain accessible, but the navigation and pages clearly label them as previews and state that they are not connected to saved Restaurant inventory or staff records.

## Workspace switch decision

Segments Hub now presents Restaurant as the active live-test workspace. Pharmacy, Retail, Logistics, Marketplace, Merchants, and Admin are marked as coming soon or internal preview instead of ready launch workspaces.

## What remains postponed

- Full inventory persistence
- Staff CRUD
- Shifts, duties, and payroll
- Retail fixes
- Quotes frontend work
- AI or new large Restaurant features

## Commands run and results

- `npm run build`: passed.
- `npm run lint`: passed.
- `cd backend && npm run build`: passed.
- `cd backend && npm run verify:restaurant`: sandboxed run failed with database network `EACCES`; escalated retry passed. The verifier confirmed today's daily report summary with 2 total orders, 1 paid order, 1 unpaid/open order, 2000 cents paid revenue, 1 dine-in order, 1 takeaway order, and 2 recent orders.
- `cd backend && npm run verify:tenant-identity`: sandboxed run failed with database network `EACCES`; escalated retry passed and confirmed stable Restaurant tenant identity after re-login.
