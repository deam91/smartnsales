# SmartNSales

Django (DRF API) backend + Next.js frontend + PostgreSQL, containerized with Docker Compose.

```
backend/    Django 5 + DRF (JWT) → http://localhost:8000
frontend/   Next.js (App Router) → http://localhost:3000  (Tailwind, server + client components)
db          PostgreSQL 17
```

## API

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET  /api/health/` | public | health check |
| `POST /api/token/` | public | obtain JWT (`{username, password}`) → `{access, refresh}` |
| `POST /api/token/refresh/` | public | refresh access token (`{refresh}`) |
| `GET  /api/me/` | JWT | current user (send `Authorization: Bearer <access>`) |

Endpoints are secure-by-default (`IsAuthenticated`); public ones opt out with `AllowAny`.

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
