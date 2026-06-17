from rest_framework import viewsets

from .models import Project, Task
from .serializers import ProjectSerializer, TaskSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    """CRUD for projects. A user only ever sees/edits projects they own."""

    serializer_class = ProjectSerializer

    def get_queryset(self):
        return Project.objects.visible_to(self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class TaskViewSet(viewsets.ModelViewSet):
    """CRUD for tasks visible to the user (assigned to them, or in a project they own)."""

    serializer_class = TaskSerializer

    def get_queryset(self):
        return Task.objects.visible_to(self.request.user).with_related()
