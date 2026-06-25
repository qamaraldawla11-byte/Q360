# Q360 Workspace Architecture Review

## 1. Clear conclusion

- **Verified:** Q360 is already one React/Vite frontend and one Hono backend. Restaurant, Pharmacy, Retail, Supermarket, and Personal are folders, route branches, layouts, manifests, or view sets inside the same repository; they are not separate deployed applications or codebases.
- **Verified:** The current runtime model is `userType -> segment -> primaryWorkspace route`. The `segment` value currently acts as business classification, template identity, and route selector at the same time.
- **Verified:** Projects does not exist as a workspace, route, persisted entity, or module in the inspected application code. It can therefore be introduced later as an optional module without a legacy Projects workspace migration.
- **Recommendation:** Adopt `workspace type -> template -> enabled modules` as a compatibility layer over the current system, while preserving every existing Restaurant, Pharmacy, Retail, Supermarket, and Personal route during the beta period.
- **Recommendation:** Treat `commerce`, `services`, and `personal` as the only future top-level workspace types. Treat Restaurant, Pharmacy, Retail, Supermarket, and the proposed industry choices as templates. Treat Projects as an optional module only.
- **Recommendation:** Do not change the database, onboarding UI, route tree, or Restaurant flow in the first implementation milestone. First add a central, tested configuration/resolver that can translate current segment values into the future model without changing runtime behavior.

## 2. What already exists in the current codebase

### Onboarding and persisted selection

- **Verified:** `src/views/routes.tsx` defines the four-step onboarding route sequence: `/onboarding/identity`, `/onboarding/segment`, `/onboarding/type`, and `/onboarding/workspace`.
- **Verified:** `src/modules/onboarding/SegmentView.tsx` currently asks for `Business` or `Personal`, storing `userType` as `sme` or `personal`.
- **Verified:** `src/modules/onboarding/SubSegmentView.tsx` currently offers Restaurant, Pharmacy, Supermarket, Retail, Auto Parts, Clinic, Services, and Other as `segment` choices.
- **Verified:** `src/modules/onboarding/SubSegmentView.tsx` routes Auto Parts to `/app/retail`, Clinic to `/app/pharmacy`, and Services to `/app/personal` as explicit temporary fallbacks.
- **Verified:** `src/modules/onboarding/layout/OnboardingLayout.tsx` defaults an SME to `restaurant` and a personal user to `personal_freelancer`.
- **Verified:** `src/modules/onboarding/BusinessTypeView.tsx` sends `userType`, `segment`, `businessName`, `country`, and `currency` to `PUT /api/user/profile`, then navigates to a route derived from the selected segment.
- **Verified:** `src/api/user.api.ts`, `src/types/user.ts`, `backend/src/routes/user.ts`, and `backend/src/db/schema.ts` all encode the current `userType` and `segment` contract.
- **Verified:** `backend/src/routes/user.ts` validates a hard-coded segment list and persists `primaryWorkspace` from a hard-coded `workspacePaths` map.

### Workspace routing and shells

- **Verified:** `src/views/routes.tsx` declares separate legacy route branches under `/app/restaurant`, `/app/pharmacy`, `/app/retail`, `/app/supermarket`, `/app/school`, and `/app/personal`.
- **Verified:** `src/layouts/AppShell.tsx` selects `PersonalLayout` for `/app/personal` and `SmeLayout` for a hard-coded list of SME route prefixes.
- **Verified:** `src/layouts/SmeLayout.tsx` already renders navigation from each vertical manifest's `modules` array.
- **Verified:** `src/types/vertical.ts` defines `VerticalManifest` and `VerticalModule`, including module ID, label, path, icon, base path, and default module.
- **Verified:** `src/verticals/index.ts` provides a central vertical registry, although the active route declarations and `SmeLayout` also import manifests directly.
- **Verified:** `src/modules/core/SegmentsView.tsx` presents Restaurant OS, Pharmacy OS, Retail Point, Admin, and Settings as launchable workspace/product cards. This screen reinforces the current vertical-as-product model.

### Existing legacy templates/workspaces

- **Verified:** Restaurant has a manifest, route branch, layout adapter, frontend API client, dedicated backend routes, dedicated database tables, and an end-to-end POS-to-kitchen-to-billing test.
- **Verified:** Pharmacy has a manifest, route branch, layout adapter, dedicated views, and a local Zustand store. Its inspected routes do not have a dedicated pharmacy backend route module.
- **Verified:** Retail has a manifest, route branch, layout adapter, dedicated views, and a persisted browser-side Zustand store. It also reuses shared inventory, order, and procurement APIs in parts of the commerce implementation.
- **Verified:** Supermarket has a manifest, route branch, layout adapter, dedicated views, a Zustand store, and uses shared inventory, product search, order, supplier, and procurement backend routes.
- **Verified:** Personal has its own route branch and `PersonalLayout`. Its dashboard uses static sample invoice and insight data, while Invoices, Clients, Expenses, Tasks, and Settings are currently stub views.
- **Verified:** Restaurant and Pharmacy are already located under `src/modules/commerce`, which is structurally compatible with treating them as legacy Commerce templates.

### Data and tenancy

- **Verified:** `backend/src/db/schema.ts` has `users` and `businesses` tables. `users` stores `userType`, `segment`, `businessId`, `primaryWorkspace`, and onboarding state; `businesses` stores `name`, `type`, and status fields.
- **Verified:** There is no persisted workspace table, template field, enabled-module field, workspace membership table, or project table in the inspected schema.
- **Verified:** The frontend `User` type contains a future-facing `workspaces` array and `lastActiveWorkspace`, but backend serializers currently always return `workspaces: []`, and `lastActiveWorkspace` is not persisted.
- **Verified:** `businessId` is the real tenant identity in JWTs and operational tables. `primaryWorkspace` is a frontend route string, not a tenant ID.
- **Verified:** `backend/src/utils/tenant.ts` and `backend/src/middleware/auth.ts` explicitly prevent `/app/...` route strings from being used as tenant identities.
- **Verified:** Shared inventory, product, order, supplier, procurement, audit, and Restaurant queries are scoped by JWT `businessId`.

### Feature toggles

- **Verified:** `src/views/admin/SettingsPage.tsx` exposes system-level flags for maintenance mode, read-only mode, and signup disabling through the generic `system_settings` table.
- **Verified:** The inspected code does not read those system settings to filter workspace navigation or authorize module access.
- **Verified:** The current manifest `modules` arrays determine sidebar visibility, but they are static per legacy vertical and are not tenant-specific feature toggles.
- **Verified:** There is no current `enabledModules`, module entitlement, or template recommendation model.

### Existing protection and tests

- **Verified:** `tests/e2e/02-onboarding.spec.ts` protects the current SME-to-Restaurant onboarding behavior and final `/app/restaurant` route.
- **Verified:** `tests/e2e/03-restaurant-loop.spec.ts` protects the Restaurant POS, kitchen, billing, and payment loop.
- **Verified:** `tests/e2e/04-personal-navigation.spec.ts` protects the current Personal navigation routes.
- **Verified:** `backend/src/scripts/verify_tenant_identity.ts` protects stable tenant identity across onboarding and relogin for a Restaurant user.
- **Verified:** `backend/src/scripts/verify_restaurant_core.ts` verifies tenant-scoped Restaurant persistence and workflow behavior.

## 3. What can be reused

- **Recommendation:** Reuse `VerticalManifest.modules` as the starting shape for a module catalog. Rename or generalize it later only when the compatibility layer is proven; no immediate mass rename is needed.
- **Recommendation:** Reuse `SmeLayout`'s manifest-driven navigation. Its module filtering input can later become `template defaults intersect enabled modules`, while the current Restaurant and Pharmacy manifest output remains identical.
- **Recommendation:** Reuse the existing `/app/restaurant`, `/app/pharmacy`, `/app/retail`, `/app/supermarket`, and `/app/personal` route branches as stable legacy aliases throughout beta.
- **Recommendation:** Reuse Restaurant as a legacy Commerce template with Restaurant-specific modules such as Menu, Kitchen, Floor, and Billing.
- **Recommendation:** Reuse Pharmacy as a legacy Commerce template with pharmacy-specific modules such as Prescriptions and Dispensing.
- **Recommendation:** Reuse Retail and Supermarket commerce views and their shared inventory, products, orders, suppliers, and procurement capabilities for future Commerce templates where behavior genuinely matches.
- **Recommendation:** Reuse `backend/src/routes/inventory.ts`, `orders.ts`, and `suppliers.ts` as business-capability APIs. They are tenant-scoped by `businessId` and are closer to shared modules than to separate products.
- **Recommendation:** Reuse the Restaurant backend unchanged for Restaurant beta. Restaurant's dedicated tables and routes represent valid template-specific capability, not an architectural violation.
- **Recommendation:** Reuse Personal's shell and route branch as the future Personal workspace base, but regard its static dashboard data and stub pages as incomplete product behavior.
- **Recommendation:** Reuse `businesses.id` and JWT `businessId` as tenant identity. Do not overload `primaryWorkspace`, `segment`, or a route path as a tenant key.
- **Recommendation:** Reuse the current E2E and verification scripts as regression gates before any new onboarding is exposed to beta customers.
- **Assumption:** Products, inventory/materials, orders, customers, invoices, tasks, and projects will not all share identical data behavior across Commerce, Services, and Personal. Shared navigation IDs and service contracts are reusable, but domain-specific screens may still require adapters.

## 4. What conflicts with this direction

- **Verified:** The most important conflict is that `segment` is the source of truth for classification, template selection, route selection, and implied module set. The new direction requires these concerns to be separate.
- **Verified:** `UserType` currently supports only `sme | personal`; it cannot directly express Commerce versus Services.
- **Verified:** Restaurant, Pharmacy, Retail, and Supermarket are presented as peer workspaces/products in `SegmentsView`, route names, manifest names such as `Restaurant OS`, and onboarding segment choices.
- **Verified:** `backend/src/routes/user.ts` hard-codes every accepted segment and route mapping, so a new template currently requires backend validation and routing code changes.
- **Verified:** `src/views/routes.tsx` hard-codes imports and child routes for each vertical. The manifest comment says modules define routes and sidebar, but manifests currently drive the sidebar only; route registration remains separate.
- **Verified:** `src/layouts/AppShell.tsx` and `src/layouts/SmeLayout.tsx` each maintain their own hard-coded supported workspace lists.
- **Verified:** `src/verticals/index.ts` is not the single runtime source of truth because routing and layout code import or enumerate verticals separately.
- **Verified:** Auto Parts, Clinic, and Services currently masquerade as other workspaces through fallback routes. In particular, Services currently lands in Personal, which conflicts with Services being a top-level business workspace.
- **Verified:** The onboarding `Use Defaults` behavior builds `/app/personal_freelancer`, while `src/views/routes.tsx` redirects that legacy path to `/app/personal`. This is another sign that segment IDs and runtime routes are coupled inconsistently.
- **Verified:** New users receive a newly created business record with type `retail` before onboarding in `backend/src/routes/auth.ts`. Onboarding later updates that business type to the selected segment through `ensureUserBusiness`.
- **Verified:** Admin business creation uses a different type vocabulary—`retail`, `service`, and `fnb`—than onboarding and the user segment type.
- **Verified:** `backend/src/routes/admin.ts` creates users with a `primaryWorkspace` value taken from `businessId`, mixing a route field with a tenant identifier in that admin path.
- **Verified:** Current system settings are global key/value flags and are not a safe substitute for per-business enabled modules.
- **Recommendation:** Do not solve these conflicts by deleting legacy route branches or by dynamically generating every route immediately. Introduce a compatibility resolver first, then migrate one decision boundary at a time.

## 5. Recommended minimal database model

- **Recommendation:** Do not introduce this schema during the review or the first compatibility milestone.
- **Recommendation:** When persistence is required, add the smallest fields to the tenant/business record rather than creating a broad marketplace or builder model:

```text
businesses
  id                    existing tenant key
  name                  existing
  workspace_type        commerce | services | personal
  template_id           retail | online_seller | auto_parts | industrial_supplies |
                        wholesale | maintenance | installation | engineering |
                        repair | cleaning | contractor | freelancer | founder |
                        personal_productivity | legacy_restaurant |
                        legacy_pharmacy | legacy_supermarket
  enabled_modules       JSON/JSONB array of stable module IDs
  configuration_version integer
```

- **Recommendation:** Keep `users.business_id` as the user's current tenant association for the first three beta customers.
- **Recommendation:** Keep `users.segment` and `users.primary_workspace` during migration as legacy compatibility fields; do not repurpose or delete them.
- **Recommendation:** Keep module IDs stable and capability-oriented, for example `customers`, `quotes`, `products`, `inventory`, `orders`, `invoices`, `payment_follow_up`, `tasks`, `projects`, `team`, `documents`, `whatsapp_follow_up`, and `ai_business_pulse`.
- **Recommendation:** Store explicit enabled modules only when customers need configuration persistence. Until then, derive recommendations from a versioned template catalog in code.
- **Assumption:** A business may later need multiple user memberships or multiple workspaces. That requirement is not implemented today and should not trigger a membership/permissions redesign before beta evidence.
- **Assumption:** PostgreSQL JSONB is available in the current Drizzle schema, but the deployed database and migration state must be confirmed before selecting the final representation for enabled modules.

## 6. Recommended feature-toggle/module model

- **Recommendation:** Use three layers:

```text
module catalog
  -> template recommended modules
    -> business enabled modules
```

- **Recommendation:** The module catalog should define stable ID, label, route key, workspace compatibility, maturity status, and optional legacy adapter. It should not contain customer-specific state.
- **Recommendation:** Template definitions should contain `workspaceType`, `templateId`, recommended module IDs, and a legacy route when required. Templates recommend configuration; they do not create separate applications.
- **Recommendation:** Business enabled modules should eventually override template recommendations, but required safety/core modules may remain fixed.
- **Recommendation:** Navigation should be derived from enabled modules, but backend authorization must not rely on hidden navigation. A disabled module's write endpoints must eventually reject access server-side.
- **Recommendation:** Keep platform operational flags such as maintenance mode separate from tenant module configuration. `system_settings` can continue serving global operational settings.
- **Recommendation:** For the first three beta customers, use a code-owned allowlist/configuration object or one persisted module array. Do not build a module marketplace, drag-and-drop builder, slider system, or complex permission framework.
- **Recommendation:** Keep Projects as a module ID that can be recommended by Services templates and optionally enabled for Commerce templates. Never map `projects` to a top-level workspace type or `/app/projects` product root.
- **Assumption:** Some Restaurant and Pharmacy modules will remain template-specific and will not appear in the shared potential-module list. The module model should allow template-specific capability IDs without forcing false reuse.

## 7. Safe migration path from current onboarding

1. **Recommendation:** Add a central compatibility catalog and pure resolver that maps every current segment to a future workspace type, legacy template ID, recommended modules, and unchanged legacy route.
2. **Recommendation:** Add unit tests for every current segment mapping, especially Restaurant, Pharmacy, Supermarket, Retail, Auto Parts, Services, and all Personal variants.
3. **Recommendation:** Keep the existing onboarding screens and `PUT /api/user/profile` payload unchanged while the resolver is introduced.
4. **Recommendation:** Add derived future fields to frontend state or API responses only after compatibility tests pass; do not persist them in the first milestone.
5. **Recommendation:** Build the new three-choice onboarding behind an explicit beta flag or controlled beta cohort, with Restaurant's existing onboarding remaining the fallback.
6. **Recommendation:** In the new flow, collect `workspaceType` first, then `templateId`, then show recommended modules. Continue writing the legacy `segment` and `primaryWorkspace` values needed by current routes.
7. **Recommendation:** Preserve `/app/restaurant`, `/app/pharmacy`, `/app/retail`, `/app/supermarket`, and `/app/personal` as route targets. New generic Commerce or Services shells can be added later without redirecting legacy customers prematurely.
8. **Recommendation:** Persist `workspace_type`, `template_id`, and enabled modules only after one beta customer's configuration needs cannot be represented safely by the compatibility resolver.
9. **Recommendation:** After production validation, make the new fields authoritative and retain `segment` only as a migration/analytics field until all consumers are removed.
- **Verified:** This staged path keeps the current Restaurant E2E route and workflow intact.
- **Assumption:** Beta cohort selection and feature-flag delivery mechanisms are not yet defined in the repository and require a later operational decision.

## 8. What should not be changed yet

- **Recommendation:** Do not remove, rename, or redirect existing Restaurant, Pharmacy, Retail, Supermarket, or Personal routes.
- **Recommendation:** Do not change Restaurant tables, Restaurant backend routes, payment behavior, tenant filtering, or the Restaurant E2E workflow.
- **Recommendation:** Do not replace `businessId` tenant identity with workspace type, template ID, segment, or route path.
- **Recommendation:** Do not delete `userType`, `segment`, or `primaryWorkspace`.
- **Recommendation:** Do not add a database migration during the first compatibility milestone.
- **Recommendation:** Do not dynamically generate the entire React route tree from manifests yet.
- **Recommendation:** Do not merge Restaurant and Pharmacy screens into generic Commerce screens merely to make the folder tree look uniform.
- **Recommendation:** Do not expose incomplete Services by routing it to Personal in the future onboarding; keep it unavailable or explicitly beta-only until it has a valid shell and modules.
- **Recommendation:** Do not build a marketplace, drag-and-drop module builder, slider-based configurator, billing entitlement engine, or new complex permission system before the first three beta customers.
- **Recommendation:** Do not treat the existing global system settings UI as a tenant module manager.
- **Recommendation:** Do not broaden the scope to School, Supplier, Logistics, Marketplace, Merchants, or the long-term MCP/agent vision in the first workspace-architecture milestone.

## 9. Risks and edge cases

- **Verified:** A user can have a `segment` whose route is only a proxy for another product, including Services to Personal. New logic must not assume current route equals future workspace type.
- **Verified:** `workspaces` is always returned empty by backend serializers, so the UI's “Switch workspace” language does not represent persisted multi-workspace membership.
- **Verified:** `lastActiveWorkspace` exists only in frontend state and is lost on a fresh session.
- **Verified:** `primaryWorkspace` contains route paths for normal onboarding but can receive a business ID through the current admin user creation path.
- **Verified:** New users receive a business row before they choose a workspace/template, so pre-onboarding business type is provisional.
- **Verified:** Retail browser state and Personal static data may give a false impression of server-backed, tenant-safe module completeness.
- **Verified:** Pharmacy and Supermarket contain substantial UI, but backend maturity differs by capability; module recommendations must not imply production readiness.
- **Verified:** The manifest registry includes placeholders and types not fully registered or routed, including supplier/logistics inconsistencies.
- **Recommendation:** Add a module maturity field such as `legacy_stable`, `beta`, or `placeholder` to prevent templates from recommending non-production capabilities.
- **Recommendation:** Validate routes and enabled module IDs server-side before persistence is introduced.
- **Recommendation:** Define deterministic fallback behavior for unknown legacy segments: retain the stored route if valid, otherwise use `/app/segments`; never silently classify unknown data as Projects.
- **Recommendation:** Preserve template-specific workflows and data models where necessary; “one codebase” does not require one universal screen or table for all industries.
- **Assumption:** Existing production customer records may include values outside the TypeScript unions. A database query or production export is required before any migration script is designed.
- **Assumption:** The first three beta customers may require different combinations of Products, Materials, Projects, Quotes, and Invoices. Their actual workflows should validate module boundaries before schema expansion.

## 10. Smallest useful implementation milestone

- **Recommendation:** Implement a code-only, backward-compatible workspace architecture catalog and resolver, with no UI, route, API payload, or database behavior change.
- **Recommendation:** The milestone should define:
  - `WorkspaceType = 'commerce' | 'services' | 'personal'`
  - stable template IDs, including legacy Restaurant, Pharmacy, and Supermarket
  - stable module IDs
  - template-to-recommended-module mappings
  - current-segment-to-future-model compatibility mappings
  - unchanged legacy route targets
  - module maturity metadata
- **Recommendation:** Add focused unit tests or lightweight testable assertions for the resolver and retain all existing E2E tests unchanged.
- **Recommendation:** Do not connect the new catalog to onboarding or persistence in this milestone. Its value is to establish one reviewed source of vocabulary and expose contradictions before customer-visible changes.
- **Recommendation:** The milestone is complete only when Restaurant resolves to `commerce + legacy_restaurant + current Restaurant modules + /app/restaurant`, Pharmacy resolves to `commerce + legacy_pharmacy + /app/pharmacy`, Services never resolves to Personal, and Projects appears only in module recommendations.

## 11. Acceptance criteria

- **Recommendation:** A single catalog defines the three future workspace types.
- **Recommendation:** Projects is absent from the workspace-type and template-type unions and present only as a module ID.
- **Recommendation:** Every currently accepted backend segment has an explicit compatibility mapping.
- **Recommendation:** Restaurant, Pharmacy, Retail, Supermarket, and Personal compatibility mappings retain their existing launch routes.
- **Recommendation:** Auto Parts maps to Commerce with a commerce template, even if its temporary route remains `/app/retail`.
- **Recommendation:** Services maps to Services and is marked unavailable/placeholder if no valid Services shell exists; it does not semantically map to Personal.
- **Recommendation:** Template configuration recommends modules and does not import or instantiate a separate application.
- **Recommendation:** Module entries include a maturity status so placeholder modules are not accidentally recommended to beta users.
- **Recommendation:** No database schema, API request contract, onboarding screen, application route, deployment config, or legacy manifest is changed in the milestone.
- **Recommendation:** Existing build, Restaurant E2E, Personal navigation E2E, onboarding E2E, tenant identity verification, and Restaurant core verification continue to pass.

## 12. Testing checklist

- **Recommendation:** Run the frontend TypeScript/Vite production build.
- **Recommendation:** Run the backend TypeScript build.
- **Recommendation:** Run the current Playwright onboarding test and confirm final navigation remains `/app/restaurant`.
- **Recommendation:** Run the Restaurant POS-to-kitchen-to-billing E2E test.
- **Recommendation:** Run the Personal navigation E2E test.
- **Recommendation:** Run `verify:tenant-identity`.
- **Recommendation:** Run `verify:restaurant`.
- **Recommendation:** Test all legacy compatibility mappings with a table-driven test.
- **Recommendation:** Assert that no template ID creates a new route automatically.
- **Recommendation:** Assert that Projects cannot be parsed as a workspace type or template.
- **Recommendation:** Assert that each recommended module exists in the module catalog.
- **Recommendation:** Assert that unavailable modules cannot be returned in a beta-ready recommendation set.
- **Recommendation:** Inspect `git diff --name-only` and confirm only intentionally scoped files changed.

## 13. Exact Codex prompt only after the review

```text
Implement the smallest workspace-architecture compatibility milestone described in docs/WORKSPACE_ARCHITECTURE_REVIEW.md.

Scope:
- Add a code-only central catalog/resolver for workspace types, templates, modules, module maturity, legacy segment mappings, and unchanged legacy routes.
- Workspace types must be exactly Commerce, Services, and Personal.
- Projects must be a module only, never a workspace type or template.
- Preserve Restaurant, Pharmacy, Retail, Supermarket, and Personal as legacy templates/routes.
- Map every currently accepted segment from frontend and backend types.
- Map Auto Parts semantically to Commerce.
- Map Services semantically to Services; do not classify it as Personal, even if the current temporary route remains documented for compatibility.
- Add focused automated tests for the resolver.

Do not:
- change the database schema or migrations;
- change backend API request/response contracts;
- change onboarding UI or behavior;
- change application routes or redirects;
- change Restaurant, Pharmacy, Retail, Supermarket, or Personal views;
- change deployment configuration or environment variables;
- build a marketplace, builder, slider system, or permission framework;
- commit or push.

Before editing, inspect the current working tree and preserve unrelated user changes. After implementation, run the relevant frontend/backend builds and focused tests, then report changed files, verification results, and any unresolved assumptions.
```

## 14. Next 3 steps

1. **Recommendation:** Review and approve the vocabulary and mappings in this document with product and the owners of the first three beta customer workflows.
2. **Recommendation:** Use the exact prompt in section 13 to implement only the compatibility catalog/resolver and its tests.
3. **Recommendation:** After that milestone passes without Restaurant regressions, design the beta-gated onboarding change using the catalog while continuing to write legacy segment and route values.
