# Admin API — Bekalo Performance Hub

All admin endpoints require:
1. A valid JWT bearer token (`Authorization: Bearer <token>`)
2. The authenticated user to have `role = 'admin'` in the database

A `403 Forbidden` is returned when either condition is not met.

---

## Authentication & Role

Roles are stored in `bekalo_users.role` and can be `"user"` (default) or `"admin"`.

- **First registered user** is automatically made `admin`.
- Any admin can promote/demote other users.
- The JWT payload includes `role` at login/register time, but admin endpoints always re-check the database to ensure the role hasn't changed since the token was issued.

---

## Endpoints

### `GET /api/admin/stats`

Returns platform-wide aggregate counts.

**Response**

```json
{
  "totalUsers": 12,
  "totalTeams": 8,
  "totalAthletes": 47,
  "totalAdmins": 2
}
```

---

### `GET /api/admin/users`

Returns all registered users with their team and athlete counts.

**Response**

```json
[
  {
    "id": 1,
    "email": "coach@club.com",
    "name": "Jane Coach",
    "role": "admin",
    "createdAt": "2025-01-15T10:22:00.000Z",
    "teamCount": 3,
    "athleteCount": 18
  },
  {
    "id": 2,
    "email": "assistant@club.com",
    "name": "Bob Smith",
    "role": "user",
    "createdAt": "2025-02-01T09:00:00.000Z",
    "teamCount": 1,
    "athleteCount": 11
  }
]
```

---

### `PATCH /api/admin/users/:id/role`

Promotes or demotes a user's role.

**Path params**

| Param | Type   | Description        |
|-------|--------|--------------------|
| `id`  | number | Target user's `id` |

**Request body**

```json
{ "role": "admin" }
```

`role` must be `"admin"` or `"user"`. Returns `400` otherwise.

**Response**

```json
{
  "id": 2,
  "email": "assistant@club.com",
  "name": "Bob Smith",
  "role": "admin"
}
```

Returns `404` if user not found.

---

### `GET /api/admin/teams`

Returns all teams across all users, including owner info and athlete count.

**Response**

```json
[
  {
    "id": 1,
    "name": "First Team",
    "createdAt": "2025-01-20T11:00:00.000Z",
    "owner": {
      "id": 1,
      "email": "coach@club.com",
      "name": "Jane Coach"
    },
    "athleteCount": 22
  }
]
```

---

## Frontend admin page

The admin dashboard is accessible at `/#admin` in the browser, and only visible to users with `role = "admin"`.

- **Sidebar:** An "Admin Dashboard" nav item appears automatically after login for admin users.
- **Route guard:** On every load of `/#admin`, the frontend re-fetches `/auth/me` and verifies `role === "admin"`. Non-admins are silently redirected back.
- **Backend guard:** Every `/api/admin/*` route applies `requireAdmin` middleware, which queries the database for the current role — so role changes take effect immediately without requiring a re-login.

### Admin dashboard sections

| Section | Data source |
|---------|-------------|
| Stats cards (users / admins / teams / athletes) | `GET /api/admin/stats` |
| Users table with role toggle | `GET /api/admin/users` + `PATCH /api/admin/users/:id/role` |
| Teams table with owner info | `GET /api/admin/teams` |

---

## Database schema (relevant tables)

```sql
-- Users with role
CREATE TABLE bekalo_users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  name          VARCHAR(255)        NOT NULL,
  password_hash VARCHAR(255)        NOT NULL,
  role          VARCHAR(10)         NOT NULL DEFAULT 'user'
                  CHECK (role IN ('user', 'admin')),
  created_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- Teams owned by users
CREATE TABLE teams (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER      NOT NULL REFERENCES bekalo_users(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Athletes belonging to teams
CREATE TABLE athletes (
  id              SERIAL PRIMARY KEY,
  team_id         INTEGER      NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  first_name      VARCHAR(255) NOT NULL,
  last_name       VARCHAR(255) NOT NULL,
  position        VARCHAR(255),
  whoop_connected BOOLEAN      NOT NULL DEFAULT FALSE,
  notes           TEXT                  DEFAULT '',
  tokens          JSONB,
  whoop_data      JSONB,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

Migrations are applied automatically on server startup from `migrations/001_create_schema.sql`.
