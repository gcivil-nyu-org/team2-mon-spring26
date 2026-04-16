"""
Test-only settings. Inherits everything from the main settings module and
overrides only what makes tests faster or more deterministic.

Usage:
    python manage.py test --settings=config.test_settings

Or set the environment variable once:
    export DJANGO_SETTINGS_MODULE=config.test_settings
"""

from config.settings import *  # noqa: F401, F403

# Use the fast MD5 hasher during tests.
# PBKDF2-SHA256 (the production default) runs 260 000 iterations per hash —
# slow by design for security. With ~57 create_user/set_password calls across
# the test suite this adds tens of seconds. MD5 is cryptographically broken
# but fine for throwaway test fixtures that never touch real user data.
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# Suppress console email output during tests so stderr stays clean.
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
