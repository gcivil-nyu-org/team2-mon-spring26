from django.db import migrations
from django.contrib.auth.hashers import make_password


def seed_default_admin_user(apps, schema_editor):
    User = apps.get_model("accounts", "User")

    default_email = "admin@mealswipe.local"
    default_password = "mealswipe_admin"

    admin_user, created = User.objects.get_or_create(
        email=default_email,
        defaults={
            "first_name": "Admin",
            "last_name": "",
            "role": "admin",
            "is_staff": True,
            "is_superuser": False,
            "is_active": True,
            "password": make_password(default_password),
        },
    )

    if not created:
        changed = False
        if admin_user.role != "admin":
            admin_user.role = "admin"
            changed = True
        if not admin_user.is_staff:
            admin_user.is_staff = True
            changed = True
        if not admin_user.is_active:
            admin_user.is_active = True
            changed = True
        if changed:
            admin_user.save(
                update_fields=["role", "is_staff", "is_active", "updated_at"]
            )


def noop_reverse(apps, schema_editor):
    """Intentionally keep seeded admin user on reverse migrations."""


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0009_alter_userpreference_minimum_sanitation_grade"),
    ]

    operations = [
        migrations.RunPython(seed_default_admin_user, noop_reverse),
    ]
