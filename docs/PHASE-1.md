# Phase 1 report — project structure, config, types, logger

## Files created

- Monorepo: npm workspaces in root `package.json`, `tsconfig.base.json`
- `apps/admin/` — existing Next.js UI (moved from repo root)
- `apps/api/` — Fastify bootstrap (`/`, `/health`, `/ready`)
- `apps/worker/` — worker bootstrap (BullMQ in Phase 9)
- `packages/config/` — Zod env schema
- `packages/contracts/` — Mongo domain types + browseKeys helper
- `packages/logger/` — Pino logger with redaction
- `packages/shared/` — normalize helpers
- Stub packages: `database`, `cache`, `queue`, `storage`, `auth`
- `.env.example`, `docs/ENVIRONMENT.md`

## Endpoints (Phase 1)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/` | JSON or HTML via Accept |
| GET | `/health` | Process liveness |
| GET | `/ready` | Dependency checks in Phase 2/3 |

## Open issues

1. **`existing-system-audit/` not in repo** — add before legacy public API work (Phase 5).
2. **Admin dev path changed** — run `npm run dev:admin` from repo root (admin lives in `apps/admin`).
3. **Disk space on E:** — keep ~1GB free for `.next` / Turbopack cache.

## Next phase

**Phase 2:** Mongo client, counters, collections, index scripts.
