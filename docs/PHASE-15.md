# Phase 15 report — UI rebuild, `/admin` routing, public home & API landing

## Delivered

### Admin routing (`/admin/*`)

- All protected admin screens moved under **`/admin`**
- Login at **`/admin/login`** — session required for dashboard; no token → redirect to login with `?next=`
- **`AuthGuard`** redirects unauthenticated users to `/admin/login`
- Login page redirects to `/admin` when a token already exists
- Legacy URLs (`/login`, `/meal/*`, etc.) redirect via **`middleware.ts`**
- Central path helper: `apps/admin/src/lib/admin-path.ts`

### Public home (`/` on admin app — port 3000)

- SnowUI-style landing at **`http://localhost:3000/`**
- Live API health / ready checks
- Meal count from real `/api/v1/meals`
- Interactive **live meal fetch** demo
- Endpoint table + links to Swagger, OpenAPI, API home, admin sign-in

### API landing (`/` on API — port 5000)

- Rich HTML home when `Accept: text/html`
- Links: `/docs`, `/docs/public`, `/api/v1/`, `/health`, `/ready`, `/metrics`, admin panel
- Public endpoint table (shared with OpenAPI routes)
- Embedded **live meal fetch** button
- JSON discovery payload for non-browser clients (includes admin URL, docs paths)

### Cleanup

- Removed orphaned **`apps/admin/src/lib/mock/`** (no runtime mocks)
- Breadcrumbs & sidebar updated for `/admin` prefix
- All internal admin links use `/admin/...` paths

## URL map

| URL | Purpose |
|-----|---------|
| `http://localhost:3000/` | Public SnowUI home (Next) |
| `http://localhost:3000/admin/login` | Admin sign-in |
| `http://localhost:3000/admin` | Dashboard (auth required) |
| `http://localhost:5000/` | API landing (HTML or JSON) |
| `http://localhost:5000/docs` | Admin Swagger |
| `http://localhost:5000/docs/public` | Public Swagger |
| `http://localhost:5000/api/v1/meals` | Live meals API |

## Verify

```powershell
npm run build:api
npm run build:admin
npm run dev:api
npm run dev:admin
```

1. Open **http://localhost:3000/** — public home, live status, meal fetch
2. Open **http://localhost:5000/** — API landing with Swagger links
3. Visit **http://localhost:3000/admin** without session → redirects to `/admin/login`
4. Sign in → lands on `/admin` dashboard with real stats
5. Old bookmark **http://localhost:3000/login** → redirects to `/admin/login`

## Key files

```
apps/admin/src/app/page.tsx                 # Public home
apps/admin/src/app/admin/login/page.tsx     # Login
apps/admin/src/app/admin/(dashboard)/       # All admin screens
apps/admin/src/lib/admin-path.ts            # Route helper
apps/admin/src/middleware.ts                # Legacy redirects
apps/api/src/views/landing-page.ts          # API HTML landing
apps/api/src/index.ts                       # GET / handler
```

## Next (Phase 16 ideas)

- Next.js middleware auth via httpOnly cookie (avoid client flash)
- Publish workflow / content staging
- Webhooks on content change
