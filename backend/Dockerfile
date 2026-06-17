FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv

WORKDIR /app

# Install deps into /opt/venv (outside /app so the dev bind-mount can't hide it).
COPY pyproject.toml ./
RUN uv sync

COPY . .

EXPOSE 8000
CMD ["sh", "-c", "uv run --no-sync python manage.py migrate && uv run --no-sync python manage.py runserver 0.0.0.0:8000"]
