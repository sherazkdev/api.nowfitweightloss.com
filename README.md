# Weight Loss Platform

Monorepo: **admin UI** (Next.js) + **API** (Fastify) + **worker** (background jobs).

## Dev (npm)

From repo root:

```bash
npm install

# Admin UI only — SnowUI panel (Next.js)
npm run dev:admin
# → http://localhost:3000

# API only — JSON/backend (Fastify, NOT Next.js)
npm run dev:api
# → http://localhost:5000
```

You usually run **both** in two terminals when connecting UI to real data.

Shortcut: `npm run dev` starts **admin only** (same as `dev:admin`).

Copy `.env.example` to `.env` before running the API.

**Production / Docker:** see `docs/DEPLOYMENT.md`. Templates: `.env.production.example`, `.env.docker.example`.

**MongoDB (Phase 2):**

```bash
npm run db:indexes
npm run db:verify-indexes
```

See `docs/ENVIRONMENT.md`, `docs/DEPLOYMENT.md`, `docs/PUBLIC-API.md`, `docs/INDEXES.md`, and `docs/PHASE-2.md`.
