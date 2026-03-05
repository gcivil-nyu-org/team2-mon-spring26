"""
Integration tests for auth: registration, login, logout, current user, password reset.

These tests target the JSON API endpoints under /api/auth/ (config.urls).
"""

import json
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.test import TestCase
from django.core.cache import cache

User = get_user_model()


def _pref_lists(user):
    """Return (dietary_names, cuisine_names, food_type_names, grade) from UserPreference."""
    pref = user.preference
    return (
        list(pref.dietary_tags.values_list("name", flat=True)),
        list(pref.cuisine_types.values_list("name", flat=True)),
        list(pref.food_type_tags.values_list("name", flat=True)),
        pref.minimum_sanitation_grade,
    )


def api_register_payload(email, password, first_name="", last_name=""):
    return {
        "email": email,
        "password": password,
        "first_name": first_name,
        "last_name": last_name,
    }


def api_login_payload(email, password):
    return {"email": email, "password": password}


class AuthIntegrationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="reg@example.com", password="pass123")
        self.staff = User.objects.create_user(email="staff@example.com", password="pass123")
        self.staff.is_staff = True
        self.staff.save()

        # API endpoints (from accounts.api_urls, mounted at api/auth/)
        self.register_url = reverse("api_register")
        self.login_url = reverse("api_login")
        self.logout_url = reverse("api_logout")
        self.current_user_url = reverse("api_me")
        self.preferences_url = reverse("api_preferences_update")
        self.password_reset_request_url = reverse("api_request_password_reset")

    # -------------------------------------------------------------------------
    # Registration
    # -------------------------------------------------------------------------

    def test_registration_success(self):
        """New user can register; password is hashed; response is neutral success; user can authenticate."""
        data = api_register_payload("new@example.com", "StrongPass!1")
        resp = self.client.post(
            self.register_url,
            data=json.dumps(data),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body.get("success"), body)
        self.assertIn("user", body)
        self.assertEqual(body["user"]["email"], "new@example.com")

        usr = User.objects.filter(email="new@example.com").first()
        self.assertIsNotNone(usr)
        self.assertNotEqual(usr.password, "StrongPass!1")
        self.assertTrue(usr.check_password("StrongPass!1"))

        # Auto-login: session should have user
        self.assertIn("_auth_user_id", self.client.session)

    def test_registration_with_preferences_persists_and_returns(self):
        """api_register with preferences payload persists all four preference fields and returns them."""
        data = {
            "email": "pref@example.com",
            "password": "StrongPass!1",
            "first_name": "Pref",
            "last_name": "User",
            "preferences": {
                "dietary": ["Vegetarian", "Vegan"],
                "cuisines": ["Italian", "Japanese"],
                "foodTypes": ["Pizza", "Salads"],
                "minimum_sanitation_grade": "A",
            },
        }
        resp = self.client.post(
            self.register_url,
            data=json.dumps(data),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body.get("success"), body)
        self.assertIn("preferences", body["user"])
        self.assertEqual(body["user"]["preferences"]["dietary"], ["Vegetarian", "Vegan"])
        self.assertEqual(body["user"]["preferences"]["cuisines"], ["Italian", "Japanese"])
        self.assertEqual(body["user"]["preferences"]["foodTypes"], ["Pizza", "Salads"])
        self.assertEqual(body["user"]["preferences"]["minimum_sanitation_grade"], "A")

        usr = User.objects.get(email="pref@example.com")
        dietary, cuisines, food_types, grade = _pref_lists(usr)
        self.assertEqual(dietary, ["Vegetarian", "Vegan"])
        self.assertEqual(cuisines, ["Italian", "Japanese"])
        self.assertEqual(food_types, ["Pizza", "Salads"])
        self.assertEqual(grade, "A")

    def test_registration_duplicate_email(self):
        """Duplicate email returns a 400 error response with an email field validation error."""
        User.objects.create_user(email="dup@example.com", password="x")
        data = api_register_payload("dup@example.com", "Aaa123!")
        resp = self.client.post(
            self.register_url,
            data=json.dumps(data),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)
        body = resp.json()
        self.assertFalse(body.get("success", True))
        self.assertIn("errors", body)
        self.assertIn("email", body["errors"])

    def test_registration_invalid_email(self):
        """Invalid email format returns validation error."""
        data = api_register_payload("not-an-email", "ValidPass1!")
        resp = self.client.post(
            self.register_url,
            data=json.dumps(data),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)
        body = resp.json()
        self.assertIn("errors", body)

    def test_registration_method_not_allowed(self):
        """GET on register returns 405."""
        resp = self.client.get(self.register_url)
        self.assertEqual(resp.status_code, 405)

    # -------------------------------------------------------------------------
    # Login
    # -------------------------------------------------------------------------

    def test_login_success(self):
        """Valid credentials return success and set session; current user is available."""
        data = api_login_payload("reg@example.com", "pass123")
        resp = self.client.post(
            self.login_url,
            data=json.dumps(data),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body.get("success"), body)
        self.assertEqual(body["user"]["email"], "reg@example.com")
        self.assertIn("_auth_user_id", self.client.session)
        self.assertIn("preferences", body["user"])
        self.assertIn("foodTypes", body["user"]["preferences"])

        me = self.client.get(self.current_user_url)
        self.assertEqual(me.status_code, 200)
        self.assertTrue(me.json().get("authenticated"))
        self.assertEqual(me.json()["user"]["email"], "reg@example.com")

    def test_login_invalid_credentials(self):
        """Invalid password returns 401 and does not set session."""
        data = api_login_payload("reg@example.com", "wrong")
        resp = self.client.post(
            self.login_url,
            data=json.dumps(data),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 401)
        body = resp.json()
        self.assertFalse(body.get("success", True))
        self.assertIn("error", body)
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_login_method_not_allowed(self):
        """GET on login returns 405."""
        resp = self.client.get(self.login_url)
        self.assertEqual(resp.status_code, 405)

    # -------------------------------------------------------------------------
    # Logout
    # -------------------------------------------------------------------------

    def test_logout_behavior(self):
        """POST logout clears session; subsequent current-user returns 401."""
        self.client.force_login(self.user)
        self.assertIn("_auth_user_id", self.client.session)

        resp = self.client.post(
            self.logout_url,
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertFalse("_auth_user_id" in self.client.session)

        me = self.client.get(self.current_user_url)
        self.assertEqual(me.status_code, 401)

    def test_logout_method_not_allowed(self):
        """GET on logout returns 405."""
        resp = self.client.get(self.logout_url)
        self.assertEqual(resp.status_code, 405)

    # -------------------------------------------------------------------------
    # Current user / login status
    # -------------------------------------------------------------------------

    def test_get_current_user_authenticated(self):
        """After login, GET current-user returns basic profile (e.g. name, email)."""
        self.client.force_login(self.user)
        resp = self.client.get(self.current_user_url)
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body.get("authenticated"))
        self.assertIn("user", body)
        self.assertEqual(body["user"]["email"], "reg@example.com")
        self.assertIn("name", body["user"])
        self.assertIn("id", body["user"])

    def test_get_current_user_returns_preferences(self):
        """api_me returns preferences (dietary, cuisines, foodTypes, minimum_sanitation_grade)."""
        self.client.force_login(self.user)
        resp = self.client.get(self.current_user_url)
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIn("user", body)
        self.assertIn("preferences", body["user"])
        prefs = body["user"]["preferences"]
        self.assertIn("dietary", prefs)
        self.assertIn("cuisines", prefs)
        self.assertIn("foodTypes", prefs)
        self.assertIn("minimum_sanitation_grade", prefs)
        self.assertIsInstance(prefs["dietary"], list)
        self.assertIsInstance(prefs["cuisines"], list)
        self.assertIsInstance(prefs["foodTypes"], list)

    def test_get_current_user_unauthenticated(self):
        """GET current-user when not logged in returns 401."""
        resp = self.client.get(self.current_user_url)
        self.assertEqual(resp.status_code, 401)
        body = resp.json()
        self.assertFalse(body.get("authenticated", True))

    # -------------------------------------------------------------------------
    # Password reset request
    # -------------------------------------------------------------------------

    def test_password_reset_request_success(self):
        """POST with valid email returns 200 and neutral success message."""
        data = {"email": "resetme@example.com"}
        resp = self.client.post(
            self.password_reset_request_url,
            data=json.dumps(data),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body.get("success"), body)
        self.assertIn("message", body)
        # Neutral message to avoid account enumeration
        self.assertIn("account", body["message"].lower())

    def test_password_reset_request_invalid_email(self):
        """Invalid email format returns 400."""
        data = {"email": "not-an-email"}
        resp = self.client.post(
            self.password_reset_request_url,
            data=json.dumps(data),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)
        body = resp.json()
        self.assertIn("error", body)

    def test_password_reset_request_missing_email(self):
        """Missing email returns 400."""
        resp = self.client.post(
            self.password_reset_request_url,
            data=json.dumps({}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_password_reset_request_method_not_allowed(self):
        """GET on request-password-reset returns 405."""
        resp = self.client.get(self.password_reset_request_url)
        self.assertEqual(resp.status_code, 405)

    # -------------------------------------------------------------------------
    # Preferences update (PATCH)
    # -------------------------------------------------------------------------

    def test_preferences_update_authenticated(self):
        """Authenticated user can update all four preference fields via PATCH."""
        self.client.force_login(self.user)
        payload = {
            "dietary": ["Vegan"],
            "cuisines": ["Korean", "Thai"],
            "foodTypes": ["Seafood", "Coffee/Tea"],
            "minimum_sanitation_grade": "B",
        }
        resp = self.client.patch(
            self.preferences_url,
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIn("user", body)
        prefs = body["user"]["preferences"]
        self.assertEqual(prefs["dietary"], ["Vegan"])
        self.assertEqual(prefs["cuisines"], ["Korean", "Thai"])
        self.assertEqual(prefs["foodTypes"], ["Seafood", "Coffee/Tea"])
        self.assertEqual(prefs["minimum_sanitation_grade"], "B")

        self.user.refresh_from_db()
        dietary, cuisines, food_types, grade = _pref_lists(self.user)
        self.assertEqual(dietary, ["Vegan"])
        self.assertEqual(cuisines, ["Korean", "Thai"])
        self.assertEqual(food_types, ["Seafood", "Coffee/Tea"])
        self.assertEqual(grade, "B")

    def test_preferences_update_unauthenticated_returns_401(self):
        """PATCH preferences when not logged in returns 401."""
        payload = {"dietary": [], "cuisines": [], "foodTypes": [], "minimum_sanitation_grade": "C"}
        resp = self.client.patch(
            self.preferences_url,
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 401)


class LoginRateLimitTests(TestCase):
    """Brute-force mitigation: rate limiting on login attempts."""

    def setUp(self):
        cache.clear()  # isolate from other tests so rate-limit count is fresh
        self.user = User.objects.create_user(email="rate@example.com", password="secret")
        self.login_url = reverse("api_login")

    def test_login_rate_limit_after_failures(self):
        """After too many failed attempts, login returns 429."""
        # Default implementation uses 10 attempts per IP; make 11 failed requests
        for _ in range(11):
            resp = self.client.post(
                self.login_url,
                data=json.dumps(api_login_payload("rate@example.com", "wrong")),
                content_type="application/json",
            )
        self.assertEqual(resp.status_code, 429)
        body = resp.json()
        self.assertIn("error", body)

    def test_login_success_resets_rate_limit(self):
        """Successful login resets attempt count so next failure is not immediately 429."""
        for _ in range(5):
            self.client.post(
                self.login_url,
                data=json.dumps(api_login_payload("rate@example.com", "wrong")),
                content_type="application/json",
            )
        resp = self.client.post(
            self.login_url,
            data=json.dumps(api_login_payload("rate@example.com", "secret")),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json().get("success"))
