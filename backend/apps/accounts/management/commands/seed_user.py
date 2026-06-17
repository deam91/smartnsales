from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

DEFAULT_USERNAME = "demo"
DEFAULT_PASSWORD = "demo12345"


class Command(BaseCommand):
    help = "Create (or reset the password of) the default demo login user."

    def handle(self, *args, **options):
        User = get_user_model()
        user, created = User.objects.get_or_create(
            username=DEFAULT_USERNAME, defaults={"email": "demo@example.com"}
        )
        user.set_password(DEFAULT_PASSWORD)  # idempotent: always (re)sets it
        user.save(update_fields=["password"])
        verb = "Created" if created else "Reset password for"
        self.stdout.write(
            self.style.SUCCESS(
                f"{verb} user '{DEFAULT_USERNAME}' (password: {DEFAULT_PASSWORD})"
            )
        )
