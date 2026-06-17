from rest_framework import serializers

from .models import Project, Task


class ProjectSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Project
        fields = ("id", "name", "description", "owner", "created_at")
        read_only_fields = ("owner", "created_at")


class TaskSerializer(serializers.ModelSerializer):
    assignee_username = serializers.SerializerMethodField()

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
            "assignee_username",
            "project",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def get_assignee_username(self, obj: Task) -> str | None:
        return obj.assigned_to.username if obj.assigned_to_id else None

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
