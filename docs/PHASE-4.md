# Phase 4 report — Auth, admin seed, refresh sessions

## Delivered

- `@weightloss/auth`
  - Argon2id password hashing
  - JWT access tokens (`jose`, HS256)
  - Rotating refresh sessions in Redis auth client
  - `AuthService` + boot seed helper
- `@weightloss/database`
  - Admin repository (`find`, `create`)
- API routes
  - `POST /api/admin/login` — login rate limit (IP + email)
  - `POST /api/admin/refresh` — cookie rotation
  - `POST /api/admin/logout`
  - `POST /api/admin/change-password` — Bearer + revokes all sessions
- Boot seed when `ADMIN_SEED_ENABLED=true`
- `scripts/seed-admin.ts` + `npm run db:seed-admin`
- `docs/AUTH.md`

## Commands

```bash
npm install
npm run build -w @weightloss/auth -w @weightloss/api
npm run dev:api
npm run db:seed-admin
```

## Verify login

```bash
curl -X POST http://localhost:5000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"YOUR_ADMIN_SEED_PASSWORD"}'
```

Expected: `{ success: true, data: { accessToken, expiresIn, tokenType, admin } }` plus `Set-Cookie` for refresh.

## Next phase

**Phase 5:** Legacy public endpoints + serializers + filters.

## Open issues

- Admin UI still mock — wired in Phase 11.
- CORS for admin origin not added yet (needed before browser login from `:3000`).
- Dashboard endpoint (`GET /api/admin/dashboard`) is Phase 6/7 scope per master prompt section 49.
