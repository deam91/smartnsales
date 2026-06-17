from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.projects.models import Project, Task

DEFAULT_USERNAME = "demo"
DEFAULT_PASSWORD = "demo12345"
PROJECT_NAME = "Q3 Launch"
# Teammates the project owner can assign tasks to (login: <username>*123).
TEAM = [
    ("nadia", "Nadia", "Owusu"),
    ("theo", "Theo", "Lindqvist"),
    ("priya", "Priya", "Raman"),
    ("marcus", "Marcus", "Bauer"),
    ("lena", "Lena", "Hoffmann"),
    ("omar", "Omar", "Haddad"),
    ("sofia", "Sofia", "Marchetti"),
    ("yusuf", "Yusuf", "Demir"),
    ("greta", "Greta", "Novak"),
    ("dmitri", "Dmitri", "Sokolov"),
]

STATUSES = [Task.Status.TODO, Task.Status.IN_PROGRESS, Task.Status.DONE]
PRIORITIES = [
    Task.Priority.LOW,
    Task.Priority.MEDIUM,
    Task.Priority.HIGH,
    Task.Priority.URGENT,
]
TASK_COUNT = 100
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


def _title(i: int) -> str:
    base = TASK_TITLES[i % len(TASK_TITLES)]
    batch = i // len(TASK_TITLES)
    return base if batch == 0 else f"{base} #{batch + 1}"


class Command(BaseCommand):
    help = "Seed a demo user plus a sample project and tasks for local use."

    def handle(self, *args, **options):
        User = get_user_model()
        user, _ = User.objects.get_or_create(
            username=DEFAULT_USERNAME, defaults={"email": "demo@example.com"}
        )
        user.first_name, user.last_name = "Demo", "User"
        user.set_password(DEFAULT_PASSWORD)  # idempotent: always (re)sets it
        user.save(update_fields=["first_name", "last_name", "password"])

        team = []
        for username, first, last in TEAM:
            member, _ = User.objects.get_or_create(
                username=username, defaults={"email": f"{username}@example.com"}
            )
            member.first_name, member.last_name = first, last
            member.set_password(f"{username}*123")  # real login: <username>*123
            member.save(update_fields=["first_name", "last_name", "password"])
            team.append(member)

        project, _ = Project.objects.get_or_create(
            name=PROJECT_NAME,
            owner=user,
            defaults={"description": "Sample launch workstream."},
        )

        created_tasks = 0
        if not project.tasks.exists():  # don't duplicate on re-run
            assignees = [user, *team]  # cycle so cards show varied @usernames
            today = timezone.localdate()
            Task.objects.bulk_create(
                Task(
                    project=project,
                    assigned_to=assignees[i % len(assignees)],
                    title=_title(i),
                    status=STATUSES[i % len(STATUSES)],
                    priority=PRIORITIES[i % len(PRIORITIES)],
                    # Spread due dates -3..+5 days so the dashboard shows
                    # real overdue / due-this-week counts.
                    due_date=today + timedelta(days=(i % 9) - 3),
                )
                for i in range(TASK_COUNT)
            )
            created_tasks = TASK_COUNT

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded user '{DEFAULT_USERNAME}' (password: {DEFAULT_PASSWORD}), "
                f"{len(team)} teammates, project '{PROJECT_NAME}', +{created_tasks} tasks."
            )
        )
