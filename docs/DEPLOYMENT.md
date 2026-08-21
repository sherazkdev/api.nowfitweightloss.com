# Deployment guide

Run the platform in production with **local media storage** (`public/uploads` on the API host). No AWS required.

## Architecture

| Service | Role | Port (default) |
|---------|------|----------------|
| **API** | Fastify — public content + admin API + `/uploads` static files | 5000 |
| **Worker** | BullMQ — CSV import/export, raw import | — |
| **Admin** | Next.js admin panel | 3000 |
| **MongoDB** | Primary database | 27017 |
| **Redis** | Cache, rate limits, job queues, auth sessions | 6379 |

All three app processes read the same `.env` from the repository root via `@weightloss/config`.

## Quick start — Docker Compose (local / staging)

1. Copy env template:

   ```powershell
   copy .env.docker.example .env
   ```

2. Start stack:

   ```powershell
   npm run docker:up
   ```

3. Open:
   - Admin: http://localhost:3000
   - API: http://localhost:5000/health
   - Sign in: `admin@example.com` / `ChangeMeDocker123` (from `.env.docker.example`)

4. Logs:

   ```powershell
   npm run docker:logs
   ```

5. Stop:

   ```powershell
   npm run docker:down
   ```

Uploads persist in the `uploads_data` Docker volume.

## Production — bare metal / VPS

### 1. Prerequisites

- Node.js 20+
- MongoDB 7+
- Redis 7+
- Reverse proxy (nginx, Caddy, etc.) with TLS

### 2. Environment

```powershell
copy .env.production.example .env
```

Set at minimum:

- `NODE_ENV=production`
- Strong secrets (32+ chars) for JWT and cookie keys
- `ADMIN_SEED_ENABLED=false` after first admin exists
- `COOKIE_SECURE=true`
- `API_DOCS_ENABLED=false`
- `TRUST_PROXY=true` when behind a reverse proxy
- `ALLOWED_ORIGINS` = your admin URL(s)
- `API_PUBLIC_URL`, `ADMIN_PUBLIC_URL`, `NEXT_PUBLIC_API_URL`, `PUBLIC_MEDIA_BASE_URL`

Production boot **fails fast** if weak placeholders or unsafe flags are left enabled (`@weightloss/config` validates on startup).

### 3. Build

```powershell
npm ci
npm run build:api
npm run build:worker
npm run build:admin
npm run db:indexes
```

Bootstrap admin (first deploy only):

```powershell
# Keep ADMIN_SEED_ENABLED=false in production .env — CLI seed bypasses that guard.
npm run db:seed-admin
```

On Linux VPS after `git pull`, always reinstall deps on the server (do not copy `node_modules` from Windows):

```bash
cd /var/www/weight-loss-v2
git pull origin main
git restore package-lock.json   # if a broken 6-line lock file appears
rm -rf node_modules apps/admin/.next
npm ci
npm run build:api
npm run build:worker
npm run build:admin
pm2 start ecosystem.config.cjs
pm2 save
```

If admin build fails with `lightningcss.linux-x64-gnu.node` missing:

```bash
node scripts/ensure-native-deps.mjs
npm run build:admin
```

### 4. Run processes

Use a process manager (systemd, PM2, etc.):

```powershell
npm run start:api      # :5000
npm run start:worker   # required for CSV jobs
npm run start:admin    # :3000
```

Ensure `UPLOAD_ROOT` exists and is writable by the API and worker (same path on both hosts if split).

### 5. Reverse proxy

Example nginx goals:

- `https://api.example.com` → API `:5000`
- `https://admin.example.com` → Admin `:3000`
- Serve `/uploads/` through the API (or proxy that path to API)

Set `TRUST_PROXY=true` so rate limits use the real client IP from `X-Forwarded-For`.

### 6. Health checks

| Endpoint | Use |
|----------|-----|
| `GET /health` | Liveness — process up |
| `GET /ready` | Readiness — Mongo + Redis reachable |

## Public API hardening (Phase 12)

- Pagination capped by `MAX_PAGE_SIZE` (default 100)
- Search strings capped at 100 characters
- Rate limiting on all routes (public + admin + login)
- Security headers on every response
- Swagger disabled when `API_DOCS_ENABLED=false`
- Production env validation for secrets and bootstrap flags

## Media storage

Default: **local only**

```env
STORAGE_DRIVER=local
UPLOAD_ROOT=/var/lib/weightloss/uploads
PUBLIC_MEDIA_BASE_URL=https://api.example.com/uploads
```

Files are written by the API/worker and served at `/uploads/...` by the API process.

## Background jobs

The worker **must** run for CSV import/export and raw import queues. Without it, jobs stay `queued`.

## Related docs

- [`ENVIRONMENT.md`](ENVIRONMENT.md) — all variables
- [`AUTH.md`](AUTH.md) — login, cookies, API keys
- [`PHASE-12.md`](PHASE-12.md) — phase deliverables
