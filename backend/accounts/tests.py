"""
Unified tests for the accounts app — auth integration, view coverage,
model/email/smtp edge cases, and registration/login/password-reset flows
for students, venue managers, and admins.
"""

import json
import smtplib
from datetime import datetime, timedelta
from io import BytesIO
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.db import IntegrityError
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from accounts.email_service import EmailSendError, send_password_reset_email
from accounts.models import (
    CuisineType,
    DietaryTag,
    FoodTypeTag,
    UserPreference,
    VenueManagerProfile,
    normalize_sanitation_grade,
)
from accounts.smtp_backend import CertifiSMTPBackend

User = get_user_model()


# ---------------------------------------------------------------------------
# api_venue_register
# ---------------------------------------------------------------------------


class VenueRegisterTests(TestCase):
    url = reverse("api_venue_register")

    def test_method_not_allowed(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 405)

    def test_missing_email(self):
        resp = self.client.post(
            self.url,
            data=json.dumps({"password": "StrongPass!1"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_missing_password(self):
        resp = self.client.post(
            self.url,
            data=json.dumps({"email": "v@example.com"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_duplicate_email(self):
        User.objects.create_user(email="v@example.com", password="StrongPass!1")
        resp = self.client.post(
            self.url,
            data=json.dumps(
                {
                    "email": "v@example.com",
                    "password": "StrongPass!1",
                    "firstName": "V",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_weak_password_rejected(self):
        resp = self.client.post(
            self.url,
            data=json.dumps(
                {
                    "email": "v@example.com",
                    "password": "123",
                    "firstName": "V",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_success_creates_user_and_profile(self):
        resp = self.client.post(
            self.url,
            data=json.dumps(
                {
                    "email": "v@example.com",
                    "password": "StrongPass!1",
                    "firstName": "Vee",
                    "lastName": "Manager",
                    "businessName": "Vee's",
                    "businessEmail": "biz@example.com",
                    "businessPhone": "555-1234",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 201)
        user = User.objects.get(email="v@example.com")
        self.assertEqual(user.role, "venue_manager")
        self.assertTrue(VenueManagerProfile.objects.filter(user=user).exists())
        # Session should be created — subsequent /api/auth/me/ call works
        me = self.client.get(reverse("api_me"))
        self.assertEqual(me.status_code, 200)
        payload = me.json()
        self.assertIsNotNone(payload["user"]["venueManager"])
        self.assertEqual(payload["user"]["venueManager"]["businessName"], "Vee's")

    @patch("accounts.views.User.objects.create_user")
    def test_exception_returns_500(self, mock_create):
        mock_create.side_effect = Exception("boom")
        resp = self.client.post(
            self.url,
            data=json.dumps({"email": "v@example.com", "password": "StrongPass!1"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 500)


# ---------------------------------------------------------------------------
# api_admin_register
# ---------------------------------------------------------------------------


class AdminRegisterTests(TestCase):
    url = reverse("api_admin_register")

    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin@example.com", password="StrongPass!1", role="admin"
        )
        self.student = User.objects.create_user(
            email="student@example.com", password="StrongPass!1"
        )

    def test_method_not_allowed(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 405)

    def test_unauthenticated(self):
        resp = self.client.post(
            self.url,
            data=json.dumps({"email": "new@example.com", "password": "StrongPass!1"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 401)

    def test_non_admin_forbidden(self):
        self.client.force_login(self.student)
        resp = self.client.post(
            self.url,
            data=json.dumps({"email": "new@example.com", "password": "StrongPass!1"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_missing_fields(self):
        self.client.force_login(self.admin)
        resp = self.client.post(
            self.url,
            data=json.dumps({"email": "new@example.com"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_duplicate_email(self):
        self.client.force_login(self.admin)
        resp = self.client.post(
            self.url,
            data=json.dumps({"email": "admin@example.com", "password": "StrongPass!1"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_weak_password(self):
        self.client.force_login(self.admin)
        resp = self.client.post(
            self.url,
            data=json.dumps({"email": "new@example.com", "password": "123"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_success(self):
        self.client.force_login(self.admin)
        resp = self.client.post(
            self.url,
            data=json.dumps(
                {
                    "email": "new@example.com",
                    "password": "StrongPass!1",
                    "firstName": "New",
                    "lastName": "Admin",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 201)
        created = User.objects.get(email="new@example.com")
        self.assertEqual(created.role, "admin")
        self.assertTrue(created.is_staff)

    @patch("accounts.views.User.objects.create_user")
    def test_exception_returns_500(self, mock_create):
        mock_create.side_effect = Exception("boom")
        self.client.force_login(self.admin)
        resp = self.client.post(
            self.url,
            data=json.dumps({"email": "new@example.com", "password": "StrongPass!1"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 500)


# ---------------------------------------------------------------------------
# api_admin_login
# ---------------------------------------------------------------------------


class AdminLoginTests(TestCase):
    url = reverse("api_admin_login")

    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin@example.com", password="StrongPass!1", role="admin"
        )
        self.student = User.objects.create_user(
            email="student@example.com", password="StrongPass!1"
        )

    def test_method_not_allowed(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 405)

    def test_invalid_credentials(self):
        resp = self.client.post(
            self.url,
            data=json.dumps({"email": "admin@example.com", "password": "wrong"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 401)

    def test_non_admin_role_forbidden(self):
        resp = self.client.post(
            self.url,
            data=json.dumps(
                {"email": "student@example.com", "password": "StrongPass!1"}
            ),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_success(self):
        resp = self.client.post(
            self.url,
            data=json.dumps({"email": "admin@example.com", "password": "StrongPass!1"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["user"]["role"], "admin")

    @patch("accounts.views.authenticate")
    def test_exception_returns_500(self, mock_auth):
        mock_auth.side_effect = Exception("boom")
        resp = self.client.post(
            self.url,
            data=json.dumps({"email": "admin@example.com", "password": "x"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 500)


# ---------------------------------------------------------------------------
# api_request_admin_password_reset
# ---------------------------------------------------------------------------


@override_settings(FRONTEND_BASE_URL="http://localhost:5173", DEBUG=True)
class AdminPasswordResetRequestTests(TestCase):
    url = reverse("api_request_admin_password_reset")

    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin@example.com", password="StrongPass!1", role="admin"
        )

    def test_method_not_allowed(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 405)

    def test_missing_email(self):
        resp = self.client.post(
            self.url, data=json.dumps({}), content_type="application/json"
        )
        self.assertEqual(resp.status_code, 400)

    def test_invalid_email_format(self):
        resp = self.client.post(
            self.url,
            data=json.dumps({"email": "not-an-email"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)

    @patch("accounts.views.send_password_reset_email")
    def test_sends_email_to_existing_admin(self, mock_send):
        resp = self.client.post(
            self.url,
            data=json.dumps({"email": "admin@example.com"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        mock_send.assert_called_once()
        # Verify the reset link uses the admin route prefix.
        link = mock_send.call_args.args[1]
        self.assertIn("/admin/reset-password/", link)

    @patch("accounts.views.send_password_reset_email")
    def test_neutral_response_for_unknown_email(self, mock_send):
        resp = self.client.post(
            self.url,
            data=json.dumps({"email": "nobody@example.com"}),
            content_type="application/json",
        )
        # Neutral success response, but no email sent.
        self.assertEqual(resp.status_code, 200)
        mock_send.assert_not_called()

    @patch("accounts.views.send_password_reset_email")
    def test_send_email_failure_swallowed(self, mock_send):
        mock_send.side_effect = Exception("smtp down")
        resp = self.client.post(
            self.url,
            data=json.dumps({"email": "admin@example.com"}),
            content_type="application/json",
        )
        # Still returns 200 neutral response.
        self.assertEqual(resp.status_code, 200)

    @patch("accounts.views.json.loads")
    def test_generic_exception_returns_500(self, mock_loads):
        mock_loads.side_effect = RuntimeError("weird")
        resp = self.client.post(
            self.url,
            data=json.dumps({"email": "admin@example.com"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 500)

    def test_student_account_does_not_get_reset(self):
        """Only users with role='admin' should receive a reset link."""
        User.objects.create_user(email="s@example.com", password="StrongPass!1")
        with patch("accounts.views.send_password_reset_email") as mock_send:
            resp = self.client.post(
                self.url,
                data=json.dumps({"email": "s@example.com"}),
                content_type="application/json",
            )
            self.assertEqual(resp.status_code, 200)
            mock_send.assert_not_called()


# ---------------------------------------------------------------------------
# Preference payload edge cases
# ---------------------------------------------------------------------------


class PreferenceEdgeCasesTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="u@example.com", password="StrongPass!1"
        )
        CuisineType.objects.create(name="Italian")
        DietaryTag.objects.create(name="Vegan")
        FoodTypeTag.objects.create(name="Pizza")
        self.url = reverse("api_preferences_update")

    def test_non_string_preferences_ignored(self):
        """Non-str entries in the dietary/cuisines/foodTypes lists get skipped."""
        self.client.force_login(self.user)
        resp = self.client.patch(
            self.url,
            data=json.dumps(
                {
                    "dietary": ["Vegan", 42, None, ""],
                    "cuisines": ["Italian", True],
                    "foodTypes": ["Pizza", ""],
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        prefs = resp.json()["user"]["preferences"]
        self.assertEqual(prefs["dietary"], ["Vegan"])
        self.assertEqual(prefs["cuisines"], ["Italian"])
        self.assertEqual(prefs["foodTypes"], ["Pizza"])


# ---------------------------------------------------------------------------
# api_login brute-force / exception edge cases
# ---------------------------------------------------------------------------


class LoginExtraTests(TestCase):
    url = reverse("api_login")

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            email="u@example.com", password="StrongPass!1"
        )

    def tearDown(self):
        cache.clear()

    @patch("accounts.views.authenticate")
    def test_exception_path_returns_500(self, mock_auth):
        mock_auth.side_effect = Exception("boom")
        resp = self.client.post(
            self.url,
            data=json.dumps({"email": "u@example.com", "password": "x"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 500)


# ---------------------------------------------------------------------------
# api_register exception path
# ---------------------------------------------------------------------------


class RegisterExceptionTests(TestCase):
    url = reverse("api_register")

    @patch("accounts.views.UserCreationForm")
    def test_exception_returns_500(self, mock_form):
        mock_form.side_effect = Exception("boom")
        resp = self.client.post(
            self.url,
            data=json.dumps({"email": "new@example.com", "password": "StrongPass!1"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 500)


# ---------------------------------------------------------------------------
# api_request_password_reset exception path
# ---------------------------------------------------------------------------


@override_settings(FRONTEND_BASE_URL="http://localhost:5173")
class PasswordResetRequestExceptionTests(TestCase):
    url = reverse("api_request_password_reset")

    def setUp(self):
        self.user = User.objects.create_user(
            email="u@example.com", password="StrongPass!1"
        )

    @patch("accounts.views.json.loads")
    def test_exception_returns_500(self, mock_loads):
        mock_loads.side_effect = RuntimeError("weird")
        resp = self.client.post(
            self.url,
            data=json.dumps({"email": "u@example.com"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 500)

    @patch("accounts.views.send_password_reset_email")
    def test_send_failure_swallowed(self, mock_send):
        mock_send.side_effect = Exception("smtp down")
        resp = self.client.post(
            self.url,
            data=json.dumps({"email": "u@example.com"}),
            content_type="application/json",
        )
        # Neutral 200 response even if email send fails.
        self.assertEqual(resp.status_code, 200)


# ---------------------------------------------------------------------------
# Coverage for accounts models, email_service, smtp_backend, views edges.
# ---------------------------------------------------------------------------


class NormalizeSanitationGradeTests(TestCase):
    def test_none_returns_n(self):
        self.assertEqual(normalize_sanitation_grade(None), "N")

    def test_empty_string_returns_n(self):
        self.assertEqual(normalize_sanitation_grade(""), "N")

    def test_whitespace_returns_n(self):
        self.assertEqual(normalize_sanitation_grade("   "), "N")

    def test_valid_grade_returned_unchanged(self):
        self.assertEqual(normalize_sanitation_grade("A"), "A")
        self.assertEqual(normalize_sanitation_grade("B"), "B")


class UserManagerTests(TestCase):
    def test_create_superuser(self):
        user = User.objects.create_superuser(
            email="admin@example.com", password="adminpass123"
        )
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)

    def test_create_superuser_not_staff_raises(self):
        with self.assertRaises(ValueError):
            User.objects.create_superuser(
                email="admin@example.com", password="adminpass", is_staff=False
            )

    def test_create_superuser_not_superuser_raises(self):
        with self.assertRaises(ValueError):
            User.objects.create_superuser(
                email="admin@example.com", password="adminpass", is_superuser=False
            )

    def test_create_user_no_email_raises(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(email="", password="pass")


class TagModelStrTests(TestCase):
    def test_cuisine_type_str(self):
        ct = CuisineType.objects.create(name="Italian")
        self.assertEqual(str(ct), "Italian")

    def test_dietary_tag_str(self):
        dt = DietaryTag.objects.create(name="Vegan")
        self.assertEqual(str(dt), "Vegan")

    def test_food_type_tag_str(self):
        ft = FoodTypeTag.objects.create(name="Quick Bite")
        self.assertEqual(str(ft), "Quick Bite")

    def test_user_preference_str(self):
        user = User.objects.create_user(email="test@example.com", password="pass")
        pref = UserPreference.objects.create(user=user)
        self.assertEqual(str(pref), "Preferences for test@example.com")

    def test_user_str(self):
        user = User.objects.create_user(email="hello@example.com", password="pass")
        self.assertEqual(str(user), "hello@example.com")


class TagAutoSlugTests(TestCase):
    def test_cuisine_type_auto_slug(self):
        ct = CuisineType(name="Thai Food")
        ct.save()
        self.assertEqual(ct.slug, "thai-food")

    def test_dietary_tag_auto_slug(self):
        dt = DietaryTag(name="Gluten Free")
        dt.save()
        self.assertEqual(dt.slug, "gluten-free")

    def test_food_type_tag_auto_slug(self):
        ft = FoodTypeTag(name="Fine Dining")
        ft.save()
        self.assertEqual(ft.slug, "fine-dining")


class EmailServiceTests(TestCase):
    @patch("accounts.email_service.send_mail")
    def test_send_password_reset_email_success(self, mock_send_mail):
        send_password_reset_email("user@example.com", "https://example.com/reset/abc")
        mock_send_mail.assert_called_once()

    @patch("accounts.email_service.send_mail")
    def test_send_password_reset_email_smtp_auth_error(self, mock_send_mail):
        mock_send_mail.side_effect = smtplib.SMTPAuthenticationError(
            535, b"Auth failed"
        )
        with self.assertRaises(EmailSendError):
            send_password_reset_email("user@example.com", "https://example.com/reset")

    @patch("accounts.email_service.send_mail")
    def test_send_password_reset_email_smtp_error(self, mock_send_mail):
        mock_send_mail.side_effect = smtplib.SMTPException("Connection refused")
        with self.assertRaises(EmailSendError):
            send_password_reset_email("user@example.com", "https://example.com/reset")

    @patch("accounts.email_service.send_mail")
    def test_send_password_reset_email_unexpected_error(self, mock_send_mail):
        mock_send_mail.side_effect = RuntimeError("Unexpected")
        with self.assertRaises(EmailSendError):
            send_password_reset_email("user@example.com", "https://example.com/reset")


class CertifiSMTPBackendTests(TestCase):
    def test_ssl_context_property_with_certifi(self):
        backend = CertifiSMTPBackend()
        ctx = backend.ssl_context
        self.assertIsNotNone(ctx)
        # Second access should return the same cached context
        self.assertIs(backend.ssl_context, ctx)

    def test_ssl_context_setter(self):
        backend = CertifiSMTPBackend()
        backend.ssl_context = "custom"
        self.assertEqual(backend._ssl_context, "custom")

    @patch("accounts.smtp_backend.ssl.create_default_context")
    def test_ssl_context_without_certifi(self, mock_ctx):
        backend = CertifiSMTPBackend()
        # Simulate certifi not installed
        original_import = (
            __builtins__.__import__
            if hasattr(__builtins__, "__import__")
            else __import__
        )

        def fake_import(name, *args, **kwargs):
            if name == "certifi":
                raise ImportError("No certifi")
            return original_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=fake_import):
            backend._ssl_context = None
            backend.ssl_context  # noqa: B018
            mock_ctx.assert_called()


class AccountsViewEdgeCaseTests(TestCase):
    """Cover remaining uncovered lines in accounts/views.py."""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            email="user@example.com",
            password="StrongPass123!",
            first_name="Test",
            last_name="User",
        )

    def test_api_me_unauthenticated(self):
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, 401)

    def test_api_preferences_update_method_not_allowed(self):
        self.client.login(email="user@example.com", password="StrongPass123!")
        response = self.client.post("/api/auth/preferences/")
        self.assertEqual(response.status_code, 405)

    def test_api_preferences_update_unauthenticated(self):
        response = self.client.patch(
            "/api/auth/preferences/",
            '{"dietary": ["Vegan"]}',
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)

    def test_api_preferences_update_invalid_json(self):
        self.client.login(email="user@example.com", password="StrongPass123!")
        response = self.client.patch(
            "/api/auth/preferences/",
            "not json",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_api_validate_token_invalid_json(self):
        response = self.client.post(
            "/api/auth/validate-password-reset-token/",
            "bad json",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_api_validate_token_missing_fields(self):
        response = self.client.post(
            "/api/auth/validate-password-reset-token/",
            '{"uid": "", "token": ""}',
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_api_confirm_reset_invalid_json(self):
        response = self.client.post(
            "/api/auth/confirm-password-reset/",
            "bad json",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_api_confirm_reset_missing_fields(self):
        response = self.client.post(
            "/api/auth/confirm-password-reset/",
            '{"uid": "", "token": "", "new_password": ""}',
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_api_confirm_reset_invalid_token(self):
        response = self.client.post(
            "/api/auth/confirm-password-reset/",
            '{"uid": "bad", "token": "bad", "new_password": "NewPass123!"}',
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_api_validate_token_method_not_allowed(self):
        response = self.client.get("/api/auth/validate-password-reset-token/")
        self.assertEqual(response.status_code, 405)

    def test_api_confirm_reset_method_not_allowed(self):
        response = self.client.get("/api/auth/confirm-password-reset/")
        self.assertEqual(response.status_code, 405)

    def test_api_request_reset_method_not_allowed(self):
        response = self.client.get("/api/auth/request-password-reset/")
        self.assertEqual(response.status_code, 405)

    @patch("accounts.views.send_password_reset_email", side_effect=Exception("fail"))
    def test_api_request_reset_email_send_failure(self, mock_send):
        """Password reset should still return success even if email fails."""
        response = self.client.post(
            "/api/auth/request-password-reset/",
            '{"email": "user@example.com"}',
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])

    def test_get_user_from_uid_invalid(self):
        """Invalid uidb64 returns None."""
        from accounts.views import _get_user_from_uid

        self.assertIsNone(_get_user_from_uid("invalid!!!"))


# ---------------------------------------------------------------------------
# Integration tests for auth API endpoints under /api/auth/.
# ---------------------------------------------------------------------------


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
        self.user = User.objects.create_user(
            email="reg@example.com", password="pass123"
        )
        self.staff = User.objects.create_user(
            email="staff@example.com", password="pass123"
        )
        self.staff.is_staff = True
        self.staff.save()

        # API endpoints (from accounts.api_urls, mounted at api/auth/)
        self.register_url = reverse("api_register")
        self.login_url = reverse("api_login")
        self.logout_url = reverse("api_logout")
        self.current_user_url = reverse("api_me")
        self.preferences_url = reverse("api_preferences_update")
        self.password_reset_request_url = reverse("api_request_password_reset")
        self.password_reset_validate_url = reverse("api_validate_password_reset_token")
        self.password_reset_confirm_url = reverse("api_confirm_password_reset")

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
        self.assertEqual(
            body["user"]["preferences"]["dietary"], ["Vegetarian", "Vegan"]
        )
        self.assertEqual(
            body["user"]["preferences"]["cuisines"], ["Italian", "Japanese"]
        )
        self.assertEqual(body["user"]["preferences"]["foodTypes"], ["Pizza", "Salads"])
        self.assertEqual(body["user"]["preferences"]["minimum_sanitation_grade"], "A")

        usr = User.objects.get(email="pref@example.com")
        dietary, cuisines, food_types, grade = _pref_lists(usr)
        self.assertEqual(dietary, ["Vegetarian", "Vegan"])
        self.assertEqual(cuisines, ["Italian", "Japanese"])
        self.assertEqual(food_types, ["Pizza", "Salads"])
        self.assertEqual(grade, "A")

    def test_registration_duplicate_email(self):
        """Duplicate email returns 400 with email field error (registration exposes this for UX).
        Contrast: password reset uses a neutral message to avoid account enumeration."""
        User.objects.create_user(email="dup@example.com", password="x")
        data = api_register_payload("dup@example.com", "Aaa1234!!")
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

    @patch("accounts.views.send_password_reset_email")
    def test_password_reset_request_existing_user_sends_email(self, mock_send_email):
        """Requesting reset for an existing user calls email sender with a reset link."""
        User.objects.create_user(email="resetme@example.com", password="StrongPass!1")

        resp = self.client.post(
            self.password_reset_request_url,
            data=json.dumps({"email": "resetme@example.com"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        mock_send_email.assert_called_once()
        to_email, reset_link = mock_send_email.call_args[0]
        self.assertEqual(to_email, "resetme@example.com")
        self.assertIn("/reset-password/", reset_link)

    def test_password_reset_validate_token_success(self):
        """Valid uid/token pair returns valid=true."""
        user = User.objects.create_user(
            email="tokenok@example.com", password="StrongPass!1"
        )
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        resp = self.client.post(
            self.password_reset_validate_url,
            data=json.dumps({"uid": uid, "token": token}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body.get("success"))
        self.assertTrue(body.get("valid"))

    def test_password_reset_validate_token_invalid(self):
        """Invalid token returns 400 with valid=false."""
        user = User.objects.create_user(
            email="tokenbad@example.com", password="StrongPass!1"
        )
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        resp = self.client.post(
            self.password_reset_validate_url,
            data=json.dumps({"uid": uid, "token": "invalid-token"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)
        body = resp.json()
        self.assertFalse(body.get("success", True))
        self.assertFalse(body.get("valid", True))

    def test_password_reset_confirm_success_updates_password(self):
        """Confirm endpoint with valid token sets new password."""
        user = User.objects.create_user(
            email="confirmok@example.com", password="OldPass!123"
        )
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        resp = self.client.post(
            self.password_reset_confirm_url,
            data=json.dumps(
                {
                    "uid": uid,
                    "token": token,
                    "new_password": "NewStrongPass!456",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body.get("success"), body)

        user.refresh_from_db()
        self.assertTrue(user.check_password("NewStrongPass!456"))
        self.assertFalse(user.check_password("OldPass!123"))

    def test_password_reset_confirm_invalid_password_rejected(self):
        """Confirm endpoint rejects passwords that fail Django validators."""
        user = User.objects.create_user(
            email="confirmbad@example.com", password="OldPass!123"
        )
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        resp = self.client.post(
            self.password_reset_confirm_url,
            data=json.dumps(
                {
                    "uid": uid,
                    "token": token,
                    "new_password": "123",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)
        body = resp.json()
        self.assertFalse(body.get("success", True))
        self.assertIn("error", body)

    @override_settings(PASSWORD_RESET_TIMEOUT=3600)
    def test_password_reset_validate_token_expired(self):
        """Token older than timeout is rejected as expired."""
        user = User.objects.create_user(
            email="expired@example.com", password="StrongPass!1"
        )
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        issue_time = datetime(2026, 3, 8, 10, 0, 0)

        with patch.object(default_token_generator, "_now", return_value=issue_time):
            token = default_token_generator.make_token(user)

        with patch.object(
            default_token_generator,
            "_now",
            return_value=issue_time + timedelta(hours=2),
        ):
            resp = self.client.post(
                self.password_reset_validate_url,
                data=json.dumps({"uid": uid, "token": token}),
                content_type="application/json",
            )

        self.assertEqual(resp.status_code, 400)
        body = resp.json()
        self.assertFalse(body.get("success", True))
        self.assertFalse(body.get("valid", True))

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
        payload = {
            "dietary": [],
            "cuisines": [],
            "foodTypes": [],
            "minimum_sanitation_grade": "C",
        }
        resp = self.client.patch(
            self.preferences_url,
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 401)


class LoginRateLimitTests(TestCase):
    """Brute-force mitigation: rate limiting on login attempts."""

    def setUp(self):
        # Isolate rate-limit: delete only the key this test uses (test client uses 127.0.0.1)
        cache.delete("login_attempts_127.0.0.1")
        self.user = User.objects.create_user(
            email="rate@example.com", password="secret"
        )
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


# ---------------------------------------------------------------------------
# VenueManagerProfile model tests
# ---------------------------------------------------------------------------


class VenueManagerProfileTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="manager@nyu.edu", password="pass", role="venue_manager"
        )

    def test_create_venue_manager_profile(self):
        profile = VenueManagerProfile.objects.create(
            user=self.user,
            business_name="Joe's Diner",
            business_email="joe@diner.com",
            business_phone="212-555-0100",
        )
        self.assertEqual(profile.user, self.user)
        self.assertEqual(profile.business_name, "Joe's Diner")
        self.assertFalse(profile.is_verified)

    def test_one_to_one_constraint(self):
        VenueManagerProfile.objects.create(user=self.user, business_name="First")
        with self.assertRaises(IntegrityError):
            VenueManagerProfile.objects.create(user=self.user, business_name="Second")

    def test_str(self):
        profile = VenueManagerProfile.objects.create(
            user=self.user, business_name="Joe's Diner"
        )
        self.assertIn("Joe's Diner", str(profile))
        self.assertIn(self.user.email, str(profile))


# ---------------------------------------------------------------------------
# Admin user management endpoints (Issues #153 and #84) and safely_delete_user
# ---------------------------------------------------------------------------


class AdminUsersEndpointTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user(
            email="admin@test.local",
            password="x",
            role="admin",
            first_name="Ad",
            last_name="Min",
            is_staff=True,
        )
        cls.student1 = User.objects.create_user(
            email="alice@test.local",
            password="x",
            role="student",
            first_name="Alice",
            last_name="Smith",
        )
        cls.student2 = User.objects.create_user(
            email="bob@test.local",
            password="x",
            role="student",
            first_name="Bob",
            last_name="Jones",
            is_active=False,
        )
        cls.manager = User.objects.create_user(
            email="manager@test.local",
            password="x",
            role="venue_manager",
            first_name="Ven",
        )

    def setUp(self):
        self.client.force_login(self.admin)

    # ---- list ----

    def test_admin_users_list_requires_auth(self):
        self.client.logout()
        res = self.client.get("/api/auth/admin/users/")
        self.assertEqual(res.status_code, 401)

    def test_admin_users_list_requires_admin_role(self):
        self.client.force_login(self.student1)
        res = self.client.get("/api/auth/admin/users/")
        self.assertEqual(res.status_code, 403)

    def test_admin_users_list_returns_all_users(self):
        res = self.client.get("/api/auth/admin/users/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["totalCount"], 4)
        emails = {u["email"] for u in data["users"]}
        self.assertEqual(
            emails,
            {
                "admin@test.local",
                "alice@test.local",
                "bob@test.local",
                "manager@test.local",
            },
        )

    def test_admin_users_search_by_email(self):
        res = self.client.get("/api/auth/admin/users/?q=alice")
        data = res.json()
        self.assertEqual(data["totalCount"], 1)
        self.assertEqual(data["users"][0]["email"], "alice@test.local")

    def test_admin_users_search_by_name(self):
        res = self.client.get("/api/auth/admin/users/?q=Jones")
        data = res.json()
        self.assertEqual(data["totalCount"], 1)
        self.assertEqual(data["users"][0]["lastName"], "Jones")

    def test_admin_users_filter_by_role(self):
        res = self.client.get("/api/auth/admin/users/?role=student")
        data = res.json()
        self.assertEqual(data["totalCount"], 2)
        for u in data["users"]:
            self.assertEqual(u["role"], "student")

    def test_admin_users_filter_by_active_status(self):
        res = self.client.get("/api/auth/admin/users/?status=active")
        self.assertEqual(res.json()["totalCount"], 3)
        res = self.client.get("/api/auth/admin/users/?status=inactive")
        data = res.json()
        self.assertEqual(data["totalCount"], 1)
        self.assertEqual(data["users"][0]["email"], "bob@test.local")

    def test_admin_users_list_response_shape(self):
        res = self.client.get("/api/auth/admin/users/?q=alice")
        u = res.json()["users"][0]
        for key in (
            "id",
            "email",
            "firstName",
            "lastName",
            "name",
            "role",
            "phone",
            "photoUrl",
            "isActive",
            "createdAt",
        ):
            self.assertIn(key, u)

    # ---- detail ----

    def test_admin_user_detail_returns_full_user(self):
        res = self.client.get(f"/api/auth/admin/users/{self.student1.id}/")
        self.assertEqual(res.status_code, 200)
        data = res.json()["user"]
        self.assertEqual(data["email"], "alice@test.local")
        self.assertIn("preferences", data)
        self.assertIn("memberships", data)
        self.assertIn("chats", data)
        self.assertIsNone(data["venueManager"])

    def test_admin_user_detail_404_for_missing(self):
        res = self.client.get("/api/auth/admin/users/99999/")
        self.assertEqual(res.status_code, 404)

    # ---- patch ----

    def test_admin_user_patch_updates_basic_fields(self):
        res = self.client.patch(
            f"/api/auth/admin/users/{self.student1.id}/",
            data=json.dumps(
                {
                    "firstName": "Alicia",
                    "lastName": "Smythe",
                    "phone": "555-1111",
                    "photoUrl": "https://cdn.test/a.jpg",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        self.student1.refresh_from_db()
        self.assertEqual(self.student1.first_name, "Alicia")
        self.assertEqual(self.student1.last_name, "Smythe")
        self.assertEqual(self.student1.phone, "555-1111")
        self.assertEqual(self.student1.photo_url, "https://cdn.test/a.jpg")

    def test_admin_user_patch_clears_photo(self):
        self.student1.photo_url = "https://cdn.test/a.jpg"
        self.student1.save()
        res = self.client.patch(
            f"/api/auth/admin/users/{self.student1.id}/",
            data=json.dumps({"photoUrl": ""}),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        self.student1.refresh_from_db()
        self.assertEqual(self.student1.photo_url, "")

    def test_admin_user_patch_changes_role(self):
        res = self.client.patch(
            f"/api/auth/admin/users/{self.student1.id}/",
            data=json.dumps({"role": "venue_manager"}),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        self.student1.refresh_from_db()
        self.assertEqual(self.student1.role, "venue_manager")

    def test_admin_user_patch_rejects_self_role_demotion(self):
        res = self.client.patch(
            f"/api/auth/admin/users/{self.admin.id}/",
            data=json.dumps({"role": "student"}),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 400)

    def test_admin_user_patch_rejects_self_deactivation(self):
        res = self.client.patch(
            f"/api/auth/admin/users/{self.admin.id}/",
            data=json.dumps({"isActive": False}),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 400)

    def test_admin_user_patch_rejects_duplicate_email(self):
        res = self.client.patch(
            f"/api/auth/admin/users/{self.student1.id}/",
            data=json.dumps({"email": "bob@test.local"}),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 400)

    def test_admin_user_patch_invalid_json_returns_400(self):
        res = self.client.patch(
            f"/api/auth/admin/users/{self.student1.id}/",
            data="not json",
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 400)

    # ---- delete ----

    def test_admin_user_delete_rejects_self(self):
        res = self.client.delete(f"/api/auth/admin/users/{self.admin.id}/")
        self.assertEqual(res.status_code, 400)
        self.assertTrue(User.objects.filter(pk=self.admin.pk).exists())

    def test_admin_user_delete_removes_user(self):
        target_id = self.student2.id
        res = self.client.delete(f"/api/auth/admin/users/{target_id}/")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(User.objects.filter(pk=target_id).exists())

    def test_admin_user_delete_blocked_by_sole_leader(self):
        from groups.models import Group, GroupMembership

        group = Group.objects.create(name="BlockGrp", created_by=self.student1)
        GroupMembership.objects.create(user=self.student1, group=group, role="leader")
        GroupMembership.objects.create(user=self.student2, group=group, role="member")
        res = self.client.delete(f"/api/auth/admin/users/{self.student1.id}/")
        self.assertEqual(res.status_code, 400)
        data = res.json()
        self.assertEqual(data["code"], "sole_leader")
        self.assertIn("BlockGrp", data["groups"])
        self.assertTrue(User.objects.filter(pk=self.student1.pk).exists())


class SafelyDeleteUserTests(TestCase):
    """Issue #84 — verify chat/group cleanup semantics."""

    def setUp(self):
        from chat.models import Chat, ChatMember, Message  # noqa: F401
        from groups.models import Group, GroupMembership, SwipeEvent  # noqa: F401

        self.admin = User.objects.create_user(
            email="admin2@test.local", password="x", role="admin"
        )
        self.victim = User.objects.create_user(
            email="victim@test.local", password="x", first_name="Vic"
        )
        self.peer = User.objects.create_user(
            email="peer@test.local", password="x", first_name="Peer"
        )

    def test_sole_leader_of_multi_member_group_blocks_deletion(self):
        from accounts.views import SoleLeaderError, safely_delete_user
        from groups.models import Group, GroupMembership

        group = Group.objects.create(name="G1", created_by=self.victim)
        GroupMembership.objects.create(user=self.victim, group=group, role="leader")
        GroupMembership.objects.create(user=self.peer, group=group, role="member")

        with self.assertRaises(SoleLeaderError) as ctx:
            safely_delete_user(self.victim)

        self.assertIn(group, ctx.exception.groups)
        # user should NOT have been deleted
        self.assertTrue(User.objects.filter(pk=self.victim.pk).exists())

    def test_multi_leader_group_allows_deletion(self):
        from accounts.views import safely_delete_user
        from groups.models import Group, GroupMembership

        group = Group.objects.create(name="G1b", created_by=self.victim)
        GroupMembership.objects.create(user=self.victim, group=group, role="leader")
        GroupMembership.objects.create(user=self.peer, group=group, role="leader")

        safely_delete_user(self.victim)

        self.assertTrue(Group.objects.filter(pk=group.pk).exists())
        self.assertEqual(GroupMembership.objects.filter(group=group).count(), 1)
        group.refresh_from_db()
        self.assertIsNone(group.created_by)

    def test_last_member_group_is_deleted(self):
        from accounts.views import safely_delete_user
        from groups.models import Group, GroupMembership

        group = Group.objects.create(name="G-solo", created_by=self.victim)
        GroupMembership.objects.create(user=self.victim, group=group, role="leader")

        safely_delete_user(self.victim)

        self.assertFalse(Group.objects.filter(pk=group.pk).exists())

    def test_swipe_event_survives_user_deletion(self):
        from accounts.views import safely_delete_user
        from groups.models import Group, GroupMembership, SwipeEvent

        group = Group.objects.create(name="G2", created_by=self.peer)
        GroupMembership.objects.create(user=self.peer, group=group, role="leader")
        GroupMembership.objects.create(user=self.victim, group=group, role="member")
        event = SwipeEvent.objects.create(
            group=group, name="E1", created_by=self.victim
        )

        safely_delete_user(self.victim)

        self.assertTrue(SwipeEvent.objects.filter(pk=event.pk).exists())
        event.refresh_from_db()
        self.assertIsNone(event.created_by)

    def test_chat_ownership_reassigned_to_another_member(self):
        from accounts.views import safely_delete_user
        from chat.models import Chat, ChatMember
        from groups.models import Group, GroupMembership

        group = Group.objects.create(name="G3", created_by=self.peer)
        GroupMembership.objects.create(user=self.peer, group=group, role="leader")
        GroupMembership.objects.create(user=self.victim, group=group, role="member")
        chat = Chat.objects.create(
            type="group", name="C1", group=group, created_by=self.peer
        )
        ChatMember.objects.create(chat=chat, user=self.peer, role="admin")
        ChatMember.objects.create(chat=chat, user=self.victim, role="member")

        safely_delete_user(self.victim)

        chat.refresh_from_db()
        self.assertEqual(chat.created_by, self.peer)
        members = list(ChatMember.objects.filter(chat=chat))
        self.assertEqual(len(members), 1)
        self.assertEqual(members[0].user, self.peer)

    def test_chat_with_no_remaining_members_is_deleted(self):
        from accounts.views import safely_delete_user
        from chat.models import Chat, ChatMember

        chat = Chat.objects.create(type="group", created_by=self.victim)
        ChatMember.objects.create(chat=chat, user=self.victim, role="admin")

        safely_delete_user(self.victim)

        self.assertFalse(Chat.objects.filter(pk=chat.pk).exists())

    def test_chat_reassigned_to_fallback_when_no_other_members(self):
        from accounts.views import safely_delete_user
        from chat.models import Chat, ChatMember

        chat = Chat.objects.create(type="group", created_by=self.victim)
        ChatMember.objects.create(chat=chat, user=self.victim, role="admin")

        safely_delete_user(self.victim, fallback_creator=self.admin)

        self.assertTrue(Chat.objects.filter(pk=chat.pk).exists())
        chat.refresh_from_db()
        self.assertEqual(chat.created_by, self.admin)

    def test_message_sender_nulled_preserving_history(self):
        from accounts.views import safely_delete_user
        from chat.models import Chat, ChatMember, Message
        from groups.models import Group, GroupMembership

        group = Group.objects.create(name="G4", created_by=self.peer)
        GroupMembership.objects.create(user=self.peer, group=group, role="leader")
        GroupMembership.objects.create(user=self.victim, group=group, role="member")
        chat = Chat.objects.create(type="group", group=group, created_by=self.peer)
        ChatMember.objects.create(chat=chat, user=self.peer, role="admin")
        ChatMember.objects.create(chat=chat, user=self.victim, role="member")
        msg = Message.objects.create(chat=chat, sender=self.victim, body="hi")

        safely_delete_user(self.victim)

        msg.refresh_from_db()
        self.assertIsNone(msg.sender)
        self.assertEqual(msg.body, "hi")

    def test_prefers_chat_admin_member_as_replacement(self):
        from accounts.views import safely_delete_user
        from chat.models import Chat, ChatMember

        peer_admin = User.objects.create_user(
            email="p2@test.local", password="x", first_name="Admin2"
        )
        chat = Chat.objects.create(type="group", created_by=self.victim)
        ChatMember.objects.create(chat=chat, user=self.victim, role="admin")
        ChatMember.objects.create(chat=chat, user=self.peer, role="member")
        ChatMember.objects.create(chat=chat, user=peer_admin, role="admin")

        safely_delete_user(self.victim)

        chat.refresh_from_db()
        self.assertEqual(chat.created_by, peer_admin)


class NullCreatorSerializationTests(TestCase):
    """Verify that null created_by on Group/SwipeEvent doesn't break API serialization."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="ser@test.local", password="x", role="student"
        )
        self.peer = User.objects.create_user(
            email="ser-peer@test.local", password="x", role="student"
        )

    def test_group_with_null_creator_serializes(self):
        from groups.models import Group, GroupMembership

        group = Group.objects.create(name="NullCreator", created_by=None)
        GroupMembership.objects.create(user=self.user, group=group, role="leader")

        self.client.force_login(self.user)
        res = self.client.get("/api/groups/")
        self.assertEqual(res.status_code, 200)
        g = next(g for g in res.json()["groups"] if g["name"] == "NullCreator")
        self.assertIsNone(g["created_by"])

    def test_swipe_event_with_null_creator_serializes(self):
        from groups.models import Group, GroupMembership, SwipeEvent

        group = Group.objects.create(name="NullEvt", created_by=self.user)
        GroupMembership.objects.create(user=self.user, group=group, role="leader")
        SwipeEvent.objects.create(group=group, name="E-null", created_by=None)

        self.client.force_login(self.user)
        res = self.client.get(f"/api/groups/{group.id}/events/")
        self.assertEqual(res.status_code, 200)
        events = res.json()["events"]
        evt = next(e for e in events if e["name"] == "E-null")
        self.assertIsNone(evt["created_by"])


class PhotoUrlInMeTests(TestCase):
    """photoUrl should flow through _user_to_json on api_me."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="photo@test.local",
            password="x",
            role="student",
            photo_url="https://cdn.test/p.jpg",
        )

    def test_me_returns_photo_url(self):
        self.client.force_login(self.user)
        res = self.client.get(reverse("api_me"))
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["user"]["photoUrl"], "https://cdn.test/p.jpg")


class AdminUsersEdgeCaseTests(TestCase):
    """Extra coverage for admin user endpoints (error branches, method checks,
    less-common PATCH paths)."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user(
            email="edge-admin@test.local", password="x", role="admin"
        )
        cls.target = User.objects.create_user(
            email="edge-target@test.local",
            password="x",
            role="student",
            first_name="Ed",
            last_name="Ge",
        )

    def setUp(self):
        self.client.force_login(self.admin)

    def test_list_rejects_non_get(self):
        res = self.client.post("/api/auth/admin/users/")
        self.assertEqual(res.status_code, 405)

    def test_list_invalid_page_param_defaults_to_one(self):
        res = self.client.get("/api/auth/admin/users/?page=abc")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["page"], 1)

    def test_detail_requires_admin_role(self):
        self.client.force_login(self.target)
        res = self.client.get(f"/api/auth/admin/users/{self.admin.id}/")
        self.assertEqual(res.status_code, 403)

    def test_detail_rejects_unknown_method(self):
        res = self.client.put(f"/api/auth/admin/users/{self.target.id}/")
        self.assertEqual(res.status_code, 405)

    def test_patch_changes_email_successfully(self):
        res = self.client.patch(
            f"/api/auth/admin/users/{self.target.id}/",
            data=json.dumps({"email": "renamed@test.local"}),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        self.target.refresh_from_db()
        self.assertEqual(self.target.email, "renamed@test.local")

    def test_patch_toggles_is_active(self):
        res = self.client.patch(
            f"/api/auth/admin/users/{self.target.id}/",
            data=json.dumps({"isActive": False}),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        self.target.refresh_from_db()
        self.assertFalse(self.target.is_active)

    def test_detail_exposes_preferences_and_venue_manager(self):
        manager = User.objects.create_user(
            email="vmx@test.local",
            password="x",
            role="venue_manager",
            first_name="VM",
        )
        VenueManagerProfile.objects.create(
            user=manager,
            business_name="Biz",
            business_email="biz@test.local",
            business_phone="555",
            is_verified=True,
        )
        pref, _ = UserPreference.objects.get_or_create(
            user=manager, defaults={"minimum_sanitation_grade": "B"}
        )
        pref.dietary_tags.add(DietaryTag.objects.create(name="Vegan", slug="vegan"))

        res = self.client.get(f"/api/auth/admin/users/{manager.id}/")
        self.assertEqual(res.status_code, 200)
        data = res.json()["user"]
        self.assertEqual(data["venueManager"]["businessName"], "Biz")
        self.assertTrue(data["venueManager"]["isVerified"])
        self.assertIn("Vegan", data["preferences"]["dietary"])

    @patch("accounts.views.safely_delete_user")
    def test_delete_returns_500_on_exception(self, mock_delete):
        mock_delete.side_effect = Exception("boom")
        res = self.client.delete(f"/api/auth/admin/users/{self.target.id}/")
        self.assertEqual(res.status_code, 500)


# ---------------------------------------------------------------------------
# CSRF protection tests
# ---------------------------------------------------------------------------


class CSRFProtectionTests(TestCase):
    """
    Verify that all state-changing auth endpoints require a valid CSRF token
    when using session-cookie authentication.

    Uses Client(enforce_csrf_checks=True) so Django's CSRF middleware is fully
    active (the default test client bypasses it).
    """

    def setUp(self):
        self.csrf_client = Client(enforce_csrf_checks=True)
        self.user = User.objects.create_user(
            email="csrf@nyu.edu", password="StrongPass!1"
        )

    def _get_csrf_token(self):
        """Hit api_me (ensure_csrf_cookie) to receive a CSRF cookie, then return it."""
        resp = self.csrf_client.get(reverse("api_me"))
        cookie = resp.cookies.get("csrftoken")
        self.assertIsNotNone(cookie, "api_me did not set a csrftoken cookie")
        return cookie.value

    def _login_session(self):
        """Log the test user in via the normal login endpoint (requires CSRF)."""
        token = self._get_csrf_token()
        resp = self.csrf_client.post(
            reverse("api_login"),
            data=json.dumps({"email": "csrf@nyu.edu", "password": "StrongPass!1"}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(
            resp.status_code,
            200,
            f"CSRF login precondition failed (status {resp.status_code}): {resp.content!r}",
        )

    # --- api_me sets CSRF cookie (GET, no token needed) ---

    def test_api_me_sets_csrf_cookie(self):
        resp = self.csrf_client.get(reverse("api_me"))
        self.assertIn("csrftoken", resp.cookies)

    # --- Login: POST without token -> 403 ---

    def test_login_without_csrf_token_is_rejected(self):
        self._get_csrf_token()  # ensure cookie is set
        resp = self.csrf_client.post(
            reverse("api_login"),
            data=json.dumps({"email": "csrf@nyu.edu", "password": "StrongPass!1"}),
            content_type="application/json",
            # deliberately omit HTTP_X_CSRFTOKEN
        )
        self.assertEqual(resp.status_code, 403)

    def test_login_with_csrf_token_succeeds(self):
        token = self._get_csrf_token()
        resp = self.csrf_client.post(
            reverse("api_login"),
            data=json.dumps({"email": "csrf@nyu.edu", "password": "StrongPass!1"}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["success"])

    # --- Register: POST without token -> 403 ---

    def test_register_without_csrf_token_is_rejected(self):
        self._get_csrf_token()
        resp = self.csrf_client.post(
            reverse("api_register"),
            data=json.dumps(
                {
                    "email": "new@nyu.edu",
                    "password": "StrongPass!1",
                    "first_name": "New",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_register_with_csrf_token_succeeds(self):
        token = self._get_csrf_token()
        resp = self.csrf_client.post(
            reverse("api_register"),
            data=json.dumps(
                {
                    "email": "new@nyu.edu",
                    "password": "StrongPass!1",
                    "first_name": "New",
                }
            ),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["success"])

    # --- Logout: POST without token -> 403 ---

    def test_logout_without_csrf_token_is_rejected(self):
        self._login_session()
        # do NOT pass X-CSRFToken
        resp = self.csrf_client.post(reverse("api_logout"))
        self.assertEqual(resp.status_code, 403)

    def test_logout_with_csrf_token_succeeds(self):
        self._login_session()
        token = self._get_csrf_token()
        resp = self.csrf_client.post(
            reverse("api_logout"),
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["success"])

    # --- Preferences: PATCH without token -> 403 ---

    def test_preferences_update_without_csrf_token_is_rejected(self):
        self._login_session()
        resp = self.csrf_client.patch(
            reverse("api_preferences_update"),
            data=json.dumps({"dietary": ["Vegan"]}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_preferences_update_with_csrf_token_succeeds(self):
        self._login_session()
        token = self._get_csrf_token()
        resp = self.csrf_client.patch(
            reverse("api_preferences_update"),
            data=json.dumps({"dietary": ["Vegan"]}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resp.status_code, 200)

    # --- Password reset request: POST without token -> 403 ---

    def test_password_reset_request_without_csrf_token_is_rejected(self):
        self._get_csrf_token()
        resp = self.csrf_client.post(
            reverse("api_request_password_reset"),
            data=json.dumps({"email": "csrf@nyu.edu"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 403)

    @patch("accounts.views.send_password_reset_email")
    def test_password_reset_request_with_csrf_token_succeeds(self, mock_send):
        token = self._get_csrf_token()
        resp = self.csrf_client.post(
            reverse("api_request_password_reset"),
            data=json.dumps({"email": "csrf@nyu.edu"}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["success"])


# ---------------------------------------------------------------------------
# User profile self-edit endpoints (PATCH /api/auth/profile/ and
# POST /api/auth/profile/photo/)
# ---------------------------------------------------------------------------


def _make_jpeg(size=(10, 10)):
    """Return an in-memory BytesIO JPEG with a .name attribute."""
    from PIL import Image

    buf = BytesIO()
    Image.new("RGB", size, color="red").save(buf, format="JPEG")
    buf.seek(0)
    buf.name = "photo.jpg"
    return buf


class UserProfileTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            email="profile@nyu.edu",
            password="StrongPass!1",
            first_name="Ada",
            last_name="Lovelace",
            phone="212-555-0100",
        )
        self.client.force_login(self.user)

    # -- PATCH /api/auth/profile/ -----------------------------------------

    def test_update_profile_success(self):
        resp = self.client.patch(
            reverse("api_update_profile"),
            data=json.dumps(
                {
                    "firstName": "Grace",
                    "lastName": "Hopper",
                    "phone": "212-555-0200",
                    "bio": "I debug things.",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["user"]["firstName"], "Grace")
        self.assertEqual(data["user"]["lastName"], "Hopper")
        self.assertEqual(data["user"]["phone"], "212-555-0200")
        self.assertEqual(data["user"]["bio"], "I debug things.")
        self.assertEqual(data["user"]["name"], "Grace Hopper")
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Grace")
        self.assertEqual(self.user.bio, "I debug things.")

    def test_update_profile_partial_update(self):
        """Sending only bio should leave other fields untouched."""
        resp = self.client.patch(
            reverse("api_update_profile"),
            data=json.dumps({"bio": "Just a bio."}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Ada")  # unchanged
        self.assertEqual(self.user.bio, "Just a bio.")

    def test_update_profile_unauthenticated(self):
        self.client.logout()
        resp = self.client.patch(
            reverse("api_update_profile"),
            data=json.dumps({"bio": "x"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 401)

    def test_update_profile_wrong_method(self):
        resp = self.client.get(reverse("api_update_profile"))
        self.assertEqual(resp.status_code, 405)

    def test_update_profile_bio_too_long(self):
        resp = self.client.patch(
            reverse("api_update_profile"),
            data=json.dumps({"bio": "x" * 501}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Bio too long", resp.json()["error"])

    def test_update_profile_persists_across_login(self):
        self.client.patch(
            reverse("api_update_profile"),
            data=json.dumps({"firstName": "Persisted", "bio": "Saved bio"}),
            content_type="application/json",
        )
        self.client.logout()
        self.client.login(email="profile@nyu.edu", password="StrongPass!1")
        resp = self.client.get(reverse("api_me"))
        self.assertEqual(resp.status_code, 200)
        user_data = resp.json()["user"]
        self.assertEqual(user_data["firstName"], "Persisted")
        self.assertEqual(user_data["bio"], "Saved bio")

    # -- POST /api/auth/profile/photo/ ------------------------------------

    @override_settings(
        AWS_S3_BUCKET_NAME="mealswipe-profile-pictures", AWS_S3_REGION_NAME="us-east-1"
    )
    @patch("accounts.views.boto3_lib.client")
    def test_upload_photo_success(self, mock_boto):
        mock_s3 = MagicMock()
        mock_boto.return_value = mock_s3
        mock_s3.upload_fileobj.return_value = None

        resp = self.client.post(
            reverse("api_upload_profile_photo"),
            data={"photo": _make_jpeg()},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertIn("mealswipe-profile-pictures", data["photoUrl"])
        self.assertIn("profile_photos/", data["photoUrl"])
        self.user.refresh_from_db()
        self.assertEqual(self.user.photo_url, data["photoUrl"])
        mock_s3.upload_fileobj.assert_called_once()

    def test_upload_photo_unauthenticated(self):
        self.client.logout()
        resp = self.client.post(
            reverse("api_upload_profile_photo"),
            data={"photo": _make_jpeg()},
        )
        self.assertEqual(resp.status_code, 401)

    def test_upload_photo_too_large(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        big = SimpleUploadedFile(
            "big.jpg", b"x" * (5 * 1024 * 1024 + 1), content_type="image/jpeg"
        )
        resp = self.client.post(
            reverse("api_upload_profile_photo"), data={"photo": big}
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("too large", resp.json()["error"])

    def test_upload_photo_invalid_content_type(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        pdf = SimpleUploadedFile(
            "doc.pdf", b"%PDF-fake", content_type="application/pdf"
        )
        resp = self.client.post(
            reverse("api_upload_profile_photo"), data={"photo": pdf}
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Invalid file type", resp.json()["error"])

    def test_upload_photo_spoofed_content_type(self):
        """content_type says JPEG but body is not a valid image — Pillow rejects it."""
        from django.core.files.uploadedfile import SimpleUploadedFile

        fake = SimpleUploadedFile(
            "photo.jpg", b"this is not an image", content_type="image/jpeg"
        )
        resp = self.client.post(
            reverse("api_upload_profile_photo"), data={"photo": fake}
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Invalid or corrupt", resp.json()["error"])

    def test_upload_photo_no_file(self):
        resp = self.client.post(reverse("api_upload_profile_photo"), data={})
        self.assertEqual(resp.status_code, 400)
        self.assertIn("No photo", resp.json()["error"])

    def test_upload_photo_wrong_method(self):
        resp = self.client.get(reverse("api_upload_profile_photo"))
        self.assertEqual(resp.status_code, 405)

    @override_settings(AWS_S3_BUCKET_NAME="mealswipe-profile-pictures", AWS_S3_REGION_NAME="us-east-1")
    @patch("accounts.views.boto3_lib.client")
    def test_upload_photo_s3_failure(self, mock_boto):
        """S3 upload_fileobj raises — view should return 500."""
        mock_s3 = MagicMock()
        mock_boto.return_value = mock_s3
        mock_s3.upload_fileobj.side_effect = Exception("S3 down")

        resp = self.client.post(
            reverse("api_upload_profile_photo"),
            data={"photo": _make_jpeg()},
        )
        self.assertEqual(resp.status_code, 500)
        self.assertIn("Photo upload failed", resp.json()["error"])

    @override_settings(AWS_S3_BUCKET_NAME="mealswipe-profile-pictures", AWS_S3_REGION_NAME="us-east-1")
    @patch("accounts.views.boto3_lib.client")
    def test_upload_photo_deletes_old_photo(self, mock_boto):
        """If user already has an S3 photo, the old key is deleted before upload."""
        mock_s3 = MagicMock()
        mock_boto.return_value = mock_s3
        mock_s3.upload_fileobj.return_value = None

        old_url = "https://mealswipe-profile-pictures.s3.us-east-1.amazonaws.com/profile_photos/user_1_old.jpg"
        self.user.photo_url = old_url
        self.user.save(update_fields=["photo_url"])

        resp = self.client.post(
            reverse("api_upload_profile_photo"),
            data={"photo": _make_jpeg()},
        )
        self.assertEqual(resp.status_code, 200)
        mock_s3.delete_object.assert_called_once_with(
            Bucket="mealswipe-profile-pictures",
            Key="profile_photos/user_1_old.jpg",
        )
        mock_s3.upload_fileobj.assert_called_once()


class UserDeleteS3SignalTests(TestCase):
    """Tests for the post_delete signal that cleans up S3 photos."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="signal@nyu.edu",
            password="StrongPass!1",
        )

    @override_settings(AWS_S3_BUCKET_NAME="mealswipe-profile-pictures", AWS_S3_REGION_NAME="us-east-1")
    @patch("boto3.client")
    def test_signal_deletes_s3_photo_on_user_delete(self, mock_boto):
        mock_s3 = MagicMock()
        mock_boto.return_value = mock_s3

        self.user.photo_url = (
            "https://mealswipe-profile-pictures.s3.us-east-1.amazonaws.com/profile_photos/user_sig_abc.jpg"
        )
        self.user.save(update_fields=["photo_url"])
        self.user.delete()

        mock_s3.delete_object.assert_called_once_with(
            Bucket="mealswipe-profile-pictures",
            Key="profile_photos/user_sig_abc.jpg",
        )

    @override_settings(AWS_S3_BUCKET_NAME="mealswipe-profile-pictures", AWS_S3_REGION_NAME="us-east-1")
    @patch("boto3.client")
    def test_signal_skips_delete_if_no_photo(self, mock_boto):
        """User with no photo_url — signal returns early without touching S3."""
        self.user.photo_url = ""
        self.user.save(update_fields=["photo_url"])
        self.user.delete()
        mock_boto.assert_not_called()

    @override_settings(AWS_S3_BUCKET_NAME="mealswipe-profile-pictures", AWS_S3_REGION_NAME="us-east-1")
    @patch("boto3.client")
    def test_signal_skips_delete_if_external_url(self, mock_boto):
        """photo_url pointing to external CDN — not our bucket, signal skips."""
        self.user.photo_url = "https://external-cdn.example.com/avatars/abc.jpg"
        self.user.save(update_fields=["photo_url"])
        self.user.delete()
        mock_boto.assert_not_called()

    @override_settings(AWS_S3_BUCKET_NAME="mealswipe-profile-pictures", AWS_S3_REGION_NAME="us-east-1")
    @patch("boto3.client")
    def test_signal_logs_error_on_s3_failure(self, mock_boto):
        """S3 delete_object raises — signal catches and logs, does not propagate."""
        mock_s3 = MagicMock()
        mock_boto.return_value = mock_s3
        mock_s3.delete_object.side_effect = Exception("S3 down")

        self.user.photo_url = (
            "https://mealswipe-profile-pictures.s3.us-east-1.amazonaws.com/profile_photos/user_sig_err.jpg"
        )
        self.user.save(update_fields=["photo_url"])
        # Should not raise
        self.user.delete()
