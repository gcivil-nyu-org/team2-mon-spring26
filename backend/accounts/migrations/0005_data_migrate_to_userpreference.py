# Migrate existing User preference data (JSON fields) into UserPreference and lookup tables

from django.db import migrations
from django.utils.text import slugify


def slug_from_name(name):
    s = slugify(name)
    return s if s else name.lower().replace(" ", "-")[:120]


def forward(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    UserPreference = apps.get_model("accounts", "UserPreference")
    DietaryTag = apps.get_model("accounts", "DietaryTag")
    CuisineType = apps.get_model("accounts", "CuisineType")
    FoodTypeTag = apps.get_model("accounts", "FoodTypeTag")

    for user in User.objects.all():
        pref, created = UserPreference.objects.get_or_create(
            user=user,
            defaults={"minimum_sanitation_grade": user.minimum_sanitation_grade or "A"},
        )
        if not created:
            pref.minimum_sanitation_grade = user.minimum_sanitation_grade or "A"
            pref.save()

        dietary_names = user.dietary_preferences or []
        if isinstance(dietary_names, list):
            tags = []
            for name in dietary_names:
                if name and isinstance(name, str):
                    tag, _ = DietaryTag.objects.get_or_create(
                        name=name.strip(),
                        defaults={"slug": slug_from_name(name.strip())},
                    )
                    tags.append(tag)
            pref.dietary_tags.set(tags)

        cuisine_names = user.cuisine_preferences or []
        if isinstance(cuisine_names, list):
            tags = []
            for name in cuisine_names:
                if name and isinstance(name, str):
                    tag, _ = CuisineType.objects.get_or_create(
                        name=name.strip(),
                        defaults={"slug": slug_from_name(name.strip())},
                    )
                    tags.append(tag)
            pref.cuisine_types.set(tags)

        food_names = user.food_type_preferences or []
        if isinstance(food_names, list):
            tags = []
            for name in food_names:
                if name and isinstance(name, str):
                    tag, _ = FoodTypeTag.objects.get_or_create(
                        name=name.strip(),
                        defaults={"slug": slug_from_name(name.strip())},
                    )
                    tags.append(tag)
            pref.food_type_tags.set(tags)


def backward(apps, schema_editor):
    # Re-populate User JSON fields from UserPreference (for rollback)
    User = apps.get_model("accounts", "User")
    UserPreference = apps.get_model("accounts", "UserPreference")

    for user in User.objects.all():
        try:
            pref = UserPreference.objects.get(user=user)
            user.dietary_preferences = list(
                pref.dietary_tags.values_list("name", flat=True)
            )
            user.cuisine_preferences = list(
                pref.cuisine_types.values_list("name", flat=True)
            )
            user.food_type_preferences = list(
                pref.food_type_tags.values_list("name", flat=True)
            )
            user.minimum_sanitation_grade = pref.minimum_sanitation_grade or "C"
            user.save()
        except UserPreference.DoesNotExist:
            pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0004_add_preference_lookup_models"),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
