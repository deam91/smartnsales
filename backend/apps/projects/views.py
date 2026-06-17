from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.filters import OrderingFilter
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Project, Task
from .serializers import ProjectSerializer, TaskSerializer


class DashboardView(APIView):
    """Aggregate counts for the current user (two queries, all DB-side)."""

    def get(self, request):
        user = request.user
        today = timezone.localdate()
        not_done = ~Q(status=Task.Status.DONE)

        counts = Task.objects.visible_to(user).aggregate(
            todo=Count("id", filter=Q(status=Task.Status.TODO)),
            in_progress=Count("id", filter=Q(status=Task.Status.IN_PROGRESS)),
            done=Count("id", filter=Q(status=Task.Status.DONE)),
            overdue=Count("id", filter=Q(due_date__lt=today) & not_done),
            due_this_week=Count(
                "id",
                filter=Q(due_date__gte=today, due_date__lte=today + timedelta(days=7))
                & not_done,
            ),
        )
        return Response(
            {
                "projects": Project.objects.visible_to(user).count(),
                "tasks": {
                    "todo": counts["todo"],
                    "in_progress": counts["in_progress"],
                    "done": counts["done"],
                },
                "overdue": counts["overdue"],
                "due_this_week": counts["due_this_week"],
            }
        )


class ProjectViewSet(viewsets.ModelViewSet):
    """CRUD for projects. A user only ever sees/edits projects they own."""

    serializer_class = ProjectSerializer
    filter_backends = [OrderingFilter]
    ordering_fields = ["name", "created_at"]

    def get_queryset(self):
        return Project.objects.visible_to(self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class TaskViewSet(viewsets.ModelViewSet):
    """CRUD for tasks visible to the user (assigned to them, or in a project they own)."""

    serializer_class = TaskSerializer
    filter_backends = [OrderingFilter]
    ordering_fields = ["priority", "due_date", "status", "created_at", "updated_at"]

    def get_queryset(self):
        qs = Task.objects.visible_to(self.request.user).select_related(
            "project", "assigned_to"
        )
        # Whitelisted exact-match filters. Numeric params are isdigit-guarded so
        # a bad value is ignored rather than raising a 500. ponytail: a few lines
        # beat pulling in django-filter for four exact-match fields.
        params = self.request.query_params
        if status := params.get("status"):
            qs = qs.filter(status=status)
        if (priority := params.get("priority")) and priority.isdigit():
            qs = qs.filter(priority=priority)
        if (project := params.get("project")) and project.isdigit():
            qs = qs.filter(project_id=project)
        if (assignee := params.get("assigned_to")) and assignee.isdigit():
            qs = qs.filter(assigned_to_id=assignee)
        return qs
