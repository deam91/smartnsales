from rest_framework import serializers

from .models import Project, Task


class ProjectSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Project
        fields = ("id", "name", "description", "owner", "created_at")
        read_only_fields = ("owner", "created_at")

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Name can't be blank.")
        return name


class TaskSerializer(serializers.ModelSerializer):
    assignee_name = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = (
            "id",
            "title",
            "description",
            "status",
            "priority",
            "due_date",
            "assigned_to",
            "assignee_name",
            "project",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def get_assignee_name(self, obj: Task) -> str | None:
        user = obj.assigned_to
        return (user.get_full_name() or user.username) if obj.assigned_to_id else None

    def validate_title(self, value):
        title = value.strip()
        if len(title) < 3:
            raise serializers.ValidationError("Title must be at least 3 characters.")
        return title

    def validate_project(self, project):
        # A task may only be attached to a project the requester owns.
        user = self.context["request"].user
        if project.owner_id != user.id:
            raise serializers.ValidationError("You do not own this project.")
        return project

    def validate(self, attrs):
        # Only the project owner may set or remove the assignee.
        if "assigned_to" in attrs:
            project = attrs.get("project") or getattr(self.instance, "project", None)
            user = self.context["request"].user
            if project is not None and project.owner_id != user.id:
                raise serializers.ValidationError(
                    {"assigned_to": "Only the project owner can change the assignee."}
                )
        return attrs


class DashboardSerializer(serializers.Serializer):
    """Response shape for the dashboard endpoint (used by the OpenAPI schema)."""

    projects = serializers.IntegerField()
    tasks = serializers.DictField(child=serializers.IntegerField())
    overdue = serializers.IntegerField()
    due_this_week = serializers.IntegerField()
