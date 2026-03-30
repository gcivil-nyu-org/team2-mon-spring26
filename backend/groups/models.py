from django.db import models
from django.conf import settings
from accounts.models import SANITATION_GRADE_CHOICES

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


class SwipeEvent(models.Model):
    """A swipe session where group members vote on venues."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"

    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="swipe_events"
    )
    name = models.CharField(max_length=150)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ACTIVE
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_swipe_events",
    )
    matched_venue = models.ForeignKey(
        "venues.Venue",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="matched_events",
    )
    borough = models.CharField(max_length=50, blank=True)
    neighborhood = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.group.name})"


class Swipe(models.Model):
    """An individual user's swipe on a venue within a swipe event."""

    class Direction(models.TextChoices):
        LEFT = "left", "Left"
        RIGHT = "right", "Right"

    event = models.ForeignKey(
        SwipeEvent, on_delete=models.CASCADE, related_name="swipes"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="swipes",
    )
    venue = models.ForeignKey(
        "venues.Venue", on_delete=models.CASCADE, related_name="swipes"
    )
    direction = models.CharField(max_length=5, choices=Direction.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["event", "user", "venue"],
                name="unique_swipe_per_user_venue_event",
            )
        ]

    def __str__(self):
        return f"{self.user.email} swiped {self.direction} on {self.venue.name}"


class GroupConstraint(models.Model):
    """
    Stores group-level matchmaking parameters and constraints set by group leaders.
    """

    group = models.OneToOneField(
        Group,
        on_delete=models.CASCADE,
        related_name="constraints",
    )
    minimum_sanitation_grade = models.CharField(
        max_length=10,
        choices=SANITATION_GRADE_CHOICES,
        default="A",
        blank=True,
    )
    dietary_tags = models.ManyToManyField(
        "accounts.DietaryTag",
        related_name="group_constraints",
        blank=True,
    )
    cuisine_types = models.ManyToManyField(
        "accounts.CuisineType",
        related_name="group_constraints",
        blank=True,
    )
    food_type_tags = models.ManyToManyField(
        "accounts.FoodTypeTag",
        related_name="group_constraints",
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Constraints for {self.group.name}"
