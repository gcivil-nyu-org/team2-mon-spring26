from django.db import models
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.utils import timezone
from django.utils.text import slugify


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError('The given email must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self._create_user(email, password, **extra_fields)


USER_ROLE_CHOICES = [
    ("student", "student"),
    ("venue_manager", "venue_manager"),
    ("admin", "admin"),
]

SANITATION_GRADE_CHOICES = [
    ('', 'Not Graded'),
    ('N', 'N'),
    ('A', 'A'),
    ('Z', 'Z'),
    ('B', 'B'),
    ('C', 'C'),
]


class User(AbstractBaseUser, PermissionsMixin):
    """Central authentication model — students, venue managers, and admins."""
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150, blank=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    # password: provided by AbstractBaseUser
    role = models.CharField(
        max_length=20,
        choices=USER_ROLE_CHOICES,
        default="student",
    )
    phone = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    EMAIL_FIELD = "email"
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email


class CuisineType(models.Model):
    """Lookup table for cuisine categories. Many-to-many with Restaurant and UserPreference."""
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.slug and self.name:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class DietaryTag(models.Model):
    """Lookup table for dietary options. Many-to-many with Restaurant and UserPreference."""
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.slug and self.name:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class FoodTypeTag(models.Model):
    """Lookup table for dining categories/formats (e.g. Quick Bite, Cafe, Pizza). Many-to-many with Restaurant and UserPreference."""
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.slug and self.name:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class UserPreference(models.Model):
    """Stores personalized restaurant matching filters. One-to-one with User; M2M with DietaryTag, CuisineType, FoodTypeTag."""
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='preference',
    )
    minimum_sanitation_grade = models.CharField(
        max_length=10,
        choices=SANITATION_GRADE_CHOICES,
        default='A',
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    dietary_tags = models.ManyToManyField(
        DietaryTag,
        related_name='user_preferences',
        blank=True,
    )
    cuisine_types = models.ManyToManyField(
        CuisineType,
        related_name='user_preferences',
        blank=True,
    )
    food_type_tags = models.ManyToManyField(
        FoodTypeTag,
        related_name='user_preferences',
        blank=True,
    )

    class Meta:
        db_table = 'accounts_userpreference'

    def __str__(self):
        return f"Preferences for {self.user.email}"
