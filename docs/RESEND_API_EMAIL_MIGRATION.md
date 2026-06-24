# Resend API Email Migration

## Why SMTP was removed

Railway Trial/Free blocks outbound SMTP traffic, so the previous Nodemailer SMTP transport could not deliver Q360 OTP emails from that deployment.

## New delivery architecture

The existing `sendOtpEmail(email, code)` service now uses Resend's official Node SDK over HTTPS. Authentication routes retain the same OTP generation, persistence, expiry, verification, and failure behavior. The sender remains `Q360 <no-reply@send.q360.app>`.

## Required environment variables

- `RESEND_API_KEY`
- `EMAIL_FROM`

`EMAIL_FROM` must be `Q360 <no-reply@send.q360.app>`.

## Files changed

- `backend/src/services/email.ts`
- `backend/src/routes/auth.ts`
- `backend/src/scripts/verify_resend_live.ts`
- `backend/src/scripts/verify_otp.ts`
- `backend/src/scripts/verify_tenant_identity.ts`
- `backend/package.json`
- `backend/package-lock.json`
- `.env.example`
- `backend/.env.example`
- `DEPLOYMENT.md`
- `docs/RESEND_API_LIVE_VERIFICATION.md`
- `docs/STAGING_DEPLOYMENT_RUNBOOK.md`
- `docs/RESEND_API_EMAIL_MIGRATION.md`

## Verification method

Build the backend, then run this once from the Railway backend service shell:

```bash
cd backend && VERIFY_EMAIL=your-test-inbox@example.com npm run verify:resend-live
```

The script validates configuration, generates an OTP only in memory, sends exactly one OTP-style email through the existing service, logs only success or failure with a masked recipient, and exits non-zero on failure.

## Railway compatibility

Resend delivery uses the HTTPS Email API rather than outbound SMTP ports, making it compatible with Railway Trial/Free networking. Railway must provide `RESEND_API_KEY` and `EMAIL_FROM`, and the one-time command must receive `VERIFY_EMAIL` inline.

## Rollback notes

Rollback by redeploying the last known-good commit. Restoring SMTP would also require a deployment platform and plan that permit outbound SMTP. Do not restore SMTP credentials to the Q360 Railway Trial/Free production path.
