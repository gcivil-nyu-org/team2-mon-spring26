import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()
User.objects.all().delete()
try:
    User.objects.create_user(
        email="test@example.com", password="pw", role="venue_manager"
    )
    User.objects.create_user(
        email="test@example.com", password="pw", role="venue_manager"
    )
except Exception as e:
    print("Caught expected:", e)
