"""Invalidate per-user dashboard caches when a task changes.

A task appears in dashboard counts for two users (see Task.visible_to): the
project owner and the assignee. On any task write we clear those users' caches —
including the *previous* assignee/owner on a reassign or project move.
"""

from django.core.cache import cache
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from .models import Project, Task


def _invalidate(*user_ids):
    keys = [f"dashboard:{uid}" for uid in {*user_ids} if uid]
    if keys:
        cache.delete_many(keys)


def _owner_id(project_id):
    return Project.objects.filter(pk=project_id).values_list("owner_id", flat=True).first()


@receiver(pre_save, sender=Task)
def _stash_previous(sender, instance, **kwargs):
    instance._old_assignee_id = None
    instance._old_project_id = None
    if instance.pk:
        prev = (
            Task.objects.filter(pk=instance.pk)
            .values("assigned_to_id", "project_id")
            .first()
        )
        if prev:
            instance._old_assignee_id = prev["assigned_to_id"]
            instance._old_project_id = prev["project_id"]


@receiver(post_save, sender=Task)
def _invalidate_on_save(sender, instance, **kwargs):
    ids = [
        instance.assigned_to_id,
        _owner_id(instance.project_id),
        getattr(instance, "_old_assignee_id", None),
    ]
    old_project_id = getattr(instance, "_old_project_id", None)
    if old_project_id and old_project_id != instance.project_id:
        ids.append(_owner_id(old_project_id))
    _invalidate(*ids)


@receiver(post_delete, sender=Task)
def _invalidate_on_delete(sender, instance, **kwargs):
    _invalidate(instance.assigned_to_id, _owner_id(instance.project_id))
