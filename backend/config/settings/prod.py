"""Production settings — fail fast on missing config, hardened by default."""

import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403

DEBUG = False

# No insecure fallback in production — refuse to boot without real config.
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set in production.")
if not os.environ.get("POSTGRES_PASSWORD"):
    raise ImproperlyConfigured("POSTGRES_PASSWORD must be set in production.")

# HTTPS / secure-cookie hardening (addresses `check --deploy`).
JWT_COOKIE_SECURE = os.environ.get("JWT_COOKIE_SECURE", "1") == "1"
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Opt-in: trust X-Forwarded-Proto only when the proxy OVERWRITES it (nginx does)
# and the backend port isn't publicly reachable.
if os.environ.get("TRUST_PROXY_SSL_HEADER") == "1":
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
