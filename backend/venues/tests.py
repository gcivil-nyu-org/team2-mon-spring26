# venues/tests.py
from django.test import TestCase
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
