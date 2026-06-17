from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()

PW = "Sup3rSecret!"


class AuthFlowTests(APITestCase):
    def test_register_login_me_flow(self):
        r = self.client.post(
            "/api/auth/register/",
            {"username": "alice", "email": "a@x.com", "password": PW},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("password", r.data)

        # No unauthenticated access.
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

        # Login sets httpOnly cookies and never returns the token in the body.
        r = self.client.post(
            "/api/auth/login/",
            {"username": "alice", "password": PW},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertIn("access_token", r.cookies)
        self.assertTrue(r.cookies["access_token"]["httponly"])
        self.assertNotIn("access", r.data)

        # Cookie auth works (the test client persists the cookie).
        r = self.client.get("/api/auth/me/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["username"], "alice")

    def test_refresh_and_logout(self):
        User.objects.create_user("bob", password=PW)
        self.client.post(
            "/api/auth/login/", {"username": "bob", "password": PW}, format="json"
        )
        self.assertEqual(self.client.post("/api/auth/refresh/").status_code, 200)

        self.client.post("/api/auth/logout/")
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

    def test_logout_revokes_refresh_token_server_side(self):
        User.objects.create_user("dave", password=PW)
        self.client.post(
            "/api/auth/login/", {"username": "dave", "password": PW}, format="json"
        )
        stolen_refresh = self.client.cookies["refresh_token"].value
        self.client.post("/api/auth/logout/")

        # Even replaying the old refresh cookie, the token is blacklisted → 401.
        self.client.cookies["refresh_token"] = stolen_refresh
        self.assertEqual(self.client.post("/api/auth/refresh/").status_code, 401)


class UserSearchTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("nadia", password=PW)
        User.objects.create_user("nathan", password=PW)
        User.objects.create_user("omar", password=PW)

    def test_requires_authentication(self):
        self.assertEqual(self.client.get("/api/auth/users/").status_code, 401)

    def test_prefix_search_returns_matching_usernames(self):
        self.client.force_authenticate(self.user)
        names = [
            u["username"] for u in self.client.get("/api/auth/users/?search=na").data["results"]
        ]
        self.assertEqual(set(names), {"nadia", "nathan"})  # prefix 'na', not 'omar'
