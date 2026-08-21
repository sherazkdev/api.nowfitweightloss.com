# Public content API (mobile / client apps)

Read-only JSON API for meal and workout content. Responses use **legacy snake_case** field names for compatibility with existing mobile apps.

**Preferred base path:** `/api/v1`  
**Legacy alias:** `/api` (deprecated — returns `Deprecation`, `Sunset`, and `Link` headers)

## Quick start

### TypeScript / React Native / Node

Use the built-in SDK:

```typescript
import { createClient } from "@weightloss/client";

const client = createClient({
  baseUrl: "https://api.example.com",
  apiVersion: "v1", // default
});

const categories = await client.getMealCategories();
const meals = await client.getMeals({ page: 1, gender: "female", category_id: 2 });
const meal = await client.getMeal(meals.data[0].id);
```

Build the SDK from the monorepo:

```powershell
npm run build:client
```

Example script: `samples/mobile-client/example.ts`

### cURL

```bash
curl "http://localhost:5000/api/v1/meals?page=1&limit=20&gender=female&lang=en"
curl "http://localhost:5000/api/v1/meals/1?lang=hi"
curl "http://localhost:5000/api/v1/exercises?browse_key=abs&level_id=1&lang=hi"
```

### API discovery

```bash
curl http://localhost:5000/api/v1/
```

Returns version, pagination rules, endpoint list, and OpenAPI URL.

### OpenAPI

```bash
curl http://localhost:5000/api/v1/openapi.json
```

Interactive docs (when `API_DOCS_ENABLED=true`):

| UI | URL |
|----|-----|
| Public content (try `lang` here) | http://localhost:5000/docs/public |
| Admin login / CRUD / media | http://localhost:5000/docs |
| Machine-readable spec | http://localhost:5000/api/v1/openapi.json |
| API landing | http://localhost:5000/ |

## Tester guide (Swagger + language)

**Open Swagger:** [http://localhost:5000/docs/public](http://localhost:5000/docs/public)  
(Landing page and admin home also have a **Swagger / Try API** link.)

**APIs to use on that page**

| Method | Path |
|--------|------|
| GET | `/health` |
| GET | `/ready` |
| GET | `/api/v1/` (discovery) |
| GET | `/api/v1/meal-categories` |
| GET | `/api/v1/meals` |
| GET | `/api/v1/meals/{id}` |
| GET | `/api/v1/workout-levels` |
| GET | `/api/v1/workout-categories` |
| GET | `/api/v1/exercises` |
| GET | `/api/v1/exercises/{id}` |

**How to change language (there is a field)**

1. Open [http://localhost:5000/docs/public](http://localhost:5000/docs/public).
2. Expand **GET** `/api/v1/meals` (or any other content GET).
3. Click **Try it out** if the inputs are locked.
4. Find the **lang** query parameter — it is a **dropdown** (`en`, `bn`, `de`, `es`, `fr`, `hi`, `id`, `it`, `ja`, `ko`, `ms`, `pt`, `ru`, `tr`, `zh`).
5. Pick a language (for example `hi`) and click **Execute**.

Swagger sends `?lang=hi` on the URL. Titles and descriptions come back as a **single string** for that locale.

**English fallback:** if a meal/exercise was uploaded in English only, `lang=hi` still returns the **English** title. That is expected until Hindi (or another locale) is added in admin.

```bash
curl "http://localhost:5000/api/v1/meals?lang=en"
curl "http://localhost:5000/api/v1/meals?lang=hi"
curl "http://localhost:5000/api/v1/exercises?lang=hi"
```

## Conditional requests (ETags)

All public GET responses include:

- `ETag: W/"..."` — changes when content or cache version changes
- `Cache-Control: public, max-age=<seconds>`

Send the ETag back to skip re-downloading unchanged data:

```bash
curl -i http://localhost:5000/api/v1/meals?limit=5
# Note ETag header, then:
curl -i -H 'If-None-Match: W/"meals:v3:..."' http://localhost:5000/api/v1/meals?limit=5
# → 304 Not Modified
```

TypeScript SDK:

```typescript
const first = await client.getMealsConditional({ limit: 20 });
if (!first.notModified) {
  const etag = first.etag;
  const next = await client.getMealsConditional({ limit: 20 }, etag ?? undefined);
  if (next.notModified) console.log("Still fresh");
}
```

## Response envelope

**Success (single resource or list without pagination):**

```json
{
  "success": true,
  "data": [ ... ]
}
```

**Success (paginated list):**

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "total_pages": 8
  }
}
```

**Error:**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Meal not found"
  },
  "requestId": "uuid"
}
```

HTTP status codes: `200` success, `404` not found, `422` validation error, `429` rate limited.

## Versioning

| Path | Status |
|------|--------|
| `/api/v1/*` | Current — header `X-API-Version: 1` |
| `/api/*` | Legacy alias — headers `Deprecation: true`, `Sunset: 2027-06-01` |

New mobile apps should use `/api/v1` only.

## Endpoints

### `GET /api/v1/meal-categories`

All active meal categories. Cached.

| Query | Type | Description |
|-------|------|-------------|
| `lang` | `en` \| `bn` \| `de` \| `es` \| `fr` \| `hi` \| `id` \| `it` \| `ja` \| `ko` \| `ms` \| `pt` \| `ru` \| `tr` \| `zh` | Optional locale. Falls back to `Accept-Language`, then English. |

### `GET /api/v1/meals`

| Query | Type | Description |
|-------|------|-------------|
| `page` | number | 1-based page (default 1) |
| `limit` | number | Page size (default 20, max `MAX_PAGE_SIZE`) |
| `category_id` | number | Filter by category |
| `gender` | `male` \| `female` \| `both` | Gender filter |
| `is_challenge` | boolean | Challenge meals only |
| `weight` | number | User weight for plan filtering |
| `search` | string | Title search (max 100 chars) |
| `lang` | locale | Optional; falls back to `Accept-Language`, then English |

### `GET /api/v1/meals/:id`

Full meal with `ingredients` and `instructions`. Inactive meals return 404.

| Query | Type | Description |
|-------|------|-------------|
| `lang` | locale | Optional; falls back to `Accept-Language`, then English |

### `GET /api/v1/workout-levels`

All active workout levels.

| Query | Type | Description |
|-------|------|-------------|
| `lang` | locale | Optional; falls back to `Accept-Language`, then English |

### `GET /api/v1/workout-categories`

| Query | Type | Description |
|-------|------|-------------|
| `page`, `limit` | number | Pagination |
| `level_id` | number | Filter by level |
| `gender` | string | Gender filter |
| `is_challenge` | boolean | Challenge categories |
| `lang` | locale | Optional; falls back to `Accept-Language`, then English |

### `GET /api/v1/exercises`

| Query | Type | Description |
|-------|------|-------------|
| `page`, `limit` | number | Pagination |
| `category_id` | number | Workout category |
| `level_id` | number | Workout level |
| `browse_key` | string | Body-part / browse key (max 64 chars) |
| `gender` | string | Gender filter |
| `is_challenge` | boolean | Challenge exercises |
| `weight` | number | User weight filter |
| `search` | string | Title search |
| `lang` | locale | Optional; falls back to `Accept-Language`, then English |

### `GET /api/v1/exercises/:id`

Full exercise detail with instructions.

| Query | Type | Description |
|-------|------|-------------|
| `lang` | locale | Optional; falls back to `Accept-Language`, then English |

## Media URLs

Image and video fields contain absolute URLs when configured:

```env
PUBLIC_MEDIA_BASE_URL=https://api.example.com/uploads
```

Local dev: `http://localhost:5000/uploads/...`

## Localization

Pass `lang` on any public GET (including discovery `GET /api/v1/`), or send `Accept-Language`. Supported: `en`, `bn`, `de`, `es`, `fr`, `hi`, `id`, `it`, `ja`, `ko`, `ms`, `pt`, `ru`, `tr`, `zh`.

Swagger documents this as an optional query enum on every content operation (`/docs/public` and `/docs` → tag **Content**).

```bash
curl "http://localhost:5000/api/v1/meals?lang=hi"
```

Missing translations fall back to English. Response shape stays a single string per field (`title`, `description`, …) — not a 15-key object.

### Production uploads (CSV / raw JSON)

Admin **CSV import** and **raw JSON upload** are English-first. A typical row with `title` / `name` / `description` (no translations map) is stored as English-only content: root English fields **plus** `translations.en`. Other locales stay empty. `?lang=hi` still returns English until you add Hindi.

You do **not** need all 15 languages on every row.

| Method | How to add other languages |
|--------|----------------------------|
| Later | Edit the record in admin and use LanguageSwitcher |
| Raw JSON | Optional `translations: { "hi": { "title": "…" }, "es": { … } }`. Unknown locale keys are skipped. |
| CSV | Keep English columns as today. Optional extra columns `title_hi`, `description_hi`, `name_fr`, … **or** a `translations` JSON column |

Shared (not translated): slug, image/video URLs, nutrition numbers, gender, difficulty, sort order, IDs.

English-only re-import **keeps** locales already saved (for example Hindi added in admin). It refreshes `translations.en` from the English columns.

There is no auto-translate. Sample files: `samples/raw-upload/`.

## Rate limits

Public routes share the `public` rate limit bucket (default 300 requests / minute / IP).

Response headers:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`

## Caching

List and detail responses are cached in Redis. Admin writes bump cache versions automatically. Clients may cache responses locally; use ETag support in a future version if needed.

## Error codes

| Code | Meaning |
|------|---------|
| `VALIDATION_ERROR` | Invalid query or id |
| `NOT_FOUND` | Resource missing or inactive |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `NETWORK_ERROR` | Client SDK — API unreachable |

## Kotlin / Swift integration notes

1. Base URL: production API origin (no trailing slash).
2. Prefix paths with `/api/v1`.
3. Parse snake_case JSON — field names match legacy app models.
4. Paginate using `pagination.total_pages`.
5. Handle `429` with exponential backoff.

The TypeScript SDK (`@weightloss/client`) is the reference implementation for request/response shapes.

## Related

- [`OBSERVABILITY.md`](OBSERVABILITY.md) — metrics for ops
- [`CACHE.md`](CACHE.md) — cache behaviour
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — production URLs and env
