from datetime import timedelta

from django.core.cache import cache
from django.db.models import Count, Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Project, Task
from .serializers import DashboardSerializer, ProjectSerializer, TaskSerializer


class DashboardView(APIView):
    """Aggregate counts for the current user (two queries, all DB-side)."""

    @extend_schema(responses=DashboardSerializer)
    def get(self, request):
        user = request.user
        cache_key = f"dashboard:{user.id}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

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
        data = {
            "projects": Project.objects.visible_to(user).count(),
            "tasks": {
                "todo": counts["todo"],
                "in_progress": counts["in_progress"],
                "done": counts["done"],
            },
            "overdue": counts["overdue"],
            "due_this_week": counts["due_this_week"],
        }
        cache.set(cache_key, data, 30)  # short TTL; no explicit invalidation
        return Response(data)


class ProjectViewSet(viewsets.ModelViewSet):
    """CRUD for projects. A user only ever sees/edits projects they own."""

    serializer_class = ProjectSerializer
    ordering_fields = ["name", "created_at"]

    def get_queryset(self):
        return Project.objects.visible_to(self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class TaskViewSet(viewsets.ModelViewSet):
    """CRUD for tasks visible to the user (assigned to them, or in a project they own)."""

    serializer_class = TaskSerializer
    # django-filter validates these (bad value → 400) and documents them in the
    # schema; easy to extend as the filter set grows.
    filterset_fields = ["status", "priority", "project", "assigned_to"]
    ordering_fields = ["priority", "due_date", "status", "created_at", "updated_at"]

    def get_queryset(self):
        # Only assigned_to is read during list serialization (assignee_name).
        # The owner check in the serializer's validate() does one extra query
        # for instance.project on an assignee PATCH — fine, it's rare.
        return Task.objects.visible_to(self.request.user).select_related("assigned_to")
