# Phase 2 report — MongoDB, models, indexes, counters

## Delivered

- `@weightloss/database`
  - Shared `MongoClient` singleton (`connectMongo`, `closeMongo`, `pingMongo`)
  - Collection name constants
  - `INDEX_DEFINITIONS` (admin, meals, workout, exercises, jobs)
  - `ensureIndexes()` / `listCollectionIndexes()`
  - `nextSequenceId()`, `reserveSequenceBlock()`, `setSequenceFloor()`
- API `/ready` pings MongoDB (Redis still Phase 3)
- Scripts: `npm run db:indexes`, `npm run db:verify-indexes`
- `docs/INDEXES.md`

## Commands

```bash
npm install
npm run build -w @weightloss/database
npm run db:indexes          # requires MongoDB + .env
npm run db:verify-indexes   # writes explain table to docs/INDEXES.md
npm run dev:api             # connects Mongo on boot
```

## Endpoints touched

| Method | Path | Change |
|--------|------|--------|
| GET | `/ready` | Returns 503 if Mongo unreachable |

## Next phase

**Phase 3:** Redis client, cache-aside, rate limiting, `/ready` redis check.

## Open issues

1. `existing-system-audit/` still not in repo — needed before Phase 5 legacy serializers.
2. Repositories / CRUD services come in Phase 5–6 (indexes first per spec order).
