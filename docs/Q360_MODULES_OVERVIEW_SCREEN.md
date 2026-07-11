# Q360 Modules Overview Screen

## Outcome

Q360 now has a read-only Restaurant Modules overview at `/app/restaurant/modules`.

The screen gives an owner a clear view of current Restaurant and shared-module availability without enabling module configuration.

## Files changed

- `src/modules/commerce/restaurant/views/ModulesOverviewView.tsx`
- `src/modules/commerce/restaurant/manifest.ts`
- `src/layouts/SmeLayout.tsx`
- `src/views/routes.tsx`
- `docs/Q360_MODULES_OVERVIEW_SCREEN.md`

## Registry data used

The screen imports definitions through `src/core/modules` and uses `getQ360ModulesByWorkspace` for the `restaurant` and `shared` workspaces. It does not duplicate module status definitions.

## Statuses shown

- Enabled: active operational modules.
- Preview: visible product direction that is not production-ready.
- Locked: protected capabilities that must not be changed casually.
- Future: disabled modules planned for later work.

The page also identifies reusable shared capabilities versus workspace-specific modules.

## Read-only boundaries

The overview does not provide toggles, persist preferences, hide routes, change authorization, change tenant identity, change schema, change Restaurant behavior, delete data, or allow AI to change module states.

## Postponed

- Owner-approved low-risk module toggles.
- Per-business module persistence.
- Backend enforcement for disabled modules.
- Module marketplace behavior.
- Offline module behavior.
- Business Pulse awareness of enabled modules.

## Responsive behavior

The screen uses a two-column card grid on larger displays and a single-column layout on phones. Status badges and explanatory notices remain visible at narrow widths.

## Verification

The implementation is verified with the standard frontend and backend build/lint gates and focused Customers, Quotes, tenant-identity, and Restaurant verification scripts. Exact results are recorded in the task handoff.
