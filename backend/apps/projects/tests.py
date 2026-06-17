from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

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
        # Assignee sees their task; project owner sees tasks in their project.
        self.assertIn(self.task, Task.objects.visible_to(self.bob))
        self.assertIn(self.task, Task.objects.visible_to(self.alice))
        self.assertEqual(list(Task.objects.visible_to(self.carol)), [])


class ProjectApiIsolationTests(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user("alice", password="x")
        self.bob = User.objects.create_user("bob", password="x")

    def login(self, username):
        self.client.post(
            "/api/auth/login/",
            {"username": username, "password": "x"},
            format="json",
        )

    def test_unauthenticated_blocked(self):
        self.assertEqual(self.client.get("/api/projects/").status_code, 401)

    def test_users_only_see_own_projects(self):
        p = Project.objects.create(name="secret", owner=self.alice)
        self.login("bob")
        listed = [row["id"] for row in self.client.get("/api/projects/").data["results"]]
        self.assertNotIn(p.id, listed)
        self.assertEqual(self.client.get(f"/api/projects/{p.id}/").status_code, 404)

    def test_create_sets_owner(self):
        self.login("alice")
        r = self.client.post("/api/projects/", {"name": "mine"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["owner"], self.alice.id)

    def test_cannot_add_task_to_others_project(self):
        p = Project.objects.create(name="alice-only", owner=self.alice)
        self.login("bob")
        r = self.client.post(
            "/api/tasks/", {"title": "valid title", "project": p.id}, format="json"
        )
        self.assertEqual(r.status_code, 400)


class ValidationTests(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user("alice", password="x")
        self.project = Project.objects.create(name="P", owner=self.alice)
        self.client.force_authenticate(self.alice)

    def test_short_task_title_rejected(self):
        r = self.client.post(
            "/api/tasks/", {"title": "ab", "project": self.project.id}, format="json"
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("title", r.data)

    def test_blank_task_title_rejected(self):
        r = self.client.post(
            "/api/tasks/", {"title": "   ", "project": self.project.id}, format="json"
        )
        self.assertEqual(r.status_code, 400)

    def test_blank_project_name_rejected(self):
        r = self.client.post("/api/projects/", {"name": "  "}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("name", r.data)

    def test_title_is_trimmed(self):
        r = self.client.post(
            "/api/tasks/",
            {"title": "  Trimmed title  ", "project": self.project.id},
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["title"], "Trimmed title")


class TaskFilterOrderingTests(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user("alice", password="x")
        self.project = Project.objects.create(name="P", owner=self.alice)
        Task.objects.create(
            title="todo1", project=self.project, status="todo", priority=1
        )
        Task.objects.create(
            title="done1", project=self.project, status="done", priority=4
        )
        self.client.post(
            "/api/auth/login/", {"username": "alice", "password": "x"}, format="json"
        )

    def test_filter_by_status(self):
        rows = self.client.get("/api/tasks/?status=done").data["results"]
        self.assertEqual([t["title"] for t in rows], ["done1"])

    def test_bad_numeric_filter_rejected(self):
        # django-filter validates: a non-numeric priority is a 400, not a 500.
        r = self.client.get("/api/tasks/?priority=abc")
        self.assertEqual(r.status_code, 400)

    def test_ordering(self):
        rows = self.client.get("/api/tasks/?ordering=status").data["results"]
        statuses = [t["status"] for t in rows]
        self.assertEqual(statuses, sorted(statuses))


class TaskAssigneeTests(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user("alice", password="x")  # project owner
        self.bob = User.objects.create_user("bob", password="x")  # assignee, not owner
        self.project = Project.objects.create(name="P", owner=self.alice)
        self.task = Task.objects.create(
            title="t", project=self.project, assigned_to=self.bob
        )

    def test_assignee_name_in_payload(self):
        self.client.force_authenticate(self.alice)
        row = self.client.get(f"/api/tasks/{self.task.id}/").data
        self.assertEqual(row["assignee_name"], "bob")

    def test_owner_can_change_assignee(self):
        self.client.force_authenticate(self.alice)
        r = self.client.patch(
            f"/api/tasks/{self.task.id}/", {"assigned_to": self.alice.id}, format="json"
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["assignee_name"], "alice")

    def test_owner_can_remove_assignee(self):
        self.client.force_authenticate(self.alice)
        r = self.client.patch(
            f"/api/tasks/{self.task.id}/", {"assigned_to": None}, format="json"
        )
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.data["assignee_name"])

    def test_non_owner_assignee_cannot_change_assignee(self):
        self.client.force_authenticate(self.bob)  # assigned, but not the owner
        r = self.client.patch(
            f"/api/tasks/{self.task.id}/", {"assigned_to": self.alice.id}, format="json"
        )
        self.assertEqual(r.status_code, 400)

    def test_non_owner_assignee_can_still_change_status(self):
        self.client.force_authenticate(self.bob)
        r = self.client.patch(
            f"/api/tasks/{self.task.id}/", {"status": "done"}, format="json"
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["status"], "done")


class DashboardTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("alice", password="x")
        self.project = Project.objects.create(name="P", owner=self.user)
        today = timezone.localdate()
        # overdue (past + not done), due-soon (in 2 days), and a done-overdue
        # that must NOT count as overdue.
        Task.objects.create(
            title="overdue", project=self.project, status="todo",
            due_date=today - timedelta(days=1),
        )
        Task.objects.create(
            title="soon", project=self.project, status="in_progress",
            due_date=today + timedelta(days=2),
        )
        Task.objects.create(
            title="done-late", project=self.project, status="done",
            due_date=today - timedelta(days=2),
        )

    def test_requires_authentication(self):
        self.assertEqual(self.client.get("/api/dashboard/").status_code, 401)

    def test_counts(self):
        self.client.force_authenticate(self.user)
        d = self.client.get("/api/dashboard/").data
        self.assertEqual(d["projects"], 1)
        self.assertEqual(d["tasks"], {"todo": 1, "in_progress": 1, "done": 1})
        self.assertEqual(d["overdue"], 1)  # done-late excluded
        self.assertEqual(d["due_this_week"], 1)

    def test_scoped_to_user(self):
        bob = User.objects.create_user("bob", password="x")
        self.client.force_authenticate(bob)
        d = self.client.get("/api/dashboard/").data
        self.assertEqual(d["projects"], 0)
        self.assertEqual(d["overdue"], 0)
