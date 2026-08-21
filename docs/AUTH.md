# Auth

Admin authentication uses short-lived JWT access tokens plus rotating refresh sessions stored in Redis.

## Model

| Token | Storage | TTL |
|---|---|---|
| Access | Response body (`Bearer`) | `JWT_ACCESS_EXPIRES_IN` (default 15m) |
| Refresh | HttpOnly cookie + Redis auth client | `JWT_REFRESH_EXPIRES_IN` (default 7d) |

Access token claims: `sub`, `type`, `ver`, `iss`, `aud`, `iat`, `exp`, `jti`.

Refresh cookie name: `REFRESH_COOKIE_NAME` (default `wl_refresh`), path `/api/admin`.

## Redis keys

```text
refresh:session:{sessionId}   → session JSON, TTL = refresh expiry
refresh:admin:{adminId}       → SET of sessionIds
ratelimit:login:ip:{ip}:email:{emailNormalized}
```

On password change or global revoke: increment Mongo `tokenVersion`, delete all `refresh:admin:{id}` sessions.

## Passwords

New passwords are hashed with **Argon2id** (`@node-rs/argon2`).

## Admin seed

When `ADMIN_SEED_ENABLED=true`, API boot (and `npm run db:seed-admin`) creates the first admin if the normalized email does not exist. Existing admins are never overwritten.

After production setup, set:

```env
ADMIN_SEED_ENABLED=false
```

## Endpoints

| Method | Path | Auth |
|---|---|---|
| POST | `/api/admin/login` | Public (+ login rate limit) |
| POST | `/api/admin/refresh` | Refresh cookie |
| POST | `/api/admin/logout` | Refresh cookie |
| POST | `/api/admin/change-password` | Bearer access token |

Login rate limit: **5 attempts / 15 minutes** per `IP + normalized email`. Invalid credentials return the same generic message (no email enumeration).

## Admin UI session

The admin app stores the access JWT in `localStorage` and sends it as `Authorization: Bearer`. The refresh cookie is HttpOnly (`credentials: include`).

On a `401` from an authenticated API call (dashboard, forms, CSV/raw upload):

1. Try `POST /api/admin/refresh` once (shared in-flight promise — no stampede).
2. If refresh succeeds, retry the original request with the new access token.
3. If refresh fails, clear the access token and redirect to `/admin/login?reason=expired&next=<current admin path>`.
4. The login page still redirects away when an access token already exists. Failed refresh does not loop: the token is cleared first, `/admin/login` is never used as `next`, and `reason=expired` is only set by this redirect (not by a first visit to a protected page).

## Failure modes

When Redis auth is unavailable:

- Login / refresh / logout / change-password fail safely (401/503-style errors, no session issuance)
- Login rate limit fails closed (429)
