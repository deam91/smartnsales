from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import DashboardView, ProjectViewSet, TaskViewSet

router = DefaultRouter()
router.register("projects", ProjectViewSet, basename="project")
router.register("tasks", TaskViewSet, basename="task")

urlpatterns = [*router.urls, path("dashboard/", DashboardView.as_view(), name="dashboard")]
