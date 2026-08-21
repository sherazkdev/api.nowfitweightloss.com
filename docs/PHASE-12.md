# Phase 12 report — Deployment & production hardening

## Delivered

### Production environment validation

- `@weightloss/config` enforces production-safe settings when `NODE_ENV=production`:
  - `ADMIN_SEED_ENABLED=false`
  - `COOKIE_SECURE=true`
  - Strong JWT/cookie secrets (32+ chars, no `CHANGE_ME`)
  - `API_DOCS_ENABLED=false` (unless intentionally public)
- New `TRUST_PROXY` flag for reverse-proxy deployments

### Public API hardening

- Pagination uses `MAX_PAGE_SIZE` / `DEFAULT_PAGE_SIZE` from env (not hardcoded 200)
- Search query max length 100 chars; `browse_key` max 64
- Security headers on all API responses (`X-Content-Type-Options`, `HSTS` in production, etc.)
- Swagger only registered when `API_DOCS_ENABLED=true`
- Rate limit IP resolution respects `TRUST_PROXY` + Fastify `trustProxy`

### Docker Compose

- `docker-compose.yml` — MongoDB, Redis, API, worker, admin
- `docker/Dockerfile.api`, `Dockerfile.worker`, `Dockerfile.admin`
- `.env.docker.example` — ready-to-run local stack env
- `.dockerignore`
- npm scripts: `docker:up`, `docker:down`, `docker:logs`

### Deployment docs & templates

- `docs/DEPLOYMENT.md` — Docker + bare-metal production guide
- `.env.production.example` — production template (local uploads, no AWS)
- Root `start:worker` script
- Updated `.env.example` with `TRUST_PROXY`

## Verify

### Build

```powershell
npm run build:api
npm run build:worker
npm run build:admin
```

### Docker (optional)

```powershell
copy .env.docker.example .env
npm run docker:up
```

Then open http://localhost:3000 and http://localhost:5000/health

### Production env check

```powershell
# Should fail with clear validation errors if placeholders remain:
$env:NODE_ENV="production"; npm run start:api
```

## Next phase

**Phase 13:** Mobile/client SDK docs, API versioning, or observability (metrics, structured alerts).

## Open issues

- Docker Mongo/Redis have no auth (fine for local compose; use managed/auth DBs in real production)
- Admin Docker image bakes `NEXT_PUBLIC_API_URL` at build time — rebuild if API URL changes
- Legacy sync `POST /api/admin/raw-upload` still exists alongside queued raw import
