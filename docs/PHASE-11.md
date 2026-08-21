# Phase 11 report — Admin UI polish & change password

## Delivered

### Change password (live API)

- **`/settings/change-password`** wired to `POST /api/admin/change-password`
- Client validation (8+ chars, confirmation match)
- On success: clears access token, invalidates refresh session (server), redirects to login
- Login page shows confirmation when `?reason=password-changed`

### Account & navigation

- **Sign out** button in sidebar → `POST /api/admin/logout` + clear token
- Breadcrumbs updated for Data Management routes

### List / table polish

- **`DataTable`** supports `showRowActions={false}` for read-only tables (no checkboxes, no edit/delete menu)
- **`/data/jobs`** uses read-only table + **auto-refresh every 4s** while jobs are queued/processing

### Mock cleanup

- Preview types moved to `@/lib/data-preview-types` (no longer under `mock/`)
- Dashboard right panel **Job Activity** section shows recent import/export jobs from API (replaces empty mock notifications)

## API used

| Method | Endpoint |
|--------|----------|
| POST | `/api/admin/change-password` |
| POST | `/api/admin/logout` |
| GET | `/api/admin/jobs` (right panel + job history) |

## Verify

```powershell
npm run dev:api
npm run dev:admin
```

1. **Change password** — `/settings/change-password` → update → redirected to login → sign in with new password
2. **Sign out** — sidebar bottom → returns to login
3. **Job history** — `/data/jobs` auto-refreshes while a job runs (start import/export with worker running)
4. **Dashboard panel** — open right panel on `/` → see recent job activity

## Build

```powershell
npm run build:admin
```

## Next phase

**Phase 12:** Deployment docs, production env templates, optional Docker compose, public API hardening.

## Open issues

- Job activity in right panel does not live-poll (loads once on mount)
- Legacy sync `POST /api/admin/raw-upload` still exists alongside queued raw import
