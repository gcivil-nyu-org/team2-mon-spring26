"""Custom SMTP email backend that uses certifi for SSL certificate verification.

macOS Python installations often lack access to the system certificate store,
causing ``[SSL: CERTIFICATE_VERIFY_FAILED]`` when Django's default SMTP backend
tries to connect to Gmail (or any TLS-enabled host).  This backend overrides
the SSL context so that ``certifi``'s up-to-date CA bundle is always used.

Usage – set in ``.env``::

    EMAIL_BACKEND=accounts.smtp_backend.CertifiSMTPBackend
"""

import ssl

from django.core.mail.backends.smtp import EmailBackend as DjangoSMTPBackend


class CertifiSMTPBackend(DjangoSMTPBackend):
    """SMTP backend that builds an SSL context with certifi CA certificates."""

    @property
    def ssl_context(self):
        ctx = self._ssl_context
        if ctx is None:
            try:
                import certifi

                ctx = ssl.create_default_context(cafile=certifi.where())
            except ImportError:
                ctx = ssl.create_default_context()
            self._ssl_context = ctx
        return ctx

    @ssl_context.setter
    def ssl_context(self, value):
        self._ssl_context = value

    def __init__(self, *args, **kwargs):
        self._ssl_context = None
        super().__init__(*args, **kwargs)
