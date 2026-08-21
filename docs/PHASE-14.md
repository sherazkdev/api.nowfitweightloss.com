# Phase 14 report — ETags, public OpenAPI, system status

## Delivered

### Conditional GET / ETags (public v1 + legacy)

- Weak `ETag` on all public content responses
- ETag derived from cache version + content hash — invalidates when admin edits content
- `Cache-Control: public, max-age=<list TTL>`
- `If-None-Match` → **304 Not Modified** (empty body)
- Helper: `apps/api/src/lib/etag.ts`

### Public OpenAPI spec

- **`GET /api/v1/openapi.json`** — machine-readable OpenAPI 3.0.3
- **`/docs/public`** — Swagger UI for public v1 (when `API_DOCS_ENABLED=true`)
- Spec builder: `apps/api/src/openapi/public-v1.ts`
- Discovery meta includes `openapi` URL

### Admin system status

- **`GET /api/admin/system`** — health, uptime, Mongo/Redis latency, cache versions, queue counts, storage, feature flags
- **`/settings/system`** — admin UI with dependency cards, job totals, developer links

### Client SDK update

- `getConditional()` + `getMealsConditional()` with `If-None-Match`
- `ConditionalResult<T>` type for 304 handling

## Verify

```powershell
npm run build:api
npm run build:admin
npm run build:client
npm run dev:api
npm run dev:admin
```

```powershell
# ETag flow
curl -i http://localhost:5000/api/v1/meals?limit=5
curl -i -H "If-None-Match: W/\"...\"" http://localhost:5000/api/v1/meals?limit=5

# OpenAPI
curl http://localhost:5000/api/v1/openapi.json
# Browser: http://localhost:5000/docs/public

# System status (requires admin token)
# Admin UI: http://localhost:3000/settings/system
```

## Next phase

**Phase 15:** Webhook notifications, content publish workflow, or mobile offline sync helpers.

## Open issues

- Legacy `/api/*` routes also emit ETags (same as v1) — clients should migrate to v1
- OpenAPI schemas are descriptive, not full response models yet
- System page does not auto-refresh (manual Refresh button)
