# SMTP Live Verification

## Purpose

Send exactly one real OTP-style email through the existing Q360 OTP email service to a chosen verification inbox. This verifies SMTP submission and mailbox delivery observation; it does not validate the full browser login flow.

## Safety rules

- Use a dedicated staging or beta verification inbox.
- Pass `VERIFY_EMAIL` only for the one-time command. Do not save it permanently in Railway variables.
- Never print, paste, screenshot, commit, or log SMTP credentials, API keys, OTP codes, secrets, database URLs, or full recipient email addresses.
- Keep `SMTP_JSON_TRANSPORT` unset or set to `false`. The live verifier rejects JSON transport.
- The command sends exactly one email per invocation.

## Required environment variables

- `VERIFY_EMAIL`
- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

The existing SMTP transport also recognizes:

- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_JSON_TRANSPORT`

## Local execution

Configure the SMTP variable names in `backend/.env`, without committing that file. From `backend/`, compile and run:

```bash
npm run build
VERIFY_EMAIL=your-test-inbox@example.com npm run verify:smtp-live
```

## Railway execution

Run this one-time command in the deployed backend service shell, where Railway already provides the SMTP variables:

```bash
VERIFY_EMAIL=your-test-inbox@example.com npm run verify:smtp-live
```

Do not add `VERIFY_EMAIL` permanently to Railway variables.

## Expected success output

```text
SMTP live verification succeeded for y***@example.com.
```

The process exits with code `0`.

## Failure handling

Failure output contains only a failure status and masked recipient, and the process exits non-zero. Check variable presence, sender-domain authorization, provider status, network access, and the verification inbox without printing values or raw provider errors. Re-run only after correcting the smallest identified configuration or provider issue because every invocation attempts one real email.

## What this does not verify

This does not verify OTP persistence, OTP matching, authentication, session creation, browser login, tenant identity, payment integrity, Restaurant flows, Playwright behavior, inbox placement, or end-user deliverability across providers.
