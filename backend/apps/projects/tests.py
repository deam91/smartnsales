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
        self.assertEqual(set(Project.objects.visible_to(self.alice)), {self.p_alice})
        # Bob owns p_bob and is assigned a task inside p_alice → sees both.
        self.assertEqual(
            set(Project.objects.visible_to(self.bob)), {self.p_bob, self.p_alice}
        )
        self.assertEqual(set(Project.objects.visible_to(self.carol)), set())

    def test_task_visibility(self):
        # Owner of the project sees the task; so does the assignee.
        self.assertIn(self.task, Task.objects.visible_to(self.alice))
        self.assertIn(self.task, Task.objects.visible_to(self.bob))
        # Unrelated user sees nothing.
        self.assertEqual(list(Task.objects.visible_to(self.carol)), [])
