from django.contrib.auth import get_user_model
from django.test import TestCase

from .models import Project, Task

User = get_user_model()


class VisibilityTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user("alice", password="x")
        self.bob = User.objects.create_user("bob", password="x")
        self.carol = User.objects.create_user("carol", password="x")
        self.p_alice = Project.objects.create(name="A", owner=self.alice)
        self.p_bob = Project.objects.create(name="B", owner=self.bob)
        # A task in alice's project, assigned to bob.
        self.task = Task.objects.create(
            title="t", project=self.p_alice, assigned_to=self.bob
        )

    def test_project_visibility(self):
        # Strict: only owned projects, regardless of assigned tasks within.
        self.assertEqual(set(Project.objects.visible_to(self.alice)), {self.p_alice})
        self.assertEqual(set(Project.objects.visible_to(self.bob)), {self.p_bob})
        self.assertEqual(set(Project.objects.visible_to(self.carol)), set())

    def test_task_visibility(self):
        # Strict: only the assignee sees the task — not the project owner.
        self.assertIn(self.task, Task.objects.visible_to(self.bob))
        self.assertNotIn(self.task, Task.objects.visible_to(self.alice))
        self.assertEqual(list(Task.objects.visible_to(self.carol)), [])
