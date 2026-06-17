"""Local development settings."""

import os

from .base import *  # noqa: F401,F403

DEBUG = True

# Dev-only fallback so the stack boots without a configured secret.
SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY", "dev-insecure-secret-key-change-me-in-production"
)

# Plain http on localhost → cookies aren't Secure-only.
JWT_COOKIE_SECURE = os.environ.get("JWT_COOKIE_SECURE", "0") == "1"
