import logging
import smtplib

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


class EmailSendError(Exception):
    """Raised when an email fails to send via SMTP."""

    pass


# Keep the old name around so any existing imports/catches still work.
ResendEmailError = EmailSendError


def send_password_reset_email(to_email: str, reset_link: str) -> None:
    """Send a password-reset email using Django's configured SMTP backend.

    Relies on EMAIL_BACKEND, EMAIL_HOST, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD,
    EMAIL_PORT, EMAIL_USE_TLS, and DEFAULT_FROM_EMAIL in Django settings.
    """
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@example.com")
    subject = "Reset your Meal Swipe password"
    message = (
        "You requested a password reset for your Meal Swipe account.\n\n"
        f"Use the link below to set a new password:\n{reset_link}\n\n"
        "This link expires in 1 hour. If you did not request this reset, "
        "you can safely ignore this email."
    )

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=[to_email],
            fail_silently=False,
        )
        logger.info("Password reset email sent to %s", to_email)
    except smtplib.SMTPAuthenticationError as exc:
        logger.error(
            "SMTP authentication failed. Check EMAIL_HOST_USER and "
            "EMAIL_HOST_PASSWORD in your .env (Gmail requires a 16-char App Password). "
            "Error: %s",
            exc,
        )
        raise EmailSendError("SMTP authentication failed") from exc
    except smtplib.SMTPException as exc:
        logger.error("SMTP error while sending password reset email: %s", exc)
        raise EmailSendError(f"Failed to send email via SMTP: {exc}") from exc
    except Exception as exc:
        logger.error("Unexpected error sending password reset email: %s", exc)
        raise EmailSendError(f"Failed to send email: {exc}") from exc
