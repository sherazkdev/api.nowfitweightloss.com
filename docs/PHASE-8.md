# Phase 8 report — S3 storage provider

## Delivered

### `@weightloss/storage`

- **`LocalStorageProvider`** — disk under `UPLOAD_ROOT` (existing)
- **`S3StorageProvider`** — AWS S3, Cloudflare R2, MinIO via `@aws-sdk/client-s3`
- **`createStorageProvider(env)`** — picks driver from `STORAGE_DRIVER`
- **`normalizeRelativeKey()`** — shared path sanitization

### API wiring

- `registerInfrastructure` uses `createStorageProvider(env)`
- **Local:** `/uploads/` static route + upload folders created on boot
- **S3:** no static route — media URLs come from `S3_PUBLIC_BASE_URL` / CDN

### Config validation

When `STORAGE_DRIVER=s3`, env requires:

- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

Optional but recommended:

- `S3_ENDPOINT` — R2 / MinIO custom endpoint
- `S3_PUBLIC_BASE_URL` — public CDN URL for returned media links
- `S3_REGION` — default `auto`

### Migration script

```powershell
npm run storage:migrate-local-to-s3
```

Uploads all files from `UPLOAD_ROOT` to the configured S3 bucket (same keys).

## Local (default)

```env
STORAGE_DRIVER=local
UPLOAD_ROOT=uploads
PUBLIC_MEDIA_BASE_URL=http://localhost:5000/uploads
```

Upload response includes `"driver": "local"`.

## S3 / R2 example

```env
STORAGE_DRIVER=s3
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=weightloss-media
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE_URL=https://cdn.example.com
PUBLIC_MEDIA_BASE_URL=https://cdn.example.com
```

Restart API after changing driver.

## Verify

```powershell
npm run build:api
npm run dev:api
```

Upload via admin UI or:

```powershell
curl -X POST http://localhost:5000/api/admin/media/upload `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -F "file=@image.png" `
  -F "folder=meals"
```

Expected: `{ success: true, data: { url, key, bytes, driver: "s3" } }`

## Next phase

**Phase 9:** BullMQ worker + job queues (import/export/media).

## Open issues

- No automatic DB URL rewrite after migration — re-upload or run a separate URL migration if switching drivers on existing content.
- Delete/replace object API not implemented yet.
- Bucket CORS must allow admin origin when uploading directly to S3 from browser (current flow uploads via API, so only API needs outbound S3 access).
