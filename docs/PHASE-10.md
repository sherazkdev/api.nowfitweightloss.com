# Phase 10 report — CSV polish, filtered exports, job history

## Delivered

### Filtered CSV exports

- `ExportFilters` type + `matchesExportFilters()` in `@weightloss/database`
- Export worker applies filters (scope, gender, category, level)
- `POST /api/admin/jobs/export-preview` — live record count for UI
- Export request body accepts `filters`

### CSV import validation

- `validateCsvRecord()` + `filterCsvRecords()` with `skipInvalid` support
- Invalid rows skipped and counted in `failed`
- Import CSV preview marks rows valid/invalid by required columns

### Job history UI

- **`/data/jobs`** — list import/export/raw jobs with status, progress, download
- Sidebar **Data Management** section wired (Import, Export, Raw, Job History)

### Export UI improvements

- Filter dropdowns load **real** meal categories / workout levels / categories from API
- Export summary shows **live filtered record count**

## API

| Method | Endpoint |
|--------|----------|
| POST | `/api/admin/jobs/export-preview` |
| GET | `/api/admin/jobs` (existing — used by job history page) |

Export body example:

```json
{
  "resource": "meals",
  "columns": [{ "key": "title", "label": "Title / Name" }],
  "filters": {
    "scope": "active",
    "gender": "female",
    "categoryId": 1,
    "workoutLevelId": null,
    "workoutCategoryId": null
  }
}
```

## Verify

```powershell
npm run dev:api
npm run dev:worker
npm run dev:admin
```

1. `/data/export-csv` — change filters, watch record count update
2. Export → download CSV with filtered rows only
3. `/data/import-csv` — upload CSV with bad rows + **Skip invalid** checked
4. `/data/jobs` — see completed jobs + download exports

## Next phase

**Phase 11:** Remaining admin UI (change password, polish, list page actions).

## Open issues

- Export column mapping for import round-trip is basic (name/title focused)
- Job polling on import/export pages blocks for up to 5 minutes (no websocket yet)
