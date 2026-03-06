"""Package marker for backend tests.

Use the module path ``tests.test_<name>`` (not ``backend.tests.test_<name>``)
when running Django tests, e.g. ``python manage.py test tests.test_auth_integration``.
Django treats the first path segment as an app name; there is no app named
``backend``, so ``backend.tests.*`` would raise ModuleNotFoundError.
"""
