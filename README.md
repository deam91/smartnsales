# SmartNSales

Django (DRF API) backend + Next.js frontend + PostgreSQL behind an nginx reverse
proxy, containerized with Docker Compose. **Everything is served from one origin
(http://localhost:3000)** — nginx routes `/api/*` (and `/admin/`) to Django and
everything else to Next.js, so the browser talks to a single same-origin host.

```
nginx       reverse proxy  → http://localhost:3000   (the only published port)
  /api/*, /admin/  → backend
  everything else  → frontend
backend/    Django 5 + DRF (JWT)            (internal :8000)
frontend/   Next.js (App Router, Tailwind)  (internal :3000)
db          PostgreSQL 17                   (internal)
```

## API

JWTs are stored in **httpOnly cookies** (`access_token` / `refresh_token`) set by the
backend on login — never returned in the body and never accessible to JS. The browser
sends them automatically; call the API with `credentials: "include"`.

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET  /api/health/` | public | health check |
| `POST /api/v1/auth/register/` | public | create user (`{username, email, password}`) |
| `POST /api/v1/auth/login/` | public | set httpOnly JWT cookies (`{username, password}`) |
| `POST /api/v1/auth/refresh/` | cookie | rotate access cookie from the refresh cookie |
| `POST /api/v1/auth/logout/` | public | clear the JWT cookies |
| `GET  /api/v1/auth/me/` | JWT | current user |
| `/api/v1/projects/` | JWT | CRUD — scoped to projects you own |
| `/api/v1/tasks/` | JWT | CRUD — tasks assigned to you or in projects you own |

Endpoints are secure-by-default (`IsAuthenticated`); public ones opt out with `AllowAny`.
Object isolation is enforced by per-user querysets (others get `404`, not `403`).
The data API is versioned under `/api/v1/` (`/api/health` and `/api/schema` stay
unversioned). Cookie auth enforces **CSRF** on unsafe methods: login sets a
`csrftoken` cookie and the client echoes it in the `X-CSRFToken` header.

## Run

Each project has its own env file (already created with dev defaults). For a
fresh clone, copy the examples first:

```bash
cp backend/.env.example backend/.env      # backend + db config
cp frontend/.env.example frontend/.env     # frontend config
docker compose up --build
```

The backend auto-runs migrations on startup. Open **http://localhost:3000** — it
redirects to `/login`, then to the `/board` kanban. (Env is kept per-project:
`backend/.env` and `frontend/.env`, not a single root file.)

## Default login

Seed a demo user plus a sample project and tasks (idempotent — safe to re-run):

```bash
docker compose exec backend uv run --no-sync python manage.py seed_demo
# → user: demo  password: demo12345  (+ "Q3 Launch" project with 100 sample tasks)
# → 10 teammates you can assign tasks to: nadia, theo, priya, … (password: <username>*123)
```

## Testing

```bash
docker compose exec backend pytest      # backend — pytest-django (models, endpoints, auth, permissions)
docker compose exec frontend npm test   # frontend — vitest + React Testing Library
```

## Production

Settings are split: `config.settings.dev` (default) and `config.settings.prod`.
For production set `DJANGO_SETTINGS_MODULE=config.settings.prod` — it refuses to
boot without `DJANGO_SECRET_KEY` + `POSTGRES_PASSWORD` + `DJANGO_ALLOWED_HOSTS`,
and turns on SSL redirect, HSTS, and secure cookies. Tunables: `DJANGO_LOG_LEVEL`,
`DJANGO_CONN_MAX_AGE`, `REDIS_URL`, `TRUST_PROXY_SSL_HEADER=1` (only behind a proxy
that overwrites `X-Forwarded-Proto`).

Serve with a real WSGI server (not `runserver`); static is collected + served by
WhiteNoise:

```bash
python manage.py collectstatic --noinput
gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3
```

Caching uses Redis when `REDIS_URL` is set (the dashboard is cached per-user, 30s),
in-memory otherwise. CI runs `ruff` + `pytest` (with coverage) + `vitest` —
`.github/workflows/ci.yml`.

## Notes

- Code is bind-mounted, so edits hot-reload in both containers.
- No local `uv`/`node_modules` needed — everything installs inside the images.
- Create a Django admin superuser instead:
  `docker compose exec backend uv run --no-sync python manage.py createsuperuser`
