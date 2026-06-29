# Public App Runtime Fix

## Root cause

The workspace path `D:\VS CODE App\One OS` is a junction to `D:\VS CODE App\Q360`. Vite was configured with `resolve.preserveSymlinks: true`, so the dev/runtime graph could preserve the junction path for application modules while optimized dependencies resolved React through a separate module identity. In the browser, the failing route showed `AppContent` calling `useAuthStore()` and React reporting an invalid hook call from Zustand's `useStore`, with source URLs mixed between `/src/App.tsx` and `@fs/D:/VS CODE App/Q360/...`.

`AppContent` itself did not call hooks conditionally, after an early return, inside a loop, callback, nested function, or event handler. `npm ls react react-dom zustand react-router-dom` showed a single deduped React/React DOM version pair. The invalid hook call was caused by Vite resolver identity splitting in the junction workspace, not by duplicate package entries in `node_modules` or a source-level Rules of Hooks violation.

## Exact files changed

- `vite.config.ts`
- `docs/PUBLIC_APP_RUNTIME_FIX.md`

## Why build/lint did not catch the issue

The hooks lint rules can catch source-level violations such as conditional hooks, hooks after early returns, nested hook calls, and incorrect custom-hook usage. This issue came from runtime module resolution identity in a junction workspace, where browser-served modules could resolve through different filesystem identities.

TypeScript and the production build also operate from the local project graph and do not reproduce the browser dev server's pre-optimized dependency identity split until the app is actually served and mounted in the browser.

## Fix applied

Added `resolve.dedupe: ['react', 'react-dom']` in `vite.config.ts` while keeping the existing symlink-preserving workspace behavior. This forces React and React DOM to resolve to one runtime copy, which keeps Zustand hook calls inside the same React dispatcher as the app renderer.

## Browser routes verified

Verified with the local Vite dev server command:

```bash
npm run dev -- --host 127.0.0.1 --port 5174
```

Browser/runtime verification loaded each route and confirmed it rendered page content without the global `System Error` screen:

- `/`
- `/pricing`
- `/support`
- `/docs`
- `/ai`

## Any remaining runtime risk

The public routes now render normally in the local browser/runtime. Remaining risk is limited to other environments that may intentionally depend on symlink-preserving module resolution; no such dependency was found in the required investigation.
