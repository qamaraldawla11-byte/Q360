# Purchases and Expenses Restaurant Foundation Design

## 1. Clear conclusion

Recommendation: build a small shared Purchases and Expenses foundation, introduced through Restaurant first, that records manual owner/admin-approved outflows without touching inventory, payments, tax, accounting journals, bank reconciliation, or supplier settlement.

Verified: the current backend already has JWT-derived `businessId` in authenticated request context, tenant-scoped Restaurant tables, suppliers, inventory, payments, and audit logs. Restaurant data creation generally derives `businessId` from `c.get('businessId')`, not from frontend input.

Verified: no operational purchase/expense, invoice, receipt, upload, attachment, or document metadata table exists in the current schema. Existing Personal invoice/expense screens are stubs or static dashboard examples, not reusable persistence.

Recommendation: the first implementation should add only tenant-scoped purchase/expense records, optional document metadata, duplicate-check support, audit events, and a thin Restaurant UI. Future Q extraction should create reviewable drafts only, and explicit owner/admin approval must be the only path from extracted draft to saved record.

## 2. Current codebase assets to reuse

Verified: `backend/src/middleware/auth.ts` verifies JWTs, rejects workspace route values as tenant identities, and sets `businessId`, `userId`, `userEmail`, and `userRole` in Hono context.

Verified: `backend/src/utils/tenant.ts` treats `users.business_id` as the stable backend tenant pointer and keeps `primaryWorkspace` as a frontend route value.

Verified: `docs/TENANT_IDENTITY_FIX.md` documents the tenant identity decision: JWT `businessId` is issued from `users.business_id`, never from `/app/...`.

Verified: `backend/src/db/schema.ts` contains reusable table patterns: text primary keys, `businessId` on tenant-owned tables, timestamps, JSONB details, and audit logs.

Verified: `backend/src/routes/restaurant.ts` demonstrates tenant-scoped Restaurant reads and writes for menus, tables, orders, KDS tickets, payments, dashboard, and Business Pulse snapshot data.

Verified: `backend/src/routes/suppliers.ts` provides tenant-scoped supplier lookup and a role-protected procurement endpoint for `owner`, `admin`, and `manager`.

Verified: `backend/src/routes/inventory.ts` provides tenant-scoped inventory CRUD/update patterns and role-protected mutation patterns.

Verified: `backend/src/utils/audit.ts` inserts audit logs using `userId` and `businessId` from authenticated request context.

Verified: `src/modules/commerce/restaurant/manifest.ts`, `src/modules/commerce/restaurant/views/*`, and `src/api/restaurant.api.ts` provide the current Restaurant navigation, UI, and typed API-client style.

Verified: `tests/e2e/03-restaurant-loop.spec.ts` and backend verification scripts show the current test style: focused Restaurant flow checks, mocked Playwright API fixtures, and backend verification scripts for real tenant persistence.

## 3. What is missing

Verified: there is no persisted purchase/expense record model.

Verified: there is no persisted invoice extraction draft model.

Verified: there is no document metadata model, upload route, storage key convention, file lifecycle state, or tenant-scoped document download authorization pattern.

Verified: there is no duplicate invoice detection table, normalized duplicate key, or soft-match warning flow.

Verified: Restaurant menu/order/KDS/payment routes currently do not consistently write audit logs, although Business Pulse snapshot views and generic inventory/procurement routes do.

Verified: current supplier procurement auto-receives stock by increasing inventory immediately. That behavior must not be reused for the Purchases and Expenses foundation.

Assumption: the first Restaurant buyer is a business owner or admin manually entering supplier bills, ingredient purchases, utilities, rent, maintenance, fees, and other outflows.

Assumption: suppliers may initially be free-text names, with optional linking to the existing `suppliers` table later.

## 4. Restaurant user flows

Manual Purchase / Expense flow:

1. Owner/admin opens Purchases & Expenses.
2. Owner/admin selects `Purchase` or `Expense`.
3. Owner/admin enters supplier, category, amount, date, reference, and notes.
4. Owner/admin optionally attaches one or more documents.
5. Backend runs duplicate checks within the same JWT-derived `businessId`.
6. UI shows exact and soft duplicate warnings without blocking legitimate saves.
7. Owner/admin confirms.
8. Backend saves a tenant-scoped record and tenant-scoped document metadata.
9. Backend writes audit events for create, duplicate warning surfaced, and document attachment.

Future Q invoice extraction flow:

1. Owner/admin uploads invoice.
2. Backend stores tenant-scoped document metadata.
3. Q extraction later creates a draft only.
4. Duplicate detection runs against same-tenant saved records and same-tenant drafts.
5. Owner/admin edits or reviews extracted fields.
6. Owner/admin explicitly approves.
7. Backend creates the saved purchase/expense record from the approved draft.
8. Inventory remains unchanged.
9. Backend writes audit events for upload, extraction draft created, duplicate warning surfaced, draft edited, approved, and saved record created.

## 5. Shared data model recommendation

Recommendation: use one reusable table for owner-approved outflow records, with a narrow `recordType` instead of separate purchase and expense tables.

Recommended `purchase_expense_records` fields:

- `id`
- `businessId`
- `workspaceContext`: initially `restaurant`, later reusable for commerce/services routing context
- `recordType`: `purchase` or `expense`
- `status`: `saved` or `voided`; avoid draft status here because Q drafts should live separately
- `supplierName`
- `supplierId`: nullable future link to `suppliers`
- `category`
- `amountMinor`
- `currency`
- `recordDate`
- `reference`
- `notes`
- `source`: `manual` or `approved_extraction`
- `approvedDraftId`: nullable
- `duplicateKeyExact`: nullable normalized exact key
- `duplicateFingerprint`: nullable normalized soft-match helper
- `createdBy`
- `updatedBy`
- `createdAt`
- `updatedAt`
- `voidedAt`
- `voidedBy`

Recommendation: use minor currency units for amounts, matching Restaurant order totals that are represented as integer cents in Restaurant routes. Do not use floating point for new money records.

Recommendation: store document metadata in a shared `documents` table, not directly in the purchase/expense row.

Recommended `documents` fields:

- `id`
- `businessId`
- `ownerEntityType`: `purchase_expense_record` or `purchase_expense_draft`
- `ownerEntityId`
- `documentType`: `invoice`, `receipt`, `other`
- `originalFilename`
- `contentType`
- `sizeBytes`
- `storageKey`
- `sha256`
- `status`: `uploaded`, `linked`, `orphaned`, `deleted`, `quarantined`
- `uploadedBy`
- `createdAt`
- `linkedAt`
- `deletedAt`

Recommendation: add a future-only `purchase_expense_extraction_drafts` table when Q extraction is implemented, not in the first manual-only slice unless the first slice includes uploads intended for later extraction.

Recommended draft fields:

- `id`
- `businessId`
- `documentId`
- `status`: `draft`, `needs_review`, `approved`, `rejected`, `expired`
- `extractedRecordType`
- `extractedSupplierName`
- `extractedCategory`
- `extractedAmountMinor`
- `extractedCurrency`
- `extractedRecordDate`
- `extractedReference`
- `extractedNotes`
- `extractionConfidence`: JSONB by field
- `rawExtraction`: JSONB
- `duplicateCheckResult`: JSONB
- `createdBy`
- `reviewedBy`
- `approvedBy`
- `approvedAt`
- `createdAt`
- `updatedAt`

## 6. Tenant isolation and document security

Verified: existing backend routes can use `c.get('businessId')` from auth middleware as the tenant authority.

Mandatory rule: purchase, expense, document, duplicate check, and extraction draft APIs must never accept `businessId`, tenant ID, workspace ID, or document tenant scope from frontend payloads.

Recommendation: every read, write, update, delete, duplicate lookup, document link, draft approval, and document download must include `businessId = c.get('businessId')` in the backend query.

Recommendation: document storage keys must include tenant-derived partitioning that is generated server-side, for example `businesses/{businessId}/documents/{documentId}/{safeFilename}`. The client must never supply the final storage key.

Recommendation: document download must resolve metadata by `(documentId, businessId)` first, then generate or stream the file. Never serve by raw path or storage key alone.

Recommendation: linking a document to a purchase/expense record must verify both the document and target record belong to the same `businessId` in the same transaction.

Recommendation: orphan-file handling should be explicit:

- Upload creates metadata with `status = uploaded`.
- Successful record save links the document and marks `status = linked`.
- Cancelled forms mark unlinked files as `orphaned`.
- A scheduled cleanup can delete orphaned storage objects after a retention period.
- Failed record creation must not leave a linked document.

Highest-risk issue: because no operational document module exists yet, the first document implementation could accidentally authorize files by storage path or frontend-supplied owner IDs. The safest rule is metadata-first access: every file action must start from a tenant-scoped database row.

## 7. Duplicate invoice detection design

Recommendation: duplicate detection should be tenant-scoped and advisory. It should warn, not silently block, because legitimate repeat supplier expenses can share amounts or dates.

Exact duplicate key:

- Normalize `businessId`, `supplierName`, `reference`, `amountMinor`, `currency`, and `recordDate`.
- If `reference` is present, exact key should prioritize `businessId + normalizedSupplierName + normalizedReference + amountMinor + currency`.
- Store hash in `duplicateKeyExact`.

Soft-match warnings:

- Same `businessId`.
- Same or similar supplier name.
- Same amount and currency.
- Record date within a configurable small window, for example plus or minus 7 days.
- Reference similar or missing.
- Optional document `sha256` exact match.

Recommendation: duplicate check response should include severity and matched saved/draft IDs within the same tenant only:

- `exact_record_match`
- `exact_document_hash_match`
- `similar_supplier_amount_date`
- `similar_reference`

Recommendation: Q extraction drafts should run duplicate checks against saved records and other active drafts for the same `businessId`, so duplicate invoices cannot hide in unapproved draft state.

## 8. Permissions and approval rules

Verified: current `requireRole` supports explicit role allowlists.

Recommendation: Restaurant permissions should be:

- `owner`: full create, edit, void, attach documents, upload invoices, review drafts, approve drafts.
- `admin`: full create, edit, void, attach documents, upload invoices, review drafts, approve drafts.
- `manager`: view records and duplicate warnings; optionally create manual draft-like entries only if product explicitly wants manager data entry later. For the first safe slice, manager should not approve Q extraction or save financial records.
- `staff`: no access by default.

Recommendation: first implementation should allow saved manual records only for `owner` and `admin`. This is stricter than current procurement and reduces risk while the model is new.

Mandatory rule: extracted drafts require explicit owner/admin approval before a purchase/expense record is created.

Mandatory rule: approval must be an authenticated backend action that uses `approvedBy = c.get('userId')` and `businessId = c.get('businessId')`; a frontend checkbox or draft status in request body must not create records without server-side role enforcement.

## 9. Inventory and payment safety boundary

Verified: current supplier procurement auto-receives stock by updating `inventory_items.current`.

Mandatory rule: Purchases and Expenses must never update inventory automatically.

Mandatory rule: Purchases and Expenses must not create payments, mark supplier settlement, create accounting journals, calculate tax, reconcile bank transactions, or trigger automatic payment processing.

Recommendation: if a user records a purchase of ingredients, it remains a financial/admin record only. Any inventory update must happen through an explicit, separate inventory action with its own role check, audit event, and user confirmation.

Recommendation: do not reuse the current `/api/suppliers/procurement/orders` behavior for this foundation, because its stock-changing semantics conflict with the safety boundary.

## 10. Future Q extraction draft flow

Recommendation: do not build OCR, model provider integration, autonomous invoice processing, or extraction queues now.

Future draft behavior:

1. Owner/admin uploads a document.
2. Document metadata is stored under the JWT-derived `businessId`.
3. Extraction job reads only that tenant-scoped document.
4. Extracted fields are stored in `purchase_expense_extraction_drafts`.
5. Draft status starts as `draft` or `needs_review`.
6. Duplicate detection runs within the same `businessId`.
7. Owner/admin reviews and edits fields.
8. Owner/admin approves.
9. Backend creates a saved `purchase_expense_records` row with `source = approved_extraction`.
10. Draft status becomes `approved`.

Recommendation: approval should be transactional: lock the draft by `(id, businessId)`, verify approver role, verify document tenant, create the saved record, link document if needed, set draft approved metadata, and write audit events.

Recommendation: rejected drafts should remain auditable but never create saved records.

## 11. API and UI recommendation

Recommendation: add a future shared backend route such as `/api/purchases-expenses`, mounted separately from Restaurant routes but surfaced first inside Restaurant UI.

Recommended API endpoints:

- `GET /api/purchases-expenses`
- `POST /api/purchases-expenses/duplicate-check`
- `POST /api/purchases-expenses`
- `GET /api/purchases-expenses/:id`
- `PATCH /api/purchases-expenses/:id`
- `POST /api/purchases-expenses/:id/void`
- `POST /api/purchases-expenses/documents`
- `GET /api/purchases-expenses/documents/:id`
- Future: `POST /api/purchases-expenses/extraction-drafts`
- Future: `PATCH /api/purchases-expenses/extraction-drafts/:id`
- Future: `POST /api/purchases-expenses/extraction-drafts/:id/approve`
- Future: `POST /api/purchases-expenses/extraction-drafts/:id/reject`

Recommendation: UI should add a Restaurant module named `Purchases & Expenses` with:

- List filtered by type, date, category, supplier, and duplicate warning state.
- Create form with Purchase/Expense segmented control.
- Supplier free-text field, optional supplier link later.
- Category select with Restaurant-friendly defaults.
- Amount, currency, date, reference, notes.
- Optional document attachment.
- Duplicate warning panel before final confirm.
- Read-only detail view with audit-friendly metadata.

Recommendation: frontend types should omit `businessId` from create/update inputs. Response types may include `businessId` only if needed for debugging or consistency, but UI must not use it for authorization decisions.

## 12. Audit-log requirements

Verified: `logAudit(c, action, entity, entityId, details)` already writes `userId` and `businessId` from request context.

Recommendation: write audit events for:

- `PURCHASE_EXPENSE_DUPLICATE_CHECKED`
- `PURCHASE_EXPENSE_DUPLICATE_WARNING_SHOWN`
- `PURCHASE_EXPENSE_CREATED`
- `PURCHASE_EXPENSE_UPDATED`
- `PURCHASE_EXPENSE_VOIDED`
- `PURCHASE_EXPENSE_DOCUMENT_UPLOADED`
- `PURCHASE_EXPENSE_DOCUMENT_LINKED`
- `PURCHASE_EXPENSE_DOCUMENT_DELETED`
- Future: `PURCHASE_EXPENSE_EXTRACTION_DRAFT_CREATED`
- Future: `PURCHASE_EXPENSE_EXTRACTION_DRAFT_UPDATED`
- Future: `PURCHASE_EXPENSE_EXTRACTION_DRAFT_APPROVED`
- Future: `PURCHASE_EXPENSE_EXTRACTION_DRAFT_REJECTED`

Recommendation: audit details should include non-sensitive operational facts such as record type, amount minor, currency, record date, category, duplicate warning count, document ID, and draft ID. Avoid storing full document text, raw invoice contents, or unnecessary supplier PII in audit details.

## 13. Test plan

Recommendation: backend tests or verification scripts should cover:

- Manual record creation derives `businessId` from JWT and ignores any frontend-supplied tenant fields.
- Tenant A cannot list, read, edit, void, attach, download, or duplicate-check Tenant B records.
- Tenant A cannot link Tenant B document metadata to Tenant A records, and vice versa.
- Duplicate exact key detects same-tenant duplicate but not cross-tenant duplicates.
- Soft duplicate warning detects same supplier/amount/date-window records within the same tenant.
- Same document `sha256` warns only within the same tenant.
- Owner/admin can create and approve; manager/staff cannot approve.
- Staff cannot access Purchases & Expenses in the first safe slice.
- Document upload creates metadata before linking and orphan cleanup marks unlinked uploads without cross-tenant access.
- Purchase/expense create does not update `inventory_items`.
- Purchase/expense create does not create `restaurant_payments` or generic payment records.
- Audit events include the JWT-derived `businessId`.

Recommendation: frontend tests should cover:

- Restaurant navigation exposes Purchases & Expenses only to allowed roles.
- Create form does not include tenant/business fields.
- Duplicate warning appears before confirm.
- Owner/admin confirmation is required before save.
- Q extraction draft UI, when built later, cannot save without explicit approve action.

Recommendation: do not rely only on mocked Playwright for tenant security. Add backend verification similar to `verify_tenant_identity.ts` for cross-tenant records and documents.

## 14. Smallest safe implementation slice

Recommendation: implement manual Restaurant records first, without Q extraction.

Smallest safe slice:

1. Add tenant-scoped `purchase_expense_records`.
2. Add tenant-scoped `documents` metadata only if attachment upload is included in the first slice; otherwise explicitly defer attachments.
3. Add duplicate-check utility and endpoint scoped by JWT `businessId`.
4. Add owner/admin-only create/list/detail endpoints.
5. Add audit events for duplicate check and create.
6. Add Restaurant Purchases & Expenses UI with manual form and warning-confirm flow.
7. Add backend tenant isolation tests before any UI polish.

Recommendation: if attachments feel too large for the first implementation, ship records plus duplicate detection first and keep document upload as the immediate next slice. Do not ship file upload without tenant-scoped metadata and download authorization.

## 15. What must not be built yet

Do not build OCR/model/provider implementation.

Do not build autonomous invoice processing.

Do not let extracted invoice data create saved records without owner/admin approval.

Do not build automatic inventory updates from purchases or invoices.

Do not build automatic supplier payments or payment processing.

Do not build supplier settlement.

Do not build accounting journals, ledger posting, financial statements, or tax calculations.

Do not build bank reconciliation.

Do not build cross-tenant document access by raw path, storage key, or frontend-supplied tenant IDs.

Do not add Commerce or Services workspaces for this feature now.

Do not reuse the current auto-receive procurement route as the purchase/expense foundation.
