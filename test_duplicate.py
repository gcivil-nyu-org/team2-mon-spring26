import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model
from groups.models import Group, GroupMembership
from django.db import IntegrityError

User = get_user_model()
user = User.objects.first()
if not user:
    user = User.objects.create(email="testduplicate@example.com", username="testdup")

group, _ = Group.objects.get_or_create(name="Dup test group", created_by=user)

print(GroupMembership.objects.filter(user=user, group=group).count())

GroupMembership.objects.get_or_create(user=user, group=group)

print(GroupMembership.objects.filter(user=user, group=group).count())

try:
    GroupMembership.objects.create(user=user, group=group, role="member")
    print("SUCCESS: Created duplicate?!")
except IntegrityError as e:
    print("FAILED: IntegrityError as expected")

