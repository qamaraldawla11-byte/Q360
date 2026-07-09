# Q360 Module Registry

## Files created/changed

- `src/core/modules/moduleRegistry.ts`
- `src/core/modules/index.ts`
- `docs/Q360_MODULE_REGISTRY.md`

No routes, schemas, backend APIs, Restaurant lifecycle code, Customers, Quotes, LandingView, deployment files, or tenant identity/auth files were changed.

## How the registry works

`src/core/modules/moduleRegistry.ts` is a frontend code-level, read-only description of Q360 module status. It does not change runtime behavior and is not imported by the current route table or sidebar.

The registry exports:

- `q360WorkspaceRegistry`: current workspace/template status.
- `q360ModuleRegistry`: module metadata by workspace.
- `getQ360ModulesByWorkspace(workspaceKey)`: read helper.
- `getQ360ModuleDefinition(workspaceKey, moduleKey)`: read helper.
- `getQ360ModulesByStatus(status)`: read helper.

Each module definition includes:

- `moduleKey`
- `workspaceKey`
- `label`
- `description`
- `status`: `enabled`, `disabled`, `preview`, or `locked`
- `category`
- `isShared`
- `riskLevel`
- optional `routePath` for documentation/reference only

The optional `routePath` mirrors current routes but does not register, redirect, guard, hide, or enable any route.

## Current module statuses

Restaurant:

- `dashboard`: locked
- `pos`: enabled
- `menu`: enabled
- `tables`: enabled
- `kds`: enabled
- `payments`: enabled
- `daily-report`: enabled
- `inventory`: preview
- `staff`: preview
- `shifts-duties`: preview
- `settings`: locked

Retail:

- `dashboard`: locked
- `pos`: preview
- `catalog`: preview
- `inventory`: preview
- `customers`: enabled
- `quotes`: enabled
- `procurement`: preview
- `reports`: preview
- `settings`: locked

Pharmacy:

- Pharmacy workspace/template is preview.
- Pharmacy catalog, stock, suppliers, procurement, dispensing, prescriptions, staff, and reports are preview.
- Pharmacy is not described as validated production medical/pharmacy compliance.

Supermarket:

- Supermarket workspace/template is preview.
- POS, catalog, inventory, procurement, suppliers, offers, staff/shifts, reports, and settings are preview.

School:

- School workspace/template is preview.
- Dashboard is preview.

Shared/future:

- `customers`: enabled shared concept.
- `quotes`: enabled shared concept.
- `projects`: disabled future shared optional module, not a separate top-level workspace.
- `tasks`: disabled future shared module.
- `documents`: disabled future shared module.
- `business-pulse`: preview future read-only insight layer.

## What it does not do yet

The registry does not:

- Enable or disable modules dynamically.
- Change sidebar or route behavior.
- Add database tables.
- Add `/api/modules`.
- Enforce backend authorization.
- Hide UI modules.
- Delete or migrate module data.
- Modify Restaurant lifecycle, payments, KDS, or table logic.
- Modify Customers or Quotes behavior.
- Let AI enable or disable modules.

## Why backend authorization is still required

Frontend metadata is descriptive only. A user can still call APIs directly, so real module enforcement must eventually happen on the backend.

Future backend enforcement must still check:

- Authentication.
- Stable JWT `businessId` tenant scope.
- Role permission.
- Module enabled status where appropriate.
- Audit logging for owner/admin module configuration changes.

The registry is only the first safe foundation for consistent product language and future module settings work.

## Next safe future step

The next safe step is a read-only module settings view that displays this registry for owner/admin users without allowing changes. That view should still avoid route rewiring, schema changes, new backend APIs, dynamic toggles, and high-risk Restaurant lifecycle changes.
