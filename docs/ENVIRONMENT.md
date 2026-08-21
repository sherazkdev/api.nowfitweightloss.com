# Environment

All services load configuration through `@weightloss/config` (`loadEnvSafe()`).

1. Copy `.env.example` to `.env` at the repository root.
2. Replace every `CHANGE_ME` placeholder.
3. Never commit `.env` or log secret values.

## Required secrets

- `MONGODB_URI`
- `REDIS_URL`
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (min 16 chars)
- `COOKIE_SECRET` (min 16 chars)
- `ADMIN_SEED_PASSWORD` (initial bootstrap only)

## Optional Redis split

Leave blank to fall back to `REDIS_URL`:

- `REDIS_CACHE_URL`
- `REDIS_QUEUE_URL`
- `REDIS_AUTH_URL`

## Admin bootstrap

When `ADMIN_SEED_ENABLED=true`, the API seeds one admin if the email does not exist. Existing admins are never overwritten. Set `ADMIN_SEED_ENABLED=false` after production bootstrap.

## Production

Copy `.env.production.example` to `.env` and set real secrets. With `NODE_ENV=production`, startup validates:

- `ADMIN_SEED_ENABLED=false`
- `COOKIE_SECURE=true`
- JWT/cookie secrets are strong (32+ chars, no placeholders)
- `API_DOCS_ENABLED=false` (recommended)

Set `TRUST_PROXY=true` when the API runs behind nginx/Caddy/load balancer.

### Metrics

| Variable | Default | Description |
|----------|---------|-------------|
| `METRICS_ENABLED` | `true` | Expose Prometheus `/metrics` |
| `METRICS_PATH` | `/metrics` | Scrape path |
| `METRICS_TOKEN` | empty | Bearer token (required in production when metrics enabled) |

### Public API versioning

| Variable | Default | Description |
|----------|---------|-------------|
| `API_LEGACY_SUNSET` | `2027-06-01` | `Sunset` header date for legacy `/api/*` routes |

See `docs/DEPLOYMENT.md` for full production and Docker Compose instructions.

## Docker Compose

Copy `.env.docker.example` to `.env`, then `npm run docker:up`.

## Audit reference

Legacy behavior is defined in `existing-system-audit/` (add to repo before Phase 5 public endpoints).
