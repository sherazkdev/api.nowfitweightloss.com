# Phase 3 report — Redis, cache, rate limiting

## Delivered

- `@weightloss/cache`
  - Redis clients: `cache`, `auth`, `queue` (URL split + fallback)
  - Cache-aside + stampede lock + TTL jitter
  - Version keys (`cachever:*`) + `CacheService`
  - `RateLimiter` (public, admin, login, upload, import buckets)
- API wiring
  - Connect Redis on boot
  - Global rate limit hook (+ `X-RateLimit-*` headers)
  - `/ready` checks Mongo **and** Redis
  - Graceful Redis shutdown on app close
- `docs/CACHE.md`

## Commands

```bash
npm install
npm run build -w @weightloss/cache -w @weightloss/api
npm run dev:api
curl http://localhost:5000/ready
```

Requires `.env` with valid `MONGODB_URI` and `REDIS_URL`.

## Next phase

**Phase 4:** Auth (JWT + refresh in Redis auth client), admin seed, login rate limit on `/api/admin/login`.

## Open issues

- Login/upload/import limits defined but applied on dedicated routes in later phases.
- BullMQ uses `redis.queue` client in Phase 9.
