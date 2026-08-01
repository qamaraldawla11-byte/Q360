# Q360 `/readyz` Readiness Contract

Task ID: Q360-PS-M6-S3

## Purpose

The existing `/health` endpoint is a liveness probe: it confirms the Node process is running and can respond to HTTP requests. It does not confirm that the process can serve traffic successfully.

The new `/readyz` endpoint is a readiness probe: it confirms the backend has everything it needs to handle requests, starting with a working database connection.

## Contract

### Endpoint

```text
GET /readyz
```

### Success Response (HTTP 200)

```json
{
  "status": "ready",
  "timestamp": "2026-07-31T15:59:41.517Z",
  "checks": {
    "database": {
      "status": "pass",
      "responseMs": 12
    }
  }
}
```

### Failure Response (HTTP 503)

```json
{
  "status": "not_ready",
  "timestamp": "2026-07-31T15:59:41.517Z",
  "checks": {
    "database": {
      "status": "fail",
      "error": "connection refused"
    }
  }
}
```

## Checks

| Check | Pass Criteria | Fail Criteria |
|-------|---------------|---------------|
| `database` | A simple `SELECT 1` query completes within the configured timeout. | Query throws, times out, or returns no row. |

## Behavior Rules

1. `/readyz` must not crash the process if the database is unavailable; it returns 503.
2. `/readyz` must not expose credentials, connection strings, or stack traces in the response.
3. `/readyz` must return quickly; the database query uses a short timeout.
4. `/readyz` is additive: `/health` remains unchanged and continues to serve liveness checks.

## Deployment Usage

- **Liveness probe**: use `/health`.
- **Readiness probe**: use `/readyz`.
- **Startup probe**: use `/health` initially, then `/readyz` once the container is expected to be ready.

## Future Extensions

Additional readiness checks may be added later (for example, external provider health, migration version alignment). Each new check must follow the same pass/fail shape and must not expose secrets.
