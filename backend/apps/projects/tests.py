from django.contrib.auth import get_user_model
from django.test import TestCase
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
            "/api/tasks/", {"title": "x", "project": p.id}, format="json"
        )
        self.assertEqual(r.status_code, 400)


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

    def test_bad_numeric_filter_is_ignored(self):
        # ?priority=abc must not 500; it's silently dropped → all tasks returned.
        r = self.client.get("/api/tasks/?priority=abc")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 2)

    def test_ordering(self):
        rows = self.client.get("/api/tasks/?ordering=status").data["results"]
        statuses = [t["status"] for t in rows]
        self.assertEqual(statuses, sorted(statuses))
