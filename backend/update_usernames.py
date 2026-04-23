import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()
for u in User.objects.all():
    u.username = f"{u.email}_{u.role}"
    u.save(update_fields=["username"])
print("Updated usernames successfully.")
