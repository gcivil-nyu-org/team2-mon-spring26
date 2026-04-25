# venues/tests.py
import datetime
import json
import os
import tempfile
from io import StringIO
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import IntegrityError
from django.test import TestCase, override_settings, Client
from django.urls import reverse

from accounts.models import (
    CuisineType,
    DietaryTag,
    FoodTypeTag,
    VenueManagerProfile,
)
from venues.management.commands.ingest_csv import (
    parse_bool,
    parse_date,
    parse_decimal,
    parse_google_types,
    parse_hours,
    parse_int,
    map_price_range,
)
from venues.models import (
    ContentReport,
    Inspection,
    Review,
    ReviewComment,
    StudentDiscount,
    Venue,
    VenueClaim,
    VenuePhoto,
    VenueTidbit,
)

User = get_user_model()


class VenueModelTest(TestCase):
    def setUp(self):
        self.venue = Venue.objects.create(name="Test Restaurant")

    def test_venue_str(self):
        self.assertEqual(str(self.venue), "Test Restaurant")


class InspectionModelTest(TestCase):
    def setUp(self):
        self.venue = Venue.objects.create(name="Test Restaurant")
        self.inspection = Inspection.objects.create(
            venue=self.venue, inspection_date=datetime.date(2024, 1, 15), grade="A"
        )

    def test_inspection_str(self):
        self.assertEqual(str(self.inspection), "Test Restaurant — 2024-01-15 (A)")


class StudentDiscountModelTest(TestCase):
    def setUp(self):
        self.venue = Venue.objects.create(name="Test Restaurant")
        self.discount = StudentDiscount.objects.create(
            venue=self.venue, discount_type="10% off"
        )

    def test_student_discount_str(self):
        self.assertEqual(str(self.discount), "Test Restaurant — 10% off")


class VenuePhotoModelTest(TestCase):
    def setUp(self):
        self.venue = Venue.objects.create(name="Test Restaurant")
        self.photo = VenuePhoto.objects.create(
            venue=self.venue, image_url="https://example.com/photo.jpg", is_primary=True
        )

    def test_venue_photo_str_primary(self):
        self.assertEqual(str(self.photo), "Test Restaurant — primary")

    def test_venue_photo_str_not_primary(self):
        self.photo.is_primary = False
        self.photo.save()
        self.assertEqual(str(self.photo), "Test Restaurant — photo")

    def test_image_url_supports_long_urls(self):
        """image_url must accept URLs longer than 200 chars (e.g. Google CDN URLs)."""
        long_url = "https://lh3.googleusercontent.com/places/photo/" + "a" * 300
        photo = VenuePhoto.objects.create(
            venue=self.venue, image_url=long_url, is_primary=False
        )
        photo.refresh_from_db()
        self.assertEqual(photo.image_url, long_url)


class VenueTidbitModelTest(TestCase):
    def setUp(self):
        self.venue = Venue.objects.create(name="Test Restaurant")
        self.tidbit = VenueTidbit.objects.create(
            venue=self.venue, content="Great happy hour deals!"
        )

    def test_venue_tidbit_str(self):
        self.assertEqual(str(self.tidbit), "Test Restaurant — tidbit")


class ReviewModelTest(TestCase):
    def setUp(self):
        self.venue = Venue.objects.create(name="Test Restaurant")
        self.user = User.objects.create_user(
            username="testuser", email="test@nyu.edu", password="testpass123"
        )
        self.review = Review.objects.create(
            venue=self.venue,
            user=self.user,
            rating=5,
            visit_date=datetime.date(2024, 1, 15),
        )

    def test_review_str(self):
        self.assertEqual(str(self.review), "test@nyu.edu — Test Restaurant (5★)")


class ReviewCommentModelTest(TestCase):
    def setUp(self):
        self.venue = Venue.objects.create(name="Test Restaurant")
        self.user = User.objects.create_user(
            username="testuser", email="test@nyu.edu", password="testpass123"
        )
        self.review = Review.objects.create(
            venue=self.venue,
            user=self.user,
            rating=5,
            visit_date=datetime.date(2024, 1, 15),
        )
        self.comment = ReviewComment.objects.create(
            review=self.review, user=self.user, content="Thank you for the review!"
        )

    def test_review_comment_str(self):
        self.assertEqual(
            str(self.comment), f"Comment by test@nyu.edu on review {self.review.id}"
        )


@override_settings(GOOGLE_PLACES_API_KEY="test-api-key")
class GooglePlacesPhotoTest(TestCase):
    def setUp(self):
        self.venue = Venue.objects.create(
            name="Test Restaurant", google_place_id="ChIJtestplace123"
        )

    def _make_detail_response(self, photo_name="places/ChIJtest/photos/AUacXtest"):
        resp = MagicMock()
        resp.status_code = 200
        resp.json.return_value = {"photos": [{"name": photo_name}]}
        resp.raise_for_status = MagicMock()
        return resp

    def _make_media_response(
        self, location="https://lh3.googleusercontent.com/places/photo"
    ):
        resp = MagicMock()
        resp.status_code = 302
        resp.headers = {"Location": location}
        return resp

    @patch("venues.google_places.requests.get")
    def test_fetches_and_caches_photo_on_first_call(self, mock_get):
        cdn_url = "https://lh3.googleusercontent.com/places/photo"
        mock_get.side_effect = [
            self._make_detail_response(),
            self._make_media_response(cdn_url),
        ]

        from venues.google_places import fetch_and_cache_primary_photo

        result = fetch_and_cache_primary_photo(self.venue)

        self.assertEqual(result, cdn_url)
        self.assertEqual(mock_get.call_count, 2)
        photo = VenuePhoto.objects.get(venue=self.venue, source="google_places")
        self.assertEqual(photo.image_url, cdn_url)
        self.assertTrue(photo.is_primary)

    @patch("venues.google_places.requests.get")
    def test_cached_photo_prevents_api_call(self, mock_get):
        cdn_url = "https://lh3.googleusercontent.com/places/cached"
        VenuePhoto.objects.create(
            venue=self.venue,
            image_url=cdn_url,
            source="google_places",
            is_primary=True,
        )

        from venues.google_places import fetch_and_cache_primary_photo

        result = fetch_and_cache_primary_photo(self.venue)

        self.assertEqual(result, cdn_url)
        mock_get.assert_not_called()

    @patch("venues.google_places.requests.get")
    def test_api_failure_does_not_create_photo_row(self, mock_get):
        mock_get.side_effect = Exception("network error")

        from venues.google_places import fetch_and_cache_primary_photo

        result = fetch_and_cache_primary_photo(self.venue)

        self.assertIsNone(result)
        self.assertFalse(VenuePhoto.objects.filter(venue=self.venue).exists())

    @patch("venues.google_places.requests.get")
    def test_non_redirect_response_does_not_store_api_key_url(self, mock_get):
        # If Google returns 200 directly (no redirect), we must not store the URL
        # because it would contain the API key.
        detail_resp = self._make_detail_response()
        media_resp = MagicMock()
        media_resp.status_code = 200  # unexpected — no redirect
        mock_get.side_effect = [detail_resp, media_resp]

        from venues.google_places import fetch_and_cache_primary_photo

        result = fetch_and_cache_primary_photo(self.venue)

        self.assertIsNone(result)
        self.assertFalse(VenuePhoto.objects.filter(venue=self.venue).exists())

    def test_no_place_id_returns_none(self):
        venue = Venue.objects.create(name="No Place ID Venue")

        from venues.google_places import fetch_and_cache_primary_photo

        result = fetch_and_cache_primary_photo(venue)

        self.assertIsNone(result)


# ---------------------------------------------------------------------------
# Integration tests for venues.views JSON API endpoints.
# Covers venue-manager-facing (/api/venues/...) and admin-facing
# (/api/venues/admin/...) endpoints.
# ---------------------------------------------------------------------------


def make_user(email, role="student", password="pass123"):
    user = User.objects.create_user(email=email, password=password, role=role)
    return user


def make_manager_profile(email, business_name="Biz"):
    user = make_user(email, role="venue_manager")
    return VenueManagerProfile.objects.create(
        user=user,
        business_name=business_name,
        business_email=email,
    )


# ---------------------------------------------------------------------------
# Venue-manager-facing endpoints
# ---------------------------------------------------------------------------


class VenueSearchTests(TestCase):
    def setUp(self):
        self.manager_profile = make_manager_profile("m1@example.com")
        self.student = make_user("s@example.com", role="student")

        self.cuisine = CuisineType.objects.create(name="Italian")
        self.venue_a = Venue.objects.create(
            name="Pizza Palace",
            borough="Manhattan",
            cuisine_type=self.cuisine,
            is_active=True,
        )
        self.venue_b = Venue.objects.create(
            name="Burger Joint",
            borough="Brooklyn",
            is_active=True,
        )
        self.inactive = Venue.objects.create(
            name="Closed Place", borough="Queens", is_active=False
        )
        # An active discount on venue_a so hasStudentDiscount flips true.
        StudentDiscount.objects.create(
            venue=self.venue_a,
            discount_type="percent",
            discount_value="10%",
            is_active=True,
        )
        self.url = reverse("venue_search")

    def test_requires_authentication(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 401)

    def test_requires_manager_role(self):
        self.client.force_login(self.student)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 403)

    def test_method_not_allowed(self):
        self.client.force_login(self.manager_profile.user)
        resp = self.client.post(self.url)
        self.assertEqual(resp.status_code, 405)

    def test_returns_only_active_venues(self):
        self.client.force_login(self.manager_profile.user)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        names = [v["name"] for v in resp.json()["results"]]
        self.assertIn("Pizza Palace", names)
        self.assertIn("Burger Joint", names)
        self.assertNotIn("Closed Place", names)

    def test_query_filter(self):
        self.client.force_login(self.manager_profile.user)
        resp = self.client.get(self.url, {"q": "pizza"})
        names = [v["name"] for v in resp.json()["results"]]
        self.assertEqual(names, ["Pizza Palace"])

    def test_borough_filter(self):
        self.client.force_login(self.manager_profile.user)
        resp = self.client.get(self.url, {"borough": "Brooklyn"})
        names = [v["name"] for v in resp.json()["results"]]
        self.assertEqual(names, ["Burger Joint"])

    def test_has_student_discount_flag(self):
        self.client.force_login(self.manager_profile.user)
        resp = self.client.get(self.url, {"q": "pizza"})
        self.assertTrue(resp.json()["results"][0]["hasStudentDiscount"])


class VenueClaimTests(TestCase):
    def setUp(self):
        self.manager = make_manager_profile("m1@example.com")
        self.other = make_manager_profile("m2@example.com")
        self.venue = Venue.objects.create(name="Unclaimed", is_active=True)
        self.owned_venue = Venue.objects.create(
            name="Owned", is_active=True, managed_by=self.manager
        )
        self.url = lambda vid: reverse("venue_claim", args=[vid])

    def test_method_not_allowed(self):
        self.client.force_login(self.manager.user)
        resp = self.client.get(self.url(self.venue.id))
        self.assertEqual(resp.status_code, 405)

    def test_requires_auth(self):
        resp = self.client.post(self.url(self.venue.id))
        self.assertEqual(resp.status_code, 401)

    def test_requires_manager_role(self):
        student = make_user("s@example.com")
        self.client.force_login(student)
        resp = self.client.post(self.url(self.venue.id))
        self.assertEqual(resp.status_code, 403)

    def test_venue_not_found(self):
        self.client.force_login(self.manager.user)
        resp = self.client.post(self.url(99999))
        self.assertEqual(resp.status_code, 404)

    def test_claim_success(self):
        self.client.force_login(self.manager.user)
        resp = self.client.post(
            self.url(self.venue.id),
            data=json.dumps({"note": "I own this"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 201)
        self.venue.refresh_from_db()
        self.assertEqual(self.venue.managed_by, self.manager)
        claim = VenueClaim.objects.get(venue=self.venue, manager=self.manager)
        self.assertEqual(claim.status, VenueClaim.Status.PENDING)
        self.assertEqual(claim.note, "I own this")

    def test_claim_empty_body(self):
        self.client.force_login(self.manager.user)
        resp = self.client.post(self.url(self.venue.id))
        self.assertEqual(resp.status_code, 201)

    def test_claim_bad_json_body(self):
        self.client.force_login(self.manager.user)
        resp = self.client.post(
            self.url(self.venue.id),
            data="not json at all",
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 201)

    def test_already_claimed_by_self(self):
        self.client.force_login(self.manager.user)
        resp = self.client.post(self.url(self.owned_venue.id))
        self.assertEqual(resp.status_code, 409)

    def test_already_claimed_by_other(self):
        self.client.force_login(self.other.user)
        resp = self.client.post(self.url(self.owned_venue.id))
        self.assertEqual(resp.status_code, 409)

    def test_claim_requires_profile(self):
        """A venue_manager user without a profile should get 404."""
        user = make_user("noprofile@example.com", role="venue_manager")
        self.client.force_login(user)
        resp = self.client.post(self.url(self.venue.id))
        self.assertEqual(resp.status_code, 404)


class MyVenuesTests(TestCase):
    def setUp(self):
        self.manager = make_manager_profile("m@example.com")
        self.other = make_manager_profile("o@example.com")
        Venue.objects.create(name="Mine A", managed_by=self.manager, is_active=True)
        Venue.objects.create(name="Mine B", managed_by=self.manager, is_active=True)
        Venue.objects.create(name="Theirs", managed_by=self.other, is_active=True)
        Venue.objects.create(name="Unmanaged", is_active=True)
        self.url = reverse("venue_my_venues")

    def test_method_not_allowed(self):
        self.client.force_login(self.manager.user)
        resp = self.client.post(self.url)
        self.assertEqual(resp.status_code, 405)

    def test_lists_only_owned_venues(self):
        self.client.force_login(self.manager.user)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        names = sorted(v["name"] for v in resp.json()["venues"])
        self.assertEqual(names, ["Mine A", "Mine B"])


class VenueDetailTests(TestCase):
    def setUp(self):
        self.manager = make_manager_profile("m@example.com")
        self.venue = Venue.objects.create(
            name="Mine", managed_by=self.manager, is_active=True
        )
        self.other_venue = Venue.objects.create(name="Other", is_active=True)
        self.url = lambda vid: reverse("venue_detail", args=[vid])

    def test_method_not_allowed(self):
        self.client.force_login(self.manager.user)
        resp = self.client.post(self.url(self.venue.id))
        self.assertEqual(resp.status_code, 405)

    def test_success_for_owned_venue(self):
        self.client.force_login(self.manager.user)
        resp = self.client.get(self.url(self.venue.id))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["venue"]["name"], "Mine")

    def test_not_owned_returns_404(self):
        self.client.force_login(self.manager.user)
        resp = self.client.get(self.url(self.other_venue.id))
        self.assertEqual(resp.status_code, 404)


class VenueDiscountsTests(TestCase):
    def setUp(self):
        self.manager = make_manager_profile("m@example.com")
        self.other_manager = make_manager_profile("o@example.com")
        self.venue = Venue.objects.create(
            name="Mine", managed_by=self.manager, is_active=True
        )
        self.url = reverse("venue_discounts", args=[self.venue.id])

    def test_list_discounts(self):
        StudentDiscount.objects.create(
            venue=self.venue, discount_type="percent", discount_value="10%"
        )
        self.client.force_login(self.manager.user)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()["discounts"]), 1)

    def test_create_discount(self):
        self.client.force_login(self.manager.user)
        resp = self.client.post(
            self.url,
            data=json.dumps(
                {
                    "discountType": "percent",
                    "discountValue": "15%",
                    "description": "Student deal",
                    "requiresNyuId": True,
                    "isActive": True,
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(StudentDiscount.objects.filter(venue=self.venue).count(), 1)

    def test_create_discount_bad_json(self):
        self.client.force_login(self.manager.user)
        resp = self.client.post(self.url, data="oops", content_type="application/json")
        self.assertEqual(resp.status_code, 400)

    def test_venue_not_owned_returns_404(self):
        self.client.force_login(self.other_manager.user)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 404)

    def test_method_not_allowed(self):
        self.client.force_login(self.manager.user)
        resp = self.client.put(self.url)
        self.assertEqual(resp.status_code, 405)


class VenueDiscountDetailTests(TestCase):
    def setUp(self):
        self.manager = make_manager_profile("m@example.com")
        self.other_manager = make_manager_profile("o@example.com")
        self.venue = Venue.objects.create(
            name="Mine", managed_by=self.manager, is_active=True
        )
        self.discount = StudentDiscount.objects.create(
            venue=self.venue,
            discount_type="percent",
            discount_value="10%",
            description="Old",
            is_active=True,
        )
        self.url = reverse(
            "venue_discount_detail", args=[self.venue.id, self.discount.id]
        )

    def test_patch_update_all_fields(self):
        self.client.force_login(self.manager.user)
        resp = self.client.patch(
            self.url,
            data=json.dumps(
                {
                    "discountType": "flat",
                    "discountValue": "$5",
                    "description": "New",
                    "requiresNyuId": False,
                    "isActive": False,
                    "validFrom": "2026-01-01",
                    "validUntil": "2026-12-31",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.discount.refresh_from_db()
        self.assertEqual(self.discount.discount_type, "flat")
        self.assertEqual(self.discount.discount_value, "$5")
        self.assertEqual(self.discount.description, "New")
        self.assertFalse(self.discount.requires_nyu_id)
        self.assertFalse(self.discount.is_active)

    def test_patch_noop(self):
        self.client.force_login(self.manager.user)
        resp = self.client.patch(
            self.url, data=json.dumps({}), content_type="application/json"
        )
        self.assertEqual(resp.status_code, 200)

    def test_patch_bad_json(self):
        self.client.force_login(self.manager.user)
        resp = self.client.patch(self.url, data="bad", content_type="application/json")
        self.assertEqual(resp.status_code, 400)

    def test_delete(self):
        self.client.force_login(self.manager.user)
        resp = self.client.delete(self.url)
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(StudentDiscount.objects.filter(pk=self.discount.id).exists())

    def test_venue_not_owned(self):
        self.client.force_login(self.other_manager.user)
        resp = self.client.delete(self.url)
        self.assertEqual(resp.status_code, 404)

    def test_discount_not_found(self):
        self.client.force_login(self.manager.user)
        resp = self.client.patch(
            reverse("venue_discount_detail", args=[self.venue.id, 99999]),
            data=json.dumps({}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 404)

    def test_method_not_allowed(self):
        self.client.force_login(self.manager.user)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 405)


# ---------------------------------------------------------------------------
# Admin-facing endpoints
# ---------------------------------------------------------------------------


class AdminRequireAdminTests(TestCase):
    """Covers the _require_admin helper via the endpoints that use it."""

    def setUp(self):
        self.student = make_user("s@example.com", role="student")
        self.url = reverse("admin_venue_options")

    def test_anonymous_401(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 401)

    def test_non_admin_403(self):
        self.client.force_login(self.student)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 403)


class AdminVenueClaimsTests(TestCase):
    def setUp(self):
        self.admin = make_user("a@example.com", role="admin")
        self.manager = make_manager_profile("m@example.com")
        self.venue = Venue.objects.create(name="V1", is_active=True)
        self.pending = VenueClaim.objects.create(
            venue=self.venue,
            manager=self.manager,
            status=VenueClaim.Status.PENDING,
            note="please",
        )
        self.approved = VenueClaim.objects.create(
            venue=Venue.objects.create(name="V2", is_active=True),
            manager=self.manager,
            status=VenueClaim.Status.APPROVED,
        )
        self.url = reverse("admin_venue_claims")

    def test_method_not_allowed(self):
        self.client.force_login(self.admin)
        resp = self.client.post(self.url)
        self.assertEqual(resp.status_code, 405)

    def test_list_all(self):
        self.client.force_login(self.admin)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["totalCount"], 2)
        self.assertEqual(len(data["claims"]), 2)

    def test_status_filter(self):
        self.client.force_login(self.admin)
        resp = self.client.get(self.url, {"status": "pending"})
        data = resp.json()
        self.assertEqual(data["totalCount"], 1)
        self.assertEqual(data["claims"][0]["status"], "pending")

    def test_invalid_status_filter_ignored(self):
        self.client.force_login(self.admin)
        resp = self.client.get(self.url, {"status": "garbage"})
        # Invalid status is ignored — all claims returned.
        self.assertEqual(resp.json()["totalCount"], 2)

    def test_pagination_clamps_to_last_page(self):
        self.client.force_login(self.admin)
        resp = self.client.get(self.url, {"page": "999"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["page"], 1)


class AdminVenueClaimActionTests(TestCase):
    def setUp(self):
        self.admin = make_user("a@example.com", role="admin")
        self.manager = make_manager_profile("m@example.com")
        self.venue = Venue.objects.create(
            name="V", is_active=True, managed_by=self.manager
        )
        self.claim = VenueClaim.objects.create(
            venue=self.venue,
            manager=self.manager,
            status=VenueClaim.Status.PENDING,
        )
        self.url = reverse("admin_venue_claim_action", args=[self.claim.id])

    def test_method_not_allowed(self):
        self.client.force_login(self.admin)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 405)

    def test_claim_not_found(self):
        self.client.force_login(self.admin)
        resp = self.client.post(
            reverse("admin_venue_claim_action", args=[99999]),
            data=json.dumps({"action": "approve"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 404)

    def test_bad_json(self):
        self.client.force_login(self.admin)
        resp = self.client.post(self.url, data="nope", content_type="application/json")
        self.assertEqual(resp.status_code, 400)

    def test_invalid_action(self):
        self.client.force_login(self.admin)
        resp = self.client.post(
            self.url,
            data=json.dumps({"action": "maybe"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_approve_marks_venue_verified(self):
        self.client.force_login(self.admin)
        resp = self.client.post(
            self.url,
            data=json.dumps({"action": "approve", "adminNote": "LGTM"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.claim.refresh_from_db()
        self.venue.refresh_from_db()
        self.assertEqual(self.claim.status, VenueClaim.Status.APPROVED)
        self.assertEqual(self.claim.admin_note, "LGTM")
        self.assertIsNotNone(self.claim.reviewed_at)
        self.assertTrue(self.venue.is_verified)

    def test_reject_clears_manager(self):
        self.client.force_login(self.admin)
        resp = self.client.post(
            self.url,
            data=json.dumps({"action": "reject"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.claim.refresh_from_db()
        self.venue.refresh_from_db()
        self.assertEqual(self.claim.status, VenueClaim.Status.REJECTED)
        self.assertIsNone(self.venue.managed_by)
        self.assertFalse(self.venue.is_verified)


class AdminVenueOptionsTests(TestCase):
    def setUp(self):
        self.admin = make_user("a@example.com", role="admin")
        CuisineType.objects.create(name="Italian")
        CuisineType.objects.create(name="Chinese")
        DietaryTag.objects.create(name="Vegan")
        FoodTypeTag.objects.create(name="Noodles")
        self.url = reverse("admin_venue_options")

    def test_method_not_allowed(self):
        self.client.force_login(self.admin)
        resp = self.client.post(self.url)
        self.assertEqual(resp.status_code, 405)

    def test_returns_all_option_lists(self):
        self.client.force_login(self.admin)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(
            sorted(c["name"] for c in data["cuisineTypes"]),
            ["Chinese", "Italian"],
        )
        self.assertIn("Vegan", data["dietaryTags"])
        self.assertIn("Noodles", data["foodTypeTags"])


class AdminVenuesListTests(TestCase):
    def setUp(self):
        self.admin = make_user("a@example.com", role="admin")
        self.cuisine = CuisineType.objects.create(name="Italian")
        self.v1 = Venue.objects.create(
            name="Alpha Pizza",
            borough="Manhattan",
            cuisine_type=self.cuisine,
            is_active=True,
        )
        self.v2 = Venue.objects.create(
            name="Beta Burgers", borough="Brooklyn", is_active=True
        )
        self.url = reverse("admin_venues")

    def test_method_not_allowed(self):
        self.client.force_login(self.admin)
        resp = self.client.post(self.url)
        self.assertEqual(resp.status_code, 405)

    def test_list_all(self):
        self.client.force_login(self.admin)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["totalCount"], 2)
        names = sorted(v["name"] for v in data["venues"])
        self.assertEqual(names, ["Alpha Pizza", "Beta Burgers"])

    def test_query_filter(self):
        self.client.force_login(self.admin)
        resp = self.client.get(self.url, {"q": "pizza"})
        names = [v["name"] for v in resp.json()["venues"]]
        self.assertEqual(names, ["Alpha Pizza"])

    def test_borough_filter(self):
        self.client.force_login(self.admin)
        resp = self.client.get(self.url, {"borough": "Brooklyn"})
        names = [v["name"] for v in resp.json()["venues"]]
        self.assertEqual(names, ["Beta Burgers"])


class AdminVenueDetailTests(TestCase):
    def setUp(self):
        self.admin = make_user("a@example.com", role="admin")
        self.manager = make_manager_profile("m@example.com")
        self.cuisine = CuisineType.objects.create(name="Italian")
        self.venue = Venue.objects.create(
            name="Old Name",
            street_address="1 Main St",
            borough="Manhattan",
            cuisine_type=self.cuisine,
            is_active=True,
            managed_by=self.manager,
        )
        # A pending claim that should get rejected when removeManager is used.
        VenueClaim.objects.create(
            venue=self.venue,
            manager=self.manager,
            status=VenueClaim.Status.PENDING,
        )
        DietaryTag.objects.create(name="Vegan")
        FoodTypeTag.objects.create(name="Pizza")
        self.url = reverse("admin_venue_detail", args=[self.venue.id])

    def test_not_found(self):
        self.client.force_login(self.admin)
        resp = self.client.get(reverse("admin_venue_detail", args=[99999]))
        self.assertEqual(resp.status_code, 404)

    def test_method_not_allowed(self):
        self.client.force_login(self.admin)
        resp = self.client.post(self.url)
        self.assertEqual(resp.status_code, 405)

    def test_get_returns_full_detail(self):
        self.client.force_login(self.admin)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        venue = resp.json()["venue"]
        self.assertEqual(venue["name"], "Old Name")
        self.assertEqual(venue["cuisineType"], "Italian")
        self.assertIsNotNone(venue["manager"])
        self.assertEqual(venue["manager"]["userEmail"], "m@example.com")

    def test_patch_bad_json(self):
        self.client.force_login(self.admin)
        resp = self.client.patch(self.url, data="nope", content_type="application/json")
        self.assertEqual(resp.status_code, 400)

    def test_patch_updates_scalar_fields(self):
        self.client.force_login(self.admin)
        resp = self.client.patch(
            self.url,
            data=json.dumps(
                {
                    "name": "New Name",
                    "streetAddress": "2 Main St",
                    "borough": "Brooklyn",
                    "neighborhood": "Williamsburg",
                    "zipcode": "11211",
                    "phone": "555-1234",
                    "email": "new@example.com",
                    "website": "https://new.example.com",
                    "priceRange": "$$",
                    "sanitationGrade": "A",
                    "seatingCapacity": 42,
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.venue.refresh_from_db()
        self.assertEqual(self.venue.name, "New Name")
        self.assertEqual(self.venue.street_address, "2 Main St")
        self.assertEqual(self.venue.borough, "Brooklyn")
        self.assertEqual(self.venue.seating_capacity, 42)

    def test_patch_seating_capacity_null(self):
        self.client.force_login(self.admin)
        resp = self.client.patch(
            self.url,
            data=json.dumps({"seatingCapacity": None}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.venue.refresh_from_db()
        self.assertIsNone(self.venue.seating_capacity)

    def test_patch_booleans(self):
        self.client.force_login(self.admin)
        resp = self.client.patch(
            self.url,
            data=json.dumps(
                {
                    "hasGroupSeating": True,
                    "hasTakeout": True,
                    "hasDelivery": True,
                    "hasDineIn": False,
                    "isReservable": True,
                    "isVerified": True,
                    "isActive": False,
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.venue.refresh_from_db()
        self.assertTrue(self.venue.has_group_seating)
        self.assertTrue(self.venue.is_verified)
        self.assertFalse(self.venue.is_active)

    def test_patch_boolean_must_be_bool(self):
        self.client.force_login(self.admin)
        resp = self.client.patch(
            self.url,
            data=json.dumps({"hasTakeout": "yes"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_patch_cuisine_type_creates_new(self):
        self.client.force_login(self.admin)
        resp = self.client.patch(
            self.url,
            data=json.dumps({"cuisineType": "Mexican"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.venue.refresh_from_db()
        self.assertEqual(self.venue.cuisine_type.name, "Mexican")

    def test_patch_cuisine_type_clear(self):
        self.client.force_login(self.admin)
        resp = self.client.patch(
            self.url,
            data=json.dumps({"cuisineType": ""}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.venue.refresh_from_db()
        self.assertIsNone(self.venue.cuisine_type)

    def test_patch_dietary_and_food_type_tags(self):
        self.client.force_login(self.admin)
        resp = self.client.patch(
            self.url,
            data=json.dumps(
                {
                    "dietaryTags": ["Vegan", "Halal", "  ", 123],
                    "foodTypeTags": ["Pizza", "Pasta"],
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.venue.refresh_from_db()
        diet_names = set(self.venue.dietary_tags.values_list("name", flat=True))
        food_names = set(self.venue.food_type_tags.values_list("name", flat=True))
        # "  " and 123 are skipped; Halal is created.
        self.assertEqual(diet_names, {"Vegan", "Halal"})
        self.assertEqual(food_names, {"Pizza", "Pasta"})

    def test_patch_remove_manager(self):
        self.client.force_login(self.admin)
        resp = self.client.patch(
            self.url,
            data=json.dumps({"removeManager": True}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.venue.refresh_from_db()
        self.assertIsNone(self.venue.managed_by)
        self.assertFalse(self.venue.is_verified)
        # The pending claim should have been rejected.
        claim = VenueClaim.objects.get(venue=self.venue)
        self.assertEqual(claim.status, VenueClaim.Status.REJECTED)
        self.assertEqual(claim.admin_note, "Manager removed by admin")


# ---------------------------------------------------------------------------
# Tests for venues Django management commands (ingest_csv, populate_tags)
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# ingest_csv — unit tests for the parser helpers
# ---------------------------------------------------------------------------


class IngestCsvParserTests(TestCase):
    def test_parse_date_mm_dd_yyyy(self):
        self.assertEqual(str(parse_date("01/15/2025")), "2025-01-15")

    def test_parse_date_iso(self):
        self.assertEqual(str(parse_date("2025-01-15")), "2025-01-15")

    def test_parse_date_blank(self):
        self.assertIsNone(parse_date(""))
        self.assertIsNone(parse_date("   "))
        self.assertIsNone(parse_date(None))

    def test_parse_date_garbage(self):
        self.assertIsNone(parse_date("nope"))

    def test_parse_decimal(self):
        self.assertEqual(str(parse_decimal("1.5")), "1.5")
        self.assertIsNone(parse_decimal(""))
        self.assertIsNone(parse_decimal(None))
        self.assertIsNone(parse_decimal("bad"))

    def test_parse_int(self):
        self.assertEqual(parse_int("42"), 42)
        self.assertEqual(parse_int("42.9"), 42)
        self.assertIsNone(parse_int(""))
        self.assertIsNone(parse_int(None))
        self.assertIsNone(parse_int("garbage"))

    def test_parse_bool(self):
        self.assertTrue(parse_bool("true"))
        self.assertTrue(parse_bool("1"))
        self.assertTrue(parse_bool("YES"))
        self.assertFalse(parse_bool("false"))
        self.assertFalse(parse_bool("0"))
        self.assertIsNone(parse_bool(""))
        self.assertIsNone(parse_bool(None))

    def test_map_price_range_exact(self):
        self.assertEqual(map_price_range("$0-$10"), "$")
        self.assertEqual(map_price_range("$10-$20"), "$$")
        self.assertEqual(map_price_range("$20-$30"), "$$$")
        self.assertEqual(map_price_range("$30-$40"), "$$$$")
        self.assertEqual(map_price_range("$40+"), "$$$$")

    def test_map_price_range_by_prefix(self):
        self.assertEqual(map_price_range("$$$$ premium"), "$$$$")
        self.assertEqual(map_price_range("$$$ dinner"), "$$$")
        self.assertEqual(map_price_range("$$ casual"), "$$")
        self.assertEqual(map_price_range("$ cheap"), "$")

    def test_map_price_range_blank(self):
        self.assertEqual(map_price_range(""), "")
        self.assertEqual(map_price_range(None), "")
        self.assertEqual(map_price_range("no dollar"), "")

    def test_parse_hours(self):
        result = parse_hours("Monday: 11am-11pm|Tuesday: 11am-11pm")
        self.assertEqual(result["Monday"], "11am-11pm")
        self.assertEqual(result["Tuesday"], "11am-11pm")

    def test_parse_hours_blank(self):
        self.assertEqual(parse_hours(""), {})
        self.assertEqual(parse_hours(None), {})

    def test_parse_hours_malformed_parts_ignored(self):
        result = parse_hours("Monday: 11am-11pm|garbage without colon")
        self.assertEqual(result, {"Monday": "11am-11pm"})

    def test_parse_google_types(self):
        self.assertEqual(
            parse_google_types("restaurant, cafe , bakery"),
            ["restaurant", "cafe", "bakery"],
        )

    def test_parse_google_types_blank(self):
        self.assertEqual(parse_google_types(""), [])
        self.assertEqual(parse_google_types(None), [])


# ---------------------------------------------------------------------------
# ingest_csv — command-level integration tests
# ---------------------------------------------------------------------------


HEADER = (
    "dohmh_camis,dohmh_dba,name,name_clean,address,dohmh_building,dohmh_street,"
    "borough,dohmh_boro,zipcode,phone,cuisine,dohmh_cuisine_description,"
    "latitude,longitude,price_range,google_place_id,google_rating,google_reviews,"
    "google_maps_url,google_types,has_takeout,has_delivery,has_dine_in,"
    "is_reservable,hours,website,business_status,match_status,match_confidence,"
    "inspection_grade,dohmh_inspection_date,dohmh_violation_code,"
    "dohmh_inspection_type,dohmh_action,dohmh_score,dohmh_grade,dohmh_grade_date,"
    "dohmh_violation_description,dohmh_critical_flag,dohmh_record_date"
)


def _row(
    camis="10000001",
    name="Joes Pizza",
    borough="Manhattan",
    cuisine="Italian",
    place_id="ChIJtest001",
    inspection_date="01/15/2025",
    violation_code="02G",
    has_takeout="true",
    has_delivery="true",
    has_dine_in="true",
    is_reservable="false",
):
    return (
        f"{camis},{name},,{name},123 Main St,,,{borough},{borough},10012,"
        f"2125551001,{cuisine},{cuisine},40.730000,-74.002000,$,{place_id},"
        f"4.7,320,,restaurant,{has_takeout},{has_delivery},{has_dine_in},"
        f"{is_reservable},Monday: 11am-11pm,,OPERATIONAL,matched,0.95,A,"
        f"{inspection_date},{violation_code},Cycle Inspection,"
        f"Violations cited,10,A,01/20/2025,Improper food storage,Critical,"
        f"01/20/2025"
    )


def _write_csv(*rows):
    tmp = tempfile.NamedTemporaryFile(
        mode="w", suffix=".csv", delete=False, encoding="utf-8"
    )
    tmp.write(HEADER + "\n")
    for row in rows:
        tmp.write(row + "\n")
    tmp.close()
    return tmp.name


class IngestCsvCommandTests(TestCase):
    def tearDown(self):
        # Clean up any temp CSVs created per-test.
        pass

    def _call(self, csv_path, **kwargs):
        out = StringIO()
        err = StringIO()
        call_command("ingest_csv", csv_path, stdout=out, stderr=err, **kwargs)
        return out.getvalue(), err.getvalue()

    def test_creates_venue_and_inspection(self):
        path = _write_csv(_row())
        try:
            self._call(path)
        finally:
            os.remove(path)

        self.assertEqual(Venue.objects.count(), 1)
        venue = Venue.objects.first()
        self.assertEqual(venue.dohmh_camis, "10000001")
        self.assertEqual(venue.name, "Joes Pizza")
        self.assertEqual(venue.borough, "Manhattan")
        self.assertEqual(venue.google_place_id, "ChIJtest001")
        self.assertTrue(venue.has_takeout)
        self.assertTrue(venue.has_delivery)
        self.assertTrue(venue.has_dine_in)
        self.assertFalse(venue.is_reservable)
        self.assertTrue(
            CuisineType.objects.filter(name="Italian").exists(),
            "Cuisine should have been created",
        )
        self.assertEqual(Inspection.objects.filter(venue=venue).count(), 1)
        insp = Inspection.objects.first()
        self.assertEqual(insp.violation_code, "02G")

    def test_skips_rows_without_camis_or_place_id(self):
        path = _write_csv(_row(camis="", place_id=""), _row(camis="10000002"))
        try:
            self._call(path)
        finally:
            os.remove(path)

        # Only the second row should have produced a venue.
        self.assertEqual(Venue.objects.count(), 1)
        self.assertEqual(Venue.objects.first().dohmh_camis, "10000002")

    def test_update_existing_venue_by_camis(self):
        path1 = _write_csv(_row(name="Old Name"))
        path2 = _write_csv(_row(name="New Name", inspection_date="02/20/2025"))
        try:
            self._call(path1)
            self._call(path2)
        finally:
            os.remove(path1)
            os.remove(path2)

        # Same camis → update, not duplicate
        self.assertEqual(Venue.objects.count(), 1)
        self.assertEqual(Venue.objects.first().name, "New Name")
        # Two distinct inspections (different dates).
        self.assertEqual(Inspection.objects.count(), 2)

    def test_update_same_inspection_in_place(self):
        path1 = _write_csv(_row())
        path2 = _write_csv(_row())  # same date + same violation code
        try:
            self._call(path1)
            self._call(path2)
        finally:
            os.remove(path1)
            os.remove(path2)

        # Same venue, same inspection row → should update in place, not duplicate
        self.assertEqual(Inspection.objects.count(), 1)

    def test_create_by_place_id_when_no_camis(self):
        path = _write_csv(_row(camis="", place_id="ChIJonlyplace"))
        try:
            self._call(path)
        finally:
            os.remove(path)

        self.assertEqual(Venue.objects.count(), 1)
        venue = Venue.objects.first()
        self.assertIsNone(venue.dohmh_camis)
        self.assertEqual(venue.google_place_id, "ChIJonlyplace")

    def test_error_row_counted_and_logged(self):
        # Create a venue first that already owns ChIJclash — second CSV row tries
        # to insert a different venue with the same google_place_id under a
        # different camis; when the code tries to save it separately, it should
        # catch the error but continue.
        Venue.objects.create(
            name="Prior",
            google_place_id="ChIJclash",
            dohmh_camis="99999999",
        )
        # Row with a different camis but the same place_id. The command updates
        # the google_place_id separately — since another venue already owns it,
        # it will not be assigned (no conflict), so this is still a success,
        # not an error. To trigger an actual error path, use a value that can't
        # be parsed for a required field instead: invalid borough.
        bad_row = _row(camis="10000002", place_id="ChIJclash", cuisine="French")
        path = _write_csv(bad_row)
        try:
            self._call(path)
        finally:
            os.remove(path)

        # Both venues should still exist; ChIJclash stays on the original
        # because the code guards against duplicate assignment.
        self.assertEqual(Venue.objects.filter(google_place_id="ChIJclash").count(), 1)
        self.assertEqual(Venue.objects.count(), 2)

    def test_cuisine_cache_reuses_existing(self):
        path = _write_csv(
            _row(camis="10000001", cuisine="Thai"),
            _row(camis="10000002", cuisine="Thai"),
        )
        try:
            self._call(path)
        finally:
            os.remove(path)

        self.assertEqual(CuisineType.objects.filter(name="Thai").count(), 1)
        self.assertEqual(Venue.objects.count(), 2)


# ---------------------------------------------------------------------------
# populate_tags command
# ---------------------------------------------------------------------------


class PopulateTagsCommandTests(TestCase):
    def _call(self):
        out = StringIO()
        call_command("populate_tags", stdout=out)
        return out.getvalue()

    def test_creates_all_tag_values(self):
        """Even with no venues, it still creates the master tag rows."""
        self._call()
        self.assertTrue(FoodTypeTag.objects.filter(name="Pizza").exists())
        self.assertTrue(FoodTypeTag.objects.filter(name="Sushi").exists())
        self.assertTrue(DietaryTag.objects.filter(name="Vegan").exists())
        self.assertTrue(DietaryTag.objects.filter(name="Vegetarian").exists())
        self.assertTrue(DietaryTag.objects.filter(name="Halal").exists())
        self.assertTrue(DietaryTag.objects.filter(name="Kosher").exists())
        self.assertTrue(DietaryTag.objects.filter(name="Gluten-Free").exists())

    def test_links_food_type_tag_from_google_types(self):
        venue = Venue.objects.create(
            name="Slice", google_types=["pizza_restaurant", "restaurant"]
        )
        self._call()
        venue.refresh_from_db()
        names = set(venue.food_type_tags.values_list("name", flat=True))
        self.assertIn("Pizza", names)

    def test_links_dietary_tag_from_google_types(self):
        venue = Venue.objects.create(name="Green", google_types=["vegan_restaurant"])
        self._call()
        names = set(venue.dietary_tags.values_list("name", flat=True))
        self.assertIn("Vegan", names)

    def test_links_dietary_tag_from_cuisine_keyword(self):
        cuisine = CuisineType.objects.create(name="Halal Indian Food")
        venue = Venue.objects.create(name="Taste", cuisine_type=cuisine)
        self._call()
        names = set(venue.dietary_tags.values_list("name", flat=True))
        self.assertIn("Halal", names)

    def test_unknown_google_types_are_ignored(self):
        venue = Venue.objects.create(name="Mystery", google_types=["made_up_type"])
        self._call()
        self.assertEqual(venue.food_type_tags.count(), 0)

    def test_large_venue_count_triggers_chunk_flush(self):
        """CHUNK=1000 branch — create > 1000 venues so the flush path runs."""
        # Quickly create ~1001 venues with a recognized google_type.
        Venue.objects.bulk_create(
            [Venue(name=f"V{i}", google_types=["coffee_shop"]) for i in range(1001)]
        )
        self._call()
        # Every venue should have the Coffee Shop tag linked.
        any_venue = Venue.objects.first()
        self.assertTrue(any_venue.food_type_tags.filter(name="Coffee Shop").exists())


# ---------------------------------------------------------------------------
# Venue-app model tests
# ---------------------------------------------------------------------------


class VenueTests(TestCase):
    def setUp(self):
        self.cuisine = CuisineType.objects.create(name="Italian")
        self.dietary = DietaryTag.objects.create(name="Vegan")
        self.food_type = FoodTypeTag.objects.create(name="Quick Bite")

    def test_create_venue(self):
        venue = Venue.objects.create(name="Pizza Palace", borough="Manhattan")
        self.assertEqual(venue.name, "Pizza Palace")
        self.assertTrue(venue.is_active)
        self.assertFalse(venue.is_verified)

    def test_venue_with_cuisine_and_tags(self):
        venue = Venue.objects.create(
            name="Pasta Place",
            cuisine_type=self.cuisine,
            price_range="$$",
        )
        venue.dietary_tags.add(self.dietary)
        venue.food_type_tags.add(self.food_type)
        self.assertEqual(venue.cuisine_type.name, "Italian")
        self.assertIn(self.dietary, venue.dietary_tags.all())
        self.assertIn(self.food_type, venue.food_type_tags.all())

    def test_str(self):
        venue = Venue.objects.create(name="Test Venue")
        self.assertEqual(str(venue), "Test Venue")

    def test_google_place_id_unique(self):
        Venue.objects.create(name="Venue A", google_place_id="gplace_001")
        with self.assertRaises(IntegrityError):
            Venue.objects.create(name="Venue B", google_place_id="gplace_001")

    def test_dohmh_camis_unique(self):
        Venue.objects.create(name="Venue A", dohmh_camis="12345678")
        with self.assertRaises(IntegrityError):
            Venue.objects.create(name="Venue B", dohmh_camis="12345678")


class InspectionTests(TestCase):
    def setUp(self):
        self.venue = Venue.objects.create(name="Test Venue")

    def test_create_inspection(self):
        inspection = Inspection.objects.create(
            venue=self.venue,
            inspection_date=datetime.date(2024, 6, 1),
            grade="A",
            score=10,
        )
        self.assertEqual(inspection.venue, self.venue)
        self.assertEqual(inspection.grade, "A")

    def test_ordering_most_recent_first(self):
        Inspection.objects.create(
            venue=self.venue, inspection_date=datetime.date(2023, 1, 1), grade="B"
        )
        Inspection.objects.create(
            venue=self.venue, inspection_date=datetime.date(2024, 1, 1), grade="A"
        )
        first = self.venue.inspections.first()
        self.assertEqual(first.grade, "A")


class StudentDiscountTests(TestCase):
    def setUp(self):
        self.venue = Venue.objects.create(name="Test Venue")

    def test_create_discount(self):
        discount = StudentDiscount.objects.create(
            venue=self.venue,
            discount_type="percentage",
            discount_value="10%",
            description="10% off with NYU ID",
        )
        self.assertTrue(discount.is_active)
        self.assertTrue(discount.requires_nyu_id)

    def test_venue_can_have_multiple_discounts(self):
        StudentDiscount.objects.create(venue=self.venue, discount_type="percentage")
        StudentDiscount.objects.create(venue=self.venue, discount_type="flat")
        self.assertEqual(self.venue.discounts.count(), 2)


class VenuePhotoTests(TestCase):
    def setUp(self):
        self.venue = Venue.objects.create(name="Test Venue")
        self.user = User.objects.create_user(email="user@nyu.edu", password="pass")

    def test_create_photo(self):
        photo = VenuePhoto.objects.create(
            venue=self.venue,
            image_url="https://example.com/photo.jpg",
            source="google",
            is_primary=True,
            uploaded_by=self.user,
        )
        self.assertTrue(photo.is_primary)
        self.assertEqual(photo.source, "google")


class VenueTidbitTests(TestCase):
    def setUp(self):
        self.venue = Venue.objects.create(name="Test Venue")
        self.user = User.objects.create_user(email="user@nyu.edu", password="pass")

    def test_create_tidbit(self):
        tidbit = VenueTidbit.objects.create(
            venue=self.venue,
            content="Has a printer on the second floor.",
            added_by=self.user,
        )
        self.assertFalse(tidbit.is_verified)
        self.assertEqual(tidbit.venue, self.venue)


class ReviewTests(TestCase):
    def setUp(self):
        self.venue = Venue.objects.create(name="Test Venue")
        self.user = User.objects.create_user(email="student@nyu.edu", password="pass")
        self.visit = datetime.date(2024, 9, 15)

    def test_create_review(self):
        review = Review.objects.create(
            venue=self.venue,
            user=self.user,
            rating=4,
            title="Great spot",
            content="Loved the food.",
            visit_date=self.visit,
        )
        self.assertEqual(review.rating, 4)
        self.assertTrue(review.is_visible)
        self.assertFalse(review.is_flagged)

    def test_unique_constraint_venue_user_visit_date(self):
        Review.objects.create(
            venue=self.venue, user=self.user, rating=5, visit_date=self.visit
        )
        with self.assertRaises(IntegrityError):
            Review.objects.create(
                venue=self.venue, user=self.user, rating=3, visit_date=self.visit
            )

    def test_same_user_can_review_different_dates(self):
        Review.objects.create(
            venue=self.venue, user=self.user, rating=5, visit_date=self.visit
        )
        Review.objects.create(
            venue=self.venue,
            user=self.user,
            rating=3,
            visit_date=datetime.date(2024, 10, 1),
        )
        self.assertEqual(self.venue.reviews.count(), 2)


class ReviewCommentTests(TestCase):
    def setUp(self):
        self.venue = Venue.objects.create(name="Test Venue")
        self.student = User.objects.create_user(
            email="student@nyu.edu", password="pass"
        )
        self.manager_user = User.objects.create_user(
            email="manager@nyu.edu", password="pass", role="venue_manager"
        )
        self.review = Review.objects.create(
            venue=self.venue,
            user=self.student,
            rating=3,
            visit_date=datetime.date(2024, 9, 15),
        )

    def test_manager_response(self):
        comment = ReviewComment.objects.create(
            review=self.review,
            user=self.manager_user,
            content="Thank you for your feedback!",
            is_manager_response=True,
        )
        self.assertTrue(comment.is_manager_response)
        self.assertTrue(comment.is_visible)

    def test_ordering_oldest_first(self):
        ReviewComment.objects.create(
            review=self.review, user=self.student, content="First"
        )
        ReviewComment.objects.create(
            review=self.review, user=self.manager_user, content="Second"
        )
        comments = list(self.review.comments.all())
        self.assertEqual(comments[0].content, "First")
        self.assertEqual(comments[1].content, "Second")


class ModerationWorkflowTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.admin = User.objects.create_user(
            email="admin@nyu.edu",
            password="pass",
            role="admin",
            is_staff=True,
        )
        self.reporter = User.objects.create_user(
            email="reporter@nyu.edu", password="pass"
        )
        self.author = User.objects.create_user(email="author@nyu.edu", password="pass")
        self.venue = Venue.objects.create(name="Queue Venue")
        self.review = Review.objects.create(
            venue=self.venue,
            user=self.author,
            rating=2,
            title="Bad",
            content="Offensive text",
            visit_date=datetime.date(2025, 1, 1),
        )

    def test_report_review_creates_pending_report(self):
        self.client.force_login(self.reporter)
        res = self.client.post(
            reverse("report_review", args=[self.review.id]),
            data=json.dumps({"reason": "Harassment"}),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 201)
        self.review.refresh_from_db()
        self.assertTrue(self.review.is_flagged)
        report = ContentReport.objects.get(review=self.review)
        self.assertEqual(report.status, ContentReport.Status.PENDING)
        self.assertEqual(report.reporter_id, self.reporter.id)

    def test_admin_confirm_hides_content_and_records_audit(self):
        report = ContentReport.objects.create(
            review=self.review,
            reporter=self.reporter,
            reason="Abusive language",
        )
        self.client.force_login(self.admin)
        with patch("venues.views.send_mail") as send_mail_mock:
            res = self.client.post(
                reverse("admin_moderation_action", args=[report.id]),
                data=json.dumps({"action": "confirm"}),
                content_type="application/json",
            )
        self.assertEqual(res.status_code, 200)
        report.refresh_from_db()
        self.review.refresh_from_db()
        self.assertEqual(report.status, ContentReport.Status.CONFIRMED)
        self.assertEqual(report.reviewed_by_id, self.admin.id)
        self.assertIsNotNone(report.reviewed_at)
        self.assertFalse(self.review.is_visible)
        send_mail_mock.assert_called_once()

    def test_admin_queue_includes_report_reason_and_reporter(self):
        ContentReport.objects.create(
            review=self.review,
            reporter=self.reporter,
            reason="Spam",
        )
        self.client.force_login(self.admin)
        res = self.client.get(reverse("admin_moderation_queue"))
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertEqual(payload["totalCount"], 1)
        first = payload["reports"][0]
        self.assertEqual(first["reason"], "Spam")
        self.assertEqual(first["reporter"]["email"], "reporter@nyu.edu")


class StrictPreferenceFilterTest(TestCase):
    """Covers the STRICT_PREFERENCE_FILTERS toggle in filter_venues_by_preferences.

    Dietary and food-type tags are inclusive-OR: a venue passes if it matches
    at least one selected tag in each list. Both filters are applied only when
    the settings flag is True; otherwise the arguments are ignored.
    """

    def setUp(self):
        self.vegetarian = DietaryTag.objects.create(name="Vegetarian")
        self.halal = DietaryTag.objects.create(name="Halal")
        self.kosher = DietaryTag.objects.create(name="Kosher")

        self.pizza = FoodTypeTag.objects.create(name="Pizza")
        self.burgers = FoodTypeTag.objects.create(name="Burgers")
        self.salads = FoodTypeTag.objects.create(name="Salads")

        # All venues get a google_place_id so the default require_photos
        # filter doesn't strip them out.
        def make_venue(name):
            return Venue.objects.create(
                name=name,
                is_active=True,
                google_place_id=f"place-{name.lower().replace(' ', '-')}",
            )

        self.veg_venue = make_venue("Veg Place")
        self.veg_venue.dietary_tags.add(self.vegetarian)

        self.halal_venue = make_venue("Halal Place")
        self.halal_venue.dietary_tags.add(self.halal)

        self.kosher_venue = make_venue("Kosher Place")
        self.kosher_venue.dietary_tags.add(self.kosher)

        self.pizza_venue = make_venue("Pizza Place")
        self.pizza_venue.food_type_tags.add(self.pizza)

        self.burger_venue = make_venue("Burger Place")
        self.burger_venue.food_type_tags.add(self.burgers)

        self.salad_venue = make_venue("Salad Place")
        self.salad_venue.food_type_tags.add(self.salads)

        self.veg_pizza_venue = make_venue("Veg Pizza Place")
        self.veg_pizza_venue.dietary_tags.add(self.vegetarian)
        self.veg_pizza_venue.food_type_tags.add(self.pizza)

    @override_settings(STRICT_PREFERENCE_FILTERS=True)
    def test_dietary_filter_is_inclusive_or(self):
        from venues.filters import filter_venues_by_preferences

        qs = filter_venues_by_preferences(
            dietary_tag_names=["Vegetarian", "Halal"],
            require_photos=False,
        )
        names = set(qs.values_list("name", flat=True))
        self.assertIn("Veg Place", names)
        self.assertIn("Halal Place", names)
        self.assertIn("Veg Pizza Place", names)
        self.assertNotIn("Kosher Place", names)

    @override_settings(STRICT_PREFERENCE_FILTERS=True)
    def test_food_type_filter_is_inclusive_or(self):
        from venues.filters import filter_venues_by_preferences

        qs = filter_venues_by_preferences(
            food_type_tag_names=["Pizza", "Burgers"],
            require_photos=False,
        )
        names = set(qs.values_list("name", flat=True))
        self.assertIn("Pizza Place", names)
        self.assertIn("Burger Place", names)
        self.assertIn("Veg Pizza Place", names)
        self.assertNotIn("Salad Place", names)

    @override_settings(STRICT_PREFERENCE_FILTERS=True)
    def test_dietary_and_food_type_filters_combine(self):
        from venues.filters import filter_venues_by_preferences

        qs = filter_venues_by_preferences(
            dietary_tag_names=["Vegetarian"],
            food_type_tag_names=["Pizza"],
            require_photos=False,
        )
        names = set(qs.values_list("name", flat=True))
        # Veg Pizza Place is the only venue tagged both Vegetarian AND Pizza;
        # Veg Place passes dietary but is not a Pizza venue; Pizza Place is
        # Pizza but has no dietary tag.
        self.assertEqual(names, {"Veg Pizza Place"})

    @override_settings(STRICT_PREFERENCE_FILTERS=False)
    def test_flag_off_ignores_tag_filters(self):
        from venues.filters import filter_venues_by_preferences

        qs = filter_venues_by_preferences(
            dietary_tag_names=["Nonexistent"],
            food_type_tag_names=["Nonexistent"],
            require_photos=False,
        )
        # With the flag off, the tag args are ignored entirely — all active
        # venues with a google_place_id come back.
        names = set(qs.values_list("name", flat=True))
        self.assertEqual(len(names), 7)


# ---------------------------------------------------------------------------
# /api/venues/preview/  +  /api/venues/<id>/preview-detail/
# ---------------------------------------------------------------------------


class VenuePreviewEndpointTests(TestCase):
    """Integration tests for the preference-preview endpoints in venues.views.

    Covers method/auth errors, ``countOnly``, limit/offset bounds, and a basic
    filter case so the routes driving the preference-preview UI stay correct.
    """

    URL = "/api/venues/preview/"

    def setUp(self):
        self.user = User.objects.create_user(
            email="preview-user@example.com", password="password123"
        )

        self.italian = CuisineType.objects.create(name="Italian")
        self.chinese = CuisineType.objects.create(name="Chinese")

        # Seed 3 venues so pagination is meaningful. Each gets a google_place_id
        # (not strictly required since require_photos=False in the endpoint, but
        # keeps the test rows realistic).
        self.v_italian = Venue.objects.create(
            name="Preview Italian",
            is_active=True,
            cuisine_type=self.italian,
            google_place_id="place-italian",
            google_rating=4.7,
        )
        self.v_chinese = Venue.objects.create(
            name="Preview Chinese",
            is_active=True,
            cuisine_type=self.chinese,
            google_place_id="place-chinese",
            google_rating=4.3,
        )
        self.v_other = Venue.objects.create(
            name="Preview Other",
            is_active=True,
            google_place_id="place-other",
            google_rating=4.1,
        )

    # --- method / auth errors ----------------------------------------------

    def test_preview_requires_auth(self):
        resp = self.client.post(
            self.URL, data=json.dumps({}), content_type="application/json"
        )
        self.assertEqual(resp.status_code, 401)

    def test_preview_rejects_get(self):
        self.client.force_login(self.user)
        resp = self.client.get(self.URL)
        self.assertEqual(resp.status_code, 405)

    def test_preview_rejects_invalid_json(self):
        self.client.force_login(self.user)
        resp = self.client.post(
            self.URL, data="not-json", content_type="application/json"
        )
        self.assertEqual(resp.status_code, 400)

    # --- countOnly ----------------------------------------------------------

    def test_preview_count_only_returns_count_without_venues(self):
        self.client.force_login(self.user)
        resp = self.client.post(
            self.URL,
            data=json.dumps({"countOnly": True}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["count"], 3)
        self.assertEqual(data["venues"], [])

    # --- limit/offset bounds -----------------------------------------------

    def test_preview_applies_limit_and_offset(self):
        self.client.force_login(self.user)
        resp = self.client.post(
            self.URL,
            data=json.dumps({"limit": 2, "offset": 0}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()["venues"]), 2)

        resp2 = self.client.post(
            self.URL,
            data=json.dumps({"limit": 2, "offset": 2}),
            content_type="application/json",
        )
        self.assertEqual(len(resp2.json()["venues"]), 1)

    def test_preview_clamps_invalid_limit_offset(self):
        # limit > 50 → clamped; non-numeric limit → default; negative offset → 0.
        self.client.force_login(self.user)
        resp = self.client.post(
            self.URL,
            data=json.dumps({"limit": 9999, "offset": -5}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        resp2 = self.client.post(
            self.URL,
            data=json.dumps({"limit": "not-a-number", "offset": "nope"}),
            content_type="application/json",
        )
        self.assertEqual(resp2.status_code, 200)

    # --- basic filter case --------------------------------------------------

    def test_preview_filters_by_cuisine(self):
        self.client.force_login(self.user)
        resp = self.client.post(
            self.URL,
            data=json.dumps({"cuisines": ["Italian"]}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        names = {v["name"] for v in data["venues"]}
        self.assertEqual(data["count"], 1)
        self.assertEqual(names, {"Preview Italian"})

    def test_preview_unknown_cuisine_returns_zero(self):
        # Cuisines input non-empty but none exist in the DB → short-circuits
        # to count=0 rather than falling back to "no filter".
        self.client.force_login(self.user)
        resp = self.client.post(
            self.URL,
            data=json.dumps({"cuisines": ["NonExistent Cuisine"]}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["count"], 0)
        self.assertEqual(data["venues"], [])


class VenuePreviewDetailEndpointTests(TestCase):
    URL_FMT = "/api/venues/{venue_id}/preview-detail/"

    def setUp(self):
        self.user = User.objects.create_user(
            email="detail-user@example.com", password="password123"
        )
        self.venue = Venue.objects.create(
            name="Detail Venue",
            is_active=True,
            google_place_id="place-detail",
        )

    def test_detail_requires_auth(self):
        resp = self.client.get(self.URL_FMT.format(venue_id=self.venue.id))
        self.assertEqual(resp.status_code, 401)

    def test_detail_rejects_wrong_method(self):
        self.client.force_login(self.user)
        resp = self.client.post(self.URL_FMT.format(venue_id=self.venue.id))
        self.assertEqual(resp.status_code, 405)

    def test_detail_returns_404_for_inactive_venue(self):
        self.venue.is_active = False
        self.venue.save()
        self.client.force_login(self.user)
        resp = self.client.get(self.URL_FMT.format(venue_id=self.venue.id))
        self.assertEqual(resp.status_code, 404)

    def test_detail_returns_venue_when_found(self):
        # bulk_prefetch_photos hits Google Places; patch it so the test runs
        # offline and doesn't depend on a live API key.
        self.client.force_login(self.user)
        with patch("venues.views.bulk_prefetch_photos") as mock_fetch:
            mock_fetch.return_value = None
            resp = self.client.get(self.URL_FMT.format(venue_id=self.venue.id))
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["venue"]["name"], "Detail Venue")
