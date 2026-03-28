"""Tests to cover uncovered lines in accounts app (models, email_service, smtp_backend, views)."""

import smtplib
from unittest.mock import patch, PropertyMock

from django.test import TestCase, Client, override_settings
from django.contrib.auth import get_user_model

from accounts.models import (
    CuisineType,
    DietaryTag,
    FoodTypeTag,
    UserPreference,
    VenueManagerProfile,
    normalize_sanitation_grade,
)
from accounts.email_service import send_password_reset_email, EmailSendError
from accounts.smtp_backend import CertifiSMTPBackend

User = get_user_model()


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
        mock_send_mail.side_effect = smtplib.SMTPAuthenticationError(535, b"Auth failed")
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
        import accounts.smtp_backend as mod
        original_import = __builtins__.__import__ if hasattr(__builtins__, '__import__') else __import__

        def fake_import(name, *args, **kwargs):
            if name == "certifi":
                raise ImportError("No certifi")
            return original_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=fake_import):
            backend._ssl_context = None
            ctx = backend.ssl_context
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
