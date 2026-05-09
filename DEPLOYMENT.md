# One OS — Production Deployment Guide

## Pre-Deployment Status: ✅ READY

---

## Phase 0 — Pre-Deployment Gates (ALL PASSED)

| Gate | Check | Status |
|------|-------|--------|
| Code | All 6 fixes merged | ✅ |
| Secrets | `.env` in `.gitignore` | ✅ |
| Secrets | `.env.example` committed | ✅ |
| JWT | Secret enforcement | ✅ |
| Backup | Strategy implemented | ✅ |
| Freeze | No pending changes | ✅ |

---

## Phase 1 — Backend Deployment (Railway)

### 1.1 Environment Variables

Set these in Railway dashboard → Variables:

```env
# REQUIRED
NODE_ENV=production
JWT_SECRET=<generate-64-char-random-string>
CORS_ORIGINS=https://app.one-os.io,https://one-os.io

# OPTIONAL
PORT=3001
BACKUP_DIR=/app/backend/backups
BACKUP_RETENTION_DAYS=14
```

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 1.2 Railway Configuration

```yaml
# railway.toml (if using)
[build]
  builder = "nixpacks"

[deploy]
  startCommand = "cd backend && npm run start"
  restartPolicyType = "on_failure"

[service]
  healthcheckPath = "/"
  healthcheckTimeout = 10
```

### 1.3 Persistent Volume (REQUIRED)

In Railway dashboard:
1. Go to service settings
2. Add Volume Mount:
   - **Mount Path**: `/app/backend/data`
   - **Size**: 1 GB

This ensures SQLite database survives deployments.

### 1.4 Health Verification

```bash
curl https://your-app.railway.app/
# Expected: {"name":"One OS Backend","version":"0.0.1","status":"running",...}

curl -X POST https://your-app.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
# Expected: {"token":"...","user":{...}}
```

---

## Phase 2 — Backup System (MANDATORY)

### 2.1 Backup Script

Located at: `backend/src/scripts/backup.ts`

**Manual backup:**
```bash
cd backend && npm run db:backup
```

**Output:**
```
🔄 One OS Database Backup
   Source: ./data/one-os.db
   Target: ./backups
   Retention: 14 days

✅ Backup created: one-os-backup-2026-01-14T01-45-00.db (0.05 MB)
✅ Backup complete
```

### 2.2 Railway Cron Job (Daily Backup)

Option A: **Railway Cron Service**
1. Create new service in Railway project
2. Set:
   - **Schedule**: `0 2 * * *` (daily at 2 AM UTC)
   - **Command**: `cd backend && npm run db:backup`

Option B: **External Cron (e.g., cron-job.org)**
1. Create HTTP endpoint for backup trigger (secured)
2. Schedule daily call

### 2.3 Backup Retention

- **Default**: 14 days
- **Location**: `backend/backups/`
- **Format**: `one-os-backup-YYYY-MM-DDTHH-MM-SS.db`
- **Auto-cleanup**: Old backups deleted automatically

### 2.4 Restore Procedure

```bash
# Stop the server first
# Copy backup over current database
cp backups/one-os-backup-2026-01-14T01-00-00.db data/one-os.db
# Restart server
```

---

## Phase 3 — Frontend Deployment (Vercel)

### 3.1 Environment Variables

Set in Vercel dashboard → Settings → Environment Variables:

```env
VITE_API_BASE_URL=https://your-app.railway.app/api
VITE_SIMULATION_MODE=false
```

### 3.2 Build Configuration

```yaml
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
Node.js Version: 20.x
```

### 3.3 Deploy

1. Connect GitHub repository
2. Deploy from `main` branch
3. Wait for build completion
4. Verify at production URL

### 3.4 Frontend Verification

| Check | Expected |
|-------|----------|
| App loads | No console errors |
| Login | Token received |
| POS page | Loads correctly |
| Create order | Persists to backend |
| Refresh | Order still visible |

---

## Phase 4 — PWA Verification

### 4.1 Manifest Check

Open Chrome DevTools → Application → Manifest

| Field | Expected |
|-------|----------|
| Name | One OS - Business Operating System |
| Display | standalone |
| Start URL | / |
| Icons | At least 1 valid |

### 4.2 Android Tablet Test

1. Open Chrome on Android tablet
2. Navigate to production URL
3. Verify "Add to Home Screen" appears
4. Install and launch
5. Confirm:
   - [ ] Full-screen app mode
   - [ ] Theme color in status bar
   - [ ] App icon on home screen

### 4.3 Touch Target Verification

All interactive elements must be ≥ 48x48 pixels for touch accessibility.

---

## Phase 5 — Final Launch Gate

### Authorization Checklist

| Condition | Required | Status |
|-----------|----------|--------|
| Backend deployed | Yes | ⬜ |
| Frontend deployed | Yes | ⬜ |
| Health endpoint 200 | Yes | ⬜ |
| Orders persist | Yes | ⬜ |
| No duplicate orders | Yes | ⬜ |
| Android install works | Yes | ⬜ |
| Backup system running | Yes | ⬜ |
| First backup created | Yes | ⬜ |

### Launch Command

When all boxes checked:

```
🟢 LAUNCH STATUS: GO
   Date: 2026-01-20
   Time: [Your timezone]
```

---

## Post-Launch Monitoring

### Allowed Actions
- ✅ Monitor Railway/Vercel dashboards
- ✅ Check backup execution logs
- ✅ Respond to user support
- ✅ View audit logs in admin panel

### Prohibited Actions
- ❌ Code changes
- ❌ Database schema changes
- ❌ Hot fixes (unless critical data loss)
- ❌ New feature deployment

---

## Rollback Procedure

### If Critical Failure:

1. **Frontend Rollback**
   - Vercel → Deployments → Previous → Redeploy

2. **Backend Rollback**
   - Railway → Deployments → Previous → Redeploy

3. **Database Restore**
   ```bash
   # SSH into Railway or use Railway CLI
   cd backend
   cp backups/one-os-backup-LATEST.db data/one-os.db
   # Restart service
   ```

---

## Support & Escalation

| Issue Type | Action |
|------------|--------|
| Login failure | Check JWT_SECRET, CORS |
| Order not saving | Check database volume mount |
| PWA not installing | Check manifest.json serving |
| CORS errors | Check CORS_ORIGINS env var |

---

*Last Updated: 2026-01-14*  
*Authority: CTO Final*  
*Version: 1.0.0*
