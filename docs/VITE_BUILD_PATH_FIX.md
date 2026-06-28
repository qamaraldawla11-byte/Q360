# Vite Build Path Fix

## Root cause

The local workspace path `D:\VS CODE App\One OS` is a junction to `D:\VS CODE App\Q360`. Vite kept the configured project root on the junction path, while dependency and source resolution followed the real path. During production HTML emission, that mismatch made Vite/Rollup see the HTML entry as outside the configured root.

## Exact invalid path source

The invalid emitted asset name was produced by Vite's built-in `vite:build-html` plugin after resolving the root as `D:/VS CODE App/One OS` and source/module paths under `D:/VS CODE App/Q360`. The relative path from the configured root to the realpath HTML entry became `../Q360/index.html`, which Rollup correctly rejects because emitted asset names cannot be relative paths.

## Files changed

- `vite.config.ts`
- `docs/VITE_BUILD_PATH_FIX.md`

## Why the fix is safe

The Vite config now sets `resolve.preserveSymlinks` to `true`, so Vite keeps module and source paths aligned with the configured project root when the checkout is opened through the junction. This does not change application code, backend code, APIs, schemas, routes, onboarding behavior, environment variables, Vercel rewrites, or output location.

## Build output verification

The intended production output directory remains Vite's default `dist/`. The fix does not configure Rollup to emit files outside `dist/` and does not alter Vercel's `outputDirectory`.

`npm run build` completed successfully and emitted `dist/index.html` plus bundled assets under `dist/assets/`.

## Regression test results

- `npm run build`: passed.
- `npm run lint`: passed.
- `cd backend && npm run build`: passed when run through `cmd.exe /c` because this PowerShell version does not support `&&`.
- `cd backend && npm run verify:tenant-identity`: passed with approved database/network access.
- `cd backend && npm run verify:otp`: passed with approved database/network access.
- `cd backend && npm run verify:restaurant`: passed with approved database/network access.

## Remaining limitations

This fix addresses the local junction/realpath mismatch that produced `../Q360/index.html`. It does not verify Vercel or Railway deployment status.
