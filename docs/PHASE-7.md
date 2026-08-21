# Phase 7 report — Dashboard cache + admin UI wiring

## Delivered

### Backend — cached dashboard

- `packages/database/src/repositories/dashboard.repository.ts`
  - Mongo aggregations for stats, charts, recent items
- `GET /api/admin/dashboard` — admin auth, Redis cache via `adminGetOrSet`
  - Response header `X-Cache-Hit: 0|1`
  - Swagger tag: **Dashboard**
- `apps/api/src/lib/cache-bump.ts`
  - `bumpContentCache()` invalidates affected resources **and** `"dashboard"`
  - All content mutation routes use this helper

### Admin UI — live data

- **Dashboard** (`/`) — stats + charts from `/api/admin/dashboard`
- **Workout levels** — list, create, edit, delete wired to API
- **Workout categories** — list, create, edit, delete + image upload
- **Exercises** — list, create, edit, delete + media upload + nested fields mapper
- **Right panel** — recent meals/exercises from dashboard API

### API clients

- `apps/admin/src/lib/dashboard-api.ts`
- `apps/admin/src/lib/workout-levels-api.ts`
- `apps/admin/src/lib/workout-categories-api.ts`
- `apps/admin/src/lib/exercises-api.ts`

## Commands

```powershell
npm run dev:api    # port 5000
npm run dev:admin  # port 3000
```

## Verify dashboard

```powershell
# After login, use Bearer token or x-api-key
curl http://localhost:5000/api/admin/dashboard `
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected: `{ success: true, data: { stats, mealsByCategory, exercisesByLevel, ... } }`

Repeat the request — second response should include `X-Cache-Hit: 1`.

## Verify cache invalidation

1. Note dashboard stats (e.g. total meals).
2. Create or delete a meal via admin UI or API.
3. Refresh dashboard — counts should update; first request after mutation has `X-Cache-Hit: 0`.

## Next phase

**Phase 8:** S3 storage provider (optional migration from local disk). ✅ See `docs/PHASE-8.md`

**Phase 9:** BullMQ worker + job queues.

**Phase 11:** Remaining admin UI (change password, polish).

## Open issues

- Exercise difficulty maps UI `easy|medium|hard` ↔ API `Beginner|Intermediate|Advanced`.
- Admin exercise list filters are client-side (API supports server filters in repository; route can be extended).
- Notifications/contacts in right panel still use mock data.
