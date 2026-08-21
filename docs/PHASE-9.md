# Phase 9 report — BullMQ worker + background jobs

## Storage note (local only)

Media and job files stay on disk under **`public/uploads/`** (no AWS):

```env
STORAGE_DRIVER=local
UPLOAD_ROOT=public/uploads
PUBLIC_MEDIA_BASE_URL=http://localhost:5000/uploads
```

Folders: `meals/`, `imports/`, `exports/`, etc.

## Delivered

### `@weightloss/queue`

- BullMQ queues: `import`, `export`, `raw`
- `QueueService` — enqueue import/export/raw jobs
- Dedicated Redis connection (no keyPrefix — BullMQ requirement)

### `@weightloss/database`

- `data-job.repository.ts` — job records in Mongo `dataJobs`
- `csv-import.ts` / `csv-export.ts` — CSV ↔ domain mapping
- `@weightloss/shared/csv` — parse + stringify helpers

### `apps/worker`

Workers (Redis + Mongo + local storage):

| Queue | Job | Action |
|-------|-----|--------|
| import | `import-csv` | Parse CSV → `importRawRecords` in batches |
| export | `export-csv` | Export resource → `public/uploads/exports/` |
| raw | `raw-import` | JSON bulk import |

Cache invalidation after import jobs.

### API routes

| Method | Endpoint |
|--------|----------|
| GET | `/api/admin/jobs` |
| GET | `/api/admin/jobs/:id` |
| GET | `/api/admin/jobs/:id/download` |
| POST | `/api/admin/jobs/import-csv` (multipart) |
| POST | `/api/admin/jobs/export-csv` |
| POST | `/api/admin/jobs/raw-import` |

Legacy sync `POST /api/admin/raw-upload` still works for small payloads.

### Admin UI wired

- **Import CSV** — queue + progress polling
- **Export CSV** — queue + download
- **Raw Upload** — background job queue

## Run (3 terminals)

```powershell
npm run dev:api      # :5000
npm run dev:worker   # BullMQ processors
npm run dev:admin    # :3000
```

Requires MongoDB + Redis.

## Verify

1. Import CSV on `/data/import-csv` — watch progress, check list page
2. Export CSV on `/data/export-csv` — download generated file
3. Raw upload on `/data/raw-upload` — job completes in worker logs

```powershell
curl http://localhost:5000/api/admin/jobs/1 -H "Authorization: Bearer TOKEN"
```

## Next phase

**Phase 10:** CSV column mapping polish + filtered exports + job history UI.

## Open issues

- Export filters in UI not applied server-side yet (exports all rows)
- `skipInvalid` CSV option stored but not fully enforced row-by-row
- Job list UI page not added (API exists)
