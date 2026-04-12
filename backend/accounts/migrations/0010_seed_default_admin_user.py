import logging
import os

from django.db import migrations
from django.contrib.auth.hashers import make_password

logger = logging.getLogger(__name__)


def seed_default_admin_user(apps, schema_editor):
    from django.conf import settings

    User = apps.get_model("accounts", "User")

    email = os.environ.get("ADMIN_SEED_EMAIL", "").strip()
    password = os.environ.get("ADMIN_SEED_PASSWORD", "").strip()

    if not email or not password:
        if settings.DEBUG:
            email = email or "admin@mealswipe.local"
            password = password or "mealswipe_admin"
            logger.warning(
                "ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD not set — "
                "using insecure dev defaults. Do not use in production."
            )
        else:
            logger.warning(
                "ADMIN_SEED_EMAIL or ADMIN_SEED_PASSWORD environment variable not set "
                "— skipping default admin seed. Set both variables and re-run "
                "migrations to create the bootstrap admin account."
            )
            return

    admin_user, created = User.objects.get_or_create(
        email=email,
        defaults={
            "first_name": "Admin",
            "last_name": "",
            "role": "admin",
            "is_staff": True,
            "is_superuser": False,
            "is_active": True,
            "password": make_password(password),
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
