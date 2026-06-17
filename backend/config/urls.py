from django.contrib import admin
from django.db import connection
from django.urls import include, path
from drf_spectacular.utils import OpenApiResponse, extend_schema
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@extend_schema(responses=OpenApiResponse(description='{"status": "ok"}'))
@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    # Readiness: confirm the DB is reachable, not just that the process is up.
    try:
        connection.ensure_connection()
    except Exception:
        return Response({"status": "error", "database": "unreachable"}, status=503)
    return Response({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/", include("apps.projects.urls")),
    # OpenAPI schema + Swagger UI (public so the docs render without a token).
    path(
        "api/schema/",
        SpectacularAPIView.as_view(permission_classes=[AllowAny]),
        name="schema",
    ),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema", permission_classes=[AllowAny]),
        name="swagger-ui",
    ),
]
