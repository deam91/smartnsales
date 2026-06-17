from django.conf import settings
from django.core.validators import MinLengthValidator
from django.db import models


class ProjectQuerySet(models.QuerySet):
    def visible_to(self, user):
        # Strict: a user sees only the projects they own.
        return self.filter(owner=user)


class Project(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="projects",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ProjectQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["owner", "-created_at"])]  # owner's list

    def __str__(self):
        return self.name


class TaskQuerySet(models.QuerySet):
    def visible_to(self, user):
        # Tasks assigned to the user, plus every task in projects they own.
        return self.filter(
            models.Q(assigned_to=user) | models.Q(project__owner=user)
        )


class Task(models.Model):
    class Status(models.TextChoices):
        TODO = "todo", "To Do"
        IN_PROGRESS = "in_progress", "In Progress"
        DONE = "done", "Done"

    class Priority(models.IntegerChoices):
        LOW = 1, "Low"
        MEDIUM = 2, "Medium"
        HIGH = 3, "High"
        URGENT = 4, "Urgent"

    title = models.CharField(max_length=200, validators=[MinLengthValidator(3)])
    description = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.TODO
    )
    priority = models.PositiveSmallIntegerField(
        choices=Priority.choices, default=Priority.MEDIUM
    )
    due_date = models.DateField(null=True, blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_tasks",
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="tasks",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = TaskQuerySet.as_manager()

    class Meta:
        ordering = ["-priority", "due_date", "-created_at"]
        indexes = [
            # Board column query: filter status, order by priority/due_date.
            models.Index(fields=["status", "priority", "due_date"]),
            # ?project=&status= filter combo (FK columns are auto-indexed too).
            models.Index(fields=["project", "status"]),
            # Dashboard overdue / due-this-week date math.
            models.Index(fields=["due_date"]),
            # visible_to() assignee arm: assignee board filtered by status.
            models.Index(fields=["assigned_to", "status"]),
        ]

    def __str__(self):
        return self.title
