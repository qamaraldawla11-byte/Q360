# Onboarding And Retail Product UX Fix

## Files changed

- `src/modules/onboarding/IdentityView.tsx`
- `src/modules/onboarding/SegmentView.tsx`
- `src/modules/onboarding/SubSegmentView.tsx`
- `src/modules/onboarding/layout/OnboardingLayout.tsx`
- `src/modules/onboarding/BusinessTypeView.tsx`
- `src/modules/commerce/retail/views/CatalogView.tsx`
- `docs/ONBOARDING_AND_RETAIL_PRODUCT_UX_FIX.md`

Existing dirty Retail quotes-related files were left as-is and were not included in this fix.

## Onboarding changes

- New users now move from profile identity directly to business-type selection.
- The legacy `/onboarding/segment` route remains present for compatibility, but immediately sets `userType: 'sme'` and redirects to `/onboarding/type`.
- The onboarding progress UI now shows three steps: Profile, Business Type, Workspace.
- The old Business vs Personal choice is no longer shown.
- All visible "Use Defaults" onboarding actions were removed.
- Existing onboarding completion still writes the same profile fields through `PUT /api/user/profile`.

## Workspace availability behavior

- Restaurant is active and selectable.
- Retail is active and selectable.
- Supermarket remains visible as `Internal preview` and is not selectable.
- Pharmacy, Auto Parts, Clinic, Services, and Other remain visible as `Coming soon` and are not selectable.
- Disabled workspace cards cannot set `segment` or advance onboarding.

## Country/currency UI changes

- Country and currency still save the same values: country code and three-letter currency code.
- The controls now use larger 52px touch targets, stronger visual treatment, icons, and visible selected-code hints.
- No API payload shape changed.

## Logo decision

Business logo upload is postponed.

Inspection found no safe existing profile/business logo field in the current `users` or `businesses` schema, and `PUT /api/user/profile` only accepts `userType`, `segment`, `businessName`, `country`, and `currency`. Adding upload, URL persistence, or storage would require schema/API/storage work, so it was intentionally not implemented in this scoped UX fix.

## Product form changes

- The Retail Product Catalog modal title now says `Add product`.
- Selling price, opening stock, low stock level, and maximum stock are string-backed form fields while editing, so users can clear the field and type normally.
- Numeric validation now happens on submit.
- Maximum stock may be blank; when present it must be greater than or equal to opening stock.
- Browser alert on product creation failure was replaced with an inline form error.
- Save button state is reset in `finally`, so failures do not leave the button stuck on `Saving...`.

## Barcode behavior found

- `inventory_items.barcode` is nullable.
- `POST /api/inventory` allows barcode to be omitted.
- `POST /api/inventory` rejects a provided blank barcode string.
- When barcode is provided, the backend also inserts into `products`.
- `products.barcode` is `notNull().unique()`, which makes product barcode uniqueness global at the schema level.
- Product barcode lookup is tenant-scoped in `GET /api/products/search?barcode=...`.

## Barcode UI behavior implemented

- Blank barcode is allowed in the Retail product form and is omitted from the create payload.
- Duplicate barcode already present in the current workspace is caught before submit and shown inline.
- Backend failures are shown inline instead of with `window.alert`.
- Auto-generation of SKU/barcode was postponed because the current schema has a globally unique barcode constraint and no dedicated SKU field.

## Postponed

- Business logo upload or logo URL persistence.
- Barcode/SKU auto-generation.
- Any schema or database push work.
- Any backend changes to barcode uniqueness.

## Test results

- Passed: `npm run build`
- Passed: `npm run lint`
- Passed: `cd backend && npm run build`
- Passed after approved database access: `cd backend && npm run verify:customers`
  - Initial sandboxed run failed with `EACCES` connecting to Postgres.
- Passed after approved database access: `cd backend && npm run verify:quotes`
  - Initial sandboxed run failed with `EACCES` connecting to Postgres.
- Passed after approved database access: `cd backend && npm run verify:tenant-identity`
  - Initial sandboxed run failed with `EACCES` connecting to Postgres.
  - Verified stable Restaurant `businessId` after relogin and visible persisted Restaurant rows.
- Passed after approved database access: `cd backend && npm run verify:restaurant`
  - Initial sandboxed run failed with `EACCES` connecting to Postgres during seed.
  - Verified Restaurant menu, tables, order flow, tenant isolation, KDS, payment permissions, duplicate payment rejection, takeaway order support, and daily report output.
