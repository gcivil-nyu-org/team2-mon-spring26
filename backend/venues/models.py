from django.db import models
from django.conf import settings
from accounts.models import (
    CuisineType,
    DietaryTag,
    FoodTypeTag,
    VenueManagerProfile,
    SANITATION_GRADE_CHOICES,
    PRICE_RANGE_CHOICES,
)

# ``PRICE_RANGE_CHOICES`` is defined once in ``accounts.models`` and re-exported
# here so existing callers (``from venues.models import PRICE_RANGE_CHOICES``)
# keep working without duplicating the enum in two apps.

BOROUGH_CHOICES = [
    ("Manhattan", "Manhattan"),
    ("Brooklyn", "Brooklyn"),
    ("Queens", "Queens"),
    ("Bronx", "Bronx"),
    ("Staten Island", "Staten Island"),
]


class Venue(models.Model):
    """Central venue table — merges DOHMH, Google Places, and manager data."""

    # Ownership & Status
    managed_by = models.ForeignKey(
        VenueManagerProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="venues",
    )
    is_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    # Basic Information
    name = models.CharField(max_length=255)
    name_clean = models.CharField(max_length=255, blank=True)
    cuisine_type = models.ForeignKey(
        CuisineType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="venues",
    )
    price_range = models.CharField(
        max_length=4,
        choices=PRICE_RANGE_CHOICES,
        blank=True,
    )

    # Location
    street_address = models.CharField(max_length=255, blank=True)
    borough = models.CharField(max_length=20, choices=BOROUGH_CHOICES, blank=True)
    neighborhood = models.CharField(max_length=100, blank=True)
    zipcode = models.CharField(max_length=10, blank=True)
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )

    # Contact Information
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    website = models.URLField(blank=True)

    # Venue Details
    sanitation_grade = models.CharField(
        max_length=2,
        choices=SANITATION_GRADE_CHOICES,
        blank=True,
    )
    seating_capacity = models.PositiveIntegerField(null=True, blank=True)
    has_group_seating = models.BooleanField(default=False)

    # Google Places Data
    google_place_id = models.CharField(
        max_length=255, unique=True, null=True, blank=True
    )
    google_rating = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True
    )
    google_review_count = models.PositiveIntegerField(default=0)
    google_maps_url = models.URLField(blank=True)
    google_types = models.JSONField(default=list, blank=True)

    # Meal Swipe Rating (denormalized aggregates from Review table)
    mealswipe_rating = models.DecimalField(max_digits=3, decimal_places=1, default=0.0)
    mealswipe_review_count = models.PositiveIntegerField(default=0)

    # Service Options
    has_takeout = models.BooleanField(default=False)
    has_delivery = models.BooleanField(default=False)
    has_dine_in = models.BooleanField(default=True)
    is_reservable = models.BooleanField(default=False)

    # Operating Hours
    hours = models.JSONField(default=dict, blank=True)
    business_status = models.CharField(max_length=50, blank=True)

    # DOHMH Specific
    dohmh_camis = models.CharField(max_length=20, unique=True, null=True, blank=True)

    # Data Matching
    match_status = models.CharField(max_length=50, blank=True)
    match_confidence = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Many-to-many
    dietary_tags = models.ManyToManyField(DietaryTag, related_name="venues", blank=True)
    food_type_tags = models.ManyToManyField(
        FoodTypeTag, related_name="venues", blank=True
    )

    def __str__(self):
        return self.name


class Inspection(models.Model):
    """DOHMH inspection records. A venue can have many inspections over time."""

    venue = models.ForeignKey(
        Venue, on_delete=models.CASCADE, related_name="inspections"
    )
    inspection_date = models.DateField(null=True, blank=True)
    inspection_type = models.CharField(max_length=100, blank=True)
    action = models.CharField(max_length=255, blank=True)
    score = models.IntegerField(null=True, blank=True)
    grade = models.CharField(max_length=2, blank=True)
    grade_date = models.DateField(null=True, blank=True)
    violation_code = models.CharField(max_length=20, blank=True)
    violation_description = models.TextField(blank=True)
    critical_flag = models.CharField(max_length=20, blank=True)
    record_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-inspection_date"]

    def __str__(self):
        return f"{self.venue.name} — {self.inspection_date} ({self.grade})"


class StudentDiscount(models.Model):
    """Student-specific perks and discounts managed by venue managers."""

    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name="discounts")
    discount_type = models.CharField(max_length=100, blank=True)
    discount_value = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    requires_nyu_id = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    valid_from = models.DateField(null=True, blank=True)
    valid_until = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.venue.name} — {self.discount_type}"


class VenuePhoto(models.Model):
    """Photo references for venue profiles (Google Places URL or S3 URL)."""

    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name="photos")
    image_url = models.URLField(max_length=2048)
    source = models.CharField(max_length=50, blank=True)
    is_primary = models.BooleanField(default=False)
    caption = models.CharField(max_length=255, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_photos",
    )
    fetched_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            # Enforces at DB level that each venue has at most one primary photo per source,
            # making get_or_create in fetch_and_cache_primary_photo race-safe.
            models.UniqueConstraint(
                fields=["venue", "source"],
                condition=models.Q(is_primary=True),
                name="unique_primary_photo_per_source",
            )
        ]

    def __str__(self):
        return f"{self.venue.name} — {'primary' if self.is_primary else 'photo'}"


class VenueTidbit(models.Model):
    """Freeform 'good-to-know' information about venues."""

    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name="tidbits")
    content = models.TextField()
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tidbits",
    )
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.venue.name} — tidbit"


class Review(models.Model):
    """NYU community reviews for venues after a swipe session."""

    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    rating = models.PositiveSmallIntegerField()  # 1 to 5
    title = models.CharField(max_length=255, blank=True)
    content = models.TextField(blank=True)
    visit_date = models.DateField()
    is_flagged = models.BooleanField(default=False)
    is_visible = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("venue", "user", "visit_date")

    def __str__(self):
        return f"{self.user.email} — {self.venue.name} ({self.rating}★)"


class VenueClaim(models.Model):
    """Tracks a venue manager's claim to own/manage a venue. Admin approves claims."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name="claims")
    manager = models.ForeignKey(
        VenueManagerProfile, on_delete=models.CASCADE, related_name="claims"
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    note = models.TextField(blank=True)  # manager's justification
    admin_note = models.TextField(blank=True)  # reviewer notes
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("venue", "manager")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.manager} → {self.venue.name} ({self.status})"


class ReviewComment(models.Model):
    """Comments on reviews — primarily for venue manager responses."""

    review = models.ForeignKey(
        Review, on_delete=models.CASCADE, related_name="comments"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="review_comments",
    )
    content = models.TextField()
    is_manager_response = models.BooleanField(default=False)
    is_flagged = models.BooleanField(default=False)
    is_visible = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Comment by {self.user.email} on review {self.review.id}"
