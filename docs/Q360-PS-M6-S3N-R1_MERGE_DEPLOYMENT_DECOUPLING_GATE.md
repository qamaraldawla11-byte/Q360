# Q360-PS-M6-S3N-R1 — Merge/Deployment Decoupling Gate

**Scope:** Read-only operational verification for PR #16  
**Objective:** Determine whether PR #16 can be merged without automatically triggering production deployment or database mutation.  
**Date:** 2026-08-02  
**Operator:** Kimi Code CLI (read-only)  

---

## 1. Founder Brief

PR #16 (`integration/q360-ps-m6-s3l-wave0` → `main`) introduces Wave 0 integration changes that include **new Drizzle migration files and schema changes** (`backend/drizzle/0001_restaurant_partial_index_adoption.sql`, `backend/src/db/schema.ts`, etc.).

Current repository and platform state:

- `main` is the default branch and is **unprotected** (no required status checks, no required reviews).
- Railway and Vercel are both connected to this GitHub repository and **auto-deploy on every push to `main`**.
- `railway.json` configures a `preDeployCommand` that runs `cd backend && npm run db:push`, which will execute `drizzle-kit push` against the production database as part of the deployment.
- Current production deployments for both Railway and Vercel are pinned at commit `a76870e7b1bc93532b1469e0a138ec4fda55badf` (PR #15 merge).
- A preview deployment for PR #16 has already succeeded in Vercel.

**Bottom line:** Under the current configuration, merging PR #16 into `main` will immediately create a new production deployment in both Railway and Vercel, and Railway will attempt to run `db:push`. The merge is therefore **not decoupled from deployment or database mutation**.

**Verdict:** `BLOCKED` until auto-deploy is disabled or a controlled release branch is used.

---

## 2. Railway Evidence

### 2.1 Local deployment configuration

`railway.json` (repo root):

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd backend && npm ci --include=dev && npm run build"
  },
  "deploy": {
    "preDeployCommand": "cd backend && npm run db:push",
    "startCommand": "cd backend && npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300
  }
}
```

This is the only Railway deployment manifest in the repository. It explicitly instructs Railway to run `npm run db:push` **before every deployment**.

### 2.2 Current Railway production deployment

GitHub Deployments API response for the latest Railway production deployment:

```json
{
  "created_at": "2026-07-29T18:00:57Z",
  "creator": "railway-app[bot]",
  "description": "Deployed to Railway",
  "environment": "passionate-purpose / production",
  "id": 5662533262,
  "ref": "a76870e7b1bc93532b1469e0a138ec4fda55badf",
  "sha": "a76870e7b1bc93532b1469e0a138ec4fda55badf",
  "task": "deploy"
}
```

Latest status:

```json
{
  "created_at": "2026-07-29T18:48:51Z",
  "environment": "passionate-purpose / production",
  "environment_url": "https://railway.com/project/055d4303-229c-4009-b87e-b8b3f9220808?environmentId=e573887c-2993-4045-8eed-a2da55b600a6",
  "id": 16103624207,
  "state": "success",
  "target_url": "https://railway.com/project/055d4303-229c-4009-b87e-b8b3f9220808?environmentId=e573887c-2993-4045-8eed-a2da55b600a6"
}
```

### 2.3 Auto-deploy pattern

Recent Railway production deployments (all triggered by `railway-app[bot]` immediately after `main` commits):

```
2026-07-29T18:00:57Z 5662533262 a76870e7b1bc93532b1469e0a138ec4fda55badf
2026-07-27T15:41:28Z 5625392285 5e68d70e3cef796126b4821bc747ddd66e23eae0
2026-07-27T14:14:07Z 5623982644 ff28dd71c9a3901043886a3ffc781f38f113b6c2
2026-07-26T20:47:21Z 5613943676 4bdf7eeaef56d170f33cb9b7ab1b6ba46b51a665
2026-07-23T17:46:42Z 5577156767 bac07cc9e1ccc9509c6f5e745d18208812dca6ff
```

Each deployment SHA matches a `main` branch merge commit, confirming that Railway is set to deploy the production branch (`main`) automatically on every push.

---

## 3. Vercel Evidence

### 3.1 Local deployment configuration

`vercel.json` (repo root):

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

`.vercelignore` excludes the `backend/` directory, so Vercel only builds the frontend.

### 3.2 Current Vercel production deployment

GitHub Deployments API response for the latest Vercel production deployment:

```json
{
  "created_at": "2026-07-29T18:01:22Z",
  "creator": "vercel[bot]",
  "description": null,
  "environment": "Production",
  "id": 5662539400,
  "ref": "a76870e7b1bc93532b1469e0a138ec4fda55badf",
  "sha": "a76870e7b1bc93532b1469e0a138ec4fda55badf",
  "task": "deploy"
}
```

Latest status:

```json
{
  "created_at": "2026-07-29T18:01:23Z",
  "description": "Deployment has completed",
  "environment": "Production",
  "environment_url": "https://q360-o2tk2aq8o-qamaraldawla11-bytes-projects.vercel.app",
  "id": 16101716567,
  "state": "success",
  "target_url": "https://q360-o2tk2aq8o-qamaraldawla11-bytes-projects.vercel.app"
}
```

### 3.3 PR #16 preview deployment

Vercel status check on PR #16:

```json
{
  "__typename": "StatusContext",
  "context": "Vercel",
  "startedAt": "2026-08-02T00:08:22Z",
  "state": "SUCCESS",
  "targetUrl": "https://vercel.com/qamaraldawla11-bytes-projects/q360/6HrRmhMA5dUAw7CRwzjkqEY6afik"
}
```

The preview deployment for the PR branch succeeded at:

```json
{
  "created_at": "2026-08-02T00:08:22Z",
  "environment": "Preview",
  "environment_url": "https://q360-mqcxh243n-qamaraldawla11-bytes-projects.vercel.app",
  "id": 16236921464,
  "state": "success",
  "target_url": "https://q360-mqcxh243n-qamaraldawla11-bytes-projects.vercel.app"
}
```

### 3.4 Auto-deploy pattern

Recent Vercel production deployments (all triggered by `vercel[bot]` immediately after `main` commits):

```
2026-07-29T18:01:22Z 5662539400 a76870e7b1bc93532b1469e0a138ec4fda55badf
2026-07-27T15:41:48Z 5625397360 5e68d70e3cef796126b4821bc747ddd66e23eae0
2026-07-27T14:14:28Z 5623988498 ff28dd71c9a3901043886a3ffc781f38f113b6c2
2026-07-26T20:47:46Z 5613946756 4bdf7eeaef56d170f33cb9b7ab1b6ba46b51a665
2026-07-23T17:47:15Z 5577164121 bac07cc9e1ccc9509c6f5e745d18208812dca6ff
```

Vercel deploys the `Production` environment for every `main` branch push.

---

## 4. db:push Risk Assessment

### 4.1 Execution path

1. Merge PR #16 → `main`.
2. GitHub push webhook fires.
3. Railway starts a deployment using `railway.json`.
4. Railway build phase runs `cd backend && npm ci --include=dev && npm run build`.
5. Railway **pre-deploy phase** runs `cd backend && npm run db:push`.
6. `npm run db:push` resolves to `drizzle-kit push`.
7. `drizzle.config.ts` loads `DATABASE_URL` from the Railway environment and pushes schema changes to the connected Postgres instance.

### 4.2 Local guard

`backend/src/utils/env.ts` contains a staging-only guard:

```ts
export const requireQ360StagingDatabaseGuard = (commandName: string) => {
    if (process.env.Q360_DATABASE_ENV !== 'staging') {
        throw new Error(
            `${commandName} is blocked: set Q360_DATABASE_ENV=staging to confirm the isolated Q360 staging database.`,
        );
    }
    if (process.env.Q360_DATABASE_NAME !== 'q360-staging') {
        throw new Error(
            `${commandName} is blocked: set Q360_DATABASE_NAME=q360-staging as the human-readable staging database marker.`,
        );
    }
};
```

This guard is invoked by `drizzle.config.ts` for `db:push`.

**Interpretation:** If the Railway production environment does **not** set `Q360_DATABASE_ENV=staging` and `Q360_DATABASE_NAME=q360-staging`, `db:push` will fail and the deployment will be aborted. This protects the database from mutation, but it also causes a failed production deployment immediately after merge. If those variables *were* set to staging values in production, `db:push` would mutate the production database.

### 4.3 PR changes that would be affected

Files changed by PR #16 that relate to database schema/migrations:

```
backend/drizzle-baseline/0001_staging_reconcile.sql
backend/drizzle/0000_wave0_initial.sql
backend/drizzle/0001_restaurant_partial_index_adoption.sql
backend/drizzle/meta/0000_snapshot.json
backend/drizzle/meta/0001_snapshot.json
backend/drizzle/meta/_journal.json
backend/src/db/schema.ts
backend/src/scripts/migrate_noninteractive.ts
backend/migration-manifests/Q360-PS-M6-S3F-final-manifest.json
```

Because the PR includes schema changes, a successful `db:push` would alter the production database. A failed `db:push` would leave the production deployment in a failed state.

### 4.4 Risk rating

| Factor | Assessment |
|--------|------------|
| Auto-deploy on `main` | Confirmed |
| `db:push` in pre-deploy command | Confirmed |
| Production database mutation path | Exists |
| Local guard against prod db:push | Present but env-dependent |
| Ability to verify Railway env vars from repo | Not available |
| Branch protection / required approvals | None |

**Risk:** **HIGH**. The deployment pipeline is coupled to a schema-mutating command, and the only safety net is an environment-variable guard that has not been verified against the live production environment.

---

## 5. Current Rollback State

### 5.1 Production versions

| Platform | Environment | Current SHA | Deployment ID | Status | Timestamp |
|----------|-------------|-------------|---------------|--------|-----------|
| Railway | `passionate-purpose / production` | `a76870e7b1bc93532b1469e0a138ec4fda55badf` | `5662533262` | success | 2026-07-29T18:00:57Z |
| Vercel | `Production` | `a76870e7b1bc93532b1469e0a138ec4fda55badf` | `5662539400` | success | 2026-07-29T18:01:22Z |

The commit message for the current production SHA is:

```
Merge pull request #15 from qamaraldawla11-byte/integration/q360-core-m1-r7
CORE M1: Shared Customers and Quotes entitlement
```

### 5.2 Rollback points (last 5 known-good production deployments)

**Railway:**

```
a76870e7b1bc93532b1469e0a138ec4fda55badf  (current)
5e68d70e3cef796126b4821bc747ddd66e23eae0
ff28dd71c9a3901043886a3ffc781f38f113b6c2
4bdf7eeaef56d170f33cb9b7ab1b6ba46b51a665
bac07cc9e1ccc9509c6f5e745d18208812dca6ff
```

**Vercel:**

```
a76870e7b1bc93532b1469e0a138ec4fda55badf  (current)
5e68d70e3cef796126b4821bc747ddd66e23eae0
ff28dd71c9a3901043886a3ffc781f38f113b6c2
4bdf7eeaef56d170f33cb9b7ab1b6ba46b51a665
bac07cc9e1ccc9509c6f5e745d18208812dca6ff
```

Both platforms can be rolled back to any previous successful deployment via their respective dashboards:

- Railway: https://railway.com/project/055d4303-229c-4009-b87e-b8b3f9220808?environmentId=e573887c-2993-4045-8eed-a2da55b600a6
- Vercel: https://vercel.com/qamaraldawla11-bytes-projects/q360

---

## 6. Recommended Merge Procedure

### Option A — Temporarily disable auto deployment (recommended for PR #16)

1. Open the Railway dashboard for the project and pause automatic deployments for the `main` branch.
2. Open the Vercel dashboard for the project and pause automatic production deployments for the `main` branch.
3. Merge PR #16 into `main`.
4. Verify that no deployment was triggered in either dashboard.
5. Run the Wave 0 migrations manually from a controlled environment using the project's explicit migration script (`backend/src/scripts/migrate_noninteractive.ts`) or another approved process.
6. Re-enable Railway and Vercel auto-deploy.
7. Trigger a manual deployment or push an empty commit to deploy the merged code.

**Pros:** Simple, no branch changes, preserves existing `main`-based workflow.  
**Cons:** Requires dashboard access and remembering to re-enable auto-deploy.

### Option B — Merge with deployment paused

This is operationally the same as Option A, but performed by opening the deployment queue/pause state in each dashboard right before clicking merge. It is only safe if the pause is confirmed before the merge event is processed.

**Pros:** Minimal steps.  
**Cons:** Higher chance of race condition if the webhook fires before the pause takes effect.

### Option C — Create a controlled release branch

1. Create a long-lived `release` branch from the current `main`.
2. In Railway and Vercel, change the production branch trigger from `main` to `release`.
3. Merge PR #16 into `main`.
4. Validate `main` in staging/preview.
5. Fast-forward `release` to the validated `main` commit only when ready to deploy.
6. Optionally add branch protection to `release` so it cannot be fast-forwarded without approval.

**Pros:** Permanently decouples merge from deployment; supports staged rollouts.  
**Cons:** Requires ongoing branch discipline and a one-time dashboard configuration change.

### Recommendation

For PR #16, use **Option A** because it is the fastest way to safely land the current change without restructuring the branching model. After the Wave 0 release is stable, adopt **Option C** as the standard release policy.

---

## 7. Verdict

**BLOCKED**

PR #16 cannot be merged safely under the current configuration because:

1. `main` is unprotected, so a merge will immediately trigger webhooks.
2. Railway is configured to auto-deploy on `main` and to run `npm run db:push` as a pre-deploy command.
3. Vercel is configured to auto-deploy the `Production` environment on `main`.
4. PR #16 includes schema/migration changes that `db:push` would attempt to apply to the live database.
5. The local `db:push` guard relies on unverified production environment variables; if they are not set correctly, the deployment will fail rather than mutate data, but either outcome violates the decoupling requirement.

**Required before merge:** Disable or pause automatic production deployments in Railway and Vercel, and execute database changes through an explicit, reviewed migration process rather than the deployment pipeline.
