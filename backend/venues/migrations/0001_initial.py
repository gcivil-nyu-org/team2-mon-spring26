from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("accounts", "0008_venuemanagerprofile"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Venue",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("is_verified", models.BooleanField(default=False)),
                ("is_active", models.BooleanField(default=True)),
                ("name", models.CharField(max_length=255)),
                ("name_clean", models.CharField(blank=True, max_length=255)),
                (
                    "price_range",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("$", "$"),
                            ("$$", "$$"),
                            ("$$$", "$$$"),
                            ("$$$$", "$$$$"),
                        ],
                        max_length=4,
                    ),
                ),
                ("street_address", models.CharField(blank=True, max_length=255)),
                (
                    "borough",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("Manhattan", "Manhattan"),
                            ("Brooklyn", "Brooklyn"),
                            ("Queens", "Queens"),
                            ("Bronx", "Bronx"),
                            ("Staten Island", "Staten Island"),
                        ],
                        max_length=20,
                    ),
                ),
                ("neighborhood", models.CharField(blank=True, max_length=100)),
                ("zipcode", models.CharField(blank=True, max_length=10)),
                (
                    "latitude",
                    models.DecimalField(
                        blank=True, decimal_places=6, max_digits=9, null=True
                    ),
                ),
                (
                    "longitude",
                    models.DecimalField(
                        blank=True, decimal_places=6, max_digits=9, null=True
                    ),
                ),
                ("phone", models.CharField(blank=True, max_length=30)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("website", models.URLField(blank=True)),
                (
                    "sanitation_grade",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("", "Not Graded"),
                            ("N", "N"),
                            ("A", "A"),
                            ("Z", "Z"),
                            ("B", "B"),
                            ("C", "C"),
                        ],
                        max_length=2,
                    ),
                ),
                (
                    "seating_capacity",
                    models.PositiveIntegerField(blank=True, null=True),
                ),
                ("has_group_seating", models.BooleanField(default=False)),
                (
                    "google_place_id",
                    models.CharField(
                        blank=True, max_length=255, null=True, unique=True
                    ),
                ),
                (
                    "google_rating",
                    models.DecimalField(
                        blank=True, decimal_places=1, max_digits=3, null=True
                    ),
                ),
                ("google_review_count", models.PositiveIntegerField(default=0)),
                ("google_maps_url", models.URLField(blank=True)),
                ("google_types", models.JSONField(blank=True, default=list)),
                (
                    "mealswipe_rating",
                    models.DecimalField(decimal_places=1, default=0.0, max_digits=3),
                ),
                ("mealswipe_review_count", models.PositiveIntegerField(default=0)),
                ("has_takeout", models.BooleanField(default=False)),
                ("has_delivery", models.BooleanField(default=False)),
                ("has_dine_in", models.BooleanField(default=True)),
                ("is_reservable", models.BooleanField(default=False)),
                ("hours", models.JSONField(blank=True, default=dict)),
                ("business_status", models.CharField(blank=True, max_length=50)),
                (
                    "dohmh_camis",
                    models.CharField(blank=True, max_length=20, null=True, unique=True),
                ),
                ("match_status", models.CharField(blank=True, max_length=50)),
                (
                    "match_confidence",
                    models.DecimalField(
                        blank=True, decimal_places=2, max_digits=5, null=True
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "cuisine_type",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="venues",
                        to="accounts.cuisinetype",
                    ),
                ),
                (
                    "dietary_tags",
                    models.ManyToManyField(
                        blank=True, related_name="venues", to="accounts.dietarytag"
                    ),
                ),
                (
                    "food_type_tags",
                    models.ManyToManyField(
                        blank=True, related_name="venues", to="accounts.foodtypetag"
                    ),
                ),
                (
                    "managed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="venues",
                        to="accounts.venuemanagerprofile",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="Inspection",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("inspection_date", models.DateField(blank=True, null=True)),
                ("inspection_type", models.CharField(blank=True, max_length=100)),
                ("action", models.CharField(blank=True, max_length=255)),
                ("score", models.IntegerField(blank=True, null=True)),
                ("grade", models.CharField(blank=True, max_length=2)),
                ("grade_date", models.DateField(blank=True, null=True)),
                ("violation_code", models.CharField(blank=True, max_length=20)),
                ("violation_description", models.TextField(blank=True)),
                ("critical_flag", models.CharField(blank=True, max_length=20)),
                ("record_date", models.DateField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "venue",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="inspections",
                        to="venues.venue",
                    ),
                ),
            ],
            options={
                "ordering": ["-inspection_date"],
            },
        ),
        migrations.CreateModel(
            name="StudentDiscount",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("discount_type", models.CharField(blank=True, max_length=100)),
                ("discount_value", models.CharField(blank=True, max_length=100)),
                ("description", models.TextField(blank=True)),
                ("requires_nyu_id", models.BooleanField(default=True)),
                ("is_active", models.BooleanField(default=True)),
                ("valid_from", models.DateField(blank=True, null=True)),
                ("valid_until", models.DateField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "venue",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="discounts",
                        to="venues.venue",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="VenuePhoto",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("image_url", models.URLField()),
                ("source", models.CharField(blank=True, max_length=50)),
                ("is_primary", models.BooleanField(default=False)),
                ("caption", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "uploaded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="uploaded_photos",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "venue",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="photos",
                        to="venues.venue",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="VenueTidbit",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("content", models.TextField()),
                ("is_verified", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "added_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="tidbits",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "venue",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tidbits",
                        to="venues.venue",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="Review",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("rating", models.PositiveSmallIntegerField()),
                ("title", models.CharField(blank=True, max_length=255)),
                ("content", models.TextField(blank=True)),
                ("visit_date", models.DateField()),
                ("is_flagged", models.BooleanField(default=False)),
                ("is_visible", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="reviews",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "venue",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="reviews",
                        to="venues.venue",
                    ),
                ),
            ],
            options={
                "unique_together": {("venue", "user", "visit_date")},
            },
        ),
        migrations.CreateModel(
            name="ReviewComment",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("content", models.TextField()),
                ("is_manager_response", models.BooleanField(default=False)),
                ("is_flagged", models.BooleanField(default=False)),
                ("is_visible", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "review",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="comments",
                        to="venues.review",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="review_comments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["created_at"],
            },
        ),
    ]
