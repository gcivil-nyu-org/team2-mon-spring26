from django.core.management.base import BaseCommand, CommandError
from django.core.mail import send_mail
from django.conf import settings


class Command(BaseCommand):
    help = "Send a test email via configured EMAIL_BACKEND. Usage: manage.py send_test_email --to someone@example.com"

    def add_arguments(self, parser):
        parser.add_argument("--to", required=True, help="Recipient email address")
        parser.add_argument(
            "--subject", default="Test email from Django", help="Email subject"
        )
        parser.add_argument(
            "--body",
            default="This is a test email sent from the Django app.",
            help="Email body",
        )

    def handle(self, *args, **options):
        recipient = options["to"]
        subject = options["subject"]
        body = options["body"]
        from_email = settings.DEFAULT_FROM_EMAIL

        try:
            send_mail(subject, body, from_email, [recipient])
            self.stdout.write(
                self.style.SUCCESS(
                    f"Sent test email to {recipient} using backend {settings.EMAIL_BACKEND}"
                )
            )
        except Exception as e:
            raise CommandError(f"Failed to send email: {e}")
