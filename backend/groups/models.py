from django.db import models
from django.conf import settings

# Create your models here.


class Group(models.Model):
    """
    A social unit where users can coordinate dining decisions together.
    """

    class GroupType(models.TextChoices):
        CASUAL = "casual", "Casual"
        FORMAL = "formal", "Formal"

    class PrivacyType(models.TextChoices):
        PUBLIC = "public", "Public"
        INVITE_ONLY = "invite-only", "Invite-only"

    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    group_type = models.CharField(
        max_length=20, choices=GroupType.choices, default=GroupType.CASUAL
    )
    default_location = models.CharField(max_length=255, blank=True)
    privacy = models.CharField(
        max_length=20, choices=PrivacyType.choices, default=PrivacyType.PUBLIC
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_groups",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class GroupMembership(models.Model):
    """
    Links users to groups and defines their permissions (e.g. leader vs member).
    """

    class Role(models.TextChoices):
        LEADER = "leader", "Leader"
        MEMBER = "member", "Member"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships"
    )
    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="memberships"
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
    join_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "group")

    def __str__(self):
        return f"{self.user.email} in {self.group.name} ({self.role})"
