# venues/tests.py
from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model

from venues.models import (
    Venue,
    Inspection,
    StudentDiscount,
    VenuePhoto,
    VenueTidbit,
    Review,
    ReviewComment,
)
import datetime

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
