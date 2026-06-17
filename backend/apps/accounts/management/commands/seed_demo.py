from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.projects.models import Project, Task

DEFAULT_USERNAME = "demo"
DEFAULT_PASSWORD = "demo12345"
PROJECT_NAME = "Q3 Launch"

STATUSES = [Task.Status.TODO, Task.Status.IN_PROGRESS, Task.Status.DONE]
PRIORITIES = [
    Task.Priority.LOW,
    Task.Priority.MEDIUM,
    Task.Priority.HIGH,
    Task.Priority.URGENT,
]
# 20 tasks (matches the board's PAGE_SIZE so they all show on the first page).
TASK_TITLES = [
    "Draft pricing page copy",
    "Audit onboarding emails",
    "Migrate billing webhooks",
    "Ship dark-mode tokens",
    "Add CSV export to reports",
    "Fix flaky checkout test",
    "Rotate API signing keys",
    "Compress hero imagery",
    "Write the incident runbook",
    "Deprecate legacy v1 endpoints",
    "Tune the Postgres connection pool",
    "Localize the settings screen",
    "Add rate limiting to login",
    "Backfill missing invoices",
    "Instrument funnel analytics",
    "Refactor the email queue worker",
    "Add keyboard shortcuts to the board",
    "Review the vendor security questionnaire",
    "Archive stale feature flags",
    "Wire up usage-based billing alerts",
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
                    status=STATUSES[i % len(STATUSES)],
                    priority=PRIORITIES[i % len(PRIORITIES)],
                )
                for i, title in enumerate(TASK_TITLES)
            )
            created_tasks = len(TASK_TITLES)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded user '{DEFAULT_USERNAME}' (password: {DEFAULT_PASSWORD}), "
                f"project '{PROJECT_NAME}', +{created_tasks} tasks."
            )
        )
