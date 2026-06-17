from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.projects.models import Project, Task

DEFAULT_USERNAME = "demo"
DEFAULT_PASSWORD = "demo12345"
PROJECT_NAME = "Q3 Launch"

SAMPLE_TASKS = [
    ("Draft pricing page copy", Task.Status.TODO, Task.Priority.HIGH),
    ("Audit onboarding emails", Task.Status.TODO, Task.Priority.MEDIUM),
    ("Migrate billing webhooks", Task.Status.IN_PROGRESS, Task.Priority.URGENT),
    ("Ship dark-mode tokens", Task.Status.DONE, Task.Priority.LOW),
]


class Command(BaseCommand):
    help = "Seed a demo user plus a sample project and tasks for local use."

    def handle(self, *args, **options):
        User = get_user_model()
        user, _ = User.objects.get_or_create(
            username=DEFAULT_USERNAME, defaults={"email": "demo@example.com"}
        )
        user.set_password(DEFAULT_PASSWORD)  # idempotent: always (re)sets it
        user.save(update_fields=["password"])

        project, _ = Project.objects.get_or_create(
            name=PROJECT_NAME,
            owner=user,
            defaults={"description": "Sample launch workstream."},
        )

        created_tasks = 0
        if not project.tasks.exists():  # don't duplicate on re-run
            Task.objects.bulk_create(
                Task(
                    project=project,
                    assigned_to=user,
                    title=title,
                    status=status,
                    priority=priority,
                )
                for title, status, priority in SAMPLE_TASKS
            )
            created_tasks = len(SAMPLE_TASKS)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded user '{DEFAULT_USERNAME}' (password: {DEFAULT_PASSWORD}), "
                f"project '{PROJECT_NAME}', +{created_tasks} tasks."
            )
        )
