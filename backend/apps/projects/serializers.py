from rest_framework import serializers

from .models import Project, Task


class ProjectSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Project
        fields = ("id", "name", "description", "owner", "created_at")
        read_only_fields = ("owner", "created_at")


class TaskSerializer(serializers.ModelSerializer):
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
            "project",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def validate_project(self, project):
        # A task may only be attached to a project the requester owns.
        user = self.context["request"].user
        if project.owner_id != user.id:
            raise serializers.ValidationError("You do not own this project.")
        return project
