from django.conf import settings
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework import exceptions
from rest_framework.authentication import CSRFCheck
from rest_framework_simplejwt.authentication import JWTAuthentication


def _enforce_csrf(request):
    # Mirrors DRF's SessionAuthentication: CSRFCheck honours the test client's
    # _dont_enforce_csrf_checks and exempts safe methods (GET/HEAD/OPTIONS).
    check = CSRFCheck(lambda req: None)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise exceptions.PermissionDenied(f"CSRF Failed: {reason}")


class CookieJWTAuthentication(JWTAuthentication):
    """Authenticate from the httpOnly access cookie, falling back to the header."""

    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            # Bearer header → API client, not browser; no CSRF (no ambient creds).
            raw_token = self.get_raw_token(header)
            if raw_token is None:
                return None
            validated = self.get_validated_token(raw_token)
            return self.get_user(validated), validated

        raw_token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE)
        if raw_token is None:
            return None
        validated = self.get_validated_token(raw_token)
        user = self.get_user(validated)
        # Cookie auth = ambient credentials → enforce CSRF on unsafe methods.
        _enforce_csrf(request)
        return user, validated


# Lets drf-spectacular document the cookie auth (else it warns it can't resolve it).
class CookieJWTScheme(OpenApiAuthenticationExtension):
    target_class = "apps.accounts.authentication.CookieJWTAuthentication"
    name = "cookieAuth"

    def get_security_definition(self, auto_schema):
        return {"type": "apiKey", "in": "cookie", "name": settings.JWT_ACCESS_COOKIE}
