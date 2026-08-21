# Redis cache

## Roles

Three logical Redis connections (can share one URL):

| Role | Env | Purpose |
|---|---|---|
| cache | `REDIS_CACHE_URL` → `REDIS_URL` | Public/admin response cache, rate limits |
| auth | `REDIS_AUTH_URL` → `REDIS_URL` | Refresh sessions (Phase 4) |
| queue | `REDIS_QUEUE_URL` → `REDIS_URL` | BullMQ (Phase 9) |

All keys are prefixed with `REDIS_KEY_PREFIX` (default `weightloss:`).

## Cache-aside

Use `CacheService` from `@weightloss/cache`:

```ts
const result = await app.cache.publicGetOrSet(
  "meals",
  ["list", categoryId, page, limit],
  app.cache.listTtl(),
  () => loadMealsFromMongo(),
);
request.cacheHit = result.hit;
```

Flow:

1. Read Redis
2. On miss, acquire stampede lock (`lock:{key}`)
3. Load from MongoDB
4. SET with TTL (+ jitter)
5. Waiters retry Redis briefly before loading

If Redis is unavailable, loaders run directly (public paths stay up).

## Version invalidation

Version keys:

```text
cachever:mealCategories
cachever:meals
cachever:workoutLevels
cachever:workoutCategories
cachever:exercises
cachever:dashboard
```

On mutation:

```ts
await app.cache.bumpVersion("meals");
```

No wildcard deletes.

## TTL defaults (seconds)

| Kind | Env | Default |
|---|---|---|
| detail | `CACHE_DETAIL_TTL_SECONDS` | 600 |
| list | `CACHE_LIST_TTL_SECONDS` | 300 |
| dashboard | `CACHE_DASHBOARD_TTL_SECONDS` | 60 |
| negative | `CACHE_NEGATIVE_TTL_SECONDS` | 30 |

## Rate limiting

Applied globally in API (except `/health`, `/ready`):

| Bucket | Default | Window |
|---|---|---|
| public | 300 | 1 minute |
| admin | 180 | 1 minute |
| login | 5 | 15 minutes |
| upload | 30 | 1 hour |
| import | 10 | 1 hour |

Login/upload/import buckets are wired in `@weightloss/cache`; route-specific hooks arrive in Phases 4 and 8–10.

When Redis is down:

- public: fail open
- admin/login: fail closed (safe)

## Failure modes

| Component | Redis down |
|---|---|
| Public GET cache | Fallback to Mongo |
| Rate limit (public) | Allow |
| Rate limit (admin/login) | Deny |
| BullMQ enqueue | 503 (Phase 9) |
| `/ready` | 503 |
