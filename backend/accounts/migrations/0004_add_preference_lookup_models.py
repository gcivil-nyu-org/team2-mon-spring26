# Add CuisineType (TABLE 3), DietaryTag (TABLE 4), FoodTypeTag (TABLE 11), UserPreference (TABLE 10)

from django.db import migrations, models


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_alter_user_minimum_sanitation_grade"),
    ]

    operations = [
        migrations.CreateModel(
            name="CuisineType",
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
                ("name", models.CharField(max_length=100, unique=True)),
                ("slug", models.SlugField(blank=True, max_length=120, unique=True)),
            ],
        ),
        migrations.CreateModel(
            name="DietaryTag",
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
                ("name", models.CharField(max_length=100, unique=True)),
                ("slug", models.SlugField(blank=True, max_length=120, unique=True)),
            ],
        ),
        migrations.CreateModel(
            name="FoodTypeTag",
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
                ("name", models.CharField(max_length=100, unique=True)),
                ("slug", models.SlugField(blank=True, max_length=120, unique=True)),
            ],
        ),
        migrations.CreateModel(
            name="UserPreference",
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
                (
                    "minimum_sanitation_grade",
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
                        default="A",
                        max_length=10,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=models.CASCADE,
                        related_name="preference",
                        to="accounts.user",
                    ),
                ),
                (
                    "dietary_tags",
                    models.ManyToManyField(
                        blank=True,
                        related_name="user_preferences",
                        to="accounts.dietarytag",
                    ),
                ),
                (
                    "cuisine_types",
                    models.ManyToManyField(
                        blank=True,
                        related_name="user_preferences",
                        to="accounts.cuisinetype",
                    ),
                ),
                (
                    "food_type_tags",
                    models.ManyToManyField(
                        blank=True,
                        related_name="user_preferences",
                        to="accounts.foodtypetag",
                    ),
                ),
            ],
            options={
                "db_table": "accounts_userpreference",
            },
        ),
    ]
