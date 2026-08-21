# Phase 13 report — API versioning, client SDK, observability

## Delivered

### API versioning (v1)

- **Canonical public routes:** `/api/v1/*`
- **Legacy aliases:** `/api/*` (same handlers, deprecation headers)
- **`GET /api/v1/`** — discovery meta (endpoints, pagination rules, SDK hint)
- Response headers:
  - v1: `X-API-Version: 1`
  - legacy: `Deprecation`, `Sunset`, `Link` (successor `/api/v1`)

### TypeScript client SDK (`@weightloss/client`)

- `WeightLossClient` / `createClient()`
- Methods: `getMeta`, `getMealCategories`, `getMeals`, `getMeal`, `getWorkoutLevels`, `getWorkoutCategories`, `getExercises`, `getExercise`
- Typed snake_case models + `WeightLossApiError`
- Example: `samples/mobile-client/example.ts`

### Observability (`@weightloss/metrics`)

- Prometheus `/metrics` endpoint (configurable path)
- Metrics: HTTP requests, latency histogram, cache hit/miss, queue job gauges
- Optional `METRICS_TOKEN` bearer auth (required in production when metrics enabled)
- Cache metrics wired in public content routes

### Documentation

- [`PUBLIC-API.md`](PUBLIC-API.md) — mobile/client integration guide
- [`OBSERVABILITY.md`](OBSERVABILITY.md) — metrics, health, logging

## API routes

| Method | v1 | Legacy |
|--------|-----|--------|
| GET | `/api/v1/` | — |
| GET | `/api/v1/meal-categories` | `/api/meal-categories` |
| GET | `/api/v1/meals` | `/api/meals` |
| GET | `/api/v1/meals/:id` | `/api/meals/:id` |
| GET | `/api/v1/workout-levels` | `/api/workout-levels` |
| GET | `/api/v1/workout-categories` | `/api/workout-categories` |
| GET | `/api/v1/exercises` | `/api/exercises` |
| GET | `/api/v1/exercises/:id` | `/api/exercises/:id` |
| GET | `/metrics` | — |

## Verify

```powershell
npm run build:api
npm run build:client
npm run dev:api
```

```powershell
curl http://localhost:5000/api/v1/
curl -I http://localhost:5000/api/meals
curl http://localhost:5000/metrics

npm run build:client
npx tsx samples/mobile-client/example.ts
```

## Next phase

**Phase 14:** ETags / conditional GET, OpenAPI spec for public v1, or admin system status page.

## Open issues

- Legacy `/api` paths share prefix with `/api/admin` — no conflict today but new public routes must stay non-admin
- Client SDK is TypeScript-only; Kotlin/Swift models are documented but not generated
- Histogram uses fixed ms buckets — tune for production traffic profiles if needed
