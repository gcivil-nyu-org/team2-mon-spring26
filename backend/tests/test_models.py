import datetime
from django.test import TestCase
from django.db import IntegrityError

from accounts.models import (
    User,
    CuisineType,
    DietaryTag,
    FoodTypeTag,
    VenueManagerProfile,
)
from venues.models import (
    Venue,
    Inspection,
    StudentDiscount,
    VenuePhoto,
    VenueTidbit,
    Review,
    ReviewComment,
)


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
        self.assertIn("manager@nyu.edu", str(profile))


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
