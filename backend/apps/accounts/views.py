from django.conf import settings
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .serializers import RegisterSerializer, UserSerializer

ACCESS_MAX_AGE = int(jwt_settings.ACCESS_TOKEN_LIFETIME.total_seconds())
REFRESH_MAX_AGE = int(jwt_settings.REFRESH_TOKEN_LIFETIME.total_seconds())


def _set_cookie(response, key, value, max_age):
    response.set_cookie(
        key,
        value,
        max_age=max_age,
        httponly=True,  # JS can never read it → cannot end up in localStorage
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        path="/",
    )


def _set_access(response, token):
    _set_cookie(response, settings.JWT_ACCESS_COOKIE, token, ACCESS_MAX_AGE)


def _set_refresh(response, token):
    _set_cookie(response, settings.JWT_REFRESH_COOKIE, token, REFRESH_MAX_AGE)


class RegisterView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        response = Response({"detail": "Login successful"})
        _set_access(response, str(data["access"]))
        _set_refresh(response, str(data["refresh"]))
        return response


class RefreshView(TokenRefreshView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        raw_refresh = request.COOKIES.get(settings.JWT_REFRESH_COOKIE)
        if not raw_refresh:
            return Response(
                {"detail": "No refresh token cookie."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        serializer = self.get_serializer(data={"refresh": raw_refresh})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        response = Response({"detail": "Token refreshed"})
        _set_access(response, str(data["access"]))
        if "refresh" in data:  # ROTATE_REFRESH_TOKENS is on
            _set_refresh(response, str(data["refresh"]))
        return response


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        response = Response({"detail": "Logged out"})
        response.delete_cookie(settings.JWT_ACCESS_COOKIE, path="/")
        response.delete_cookie(settings.JWT_REFRESH_COOKIE, path="/")
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        return Response(UserSerializer(request.user).data)
