# SmartNSales

Django (DRF API) backend + Next.js frontend + PostgreSQL, containerized with Docker Compose.

```
backend/    Django 5 + DRF (JWT) → http://localhost:8000
frontend/   Next.js (App Router) → http://localhost:3000  (Tailwind, server + client components)
db          PostgreSQL 17
```

## API

JWTs are stored in **httpOnly cookies** (`access_token` / `refresh_token`) set by the
backend on login — never returned in the body and never accessible to JS. The browser
sends them automatically; call the API with `credentials: "include"`.

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET  /api/health/` | public | health check |
| `POST /api/auth/register/` | public | create user (`{username, email, password}`) |
| `POST /api/auth/login/` | public | set httpOnly JWT cookies (`{username, password}`) |
| `POST /api/auth/refresh/` | cookie | rotate access cookie from the refresh cookie |
| `POST /api/auth/logout/` | public | clear the JWT cookies |
| `GET  /api/auth/me/` | JWT | current user |
| `/api/projects/` | JWT | CRUD — scoped to projects you own |
| `/api/tasks/` | JWT | CRUD — tasks assigned to you or in projects you own |

Endpoints are secure-by-default (`IsAuthenticated`); public ones opt out with `AllowAny`.
Object isolation is enforced by per-user querysets (others get `404`, not `403`).

## Run

Each project has its own env file (already created with dev defaults). For a
fresh clone, copy the examples first:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up --build
```

The backend auto-runs migrations on startup; the frontend page fetches the
backend health endpoint to confirm the two are wired together.

## Notes

- Code is bind-mounted, so edits hot-reload in both containers.
- No local `uv`/`node_modules` needed — everything installs inside the images.
- Create a Django superuser (then you can hit `/api/token/` + `/api/me/`):
  `docker compose exec backend uv run --no-sync python manage.py createsuperuser`
